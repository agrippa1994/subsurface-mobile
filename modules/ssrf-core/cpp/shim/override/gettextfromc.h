// AI-generated (Claude)
//
// Qt-free replacement for core/gettextfromc.h.
//
// Upstream declares a `gettextFromC` class carrying Q_DECLARE_TR_FUNCTIONS, so
// core code calls `gettextFromC::tr("...")` and gets a QString back - which
// callers then use as a QString (`.toStdString()`, concatenation, printf via
// qPrintable). Localization is deferred here, so tr() is the identity, but it
// still has to return something with that shape. `translated_string` is that
// something: a std::string that also answers to toStdString().
#ifndef GETTEXTFROMC_H
#define GETTEXTFROMC_H

#include "gettext.h"

#include <string>

struct translated_string : std::string {
	using std::string::string;
	explicit translated_string(const char *s) : std::string(s) {}
	const std::string &toStdString() const { return *this; }
};

namespace gettextFromC {

inline translated_string tr(const char *text)
{
	return translated_string(trGettext(text));
}

} // namespace gettextFromC

#endif // GETTEXTFROMC_H
