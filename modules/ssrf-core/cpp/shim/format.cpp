// AI-generated (Claude)
//
// Standard-library implementation of core/format.h's std::string helpers.
//
// Upstream routes these through QString::arg(), which formats numbers with the
// user's QLocale (decimal comma, digit grouping). We format in the C locale
// instead: every consumer in the vendored subset writes to XML or to a log
// line, where locale-dependent numbers would be a bug, not a feature. If a
// user-facing formatter is ever added it must localize in TypeScript.

#include "format.h"

#include <cstdio>
#include <vector>

std::string vformat_string_std(const char *fmt, va_list ap)
{
	va_list ap2;
	va_copy(ap2, ap);
	int size = vsnprintf(NULL, 0, fmt, ap2);
	va_end(ap2);
	if (size <= 0)
		return std::string();

	std::vector<char> buffer(static_cast<size_t>(size) + 1);
	vsnprintf(buffer.data(), buffer.size(), fmt, ap);
	return std::string(buffer.data(), static_cast<size_t>(size));
}

std::string format_string_std(const char *fmt, ...)
{
	va_list ap;
	va_start(ap, fmt);
	std::string res = vformat_string_std(fmt, ap);
	va_end(ap);
	return res;
}

std::string casprintf_loc(const char *cformat, ...)
{
	va_list ap;
	va_start(ap, cformat);
	std::string res = vformat_string_std(cformat, ap);
	va_end(ap);
	return res;
}
