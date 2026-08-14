// AI-generated (Claude)
// Sample decoding for Suunto DM4 XML dive exports.
//
// Why this exists: a DM4 XML export carries its profile as three base64 blobs
// (ProfileBlob / TemperatureBlob / PressureBlob). `xslt/SuuntoDM4.xslt` copies
// them into a <blob> element, but no core parser reads that element - the blob
// decoding upstream has (core/import-suunto.cpp, dm4_dive) only runs on the
// *sqlite* DM4 database, where the same three columns arrive already unpacked
// by sqlite. So an XML export parses to a dive with metadata but no profile,
// and dive::fixup_dive() then fabricates one from max depth and duration.
//
// The unpacking is the only thing missing, and it is four lines of layout
// knowledge (float32 metres, uint8 celsius, int32 mbar, one entry per
// SampleInterval seconds) taken from dm4_dive(). Everything else - the dive,
// its cylinders, its events - still comes out of the core's parser.
#pragma once

#include <string>

struct divelog;

namespace ssrf {

/**
 * If `xml` is a Suunto DM4 dive export, replaces the profile of every dive from
 * index `first_new` on with the samples decoded from its blobs. Does nothing
 * for any other document. Returns the number of dives whose profile was
 * decoded.
 */
int decode_suunto_dm4_profile(const std::string &xml, struct divelog &log, size_t first_new);

} // namespace ssrf
