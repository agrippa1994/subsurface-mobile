// AI-generated (Claude)
//
// A stand-in for the part of Qt's QString that the Qt-free core build needs:
// core/import-suunto-json.cpp, stats/statsvariables.cpp and stats/statsstate.cpp
// compile against it unchanged. One class for all of them, or the linker would
// merge the inline functions of two different QStrings.
//
// The text is UTF-8 in a std::string, not UTF-16. What that changes:
//   - `<` orders by code point, where Qt orders by UTF-16 code unit. They differ
//     only for characters above U+FFFF against U+E000-U+FFFF.
//   - case-insensitive comparison folds ASCII, Latin-1, Latin Extended-A, Greek
//     and Cyrillic. Qt folds all of Unicode, so another script compares
//     case-sensitively here. It only decides the order of two bins whose names
//     differ by nothing but case, in a script nothing folds.
//   - numbers format in the C locale without group separators, as shim/format.cpp
//     does, where QLocale would write "1,000". These are labels, never data.
#pragma once

#include <cstdio>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

#include "QtGlobal"

class QString;
using QStringList = std::vector<QString>;

namespace Qt {
enum CaseSensitivity { CaseInsensitive, CaseSensitive };
enum SplitBehaviorFlags { KeepEmptyParts, SkipEmptyParts };
} // namespace Qt

#ifndef SKIP_EMPTY
#define SKIP_EMPTY Qt::SkipEmptyParts
#endif

namespace ssrf_qstring {

inline std::string format_double(double value, char format, int precision)
{
	char spec[8] = { '%', '.', '*', format, 0 };
	if (precision < 0) {
		// Qt's default for a double, 'g' with six significant digits.
		precision = 6;
	}
	char buffer[64];
	std::snprintf(buffer, sizeof(buffer), spec, precision, value);
	return buffer;
}

// One code point at `at`, moving past it. Malformed bytes count as themselves.
inline unsigned next_code_point(std::string_view text, size_t &at)
{
	unsigned char c = static_cast<unsigned char>(text[at++]);
	int extra = c >= 0xF0 ? 3 : c >= 0xE0 ? 2 : c >= 0xC0 ? 1 : 0;
	if (extra == 0 || at + extra > text.size())
		return c;
	unsigned value = c & (0x3F >> extra);
	while (extra-- > 0)
		value = (value << 6) | (static_cast<unsigned char>(text[at++]) & 0x3F);
	return value;
}

inline unsigned fold_case(unsigned c)
{
	if (c >= 'A' && c <= 'Z')
		return c + 32;
	if (c >= 0xC0 && c <= 0xDE && c != 0xD7)
		return c + 32;
	// Latin Extended-A pairs capital and small, in steps that shift half way.
	if ((c >= 0x100 && c <= 0x137) || (c >= 0x14A && c <= 0x177))
		return c | 1;
	if ((c >= 0x139 && c <= 0x148) || (c >= 0x179 && c <= 0x17E))
		return (c & 1) ? c + 1 : c;
	if (c >= 0x391 && c <= 0x3A9 && c != 0x3A2)
		return c + 32;
	if (c >= 0x410 && c <= 0x42F)
		return c + 32;
	if (c >= 0x400 && c <= 0x40F)
		return c + 80;
	return c;
}

} // namespace ssrf_qstring

class QString {
public:
	QString() = default;
	QString(const char *value) : value_(value ? value : "") {}
	explicit QString(std::string value) : value_(std::move(value)) {}

	static QString fromStdString(std::string value) { return QString(std::move(value)); }

	static QString number(int value) { return QString(std::to_string(value)); }
	static QString number(double value, char format = 'g', int precision = 6)
	{
		return QString(ssrf_qstring::format_double(value, format, precision));
	}

	std::string toStdString() const { return value_; }
	const std::string &str() const { return value_; }

	bool isEmpty() const { return value_.empty(); }

	QString toLower() const
	{
		std::string out = value_;
		for (char &c : out)
			c = static_cast<char>(tolower(static_cast<unsigned char>(c)));
		return QString(out);
	}

	QString trimmed() const
	{
		const char *space = " \t\n\r\f\v";
		size_t from = value_.find_first_not_of(space);
		if (from == std::string::npos)
			return QString();
		return QString(value_.substr(from, value_.find_last_not_of(space) - from + 1));
	}

