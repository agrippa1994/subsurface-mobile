// AI-generated (Claude)
// Core structs -> JSON. Read-only: nothing here mutates the divelog.
//
// Units are the core's own integer units (mm, mbar, mkelvin, ml, grams,
// seconds, permille, microdegrees). No formatting, no unit conversion - that
// lives in TypeScript so the same numbers can be rendered metric or imperial.
// The key mapping is documented in cpp/API.md.
#pragma once

#include <nlohmann/json.hpp>

struct dive;
struct dive_site;
struct dive_trip;
struct plot_info;
struct stats_t;
struct stats_summary;
struct units;

namespace ssrf {

using json = nlohmann::json;

// Cheap row for the dive list: no cylinders, no samples, no events.
json dive_summary_to_json(const struct dive &d);

// Everything about one dive except the samples (those come from getProfile).
json dive_to_json(const struct dive &d);

// One divecomputer's plotted profile, including the flattened pressure arrays.
json plot_info_to_json(const struct plot_info &pi);

json dive_site_to_json(const struct dive_site &ds);

// A trip's own fields and the span of its dives; its dives carry `tripId`.
json trip_to_json(const struct dive_trip &trip);

json stats_to_json(const struct stats_t &s);
json stats_summary_to_json(const struct stats_summary &s);

// The other direction, for the few calls whose text the core writes itself
// (planner notes, statistics binners, CSV): `prefs.units` out of the app's
// per-quantity choice, {"depth":"ft","pressure":"bar",...}. A quantity left
// out keeps `base`'s unit; a value that is not one of the two throws.
struct units units_from_json(const json &u, const struct units &base);

// The unit_system a combination amounts to: METRIC, IMPERIAL or PERSONALIZE,
// as desktop's preferences derive it.
int unit_system_of(const struct units &u);

} // namespace ssrf
