// AI-generated (Claude)
//
// Qt-free replacement for core/format.h.
//
// Upstream declares both QString and std::string formatting helpers; only the
// std::string ones are referenced by the vendored subset, so the QString
// overloads are dropped rather than emulated.
#ifndef FORMAT_H
#define FORMAT_H

#include <cstdarg>
#include <string>

#ifdef __GNUC__
#define __printf(x, y) __attribute__((__format__(__printf__, x, y)))
#else
#define __printf(x, y)
#endif

__printf(1, 2) std::string casprintf_loc(const char *cformat, ...);
__printf(1, 0) std::string vformat_string_std(const char *fmt, va_list ap);
__printf(1, 2) std::string format_string_std(const char *fmt, ...);

#endif
