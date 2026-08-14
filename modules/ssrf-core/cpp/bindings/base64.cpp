// AI-generated (Claude)
#include "base64.h"

#include <cctype>
#include <stdexcept>

namespace ssrf {

std::string base64_decode(const std::string &in)
{
	static const std::string alphabet =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	std::string out;
	out.reserve(in.size() * 3 / 4);
	int val = 0;
	int bits = -8;
	for (unsigned char c : in) {
		if (c == '=' || std::isspace(c))
			continue;
		size_t pos = alphabet.find(static_cast<char>(c));
		if (pos == std::string::npos)
			throw std::runtime_error("invalid base64 input");
		val = (val << 6) + static_cast<int>(pos);
		bits += 6;
		if (bits >= 0) {
			out.push_back(static_cast<char>((val >> bits) & 0xff));
			bits -= 8;
		}
	}
	return out;
}

} // namespace ssrf
