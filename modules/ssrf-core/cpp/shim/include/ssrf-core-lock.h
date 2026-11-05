// AI-generated (Claude)
//
// The one lock around the core's global state.
//
// Everything in the core assumes a single thread: `divelog`, `fingerprints`, the
// tag list. ssrf::call() runs on the JS thread and now shares them with the
// download worker, which reads `divelog` to spot dives it already has and writes
// `fingerprints` when it is done. patches/0008 takes this lock around exactly
// those parts of core/libdivecomputer.cpp; ssrf::call() holds it for every call.
// The worker never holds it across device I/O, so the JS thread only ever waits
// for the parsing of one dive.
#pragma once

#include <mutex>

std::recursive_mutex &ssrf_core_mutex();
