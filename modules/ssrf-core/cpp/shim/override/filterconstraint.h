// AI-generated (Claude)
//
// Qt-free replacement for core/filterconstraint.h.
//
// Filter constraints are written into the logbook, so they are part of the file
// format and must round-trip even though the mobile app filters in TypeScript.
// Upstream's header additionally exposes a large translated-string / widget-hint
// API for the desktop filter editor; none of that is kept. The one structural
// change is `data.string_list`, which becomes a std::vector<std::string> *.
#ifndef FILTER_CONSTRAINT_H
#define FILTER_CONSTRAINT_H

#include "units.h"

#include <cstdint>
#include <string>
#include <vector>

struct dive;

enum filter_constraint_type {
	FILTER_CONSTRAINT_DATE,
	FILTER_CONSTRAINT_DATE_TIME,
	FILTER_CONSTRAINT_TIME_OF_DAY,
	FILTER_CONSTRAINT_YEAR,
	FILTER_CONSTRAINT_DAY_OF_WEEK,
	FILTER_CONSTRAINT_RATING,
	FILTER_CONSTRAINT_WAVESIZE,
	FILTER_CONSTRAINT_CURRENT,
	FILTER_CONSTRAINT_VISIBILITY,
	FILTER_CONSTRAINT_SURGE,
	FILTER_CONSTRAINT_CHILL,
	FILTER_CONSTRAINT_DEPTH,
	FILTER_CONSTRAINT_DURATION,
	FILTER_CONSTRAINT_WEIGHT,
	FILTER_CONSTRAINT_WATER_TEMP,
	FILTER_CONSTRAINT_AIR_TEMP,
	FILTER_CONSTRAINT_WATER_DENSITY,
	FILTER_CONSTRAINT_SAC,
	FILTER_CONSTRAINT_LOGGED,
	FILTER_CONSTRAINT_PLANNED,
	FILTER_CONSTRAINT_DIVE_MODE,
	FILTER_CONSTRAINT_TAGS,
	FILTER_CONSTRAINT_PEOPLE,
	FILTER_CONSTRAINT_LOCATION,
	FILTER_CONSTRAINT_WEIGHT_TYPE,
	FILTER_CONSTRAINT_CYLINDER_TYPE,
	FILTER_CONSTRAINT_CYLINDER_SIZE,
	FILTER_CONSTRAINT_CYLINDER_N2,
	FILTER_CONSTRAINT_CYLINDER_O2,
	FILTER_CONSTRAINT_CYLINDER_HE,
	FILTER_CONSTRAINT_SUIT,
	FILTER_CONSTRAINT_NOTES,
	FILTER_CONSTRAINT_DIVE_COMPUTER,
};

// For string filters
enum filter_constraint_string_mode {
	FILTER_CONSTRAINT_STARTS_WITH,
	FILTER_CONSTRAINT_SUBSTRING,
	FILTER_CONSTRAINT_EXACT
};

// For range filters
enum filter_constraint_range_mode {
	FILTER_CONSTRAINT_EQUAL,
	FILTER_CONSTRAINT_LESS,
	FILTER_CONSTRAINT_GREATER,
	FILTER_CONSTRAINT_RANGE
};

struct filter_constraint {
	enum filter_constraint_type type;
	enum filter_constraint_string_mode string_mode;
	enum filter_constraint_range_mode range_mode;
	bool negate;
	union {
		struct {
			int from; // used for equality comparison
			int to;
		} numerical_range;
		struct {
			timestamp_t from; // used for equality comparison
			timestamp_t to;
		} timestamp_range;
		std::vector<std::string> *string_list;
		uint64_t multiple_choice; // bit-field for multiple choice lists. currently, we support 64 items, extend if needed.
	} data;
	filter_constraint(filter_constraint_type type);
	filter_constraint(const std::string &type, const std::string &string_mode,
			  const std::string &range_mode, bool negate, const std::string &data); // from parser data
	filter_constraint(const filter_constraint &);
	filter_constraint &operator=(const filter_constraint &);
	~filter_constraint();
	bool operator==(const filter_constraint &f2) const;
};

// Tokens as written to the logbook - never translated, never containing spaces.
extern const char *filter_constraint_type_to_string(enum filter_constraint_type);
extern const char *filter_constraint_string_mode_to_string(enum filter_constraint_string_mode);
extern const char *filter_constraint_range_mode_to_string(enum filter_constraint_range_mode);
extern std::string filter_constraint_data_to_string(const filter_constraint &c);

extern bool filter_constraint_is_string(enum filter_constraint_type type);
extern bool filter_constraint_is_timestamp(enum filter_constraint_type type);
extern bool filter_constraint_is_star(enum filter_constraint_type type);
extern bool filter_constraint_has_string_mode(enum filter_constraint_type);
extern bool filter_constraint_has_range_mode(enum filter_constraint_type);
extern bool filter_constraint_has_date_widget(enum filter_constraint_type);
extern bool filter_constraint_has_time_widget(enum filter_constraint_type);
extern bool filter_constraint_is_valid(const struct filter_constraint *constraint);

#endif
