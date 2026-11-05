// AI-generated (Claude)
//
// A libdivecomputer custom iostream over GATT. A port of the logic of upstream's
// core/qt-ble.cpp, with the Qt event loop replaced by a condition variable: the
// download thread blocks here, the driver's callbacks arrive on the platform's
// own thread and only ever queue data or complete an operation.
#include "ble-stream.h"

#include "core/errorhelper.h"
#include "core/libdivecomputer.h"

#include <libdivecomputer/ble.h>
#include <libdivecomputer/custom.h>

#include <algorithm>
#include <atomic>
#include <cctype>
#include <chrono>
#include <condition_variable>
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <thread>

namespace ssrf::ble {

namespace {

constexpr int BLE_TIMEOUT_MS = 12000;
constexpr unsigned MAXIMAL_HW_CREDIT = 254;
constexpr unsigned MINIMAL_HW_CREDIT = 32;

const std::string BASE_UUID_SUFFIX = "-0000-1000-8000-00805f9b34fb";

// Same order as serial_service_uuids in core/qt-ble.cpp: first match wins. The
// Bluetooth SIG never standardized a serial service over GATT, so every vendor
// has its own.
const char *const KNOWN_SERIAL_SERVICES[] = {
	"0000fefb-0000-1000-8000-00805f9b34fb", // Heinrichs Weikamp (Telit/Stollmann)
	"2456e1b9-26e2-8f83-e744-f34f01e9d701", // Heinrichs Weikamp (U-Blox)
	"544e326b-5b72-c6b0-1c46-41c1bc448118", // Mares BlueLink Pro
	"98ae7120-e62e-11e3-badd-0002a5d5c51b", // Suunto (EON Steel/Core, G5)
	"cb3c4555-d670-4670-bc20-b61dbc851e9a", // Pelagic (i770R, i200C, Pro Plus X, Geo 4.0)
	"ca7b0001-f785-4c38-b599-c7c5fbadb034", // Pelagic (i330R, DSX)
	"fdcdeaaa-295d-470e-bf15-04217b7aa0a0", // ScubaPro (G2, G3)
	"fe25c237-0ece-443c-b0aa-e02033e7029d", // Shearwater (Perdix/Teric/Peregrine/Tern)
	"1aa44039-1667-4b29-87cc-dfecaaf31d97", // Shearwater (Perdix 3)
	"0000fcef-0000-1000-8000-00805f9b34fb", // Divesoft
	"6e400001-b5a3-f393-e0a9-e50e24dc10b8", // Cressi; before the Nordic UART on purpose
	"6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic Semi UART
	"00000001-8c3b-4f2c-a59e-8c08224f3253", // Halcyon Symbios
	"84968ffe-d26d-478a-b953-5010bcf58bca", // Seac
};

// Firmware update services: never the serial port, even if they look like one.
const char *const UPGRADE_SERVICES[] = {
	"00001530-1212-efde-1523-785feabcd123", // Nordic
	"9e5d1e47-5c13-43a0-8635-82ad38a1386f", // Broadcom #1
	"a86abc2d-d44c-442e-99f7-80059a873e36", // Broadcom #2
};

// Characteristics that look usable and are not (McLean Extreme, Halcyon).
const char *const SKIP_FOR_ANY[] = {
	"49535343-6daa-4d02-abf6-19569aca69fe",
	"49535343-aca3-481c-91ec-d85e28a60318",
	"49535343-026e-3a9b-954c-97daef17e26e",
	"49535343-4c8a-39b3-2f49-511cff073b7e",
};
const char *const SKIP_FOR_READ = "00000101-8c3b-4f2c-a59e-8c08224f3253";
const char *const SKIP_FOR_WRITE = "00000201-8c3b-4f2c-a59e-8c08224f3253";

// The Terminal I/O service of the Heinrichs Weikamp computers.
const char *const TELIT_DATA_RX = "00000001-0000-1000-8000-008025000000";
const char *const TELIT_DATA_TX = "00000002-0000-1000-8000-008025000000";
const char *const TELIT_CREDITS_RX = "00000003-0000-1000-8000-008025000000";
const char *const TELIT_CREDITS_TX = "00000004-0000-1000-8000-008025000000";
// U-Blox uses one characteristic for each direction of a kind.
const char *const UBLOX_DATA = "2456e1b9-26e2-8f83-e744-f34f01e9d703";
const char *const UBLOX_CREDITS = "2456e1b9-26e2-8f83-e744-f34f01e9d704";

bool in_list(const std::string &uuid, const char *const *list, size_t count)
{
	return std::any_of(list, list + count, [&](const char *entry) { return uuid == entry; });
}

template <size_t N>
bool in_list(const std::string &uuid, const char *const (&list)[N])
{
	return in_list(uuid, list, N);
}

bool is_write_characteristic(const Characteristic &c)
{
	if (in_list(c.uuid, SKIP_FOR_ANY) || c.uuid == SKIP_FOR_WRITE)
		return false;
	return c.props & (PROP_WRITE | PROP_WRITE_NO_RESPONSE);
}

bool is_read_characteristic(const Characteristic &c)
{
	if (in_list(c.uuid, SKIP_FOR_ANY) || c.uuid == SKIP_FOR_READ)
		return false;
	return c.props & PROP_READ;
}

// Upstream also asks for a descriptor to exist. Notify implies a CCCD, and the
// platform APIs do not hand descriptors over without another round trip.
bool is_notify_characteristic(const Characteristic &c)
{
	if (in_list(c.uuid, SKIP_FOR_ANY) || c.uuid == SKIP_FOR_READ)
		return false;
	return c.props & (PROP_NOTIFY | PROP_INDICATE);
}

bool is_standard_uuid(const std::string &uuid)
{
	return uuid.size() == 36 && uuid.compare(0, 4, "0000") == 0 && uuid.compare(8, std::string::npos, BASE_UUID_SUFFIX) == 0;
}

bool usable(const Service &s)
{
	bool readable = false, writable = false;
	for (const Characteristic &c : s.characteristics) {
		readable |= is_notify_characteristic(c) || is_read_characteristic(c);
		writable |= is_write_characteristic(c);
	}
	return readable && writable;
}

std::string hex(const std::vector<uint8_t> &data)
{
	static const char digits[] = "0123456789abcdef";
	std::string out;
	out.reserve(data.size() * 2);
	for (uint8_t byte : data) {
		out += digits[byte >> 4];
		out += digits[byte & 0xf];
	}
	return out;
}

std::string uuid_from_bytes(const unsigned char *bytes)
{
	char text[DC_BLE_UUID_SIZE];
	dc_ble_uuid2str(bytes, text, sizeof(text));
	return normalize_uuid(text);
}

GattDriver *g_driver = nullptr;

class Stream;
std::mutex g_current_mutex;
std::shared_ptr<Stream> g_current;

class Stream {
public:
	Stream(GattDriver &driver, const device_data_t &device) :
		driver(driver),
		is_hw(device.vendor == "Heinrichs Weikamp"),
		name(device.btname),
		logfile(device.libdc_logfile)
	{
	}

