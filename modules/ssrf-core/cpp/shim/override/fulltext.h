// AI-generated (Claude)
//
// Qt-free replacement for core/fulltext.h.
//
// Upstream keeps a QString word cache per dive so the desktop dive list can be
// filtered as you type. The mobile app filters in TypeScript over the dive list
// it already holds, so the cache is never populated here - but `dive` embeds a
// `full_text_cache`, divelist.cpp registers/unregisters dives, and a filter
// preset read from an SSRF file carries a fulltext query that must survive a
// round trip. The types therefore stay; `shim/fulltext.cpp` makes the indexing
// entry points no-ops and keeps the query as plain text.
#ifndef FULLTEXT_H
#define FULLTEXT_H

#include <string>
#include <vector>

struct dive;

void fulltext_register(struct dive *d);   // Note: can be called repeatedly
void fulltext_unregister(struct dive *d); // Note: can be called repeatedly
void fulltext_unregister_all();
void fulltext_populate();

enum class StringFilterMode {
	SUBSTRING = 0,
	STARTSWITH = 1,
	EXACT = 2
};

// Caches each dive's words so a dive can be removed from the index again.
// Never filled in the mobile build.
struct full_text_cache {
	std::vector<std::string> words;
};

// A fulltext query: the words we search for, plus the query as the user typed
// it (that is what gets written back to the log).
struct FullTextQuery {
	std::vector<std::string> words;
	std::string originalQuery;
	FullTextQuery &operator=(const std::string &); // Initialize from a user-provided search string
	bool doit() const;                             // true if we should do a fulltext search
};

#endif
