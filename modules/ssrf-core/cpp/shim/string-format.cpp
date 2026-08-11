// AI-generated (Claude)
//
// Standard-library implementation of the two std::string formatters the
// vendored core subset uses from core/string-format.h. Everything else in that
// header is desktop-UI formatting and is not part of the mobile build.

#include "string-format.h"

#include "dive.h"
#include "format.h"
#include "gettext.h"
#include "pref.h"
#include "subsurface-time.h"

#include <cstdlib>
#include <ctime>

std::string printGPSCoordsC(const location_t *location)
{
	int lat = location->lat.udeg;
	int lon = location->lon.udeg;

	if (!has_location(location))
		return std::string();

	if (prefs.coordinates_traditional) {
		const char *lath = lat >= 0 ? translate("gettextFromC", "N") : translate("gettextFromC", "S");
		const char *lonh = lon >= 0 ? translate("gettextFromC", "E") : translate("gettextFromC", "W");
		lat = abs(lat);
		lon = abs(lon);
		unsigned int latdeg = lat / 1000000U;
		unsigned int londeg = lon / 1000000U;
		unsigned int latmin = (lat % 1000000U) * 60U;
		unsigned int lonmin = (lon % 1000000U) * 60U;
		double latsec = (latmin % 1000000) * 60;
		double lonsec = (lonmin % 1000000) * 60;
		return format_string_std("%u°%02d\'%06.3f\"%s %u°%02d\'%06.3f\"%s",
					 latdeg, latmin / 1000000, latsec / 1000000, lath,
					 londeg, lonmin / 1000000, lonsec / 1000000, lonh);
	}
	return format_string_std("%f %f", (double)lat / 1000000.0, (double)lon / 1000000.0);
}

std::string get_dive_date_c_string(timestamp_t when)
{
	// Upstream renders this with QLocale and prefs.date_format_short /
	// prefs.time_format. The only in-core consumer is a log/diagnostic
	// string, so a fixed ISO-like rendering in UTC is used instead - stable
	// across locales and trivially parseable.
	time_t t = (time_t)when;
	struct tm tm;
	gmtime_r(&t, &tm);

	char buffer[32];
	if (!strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M", &tm))
		return std::string();
	return std::string(buffer);
}