	dc_status_t open(const std::string &address);
	dc_status_t close();
	dc_status_t set_timeout(int value);
	dc_status_t poll(int ms);
	dc_status_t read(void *data, size_t size, size_t *actual);
	dc_status_t write(const void *data, size_t size, size_t *actual);
	dc_status_t purge(dc_direction_t direction);
	dc_status_t sleep(unsigned int ms);
	dc_status_t ioctl(unsigned int request, void *data, size_t size);

	void on_connected(const std::string &error);
	void on_services(const std::vector<Service> &found, const std::string &error);
	void on_notify_enabled(const std::string &error);
	void on_write_complete(const std::string &characteristic, const std::string &error);
	void on_read_complete(const std::string &characteristic, const std::vector<uint8_t> &value, const std::string &error);
	void on_value(const std::string &characteristic, const std::vector<uint8_t> &value);
	void on_disconnected(const std::string &error);

private:
	// One outstanding operation, since the stream issues them one at a time.
	struct Operation {
		bool pending = false;
		std::string error;
	};

	dc_status_t run(const std::function<void()> &start, int timeout_ms, const char *what);
	dc_status_t wait_locked(std::unique_lock<std::mutex> &lock, const std::function<bool()> &done, int timeout_ms);
	dc_status_t setup_hw_terminal_io();
	dc_status_t set_hw_credit(unsigned credit);
	dc_status_t top_up_hw_credit();
	dc_status_t enable_notifications();
	const Characteristic *find_characteristic(const char *uuid) const;
	void log(const char *fmt, ...);

