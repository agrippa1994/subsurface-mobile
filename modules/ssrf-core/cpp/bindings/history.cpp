// AI-generated (Claude)
// Undo and redo for the logbook, as states of the log rather than inverse commands.
//
// A state is the XML the log would be saved as, the only description of it that is
// complete by construction: whatever the file keeps, a state keeps, for every
// mutation there is and every one still to come. Upstream's undo (commands/) is an
// inverse per operation, on Qt, and is not in this build.
//
// Cost, on the repo's subsurface.xml (6.8 MB, 186 dives), macOS host at -O0:
//   - one extra serialization per mutation, 47 ms;
//   - restoring a state is a parse, about 375 ms;
//   - memory is the log once plus what changed: a state is a list of shared chunks,
//     cut at each dive, site and trip, and two states share every chunk that came
//     out the same. An edit to one dive costs that dive.
//
// Dive and trip ids are not in the file: a parse hands out new ones, and screens and
// cached queries hold the old. So a state also remembers each dive's ids, and a
// restore puts them back. A dive that comes back is the same dive to everything
// holding its id, its open screen included. No new dive can take such an id, since
// the core's ids only count up (dive_getUniqID).

#include "history.h"

#include "api-errors.h"

#include "core/dive.h"
#include "core/divelist.h"
#include "core/divelog.h"
#include "core/divesite.h"
#include "core/divesitetable.h"
#include "core/membuffer.h"
#include "core/parse.h"
#include "core/trip.h"
#include "core/xmlparams.h"

#include <algorithm>
#include <cstring>
#include <deque>
#include <map>
#include <memory>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

// Static upstream; patch 0011 exposes it.
extern void save_dives_buffer(struct membuffer *b, bool select_only, bool anonymize);

