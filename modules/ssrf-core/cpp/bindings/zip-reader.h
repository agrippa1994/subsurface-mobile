// AI-generated (Claude)
// Minimal read-only ZIP reader for the zipped import formats (.sde, .dld).
//
// Upstream reads those through libzip (core/file.cpp). libzip ships with
// neither the macOS nor the iOS SDK, and the only thing the import path asks of
// it is "give me the bytes of every entry" - so the container is decoded here
// over zlib (which both SDKs do ship) instead of cross-compiling another
// dependency. The dive data itself still goes through the core's parser: this
// file knows about ZIP, not about diving.
#pragma once

#include <string>
#include <vector>

namespace ssrf {

struct zip_entry {
	std::string name;
	std::string contents;
};

/** True if `bytes` starts with a local file header or an empty-archive EOCD. */
bool looks_like_zip(const std::string &bytes);

/**
 * Decodes every stored/deflated file entry of `bytes`. Throws
 * std::runtime_error if the archive is malformed or uses a compression method
 * other than store (0) and deflate (8). Directory entries are skipped.
 */
std::vector<zip_entry> zip_read_all(const std::string &bytes);

} // namespace ssrf
