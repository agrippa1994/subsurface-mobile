// AI-generated (Claude)
// The configurable statistics method of the JSON API. See cpp/API.md.
#pragma once

#include <nlohmann/json.hpp>

#include <vector>

struct dive;

namespace ssrf {

using json = nlohmann::json;

// Replays a configuration through the desktop's StatsState, applies a change if
// there is one, and returns what the choices now allow together with the chart over
// `dives`.
json stats_chart(const json &args, const std::vector<struct dive *> &dives);

} // namespace ssrf
