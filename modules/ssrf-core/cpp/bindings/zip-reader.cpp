// AI-generated (Claude)
#include "zip-reader.h"

#include <zlib.h>

#include <cstdint>
#include <cstring>
#include <stdexcept>

namespace ssrf {

namespace {

const uint32_t SIG_LOCAL = 0x04034b50;
const uint32_t SIG_CENTRAL = 0x02014b50;
const uint32_t SIG_EOCD = 0x06054b50;

const uint16_t METHOD_STORE = 0;
const uint16_t METHOD_DEFLATE = 8;

[[noreturn]] void bad(const std::string &what)
{
	throw std::runtime_error("malformed zip archive: " + what);
}

uint16_t read16(const std::string &b, size_t at)
{
	if (at + 2 > b.size())
		bad("truncated");
	return static_cast<uint16_t>(static_cast<unsigned char>(b[at]) |
				     (static_cast<unsigned char>(b[at + 1]) << 8));
}

uint32_t read32(const std::string &b, size_t at)
{
	if (at + 4 > b.size())
		bad("truncated");
	return static_cast<uint32_t>(static_cast<unsigned char>(b[at])) |
	       (static_cast<uint32_t>(static_cast<unsigned char>(b[at + 1])) << 8) |
	       (static_cast<uint32_t>(static_cast<unsigned char>(b[at + 2])) << 16) |
	       (static_cast<uint32_t>(static_cast<unsigned char>(b[at + 3])) << 24);
}

// The end-of-central-directory record sits at the very end of the file unless
// the archive carries a comment, so it is found by scanning backwards over the
// 64 KiB a comment length can address.
size_t find_eocd(const std::string &b)
{
	if (b.size() < 22)
		bad("shorter than an end-of-central-directory record");
	size_t limit = b.size() < 22 + 0xffff ? 0 : b.size() - (22 + 0xffff);
	for (size_t at = b.size() - 22 + 1; at-- > limit;) {
		if (read32(b, at) == SIG_EOCD)
			return at;
	}
	bad("no end-of-central-directory record");
}

// Raw deflate: the entry payload has no zlib header, hence the negative window.
std::string inflate_raw(const std::string &in, size_t at, size_t compressed, size_t expanded)
{
	std::string out;
	out.resize(expanded);
	if (expanded == 0)
		return out;

	z_stream zs{};
	if (inflateInit2(&zs, -MAX_WBITS) != Z_OK)
		bad("cannot initialize the decompressor");
	zs.next_in = const_cast<Bytef *>(reinterpret_cast<const Bytef *>(in.data() + at));
	zs.avail_in = static_cast<uInt>(compressed);
	zs.next_out = reinterpret_cast<Bytef *>(out.data());
	zs.avail_out = static_cast<uInt>(expanded);

	int rc = inflate(&zs, Z_FINISH);
	inflateEnd(&zs);
	if (rc != Z_STREAM_END || zs.total_out != expanded)
		bad("entry does not decompress to its declared size");
	return out;
}

} // namespace

bool looks_like_zip(const std::string &bytes)
{
	if (bytes.size() < 4)
		return false;
	uint32_t sig = read32(bytes, 0);
	return sig == SIG_LOCAL || sig == SIG_EOCD;
}

std::vector<zip_entry> zip_read_all(const std::string &bytes)
{
	size_t eocd = find_eocd(bytes);
	uint16_t count = read16(bytes, eocd + 10);
	size_t central = read32(bytes, eocd + 16);

	std::vector<zip_entry> entries;
	size_t at = central;
	for (uint16_t i = 0; i < count; i++) {
		if (read32(bytes, at) != SIG_CENTRAL)
			bad("central directory entry " + std::to_string(i) + " has no signature");
		uint16_t method = read16(bytes, at + 10);
		size_t compressed = read32(bytes, at + 20);
		size_t expanded = read32(bytes, at + 24);
		uint16_t name_len = read16(bytes, at + 28);
		uint16_t extra_len = read16(bytes, at + 30);
		uint16_t comment_len = read16(bytes, at + 32);
		size_t local = read32(bytes, at + 42);
		if (at + 46 + name_len > bytes.size())
			bad("central directory entry name is truncated");
		std::string name = bytes.substr(at + 46, name_len);
		at += 46 + name_len + extra_len + comment_len;

		// A directory is an entry whose name ends in '/'; it carries no data.
		if (!name.empty() && name.back() == '/')
			continue;

		if (read32(bytes, local) != SIG_LOCAL)
			bad("entry '" + name + "' has no local header");
		// The local header repeats the name and may carry a *different* extra
		// field than the central directory, so its own lengths decide where the
		// payload starts.
		size_t payload = local + 30 + read16(bytes, local + 26) + read16(bytes, local + 28);
		if (payload + compressed > bytes.size())
			bad("entry '" + name + "' runs past the end of the archive");

		if (method == METHOD_STORE) {
			if (compressed != expanded)
				bad("stored entry '" + name + "' has mismatched sizes");
			entries.push_back({ name, bytes.substr(payload, compressed) });
		} else if (method == METHOD_DEFLATE) {
			entries.push_back({ name, inflate_raw(bytes, payload, compressed, expanded) });
		} else {
			throw std::runtime_error("unsupported compression method " +
						 std::to_string(method) + " in zip entry '" + name + "'");
		}
	}
	return entries;
}

} // namespace ssrf
