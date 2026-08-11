// AI-generated (Claude)
//
// Host-side driver for the C++ smoke units. Built only by scripts/build-host.sh
// (never by the podspec), so the app binary never contains it.
//
//   ssrf-smoke                 serialize a minimal divelog and print it
//   ssrf-smoke <file.ssrf>...  parse each file and print its dive count

#include "../cpp/ssrfcore.h"

#include <cstdio>
#include <string>

int main(int argc, char **argv)
{
	if (argc < 2) {
		std::string xml = ssrf::smoke_serialize_minimal_log();
		if (xml.empty()) {
			fprintf(stderr, "FAIL: serialization produced no XML\n");
			return 1;
		}
		printf("%s", xml.c_str());
		fprintf(stderr, "OK: serialized %zu bytes\n", xml.size());
		return 0;
	}

	int failures = 0;
	for (int i = 1; i < argc; i++) {
		std::string error;
		int dives = ssrf::smoke_count_dives_in_file(argv[i], error);
		if (dives < 0) {
			fprintf(stderr, "FAIL: %s: %s\n", argv[i], error.c_str());
			failures++;
			continue;
		}
		printf("%s: %d dives\n", argv[i], dives);
	}
	return failures ? 1 : 0;
}
