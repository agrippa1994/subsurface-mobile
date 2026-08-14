// AI-generated (Claude)
#include "api.h"

#include "marshal.h"

#include "core/dive.h"
#include "core/divecomputer.h"
#include "core/divelist.h"
#include "core/divelog.h"
#include "core/divesite.h"
#include "core/divesitetable.h"
#include "core/errorhelper.h"
#include "core/parse.h"
#include "core/profile.h"
#include "core/statistics.h"
#include "core/subsurface-time.h"
#include "core/tag.h"
#include "core/trip.h"
#include "core/units.h"
#include "core/xmlparams.h"

#include <sqlite3.h>

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <stdexcept>
#include <string>
#include <vector>

namespace ssrf {

namespace {

// ---------------------------------------------------------------------------
// Process-wide state
// ---------------------------------------------------------------------------

// Every message the core routes through report_error() since the current call
// started. Cleared at the top of each call so getLastError() describes the last
// thing that happened and nothing older.
std::vector<std::string> g_errors;

void collect_error(std::string s)
{
	g_errors.push_back(std::move(s));
}

void ensure_init()
{
	static bool done = false;
	if (done)
		return;
	done = true;
	set_error_cb(collect_error);
	parse_xml_init();
	// Populates g_tag_list with the standard tags, so that parsed dives share
	// divetag instances with tags set from the UI.
	taglist_init_global();
}

std::string joined_errors()
{
	std::string out;
	for (const std::string &e : g_errors) {
		if (!out.empty())
			out += "; ";
		out += e;
	}
	return out;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

struct api_error : public std::runtime_error {
	using std::runtime_error::runtime_error;
};

[[noreturn]] void fail(const std::string &msg)
{
	throw api_error(msg);
}

std::string get_string(const json &args, const char *key, const char *fallback = "")
{
	auto it = args.find(key);
	if (it == args.end() || it->is_null())
		return fallback;
	if (!it->is_string())
		fail(std::string("argument '") + key + "' must be a string");
	return it->get<std::string>();
}

int64_t get_int(const json &args, const char *key, int64_t fallback)
{
	auto it = args.find(key);
	if (it == args.end() || it->is_null())
		return fallback;
	if (!it->is_number())
		fail(std::string("argument '") + key + "' must be a number");
	return it->get<int64_t>();
}

int64_t require_int(const json &args, const char *key)
{
	auto it = args.find(key);
	if (it == args.end() || !it->is_number())
		fail(std::string("missing required numeric argument '") + key + "'");
	return it->get<int64_t>();
}

std::string base64_decode(const std::string &in)
{
	static const std::string alphabet =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	std::string out;
	out.reserve(in.size() * 3 / 4);
	int val = 0;
	int bits = -8;
	for (unsigned char c : in) {
		if (c == '=' || std::isspace(c))
			continue;
		size_t pos = alphabet.find(static_cast<char>(c));
		if (pos == std::string::npos)
			fail("invalid base64 input");
		val = (val << 6) + static_cast<int>(pos);
		bits += 6;
		if (bits >= 0) {
			out.push_back(static_cast<char>((val >> bits) & 0xff));
			bits -= 8;
		}
	}
	return out;
}

std::string temp_dir()
{
	const char *tmp = getenv("TMPDIR");
	return tmp && *tmp ? std::string(tmp) : std::string("/tmp");
}

std::string read_file(const std::string &path)
{
	FILE *f = fopen(path.c_str(), "rb");
	if (!f)
		fail("cannot open " + path);
	std::string contents;
	char buffer[64 * 1024];
	size_t got;
	while ((got = fread(buffer, 1, sizeof(buffer), f)) > 0)
		contents.append(buffer, got);
	fclose(f);
	return contents;
}

void write_file(const std::string &path, const std::string &contents)
{
	FILE *f = fopen(path.c_str(), "wb");
	if (!f)
		fail("cannot write " + path);
	size_t written = fwrite(contents.data(), 1, contents.size(), f);
	int err = fclose(f);
	if (written != contents.size() || err)
		fail("short write to " + path);
}

// Accepts either { "path": ... } or { "base64": ... }; the latter is how an
// ArrayBuffer crosses the JSI boundary. Returns the bytes plus a name to report
// in parse errors.
std::pair<std::string, std::string> read_source(const json &args)
{
	std::string path = get_string(args, "path");
	if (!path.empty())
		return { read_file(path), path };
	auto it = args.find("base64");
	if (it == args.end() || !it->is_string())
		fail("expected either 'path' or 'base64'");
	return { base64_decode(it->get<std::string>()), "<buffer>" };
}

bool contains_ci(const std::string &haystack, const std::string &needle)
{
	if (needle.empty())
		return true;
	auto it = std::search(haystack.begin(), haystack.end(), needle.begin(), needle.end(),
			      [](unsigned char a, unsigned char b) { return std::tolower(a) == std::tolower(b); });
	return it != haystack.end();
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

// Never call divelog.dives.get_by_uniq_id() with an id that might not exist:
// in a DEBUG build (core/divelist.cpp:757-765) it reports the id and then calls
// exit(1), which takes the whole app down. Ids are process-local and are
// reassigned on every load, so a screen holding a stale one is normal - it has
// to come back as an error, not as a terminated process. The lookup is the same
// linear scan the core does, so nothing is lost by doing it here.
struct dive &require_dive(int id)
{
	auto it = std::find_if(divelog.dives.begin(), divelog.dives.end(),
			       [id](const auto &d) { return d->id == id; });
	if (it == divelog.dives.end())
		fail("no dive with id " + std::to_string(id));
	return **it;
}

struct dive_site &require_site(uint32_t uuid)
{
	struct dive_site *ds = divelog.sites.get_by_uuid(uuid);
	if (!ds)
		fail("no dive site with uuid " + std::to_string(uuid));
	return *ds;
}

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

json load_from_xml(const json &args)
{
	auto [contents, name] = read_source(args);
	if (contents.empty())
		fail("empty logbook: " + name);

	divelog.clear();
	struct xml_params params;
	if (parse_xml_buffer(name.c_str(), contents.c_str(), static_cast<int>(contents.size()), &divelog, &params))
		fail("failed to parse " + name);

	// Assigns dive numbers, computes surface intervals and CNS, and sorts the
	// table - the same post-processing the desktop app runs after a load.
	divelog.process_loaded_dives();

	return json{
		{ "dives", static_cast<int>(divelog.dives.size()) },
		{ "sites", static_cast<int>(divelog.sites.size()) },
		{ "trips", static_cast<int>(divelog.trips.size()) },
	};
}

json save_to_xml(const json &args)
{
	std::string path = get_string(args, "path");
	if (path.empty())
		fail("missing required argument 'path'");

	// Atomic: serialize to a sibling temp file, then rename over the target, so
	// a crash mid-write can never truncate the logbook. rename(2) is atomic
	// within a filesystem and the temp file is deliberately a sibling.
	std::string tmp = path + ".tmp";
	if (save_dives(tmp.c_str())) {
		remove(tmp.c_str());
		fail("failed to serialize logbook to " + tmp);
	}
	if (rename(tmp.c_str(), path.c_str())) {
		remove(tmp.c_str());
		fail("failed to move " + tmp + " into place");
	}

	return json{
		{ "path", path },
		{ "dives", static_cast<int>(divelog.dives.size()) },
	};
}

json list_dives()
{
	json out = json::array();
	for (const auto &d : divelog.dives)
		out.push_back(dive_summary_to_json(*d));
	return out;
}

json get_dive(const json &args)
{
	return dive_to_json(require_dive(static_cast<int>(require_int(args, "id"))));
}

json get_profile(const json &args)
{
	const struct dive &d = require_dive(static_cast<int>(require_int(args, "id")));
	int dcIndex = static_cast<int>(get_int(args, "dcIndex", 0));
	// dive::get_dc() clamps and wraps its argument modulo the number of
	// divecomputers, so it never reports an out-of-range index - it would
	// silently plot a different divecomputer. Reject it here instead.
	if (dcIndex < 0 || static_cast<size_t>(dcIndex) >= d.dcs.size())
		fail("dive " + std::to_string(d.id) + " has no divecomputer " + std::to_string(dcIndex));

	plot_info pi = create_plot_info_new(&d, d.get_dc(dcIndex), nullptr);
	return plot_info_to_json(pi);
}

json list_dive_sites()
{
	json out = json::array();
	for (const auto &ds : divelog.sites)
		out.push_back(dive_site_to_json(*ds));
	return out;
}

json upsert_dive_site(const json &args)
{
	uint32_t uuid = static_cast<uint32_t>(get_int(args, "uuid", 0));
	location_t loc = {
		degrees_t{ .udeg = static_cast<int>(get_int(args, "latUdeg", 0)) },
		degrees_t{ .udeg = static_cast<int>(get_int(args, "lonUdeg", 0)) },
	};

	struct dive_site *ds = uuid ? divelog.sites.get_by_uuid(uuid) : nullptr;
	if (uuid && !ds)
		fail("no dive site with uuid " + std::to_string(uuid));
	if (!ds)
		ds = divelog.sites.create(get_string(args, "name"), loc);

	// Only overwrite the fields the caller actually sent, so a partial upsert
	// does not blank out description/notes.
	if (args.contains("name"))
		ds->name = get_string(args, "name");
	if (args.contains("description"))
		ds->description = get_string(args, "description");
	if (args.contains("notes"))
		ds->notes = get_string(args, "notes");
	if (args.contains("latUdeg") || args.contains("lonUdeg"))
		ds->location = loc;

	return json{ { "uuid", ds->uuid } };
}

json delete_dive_site(const json &args)
{
	struct dive_site &ds = require_site(static_cast<uint32_t>(require_int(args, "uuid")));

	// Detach the dives first: the table owns the site and destroying it while
	// dives still point at it would leave dangling dive->dive_site pointers.
	while (!ds.dives.empty())
		unregister_dive_from_dive_site(ds.dives.back());
	divelog.sites.pull(&ds);

	return json{ { "sites", static_cast<int>(divelog.sites.size()) } };
}

json update_dive(const json &args)
{
	struct dive &d = require_dive(static_cast<int>(require_int(args, "id")));
	auto patch_it = args.find("patch");
	if (patch_it == args.end() || !patch_it->is_object())
		fail("missing required object argument 'patch'");
	const json &patch = *patch_it;

	if (patch.contains("notes"))
		d.notes = get_string(patch, "notes");
	if (patch.contains("buddy"))
		d.buddy = get_string(patch, "buddy");
	if (patch.contains("diveguide"))
		d.diveguide = get_string(patch, "diveguide");
	if (patch.contains("suit"))
		d.suit = get_string(patch, "suit");
	if (patch.contains("rating"))
		d.rating = static_cast<int>(get_int(patch, "rating", d.rating));
	if (patch.contains("visibility"))
		d.visibility = static_cast<int>(get_int(patch, "visibility", d.visibility));
	if (patch.contains("number"))
		d.number = static_cast<int>(get_int(patch, "number", d.number));
	if (patch.contains("invalid"))
		d.invalid = patch["invalid"].get<bool>();

	if (patch.contains("tags")) {
		if (!patch["tags"].is_array())
			fail("'tags' must be an array of strings");
		d.tags.clear();
		for (const json &tag : patch["tags"])
			taglist_add_tag(d.tags, tag.get<std::string>());
		taglist_cleanup(d.tags);
	}

	if (patch.contains("siteUuid")) {
		uint32_t uuid = static_cast<uint32_t>(get_int(patch, "siteUuid", 0));
		unregister_dive_from_dive_site(&d);
		if (uuid)
			require_site(uuid).add_dive(&d);
	}

	// The full-text cache indexes notes/buddy/tags, so it is stale now.
	d.invalidate_cache();

	return dive_to_json(d);
}

// Marks the dives matching `filter` as selected, since that is the input the
// core's statistics code takes (it reads dive->selected). An absent or empty
// filter selects every valid dive.
int apply_stats_filter(const json &filter)
{
	int64_t from = get_int(filter, "fromWhen", 0);
	int64_t to = get_int(filter, "toWhen", 0);
	uint32_t site = static_cast<uint32_t>(get_int(filter, "siteUuid", 0));
	int64_t minDepth = get_int(filter, "minDepthMm", 0);
	int64_t maxDepth = get_int(filter, "maxDepthMm", 0);
	std::string tag = get_string(filter, "tag");
	std::string buddy = get_string(filter, "buddy");
	bool includeInvalid = filter.value("includeInvalid", false);

	int selected = 0;
	for (const auto &dp : divelog.dives) {
		struct dive &d = *dp;
		bool match = true;
		if (!includeInvalid && d.invalid)
			match = false;
		if (from && d.when < from)
			match = false;
		if (to && d.when > to)
			match = false;
		if (site && (!d.dive_site || d.dive_site->uuid != site))
			match = false;
		if (minDepth && d.maxdepth.mm < minDepth)
			match = false;
		if (maxDepth && d.maxdepth.mm > maxDepth)
			match = false;
		if (!buddy.empty() && !contains_ci(d.buddy, buddy) && !contains_ci(d.diveguide, buddy))
			match = false;
		if (!tag.empty()) {
			bool found = false;
			for (const divetag *t : d.tags)
				found = found || (t && contains_ci(t->name, tag));
			if (!found)
				match = false;
		}
		d.selected = match;
		if (match)
			selected++;
	}
	return selected;
}

// Buckets the core does not compute, aggregated here rather than in JS so all
// statistics come out of C++ (the same reason calculate_stats_summary() does
// the rest):
//
//  - "timeline": one entry per calendar month that has dives, carrying the
//    year. The core's stats_monthly does group by (year, month) but its
//    `period` only holds the month, so a chart across years cannot label it.
//  - "byDuration": a duration histogram, which the core has no equivalent of.
//    10-minute buckets, mirroring desktop's default duration binner; the last
//    bucket is open-ended.
//  - "siteCount": distinct dive sites among the matched dives.
//
// All of these run over the same selection the core's statistics read, i.e.
// after apply_stats_filter(), and skip invalid dives exactly as it does.
const int STATS_DURATION_BUCKET_MIN = 10;
const int STATS_MAX_DURATION_MIN = 180;

json extra_statistics()
{
	const int nr_buckets = STATS_MAX_DURATION_MIN / STATS_DURATION_BUCKET_MIN + 1;
	std::vector<int> duration_dives(nr_buckets, 0);
	std::vector<int64_t> duration_time(nr_buckets, 0);

	json timeline = json::array();
	int prev_year = 0, prev_month = 0;

	std::vector<uint32_t> sites;

	for (const auto &dp : divelog.dives) {
		const struct dive &d = *dp;
		if (!d.selected || d.invalid)
			continue;

		int idx = d.duration.seconds / 60 / STATS_DURATION_BUCKET_MIN;
		idx = std::clamp(idx, 0, nr_buckets - 1);
		duration_dives[idx]++;
		duration_time[idx] += d.duration.seconds;

		struct tm tm;
		utc_mkdate(d.when, &tm);
		if (timeline.empty() || tm.tm_year != prev_year || tm.tm_mon + 1 != prev_month) {
			prev_year = tm.tm_year;
			prev_month = tm.tm_mon + 1;
			timeline.push_back(json{
				{ "year", prev_year },
				{ "month", prev_month },
				{ "dives", 0 },
				{ "totalTimeSec", 0 },
				{ "maxDepthMm", 0 },
			});
		}
		json &entry = timeline.back();
		entry["dives"] = entry["dives"].get<int>() + 1;
		entry["totalTimeSec"] = entry["totalTimeSec"].get<int64_t>() + d.duration.seconds;
		entry["maxDepthMm"] = std::max(entry["maxDepthMm"].get<int>(), d.maxdepth.mm);

		if (d.dive_site && std::find(sites.begin(), sites.end(), d.dive_site->uuid) == sites.end())
			sites.push_back(d.dive_site->uuid);
	}

	json by_duration = json::array();
	for (int i = 0; i < nr_buckets; ++i) {
		bool last = i == nr_buckets - 1;
		by_duration.push_back(json{
			{ "fromMin", i * STATS_DURATION_BUCKET_MIN },
			{ "toMin", last ? json(nullptr) : json((i + 1) * STATS_DURATION_BUCKET_MIN) },
			{ "dives", duration_dives[i] },
			{ "totalTimeSec", duration_time[i] },
		});
	}

	return json{
		{ "timeline", timeline },
		{ "byDuration", by_duration },
		{ "siteCount", static_cast<int>(sites.size()) },
	};
}

json get_statistics(const json &args)
{
	json filter = json::object();
	auto it = args.find("filter");
	if (it != args.end() && it->is_object())
		filter = *it;

	// Note: this leaves the selection set to the filter result. Nothing else in
	// the module reads dive->selected, and the next getStatistics() overwrites
	// it, so there is no state to unwind.
	int selected = apply_stats_filter(filter);

	json out = stats_summary_to_json(calculate_stats_summary(true));
	out["total"] = stats_to_json(calculate_stats_selected());
	out["matched"] = selected;
	out.update(extra_statistics());
	return out;
}

json import_suunto(const json &args)
{
	auto [contents, name] = read_source(args);
	if (contents.empty())
		fail("empty Suunto database: " + name);

	// The Suunto importers read the profile blobs through sqlite, which needs a
	// real file - so a buffer is staged to disk first. A path argument is used
	// directly.
	std::string path = get_string(args, "path");
	bool staged = path.empty();
	if (staged) {
		path = temp_dir() + "/ssrf-import-suunto.db";
		write_file(path, contents);
	}

	sqlite3 *handle = nullptr;
	if (sqlite3_open(path.c_str(), &handle)) {
		if (handle)
			sqlite3_close(handle);
		if (staged)
			remove(path.c_str());
		fail("not a readable Suunto database: " + name);
	}

	// Same schema probes the desktop app uses in core/file.cpp: DM5 stores the
	// profile in SampleBlob, DM4 in ProfileBlob.
	static const char dm5_test[] =
		"select count(*) from sqlite_master where type='table' and name='Dive' and sql like '%SampleBlob%'";
	static const char dm4_test[] =
		"select count(*) from sqlite_master where type='table' and name='Dive' and sql like '%ProfileBlob%'";
	// The probe aborts the statement (non-zero return) when the count comes back
	// as '0', so SQLITE_OK means "this schema matched" - same trick as upstream.
	auto schema_matches = [handle](const char *sql) {
		auto probe = [](void *, int, char **data, char **) -> int { return *data[0] == '0'; };
		return sqlite3_exec(handle, sql, probe, nullptr, nullptr) == SQLITE_OK;
	};

	struct divelog log;
	int rc;
	if (schema_matches(dm5_test)) {
		rc = parse_dm5_buffer(handle, path.c_str(), contents.data(), static_cast<int>(contents.size()), &log);
	} else if (schema_matches(dm4_test)) {
		rc = parse_dm4_buffer(handle, path.c_str(), contents.data(), static_cast<int>(contents.size()), &log);
	} else {
		sqlite3_close(handle);
		if (staged)
			remove(path.c_str());
		fail("unrecognized database schema (expected Suunto DM4 or DM5): " + name);
	}
	sqlite3_close(handle);
	if (staged)
		remove(path.c_str());
	if (rc)
		fail("failed to import " + name);

	int imported = static_cast<int>(log.dives.size());
	size_t before = divelog.dives.size();
	// Consumes `log`. merge_all_trips matches the mobile app's import path.
	divelog.add_imported_dives(log, import_flags::merge_all_trips);
	int added = static_cast<int>(divelog.dives.size() - before);

	return json{
		{ "added", added },
		{ "merged", imported - added },
		{ "failed", 0 },
		{ "dives", static_cast<int>(divelog.dives.size()) },
	};
}

json dispatch(const std::string &method, const json &args)
{
	if (method == "loadFromXML")
		return load_from_xml(args);
	if (method == "saveToXML")
		return save_to_xml(args);
	if (method == "listDives")
		return list_dives();
	if (method == "getDive")
		return get_dive(args);
	if (method == "getProfile")
		return get_profile(args);
	if (method == "getStatistics")
		return get_statistics(args);
	if (method == "importSuunto")
		return import_suunto(args);
	if (method == "listDiveSites")
		return list_dive_sites();
	if (method == "upsertDiveSite")
		return upsert_dive_site(args);
	if (method == "deleteDiveSite")
		return delete_dive_site(args);
	if (method == "updateDive")
		return update_dive(args);
	if (method == "getLastError")
		return joined_errors();
	if (method == "clear") {
		divelog.clear();
		return json::object();
	}
	fail("unknown method '" + method + "'");
}

} // namespace

std::string call(const std::string &method, const std::string &args_json)
{
	ensure_init();
	// getLastError reports what the *previous* call recorded, so it must not
	// wipe the buffer it is about to read.
	if (method != "getLastError")
		g_errors.clear();

	json response;
	try {
		json args = args_json.empty() ? json::object() : json::parse(args_json);
		if (!args.is_object())
			fail("arguments must be a JSON object");
		response = json{ { "ok", true }, { "result", dispatch(method, args) } };
	} catch (const std::exception &e) {
		response = json{
			{ "ok", false },
			{ "error", e.what() },
			{ "errors", g_errors },
		};
	}
	// Core messages that did not abort the call are still worth surfacing.
	if (response["ok"].get<bool>() && !g_errors.empty())
		response["errors"] = g_errors;
	return response.dump();
}

} // namespace ssrf
