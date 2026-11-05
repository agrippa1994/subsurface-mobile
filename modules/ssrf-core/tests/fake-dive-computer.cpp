// AI-generated (Claude)
#include "fake-dive-computer.h"

#include "../cpp/bindings/ble-stream.h"

#include <nlohmann/json.hpp>

#include <condition_variable>
#include <cstring>
#include <deque>
#include <functional>
#include <mutex>
#include <thread>
#include <vector>

using json = nlohmann::json;
using namespace ssrf::ble;

namespace {

const char *const SERVICE = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
const char *const CHAR_WRITE = "aaaaaaaa-bbbb-4ccc-8ddd-000000000002";
const char *const CHAR_NOTIFY = "aaaaaaaa-bbbb-4ccc-8ddd-000000000003";

struct FakeDive {
	int year, month, day, hour, minute;
	int minutes;
	double depth_m;
};

constexpr int ATMOSPHERIC_MBAR = 1013;
constexpr int SAMPLE_INTERVAL_SEC = 10;
constexpr int DENSITY = 1024;
constexpr double GRAVITY = 9.80665;

void put16(std::vector<uint8_t> &out, size_t at, unsigned v)
{
	out[at] = v & 0xff;
	out[at + 1] = (v >> 8) & 0xff;
}

void put32(std::vector<uint8_t> &out, size_t at, unsigned v)
{
	put16(out, at, v & 0xffff);
	put16(out, at + 2, v >> 16);
}

unsigned depth_to_mbar(double metres)
{
	return ATMOSPHERIC_MBAR + static_cast<unsigned>(metres * DENSITY * GRAVITY / 100.0);
}

// Layout v0 of deepsix_excursion_parser.c: a 156 byte header and a profile of
// six byte TEMPERATURE samples, a triangle down to the maximum depth.
std::vector<uint8_t> dive_header(const FakeDive &d, size_t profile_size)
{
	std::vector<uint8_t> h(156, 0);
	put32(h, 8, static_cast<unsigned>(profile_size));
	h[12] = d.year - 2000;
	h[13] = d.month;
	h[14] = d.day;
	h[15] = d.hour;
	h[16] = d.minute;
	h[17] = 0;
	h[18] = 12; // UTC
	put32(h, 20, d.minutes * 60);
	put32(h, 24, SAMPLE_INTERVAL_SEC);
	put16(h, 28, depth_to_mbar(d.depth_m));
	put16(h, 32, 180);
	memcpy(h.data() + 48, "D01-5A", 6);
	put16(h, 56, ATMOSPHERIC_MBAR);
	return h;
}

std::vector<uint8_t> dive_profile(const FakeDive &d)
{
	const int samples = d.minutes * 60 / SAMPLE_INTERVAL_SEC;
	std::vector<uint8_t> p;
	for (int i = 1; i <= samples; i++) {
		const double along = static_cast<double>(i) / samples;
		const double depth = (along < 0.5 ? along * 2 : (1 - along) * 2) * d.depth_m;
		size_t at = p.size();
		p.resize(at + 6);
		p[at] = 2; // TEMPERATURE
		put16(p, at + 2, depth_to_mbar(depth));
		put16(p, at + 4, 180);
	}
	return p;
}

class FakeDiveComputer : public GattDriver {
public:
	FakeDiveComputer()
	{
		std::thread([this] { worker(); }).detach();
	}

	void start_scan(const std::vector<std::string> &known_ids, const std::vector<std::string> &) override
	{
		post([known_ids] {
			gatt_event_adapter_state(AdapterState::On);
			gatt_event_device_found("sim-excursion", "EXCURSION", -50);
			gatt_event_device_found("sim-headphones", "Headphones", -60);
			for (const std::string &id : known_ids)
				gatt_event_device_found(id, "", -70);
		});
	}

	void stop_scan() override {}

	void connect(const std::string &address) override
	{
		post([this, address] {
			std::lock_guard<std::mutex> lock(mutex);
			connections++;
			if (fail_connect) {
				gatt_event_connected("simulated connection failure");
				return;
			}
			connected = true;
			gatt_event_connected("");
		});
	}

