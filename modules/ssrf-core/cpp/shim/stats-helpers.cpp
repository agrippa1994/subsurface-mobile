// AI-generated (Claude)
//
// The helpers stats/statsvariables.cpp takes from upstream's core/string-format.cpp
// and core/qthelper.cpp, which are not compiled here. Units are upstream's symbols.
// A trip's title differs only in its date: a single-day trip reads "9 Mar 2021"
// rather than prefs.date_format through QLocale.

#include "gas.h"
#include "pref.h"
#include "qthelper.h"
#include "string-format.h"
#include "subsurface-time.h"
#include "trip.h"

#include "ssrf-qstring.h"

#include <ctime>

QString formatDayOfWeek(int day)
{
	static const char *const names[] = { "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" };
	return names[day >= 0 && day < 7 ? day : 0];
}

QString formatTripTitle(const dive_trip &trip)
{
	struct tm tm;
	utc_mkdate(trip.date(), &tm);
	std::string date = std::string(monthname(tm.tm_mon)) + " " + std::to_string(tm.tm_year);
	if (trip.is_single_day())
		date = std::to_string(tm.tm_mday) + " " + date;
	return QString(trip.location.empty() ? date : trip.location + ", " + date);
}

QString get_depth_unit(bool metric)
{
	return metric ? "m" : "ft";
}

QString get_depth_unit()
{
	return get_depth_unit(prefs.units.length == units::METERS);
}

QString get_weight_unit(bool metric)
{
	return metric ? "kg" : "lbs";
}

QString get_weight_unit()
{
	return get_weight_unit(prefs.units.weight == units::KG);
}

QString get_temp_unit(bool metric)
{
	return metric ? "\xC2\xB0""C" : "\xC2\xB0""F";
}

QString get_temp_unit()
{
	return get_temp_unit(prefs.units.temperature == units::CELSIUS);
}

QString get_volume_unit(bool metric)
{
	return metric ? "\xE2\x84\x93" : "cuft";
}

QString get_volume_unit()
{
	return get_volume_unit(prefs.units.volume == units::LITER);
}

QString get_gas_string(struct gasmix gas)
{
	return QString(gas.name());
}