	QString repeated(int times) const
	{
		std::string out;
		for (int i = 0; i < times; ++i)
			out += value_;
		return QString(out);
	}

	QStringList split(const char *separator, Qt::SplitBehaviorFlags behavior = Qt::KeepEmptyParts) const
	{
		QStringList out;
		std::string_view sep(separator);
		size_t from = 0;
		while (true) {
			size_t to = value_.find(sep, from);
			std::string part = value_.substr(from, to == std::string::npos ? to : to - from);
			if (behavior == Qt::KeepEmptyParts || !part.empty())
				out.push_back(QString(part));
			if (to == std::string::npos)
				return out;
			from = to + sep.size();
		}
	}

	// Qt's arg() fills the lowest-numbered %N or %LN, every occurrence of it.
	QString arg(const QString &a) const { return substitute(a.value_); }
	QString arg(const QString &a, const QString &b) const { return arg(a).arg(b); }
	QString arg(const QString &a, const QString &b, const QString &c) const { return arg(a).arg(b).arg(c); }
	QString arg(const QString &a, const QString &b, const QString &c, const QString &d) const
	{
		return arg(a).arg(b).arg(c).arg(d);
	}
	template <typename T, std::enable_if_t<std::is_integral_v<T>, int> = 0>
	QString arg(T value) const
	{
		return substitute(std::to_string(value));
	}
	QString arg(double value, int fieldWidth = 0, char format = 'g', int precision = -1) const
	{
		return substitute(ssrf_qstring::format_double(value, format, precision));
	}

	QString &operator+=(const QString &other)
	{
		value_ += other.value_;
		return *this;
	}
	friend QString operator+(QString a, const QString &b)
	{
		a.value_ += b.value_;
		return a;
	}

	bool operator==(const QString &other) const { return value_ == other.value_; }
	bool operator!=(const QString &other) const { return value_ != other.value_; }
	bool operator<(const QString &other) const { return value_ < other.value_; }

	static int compare(const QString &a, const QString &b, Qt::CaseSensitivity cs = Qt::CaseSensitive)
	{
		if (cs == Qt::CaseSensitive)
			return a.value_.compare(b.value_);
		size_t i = 0, j = 0;
		while (i < a.value_.size() && j < b.value_.size()) {
			unsigned x = ssrf_qstring::fold_case(ssrf_qstring::next_code_point(a.value_, i));
			unsigned y = ssrf_qstring::fold_case(ssrf_qstring::next_code_point(b.value_, j));
			if (x != y)
				return x < y ? -1 : 1;
		}
		if (i < a.value_.size())
			return 1;
		return j < b.value_.size() ? -1 : 0;
	}

private:
	QString substitute(const std::string &text) const
	{
		int lowest = 0;
		for (size_t at = 0; at + 1 < value_.size(); ++at) {
			int number = placeholder_at(at, nullptr);
			if (number && (!lowest || number < lowest))
				lowest = number;
		}
		if (!lowest)
			return *this;
		std::string out;
		for (size_t at = 0; at < value_.size();) {
			size_t length = 0;
			if (placeholder_at(at, &length) == lowest) {
				out += text;
				at += length;
			} else {
				out += value_[at++];
			}
		}
		return QString(out);
	}

	// The number of a placeholder starting at `at`, or 0.
	int placeholder_at(size_t at, size_t *length) const
	{
		if (value_[at] != '%')
			return 0;
		size_t digit = at + 1;
		if (digit < value_.size() && value_[digit] == 'L')
			digit++;
		size_t end = digit;
		while (end < value_.size() && value_[end] >= '0' && value_[end] <= '9')
			end++;
		if (end == digit)
			return 0;
		if (length)
			*length = end - at;
		return std::stoi(value_.substr(digit, end - digit));
	}

	std::string value_;
};

#define QStringLiteral(text) QString(text)

class QObject {
public:
	// Translation is deferred to the TypeScript layer, as in shim/gettext.cpp.
	static QString tr(const char *text) { return QString(text); }
};

#define Q_OBJECT

// For a warning nobody here reads; qWarning itself comes from errorhelper.h or below.
#define qPrintable(string) ((string).str().c_str())
#ifndef qWarning
#define qWarning(...) ((void)0)
#endif

class QLocale {
public:
	QString toString(int value) const { return QString::number(value); }
	QString toString(double value, char format = 'g', int precision = 6) const
	{
		return QString(ssrf_qstring::format_double(value, format, precision));
	}
};
