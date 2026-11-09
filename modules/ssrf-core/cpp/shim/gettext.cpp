// AI-generated (Claude)
//
// core/gettext.h's trGettext(), almost the identity.
//
// Localization is deferred: the core hands us the English source string and we
// return it unchanged. The mobile UI translates in TypeScript, where the
// strings it needs are the ones it renders itself - the core's strings only
// surface in diagnostics.
//
// One exception: the twelve short month names. The core writes them into text
// the app shows - the configurable statistics' month binners ("Mar 2024") and a
// trip's title (`monthname()` in core/time.cpp) - and the app follows the
// device's region for every date it shows. The bindings' `configure` hands over
// the region's names (set_month_names below); until then, and for an empty
// name, the English one stays.

#include "gettext.h"

#include <array>
#include <cstring>
#include <string>
#include <vector>

namespace {

const std::array<const char *, 12> english_months = {
	"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
};

std::array<std::string, 12> &local_months()
{
	static std::array<std::string, 12> names;
	return names;
}

} // namespace

void set_month_names(const std::vector<std::string> &names)
{
	auto &local = local_months();
	for (size_t i = 0; i < local.size(); ++i)
		local[i] = i < names.size() ? names[i] : std::string();
}

const char *trGettext(const char *text)
{
	if (text && std::strlen(text) == 3) {
		const auto &local = local_months();
		for (size_t i = 0; i < english_months.size(); ++i) {
			if (std::strcmp(text, english_months[i]) == 0 && !local[i].empty())
				return local[i].c_str();
		}
	}
	return text;
}