	void discover() override
	{
		post([] {
			// Decoys either side of the real one: a standard service and a firmware
			// update service that both look like serial ports.
			std::vector<Service> services = {
				{ "180A", { { "2A29", PROP_READ | PROP_WRITE } } },
				{ "00001530-1212-EFDE-1523-785FEABCD123", { { "00001531-1212-EFDE-1523-785FEABCD123", PROP_WRITE | PROP_NOTIFY } } },
				{ SERVICE, { { CHAR_WRITE, PROP_WRITE_NO_RESPONSE }, { CHAR_NOTIFY, PROP_NOTIFY } } },
			};
			gatt_event_services(services, "");
		});
	}

	void enable_notify(const std::string &, const std::string &characteristic) override
	{
		post([this, characteristic] {
			std::lock_guard<std::mutex> lock(mutex);
			if (characteristic != CHAR_NOTIFY)
				protocol_errors.push_back("subscribed to " + characteristic);
			subscribed = true;
			gatt_event_notify_enabled(characteristic, "");
		});
	}

	void write(const std::string &, const std::string &characteristic, const std::vector<uint8_t> &data, bool with_response) override
	{
		post([this, characteristic, data, with_response] {
			std::unique_lock<std::mutex> lock(mutex);
			if (characteristic != CHAR_WRITE || with_response)
				protocol_errors.push_back("wrote to " + characteristic);
			writes++;
			gatt_event_write_complete(characteristic, "");
			if (drop_after_writes >= 0 && writes > drop_after_writes) {
				connected = false;
				gatt_event_disconnected("simulated link loss");
				return;
			}
			if (silent_after_writes >= 0 && writes > silent_after_writes)
				return;
			std::vector<uint8_t> answer = respond(data);
			int delay = response_delay_ms;
			lock.unlock();
			if (delay)
				std::this_thread::sleep_for(std::chrono::milliseconds(delay));
			if (!answer.empty())
				gatt_event_value_changed(CHAR_NOTIFY, answer);
		});
	}

	void read(const std::string &, const std::string &characteristic) override
	{
		post([characteristic] { gatt_event_read_complete(characteristic, {}, "unexpected read"); });
	}

	void disconnect() override
	{
		post([this] {
			std::lock_guard<std::mutex> lock(mutex);
			if (connected) {
				connected = false;
				gatt_event_disconnected("");
			}
		});
	}

	json configure(const json &args)
	{
		std::lock_guard<std::mutex> lock(mutex);
		if (args.contains("dives")) {
			dives.clear();
			for (const json &d : args["dives"]) {
				dives.push_back({ d.value("year", 2026), d.value("month", 1), d.value("day", 1), d.value("hour", 10), d.value("minute", 0),
						  d.value("minutes", 30), d.value("depthM", 20.0) });
			}
		}
		fail_connect = args.value("failConnect", false);
		drop_after_writes = args.value("dropAfterWrites", -1);
		silent_after_writes = args.value("silentAfterWrites", -1);
		response_delay_ms = args.value("responseDelayMs", 0);
		writes = 0;
		return status_locked();
	}

	json status()
	{
		std::lock_guard<std::mutex> lock(mutex);
		return status_locked();
	}

private:
	json status_locked()
	{
		return json{
			{ "connected", connected },
			{ "connections", connections },
			{ "subscribed", subscribed },
			{ "writes", writes },
			{ "headersServed", headers_served },
			{ "timeSets", time_sets },
			{ "protocolErrors", protocol_errors },
		};
	}

