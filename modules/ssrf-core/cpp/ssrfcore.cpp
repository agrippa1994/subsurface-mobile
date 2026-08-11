// AI-generated (Claude)
#include "ssrfcore.h"

#include "core/dive.h"
#include "core/divecomputer.h"
#include "core/divelist.h"
#include "core/divelog.h"
#include "core/errorhelper.h"
#include "core/parse.h"
#include "core/sample.h"
#include "core/units.h"
#include "core/xmlparams.h"

#include <cstdio>
#include <cstdlib>
#include <memory>
#include <vector>

namespace ssrf {

namespace {

// save_dives() writes to a path, so the smoke test round-trips through a
// temporary file rather than reaching into save-xml's internals. Task 05
// serializes to a membuffer directly.
std::string read_file(const std::string &path, std::string &error)
{
	FILE *f = fopen(path.c_str(), "rb");
	if (!f) {
		error = "cannot open " + path;
		return std::string();
	}
	std::string contents;
	char buffer[16 * 1024];
	size_t got;
	while ((got = fread(buffer, 1, sizeof(buffer), f)) > 0)
		contents.append(buffer, got);
	fclose(f);
	return contents;
}

} // namespace

int add(int a, int b)
{
	// Temporary proof that the call really lands in C++ (task 02 acceptance
	// criteria). Remove once the real API lands in task 05.
	// stderr, not stdout: stdout is fully buffered in an app process, so the
	// line would never reach the device console.
	std::fprintf(stderr, "[ssrf-core] C++ add(%d, %d)\n", a, b);
	return a + b;
}

std::string smoke_serialize_minimal_log()
{
	divelog.clear();

	auto d = std::make_unique<dive>();
	d->when = 1000000000; // 2001-09-09T01:46:40Z, a fixed point in time
	// A fresh dive already carries one (empty) divecomputer - fill that one in
	// rather than appending a second.
	divecomputer &dc = d->dcs.front();
	dc.model = "ssrf-core smoke test";
	dc.when = d->when;

	cylinder_t cyl;
	cyl.type.size = 12_l;
	cyl.type.workingpressure = 200_bar;
	cyl.type.description = "AL80";
	cyl.gasmix.o2 = 21_percent;
	d->cylinders.add(0, std::move(cyl));

	// A two-sample profile: descend to 30 m over 3 minutes, surface again.
	for (const auto &[time, depth] : { std::pair{0, 0}, std::pair{180, 30000} }) {
		struct sample s;
		s.time.seconds = time;
		s.depth.mm = depth;
		append_sample(s, &dc);
	}

	divelog.dives.record_dive(std::move(d));

	std::string path = std::string(getenv("TMPDIR") ? getenv("TMPDIR") : "/tmp") + "/ssrf-smoke.ssrf";
	if (save_dives(path.c_str()))
		return std::string();

	std::string error;
	std::string xml = read_file(path, error);
	remove(path.c_str());
	return xml;
}

int smoke_count_dives_in_file(const std::string &path, std::string &error)
{
	std::string contents = read_file(path, error);
	if (contents.empty()) {
		if (error.empty())
			error = "empty file: " + path;
		return -1;
	}

	struct divelog log;
	struct xml_params params;
	if (parse_xml_buffer(path.c_str(), contents.c_str(), (int)contents.size(), &log, &params)) {
		error = "parse failed: " + path;
		return -1;
	}
	return (int)log.dives.size();
}

} // namespace ssrf
