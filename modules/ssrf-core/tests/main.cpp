// AI-generated (Claude)
//
// Host-side driver for the C++ core. Built only by scripts/build-host.sh
// (never by the podspec), so the app binary never contains it.
//
//   ssrf-smoke                     serialize a minimal divelog and print it
//   ssrf-smoke <file.ssrf>...      parse each file and print its dive count
//   ssrf-smoke call <method> [json] run one API method and print its JSON reply
//   ssrf-smoke api <file.ssrf>     task 05 acceptance walk-through over one file

#include "../cpp/bindings/api.h"
#include "../cpp/ssrfcore.h"

#include <nlohmann/json.hpp>

#include <cstdio>
#include <cstring>
#include <string>

using json = nlohmann::json;

namespace {

int failures = 0;

void check(bool ok, const std::string &what)
{
	printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
	if (!ok)
		failures++;
}

// Unwraps the { ok, result } envelope, reporting the failure and aborting the
// walk-through if the call did not succeed.
json call_or_die(const char *method, const json &args)
{
	json reply = json::parse(ssrf::call(method, args.dump()));
	if (!reply.value("ok", false)) {
		fprintf(stderr, "FAIL: %s: %s\n", method, reply.value("error", std::string("?")).c_str());
		exit(1);
	}
	return reply["result"];
}

int run_serialize_smoke()
{
	std::string xml = ssrf::smoke_serialize_minimal_log();
	if (xml.empty()) {
		fprintf(stderr, "FAIL: serialization produced no XML\n");
		return 1;
	}
	printf("%s", xml.c_str());
	fprintf(stderr, "OK: serialized %zu bytes\n", xml.size());
	return 0;
}

int run_parse(int argc, char **argv)
{
	int bad = 0;
	for (int i = 0; i < argc; i++) {
		std::string error;
		int dives = ssrf::smoke_count_dives_in_file(argv[i], error);
		if (dives < 0) {
			fprintf(stderr, "FAIL: %s: %s\n", argv[i], error.c_str());
			bad++;
			continue;
		}
		printf("%s: %d dives\n", argv[i], dives);
	}
	return bad ? 1 : 0;
}

// The task 05 acceptance criteria, run against a real logbook: load it, list
// the dives, plot the first dive that has samples, and list the dive sites.
int run_api(const char *path)
{
	json loaded = call_or_die("loadFromXML", json{ { "path", path } });
	printf("loaded %s: %d dives, %d sites, %d trips\n", path,
	       loaded.value("dives", 0), loaded.value("sites", 0), loaded.value("trips", 0));

	json dives = call_or_die("listDives", json::object());
	check(dives.is_array() && !dives.empty(), "listDives returns a non-empty array");
	check(static_cast<int>(dives.size()) == loaded.value("dives", -1),
	      "listDives agrees with the loaded dive count");
	if (dives.empty())
		return 1;

	const json &first = dives.front();
	printf("first dive: id=%d number=%d when=%lld maxDepthMm=%d durationSec=%d site=\"%s\"\n",
	       first.value("id", 0), first.value("number", 0), first.value("when", 0LL),
	       first.value("maxDepthMm", 0), first.value("durationSec", 0),
	       first.value("siteName", std::string()).c_str());
	check(first.value("when", 0LL) > 0, "first dive has a timestamp");

	json full = call_or_die("getDive", json{ { "id", first.value("id", 0) } });
	check(full.value("id", -1) == first.value("id", 0), "getDive returns the requested dive");
	check(full.contains("cylinders") && full.contains("dcs"), "getDive carries cylinders and dcs");

	// Not every logbook's first dive has samples (some are hand-entered), so
	// plot the first one that does.
	int plotted = 0;
	for (const json &d : dives) {
		json detail = call_or_die("getDive", json{ { "id", d.value("id", 0) } });
		if (detail["dcs"].empty() || detail["dcs"][0].value("sampleCount", 0) == 0)
			continue;

		json pi = call_or_die("getProfile", json{ { "id", d.value("id", 0) } });
		const json &entry = pi["entry"];
		check(!entry.empty(), "getProfile returns a non-empty entry array");

		bool monotonic = true;
		bool plausible = true;
		int prev = -1;
		int maxDepth = 0;
		for (const json &e : entry) {
			int sec = e.value("sec", 0);
			int depth = e.value("depthMm", 0);
			monotonic = monotonic && sec >= prev;
			plausible = plausible && depth >= 0 && depth < 2000000;
			maxDepth = depth > maxDepth ? depth : maxDepth;
			prev = sec;
		}
		check(monotonic, "profile sec values are monotonic");
		check(plausible, "profile depth values are plausible");
		check(maxDepth > 0, "profile reaches a non-zero depth");

		int nr = pi.value("nr", 0);
		int nrCyl = pi.value("nrCylinders", 0);
		size_t expected = static_cast<size_t>(nr) * static_cast<size_t>(nrCyl);
		check(pi["pressures"]["sensor"].size() == expected,
		      "pressure array is nr * nrCylinders entries (cyl + idx * nrCylinders)");

		printf("profile of dive %d: %zu samples, %d cylinders, maxDepthMm=%d\n",
		       d.value("id", 0), entry.size(), nrCyl, maxDepth);
		plotted++;
		break;
	}
	check(plotted > 0, "at least one dive in the file has a profile");

	json sites = call_or_die("listDiveSites", json::object());
	int withGps = 0;
	for (const json &s : sites)
		withGps += s.value("hasGps", false) ? 1 : 0;
	printf("dive sites: %zu (%d with GPS)\n", sites.size(), withGps);

	json stats = call_or_die("getStatistics", json::object());
	printf("statistics: %d dives, totalTimeSec=%d maxDepthMm=%d\n",
	       stats["total"].value("selectionSize", 0), stats["total"].value("totalTimeSec", 0),
	       stats["total"].value("maxDepthMm", 0));
	check(stats["total"].value("selectionSize", 0) == static_cast<int>(dives.size()) ||
		      stats["total"].value("selectionSize", 0) > 0,
	      "statistics cover the loaded dives");

	return failures ? 1 : 0;
}

} // namespace

int main(int argc, char **argv)
{
	if (argc < 2)
		return run_serialize_smoke();

	if (!strcmp(argv[1], "call")) {
		if (argc < 4 || (argc - 2) % 2) {
			fprintf(stderr, "usage: ssrf-smoke call <method> <args-json> [<method> <args-json>...]\n");
			return 1;
		}
		// Several calls per invocation, because the divelog lives in the
		// process: loading a file and then querying it needs one process.
		for (int i = 2; i < argc; i += 2)
			printf("%s\n", ssrf::call(argv[i], argv[i + 1]).c_str());
		return 0;
	}

	if (!strcmp(argv[1], "api")) {
		if (argc < 3) {
			fprintf(stderr, "usage: ssrf-smoke api <file.ssrf>\n");
			return 1;
		}
		return run_api(argv[2]);
	}

	return run_parse(argc - 1, argv + 1);
}
