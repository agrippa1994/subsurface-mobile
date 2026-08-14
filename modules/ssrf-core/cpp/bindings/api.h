// AI-generated (Claude)
// The JSI boundary of the ssrf-core native module.
//
// One entry point rather than one native function per API call: the platform
// glue (Objective-C++/Swift on iOS, JNI on Android) then never has to change
// again, and every method is added in exactly two places - the dispatch table
// in api.cpp and the typed wrapper in src/index.ts.
//
// Both directions are JSON. See cpp/API.md for the method list and the key
// mapping.
#pragma once

#include <string>

namespace ssrf {

// Runs `method` with `args_json` (a JSON object, "{}" when there are no
// arguments) against the module's in-memory divelog. Never throws: the result
// is always a JSON object, either
//   { "ok": true,  "result": <value> }
// or
//   { "ok": false, "error": "<message>", "errors": [ <core messages> ] }
std::string call(const std::string &method, const std::string &args_json);

} // namespace ssrf