	GattDriver &driver;
	const bool is_hw;
	const std::string name;
	FILE *const logfile;

	std::mutex mutex;
	std::condition_variable changed;
	Operation op;
	bool connected = false;
	bool link_lost = false;
	std::string link_error;
	std::vector<Service> services;
	std::deque<std::vector<uint8_t>> packets;
	// CHARACTERISTIC_READ ioctl: its value must not land in the data queue.
	std::string direct_read_uuid;
	std::vector<uint8_t> direct_read_value;
	std::atomic<unsigned> hw_credit { 0 };

	// Only touched by the download thread, after open() has set them up.
	Service serial;
	bool notify = false;
	int timeout_ms = BLE_TIMEOUT_MS;
};

void Stream::log(const char *fmt, ...)
{
	// The same file libdivecomputer logs into, so one log tells the whole story
	// of a failed download from somebody else's dive computer.
	if (!logfile)
		return;
	va_list args;
	va_start(args, fmt);
	fprintf(logfile, "BLE: ");
	vfprintf(logfile, fmt, args);
	fprintf(logfile, "\n");
	va_end(args);
	fflush(logfile);
}

// Waits for `done`, for the link to drop, for the user to cancel or for the
// timeout. A negative timeout is libdivecomputer's "block forever", which still
// ends with one of the other three.
dc_status_t Stream::wait_locked(std::unique_lock<std::mutex> &lock, const std::function<bool()> &done, int timeout)
{
	const auto start = std::chrono::steady_clock::now();
	for (;;) {
		if (done())
			return DC_STATUS_SUCCESS;
		if (import_thread_cancelled)
			return DC_STATUS_CANCELLED;
		if (link_lost)
			return DC_STATUS_IO;
		const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - start).count();
		if (timeout >= 0 && elapsed >= timeout)
			return DC_STATUS_TIMEOUT;
		// Cancelling sets a flag and nobody signals, hence the slices.
		auto slice = std::chrono::milliseconds(50);
		if (timeout >= 0)
			slice = std::min<std::chrono::milliseconds>(slice, std::chrono::milliseconds(timeout - elapsed));
		changed.wait_for(lock, slice);
	}
}

dc_status_t Stream::run(const std::function<void()> &start, int timeout, const char *what)
{
	std::unique_lock<std::mutex> lock(mutex);
	op = Operation { true, {} };
	lock.unlock();
	start();
	lock.lock();
	dc_status_t rc = wait_locked(lock, [this] { return !op.pending; }, timeout);
	if (rc == DC_STATUS_SUCCESS && !op.error.empty()) {
		log("%s failed: %s", what, op.error.c_str());
		return DC_STATUS_IO;
	}
	if (rc != DC_STATUS_SUCCESS)
		log("%s did not finish: %s", what, errmsg(rc));
	return rc;
}

dc_status_t Stream::open(const std::string &address)
{
	log("connecting to %s", address.c_str());
	dc_status_t rc = run([&] { driver.connect(address); }, BLE_TIMEOUT_MS, "connect");
	if (rc != DC_STATUS_SUCCESS) {
		if (rc != DC_STATUS_CANCELLED) {
			std::string detail;
			{
				std::lock_guard<std::mutex> lock(mutex);
				detail = !op.error.empty() ? op.error : link_error;
			}
			if (detail.empty())
				report_error("Timeout while trying to connect to %s", address.c_str());
			else
				report_error("Failed to connect to %s: %s", address.c_str(), detail.c_str());
		}
		return rc;
	}
	{
		std::lock_guard<std::mutex> lock(mutex);
		connected = true;
	}

	rc = run([&] { driver.discover(); }, BLE_TIMEOUT_MS, "service discovery");
	if (rc != DC_STATUS_SUCCESS)
		return rc;

	std::vector<Service> found;
	{
		std::lock_guard<std::mutex> lock(mutex);
		found = services;
	}
	for (const Service &s : found) {
		log("service %s", s.uuid.c_str());
		for (const Characteristic &c : s.characteristics)
			log("  characteristic %s props 0x%02x", c.uuid.c_str(), c.props);
	}

	const Service *preferred = select_serial_service(found);
	if (!preferred) {
		report_error("Failed to find suitable BLE GATT service");
		return DC_STATUS_IO;
	}
	serial = *preferred;
	log("using service %s", serial.uuid.c_str());
	notify = std::any_of(serial.characteristics.begin(), serial.characteristics.end(), is_notify_characteristic);

	return is_hw ? setup_hw_terminal_io() : enable_notifications();
}

dc_status_t Stream::enable_notifications()
{
	for (const Characteristic &c : serial.characteristics) {
		if (!is_notify_characteristic(c))
			continue;
		log("using read characteristic %s", c.uuid.c_str());
		// Upstream retries too: the confirmation can take well over a second on
		// Android, and is sometimes dropped.
		dc_status_t rc = DC_STATUS_TIMEOUT;
		for (int attempt = 0; attempt < 3 && rc == DC_STATUS_TIMEOUT; attempt++)
			rc = run([&] { driver.enable_notify(serial.uuid, c.uuid); }, BLE_TIMEOUT_MS, "enable notifications");
		if (rc != DC_STATUS_SUCCESS && rc != DC_STATUS_CANCELLED)
			report_error("Bluetooth: Failed to enable notifications.");
		return rc;
	}
	return DC_STATUS_SUCCESS;
}

const Characteristic *Stream::find_characteristic(const char *uuid) const
{
	for (const Characteristic &c : serial.characteristics) {
		if (c.uuid == uuid)
			return &c;
	}
	return nullptr;
}

// The Terminal I/O setup: subscribe to the credits, subscribe to the data, grant
// the device credits to send with. See the Telit TIO implementation guide.
dc_status_t Stream::setup_hw_terminal_io()
{
	const Characteristic *credits = find_characteristic(TELIT_CREDITS_TX);
	const Characteristic *data = find_characteristic(TELIT_DATA_TX);
	if (!credits)
		credits = find_characteristic(UBLOX_CREDITS);
	if (!data)
		data = find_characteristic(UBLOX_DATA);
	if (!credits || !data) {
		report_error("Heinrichs Weikamp device without the expected characteristics");
		return DC_STATUS_IO;
	}
	dc_status_t rc = run([&] { driver.enable_notify(serial.uuid, credits->uuid); }, BLE_TIMEOUT_MS, "subscribe to credits");
	if (rc != DC_STATUS_SUCCESS)
		return rc;
	rc = run([&] { driver.enable_notify(serial.uuid, data->uuid); }, BLE_TIMEOUT_MS, "subscribe to data");
	if (rc != DC_STATUS_SUCCESS)
		return rc;
	return set_hw_credit(MAXIMAL_HW_CREDIT);
}

dc_status_t Stream::set_hw_credit(unsigned credit)
{
	const Characteristic *c = find_characteristic(TELIT_CREDITS_RX);
	if (!c)
		c = find_characteristic(UBLOX_CREDITS);
	if (!c)
		return DC_STATUS_IO;
	const std::vector<uint8_t> value { static_cast<uint8_t>(credit) };
	dc_status_t rc = run([&] { driver.write(serial.uuid, c->uuid, value, true); }, BLE_TIMEOUT_MS, "grant credits");
	if (rc == DC_STATUS_SUCCESS)
		hw_credit += credit;
	return rc;
}

// Upstream does this from inside the notification handler. A driver callback
// must not block, so it happens on the download thread instead, which is about to
// consume what the device sent anyway.
dc_status_t Stream::top_up_hw_credit()
{
	if (!is_hw || hw_credit > MINIMAL_HW_CREDIT)
		return DC_STATUS_SUCCESS;
	return set_hw_credit(MAXIMAL_HW_CREDIT - MINIMAL_HW_CREDIT);
}

dc_status_t Stream::write(const void *data, size_t size, size_t *actual)
{
	if (actual)
		*actual = 0;
	for (const Characteristic &c : serial.characteristics) {
		if (!is_write_characteristic(c))
			continue;
		const auto *bytes = static_cast<const uint8_t *>(data);
		const std::vector<uint8_t> packet(bytes, bytes + size);
		log("send %s", hex(packet).c_str());
		const bool with_response = !(c.props & PROP_WRITE_NO_RESPONSE);
		dc_status_t rc = run([&] { driver.write(serial.uuid, c.uuid, packet, with_response); }, BLE_TIMEOUT_MS, "write");
		if (rc == DC_STATUS_SUCCESS && actual)
			*actual = size;
		return rc;
	}
	return DC_STATUS_IO;
}

dc_status_t Stream::poll(int ms)
{
	dc_status_t rc = top_up_hw_credit();
	if (rc != DC_STATUS_SUCCESS)
		return rc;
	std::unique_lock<std::mutex> lock(mutex);
	return wait_locked(lock, [this] { return !packets.empty(); }, ms);
}

dc_status_t Stream::read(void *data, size_t size, size_t *actual)
{
	if (actual)
		*actual = 0;

	if (!notify) {
		const auto c = std::find_if(serial.characteristics.begin(), serial.characteristics.end(), is_read_characteristic);
		if (c == serial.characteristics.end()) {
			report_error("No read characteristic found.");
			return DC_STATUS_IO;
		}
		driver.read(serial.uuid, c->uuid);
	}

	dc_status_t rc = poll(timeout_ms);
	if (rc != DC_STATUS_SUCCESS)
		return rc;

	std::vector<uint8_t> packet;
	{
		std::lock_guard<std::mutex> lock(mutex);
		packet = std::move(packets.front());
		packets.pop_front();
	}
	log("recv %s", hex(packet).c_str());

	// A datagram transport: what does not fit is lost, and libdivecomputer has
	// to hear about it. Same behaviour as upstream.
	rc = DC_STATUS_SUCCESS;
	if (packet.size() > size) {
		report_error("BLE packet too large (%zu > %zu)", packet.size(), size);
		packet.resize(size);
		rc = DC_STATUS_IO;
	}
	if (!packet.empty())
		memcpy(data, packet.data(), packet.size());
	if (actual)
		*actual = packet.size();
	return rc;
}

dc_status_t Stream::set_timeout(int value)
{
	timeout_ms = value;
	return DC_STATUS_SUCCESS;
}

dc_status_t Stream::purge(dc_direction_t direction)
{
	if (direction & DC_DIRECTION_INPUT) {
		std::lock_guard<std::mutex> lock(mutex);
		packets.clear();
	}
	return DC_STATUS_SUCCESS;
}

// Not a plain sleep: the backends use long ones, and Cancel should not wait.
dc_status_t Stream::sleep(unsigned int ms)
{
	std::unique_lock<std::mutex> lock(mutex);
	dc_status_t rc = wait_locked(lock, [] { return false; }, static_cast<int>(ms));
	if (rc == DC_STATUS_TIMEOUT || rc == DC_STATUS_IO)
		return DC_STATUS_SUCCESS;
	return rc;
}

dc_status_t Stream::ioctl(unsigned int request, void *data, size_t size)
{
	switch (request) {
	case DC_IOCTL_BLE_GET_NAME:
		if (name.empty() || size == 0)
			return DC_STATUS_UNSUPPORTED;
		strncpy(static_cast<char *>(data), name.c_str(), size);
		static_cast<char *>(data)[size - 1] = '\0';
		return DC_STATUS_SUCCESS;
	case DC_IOCTL_BLE_CHARACTERISTIC_READ: {
		if (size < sizeof(dc_ble_uuid_t))
			return DC_STATUS_INVALIDARGS;
		const std::string uuid = uuid_from_bytes(static_cast<unsigned char *>(data));
		char *out = static_cast<char *>(data) + sizeof(dc_ble_uuid_t);
		const size_t wanted = size - sizeof(dc_ble_uuid_t);
		if (!find_characteristic(uuid.c_str())) {
			report_error("characteristic %s not found", uuid.c_str());
			return DC_STATUS_NOACCESS;
		}
		{
			std::lock_guard<std::mutex> lock(mutex);
			direct_read_uuid = uuid;
			direct_read_value.clear();
		}
		dc_status_t rc = run([&] { driver.read(serial.uuid, uuid); }, timeout_ms, "read characteristic");
		std::lock_guard<std::mutex> lock(mutex);
		direct_read_uuid.clear();
		if (rc != DC_STATUS_SUCCESS)
			return rc;
		if (direct_read_value.size() != wanted) {
			report_error("Unexpected read characteristic size (%zu): expected %zu", direct_read_value.size(), wanted);
			return DC_STATUS_DATAFORMAT;
		}
		memcpy(out, direct_read_value.data(), wanted);
		return DC_STATUS_SUCCESS;
	}
	case DC_IOCTL_BLE_CHARACTERISTIC_WRITE: {
		if (size < sizeof(dc_ble_uuid_t))
			return DC_STATUS_INVALIDARGS;
		const std::string uuid = uuid_from_bytes(static_cast<unsigned char *>(data));
		const uint8_t *in = static_cast<uint8_t *>(data) + sizeof(dc_ble_uuid_t);
		const std::vector<uint8_t> value(in, in + size - sizeof(dc_ble_uuid_t));
		return run([&] { driver.write(serial.uuid, uuid, value, true); }, timeout_ms, "write characteristic");
	}
	default:
		// DC_IOCTL_BLE_GET_PINCODE and the access code (Pelagic i330R, DSX): the
		// same as the legacy app, which asks for neither.
		return DC_STATUS_UNSUPPORTED;
	}
}

dc_status_t Stream::close()
{
	std::unique_lock<std::mutex> lock(mutex);
	const bool was_connected = connected && !link_lost;
	lock.unlock();
	driver.disconnect();
	if (was_connected) {
		lock.lock();
		// Best effort, and regardless of a cancel: this is teardown.
		changed.wait_for(lock, std::chrono::seconds(2), [this] { return link_lost; });
	}
	return DC_STATUS_SUCCESS;
}

void Stream::on_connected(const std::string &error)
{
	std::lock_guard<std::mutex> lock(mutex);
	op.error = error;
	op.pending = false;
	changed.notify_all();
}

void Stream::on_services(const std::vector<Service> &found, const std::string &error)
{
	std::lock_guard<std::mutex> lock(mutex);
	services = found;
	for (Service &s : services) {
		s.uuid = normalize_uuid(s.uuid);
		for (Characteristic &c : s.characteristics)
			c.uuid = normalize_uuid(c.uuid);
	}
	op.error = error;
	op.pending = false;
	changed.notify_all();
}

void Stream::on_notify_enabled(const std::string &error)
{
	std::lock_guard<std::mutex> lock(mutex);
	op.error = error;
	op.pending = false;
	changed.notify_all();
}

void Stream::on_write_complete(const std::string &, const std::string &error)
{
	std::lock_guard<std::mutex> lock(mutex);
	op.error = error;
	op.pending = false;
	changed.notify_all();
}

void Stream::on_read_complete(const std::string &characteristic, const std::vector<uint8_t> &value, const std::string &error)
{
	std::lock_guard<std::mutex> lock(mutex);
	if (normalize_uuid(characteristic) == direct_read_uuid && op.pending) {
		direct_read_value = value;
		op.error = error;
		op.pending = false;
	} else if (error.empty()) {
		packets.push_back(value);
	} else {
		link_lost = true;
		link_error = error;
	}
	changed.notify_all();
}

void Stream::on_value(const std::string &characteristic, const std::vector<uint8_t> &value)
{
	const std::string uuid = normalize_uuid(characteristic);
	std::lock_guard<std::mutex> lock(mutex);
	if (uuid == direct_read_uuid && op.pending) {
		direct_read_value = value;
		op.pending = false;
		changed.notify_all();
		return;
	}
	if (is_hw) {
		// The credit characteristic also notifies, and is not data.
		if (uuid != TELIT_DATA_TX && uuid != UBLOX_DATA)
			return;
		if (hw_credit > 0)
			hw_credit--;
	}
	packets.push_back(value);
	changed.notify_all();
}

void Stream::on_disconnected(const std::string &error)
{
	std::lock_guard<std::mutex> lock(mutex);
	link_lost = true;
	link_error = error;
	// A connect that is still pending has failed; anything else notices link_lost.
	changed.notify_all();
}

// ---------------------------------------------------------------------------
// The C callbacks of dc_custom_open()
// ---------------------------------------------------------------------------

// libdivecomputer holds a raw pointer, the driver callbacks go through g_current,
// and a late callback must not touch a stream already closed. The holder keeps
// the shared_ptr alive until close.
Stream *stream_of(void *userdata)
{
	return static_cast<std::shared_ptr<Stream> *>(userdata)->get();
}

dc_status_t cb_set_timeout(void *u, int timeout) { return stream_of(u)->set_timeout(timeout); }
dc_status_t cb_poll(void *u, int timeout) { return stream_of(u)->poll(timeout); }
dc_status_t cb_read(void *u, void *data, size_t size, size_t *actual) { return stream_of(u)->read(data, size, actual); }
dc_status_t cb_write(void *u, const void *data, size_t size, size_t *actual) { return stream_of(u)->write(data, size, actual); }
dc_status_t cb_ioctl(void *u, unsigned int request, void *data, size_t size) { return stream_of(u)->ioctl(request, data, size); }
dc_status_t cb_purge(void *u, dc_direction_t direction) { return stream_of(u)->purge(direction); }
dc_status_t cb_sleep(void *u, unsigned int ms) { return stream_of(u)->sleep(ms); }

void clear_current(const std::shared_ptr<Stream> &stream)
{
	std::lock_guard<std::mutex> lock(g_current_mutex);
	if (g_current == stream)
		g_current.reset();
}

dc_status_t cb_close(void *u)
{
	auto *holder = static_cast<std::shared_ptr<Stream> *>(u);
	dc_status_t rc = (*holder)->close();
	clear_current(*holder);
	delete holder;
	return rc;
}

std::shared_ptr<Stream> current()
{
	std::lock_guard<std::mutex> lock(g_current_mutex);
	return g_current;
}

} // namespace

