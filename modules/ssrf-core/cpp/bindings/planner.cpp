// AI-generated (Claude)
// The dive planner, around the core's plan() and notes.
//
// The deco maths is core/planner.cpp, core/plannernotes.cpp and core/deco.cpp,
// untouched. What is here is what the desktop and legacy mobile apps keep in
// qt-models/diveplannermodel.cpp, which is Qt and cannot be vendored: turning a
// list of cylinders and segments into a `struct diveplan` (calculatePlan),
// computing the plan variations (computeVariations), and adding the result to
// the log (Command::addDive).
//
// plan() reads almost every setting from the global `prefs`, and this build
// never copies default_prefs there: the rest of the module relies on prefs being
// as it was. So a call starts from default_prefs plus its arguments, and puts
// prefs back on the way out. The caller holds the core lock (ssrf::call), which
// is also what plan()'s static stop tables and the global gradient factors need:
// set_gf() and set_vpmb_conservatism() stay as the last plan left them, and
// every method that reads them sets them first (apply_gradient_factors).
#include "planner.h"

#include "api-errors.h"
#include "marshal.h"

#include "core/deco.h"
#include "core/dive.h"
#include "core/divecomputer.h"
#include "core/divelist.h"
#include "core/divelog.h"
#include "core/equipment.h"
#include "core/format.h"
#include "core/gas.h"
#include "core/planner.h"
#include "core/pref.h"
#include "core/profile.h"
#include "core/units.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <memory>
#include <numeric>
#include <string>
#include <vector>

