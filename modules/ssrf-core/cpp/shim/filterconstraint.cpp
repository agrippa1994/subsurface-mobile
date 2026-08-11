// AI-generated (Claude)
//
// Qt-free port of the part of core/filterconstraint.cpp that the logbook format
// depends on: the tokens written to the file, the parser-side constructors, and
// the serializer-side data_to_string(). Upstream's remaining ~600 lines are
// translated labels, unit conversion for display, and widget hints for the
// desktop filter editor - all UI, none of it reachable here.
//
// The token tables below must stay byte-identical to upstream's, since they are
// what ends up in the file.

#include "filterconstraint.h"

#include "errorhelper.h"
#include "subsurface-time.h"
#include "units.h"

#include <ctime>
#include <iterator>

namespace {

struct type_description {
	filter_constraint_type type;
	const char *token;    // untranslated token, written to the log
	bool has_string_mode; // constraint has textual input
	bool has_range_mode;  // constraint has equal, less than, greater than and from-to modes
	bool is_star_widget;
	bool has_date;
	bool has_time;
};

const type_description type_descriptions[] = {
	{ FILTER_CONSTRAINT_DATE, "date", false, true, false, true, false },
	{ FILTER_CONSTRAINT_DATE_TIME, "date_time", false, true, false, true, true },
	{ FILTER_CONSTRAINT_TIME_OF_DAY, "time_of_day", false, true, false, false, true },
	{ FILTER_CONSTRAINT_YEAR, "year", false, true, false, false, false },
	{ FILTER_CONSTRAINT_DAY_OF_WEEK, "day_of_week", false, false, false, false, false },

	{ FILTER_CONSTRAINT_RATING, "rating", false, true, true, false, false },
	{ FILTER_CONSTRAINT_WAVESIZE, "wavesize", false, true, true, false, false },
	{ FILTER_CONSTRAINT_CURRENT, "current", false, true, true, false, false },
	{ FILTER_CONSTRAINT_VISIBILITY, "visibility", false, true, true, false, false },
	{ FILTER_CONSTRAINT_SURGE, "surge", false, true, true, false, false },
	{ FILTER_CONSTRAINT_CHILL, "chill", false, true, true, false, false },

	{ FILTER_CONSTRAINT_DEPTH, "depth", false, true, false, false, false },
	{ FILTER_CONSTRAINT_DURATION, "duration", false, true, false, false, false },
	{ FILTER_CONSTRAINT_WEIGHT, "weight", false, true, false, false, false },
	{ FILTER_CONSTRAINT_WATER_TEMP, "water_temp", false, true, false, false, false },
	{ FILTER_CONSTRAINT_AIR_TEMP, "air_temp", false, true, false, false, false },
	{ FILTER_CONSTRAINT_WATER_DENSITY, "water_density", false, true, false, false, false },
	{ FILTER_CONSTRAINT_SAC, "sac", false, true, false, false, false },

	{ FILTER_CONSTRAINT_LOGGED, "logged", false, false, false, false, false },
	{ FILTER_CONSTRAINT_PLANNED, "planned", false, false, false, false, false },

	{ FILTER_CONSTRAINT_DIVE_MODE, "dive_mode", false, false, false, false, false },

	{ FILTER_CONSTRAINT_TAGS, "tags", true, false, false, false, false },
	{ FILTER_CONSTRAINT_PEOPLE, "people", true, false, false, false, false },
	{ FILTER_CONSTRAINT_LOCATION, "location", true, false, false, false, false },
	{ FILTER_CONSTRAINT_WEIGHT_TYPE, "weight_type", true, false, false, false, false },
	{ FILTER_CONSTRAINT_CYLINDER_TYPE, "cylinder_type", true, false, false, false, false },
	{ FILTER_CONSTRAINT_CYLINDER_SIZE, "cylinder_size", false, true, false, false, false },
	{ FILTER_CONSTRAINT_CYLINDER_N2, "cylinder_n2", false, true, false, false, false },
	{ FILTER_CONSTRAINT_CYLINDER_O2, "cylinder_o2", false, true, false, false, false },
	{ FILTER_CONSTRAINT_CYLINDER_HE, "cylinder_he", false, true, false, false, false },
	{ FILTER_CONSTRAINT_SUIT, "suit", true, false, false, false, false },
	{ FILTER_CONSTRAINT_NOTES, "notes", true, false, false, false, false },
	{ FILTER_CONSTRAINT_DIVE_COMPUTER, "dive_computer", true, false, false, false, false },
};

struct string_mode_description {
	filter_constraint_string_mode mode;
	const char *token;
};

const string_mode_description string_mode_descriptions[] = {
	{ FILTER_CONSTRAINT_STARTS_WITH, "starts_with" },
	{ FILTER_CONSTRAINT_SUBSTRING, "substring" },
	{ FILTER_CONSTRAINT_EXACT, "exact" },
};

struct range_mode_description {
	filter_constraint_range_mode mode;
	const char *token;
};

const range_mode_description range_mode_descriptions[] = {
	{ FILTER_CONSTRAINT_EQUAL, "equal" },
	{ FILTER_CONSTRAINT_LESS, "less" },
	{ FILTER_CONSTRAINT_GREATER, "greater" },
	{ FILTER_CONSTRAINT_RANGE, "range" },
};

const type_description *get_type_description(enum filter_constraint_type type)
{
	for (const auto &desc: type_descriptions) {
		if (desc.type == type)
			return &desc;
	}
	report_error("unknown filter constraint type: %d", type);
	return nullptr;
}

const string_mode_description *get_string_mode_description(enum filter_constraint_string_mode mode)
{
	for (const auto &desc: string_mode_descriptions) {
		if (desc.mode == mode)
			return &desc;
	}
	report_error("unknown filter constraint string mode: %d", mode);
	return nullptr;
}

const range_mode_description *get_range_mode_description(enum filter_constraint_range_mode mode)
{
	for (const auto &desc: range_mode_descriptions) {
		if (desc.mode == mode)
			return &desc;
	}
	report_error("unknown filter constraint range mode: %d", mode);
	return nullptr;
}

enum filter_constraint_type filter_constraint_type_from_string(const std::string &s)
{
	for (const auto &desc: type_descriptions) {
		if (desc.token == s)
			return desc.type;
	}
	report_error("unknown filter constraint type: %s", s.c_str());
	return FILTER_CONSTRAINT_DATE;
}

enum filter_constraint_string_mode filter_constraint_string_mode_from_string(const std::string &s)
{
	for (const auto &desc: string_mode_descriptions) {
		if (desc.token == s)
			return desc.mode;
	}
	report_error("unknown filter constraint string mode: %s", s.c_str());
	return FILTER_CONSTRAINT_EXACT;
}

enum filter_constraint_range_mode filter_constraint_range_mode_from_string(const std::string &s)
{
	for (const auto &desc: range_mode_descriptions) {
		if (desc.token == s)
			return desc.mode;
	}
	report_error("unknown filter constraint range mode: %s", s.c_str());
	return FILTER_CONSTRAINT_EQUAL;
}

// Upstream splits with QString::split(','), which yields one empty element for
// an empty input. Reproduced here so a round trip preserves the element count.
std::vector<std::string> split(const std::string &s, char sep)
{
	std::vector<std::string> result;
	size_t start = 0;
	for (;;) {
		size_t pos = s.find(sep, start);
		if (pos == std::string::npos) {
			result.push_back(s.substr(start));
			return result;
		}
		result.push_back(s.substr(start, pos - start));
		start = pos + 1;
	}
}

std::string join(const std::vector<std::string> &v, char sep)
{
	std::string result;
	for (size_t i = 0; i < v.size(); ++i) {
		if (i)
			result += sep;
		result += v[i];
	}
	return result;
}

bool filter_constraint_is_multiple_choice(filter_constraint_type type)
{
	return type == FILTER_CONSTRAINT_DAY_OF_WEEK || type == FILTER_CONSTRAINT_DIVE_MODE;
}

} // namespace

