// AI-generated (Claude)
// The dive planner and gas calculator methods of the JSON API. See cpp/API.md.
#pragma once

#include <nlohmann/json.hpp>

namespace ssrf {

using json = nlohmann::json;

// Runs the core's plan() over a plan described in JSON and returns the result,
// without touching the logbook.
json plan_dive(const json &args);

// Runs the same plan again and adds it to the logbook as a planned dive.
json save_plan(const json &args);

// MOD and END or EAD per pO2 for one gas mix, and optionally the best mix for a depth.
json gas_info(const json &args);

// What the planner offers before anything was entered: the core's cylinder table.
json planner_options();

// Altitude to surface pressure or back, whichever was given.
json planner_surface(const json &args);

} // namespace ssrf
