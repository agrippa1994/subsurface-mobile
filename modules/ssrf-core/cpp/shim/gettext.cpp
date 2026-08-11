// AI-generated (Claude)
//
// Identity pass-through for core/gettext.h's trGettext().
//
// Localization is deferred: the core hands us the English source string and we
// return it unchanged. The mobile UI translates in TypeScript, where the
// strings it needs are the ones it renders itself - the core's strings only
// surface in diagnostics.

#include "gettext.h"

const char *trGettext(const char *text)
{
	return text;
}