const char *filter_constraint_type_to_string(enum filter_constraint_type type)
{
	const type_description *desc = get_type_description(type);
	return desc ? desc->token : "unknown";
}

const char *filter_constraint_string_mode_to_string(enum filter_constraint_string_mode mode)
{
	const string_mode_description *desc = get_string_mode_description(mode);
	return desc ? desc->token : "unknown";
}

const char *filter_constraint_range_mode_to_string(enum filter_constraint_range_mode mode)
{
	const range_mode_description *desc = get_range_mode_description(mode);
	return desc ? desc->token : "unknown";
}

bool filter_constraint_is_string(filter_constraint_type type)
{
	// Currently a constraint is string based if and only if it has a string
	// mode (i.e. starts with, substring, exact).
	return filter_constraint_has_string_mode(type);
}

bool filter_constraint_is_timestamp(filter_constraint_type type)
{
	return type == FILTER_CONSTRAINT_DATE || type == FILTER_CONSTRAINT_DATE_TIME;
}

bool filter_constraint_has_string_mode(enum filter_constraint_type type)
{
	const type_description *desc = get_type_description(type);
	return desc && desc->has_string_mode;
}

bool filter_constraint_has_range_mode(enum filter_constraint_type type)
{
	const type_description *desc = get_type_description(type);
	return desc && desc->has_range_mode;
}