void set_gatt_driver(GattDriver *driver)
{
	g_driver = driver;
}

GattDriver *gatt_driver()
{
	return g_driver;
}

std::string normalize_uuid(const std::string &uuid)
{
	std::string out;
	out.reserve(uuid.size());
	for (char c : uuid) {
		if (c == '{' || c == '}')
			continue;
		out += static_cast<char>(tolower(static_cast<unsigned char>(c)));
	}
	if (out.size() == 4)
		return "0000" + out + BASE_UUID_SUFFIX;
	if (out.size() == 8)
		return out + BASE_UUID_SUFFIX;
	return out;
}

std::vector<std::string> serial_service_uuids()
{
	return { std::begin(KNOWN_SERIAL_SERVICES), std::end(KNOWN_SERIAL_SERVICES) };
}

const Service *select_serial_service(const std::vector<Service> &services)
{
	// A known service wins outright, in the order of the table: a Cressi also
	// exposes a Nordic UART, and only the first is the right one.
	for (const char *known : KNOWN_SERIAL_SERVICES) {
		for (const Service &s : services) {
			if (s.uuid == known)
				return usable(s) ? &s : nullptr;
		}
	}
	// Otherwise the first vendor-specific service that can do both directions.
	// Standard services are battery level and device name; upgrade services are
	// known to look like serial ports.
	for (const Service &s : services) {
		if (is_standard_uuid(s.uuid) || in_list(s.uuid, UPGRADE_SERVICES))
			continue;
		if (usable(s))
			return &s;
	}
	return nullptr;
}