namespace ssrf {

namespace {

// The newest changes are what a diver reaches for, and 50 is more than any phone
// session undoes.
constexpr size_t MAX_ENTRIES = 50;
// What the chunks may hold in all before the oldest entries go. At least one entry
// always stays, so that a logbook above this can still undo its last change.
constexpr size_t MAX_BYTES = 64 * 1024 * 1024;

using chunk = std::shared_ptr<const std::string>;

struct dive_ids {
	int id;
	int trip_id;
};

// when and number, which the file does keep, tell the dives of a state apart. Dives
// agreeing on both are told apart by order only, which at worst swaps their ids:
// for two dives that are the same to the file, nobody can tell.
using dive_key = std::pair<timestamp_t, int>;

struct log_state {
	std::vector<chunk> chunks;
	std::vector<std::pair<dive_key, dive_ids>> ids;
};

struct entry {
	json description;
	log_state before;
	log_state after;
};

// Every chunk any state holds, keyed by its text: what makes equal text a shared
// chunk, and two equal states the same list of pointers.
std::unordered_map<std::string_view, chunk> chunk_pool;
size_t pool_bytes = 0;

// entries[0, position) can be undone, newest last; entries[position, end) redone.
std::vector<entry> entries;
size_t position = 0;
// The log as it stands, once a change has asked for it. Reads do not change what is
// saved (tests/undo-redo.test.ts holds them to that), so it stays right until the
// next change.
std::optional<log_state> current;
// The state last restored, until the log next changes. What the core works out when
// it parses can come out slightly differently from what it saved (a mean depth, say,
// on a file it did not write), and a save after an undo must write the file that was
// there before the change, not one a rounding away from it.
std::optional<log_state> restored;

int next_serial = 1;
int revision = 0;
const char *last_action = "none";
bool changed = false;

chunk intern(std::string_view text)
{
	auto it = chunk_pool.find(text);
	if (it != chunk_pool.end())
		return it->second;
	auto owned = std::make_shared<const std::string>(text);
	chunk_pool.emplace(std::string_view(*owned), owned);
	pool_bytes += owned->size();
	return owned;
}

void drop_unused_chunks()
{
	for (auto it = chunk_pool.begin(); it != chunk_pool.end();) {
		if (it->second.use_count() == 1) {
			pool_bytes -= it->second->size();
			it = chunk_pool.erase(it);
		} else {
			++it;
		}
	}
}

// True at the start of a line opening a dive, a site or a trip. Where the cuts fall
// only decides how much is shared: the chunks always add up to the XML, so a change
// in what the core writes could only cost memory.
bool starts_chunk(std::string_view xml, size_t at)
{
	std::string_view rest = xml.substr(at);
	return rest.starts_with("<dive ") || rest.starts_with("<site ") || rest.starts_with("<trip ");
}

log_state capture()
{
	membuffer buffer;
	save_dives_buffer(&buffer, false, false);
	std::string_view xml(buffer.buffer ? buffer.buffer : "", buffer.len);

	log_state state;
	size_t start = 0;
	size_t newline = 0;
	while ((newline = xml.find('\n', newline)) != std::string_view::npos) {
		newline += 1;
		if (newline < xml.size() && starts_chunk(xml, newline)) {
			state.chunks.push_back(intern(xml.substr(start, newline - start)));
			start = newline;
		}
	}
	state.chunks.push_back(intern(xml.substr(start)));

	state.ids.reserve(divelog.dives.size());
	for (const auto &d : divelog.dives) {
		state.ids.push_back({ dive_key{ d->when, d->number },
				      dive_ids{ d->id, d->divetrip ? d->divetrip->id : 0 } });
	}
	return state;
}

void parse_into_log(const log_state &state)
{
	std::string xml;
	size_t size = 0;
	for (const chunk &part : state.chunks)
		size += part->size();
	xml.reserve(size);
	for (const chunk &part : state.chunks)
		xml += *part;

	divelog.clear();
	struct xml_params params;
	if (parse_xml_buffer("logbook history", xml.c_str(), static_cast<int>(xml.size()), &divelog, &params))
		throw api_error("failed to restore the logbook");
	// As load_from_xml(): the app never autogroups, whatever a file has latched.
	divelog.autogroup = false;
	divelog.process_loaded_dives();
}

// False if a dive has no id to go back to, which would be a bug: the caller is told,
// so that it treats every id as new rather than trusting a partial answer.
bool put_ids_back(const log_state &state)
{
	std::map<dive_key, std::deque<dive_ids>> saved;
	for (const auto &[key, ids] : state.ids)
		saved[key].push_back(ids);

	bool all = true;
	for (auto &d : divelog.dives) {
		auto it = saved.find(dive_key{ d->when, d->number });
		if (it == saved.end() || it->second.empty()) {
			all = false;
			continue;
		}
		dive_ids ids = it->second.front();
		it->second.pop_front();
		d->id = ids.id;
		// A trip's id is set once per dive it holds, to the same value: a trip with
		// no dives is not in the file, and so not in a state.
		if (d->divetrip && ids.trip_id)
			d->divetrip->id = ids.trip_id;
	}
	return all;
}

// Replaces the log with `state`. If that fails, puts back the log as it stands, so
// that a failed undo is a message and not an empty logbook on its way to disk.
bool restore(const log_state &state)
{
	try {
		parse_into_log(state);
	} catch (const api_error &) {
		if (current) {
			parse_into_log(*current);
			put_ids_back(*current);
		}
		throw;
	}
	return put_ids_back(state);
}

void forget_everything()
{
	entries.clear();
	position = 0;
	current.reset();
	restored.reset();
	drop_unused_chunks();
}

void trim()
{
	drop_unused_chunks();
	while (entries.size() > MAX_ENTRIES || (entries.size() > 1 && pool_bytes > MAX_BYTES)) {
		entries.erase(entries.begin());
		position -= 1;
		drop_unused_chunks();
	}
}

const struct dive *find_dive(int id)
{
	auto it = std::find_if(divelog.dives.begin(), divelog.dives.end(),
			       [id](const auto &d) { return d->id == id; });
	return it == divelog.dives.end() ? nullptr : it->get();
}

void describe_dive(json &description, const struct dive *d)
{
	if (!d)
		return;
	description["diveNumber"] = d->number;
	if (d->dive_site)
		description["diveSite"] = d->dive_site->name;
}

// The plain facts of a change, as they are before it is made, since a deleted site's
// name is not to be had afterwards. Wording is src/models/logbook-history.ts's. A
// method with no case here is still recorded, and gets a general label there.
json describe(const std::string &method, const json &args)
{
	json description = {
		{ "kind", args.contains("historyKind") ? args["historyKind"].get<std::string>() : method },
		{ "divesBefore", static_cast<int>(divelog.dives.size()) },
		{ "tripsBefore", static_cast<int>(divelog.trips.size()) },
	};
	auto number_at = [&](const char *key, int fallback) {
		auto it = args.find(key);
		return it != args.end() && it->is_number() ? it->get<int>() : fallback;
	};
	auto text_at = [&](const char *key) {
		auto it = args.find(key);
		return it != args.end() && it->is_string() ? it->get<std::string>() : std::string();
	};

	if (method == "updateDive" || method == "deleteDive") {
		describe_dive(description, find_dive(number_at("id", 0)));
	} else if (method == "mergeDives") {
		json numbers = json::array();
		if (args.contains("diveIds") && args["diveIds"].is_array()) {
			for (const auto &id : args["diveIds"]) {
				const struct dive *d = id.is_number() ? find_dive(id.get<int>()) : nullptr;
				if (d && d->number > 0)
					numbers.push_back(d->number);
			}
		}
		std::sort(numbers.begin(), numbers.end());
		description["diveNumbers"] = numbers;
	} else if (method == "upsertDiveSite") {
		uint32_t uuid = static_cast<uint32_t>(number_at("uuid", 0));
		const struct dive_site *site = uuid ? divelog.sites.get_by_uuid(uuid) : nullptr;
		description["isNew"] = site == nullptr;
		description["siteName"] = args.contains("name") ? text_at("name") : site ? site->name : "";
	} else if (method == "deleteDiveSite") {
		const struct dive_site *site = divelog.sites.get_by_uuid(static_cast<uint32_t>(number_at("uuid", 0)));
		description["siteName"] = site ? site->name : "";
		description["siteDives"] = site ? static_cast<int>(site->dives.size()) : 0;
	} else if (method == "createTrip" || method == "addDivesToTrip" || method == "removeDivesFromTrip") {
		description["diveCount"] = args.contains("diveIds") && args["diveIds"].is_array() ? args["diveIds"].size() : 0;
		if (method == "createTrip") {
			description["tripLocation"] = text_at("location");
		} else if (method == "addDivesToTrip") {
			const dive_trip *trip = divelog.trips.get_by_uniq_id(number_at("tripId", 0));
			description["tripLocation"] = trip ? trip->location : "";
		}
	} else if (method == "updateTrip") {
		const dive_trip *trip = divelog.trips.get_by_uniq_id(number_at("id", 0));
		description["tripLocation"] = args.contains("location") ? text_at("location") : trip ? trip->location : "";
	}
	return description;
}

json state_json()
{
	return json{
		{ "canUndo", position > 0 },
		{ "canRedo", position < entries.size() },
		{ "undo", position > 0 ? entries[position - 1].description : json(nullptr) },
		{ "redo", position < entries.size() ? entries[position].description : json(nullptr) },
		{ "undoDepth", static_cast<int>(position) },
		{ "redoDepth", static_cast<int>(entries.size() - position) },
		{ "bytes", static_cast<int64_t>(pool_bytes) },
		{ "revision", revision },
		{ "lastAction", last_action },
	};
}

void note(const char *action)
{
	last_action = action;
	revision += 1;
	changed = true;
}

json step(bool back)
{
	if (back ? position == 0 : position == entries.size())
		throw api_error(back ? "there is nothing to undo" : "there is nothing to redo");
	entry &target = entries[back ? position - 1 : position];
	bool ids_kept = restore(back ? target.before : target.after);
	restored = back ? target.before : target.after;
	// Not the target: the next change is compared with what this log saves as, or
	// that rounding would count as part of it, and a change of nothing as a change.
	current = capture();
	json description = target.description;
	position += back ? -1 : 1;
	note(back ? "undo" : "redo");
	return json{ { "entry", description }, { "idsKept", ids_kept } };
}

// Reads, and what acts on neither the log nor its file. Everything else counts as a
// change: a read forgotten here costs a serialization and records nothing, since the
// log comes out the same, whereas the other way round would lose a change's undo.
bool leaves_log_alone(const std::string &method)
{
	static const char *const methods[] = {
		"saveToXML", "listDives", "getDive", "getProfile", "getStatistics", "nitroxPlan", "planDive",
		"gasInfo", "plannerOptions", "plannerSurface", "exportDiveCSV", "configure", "dcListComputers",
		"dcDetect", "dcDownloadStart", "dcDownloadStatus", "dcDownloadCancel", "dcDownloadDiscard",
		"bleScanStart", "bleScanStop", "bleScanStatus", "listDiveSites", "previewDive", "listTrips",
		"listMergePairs", "previewMerge", "getLastError",
	};
	return std::any_of(std::begin(methods), std::end(methods),
			   [&](const char *name) { return method == name; });
}

} // namespace

json history_run(const std::string &method, const json &args, const history_dispatch &dispatch)
{
	if (method == "historyState")
		return state_json();
	if (method == "undo" || method == "redo") {
		json result = step(method == "undo");
		result["state"] = state_json();
		return result;
	}
	if (method == "clearHistory") {
		forget_everything();
		note("clear");
		return state_json();
	}
	if (leaves_log_alone(method))
		return dispatch(method, args);

	// What replaces the log: its history was of another one. A load that fails has
	// left nothing either.
	if (method == "loadFromXML" || method == "clear") {
		forget_everything();
		note("clear");
		return dispatch(method, args);
	}

	restored.reset();
	if (!current)
		current = capture();
	json description = describe(method, args);

	json result;
	std::exception_ptr failure;
	try {
		result = dispatch(method, args);
	} catch (...) {
		failure = std::current_exception();
	}

	// Compared even after a failure: a mutation that threw half way has still changed
	// the log, and its undo is the way back. An edit that changes nothing, or a call
	// that failed cleanly, leaves no entry.
	log_state after = capture();
	if (after.chunks != current->chunks) {
		description["divesAfter"] = static_cast<int>(divelog.dives.size());
		description["tripsAfter"] = static_cast<int>(divelog.trips.size());
		description["serial"] = next_serial++;
		entries.erase(entries.begin() + static_cast<std::ptrdiff_t>(position), entries.end());
		entries.push_back(entry{ std::move(description), std::move(*current), after });
		position = entries.size();
		current = std::move(after);
		trim();
		note("change");
	} else {
		current = std::move(after);
		drop_unused_chunks();
	}

	if (failure)
		std::rethrow_exception(failure);
	return result;
}

std::optional<std::string> history_restored_xml()
{
	if (!restored)
		return std::nullopt;
	std::string xml;
	for (const chunk &part : restored->chunks)
		xml += *part;
	return xml;
}

std::optional<json> history_take_change()
{
	if (!changed)
		return std::nullopt;
	changed = false;
	return state_json();
}

} // namespace ssrf
