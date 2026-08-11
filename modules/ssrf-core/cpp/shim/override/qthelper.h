// AI-generated (Claude)
//
// Qt-free replacement for core/qthelper.h.
//
// Upstream qthelper is the desktop app's grab bag: QString/QDateTime/QLocale
// formatting, Qt resource loading, proxy setup, cloud reachability, thumbnail
// caching. The vendored subset only reaches into a small corner of it, so this
// header declares that corner and `shim/qthelper.cpp` implements it with the
// standard library alone. Anything not listed here is intentionally absent -
// if the linker asks for it, add it deliberately rather than pulling in Qt.
#ifndef QTHELPER_H
#define QTHELPER_H

#include "subsurface-time.h"
#include "units.h"

#include <libxslt/transform.h>
#include <libxslt/xsltutils.h>

#include <string>

struct picture;
struct xml_params;

enum watertypes { FRESHWATER, BRACKISHWATER, EN13319WATER, SALTWATER, DC_WATERTYPE };

// Parses a user-entered value with an optional unit suffix, falling back to the
// unit in `prefs` when none is given. Faithful ports of the Qt versions, minus
// the localized unit names (translation is deferred - see gettext.h).
weight_t string_to_weight(const char *str);
depth_t string_to_depth(const char *str);
pressure_t string_to_pressure(const char *str);
volume_t string_to_volume(const char *str, pressure_t workp);
fraction_t string_to_fraction(const char *str);

// ISO-8601 ("2019-03-22T09:19:00") to a UTC timestamp.
time_t get_dive_datetime_from_isostring(const char *when);

// Today, formatted with prefs.date_format_short.
std::string get_current_date();

// Loads an XSLT stylesheet by file name. The desktop app resolves these from Qt
// resources; here they are read from the directory set by
// set_xslt_directory(), which the native module points at the bundled copy of
// subsurface/xslt/. Returns NULL when the stylesheet cannot be loaded.
xsltStylesheetPtr get_stylesheet(const char *name);
void set_xslt_directory(const std::string &path);

std::string subsurface_user_agent();
std::string get_file_name(const std::string &fileName);
std::string local_file_path(const struct picture &picture);

// Upstream notifies the Qt models that the dive list changed. The mobile app
// re-reads state explicitly after every mutation, so this is a no-op.
void emit_reset_signal();

#endif // QTHELPER_H
