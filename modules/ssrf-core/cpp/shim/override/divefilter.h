// AI-generated (Claude)
//
// Qt-free replacement for core/divefilter.h.
//
// Upstream also declares the DiveFilter singleton that drives the desktop dive
// list. Filtering lives in TypeScript here, so only FilterData survives - it is
// the payload of a filter preset, and filter presets are part of the SSRF file
// format, so they must round-trip.
#ifndef DIVEFILTER_H
#define DIVEFILTER_H

#include "filterconstraint.h"
#include "fulltext.h"

#include <vector>

struct dive;
struct dive_trip;
struct dive_site;

struct FilterData {
	// The mode ids are chosen such that they can be directly converted from / to combobox indices.
	enum class Mode {
		ALL_OF = 0,
		ANY_OF = 1,
		NONE_OF = 2
	};

	FullTextQuery fullText;
	StringFilterMode fulltextStringMode = StringFilterMode::STARTSWITH;
	std::vector<filter_constraint> constraints;
	bool validFilter() const;
	bool operator==(const FilterData &) const;
};

#endif
