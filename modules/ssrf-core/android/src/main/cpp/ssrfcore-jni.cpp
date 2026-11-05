// AI-generated (Claude)
// JNI facade over the pure C++ core in ../../../../cpp, the Android
// counterpart of ios/SsrfCoreBridge.mm. Called from SsrfCoreModule.kt.

#include <jni.h>

#include <android/log.h>

#include <sstream>
#include <string>
#include <vector>

#include "bindings/api.h"
#include "bindings/download.h"
#include "bindings/gatt-driver.h"
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

// --- Threads the core started -----------------------------------------------
//
// The download thread and the driver's callbacks both come through here. A thread
// the JVM does not know is attached on its first call, and detached when it ends.

JavaVM *g_vm = nullptr;
jclass g_module_class = nullptr;
jmethodID g_on_core_event = nullptr;

struct AttachedThread {
	JNIEnv *env = nullptr;
	bool attached_here = false;

	~AttachedThread()
	{
		if (attached_here)
			g_vm->DetachCurrentThread();
	}
};

JNIEnv *current_env()
{
	thread_local AttachedThread thread;
	if (!thread.env) {
		if (g_vm->GetEnv(reinterpret_cast<void **>(&thread.env), JNI_VERSION_1_6) != JNI_OK) {
			g_vm->AttachCurrentThread(&thread.env, nullptr);
			thread.attached_here = true;
		}
	}
	return thread.env;
}

void forward_event(const std::string &json)
{
	JNIEnv *env = current_env();
	jstring text = from_utf8(env, json);
	env->CallStaticVoidMethod(g_module_class, g_on_core_event, text);
	env->DeleteLocalRef(text);
}

std::vector<uint8_t> to_bytes(JNIEnv *env, jbyteArray array)
{
	const jsize length = env->GetArrayLength(array);
	std::vector<uint8_t> out(length);
	if (length)
		env->GetByteArrayRegion(array, 0, length, reinterpret_cast<jbyte *>(out.data()));
	return out;
}

// The ssrf::ble::GattDriver contract over SsrfGattDriver.kt.
class AndroidGattDriver : public ssrf::ble::GattDriver {
public:
	AndroidGattDriver(JNIEnv *env, jobject driver) : object(env->NewGlobalRef(driver))
	{
		jclass cls = env->GetObjectClass(driver);
		m_start_scan = env->GetMethodID(cls, "startScan", "([Ljava/lang/String;)V");
		m_stop_scan = env->GetMethodID(cls, "stopScan", "()V");
		m_connect = env->GetMethodID(cls, "connect", "(Ljava/lang/String;)V");
		m_discover = env->GetMethodID(cls, "discover", "()V");
		m_enable_notify = env->GetMethodID(cls, "enableNotify", "(Ljava/lang/String;Ljava/lang/String;)V");
		m_write = env->GetMethodID(cls, "write", "(Ljava/lang/String;Ljava/lang/String;[BZ)V");
		m_read = env->GetMethodID(cls, "read", "(Ljava/lang/String;Ljava/lang/String;)V");
		m_disconnect = env->GetMethodID(cls, "disconnect", "()V");
		string_class = static_cast<jclass>(env->NewGlobalRef(env->FindClass("java/lang/String")));
	}

	void start_scan(const std::vector<std::string> &known_ids, const std::vector<std::string> &) override
	{
		JNIEnv *env = current_env();
		jobjectArray known = env->NewObjectArray(static_cast<jsize>(known_ids.size()), string_class, nullptr);
		for (size_t i = 0; i < known_ids.size(); i++) {
			jstring id = from_utf8(env, known_ids[i]);
			env->SetObjectArrayElement(known, static_cast<jsize>(i), id);
			env->DeleteLocalRef(id);
		}
		env->CallVoidMethod(object, m_start_scan, known);
		env->DeleteLocalRef(known);
	}

	void stop_scan() override { current_env()->CallVoidMethod(object, m_stop_scan); }

	void connect(const std::string &address) override
	{
		JNIEnv *env = current_env();
		jstring a = from_utf8(env, address);
		env->CallVoidMethod(object, m_connect, a);
		env->DeleteLocalRef(a);
	}

	void discover() override { current_env()->CallVoidMethod(object, m_discover); }

	void enable_notify(const std::string &service, const std::string &characteristic) override
	{
		call_two(m_enable_notify, service, characteristic);
	}

