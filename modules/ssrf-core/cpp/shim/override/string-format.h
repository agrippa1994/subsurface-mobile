// AI-generated (Claude)
//
// Qt-free replacement for core/string-format.h.
//
// Upstream is a large surface of QString/QStringList formatters for the desktop
// UI. The vendored subset touches only the std::string entry points, and the
// mobile UI formats in TypeScript, so only those are kept.
#ifndef STRING_FORMAT_H
#define STRING_FORMAT_H

#include "units.h"

#include <string>

struct dive;

// "N mm'ss.sss" E ..." when prefs.coordinates_traditional is set, plain decimal
// degrees otherwise; empty string when the location is unset.
std::string printGPSCoordsC(const location_t *loc);

// Local-time "YYYY-MM-DD HH:MM" rendering of a dive timestamp.
std::string get_dive_date_c_string(timestamp_t when);

#endif
