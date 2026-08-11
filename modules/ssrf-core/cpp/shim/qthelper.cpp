// AI-generated (Claude)
//
// Standard-library implementation of the qthelper corner the vendored core
// subset uses. See cpp/shim/override/qthelper.h for the declared surface.

#include "qthelper.h"

#include "errorhelper.h"
#include "pref.h"
#include "subsurface-string.h"
#include "units.h"

#include <cmath>
#include <cstdlib>
#include <cstring>
#include <ctime>

namespace {

// Equivalent of QString(end).trimmed(): the unit suffix the user typed, with
// surrounding whitespace removed. Only the leading edge matters for the
// startsWith() checks below, but trimming both keeps the semantics identical.
std::string trimmed_suffix(const char *end)
{
	std::string rest(end ? end : "");
	size_t first = rest.find_first_not_of(" \t\r\n");
	if (first == std::string::npos)
		return std::string();
	size_t last = rest.find_last_not_of(" \t\r\n");
	return rest.substr(first, last - first + 1);
}

bool starts_with(const std::string &s, const char *prefix)
{
	return s.compare(0, strlen(prefix), prefix) == 0;
}

std::string xslt_directory;

} // namespace

weight_t string_to_weight(const char *str)
{
	const char *end;
	double value = permissive_strtod(str, &end);
	std::string rest = trimmed_suffix(end);
	weight_t weight;

	if (starts_with(rest, "kg"))
		goto kg;
	// using just "lb" instead of "lbs" is intentional - some people might enter the singular
	if (starts_with(rest, "lb"))
		goto lbs;
	if (prefs.units.weight == prefs.units.LBS)
		goto lbs;
kg:
	weight.grams = lrint(value * 1000);
	return weight;
lbs:
	weight.grams = lbs_to_grams(value);
	return weight;
}

depth_t string_to_depth(const char *str)
{
	const char *end;
	double value = permissive_strtod(str, &end);
	std::string rest = trimmed_suffix(end);
	depth_t depth;

	if (value < 0)
		value = 0;
	if (starts_with(rest, "m"))
		goto m;
	if (starts_with(rest, "ft"))
		goto ft;
	if (prefs.units.length == prefs.units.FEET)
		goto ft;
m:
	depth.mm = lrint(value * 1000);
	return depth;
ft:
	depth.mm = feet_to_mm(value);
	return depth;
}

pressure_t string_to_pressure(const char *str)
{
	const char *end;
	double value = permissive_strtod(str, &end);
	std::string rest = trimmed_suffix(end);
	pressure_t pressure;

	if (starts_with(rest, "bar"))
		goto bar;
	if (starts_with(rest, "psi"))
		goto psi;
	if (prefs.units.pressure == prefs.units.PSI)
		goto psi;
bar:
	pressure.mbar = lrint(value * 1000);
	return pressure;
psi:
	pressure.mbar = psi_to_mbar(value);
	return pressure;
}

volume_t string_to_volume(const char *str, pressure_t workp)
{
	const char *end;
	double value = permissive_strtod(str, &end);
	std::string rest = trimmed_suffix(end);
	volume_t volume;

	if (starts_with(rest, "L") || starts_with(rest, "l") || starts_with(rest, "ℓ"))
		goto l;
	if (starts_with(rest, "cuft"))
		goto cuft;
	/*
	 * If we don't have explicit units, and there is no working
	 * pressure, we're going to assume "liter" even in imperial
	 * measurements.
	 */
	if (!workp.mbar)
		goto l;
	if (prefs.units.volume == prefs.units.LITER)
		goto l;
cuft:
	if (workp.mbar)
		value /= bar_to_atm(workp.mbar / 1000.0);
	value = cuft_to_l(value);
l:
	volume.mliter = lrint(value * 1000);
	return volume;
}

