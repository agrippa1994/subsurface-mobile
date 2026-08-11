// AI-generated (Claude)
// Public C++ surface of the ssrf-core native module.
//
// Task 03 exposes only what proves the vendored Subsurface core is alive:
// building a divelog in memory and serializing it through save-xml. Task 05
// replaces this with the real API (JSON in / JSON out).
#pragma once

#include <string>

namespace ssrf {

// Trivial smoke-test function. Executed in native C++.
int add(int a, int b);

// Builds a minimal in-memory divelog (one dive, one cylinder, two samples) and
// serializes it to Subsurface XML. Returns the XML document as a string.
// Proves that the model, the units layer and save-xml all link and run.
std::string smoke_serialize_minimal_log();

// Parses an SSRF/XML logbook from disk and reports how many dives it holds.
// Returns -1 and leaves `error` set when parsing fails.
int smoke_count_dives_in_file(const std::string &path, std::string &error);

} // namespace ssrf
