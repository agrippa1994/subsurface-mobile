// AI-generated (Claude)
//
// calculate_string_hash() lives in core/libdivecomputer.cpp, which is the
// download-from-dive-computer path (libdivecomputer devices, BLE, serial) and
// is explicitly out of scope. Only this one function from that file is needed:
// parse-xml and device.cpp derive dive ids from strings with it, so the exact
// same hash is required for round-trip parity. The body is upstream's.

#include "divecomputer.h"
#include "sha1.h"

#include <cstring>

uint32_t calculate_string_hash(const char *str)
{
	// Upstream routes this through calculate_diveid(), which is SHA1_uint32()
	// over the bytes plus a zero-length guard.
	if (!str || !*str)
		return 0;
	return SHA1_uint32((const unsigned char *)str, strlen(str));
}
