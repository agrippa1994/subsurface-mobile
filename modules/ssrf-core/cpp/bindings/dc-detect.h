// AI-generated (Claude)
#pragma once

#include <libdivecomputer/descriptor.h>

#include <cstdint>
#include <optional>
#include <string>

namespace ssrf {

struct dc_identity {
	std::string vendor;
	std::string product;
};

// Which dive computer a Bluetooth name belongs to, if it looks like one at all.
// Only answers with a product that can actually be reached over BLE.
std::optional<dc_identity> detect_dive_computer(const std::string &bt_name);

// A pointer into libdivecomputer's static table, or null.
const dc_descriptor_t *find_descriptor(const std::string &vendor, const std::string &product);

} // namespace ssrf
