// AI-generated (Claude)
#include "api.h"

#include "base64.h"
#include "marshal.h"
#include "suunto-xml.h"
#include "zip-reader.h"

#include "core/dive.h"
#include "core/divecomputer.h"
#include "core/divelist.h"
#include "core/divelog.h"
#include "core/divesite.h"
#include "core/divesitetable.h"
#include "core/equipment.h"
#include "core/errorhelper.h"
#include "core/gas.h"
#include "core/parse.h"
#include "core/profile.h"
#include "core/qthelper.h"
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

// core/file.h declares the format importers inside `#if !defined
// (SUBSURFACE_MOBILE)`, and this build defines that macro to keep the
// desktop-only code paths out of the core. The Suunto JSON importer is
// nevertheless compiled here (see core-subset.mjs), so its prototype is
// repeated rather than the guard weakened.
extern int suunto_json_import(const std::string &buffer, const std::string &fit_buffer, struct divelog *log);

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

// Autogrouping is off in this app, always: a trip exists because a file says it
// does, never because two dives happen to fall within TRIP_THRESHOLD (three
// days, core/trip.cpp) of each other. There is no UI to turn it on or off, so
// the only way it could ever be on is by accident - and it is easy to have by
// accident, because `<autogroup state='1'/>` in any file ever loaded latches the
// flag on: parse-xml.cpp only ever sets it to true, and divelog::clear() does
// not reset it. Clearing it after every parse, before any post-processing, is
// what keeps "the file had no trips" and "the app shows no trips" the same
// statement.
void disable_autogroup()
{
	divelog.autogroup = false;
}

// True when the document says it is a Subsurface logbook. An SSRF file with no
// dives in it is a legitimate thing to open - the app can write one - whereas
// any other document that yields nothing is a file picked by mistake.
bool declares_divelog(const std::string &bytes)
{
	return bytes.find("<divelog") != std::string::npos;
}