	void write(const std::string &service, const std::string &characteristic, const std::vector<uint8_t> &data, bool with_response) override
	{
		JNIEnv *env = current_env();
		jstring s = from_utf8(env, service);
		jstring c = from_utf8(env, characteristic);
		jbyteArray bytes = env->NewByteArray(static_cast<jsize>(data.size()));
		if (!data.empty())
			env->SetByteArrayRegion(bytes, 0, static_cast<jsize>(data.size()), reinterpret_cast<const jbyte *>(data.data()));
		env->CallVoidMethod(object, m_write, s, c, bytes, static_cast<jboolean>(with_response));
		env->DeleteLocalRef(s);
		env->DeleteLocalRef(c);
		env->DeleteLocalRef(bytes);
	}

	void read(const std::string &service, const std::string &characteristic) override
	{
		call_two(m_read, service, characteristic);
	}

	void disconnect() override { current_env()->CallVoidMethod(object, m_disconnect); }

private:
	void call_two(jmethodID method, const std::string &first, const std::string &second)
	{
		JNIEnv *env = current_env();
		jstring a = from_utf8(env, first);
		jstring b = from_utf8(env, second);
		env->CallVoidMethod(object, method, a, b);
		env->DeleteLocalRef(a);
		env->DeleteLocalRef(b);
	}

	jobject object;
	jclass string_class;
	jmethodID m_start_scan, m_stop_scan, m_connect, m_discover, m_enable_notify, m_write, m_read, m_disconnect;
};

} // namespace

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *)
{
	g_vm = vm;
	JNIEnv *env = nullptr;
	if (vm->GetEnv(reinterpret_cast<void **>(&env), JNI_VERSION_1_6) != JNI_OK)
		return JNI_ERR;
	// Here, because FindClass from a thread the core started finds nothing of the app.
	jclass module = env->FindClass("expo/modules/ssrfcore/SsrfCoreModule");
	g_module_class = static_cast<jclass>(env->NewGlobalRef(module));
	g_on_core_event = env->GetStaticMethodID(g_module_class, "onCoreEvent", "(Ljava/lang/String;)V");
	ssrf::set_event_sink(forward_event);
	return JNI_VERSION_1_6;
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeInstallGattDriver(JNIEnv *env, jclass, jobject driver)
{
	// Never destroyed, as the contract in gatt-driver.h asks.
	ssrf::ble::set_gatt_driver(new AndroidGattDriver(env, driver));
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeBleAdapterState(JNIEnv *, jclass, jint state)
{
	ssrf::ble::gatt_event_adapter_state(static_cast<ssrf::ble::AdapterState>(state));
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeBleDeviceFound(JNIEnv *env, jclass, jstring address, jstring name, jint rssi)
{
	ssrf::ble::gatt_event_device_found(to_utf8(env, address), to_utf8(env, name), rssi);
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeBleConnected(JNIEnv *env, jclass, jstring error)
{
	ssrf::ble::gatt_event_connected(to_utf8(env, error));
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeBleServices(JNIEnv *env, jclass, jstring lines, jstring error)
{
	// One service per line: its uuid, then "characteristic:props" per characteristic.
	std::vector<ssrf::ble::Service> services;
	std::istringstream text(to_utf8(env, lines));
	std::string line;
	while (std::getline(text, line)) {
		std::istringstream fields(line);
		std::string field;
		ssrf::ble::Service service;
		fields >> service.uuid;
		while (fields >> field) {
			const size_t colon = field.find(':');
			if (colon != std::string::npos)
				service.characteristics.push_back({ field.substr(0, colon), static_cast<unsigned>(std::stoul(field.substr(colon + 1))) });
		}
		services.push_back(std::move(service));
	}
	ssrf::ble::gatt_event_services(services, to_utf8(env, error));
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeBleNotifyEnabled(JNIEnv *env, jclass, jstring characteristic, jstring error)
{
	ssrf::ble::gatt_event_notify_enabled(to_utf8(env, characteristic), to_utf8(env, error));
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeBleWriteComplete(JNIEnv *env, jclass, jstring characteristic, jstring error)
{
	ssrf::ble::gatt_event_write_complete(to_utf8(env, characteristic), to_utf8(env, error));
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeBleReadComplete(JNIEnv *env, jclass, jstring characteristic, jbyteArray value, jstring error)
{
	ssrf::ble::gatt_event_read_complete(to_utf8(env, characteristic), to_bytes(env, value), to_utf8(env, error));
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeBleValueChanged(JNIEnv *env, jclass, jstring characteristic, jbyteArray value)
{
	ssrf::ble::gatt_event_value_changed(to_utf8(env, characteristic), to_bytes(env, value));
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_ssrfcore_SsrfCoreModule_nativeBleDisconnected(JNIEnv *env, jclass, jstring error)
{
	ssrf::ble::gatt_event_disconnected(to_utf8(env, error));
}

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
