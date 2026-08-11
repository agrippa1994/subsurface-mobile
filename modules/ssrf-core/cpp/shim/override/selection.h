// AI-generated (Claude)
//
// Qt-free replacement for core/selection.h.
//
// Selection is a UI concept and lives in TypeScript here, but the core still
// tracks a "current dive" and adjusts it when dives are added or removed, so
// the handful of entry points divelist.cpp and divelog.cpp call must exist.
// `shim/selection.cpp` keeps just enough state for those calls to be coherent;
// upstream's Qt signalling and the multi-dive selection API are dropped.
#ifndef SELECTION_H
#define SELECTION_H

#include <vector>

struct dive;
struct dive_trip;

extern int amount_selected;
extern struct dive *current_dive;

extern void select_single_dive(struct dive *d); // NULL clears the selection
extern void select_newest_visible_dive();
extern void clear_selection();

// Currently selected dives - at most the current dive in this build.
std::vector<dive *> getDiveSelection();

#endif // SELECTION_H
