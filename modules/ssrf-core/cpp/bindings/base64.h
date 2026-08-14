// AI-generated (Claude)
// Base64 decoding, used both for the JSI boundary (buffers cross as base64
// inside the JSON argument object) and for the sample blobs of a Suunto DM4
// XML export.
#pragma once

#include <string>

namespace ssrf {

/** Decodes standard base64, ignoring whitespace. Throws on an invalid byte. */
std::string base64_decode(const std::string &in);

} // namespace ssrf
