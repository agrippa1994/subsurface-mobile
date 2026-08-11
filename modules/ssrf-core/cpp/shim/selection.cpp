// AI-generated (Claude)
//
// Minimal current-dive tracking. See cpp/shim/override/selection.h.

#include "selection.h"

#include "dive.h"
#include "divelist.h"
#include "divelog.h"

int amount_selected = 0;
struct dive *current_dive = nullptr;

void select_single_dive(struct dive *d)
{
	if (current_dive)
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
	if (!current_dive)
		return {};
	return { current_dive };
}
