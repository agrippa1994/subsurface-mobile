// AI-generated (Claude)
//
// Vendor and product from a Bluetooth name. The tables and their order are
// upstream's (core/btdiscovery.cpp, getDeviceType), which keeps them next to Qt
// code. Upstream cannot use libdivecomputer's own filters for this; here they
// are the fallback, which covers what the tables do not list (Deep Six, Divesoft,
// Seac, Halcyon).
#include "dc-detect.h"

#include <libdivecomputer/descriptor.h>
#include <libdivecomputer/iterator.h>

#include <cctype>
#include <cstring>
#include <map>
#include <regex>

namespace ssrf {

namespace {

struct model_pattern {
	uint16_t model;
	const char *vendor;
	const char *product;
};
const model_pattern model[] = {
	{ 0x4552, "Oceanic", "Pro Plus X" },
	{ 0x455A, "Aqualung", "i750TC" },
	{ 0x4647, "Sherwood", "Sage" },
	{ 0x4648, "Aqualung", "i300C" },
	{ 0x4649, "Aqualung", "i200C" },
	{ 0x4749, "Aqualung", "i200Cv2" },
	{ 0x4651, "Aqualung", "i770R" },
	{ 0x4652, "Aqualung", "i550C" },
	{ 0x4653, "Oceanic", "Geo 4.0" },
	{ 0x4654, "Oceanic", "Veo 4.0" },
	{ 0x4655, "Sherwood", "Wisdom 4" },
	{ 0x4656, "Oceanic", "Pro Plus 4" },
	{ 0x4741, "Apeks", "DSX" },
	{ 0x4742, "Sherwood", "Beacon" },
	{ 0x4743, "Aqualung", "i470TC" },
	{ 0x4744, "Aqualung", "i330R" },
	{ 0x474B, "Oceanic", "Geo Air" },
	{ 0x474D, "Oceanic", "Geo i330R Console" },
};

struct name_pattern {
	const char *prefix;
	const char *vendor;
	const char *product;
};
// Prefix search in this order, so a more specific name comes first.
const name_pattern name[] = {
	// Shearwater dive computers
	{ "Predator", "Shearwater", "Predator" },
	{ "Perdix 3", "Shearwater", "Perdix 3"},
	{ "Perdix 2", "Shearwater", "Perdix 2"},
	{ "Petrel 3", "Shearwater", "Petrel 3"},
	// both the Petrel and Petrel 2 identify as "Petrel" as BT/BLE device
	// but only the Petrel 2 is listed as available dive computer on iOS (which requires BLE support)
	// so always pick the "Petrel 2" as product when seeing a Petrel
	{ "Petrel", "Shearwater", "Petrel 2" },
	{ "Perdix", "Shearwater", "Perdix" },
	{ "Teric", "Shearwater", "Teric" },
	{ "Peregrine", "Shearwater", "Peregrine" },
	{ "NERD 2", "Shearwater", "NERD 2" },
	{ "NERD", "Shearwater", "NERD" }, // order is important, test for the more specific one first
	{ "Predator", "Shearwater", "Predator" },
	{ "Tern", "Shearwater", "Tern" },
	// Suunto dive computers
	{ "EON Steel", "Suunto", "EON Steel" },
	{ "EON Core", "Suunto", "EON Core" },
	{ "Suunto D5", "Suunto", "D5" },
	// Scubapro dive computers
	{ "G2", "Scubapro", "G2" },
	{ "HUD", "Scubapro", "G2 HUD" },
	{ "G3", "Scubapro", "G3" },
	{ "Aladin", "Scubapro", "Aladin Sport Matrix" },
	{ "A1", "Scubapro", "Aladin A1" },
	{ "A2", "Scubapro", "Aladin A2" },
	{ "Luna 2.0 AI", "Scubapro", "Luna 2.0 AI" },
	{ "Luna 2.0", "Scubapro", "Luna 2.0" },
	// Mares dive computers
	{ "Mares Genius", "Mares", "Genius" },
	{ "Sirius", "Mares", "Sirius" },
	{ "Quad Ci", "Mares", "Quad Ci" },
	{ "Quad", "Mares", "Quad" },
	{ "Mares", "Mares", "Quad" }, // we actually don't know and just pick a common one - user needs to fix in UI
	{ "Puck4", "Mares", "Puck 4"},
	{ "Puck Lite", "Mares", "Puck Lite"},
	{ "Puck Pro U", "Mares", "Puck Pro Ultra"},
	{ "Puck", "Mares", "Puck Pro EZ"},
	// Cress dive computers
	{ "CARESIO_", "Cressi", "Cartesio" },
	{ "GOA_", "Cressi", "Goa" },
	// Deepblu dive computesr
	{ "COSMIQ", "Deepblu", "Cosmiq+" },
	// Oceans dive computers
	{ "S1", "Oceans", "S1" },
	// McLean dive computers
	{ "McLean Extreme", "McLean", "Extreme" },
	// Tecdiving dive computers
	{ "DiveComputer", "Tecdiving", "DiveComputer.eu" }
};

const std::map<int, const char *> cressi_model_to_product{
	{ 1, "Cartesio"},
	{ 2, "Goa"},
	{ 3, "Leonardo 2.0"},
	{ 4, "Donatello"},
	{ 5, "Michelangelo"},
	{ 6, "Raffaello"},
	{ 9, "Neon"},
	{10, "Nepto"}
};

bool starts_with(const std::string &s, const char *prefix)
{
	return s.rfind(prefix, 0) == 0;
}

std::optional<dc_identity> from_tables(const std::string &bt_name)
{
	if (starts_with(bt_name, "OSTC")) {
		const std::string rest = bt_name.substr(4);
		const char *product = "OSTC 2"; // all BT/BLE OSTCs are the same family
		if (starts_with(rest, "3"))
			product = "OSTC Plus";
		else if (starts_with(rest, "s#") || starts_with(rest, "s "))
			product = "OSTC Sport";
		else if (starts_with(rest, "4-"))
			product = "OSTC 4";
		else if (starts_with(rest, "5-"))
			product = "OSTC 5";
		else if (starts_with(rest, "2-"))
			product = "OSTC 2N";
		else if (starts_with(rest, "+ "))
			product = "OSTC 2";
		return dc_identity { "Heinrichs Weikamp", product };
	}
	static const std::regex ratio("^(DS|IX5M|RATIO-)\\d{6}");
	if (std::regex_search(bt_name, ratio))
		return dc_identity { "Ratio", "iX3M 2021 GPS Easy" }; // the name does not tell, this one has BLE
	// Pelagic: a two-letter model code, the hex of the model number, and a serial.
	static const std::regex pelagic("^[A-Z]{2}\\d{6}$");
	if (std::regex_search(bt_name, pelagic)) {
		const uint16_t code = static_cast<uint16_t>((bt_name[0] << 8) | bt_name[1]);
		for (const model_pattern &m : model) {
			if (m.model == code)
				return dc_identity { m.vendor, m.product };
		}
		return std::nullopt;
	}
	static const std::regex cressi("^([1-9][0-9]?)_[0-9a-f]{4}$");
	std::smatch match;
	if (std::regex_match(bt_name, match, cressi)) {
		const auto product = cressi_model_to_product.find(std::stoi(match[1]));
		if (product != cressi_model_to_product.end())
			return dc_identity { "Cressi", product->second };
		return std::nullopt;
	}
	for (const name_pattern &n : name) {
		if (starts_with(bt_name, n.prefix))
			return dc_identity { n.vendor, n.product };
	}
	return std::nullopt;
}

} // namespace

const dc_descriptor_t *find_descriptor(const std::string &vendor, const std::string &product)
{
	dc_iterator_t *iterator = nullptr;
	dc_descriptor_t *descriptor = nullptr;
	const dc_descriptor_t *found = nullptr;
	dc_descriptor_iterator(&iterator);
	while (!found && dc_iterator_next(iterator, &descriptor) == DC_STATUS_SUCCESS) {
		if (vendor == dc_descriptor_get_vendor(descriptor) && product == dc_descriptor_get_product(descriptor))
			found = descriptor;
	}
	dc_iterator_free(iterator);
	return found;
}

std::optional<dc_identity> detect_dive_computer(const std::string &bt_name)
{
	if (bt_name.empty())
		return std::nullopt;

	if (const auto identity = from_tables(bt_name)) {
		const dc_descriptor_t *descriptor = find_descriptor(identity->vendor, identity->product);
		if (descriptor && (dc_descriptor_get_transports(descriptor) & DC_TRANSPORT_BLE))
			return identity;
	}

	// dc_descriptor_filter() passes everything for a family without a filter, so
	// a match only counts if a made-up name does not match as well.
	dc_iterator_t *iterator = nullptr;
	dc_descriptor_t *descriptor = nullptr;
	std::optional<dc_identity> found;
	dc_descriptor_iterator(&iterator);
	while (!found && dc_iterator_next(iterator, &descriptor) == DC_STATUS_SUCCESS) {
		if (!(dc_descriptor_get_transports(descriptor) & DC_TRANSPORT_BLE))
			continue;
		if (dc_descriptor_filter(descriptor, DC_TRANSPORT_BLE, bt_name.c_str()) &&
		    !dc_descriptor_filter(descriptor, DC_TRANSPORT_BLE, "\x01not-a-dive-computer"))
			found = dc_identity { dc_descriptor_get_vendor(descriptor), dc_descriptor_get_product(descriptor) };
	}
	dc_iterator_free(iterator);
	return found;
}

} // namespace ssrf