bool filter_constraint_is_star(filter_constraint_type type)
{
	const type_description *desc = get_type_description(type);
	return desc && desc->is_star_widget;
}

bool filter_constraint_has_date_widget(filter_constraint_type type)
{
	const type_description *desc = get_type_description(type);
	return desc && desc->has_date;
}

bool filter_constraint_has_time_widget(filter_constraint_type type)
{
	const type_description *desc = get_type_description(type);
	return desc && desc->has_time;
}

// String constraints are valid if there is at least one term.
// Other constraints are always valid.
bool filter_constraint_is_valid(const struct filter_constraint *constraint)
{
	if (!filter_constraint_is_string(constraint->type))
		return true;
	return !constraint->data.string_list->empty();
}

filter_constraint::filter_constraint(filter_constraint_type typeIn) :
	type(typeIn),
	string_mode(FILTER_CONSTRAINT_STARTS_WITH),
	range_mode(FILTER_CONSTRAINT_GREATER),
	negate(false)
{
	// Defaults for a freshly created constraint. Upstream computes the same
	// values via QDateTime; only the date arithmetic differs in spelling.
	if (filter_constraint_is_timestamp(type)) {
		// Dives in the last year up to next week (newly added dives typically are in the future).
		time_t now = time(nullptr);
		data.timestamp_range.from = (timestamp_t)(now - 365 * 24 * 3600);
		data.timestamp_range.to = (timestamp_t)(now + 7 * 24 * 3600);
	} else if (filter_constraint_is_string(type)) {
		data.string_list = new std::vector<std::string>;
	} else if (filter_constraint_is_star(type)) {
		data.numerical_range.from = 0;
		data.numerical_range.to = 5;
	} else if (filter_constraint_is_multiple_choice(type)) {
		// By default select all the possible items
		data.multiple_choice = ~0LLU;
	} else if (filter_constraint_has_time_widget(type) && !filter_constraint_has_date_widget(type)) {
		// This is a time field. For now let's set it arbitrarily to the whole day.
		data.numerical_range.from = 0;
		data.numerical_range.to = 24 * 3600 - 60;
	} else if (type == FILTER_CONSTRAINT_YEAR) {
		// Find dives in the last five years.
		time_t now = time(nullptr);
		struct tm tm;
		gmtime_r(&now, &tm);
		int year = tm.tm_year + 1900;
		data.numerical_range.from = year - 5;
		data.numerical_range.to = year;
	} else {
		// Numerical defaults. Upstream picks these per unit; the mobile UI
		// never creates constraints, so a neutral zero range is enough and
		// avoids duplicating the unit table.
		data.numerical_range.from = 0;
		data.numerical_range.to = 0;
	}
}

filter_constraint::filter_constraint(const filter_constraint &c) :
	type(c.type),
	string_mode(c.string_mode),
	range_mode(c.range_mode),
	negate(c.negate)
{
	if (filter_constraint_is_timestamp(type))
		data.timestamp_range = c.data.timestamp_range;
	else if (filter_constraint_is_string(type))
		data.string_list = new std::vector<std::string>(*c.data.string_list);
	else if (filter_constraint_is_multiple_choice(type))
		data.multiple_choice = c.data.multiple_choice;
	else
		data.numerical_range = c.data.numerical_range;
}