	// The device side of deepsix_excursion.c.
	std::vector<uint8_t> respond(const std::vector<uint8_t> &packet)
	{
		if (packet.size() < 5) {
			protocol_errors.push_back("short packet");
			return {};
		}
		const uint8_t grp = packet[0], cmd = packet[1], dir = packet[2];
		const uint8_t *payload = packet.data() + 4;
		const size_t len = packet[3];
		std::vector<uint8_t> out;

		if (grp == 0xB0 && cmd == 0x28) {
			// settings load: an empty acknowledge
		} else if (grp == 0xB0 && (cmd == 0x01 || cmd == 0x03)) {
			out.assign(payload, payload + len);
			time_sets++;
		} else if (grp == 0xB0 && cmd == 0x27) {
			// settings store
		} else if (grp == 0xA0 && cmd == 0x01) {
			out = bytes("HWR01A");
		} else if (grp == 0xA0 && cmd == 0x02) {
			out = bytes("D01-5A");
		} else if (grp == 0xA0 && cmd == 0x03) {
			out = bytes("D01000012345");
		} else if (grp == 0xA0 && cmd == 0x04) {
			out = { static_cast<uint8_t>(dives.size() & 0xff), static_cast<uint8_t>(dives.size() >> 8) };
		} else if (grp == 0xC0 && cmd == 0x02) {
			const FakeDive *dive = find_dive(payload[0] | (payload[1] << 8));
			if (dive) {
				headers_served++;
				out = dive_header(*dive, dive_profile(*dive).size());
			}
		} else if (grp == 0xC0 && cmd == 0x03) {
			const FakeDive *dive = find_dive(payload[0] | (payload[1] << 8));
			const size_t offset = payload[2] | (payload[3] << 8) | (payload[4] << 16) | (payload[5] << 24);
			if (dive) {
				const std::vector<uint8_t> profile = dive_profile(*dive);
				const size_t n = std::min<size_t>(240, profile.size() > offset ? profile.size() - offset : 0);
				out.assign(profile.begin() + offset, profile.begin() + offset + n);
			}
		} else {
			protocol_errors.push_back("unknown command");
			return {};
		}

		std::vector<uint8_t> reply = { static_cast<uint8_t>(grp + 1), cmd, dir, static_cast<uint8_t>(out.size()) };
		reply.insert(reply.end(), out.begin(), out.end());
		uint8_t sum = 0;
		for (uint8_t b : reply)
			sum += b;
		reply.push_back(sum ^ 0xff);
		return reply;
	}

	// Numbered from 1, oldest first; the device hands out the newest first.
	const FakeDive *find_dive(int number) const
	{
		if (number < 1 || number > static_cast<int>(dives.size()))
			return nullptr;
		return &dives[number - 1];
	}

	static std::vector<uint8_t> bytes(const char *text)
	{
		return { text, text + strlen(text) };
	}

	void post(std::function<void()> task)
	{
		std::lock_guard<std::mutex> lock(queue_mutex);
		queue.push_back(std::move(task));
		queue_changed.notify_one();
	}

	// One thread, as CoreBluetooth's queue and the Binder thread behave.
	[[noreturn]] void worker()
	{
		for (;;) {
			std::function<void()> task;
			{
				std::unique_lock<std::mutex> lock(queue_mutex);
				queue_changed.wait(lock, [this] { return !queue.empty(); });
				task = std::move(queue.front());
				queue.pop_front();
			}
			task();
		}
	}

	std::mutex queue_mutex;
	std::condition_variable queue_changed;
	std::deque<std::function<void()>> queue;

	std::mutex mutex;
	std::vector<FakeDive> dives;
	bool fail_connect = false;
	int drop_after_writes = -1;
	int silent_after_writes = -1;
	int response_delay_ms = 0;
	bool connected = false;
	bool subscribed = false;
	int connections = 0;
	int writes = 0;
	int headers_served = 0;
	int time_sets = 0;
	std::vector<std::string> protocol_errors;
};

FakeDiveComputer *g_fake = nullptr;

} // namespace

void install_fake_dive_computer()
{
	// Lives as long as the process, like its worker thread.
	g_fake = new FakeDiveComputer();
	set_gatt_driver(g_fake);
}

std::string fake_dive_computer_call(const std::string &method, const std::string &args_json)
{
	try {
		const json args = json::parse(args_json);
		json result;
		if (method == "sim.configure")
			result = g_fake->configure(args);
		else if (method == "sim.status")
			result = g_fake->status();
		else if (method == "sim.selectService") {
			// select_serial_service() on its own, for service lists the fake does not have.
			std::vector<Service> services;
			for (const json &s : args["services"]) {
				Service service { normalize_uuid(s["uuid"].get<std::string>()), {} };
				for (const json &c : s["characteristics"])
					service.characteristics.push_back({ normalize_uuid(c["uuid"].get<std::string>()), c["props"].get<unsigned>() });
				services.push_back(std::move(service));
			}
			const Service *picked = select_serial_service(services);
			result = picked ? json(picked->uuid) : json(nullptr);
		} else {
			return json{ { "ok", false }, { "error", "unknown simulator method " + method } }.dump();
		}
		return json{ { "ok", true }, { "result", result } }.dump();
	} catch (const std::exception &e) {
		return json{ { "ok", false }, { "error", e.what() } }.dump();
	}
}
