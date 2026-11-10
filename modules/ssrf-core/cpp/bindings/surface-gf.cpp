// AI-generated (Claude)
// surfaceGf: the Buehlmann surface gradient factor after a dive, continued over
// the surface interval. See cpp/API.md for the contract.
//
// How the tissue state at the end of the dive is obtained
// --------------------------------------------------------
// The profile (core/profile.cpp, calculate_deco_information) keeps its
// deco_state private, so the binding rebuilds it the same way, from the same
// inputs, with the same core calls:
//
//  1. divelog.dives.init_decompression() loads the tissues the earlier dives in
//     the log left behind - exactly what create_plot_info_new() does first, and
//     what #60's residual-nitrogen NDL/TTS is built on.
//  2. The dive's own plot_info (create_plot_info_new) gives the plotted points;
//     the loop below walks them in the profile's 20 second steps with the
//     profile's add_segment() arguments (interpolated depth, gas and dive mode
//     at the point, the point's o2 pressure).
//
// Because nothing differs, the surface GF of the rebuilt state at the last
// plotted point equals that point's `surfaceGf` (tests/surface-gf.test.ts
// checks it). Only the Buehlmann path is rebuilt: VPM-B iterations change no
// tissue loading, and the app never selects VPM-B for the profile.
//
// After the dive the tissues are stepped forward with add_segment() on air at
// the ambient pressure the caller gives - the same call init_decompression()
// uses for a surface interval between two dives.
#include "surface-gf.h"

#include "api-errors.h"

#include "core/deco.h"
#include "core/dive.h"
#include "core/divecomputer.h"
#include "core/divelist.h"
#include "core/divelog.h"
#include "core/event.h"
#include "core/gas.h"
#include "core/profile.h"
#include "core/units.h"

#include <algorithm>
#include <cmath>
#include <string>
#include <utility>

namespace ssrf {

namespace {

// Ambient pressure accepted for the surface interval. 500 mbar is about
// 5500 m above sea level, 1100 mbar a deep low-lying basin on a high-pressure
// day; anything outside is a unit mistake, not a place.
constexpr int MIN_AMBIENT_MBAR = 500;
constexpr int MAX_AMBIENT_MBAR = 1100;

constexpr int DEFAULT_STEP_SEC = 60;
constexpr int MIN_STEP_SEC = 10;
constexpr int MAX_STEP_SEC = 600;

// The series runs until the tissues are clean plus this margin, so a chart
// shows the flat end, but never past MAX_HORIZON_SEC. 72 h covers any
// repetitive diving day the core itself still links (it forgets a dive after
// 48 h, init_decompression()).
constexpr int CLEAN_MARGIN_SEC = 60 * 60;
constexpr int MAX_HORIZON_SEC = 72 * 60 * 60;

// "Clean": every compartment's inert gas pressure (N2 + He) is within this
// fraction of what it holds at equilibrium with surface air at the ambient
// pressure. 2 % takes the slowest compartment (635 min half-time) about the
// 48 h after which the core stops counting a dive as residual.
constexpr double CLEAN_EXCESS_FRACTION = 0.02;

// Same step the profile takes between two plotted points (profile.cpp).
constexpr int PROFILE_STEP_SEC = 20;

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
	if (!std::isfinite(value) || value < min || value > max)
		fail(std::string("argument '") + key + "' must be between " + std::to_string(min) + " and " +
		     std::to_string(max));
	return static_cast<int>(std::lround(value));
}

// The dive with `id`, or without one the most recent dive that counts: valid
// and not in the future of every other. "Most recent" by end time, which is
// what starts the surface interval.
const struct dive &reference_dive(const json &args)
{
	auto it = args.find("id");
	if (it != args.end() && !it->is_null()) {
		if (!it->is_number_integer())
			fail("argument 'id' must be an integer");
		int id = it->get<int>();
		for (const auto &d : divelog.dives)
			if (d->id == id)
				return *d;
		fail("no dive with id " + std::to_string(id));
	}
	const struct dive *latest = nullptr;
	for (const auto &d : divelog.dives) {
		if (d->invalid)
			continue;
		if (!latest || d->endtime() > latest->endtime())
			latest = d.get();
	}
	if (!latest)
		fail("the logbook has no dive");
	return *latest;
}

// profile.cpp's surface GF, per compartment and maximized: how far the tissue
// pressure is above ambient as a share of how far the Buehlmann M-value at
// that ambient pressure is. tissue_tolerance_calc() refreshes the a/b
// coefficients for the current N2/He mix of each compartment first, as the
// profile's loop does before it reads them. Like the profile, the maximum
// starts at 0, so a diver with no supersaturated compartment reads 0 %, never
// a negative value.
double surface_gf_percent(struct deco_state &ds, const struct dive &d, double ambient_bar)
{
	tissue_tolerance_calc(&ds, &d, ambient_bar, false);
	double gf = 0.0;
	for (int j = 0; j < 16; j++) {
		double m_value = ds.buehlmann_inertgas_a[j] + ambient_bar / ds.buehlmann_inertgas_b[j];
		double value = 100.0 * (ds.tissue_inertgas_saturation[j] - ambient_bar) / (m_value - ambient_bar);
		if (value > gf)
			gf = value;
	}
	return gf;
}

// The index of the compartment that decides surface_gf_percent().
int leading_compartment(const struct deco_state &ds, double ambient_bar)
{
	int lead = 0;
	double best = 0.0;
	for (int j = 0; j < 16; j++) {
		double m_value = ds.buehlmann_inertgas_a[j] + ambient_bar / ds.buehlmann_inertgas_b[j];
		double value = (ds.tissue_inertgas_saturation[j] - ambient_bar) / (m_value - ambient_bar);
		if (j == 0 || value > best) {
			best = value;
			lead = j;
		}
	}
	return lead;
}

bool tissues_clean(const struct deco_state &ds, const struct deco_state &equilibrium)
{
	for (int j = 0; j < 16; j++) {
		double eq = equilibrium.tissue_n2_sat[j];
		double loading = ds.tissue_n2_sat[j] + ds.tissue_he_sat[j];
		if (loading - eq > CLEAN_EXCESS_FRACTION * eq)
			return false;
	}
	return true;
}

// Rebuilds the deco state the profile holds at its last plotted point. Returns
// the time of that point in seconds after the dive's start.
int tissues_at_dive_end(const struct dive &d, struct deco_state &ds, int &surface_interval)
{
	const struct divecomputer *dc = d.get_dc(0);
	surface_interval = divelog.dives.init_decompression(&ds, &d, false);
	// A copy for the plot: create_plot_info_new() runs init_decompression()
	// itself on its own state; ours is the one walked on below.
	plot_info pi = create_plot_info_new(&d, dc, nullptr);
	if (pi.entry.empty())
		return 0;

	gasmix_loop loop_gas(d, *dc);
	divemode_loop loop_mode(*dc);
	for (size_t i = 1; i < pi.entry.size(); i++) {
		const struct plot_data &entry = pi.entry[i];
		const struct plot_data &prev = pi.entry[i - 1];
		int t0 = prev.sec, t1 = entry.sec;
		int step = PROFILE_STEP_SEC;
		[[maybe_unused]] auto [mode, _cylinder, gasmix] = get_dive_status_at(d, *dc, entry.sec, &loop_mode, &loop_gas);
		if (t0 > t1)
			std::swap(t0, t1);
		if (t0 != t1 && t1 - t0 < step)
			step = t1 - t0;
		for (int j = t0 + step; j <= t1; j += step) {
			depth_t depth = interpolate(prev.depth, entry.depth, j - t0, t1 - t0);
			add_segment(&ds, d.depth_to_bar(depth), *gasmix, step, entry.o2pressure.mbar, mode, entry.sac, false);
			if ((t1 - j < step) && (j < t1))
				step = t1 - j;
		}
	}
	return pi.entry.back().sec;
}

json round2(double value)
{
	return std::round(value * 100.0) / 100.0;
}

} // namespace

