// AI-generated (Claude)
#include "ssrfcore.h"

#include <cstdio>

namespace ssrf {

int add(int a, int b)
{
	// Temporary proof that the call really lands in C++ (task 02 acceptance
	// criteria). Remove once the real API lands in task 05.
	// stderr, not stdout: stdout is fully buffered in an app process, so the
	// line would never reach the device console.
	std::fprintf(stderr, "[ssrf-core] C++ add(%d, %d)\n", a, b);
	return a + b;
}

} // namespace ssrf