fraction_t string_to_fraction(const char *str)
{
	const char *end;
	double value = permissive_strtod(str, &end);
	fraction_t fraction;

	fraction.permille = lrint(value * 10);
	/*
	 * Don't permit values less than zero or greater than 100%
	 */
	if (fraction.permille < 0)
		fraction = 0_percent;
	else if (fraction.permille > 1000)
		fraction = 100_percent;
	return fraction;
}

time_t get_dive_datetime_from_isostring(const char *when)
{
	// QDateTime::fromString(..., Qt::ISODate) with no zone marker yields a
	// local-time value; timegm()/mktime() below mirror that: a trailing "Z"
	// or offset is parsed as UTC, everything else as local time.
	if (!when || !*when)
		return 0;

	struct tm tm = {};
	tm.tm_isdst = -1;
	const char *rest = strptime(when, "%Y-%m-%dT%H:%M:%S", &tm);
	if (!rest)
		rest = strptime(when, "%Y-%m-%d %H:%M:%S", &tm);
	if (!rest)
		return 0;

	while (*rest == ' ')
		rest++;
	if (*rest == 'Z' || *rest == '+' || *rest == '-') {
		time_t utc = timegm(&tm);
		if (*rest == '+' || *rest == '-') {
			int hours = 0, minutes = 0;
			if (sscanf(rest + 1, "%2d:%2d", &hours, &minutes) >= 1) {
				int offset = hours * 3600 + minutes * 60;
				utc += (*rest == '+') ? -offset : offset;
			}
		}
		return utc;
	}
	return mktime(&tm);
}

std::string get_current_date()
{
	time_t now = time(nullptr);
	struct tm tm;
	localtime_r(&now, &tm);

	// prefs.date_format_short is a Qt date format string ("M/d/yy" and
	// friends). Only the field order matters for the strings we produce, so
	// the common patterns are mapped onto strftime rather than reimplementing
	// QLocale::toString().
	const char *format = "%x";
	if (prefs.date_format_short == "yyyy-MM-dd")
		format = "%Y-%m-%d";
	else if (prefs.date_format_short == "dd.MM.yyyy" || prefs.date_format_short == "d.M.yyyy")
		format = "%d.%m.%Y";
	else if (prefs.date_format_short == "MM/dd/yyyy" || prefs.date_format_short == "M/d/yy")
		format = "%m/%d/%Y";

	char buffer[64];
	if (!strftime(buffer, sizeof(buffer), format, &tm))
		return std::string();
	return std::string(buffer);
}

void set_xslt_directory(const std::string &path)
{
	xslt_directory = path;
}

xsltStylesheetPtr get_stylesheet(const char *name)
{
	// The desktop app resolves stylesheets from Qt resources; we read them
	// from the directory the native module bundles subsurface/xslt/ into.
	if (xslt_directory.empty()) {
		report_error("no XSLT directory configured, cannot load %s", name);
		return NULL;
	}

	std::string path = xslt_directory + "/" + name;
	xmlDocPtr doc = xmlReadFile(path.c_str(), NULL, XML_PARSE_NOENT);
	if (!doc) {
		report_error("failed to read stylesheet %s", path.c_str());
		return NULL;
	}

	xsltStylesheetPtr xslt = xsltParseStylesheetDoc(doc);
	if (!xslt) {
		xmlFreeDoc(doc);
		report_error("failed to parse stylesheet %s", path.c_str());
		return NULL;
	}
	// xsltParseStylesheetDoc() takes ownership of doc on success.
	return xslt;
}

std::string subsurface_user_agent()
{
	// Upstream builds this from the Qt platform info; the mobile module has
	// no version string of its own yet, so it identifies itself plainly.
	return std::string("Subsurface-mobile");
}

std::string get_file_name(const std::string &fileName)
{
	size_t slash = fileName.find_last_of('/');
	return slash == std::string::npos ? fileName : fileName.substr(slash + 1);
}

std::string local_file_path(const struct picture &)
{
	// Media handling is out of scope for v1 (pictures are parsed and saved,
	// but never resolved to a local file).
	return std::string();
}

void emit_reset_signal()
{
}
