// AI-generated (Claude)
#include "suunto-xml.h"

#include "base64.h"

#include "core/dive.h"
#include "core/divecomputer.h"
#include "core/divelist.h"
#include "core/divelog.h"
#include "core/sample.h"
#include "core/units.h"

#include <libxml/parser.h>
#include <libxml/tree.h>

#include <cstdint>
#include <cstring>

namespace ssrf {

namespace {

const char SUUNTO_NAMESPACE[] = "schemas.datacontract.org/2004/07/Suunto.Diving.Dal";

struct doc_deleter {
	void operator()(xmlDoc *doc) const { xmlFreeDoc(doc); }
};
using doc_ptr = std::unique_ptr<xmlDoc, doc_deleter>;

bool is_suunto_dive_document(xmlNode *root)
{
	if (!root || !root->name || strcasecmp(reinterpret_cast<const char *>(root->name), "Dive") != 0)
		return false;
	for (xmlNs *ns = root->nsDef; ns; ns = ns->next) {
		if (ns->href && strstr(reinterpret_cast<const char *>(ns->href), SUUNTO_NAMESPACE))
			return true;
	}
	return false;
}

std::string child_text(xmlNode *root, const char *name)
{
	for (xmlNode *node = root->children; node; node = node->next) {
		if (node->type != XML_ELEMENT_NODE || !node->name)
			continue;
		if (strcasecmp(reinterpret_cast<const char *>(node->name), name) != 0)
			continue;
		xmlChar *text = xmlNodeGetContent(node);
		std::string out = text ? reinterpret_cast<const char *>(text) : "";
		xmlFree(text);
		return out;
	}
	return std::string();
}

// The blobs are little-endian arrays written by a PC application; decode the
// bytes explicitly rather than casting, so the layout does not depend on the
// host (upstream casts, because sqlite hands it the bytes on the same machine
// that wrote them).
float float_at(const std::string &blob, size_t index)
{
	uint32_t bits = static_cast<uint8_t>(blob[index * 4]) |
			(static_cast<uint32_t>(static_cast<uint8_t>(blob[index * 4 + 1])) << 8) |
			(static_cast<uint32_t>(static_cast<uint8_t>(blob[index * 4 + 2])) << 16) |
			(static_cast<uint32_t>(static_cast<uint8_t>(blob[index * 4 + 3])) << 24);
	float value;
	memcpy(&value, &bits, sizeof(value));
	return value;
}

int32_t int32_at(const std::string &blob, size_t index)
{
	return static_cast<int32_t>(static_cast<uint8_t>(blob[index * 4]) |
				    (static_cast<uint32_t>(static_cast<uint8_t>(blob[index * 4 + 1])) << 8) |
				    (static_cast<uint32_t>(static_cast<uint8_t>(blob[index * 4 + 2])) << 16) |
				    (static_cast<uint32_t>(static_cast<uint8_t>(blob[index * 4 + 3])) << 24));
}

} // namespace

int decode_suunto_dm4_profile(const std::string &xml, struct divelog &log, size_t first_new)
{
	doc_ptr doc(xmlReadMemory(xml.c_str(), static_cast<int>(xml.size()), "suunto.xml", NULL, XML_PARSE_HUGE));
	if (!doc)
		return 0;
	xmlNode *root = xmlDocGetRootElement(doc.get());
	if (!is_suunto_dive_document(root))
		return 0;

	int interval = atoi(child_text(root, "SampleInterval").c_str());
	if (interval <= 0)
		return 0;

	std::string depths = base64_decode(child_text(root, "ProfileBlob"));
	std::string temperatures = base64_decode(child_text(root, "TemperatureBlob"));
	std::string pressures = base64_decode(child_text(root, "PressureBlob"));
	if (depths.empty())
		return 0;

	int decoded = 0;
	for (size_t i = first_new; i < log.dives.size(); i++) {
		struct dive &d = *log.dives[i];
		if (d.dcs.empty())
			continue;
		struct divecomputer &dc = d.dcs[0];

		// Whatever is in there now is the fake profile fixup_dive_dc()
		// generates for a sample-less dive - the real one is in the blobs.
		dc.samples.clear();

		int duration = d.duration.seconds ? d.duration.seconds : dc.duration.seconds;
		for (size_t n = 0; static_cast<int>(n) * interval < duration; n++) {
			if ((n + 1) * 4 > depths.size())
				break;
			struct sample s;
			s.time.seconds = static_cast<int>(n) * interval;
			s.depth.mm = lrintf(float_at(depths, n) * 1000.0f);
			if ((n + 1) <= temperatures.size())
				s.temperature.mkelvin = C_to_mkelvin(static_cast<uint8_t>(temperatures[n]));
			if ((n + 1) * 4 <= pressures.size())
				add_sample_pressure(&s, 0, int32_at(pressures, n));
			append_sample(s, &dc);
		}

		// Re-run the core's post-processing now that the dive has a profile:
		// mean depth, duration and the per-sample derived values all came off
		// the fabricated one.
		d.fixup_dive();
		decoded++;
	}
	return decoded;
}

} // namespace ssrf
