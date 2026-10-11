// AI-generated (Claude)
// JNI facade over the pure C++ core in ../../../../cpp, the Android
// counterpart of ios/SsrfCoreBridge.mm. Called from SsrfCoreModule.kt.

#include <jni.h>

#include <android/log.h>

#include <string>

#include "bindings/api.h"
#include "ssrfcore.h"

namespace {

// Java strings are modified UTF-8 under GetStringUTFChars, which mangles
// characters outside the BMP (emoji in a dive note). Going through the UTF-16
// code units and converting here keeps the JSON exact in both directions.
std::string to_utf8(JNIEnv *env, jstring value)
{
	if (value == nullptr)
		return {};
	const jsize length = env->GetStringLength(value);
	const jchar *chars = env->GetStringChars(value, nullptr);
	std::string out;
	out.reserve(length);
	for (jsize i = 0; i < length; ++i) {
		uint32_t cp = chars[i];
		if (cp >= 0xD800 && cp <= 0xDBFF && i + 1 < length && chars[i + 1] >= 0xDC00 && chars[i + 1] <= 0xDFFF) {
			cp = 0x10000 + ((cp - 0xD800) << 10) + (chars[i + 1] - 0xDC00);
			++i;
		}
		if (cp < 0x80) {
			out += static_cast<char>(cp);
		} else if (cp < 0x800) {
			out += static_cast<char>(0xC0 | (cp >> 6));
			out += static_cast<char>(0x80 | (cp & 0x3F));
		} else if (cp < 0x10000) {
			out += static_cast<char>(0xE0 | (cp >> 12));
			out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
			out += static_cast<char>(0x80 | (cp & 0x3F));
		} else {
			out += static_cast<char>(0xF0 | (cp >> 18));
			out += static_cast<char>(0x80 | ((cp >> 12) & 0x3F));
			out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
			out += static_cast<char>(0x80 | (cp & 0x3F));
		}
	}
	env->ReleaseStringChars(value, chars);
	return out;
}

jstring from_utf8(JNIEnv *env, const std::string &value)
{
	std::u16string out;
	out.reserve(value.size());
	const auto *s = reinterpret_cast<const unsigned char *>(value.data());
	const size_t n = value.size();
	for (size_t i = 0; i < n;) {
		uint32_t cp;
		unsigned char c = s[i];
		size_t extra;
		if (c < 0x80) {
			cp = c;
			extra = 0;
		} else if ((c & 0xE0) == 0xC0) {
			cp = c & 0x1F;
			extra = 1;
		} else if ((c & 0xF0) == 0xE0) {
			cp = c & 0x0F;
			extra = 2;
		} else if ((c & 0xF8) == 0xF0) {
			cp = c & 0x07;
			extra = 3;
		} else {
			cp = 0xFFFD;
			extra = 0;
		}
		++i;
		for (size_t k = 0; k < extra; ++k, ++i) {
			if (i >= n || (s[i] & 0xC0) != 0x80) {
				cp = 0xFFFD;
				break;
			}
			cp = (cp << 6) | (s[i] & 0x3F);
		}
		if (cp >= 0x10000) {
			cp -= 0x10000;
			out += static_cast<char16_t>(0xD800 + (cp >> 10));
			out += static_cast<char16_t>(0xDC00 + (cp & 0x3FF));
		} else {
			out += static_cast<char16_t>(cp);
		}
	}
	return env->NewString(reinterpret_cast<const jchar *>(out.data()), static_cast<jsize>(out.size()));
}

} // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeCall(JNIEnv *env, jclass, jstring method, jstring argsJson)
{
	// The reply is always a JSON envelope; ssrf::call never throws.
	return from_utf8(env, ssrf::call(to_utf8(env, method), to_utf8(env, argsJson)));
}

extern "C" JNIEXPORT jint JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeAdd(JNIEnv *, jclass, jint a, jint b)
{
	return ssrf::add(a, b);
}

extern "C" JNIEXPORT jstring JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeSmokeSerializeMinimalLog(JNIEnv *env, jclass)
{
	std::string xml = ssrf::smoke_serialize_minimal_log();
	if (xml.empty())
		return nullptr;
	return from_utf8(env, xml);
}

extern "C" JNIEXPORT jint JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeSmokeCountDivesInFile(JNIEnv *env, jclass, jstring path)
{
	std::string error;
	int dives = ssrf::smoke_count_dives_in_file(to_utf8(env, path), error);
	if (dives < 0)
		__android_log_print(ANDROID_LOG_WARN, "ssrf-core", "%s", error.c_str());
	return dives;
}