filter_constraint::filter_constraint(const std::string &type_in, const std::string &string_mode_in,
				     const std::string &range_mode_in, bool negate_in, const std::string &s) :
	type(filter_constraint_type_from_string(type_in)),
	string_mode(FILTER_CONSTRAINT_STARTS_WITH),
	range_mode(FILTER_CONSTRAINT_GREATER),
	negate(negate_in)
{
	if (filter_constraint_has_string_mode(type))
		string_mode = filter_constraint_string_mode_from_string(string_mode_in);
	if (filter_constraint_has_range_mode(type))
		range_mode = filter_constraint_range_mode_from_string(range_mode_in);
	if (filter_constraint_is_timestamp(type)) {
		std::vector<std::string> l = split(s, ',');
		data.timestamp_range.from = parse_datetime(l[0].c_str());
		data.timestamp_range.to = l.size() >= 2 ? parse_datetime(l[1].c_str()) : 0;
	} else if (filter_constraint_is_string(type)) {
		// TODO: this obviously breaks if the strings contain ",".
		// That is currently not supported by the UI, but one day we might
		// have to escape the strings.
		data.string_list = new std::vector<std::string>(split(s, ','));
	} else if (filter_constraint_is_multiple_choice(type)) {
		data.multiple_choice = strtoull(s.c_str(), nullptr, 10);
	} else {
		std::vector<std::string> l = split(s, ',');
		data.numerical_range.from = atoi(l[0].c_str());
		data.numerical_range.to = l.size() >= 2 ? atoi(l[1].c_str()) : 0;
	}
}

filter_constraint &filter_constraint::operator=(const filter_constraint &c)
{
	if (filter_constraint_is_string(type))
		delete data.string_list;
	type = c.type;
	string_mode = c.string_mode;
	range_mode = c.range_mode;
	negate = c.negate;
	if (filter_constraint_is_timestamp(type))
		data.timestamp_range = c.data.timestamp_range;
	else if (filter_constraint_is_string(type))
		data.string_list = new std::vector<std::string>(*c.data.string_list);
	else if (filter_constraint_is_multiple_choice(type))
		data.multiple_choice = c.data.multiple_choice;
	else
		data.numerical_range = c.data.numerical_range;
	return *this;
}

bool filter_constraint::operator==(const filter_constraint &f2) const
{
	if (type != f2.type || string_mode != f2.string_mode || range_mode != f2.range_mode || negate != f2.negate)
		return false;
	if (filter_constraint_is_timestamp(type))
		return data.timestamp_range.from == f2.data.timestamp_range.from &&
		       data.timestamp_range.to == f2.data.timestamp_range.to;
	else if (filter_constraint_is_string(type))
		return *data.string_list == *(f2.data.string_list);
	else if (filter_constraint_is_multiple_choice(type))
		return data.multiple_choice == f2.data.multiple_choice;
	else
		return data.numerical_range.from == f2.data.numerical_range.from &&
		       data.numerical_range.to == f2.data.numerical_range.to;
}

filter_constraint::~filter_constraint()
{
	if (filter_constraint_is_string(type))
		delete data.string_list;
}

std::string filter_constraint_data_to_string(const filter_constraint &c)
{
	if (filter_constraint_is_timestamp(c.type)) {
		std::string from_s = format_datetime(c.data.timestamp_range.from);
		std::string to_s = format_datetime(c.data.timestamp_range.to);
		return from_s + ',' + to_s;
	} else if (filter_constraint_is_string(c.type)) {
		// TODO: this obviously breaks if the strings contain ",".
		return join(*c.data.string_list, ',');
	} else if (filter_constraint_is_multiple_choice(c.type)) {
		return std::to_string(c.data.multiple_choice);
	} else {
		return std::to_string(c.data.numerical_range.from) + ',' +
		       std::to_string(c.data.numerical_range.to);
	}
}