void gatt_event_connected(const std::string &error)
{
	if (auto s = current())
		s->on_connected(error);
}

void gatt_event_services(const std::vector<Service> &services, const std::string &error)
{
	if (auto s = current())
		s->on_services(services, error);
}

void gatt_event_notify_enabled(const std::string &, const std::string &error)
{
	if (auto s = current())
		s->on_notify_enabled(error);
}

void gatt_event_write_complete(const std::string &characteristic, const std::string &error)
{
	if (auto s = current())
		s->on_write_complete(characteristic, error);
}

void gatt_event_read_complete(const std::string &characteristic, const std::vector<uint8_t> &value, const std::string &error)
{
	if (auto s = current())
		s->on_read_complete(characteristic, value, error);
}

void gatt_event_value_changed(const std::string &characteristic, const std::vector<uint8_t> &value)
{
	if (auto s = current())
		s->on_value(characteristic, value);
}

void gatt_event_disconnected(const std::string &error)
{
	if (auto s = current())
		s->on_disconnected(error);
}

} // namespace ssrf::ble

// Declared in core/libdivecomputer.h; upstream's lives in qtserialbluetooth.cpp.
dc_status_t ble_packet_open(dc_iostream_t **iostream, dc_context_t *context, const char *devaddr, void *userdata)
{
	using namespace ssrf::ble;

	GattDriver *driver = gatt_driver();
	if (!driver) {
		report_error("Bluetooth is not available on this device");
		return DC_STATUS_UNSUPPORTED;
	}

	static const dc_custom_cbs_t callbacks = {
		.set_timeout = cb_set_timeout,
		.set_break = nullptr,
		.set_dtr = nullptr,
		.set_rts = nullptr,
		.get_lines = nullptr,
		.get_available = nullptr,
		.configure = nullptr,
		.poll = cb_poll,
		.read = cb_read,
		.write = cb_write,
		.ioctl = cb_ioctl,
		.flush = nullptr,
		.purge = cb_purge,
		.sleep = cb_sleep,
		.close = cb_close,
	};

	auto stream = std::make_shared<Stream>(*driver, *static_cast<device_data_t *>(userdata));
	{
		std::lock_guard<std::mutex> lock(g_current_mutex);
		g_current = stream;
	}

	dc_status_t rc = stream->open(devaddr);
	if (rc != DC_STATUS_SUCCESS) {
		stream->close();
		clear_current(stream);
		return rc;
	}

	auto *holder = new std::shared_ptr<Stream>(stream);
	rc = dc_custom_open(iostream, context, DC_TRANSPORT_BLE, &callbacks, holder);
	if (rc != DC_STATUS_SUCCESS)
		cb_close(holder);
	return rc;
}
