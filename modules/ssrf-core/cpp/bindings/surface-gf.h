// AI-generated (Claude)
// The live surface gradient factor: how desaturated the diver is after the
// last dive, and how that goes on over the time spent on the surface. See
// cpp/API.md (`surfaceGf`).
#pragma once

#include <nlohmann/json.hpp>

namespace ssrf {

using json = nlohmann::json;

// Surface GF over the surface interval after one dive (by default the latest),
// with the tissues loaded by the dives before it, stepped forward on air at a
// given ambient pressure.
json surface_gf(const json &args);

} // namespace ssrf