json surface_gf(const json &args)
{
	const struct dive &d = reference_dive(args);
	int dive_surface_mbar = d.get_surface_pressure().mbar;
	int ambient_mbar = int_arg(args, "ambientMbar", dive_surface_mbar, MIN_AMBIENT_MBAR, MAX_AMBIENT_MBAR);
	int step = int_arg(args, "stepSec", DEFAULT_STEP_SEC, MIN_STEP_SEC, MAX_STEP_SEC);
	int horizon = int_arg(args, "horizonSec", 0, 0, MAX_HORIZON_SEC);

	struct deco_state ds;
	int surface_interval = 0;
	int end_sec = tissues_at_dive_end(d, ds, surface_interval);
	double dive_surface_bar = dive_surface_mbar / 1000.0;
	double ambient_bar = ambient_mbar / 1000.0;

	// What the profile's last point shows, against the dive's own surface
	// pressure - the reference for "the series starts where the profile ends".
	struct deco_state probe = ds;
	double end_surface_gf = surface_gf_percent(probe, d, dive_surface_bar);

	struct deco_state equilibrium;
	clear_deco(&equilibrium, ambient_bar, false);

	json series = json::array();
	json leading = json::array();
	json gf_zero = nullptr, clean = nullptr;
	int limit = horizon > 0 ? horizon : MAX_HORIZON_SEC;
	for (int t = 0;; t += step) {
		double gf = surface_gf_percent(ds, d, ambient_bar);
		series.push_back(round2(gf));
		leading.push_back(leading_compartment(ds, ambient_bar));
		if (gf_zero.is_null() && gf <= 0.0)
			gf_zero = t;
		if (clean.is_null() && tissues_clean(ds, equilibrium)) {
			clean = t;
			// Without an explicit horizon, stop a margin after clean.
			if (horizon == 0)
				limit = std::min(MAX_HORIZON_SEC, t + CLEAN_MARGIN_SEC);
		}
		if (t + step > limit)
			break;
		add_segment(&ds, ambient_bar, gasmix_air, step, 0, OC, 0, false);
	}

	bool loaded = surface_interval >= 0 && surface_interval < 48 * 60 * 60;
	return json{
		{ "diveId", d.id },
		{ "diveNumber", d.number },
		{ "diveWhen", d.when },
		{ "diveEndWhen", d.endtime() },
		{ "startWhen", d.when + end_sec },
		{ "diveSurfaceMbar", dive_surface_mbar },
		{ "ambientMbar", ambient_mbar },
		{ "stepSec", step },
		{ "endSurfaceGf", round2(end_surface_gf) },
		{ "surfaceGf", std::move(series) },
		{ "leadingCompartment", std::move(leading) },
		{ "gfZeroSec", gf_zero },
		{ "cleanSec", clean },
		{ "residualFromSec", loaded ? json(surface_interval) : json(nullptr) },
	};
}

} // namespace ssrf