json load_from_xml(const json &args)
{
	auto [contents, name] = read_source(args);
	// Cleared before anything can fail, so that "the load failed" always means
	// "the module holds no dives" - src/store/log-store.ts drops its cache on
	// that basis rather than showing dives the module no longer has.
	divelog.clear();
	if (contents.empty())
		fail("empty logbook: " + name);

	struct xml_params params;
	if (parse_xml_buffer(name.c_str(), contents.c_str(), static_cast<int>(contents.size()), &divelog, &params))
		fail("failed to parse " + name);
	disable_autogroup();

	// The XML parser accepts a well-formed document it has no table entry for
	// and simply produces nothing, so a recipe file or a settings export would
	// otherwise "load" as an empty logbook and replace what the user was
	// looking at. Import already refuses such a file (see import_file); a load
	// has to as well.
	if (divelog.dives.empty() && divelog.sites.empty() && divelog.trips.empty() &&
	    !declares_divelog(contents)) {
		divelog.clear();
		fail("no dives found in " + name);
	}

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

// ungroupDives: takes every dive out of its trip and empties the trip table.
//
// This exists for logbooks written by a build that still autogrouped (see
// disable_autogroup): those trips are in the file now, and nothing tells them
// apart from a trip the user made in desktop Subsurface - `dive_trip::autogen`
// is in-memory only, neither saved by save-xml.cpp nor read back by the parser.
// So the app cannot clean up on its own; the user asks for it, and gets all of
// it. `notrip` is deliberately left alone: with autogrouping off, nothing would
// regroup these dives anyway, and setting it would write tripflag='NOTRIP' into
// a file that desktop Subsurface then honours forever.
json ungroup_dives()
{
	for (auto &d : divelog.dives)
		unregister_dive_from_trip(d.get());
	divelog.trips.clear();

	return json{
		{ "dives", static_cast<int>(divelog.dives.size()) },
		{ "trips", 0 },
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

json delete_dive(const json &args)
{
	int id = static_cast<int>(require_int(args, "id"));
	// The index, not the reference require_dive() hands back - and for the same
	// reason it exists: get_by_uniq_id() exit(1)s in a DEBUG build on an id the
	// log no longer has, which a screen holding a stale id will produce.
	auto it = std::find_if(divelog.dives.begin(), divelog.dives.end(),
			       [id](const auto &d) { return d->id == id; });
	if (it == divelog.dives.end())
		fail("no dive with id " + std::to_string(id));

	// Detaching the dive from its trip and its site, and dropping a trip this
	// was the last dive of, is all done for us - see core/divelog.cpp.
	divelog.delete_single_dive(static_cast<int>(it - divelog.dives.begin()));

	return json{
		{ "dives", static_cast<int>(divelog.dives.size()) },
		{ "trips", static_cast<int>(divelog.trips.size()) },
	};
}

// Overwrites exactly the fields the entry mentions, leaving the rest of the
// cylinder as it was - the same partial-update rule the dive patch follows.
void apply_cylinder_patch(cylinder_t &cyl, const json &entry)
{
	if (entry.contains("description"))
		cyl.type.description = get_string(entry, "description");
	if (entry.contains("sizeMl"))
		cyl.type.size.mliter = static_cast<int>(get_int(entry, "sizeMl", 0));
	if (entry.contains("workingPressureMbar"))
		cyl.type.workingpressure.mbar = static_cast<int>(get_int(entry, "workingPressureMbar", 0));
	// Raw permille, sentinel and all: 0/0 is how the core spells air, and
	// resolving it here would turn "air" into a literal 20.9% nitrox in the
	// saved file.
	if (entry.contains("o2Permille"))
		cyl.gasmix.o2.permille = static_cast<int>(get_int(entry, "o2Permille", 0));
	if (entry.contains("hePermille"))
		cyl.gasmix.he.permille = static_cast<int>(get_int(entry, "hePermille", 0));
	if (entry.contains("startMbar"))
		cyl.start.mbar = static_cast<int>(get_int(entry, "startMbar", 0));
	if (entry.contains("endMbar"))
		cyl.end.mbar = static_cast<int>(get_int(entry, "endMbar", 0));
	if (entry.contains("use")) {
		int64_t use = get_int(entry, "use", OC_GAS);
		if (use < 0 || use >= NUM_GAS_USE)
			fail("cylinder 'use' out of range");
		cyl.cylinder_use = static_cast<enum cylinderuse>(use);
	}
}

// True when the entry describes a cylinder the dive already has.
bool has_source_index(const json &entry)
{
	auto it = entry.find("sourceIndex");
	return it != entry.end() && !it->is_null();
}

/*
 * `cylinders` is the whole resulting list, not a delta: an entry carrying
 * `sourceIndex` keeps the dive's existing cylinder at that index, an entry
 * without one is new. Entries must stay in source order and the new ones must
 * come last, so the only structural change a patch can express is removal plus
 * appending - which is exactly what the editor offers, and what keeps the
 * sample sensors and gas-switch events remappable.
 */
void apply_cylinders(struct dive &d, const json &list)
{
	if (!list.is_array())
		fail("'cylinders' must be an array");

	int previous = -1;
	bool seen_new = false;
	std::vector<bool> kept(d.cylinders.size(), false);
	for (const json &entry : list) {
		if (!entry.is_object())
			fail("each entry of 'cylinders' must be an object");
		if (!has_source_index(entry)) {
			seen_new = true;
			continue;
		}
		if (seen_new)
			fail("new cylinders must come after the existing ones");
		int idx = static_cast<int>(get_int(entry, "sourceIndex", -1));
		if (idx < 0 || idx >= static_cast<int>(d.cylinders.size()))
			fail("cylinder sourceIndex " + std::to_string(idx) + " out of range");
		if (idx <= previous)
			fail("cylinders may not be reordered");
		previous = idx;
		kept[idx] = true;
	}

	// A cylinder the samples or the gas-switch events still refer to has no
	// sensible replacement, and dropping it would leave those events pointing
	// at "unknown gas". Refuse rather than quietly degrade the dive.
	for (int idx = 0; idx < static_cast<int>(kept.size()); ++idx) {
		if (!kept[idx] && d.is_cylinder_used(idx))
			fail("cylinder " + std::to_string(idx) + " is used by the dive and cannot be removed");
	}

	// Back to front, so the indices still to be visited stay valid.
	// remove_cylinder() only erases; it is cylinder_renumber() that moves the
	// tank-sensor mappings and the gas-switch indices along with it, which is
	// why the core's own edit commands always run the pair together.
	for (int idx = static_cast<int>(kept.size()) - 1; idx >= 0; --idx) {
		if (kept[idx])
			continue;
		std::vector<int> mapping =
			get_cylinder_map_for_remove(static_cast<int>(d.cylinders.size()), idx);
		remove_cylinder(&d, idx);
		cylinder_renumber(d, mapping.data());
	}

	// What is left is the kept cylinders in order, so the entries line up with
	// them one by one and the new ones append past the end.
	size_t at = 0;
	for (const json &entry : list) {
		if (has_source_index(entry)) {
			apply_cylinder_patch(d.cylinders[at], entry);
			++at;
		} else {
			cylinder_t cyl;
			cyl.manually_added = true;
			apply_cylinder_patch(cyl, entry);
			d.cylinders.push_back(std::move(cyl));
		}
	}
}

// The part of a dive patch that does not touch the divelog itself, so that it
// can also be applied to a throwaway copy of a dive (see preview_dive()).
// Registering the dive with a site is deliberately not here: that mutates the
// site table, which a preview must not do.
void apply_dive_patch(struct dive &d, const json &patch)
{
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

	if (patch.contains("cylinders")) {
		apply_cylinders(d, patch["cylinders"]);
		// SAC, OTU and CNS are derived from the cylinders and their start/end
		// pressures, so a cylinder edit that left them alone would show the
		// figures of the dive as it was before. This is the same recomputation
		// the desktop app's dive-list model does after an equipment edit.
		divelog.dives.update_cylinder_related_info(d);
	}

	// The full-text cache indexes notes/buddy/tags, so it is stale now.
	d.invalidate_cache();
}

// Reads the patch argument shared by updateDive and previewDive.
const json &require_patch(const json &args)
{
	auto it = args.find("patch");
	if (it == args.end() || !it->is_object())
		fail("missing required object argument 'patch'");
	return *it;
}

json update_dive(const json &args)
{
	struct dive &d = require_dive(static_cast<int>(require_int(args, "id")));
	const json &patch = require_patch(args);

	apply_dive_patch(d, patch);

	if (patch.contains("siteUuid")) {
		uint32_t uuid = static_cast<uint32_t>(get_int(patch, "siteUuid", 0));
		unregister_dive_from_dive_site(&d);
		if (uuid)
			require_site(uuid).add_dive(&d);
	}

	return dive_to_json(d);
}

/*
 * What the dive would look like with `patch` applied, without applying it.
 *
 * The editor needs this for one thing the user can watch change while typing:
 * the SAC rate, which follows from the cylinder sizes and the start/end
 * pressures through gas compressibility (`cylinder_t::gas_volume`) and the
 * dive's mean depth. Recomputing that in TypeScript would be a second
 * implementation of core physics that could disagree with the file; running the
 * core over a copy of the dive cannot.
 *
 * `siteUuid` is ignored here - a preview must not touch the site table.
 */
json preview_dive(const json &args)
{
	const struct dive &original = require_dive(static_cast<int>(require_int(args, "id")));
	struct dive copy = original;
	apply_dive_patch(copy, require_patch(args));
	// Unconditionally, unlike update_dive: a preview of a pressure change is
	// the one thing this method exists for, and the copy is thrown away.
	divelog.dives.update_cylinder_related_info(copy);
	return dive_to_json(copy);
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

// Parses a Suunto DM4/DM5 sqlite database into `log`. `path` must name a real
// file: the importers read the profile blobs through sqlite, which cannot work
// off a buffer.
void parse_suunto_db_into(const std::string &path, const std::string &contents,
			  const std::string &name, struct divelog &log)
{
	sqlite3 *handle = nullptr;
	if (sqlite3_open(path.c_str(), &handle)) {
		if (handle)
			sqlite3_close(handle);
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

	int rc;
	if (schema_matches(dm5_test)) {
		rc = parse_dm5_buffer(handle, path.c_str(), contents.data(), static_cast<int>(contents.size()), &log);
	} else if (schema_matches(dm4_test)) {
		rc = parse_dm4_buffer(handle, path.c_str(), contents.data(), static_cast<int>(contents.size()), &log);
	} else {
		sqlite3_close(handle);
		fail("unrecognized database schema (expected Suunto DM4 or DM5): " + name);
	}
	sqlite3_close(handle);
	if (rc)
		fail("failed to import " + name);
}

// Merges an already parsed import log into the module's divelog and reports the
// same counts the UI shows. `imported` is what the parser produced; a dive the
// core recognized as one it already has is merged in place, so it does not move
// the total - which is what makes "import the same file twice" a no-op.
json merge_import_log(struct divelog &log, int imported, int failed)
{
	// SAC, OTU and CNS are computed, not parsed: a logbook file carries them
	// because whoever wrote it had computed them, but a freshly imported dive
	// has nothing until someone does. Desktop Subsurface computes them in its
	// dive-list model; this module has no such model, so it does it here, on
	// the dives being imported and on nothing else.
	for (auto &d : log.dives)
		divelog.dives.update_cylinder_related_info(*d);

	size_t before = divelog.dives.size();
	// Both logs: add_imported_dives autogroups the import log on the way in,
	// process_loaded_dives below autogroups the merged one.
	log.autogroup = false;
	disable_autogroup();
	// Consumes `log`. merge_all_trips matches the mobile app's import path.
	divelog.add_imported_dives(log, import_flags::merge_all_trips);
	int added = static_cast<int>(divelog.dives.size() - before);

	// The core autogroups the *imported* dives among themselves, so an import
	// can leave dives outside a trip that a fresh load of the same log would
	// group. Running the post-load processing here settles the log to exactly
	// what reopening the file gives - which is the state the app must show,
	// since the file it just wrote is the source of truth.
	divelog.process_loaded_dives();

	return json{
		{ "added", added },
		{ "merged", imported - added },
		{ "failed", failed },
		{ "dives", static_cast<int>(divelog.dives.size()) },
		{ "sites", static_cast<int>(divelog.sites.size()) },
	};
}

// Stages a buffer into a temp file when the caller passed bytes rather than a
// path, and removes it again on the way out - sqlite needs a real file.
struct staged_file {
	std::string path;
	bool owned = false;

	staged_file(const json &args, const std::string &contents, const char *suffix)
	{
		path = get_string(args, "path");
		if (!path.empty())
			return;
		owned = true;
		path = temp_dir() + "/ssrf-import" + suffix;
		write_file(path, contents);
	}
	~staged_file()
	{
		if (owned)
			remove(path.c_str());
	}
};

json import_suunto(const json &args)
{
	auto [contents, name] = read_source(args);
	if (contents.empty())
		fail("empty Suunto database: " + name);

	struct divelog log;
	{
		staged_file file(args, contents, "-suunto.db");
		parse_suunto_db_into(file.path, contents, name, log);
	}
	return merge_import_log(log, static_cast<int>(log.dives.size()), 0);
}

// ---------------------------------------------------------------------------
// importFile: one entry point for every format the app accepts
// ---------------------------------------------------------------------------

bool looks_like_json(const std::string &bytes)
{
	for (char c : bytes) {
		if (isspace(static_cast<unsigned char>(c)))
			continue;
		return c == '{';
	}
	return false;
}

bool looks_like_sqlite(const std::string &bytes)
{
	static const char magic[] = "SQLite format 3";
	return bytes.compare(0, sizeof(magic) - 1, magic) == 0;
}

// Parses one XML document into `log`. This is the same call loadFromXML makes,
// which is what gives an import every format the core's XSLT table covers
// (Suunto DM4/SDM, UDDF, MacDive, ...) as well as plain SSRF.
//
// The one thing the core leaves undone is the sample blobs of a Suunto DM4 XML
// export - see cpp/bindings/suunto-xml.h.
void parse_xml_into(const std::string &contents, const std::string &name, struct divelog &log)
{
	size_t before = log.dives.size();
	struct xml_params params;
	if (parse_xml_buffer(name.c_str(), contents.c_str(), static_cast<int>(contents.size()), &log, &params))
		fail("failed to parse " + name);
	decode_suunto_dm4_profile(contents, log, before);
}

// A Suunto .sde (and a divelogs.de .dld) is a zip of XML documents, one per
// dive. Every entry is parsed into the same log, so the whole archive arrives as
// one import. An entry that fails to parse is counted rather than fatal: a
// single bad dive in an export of hundreds must not lose the rest.
int parse_zip_into(const std::string &contents, const std::string &name, struct divelog &log)
{
	std::vector<zip_entry> entries = zip_read_all(contents);
	if (entries.empty())
		fail("archive contains no files: " + name);

	int failed = 0;
	int parsed = 0;
	for (const zip_entry &entry : entries) {
		// Upstream skips the picture directory of a .dld the same way.
		if (entry.name.find("pictures/") != std::string::npos)
			continue;
		size_t before = log.dives.size();
		struct xml_params params;
		if (parse_xml_buffer((name + "/" + entry.name).c_str(), entry.contents.c_str(),
				     static_cast<int>(entry.contents.size()), &log, &params)) {
			failed++;
			continue;
		}
		parsed++;
		// A .sde is one DM4 XML document per dive, so the blobs are here too.
		decode_suunto_dm4_profile(entry.contents, log, before);
	}
	if (!parsed && failed)
		fail("no file in " + name + " could be parsed");
	return failed;
}

json import_file(const json &args)
{
	auto [contents, name] = read_source(args);
	if (contents.empty())
		fail("empty file: " + name);

	struct divelog log;
	int failed = 0;
	if (looks_like_json(contents)) {
		// The JSON the Suunto app exports (Nautic, Ocean, EON, D5). The
		// importer reports 0 both for "not a dive" (a running activity, say)
		// and for a document it could not read; the core message it left
		// behind travels back in the envelope's `errors`.
		if (suunto_json_import(contents, std::string(), &log) <= 0)
			fail("no Suunto dive found in " + name);
	} else if (looks_like_sqlite(contents)) {
		staged_file file(args, contents, "-suunto.db");
		parse_suunto_db_into(file.path, contents, name, log);
	} else if (looks_like_zip(contents)) {
		failed = parse_zip_into(contents, name, log);
	} else {
		parse_xml_into(contents, name, log);
	}

	int imported = static_cast<int>(log.dives.size());
	if (!imported && !failed)
		fail("no dives found in " + name);
	return merge_import_log(log, imported, failed);
}

// Paths the core needs from the app: the directory holding the XSLT
// stylesheets, which is how every non-SSRF XML format is read (the desktop app
// gets them from Qt resources - see cpp/shim/qthelper.cpp).
json configure(const json &args)
{
	std::string xslt = get_string(args, "xsltDir");
	if (xslt.empty())
		fail("missing required argument 'xsltDir'");
	set_xslt_directory(xslt);
	return json{ { "xsltDir", xslt } };
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
	if (method == "importFile")
		return import_file(args);
	if (method == "configure")
		return configure(args);
	if (method == "listDiveSites")
		return list_dive_sites();
	if (method == "upsertDiveSite")
		return upsert_dive_site(args);
	if (method == "deleteDiveSite")
		return delete_dive_site(args);
	if (method == "updateDive")
		return update_dive(args);
	if (method == "deleteDive")
		return delete_dive(args);
	if (method == "previewDive")
		return preview_dive(args);
	if (method == "ungroupDives")
		return ungroup_dives();
	if (method == "getLastError")
		return joined_errors();
	if (method == "clear") {
		divelog.clear();
		disable_autogroup();
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