namespace ssrf {

namespace {

// What the bindings refuse. The screens stay inside these, so a refusal is a
// programming error or a hand-made call, never something a diver reads. The
// upper limits on depth and time bound how long a plan() can run on the JS thread.
constexpr int PLAN_MIN_DEPTH_MM = 1000;
constexpr int PLAN_MAX_DEPTH_MM = 300000;
constexpr int PLAN_MAX_ENTERED_SEC = 12 * 3600;
constexpr int PLAN_MIN_SURFACE_MBAR = 689; // desktop's ATMPressure range
constexpr int PLAN_MAX_SURFACE_MBAR = 1100;
constexpr int PLAN_MIN_SETPOINT_MBAR = 160; // DivePlannerPointsModel::setData

[[noreturn]] void fail(const std::string &msg)
{
	throw api_error(msg);
}

int int_arg(const json &args, const char *key, int fallback, int min, int max)
{
	auto it = args.find(key);
	if (it == args.end() || it->is_null())
		return fallback;
	if (!it->is_number())
		fail(std::string("argument '") + key + "' must be a number");
	double value = it->get<double>();
	if (value < min || value > max)
		fail(std::string("argument '") + key + "' must be between " + std::to_string(min) + " and " + std::to_string(max));
	return static_cast<int>(value);
}

int required_int(const json &args, const char *key, int min, int max)
{
	if (!args.contains(key))
		fail(std::string("missing required numeric argument '") + key + "'");
	return int_arg(args, key, 0, min, max);
}

bool bool_arg(const json &args, const char *key, bool fallback)
{
	auto it = args.find(key);
	if (it == args.end() || it->is_null())
		return fallback;
	if (!it->is_boolean())
		fail(std::string("argument '") + key + "' must be a boolean");
	return it->get<bool>();
}

const json &array_arg(const json &args, const char *key)
{
	auto it = args.find(key);
	if (it == args.end() || !it->is_array() || it->empty())
		fail(std::string("argument '") + key + "' must be a non-empty array");
	return *it;
}

// Puts prefs back whatever way the call ends.
struct prefs_scope {
	preferences saved;
	prefs_scope() : saved(prefs) { prefs = default_prefs; }
	~prefs_scope() { prefs = saved; }
	prefs_scope(const prefs_scope &) = delete;
	prefs_scope &operator=(const prefs_scope &) = delete;
};

// Every setting the legacy planner's setup page has, in the core's units.
void apply_planner_prefs(const json &args)
{
	if (bool_arg(args, "imperial", false)) {
		// The notes print through get_depth_units() and friends, and plan() picks its
		// stop table (3 m or 10 ft steps) from the length unit.
		prefs.unit_system = IMPERIAL;
		prefs.units = IMPERIAL_units;
	}

	int deco_mode_arg = int_arg(args, "decoMode", BUEHLMANN, BUEHLMANN, VPMB);
	prefs.planner_deco_mode = static_cast<deco_mode>(deco_mode_arg);

	// All rates in mm/s, as the core keeps them. A rate of 0 would never reach the
	// surface, so 1 is the floor.
	prefs.ascrate75 = int_arg(args, "ascrate75", prefs.ascrate75, 1, 2000);
	prefs.ascrate50 = int_arg(args, "ascrate50", prefs.ascrate50, 1, 2000);
	prefs.ascratestops = int_arg(args, "ascratestops", prefs.ascratestops, 1, 2000);
	prefs.ascratelast6m = int_arg(args, "ascratelast6m", prefs.ascratelast6m, 1, 2000);
	prefs.descrate = int_arg(args, "descrate", prefs.descrate, 1, 2000);
	prefs.drop_stone_mode = bool_arg(args, "dropStone", prefs.drop_stone_mode);

	prefs.last_stop = bool_arg(args, "lastStop6m", prefs.last_stop);
	prefs.doo2breaks = bool_arg(args, "o2Breaks", prefs.doo2breaks);
	prefs.switch_at_req_stop = bool_arg(args, "switchAtRequiredStop", prefs.switch_at_req_stop);
	prefs.min_switch_duration = int_arg(args, "minSwitchSec", prefs.min_switch_duration, 0, 600);
	prefs.surface_segment = int_arg(args, "surfaceSegmentSec", prefs.surface_segment, 0, 3600);
	prefs.reserve_gas = int_arg(args, "reserveGasMbar", prefs.reserve_gas, 0, 300000);
	prefs.safetystop = bool_arg(args, "safetyStop", prefs.safetystop);

	prefs.bottomsac = int_arg(args, "bottomSacMl", prefs.bottomsac, 100, 100000);
	prefs.decosac = int_arg(args, "decoSacMl", prefs.decosac, 100, 100000);
	prefs.sacfactor = int_arg(args, "sacFactor", prefs.sacfactor, 100, 990);
	prefs.problemsolvingtime = int_arg(args, "problemSolvingMin", prefs.problemsolvingtime, 0, 30);
	prefs.bottompo2 = int_arg(args, "bottomPo2Mbar", prefs.bottompo2, 100, 2500);
	prefs.decopo2 = int_arg(args, "decoPo2Mbar", prefs.decopo2, 100, 2500);
	prefs.defaultsetpoint = int_arg(args, "defaultSetpointMbar", prefs.defaultsetpoint, PLAN_MIN_SETPOINT_MBAR, 2000);
	prefs.bestmixend = depth_t{ .mm = int_arg(args, "bestMixEndMm", prefs.bestmixend.mm, 1000, 100000) };
	prefs.o2narcotic = bool_arg(args, "o2Narcotic", prefs.o2narcotic);
	prefs.dobailout = bool_arg(args, "doBailout", prefs.dobailout);

	prefs.display_runtime = bool_arg(args, "displayRuntime", prefs.display_runtime);
	prefs.display_duration = bool_arg(args, "displayDuration", prefs.display_duration);
	prefs.display_transitions = bool_arg(args, "displayTransitions", prefs.display_transitions);
	prefs.verbatim_plan = bool_arg(args, "verbatim", prefs.verbatim_plan);
	prefs.display_variations = bool_arg(args, "displayVariations", prefs.display_variations);
	// The counterdiffusion warning sits behind this one, so a planner must have it on.
	prefs.show_icd = bool_arg(args, "showIcd", true);
}

// get_local_divemode() in the Qt model: which mode a segment is really in, given
// the dive's mode and the use of the cylinder it breathes from.
divemode_t local_divemode(divemode_t dive_mode, cylinderuse use, divemode_t selected)
{
	switch (dive_mode) {
	case CCR:
		return use == DILUENT ? CCR : OC;
	case PSCR:
		return selected == PSCR ? PSCR : OC;
	default:
		return OC;
	}
}

struct built_plan {
	std::unique_ptr<struct dive> d;
	struct diveplan plan;
	// Which input cylinder each planned cylinder is, see first_gas_order().
	std::vector<int> input_index;
};

// The dive starts on cylinder 0 (create_dive_from_plan), so a first segment on
// another cylinder would plan a gas switch one second in. The desktop model moves
// that cylinder to the front (CylindersModel::moveAtFirst); legacy mobile does not.
std::vector<int> first_gas_order(int count, int first)
{
	std::vector<int> order(count);
	std::iota(order.begin(), order.end(), 0);
	if (first > 0) {
		order.erase(order.begin() + first);
		order.insert(order.begin(), first);
	}
	return order;
}

// DivePlannerPointsModel::calculatePlan up to the call of plan().
built_plan build_plan(const json &args)
{
	const json &cylinders = array_arg(args, "cylinders");
	const json &segments = array_arg(args, "segments");

	int dive_mode_arg = int_arg(args, "diveMode", OC, OC, PSCR);
	divemode_t dive_mode = static_cast<divemode_t>(dive_mode_arg);
	int salinity = int_arg(args, "salinity", SEAWATER_SALINITY, FRESHWATER_SALINITY, SEAWATER_SALINITY);
	int surface_mbar = int_arg(args, "surfacePressureMbar", 1013, PLAN_MIN_SURFACE_MBAR, PLAN_MAX_SURFACE_MBAR);

	built_plan out;
	out.d = std::make_unique<struct dive>();
	struct dive &d = *out.d;
	struct diveplan &plan = out.plan;
	make_planner_dc(&d.dcs[0]);

	auto when = args.find("when");
	timestamp_t timestamp = when != args.end() && when->is_number() ? when->get<int64_t>() : 0;
	d.when = timestamp;
	plan.when = timestamp;
	d.dcs[0].divemode = dive_mode;

	const int first_gas = required_int(segments.front(), "cylinder", 0, static_cast<int>(cylinders.size()) - 1);
	out.input_index = first_gas_order(static_cast<int>(cylinders.size()), first_gas);
	std::vector<int> new_index(cylinders.size());
	for (size_t i = 0; i < out.input_index.size(); i++)
		new_index[out.input_index[i]] = static_cast<int>(i);

	for (int input : out.input_index) {
		const json &entry = cylinders[input];
		cylinder_t cyl;
		cyl.type.description = entry.value("description", std::string());
		cyl.type.size = volume_t{ .mliter = int_arg(entry, "sizeMl", 0, 0, 1000000) };
		cyl.type.workingpressure = pressure_t{ .mbar = int_arg(entry, "pressureMbar", 0, 0, 1000000) };
		// Taken as given. 0 is the core's own "air" (20.9%, gas.h), which is what the
		// desktop's sanitize_gasmix() makes of anything from 20.8 to 21: the screens send
		// that, and testplan.cpp's plans are on an exact 21.0%, which comes out different.
		int o2 = required_int(entry, "o2Permille", 0, 1000);
		int he = int_arg(entry, "hePermille", 0, 0, 990);
		if (o2 != 0 && o2 < 10)
			fail("argument 'o2Permille' must be 0 for air, or at least 10");
		if (o2 + he > 1000)
			fail("a gas cannot hold more than 100% oxygen and helium");
		cyl.gasmix.o2 = fraction_t{ .permille = o2 };
		cyl.gasmix.he = fraction_t{ .permille = he };
		cyl.cylinder_use = static_cast<cylinderuse>(int_arg(entry, "use", OC_GAS, OC_GAS, TRAVEL_OC));
		d.cylinders.add(d.cylinders.size(), cyl);
	}

	// Before reset_cylinders(): gas_mod() reads both off the dive computer of a
	// planned dive, which is what gives altitude and fresh water their own switch depths.
	plan.surface_pressure = pressure_t{ .mbar = surface_mbar };
	d.surface_pressure = plan.surface_pressure;
	d.dcs[0].surface_pressure = plan.surface_pressure;
	plan.salinity = salinity;
	d.dcs[0].salinity = salinity;

	reset_cylinders(&d, true);

	for (size_t i = 0; i < d.cylinders.size(); i++) {
		const cylinder_t &cyl = d.cylinders[i];
		if (cyl.depth.mm && cyl.cylinder_use == OC_GAS)
			plan.dp.push_back(divedatapoint(0, cyl.depth, static_cast<int>(i), 0, false));
	}

	int entered = 0;
	bool first_segment = true;
	for (const json &segment : segments) {
		int depth_mm = required_int(segment, "depthMm", PLAN_MIN_DEPTH_MM, PLAN_MAX_DEPTH_MM);
		int duration = required_int(segment, "durationSec", 1, PLAN_MAX_ENTERED_SEC);
		int cylinder = new_index.at(required_int(segment, "cylinder", 0, static_cast<int>(cylinders.size()) - 1));
		divemode_t selected = static_cast<divemode_t>(int_arg(segment, "diveMode", dive_mode, OC, PSCR));
		divemode_t mode = local_divemode(dive_mode, d.cylinders[cylinder].cylinder_use, selected);
		// Only a closed loop has a setpoint: a non-zero one is how create_dive_from_plan
		// tells a leg it must not count against the cylinders.
		int setpoint = mode == CCR ?
			std::max(int_arg(segment, "setpointMbar", prefs.defaultsetpoint, 0, 2000), PLAN_MIN_SETPOINT_MBAR) : 0;
		depth_t depth{ .mm = depth_mm };

		entered += duration;
		if (entered > PLAN_MAX_ENTERED_SEC)
			fail("the planned segments add up to more than 12 hours");

		if (first_segment && prefs.drop_stone_mode) {
			// Carved out of the first segment, so what the diver entered stays the
			// time on the clock when the segment ends.
			int descent = depth_mm / prefs.descrate;
			if (duration < descent)
				fail("the first segment is shorter than the descent to its depth");
			plan_add_segment(plan, descent, depth, cylinder, setpoint, true, mode);
			duration -= descent;
		}
		first_segment = false;

		if (duration > 0)
			plan_add_segment(plan, duration, depth, cylinder, setpoint, true, mode);
	}

	plan.gflow = static_cast<short>(int_arg(args, "gfLow", 30, 1, 150));
	plan.gfhigh = static_cast<short>(int_arg(args, "gfHigh", 75, 1, 150));
	if (plan.gflow > plan.gfhigh)
		fail("argument 'gfLow' must not be above 'gfHigh'");
	plan.vpmb_conservatism = static_cast<short>(int_arg(args, "vpmbConservatism", 0, 0, 4));
	plan.bottomsac = prefs.bottomsac;
	plan.decosac = prefs.decosac;

	return out;
}

// DivePlannerPointsModel::analyzeVariations
int analyze_variations(const std::vector<decostop> &min, const std::vector<decostop> &mid, const std::vector<decostop> &max)
{
	auto sum_time = [](int time, const decostop &ds) { return ds.time + time; };
	int minsum = std::accumulate(min.begin(), min.end(), 0, sum_time);
	int midsum = std::accumulate(mid.begin(), mid.end(), 0, sum_time);
	int maxsum = std::accumulate(max.begin(), max.end(), 0, sum_time);
	return ((midsum - minsum) + (maxsum - midsum)) / 2;
}

// DivePlannerPointsModel::computeVariations: how the stop times move for one
// unit of depth and one minute of bottom time more or less. `original` is the
// plan before plan() added its stops, and `ds` the state plan() ended in.
std::string compute_variations(const struct dive &planned, const struct diveplan &original, struct deco_state ds)
{
	if (original.dp.size() < 2)
		return std::string();

	auto copy = std::make_unique<struct dive>();
	copy_dive(&planned, copy.get());
	deco_state_cache cache, save;
	save.cache(&ds);

	const bool metric = prefs.units.length == units::METERS;
	const depth_t delta_depth = metric ? 1_m : 1_ft;
	const char *depth_unit = metric ? "m" : "ft";
	constexpr int delta_time = 60;

	auto run = [&](auto &&change) {
		struct diveplan variation = original;
		change(variation);
		std::vector<decostop> stops;
		plan(&ds, variation, copy.get(), 0, 1, cache, true, false, &stops);
		save.restore(&ds, false);
		return stops;
	};
	auto last_two = [](struct diveplan &p, int mm) {
		p.dp[p.dp.size() - 2].depth.mm += mm;
		p.dp.back().depth.mm += mm;
	};

	auto base = run([](struct diveplan &) {});
	auto deeper = run([&](struct diveplan &p) { last_two(p, delta_depth.mm); });
	auto shallower = run([&](struct diveplan &p) { last_two(p, -delta_depth.mm); });
	auto longer = run([&](struct diveplan &p) { p.dp.back().time += delta_time; });
	auto shorter = run([&](struct diveplan &p) { p.dp.back().time -= delta_time; });

	int by_depth = analyze_variations(shallower, base, deeper);
	int by_time = analyze_variations(shorter, base, longer);
	return format_string_std(", Stop times: %c %d:%02d /%s %c %d:%02d /min",
		SIGNED_FRAC_TRIPLET(by_depth, 60), depth_unit,
		SIGNED_FRAC_TRIPLET(by_time, 60));
}

const char *error_name(planner_error_t error)
{
	switch (error) {
	case PLAN_OK:
		return "ok";
	case PLAN_ERROR_TIMEOUT:
		return "timeout";
	case PLAN_ERROR_INAPPROPRIATE_GAS:
		return "inappropriateGas";
	case PLAN_ERROR_NO_SUITABLE_BAILOUT_GAS:
		return "noSuitableBailoutGas";
	case PLAN_ERROR_RECREATIONAL_EXCEEDS_NDL:
		return "recreationalExceedsNdl";
	}
	return "unknown";
}

struct planned_dive {
	built_plan built;
	std::unique_ptr<struct deco_state> ds;
	planner_error_t error = PLAN_OK;
};

// plan(), the variations, and the notes they end up in. prefs must be set up.
planned_dive run_plan(const json &args, bool show_disclaimer)
{
	planned_dive out;
	out.built = build_plan(args);
	struct dive &d = *out.built.d;
	struct diveplan &diveplan = out.built.plan;
	out.ds = std::make_unique<struct deco_state>();

	// A copy, because plan() adds the stops to the plan it is given.
	struct diveplan original = diveplan;
	deco_state_cache cache;
	out.error = plan(out.ds.get(), diveplan, &d, 0, 60, cache, true, show_disclaimer, nullptr);

	// Not in recreational mode, as in the Qt model: it plans no stops to vary.
	if (prefs.display_variations && pref_deco_mode(true) != RECREATIONAL && out.error == PLAN_OK) {
		struct deco_state ds_copy = *out.ds;
		std::string variations = compute_variations(d, original, ds_copy);
		// compute_variations ran plan() again; the notes of the plan proper are on `d`,
		// which it left alone, but the global gradient factors are the variation's.
		size_t at = d.notes.find("VARIATIONS");
		if (at != std::string::npos)
			d.notes.replace(at, strlen("VARIATIONS"), variations);
	}
	return out;
}

json planned_cylinders_to_json(const built_plan &built)
{
	const struct dive &d = *built.d;
	// create_dive_from_plan() only knows the volumes, and only the last bottom gas
	// has a minimum gas figure, which add_plan_to_notes() left on its waypoint.
	json out = json::array();
	for (size_t i = 0; i < d.cylinders.size(); i++) {
		const cylinder_t &cyl = d.cylinders[i];
		int minimum_gas = 0;
		for (const divedatapoint &dp : built.plan.dp) {
			if (dp.cylinderid == static_cast<int>(i) && dp.minimum_gas.mbar)
				minimum_gas = dp.minimum_gas.mbar;
		}
		out.push_back(json{
			{ "inputIndex", built.input_index[i] },
			{ "description", cyl.type.description },
			{ "o2Permille", get_o2(cyl.gasmix) },
			{ "hePermille", get_he(cyl.gasmix) },
			{ "name", cyl.gasmix.name() },
			{ "use", static_cast<int>(cyl.cylinder_use) },
			{ "sizeMl", cyl.type.size.mliter },
			{ "switchDepthMm", cyl.depth.mm },
			{ "startMbar", cyl.start.mbar },
			{ "endMbar", cyl.end.mbar },
			{ "gasUsedMl", cyl.gas_used.mliter },
			{ "decoGasUsedMl", cyl.deco_gas_used.mliter },
			// The volume carried, by the same real-gas formula as the volume used.
			{ "gasCarriedMl", cyl.type.size.mliter ? cyl.gas_volume(cyl.start).mliter : 0 },
			{ "minimumGasMbar", minimum_gas },
		});
	}
	return out;
}

json waypoints_to_json(const struct diveplan &plan)
{
	json out = json::array();
	for (const divedatapoint &dp : plan.dp) {
		if (dp.time == 0)
			continue; // the entries that only say a gas is available
		out.push_back(json{
			{ "timeSec", dp.time },
			{ "depthMm", dp.depth.mm },
			{ "cylinder", dp.cylinderid },
			{ "setpointMbar", dp.setpoint },
			{ "entered", dp.entered },
			{ "diveMode", static_cast<int>(dp.divemode) },
		});
	}
	return out;
}

} // namespace

json plan_dive(const json &args)
{
	prefs_scope scope;
	apply_planner_prefs(args);
	planned_dive result = run_plan(args, false);
	struct dive &d = *result.built.d;
	const struct diveplan &plan = result.built.plan;

	json out{
		{ "error", error_name(result.error) },
		{ "notes", d.notes },
		// Fully usable only when the error is "ok" or "recreationalExceedsNdl":
		// plan() gives up before the ascent on the others, and only the notes
		// mean anything then.
		{ "runtimeSec", d.dcs[0].duration.seconds },
		{ "maxDepthMm", 0 },
		{ "bottomTimeSec", 0 },
		{ "cns", d.cns },
		{ "otu", d.otu },
		{ "surfaceIntervalSec", plan.surface_interval },
		{ "effectiveGfLow", plan.eff_gflow },
		{ "effectiveGfHigh", plan.eff_gfhigh },
		{ "disclaimer", get_planner_disclaimer_formatted() },
		{ "waypoints", waypoints_to_json(plan) },
		{ "cylinders", planned_cylinders_to_json(result.built) },
	};
	int bottom = 0;
	int max_depth = 0;
	for (const divedatapoint &dp : plan.dp) {
		if (dp.time != 0 && dp.entered)
			bottom = std::max(bottom, dp.time);
		if (dp.time != 0)
			max_depth = std::max(max_depth, dp.depth.mm);
	}
	out["bottomTimeSec"] = bottom;
	out["maxDepthMm"] = max_depth;

	if (result.error == PLAN_OK || result.error == PLAN_ERROR_RECREATIONAL_EXCEEDS_NDL) {
		// As calculatePlan does: the plot and the dive's own figures want what
		// fixup_dive() works out. Volumes were read above, before it could touch them.
		divelog.dives.fixup_dive(d);
		plot_info pi = create_plot_info_new(&d, &d.dcs[0], result.ds.get());
		out["waypointAboveCeiling"] = pi.waypoint_above_ceiling;
		out["profile"] = plot_info_to_json(pi);
		out["dive"] = dive_to_json(d);
	} else {
		out["waypointAboveCeiling"] = false;
		out["profile"] = nullptr;
		out["dive"] = nullptr;
	}
	return out;
}

json save_plan(const json &args)
{
	prefs_scope scope;
	apply_planner_prefs(args);
	// Planned again at the point of saving, and with the disclaimer in the notes, so
	// what lands in the log can neither be stale nor lose the warning on the way.
	planned_dive result = run_plan(args, true);
	if (result.error != PLAN_OK)
		fail(std::string("this plan cannot be saved: ") + error_name(result.error));

	// Command::AddDive, without the undo stack and with autogrouping off, which is
	// the app's rule (see disable_autogroup in api.cpp).
	std::unique_ptr<struct dive> d = std::move(result.built.d);
	d->maxdepth = 0_m;
	d->dcs[0].maxdepth = 0_m;
	divelog.dives.fixup_dive(*d);
	d->selected = false;
	int idx = divelog.dives.get_insertion_index(d.get());
	d->number = divelog.dives.get_dive_nr_at_idx(idx);
	struct dive *added = divelog.dives.register_dive(std::move(d));
	return json{ { "id", added->id }, { "dives", static_cast<int>(divelog.dives.size()) } };
}

// What calculateGasInfo in the Qt model returns, at the same pO2 steps. The MOD
// is dive::gas_mod(). There is no core function for END or EAD at a given depth,
// only inside calculate_gas_information_new() in core/profile.cpp, whose formula
// this repeats so that the table agrees with the profile; the Qt model's own
// (10 m per bar, 0.79) would not at altitude or in fresh water.
json gas_info(const json &args)
{
	prefs_scope scope;

	int o2 = required_int(args, "o2Permille", 10, 1000);
	int he = int_arg(args, "hePermille", 0, 0, 990);
	if (o2 + he > 1000)
		fail("a gas cannot hold more than 100% oxygen and helium");
	bool o2_narcotic = bool_arg(args, "o2Narcotic", true);
	prefs.o2narcotic = o2_narcotic;

	struct dive d;
	make_planner_dc(&d.dcs[0]);
	pressure_t surface{ .mbar = int_arg(args, "surfacePressureMbar", 1013, PLAN_MIN_SURFACE_MBAR, PLAN_MAX_SURFACE_MBAR) };
	d.surface_pressure = surface;
	d.dcs[0].surface_pressure = surface;
	d.dcs[0].salinity = int_arg(args, "salinity", SEAWATER_SALINITY, FRESHWATER_SALINITY, SEAWATER_SALINITY);

	struct gasmix mix{ fraction_t{ .permille = o2 }, fraction_t{ .permille = he } };
	sanitize_gasmix(mix);

	json rows = json::array();
	for (int mbar = 1000; mbar <= 2000; mbar += 100) {
		depth_t mod = d.gas_mod(mix, pressure_t{ .mbar = mbar }, 1_mm);
		if (mod.mm < 0)
			mod = 0_m;
		double ambient = d.depth_to_mbarf(mod);
		depth_t end = d.mbar_to_depth(lrint(ambient * (1000 - get_he(mix)) / 1000.0));
		depth_t ead = d.mbar_to_depth(lrint(ambient * get_n2(mix) / (double)(1000 - O2_IN_AIR)));
		rows.push_back(json{
			{ "po2Mbar", mbar },
			{ "modMm", mod.mm },
			{ "narcoticDepthMm", std::max(0, o2_narcotic ? end.mm : ead.mm) },
		});
	}

	depth_t min_depth = d.gas_mod(mix, pressure_t{ .mbar = 160 }, 1_mm);

	json out{
		{ "name", mix.name() },
		{ "o2Narcotic", o2_narcotic },
		{ "rows", std::move(rows) },
		// The depth above which this gas has less than 0.16 bar of oxygen; 0 when it is
		// breathable at the surface.
		{ "minDepthMm", std::max(0, min_depth.mm) },
	};

	// The richest and the least narcotic mix for a depth (the "*" in desktop's
	// cylinder table, and the planner setting "Best mix END").
	auto best = args.find("bestMix");
	if (best != args.end() && best->is_object()) {
		depth_t depth{ .mm = required_int(*best, "depthMm", PLAN_MIN_DEPTH_MM, PLAN_MAX_DEPTH_MM) };
		prefs.bottompo2 = int_arg(*best, "bottomPo2Mbar", prefs.bottompo2, 100, 2500);
		prefs.bestmixend = depth_t{ .mm = int_arg(*best, "bestMixEndMm", prefs.bestmixend.mm, 1000, 100000) };
		fraction_t best_o2 = d.best_o2(depth, true);
		fraction_t best_he = d.best_he(depth, o2_narcotic, best_o2);
		// best_he() does not know about the oxygen when O2 counts as narcotic, so the
		// sum can pass 100% at great depth. A mix has to stay a mix.
		if (best_o2.permille + best_he.permille > 1000)
			best_he.permille = 1000 - best_o2.permille;
		out["best"] = json{ { "o2Permille", best_o2.permille }, { "hePermille", best_he.permille } };
	}
	return out;
}

json planner_options()
{
	json tanks = json::array();
	for (const tank_info &info : default_tank_info_table()) {
		auto [size, pressure] = extract_tank_info(info);
		tanks.push_back(json{ { "name", info.name }, { "sizeMl", size.mliter }, { "workingPressureMbar", pressure.mbar } });
	}
	return json{ { "tanks", std::move(tanks) } };
}

json planner_surface(const json &args)
{
	// DivePlannerPointsModel::setMobilePlannerAltitudeDisplay and its pair: clamped
	// to the range the planner takes, and never below sea level.
	pressure_t pressure;
	if (args.contains("altitudeMm")) {
		pressure = altitude_to_pressure(required_int(args, "altitudeMm", 0, 10000000));
	} else {
		pressure = pressure_t{ .mbar = required_int(args, "surfacePressureMbar", 1, 2000) };
	}
	pressure.mbar = std::clamp(pressure.mbar, PLAN_MIN_SURFACE_MBAR, PLAN_MAX_SURFACE_MBAR);
	depth_t altitude = pressure_to_altitude(pressure);
	return json{ { "surfacePressureMbar", pressure.mbar }, { "altitudeMm", std::max(0, altitude.mm) } };
}

} // namespace ssrf
