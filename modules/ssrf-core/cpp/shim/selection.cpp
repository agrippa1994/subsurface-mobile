// AI-generated (Claude)
//
// Minimal current-dive tracking. See cpp/shim/override/selection.h.

#include "selection.h"

#include "dive.h"
#include "divelist.h"
#include "divelog.h"

int amount_selected = 0;
struct dive *current_dive = nullptr;

// `current_dive` is a raw pointer into a divelog that owns its dives through
// unique_ptrs, so anything that empties the log leaves it dangling - and
// `divelog::clear()` is called on every load, right before the new file is
// parsed. Upstream keeps the pointer in step through the UI's undo/selection
// machinery, which this build does not have. Rather than hooking every path
// that can free a dive, confirm the dive is still in the log before touching
// it; the logs are small and this runs once per load.
static bool still_in_log(const struct dive *d)
{
	if (!d)
		return false;
	for (const auto &entry : divelog.dives) {
		if (entry.get() == d)
			return true;
	}
	return false;
}

void select_single_dive(struct dive *d)
{
	if (still_in_log(current_dive))
		current_dive->selected = false;
	current_dive = d;
	if (d)
		d->selected = true;
	amount_selected = d ? 1 : 0;
}

// Select the newest dive that is visible - same traversal as upstream, minus
// the signal it emits afterwards.
void select_newest_visible_dive()
{
	for (auto it = divelog.dives.rbegin(); it != divelog.dives.rend(); ++it) {
		if (!(*it)->hidden_by_filter)
			return select_single_dive(it->get());
	}

	// No visible dive -> deselect all
	select_single_dive(nullptr);
}

void clear_selection()
{
	select_single_dive(nullptr);
}

std::vector<dive *> getDiveSelection()
{
	if (!still_in_log(current_dive))
		return {};
	return { current_dive };
}
