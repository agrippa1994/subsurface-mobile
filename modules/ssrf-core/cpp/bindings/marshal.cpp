// AI-generated (Claude)
#include "marshal.h"

#include "core/dive.h"
#include "core/divecomputer.h"
#include "core/divesite.h"
#include "core/equipment.h"
#include "core/event.h"
#include "core/extradata.h"
#include "core/gas.h"
#include "core/profile.h"
#include "core/sample.h"
#include "core/statistics.h"
#include "core/tag.h"
#include "core/taxonomy.h"
#include "core/trip.h"
#include "core/units.h"

namespace ssrf {

namespace {

json tags_to_json(const tag_list &tags)
{
	json out = json::array();
	for (const divetag *tag : tags) {
		if (tag)
			out.push_back(tag->name);
	}
	return out;
}

json gasmix_to_json(const struct gasmix &mix)
{
	// Raw permille as stored: 0/0 means "air" and the core resolves that
	// through get_o2()/get_he(). Resolve it here too so the UI never has to
	// know the sentinel, but keep the raw values as well.
	return json{
		{ "o2Permille", mix.o2.permille },
		{ "hePermille", mix.he.permille },
		{ "o2EffectivePermille", get_o2(mix) },
		{ "heEffectivePermille", get_he(mix) },
	};
}

// `used` is `dive::is_cylinder_used(index)`: true when the samples or the
// gas-switch events refer to this cylinder. It belongs to the dive rather than
// to the cylinder, but the editor needs it per row - it is what decides whether
// a cylinder may be removed at all (api.cpp, apply_cylinders()).
json cylinder_to_json(const cylinder_t &cyl, bool used)
{
	return json{
		{ "used", used },
		{ "description", cyl.type.description },
		{ "sizeMl", cyl.type.size.mliter },
		{ "workingPressureMbar", cyl.type.workingpressure.mbar },
		{ "gasmix", gasmix_to_json(cyl.gasmix) },
		{ "startMbar", cyl.start.mbar },
		{ "endMbar", cyl.end.mbar },
		{ "sampleStartMbar", cyl.sample_start.mbar },
		{ "sampleEndMbar", cyl.sample_end.mbar },
		{ "depthMm", cyl.depth.mm },
		{ "manuallyAdded", cyl.manually_added },
		{ "gasUsedMl", cyl.gas_used.mliter },
		{ "decoGasUsedMl", cyl.deco_gas_used.mliter },
		{ "use", static_cast<int>(cyl.cylinder_use) },
		{ "bestmixO2", cyl.bestmix_o2 },
		{ "bestmixHe", cyl.bestmix_he },
	};
}

json weightsystem_to_json(const weightsystem_t &ws)
{
	return json{
		{ "description", ws.description },
		{ "weightGrams", ws.weight.grams },
		{ "autoFilled", ws.auto_filled },
	};
}

json event_to_json(const struct event &ev)
{
	json j{
		{ "timeSec", ev.time.seconds },
		{ "type", ev.type },
		{ "flags", ev.flags },
		{ "value", ev.value },
		{ "name", ev.name },
		{ "hidden", ev.hidden },
		{ "severity", static_cast<int>(ev.get_severity()) },
	};
	// `event` keeps the extended payload in a union, so it may only be read
	// through the accessor that matches the event type.
	if (ev.is_gaschange()) {
		j["gasIndex"] = ev.gas.index;
		j["gasmix"] = gasmix_to_json(ev.gas.mix);
	} else if (ev.is_divemodechange()) {
		j["divemode"] = static_cast<int>(ev.divemode);
	}
	return j;
}

json divecomputer_to_json(const struct divecomputer &dc)
{
	json events = json::array();
	for (const struct event &ev : dc.events)
		events.push_back(event_to_json(ev));

	json extra = json::array();
	for (const struct extra_data &ed : dc.extra_data)
		extra.push_back(json{ { "key", ed.key }, { "value", ed.value } });

	return json{
		{ "model", dc.model },
		{ "serial", dc.serial },
		{ "fwVersion", dc.fw_version },
		{ "deviceId", dc.deviceid },
		{ "diveId", dc.diveid },
		{ "when", static_cast<int64_t>(dc.when) },
		{ "durationSec", dc.duration.seconds },
		{ "surfaceTimeSec", dc.surfacetime.seconds },
		{ "maxDepthMm", dc.maxdepth.mm },
		{ "meanDepthMm", dc.meandepth.mm },
		{ "airTempMkelvin", dc.airtemp.mkelvin },
		{ "waterTempMkelvin", dc.watertemp.mkelvin },
		{ "surfacePressureMbar", dc.surface_pressure.mbar },
		{ "divemode", static_cast<int>(dc.divemode) },
		{ "noO2sensors", dc.no_o2sensors },
		{ "salinity", dc.salinity },
		{ "timezoneOffset", dc.timezone_offset },
		{ "sampleCount", static_cast<int>(dc.samples.size()) },
		{ "events", std::move(events) },
		{ "extraData", std::move(extra) },
	};
}

json taxonomy_to_json(const taxonomy_data &t)
{
	json out = json::array();
	for (const struct taxonomy &tax : t) {
		out.push_back(json{
			{ "category", static_cast<int>(tax.category) },
			{ "value", tax.value },
			{ "origin", static_cast<int>(tax.origin) },
		});
	}
	return out;
}

} // namespace

json dive_summary_to_json(const struct dive &d)
{
	const struct divecomputer *dc = d.dcs.empty() ? nullptr : &d.dcs.front();

	// The gear the editors autocomplete from. The core has no suit or cylinder
	// table - the dives are the only record of what this diver owns - so the
	// corpus has to come off the dive list, which is the one thing the app
	// keeps cached. A few short strings per dive; the samples stay out of here.
	json cylinderDescriptions = json::array();
	for (const cylinder_t &cyl : d.cylinders) {
		if (!cyl.type.description.empty())
			cylinderDescriptions.push_back(cyl.type.description);
	}

	// ws_info_table does hold weightsystem names, but only the built-in ones
	// plus whatever this process has parsed - so the dives are still the record
	// of what the diver actually uses.
	json weightDescriptions = json::array();
	for (const weightsystem_t &ws : d.weightsystems) {
		if (!ws.description.empty())
			weightDescriptions.push_back(ws.description);
	}

	return json{
		{ "suit", d.suit },
		{ "cylinderDescriptions", std::move(cylinderDescriptions) },
		{ "weightDescriptions", std::move(weightDescriptions) },
		{ "id", d.id },
		{ "number", d.number },
		{ "when", static_cast<int64_t>(d.when) },
		{ "durationSec", d.duration.seconds },
		{ "maxDepthMm", d.maxdepth.mm },
		{ "meanDepthMm", d.meandepth.mm },
		{ "waterTempMkelvin", d.watertemp.mkelvin },
		{ "rating", d.rating },
		{ "visibility", d.visibility },
		{ "siteUuid", d.dive_site ? d.dive_site->uuid : 0u },
		{ "siteName", d.dive_site ? d.dive_site->name : std::string() },
		{ "tripLocation", d.divetrip ? d.divetrip->location : std::string() },
		{ "buddy", d.buddy },
		{ "diveguide", d.diveguide },
		{ "tags", tags_to_json(d.tags) },
		{ "divemode", dc ? static_cast<int>(dc->divemode) : static_cast<int>(OC) },
		{ "dcModel", dc ? dc->model : std::string() },
		{ "invalid", d.invalid },
	};
}

json dive_to_json(const struct dive &d)
{
	json j = dive_summary_to_json(d);

	j["notes"] = d.notes;
	j["wavesize"] = d.wavesize;
	j["current"] = d.current;
	j["surge"] = d.surge;
	j["chill"] = d.chill;
	j["sac"] = d.sac;
	j["otu"] = d.otu;
	j["cns"] = d.cns;
	j["maxcns"] = d.maxcns;
	j["salinity"] = d.salinity;
	j["userSalinity"] = d.user_salinity;
	j["minTempMkelvin"] = d.mintemp.mkelvin;
	j["maxTempMkelvin"] = d.maxtemp.mkelvin;
	j["airTempMkelvin"] = d.airtemp.mkelvin;
	j["surfacePressureMbar"] = d.surface_pressure.mbar;
	j["totalWeightGrams"] = d.total_weight().grams;
	j["notrip"] = d.notrip;

	json cylinders = json::array();
	for (size_t i = 0; i < d.cylinders.size(); ++i)
		cylinders.push_back(cylinder_to_json(d.cylinders[i], d.is_cylinder_used(static_cast<int>(i))));
	j["cylinders"] = std::move(cylinders);

	json weights = json::array();
	for (const weightsystem_t &ws : d.weightsystems)
		weights.push_back(weightsystem_to_json(ws));
	j["weightsystems"] = std::move(weights);

	json dcs = json::array();
	for (const struct divecomputer &dc : d.dcs)
		dcs.push_back(divecomputer_to_json(dc));
	j["dcs"] = std::move(dcs);

	return j;
}

json plot_info_to_json(const struct plot_info &pi)
{
	json entries = json::array();
	for (const struct plot_data &e : pi.entry) {
		entries.push_back(json{
			{ "sec", e.sec },
			{ "depthMm", e.depth.mm },
			{ "temperatureMkelvin", e.temperature },
			{ "ceilingMm", e.ceiling.mm },
			{ "stopdepthMm", e.stopdepth.mm },
			{ "stoptimeSec", e.stoptime },
			{ "ndlSec", e.ndl },
			{ "ttsSec", e.tts },
			{ "rbtSec", e.rbt },
			{ "inDeco", e.in_deco },
			{ "cns", e.cns },
			{ "sac", e.sac },
			{ "smoothedMm", e.smoothed.mm },
			{ "modMm", e.mod.mm },
			{ "eadMm", e.ead.mm },
			{ "endMm", e.end.mm },
			{ "eaddMm", e.eadd.mm },
			{ "o2pressureMbar", e.o2pressure.mbar },
			{ "o2setpointMbar", e.o2setpoint.mbar },
			{ "scrOcPo2Mbar", e.scr_OC_pO2.mbar },
			{ "pressures", json{ { "o2", e.pressures.o2 }, { "n2", e.pressures.n2 }, { "he", e.pressures.he } } },
			{ "velocity", static_cast<int>(e.velocity) },
			{ "speed", e.speed },
			{ "heartbeat", e.heartbeat },
			{ "bearing", e.bearing },
			{ "ambpressure", e.ambpressure },
			{ "gfline", e.gfline },
			{ "surfaceGf", e.surface_gf },
			{ "currentGf", e.current_gf },
			{ "density", e.density },
			{ "icdWarning", e.icd_warning },
		});
	}

	// pi.pressures is nr_cylinders blocks per sample, indexed
	// `cylinder + idx * nr_cylinders` (profile.h). Keep that exact layout so
	// the TS side can index it the same way the core does.
	json sensor = json::array();
	json interpolated = json::array();
	for (const struct plot_pressure_data &p : pi.pressures) {
		sensor.push_back(p.data[SENSOR_PR]);
		interpolated.push_back(p.data[INTERPOLATED_PR]);
	}

	return json{
		{ "nr", pi.nr },
		{ "nrCylinders", pi.nr_cylinders },
		{ "maxtimeSec", pi.maxtime },
		{ "meanDepthMm", pi.meandepth },
		{ "maxDepthMm", pi.maxdepth },
		{ "minPressureMbar", pi.minpressure },
		{ "maxPressureMbar", pi.maxpressure },
		{ "minHr", pi.minhr },
		{ "maxHr", pi.maxhr },
		{ "minTempMkelvin", pi.mintemp },
		{ "maxTempMkelvin", pi.maxtemp },
		{ "diveType", static_cast<int>(pi.dive_type) },
		{ "endtempcoord", pi.endtempcoord },
		{ "maxpp", pi.maxpp },
		{ "waypointAboveCeiling", pi.waypoint_above_ceiling },
		{ "entry", std::move(entries) },
		{ "pressures", json{ { "sensor", std::move(sensor) }, { "interpolated", std::move(interpolated) } } },
	};
}

json dive_site_to_json(const struct dive_site &ds)
{
	return json{
		{ "uuid", ds.uuid },
		{ "name", ds.name },
		{ "latUdeg", ds.location.lat.udeg },
		{ "lonUdeg", ds.location.lon.udeg },
		{ "hasGps", ds.has_gps_location() },
		{ "description", ds.description },
		{ "notes", ds.notes },
		{ "diveCount", static_cast<int>(ds.nr_of_dives()) },
		{ "taxonomy", taxonomy_to_json(ds.taxonomy) },
	};
}

json stats_to_json(const struct stats_t &s)
{
	return json{
		{ "period", s.period },
		{ "selectionSize", s.selection_size },
		{ "totalTimeSec", s.total_time.seconds },
		{ "totalAverageDepthTimeSec", s.total_average_depth_time.seconds },
		{ "shortestTimeSec", s.shortest_time.seconds },
		{ "longestTimeSec", s.longest_time.seconds },
		{ "maxDepthMm", s.max_depth.mm },
		{ "minDepthMm", s.min_depth.mm },
		{ "avgDepthMm", s.avg_depth.mm },
		{ "combinedMaxDepthMm", s.combined_max_depth.mm },
		{ "maxSacMlPerMin", s.max_sac.mliter },
		{ "minSacMlPerMin", s.min_sac.mliter },
		{ "avgSacMlPerMin", s.avg_sac.mliter },
		{ "totalSacTimeSec", s.total_sac_time.seconds },
		{ "maxTempMkelvin", s.max_temp.mkelvin },
		{ "minTempMkelvin", s.min_temp.mkelvin },
		{ "combinedTempMkelvin", s.combined_temp.mkelvin },
		{ "combinedCount", s.combined_count },
		{ "isYear", s.is_year },
		{ "isTrip", s.is_trip },
		{ "location", s.location },
	};
}

json stats_summary_to_json(const struct stats_summary &s)
{
	auto bucket = [](const std::vector<stats_t> &v) {
		json out = json::array();
		for (const stats_t &e : v)
			out.push_back(stats_to_json(e));
		return out;
	};
	return json{
		{ "yearly", bucket(s.stats_yearly) },
		{ "monthly", bucket(s.stats_monthly) },
		{ "byTrip", bucket(s.stats_by_trip) },
		{ "byType", bucket(s.stats_by_type) },
		{ "byDepth", bucket(s.stats_by_depth) },
		{ "byTemp", bucket(s.stats_by_temp) },
	};
}

} // namespace ssrf
