// AI-generated (Claude)
//
// The seam between the portable BLE stream (ble-stream.cpp) and the platform.
//
// Upstream's BLE transport (core/qt-ble.cpp) is written against Qt. Here, what
// is worth sharing - which GATT service is the serial port, which characteristic
// is which, the Heinrichs Weikamp credit protocol, the packet queue, timeouts and
// cancellation - stays in C++ and is the same on every platform. A driver only
// does what cannot be portable: CoreBluetooth on iOS (ios/SsrfGattDriver.mm),
// BluetoothGatt on Android (SsrfGattDriver.kt through ssrfcore-jni.cpp), a
// simulated dive computer on the host (tests/fake-dive-computer.cpp).
//
// A driver is asynchronous, as both platform APIs are. Methods are called from
// the download thread, one operation at a time, and return immediately. Each one
// answers through the matching gatt_event_*() function, from any thread.
#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace ssrf::ble {

enum CharacteristicProps : unsigned {
	PROP_READ = 1,
	PROP_WRITE = 2,
	PROP_WRITE_NO_RESPONSE = 4,
	PROP_NOTIFY = 8,
	PROP_INDICATE = 16,
};

struct Characteristic {
	std::string uuid;
	unsigned props = 0;
};

struct Service {
	std::string uuid;
	std::vector<Characteristic> characteristics;
};

enum class AdapterState {
	Unknown,      // Not asked yet, or the platform has not answered.
	Unsupported,  // No Bluetooth LE on this device (every iOS simulator).
	Unauthorized, // The user declined the permission.
	Off,
	On,
};

class GattDriver {
public:
	virtual ~GattDriver() = default;

	// `known_ids` are addresses seen before: many dive computers stop advertising
	// once bonded, so a scan alone may never list them. `service_uuids` are the
	// serial services of ble-stream.cpp, which iOS needs to ask for peripherals
	// connected through another app.
	virtual void start_scan(const std::vector<std::string> &known_ids, const std::vector<std::string> &service_uuids) = 0;
	virtual void stop_scan() = 0;

	// Answers gatt_event_connected().
	virtual void connect(const std::string &address) = 0;
	// Answers gatt_event_services(), with every characteristic discovered.
	virtual void discover() = 0;
	// Subscribes to a characteristic. Answers gatt_event_notify_enabled().
	virtual void enable_notify(const std::string &service, const std::string &characteristic) = 0;
	// Answers gatt_event_write_complete(). For a write without response, the
	// answer means the platform took it and has room for the next one.
	virtual void write(const std::string &service, const std::string &characteristic, const std::vector<uint8_t> &data, bool with_response) = 0;
	// Answers gatt_event_read_complete().
	virtual void read(const std::string &service, const std::string &characteristic) = 0;
	// Idempotent. Answers gatt_event_disconnected() if there was a connection.
	virtual void disconnect() = 0;
};

// The driver of this platform. Null where there is none, in which case a download
// fails with a message rather than crashes. The driver must outlive the process.
void set_gatt_driver(GattDriver *driver);
GattDriver *gatt_driver();

// Lowercase, 128 bits: "FEFB" and "0000FEFB-0000-1000-8000-00805F9B34FB" are the
// same service, and the platforms disagree on which of the two they report.
std::string normalize_uuid(const std::string &uuid);

// An empty `error` is success everywhere below.
void gatt_event_adapter_state(AdapterState state);
void gatt_event_device_found(const std::string &address, const std::string &name, int rssi);
void gatt_event_connected(const std::string &error);
void gatt_event_services(const std::vector<Service> &services, const std::string &error);
void gatt_event_notify_enabled(const std::string &characteristic, const std::string &error);
void gatt_event_write_complete(const std::string &characteristic, const std::string &error);
void gatt_event_read_complete(const std::string &characteristic, const std::vector<uint8_t> &value, const std::string &error);
// A notification or indication.
void gatt_event_value_changed(const std::string &characteristic, const std::vector<uint8_t> &value);
void gatt_event_disconnected(const std::string &error);

} // namespace ssrf::ble
