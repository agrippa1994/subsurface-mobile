// AI-generated (Claude)
//
// No-op full text index plus a plain-text FullTextQuery. See
// cpp/shim/override/fulltext.h for why these exist at all.

#include "fulltext.h"

#include <cctype>

void fulltext_register(struct dive *)
{
}

void fulltext_unregister(struct dive *)
{
}

void fulltext_unregister_all()
{
}

void fulltext_populate()
{
}

FullTextQuery &FullTextQuery::operator=(const std::string &s)
{
	originalQuery = s;
	words.clear();

	// Upstream's tokenizer is Qt's Unicode-aware simplification/case folding.
	// Nothing in the mobile build searches, so this only has to preserve the
	// query for the round trip; splitting on whitespace keeps `doit()`
	// meaningful without pulling in an ICU-grade tokenizer.
	size_t start = 0;
	while (start < s.size()) {
		while (start < s.size() && isspace((unsigned char)s[start]))
			start++;
		size_t end = start;
		while (end < s.size() && !isspace((unsigned char)s[end]))
			end++;
		if (end > start)
			words.push_back(s.substr(start, end - start));
		start = end;
	}
	return *this;
}

bool FullTextQuery::doit() const
{
	return !words.empty();
}
