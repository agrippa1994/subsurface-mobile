// AI-generated (Claude)
#pragma once

#include <stdexcept>
#include <string>

namespace ssrf {

// What a method throws to answer { ok: false, error: <what> }.
struct api_error : public std::runtime_error {
	explicit api_error(const std::string &message) : std::runtime_error(message) {}
};

} // namespace ssrf
