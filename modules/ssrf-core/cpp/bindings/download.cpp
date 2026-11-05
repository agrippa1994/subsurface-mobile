// AI-generated (Claude)
#include "download.h"

#include "api-errors.h"
#include "ble-stream.h"
#include "dc-detect.h"

#include "core/device.h"
#include "core/dive.h"
#include "core/divelist.h"
#include "core/divelog.h"
#include "core/errorhelper.h"
#include "core/format.h"
#include "core/libdivecomputer.h"

#include <libdivecomputer/descriptor.h>
#include <libdivecomputer/iterator.h>

#include <algorithm>
#include <cstdint>
#include <map>
#include <memory>
#include <mutex>
#include <set>
#include <thread>

using json = nlohmann::json;

namespace ssrf {

namespace {

event_sink g_sink = nullptr;
std::string g_directory;

thread_local std::vector<std::string> *t_error_sink = nullptr;

void emit(const json &event)
{
	if (g_sink)
		g_sink(event.dump());
}

enum class State {
	Idle,
	Running,
	Finished,  // Done. There may be no dives, which is "nothing new".
	Failed,    // There may be dives anyway, from before the failure.
	Cancelled, // Same.
};

const char *state_name(State state)
{
	switch (state) {
	case State::Idle:
		return "idle";
	case State::Running:
		return "running";
	case State::Finished:
		return "finished";
	case State::Failed:
		return "failed";
	case State::Cancelled:
		return "cancelled";
	}
	return "idle";
}

// What crosses between the download thread and the JS thread. `log` is only
// written under the core lock (dive_cb holds it), and every method here runs
// inside ssrf::call(), which holds the same lock.
struct Session {
	std::mutex mutex;
	State state = State::Idle;
	std::string text;
	double fraction = 0;
	std::string error;
	std::vector<std::string> errors;
	std::string vendor, product, address;
	unsigned int serial = 0;
	unsigned int firmware = 0;
	std::string model;
	std::string log_path;
	bool force = false;
	double last_emitted_fraction = -1;
	std::string last_emitted_text;
	struct divelog log;
};

// Replaced, not reset: a worker that is still on its way out keeps its own.
// Neither is ever destroyed, so process exit cannot pull them from under a thread.
std::shared_ptr<Session> &g_session = *new std::shared_ptr<Session>(std::make_shared<Session>());
// The worker reaches its session through this, from the plain function pointer
// that is upstream's progress_callback.
std::shared_ptr<Session> &g_running = *new std::shared_ptr<Session>();
std::mutex g_running_mutex;

json progress_event(Session &session)
{
	return json{
		{ "type", "download" },
		{ "state", state_name(session.state) },
		{ "text", session.text },
		{ "fraction", session.fraction },
	};
}

void on_progress(const std::string &text)
{
	std::shared_ptr<Session> session;
	{
		std::lock_guard<std::mutex> lock(g_running_mutex);
		session = g_running;
	}
	if (!session)
		return;
	json event;
	{
		std::lock_guard<std::mutex> lock(session->mutex);
		session->text = text;
		session->fraction = progress_bar_fraction;
		// libdivecomputer can report every packet; a percent is plenty.
		if (session->text == session->last_emitted_text && session->fraction < session->last_emitted_fraction + 0.01)
			return;
		session->last_emitted_text = session->text;
		session->last_emitted_fraction = session->fraction;
		event = progress_event(*session);
	}
	emit(event);
}

void run_download(const std::shared_ptr<Session> &session, bool sync_time, const std::string &bt_name)
{
	std::vector<std::string> errors;
	t_error_sink = &errors;

	device_data_t data;
	data.descriptor = const_cast<dc_descriptor_t *>(find_descriptor(session->vendor, session->product));
	data.vendor = session->vendor;
	data.product = session->product;
	data.devname = session->address;
	data.btname = bt_name;
	data.bluetooth_mode = true;
	data.force_download = session->force;
	data.sync_time = sync_time;
	data.log = &session->log;
	data.libdc_log = !session->log_path.empty();

	std::string error = do_libdivecomputer_import(&data);
	// The strings upstream returns take these three, or none of them.
	if (!error.empty())
		error = format_string_std(error.c_str(), data.vendor.c_str(), data.product.c_str(), data.devname.c_str());
	t_error_sink = nullptr;

	// Before the state below says this thread is done: from then on the JS thread
	// may start the next download, which sets both of these for itself.
	progress_callback = nullptr;
	{
		std::lock_guard<std::mutex> lock(g_running_mutex);
		g_running.reset();
	}

	json event;
	{
		std::lock_guard<std::mutex> lock(session->mutex);
		session->errors = std::move(errors);
		session->error = std::move(error);
		// DC_EVENT_DEVINFO may have told a more specific product than the picked one.
		session->vendor = data.vendor;
		session->product = data.product;
		session->model = data.model;
		session->serial = data.devinfo.serial;
		session->firmware = data.devinfo.firmware;
		if (import_thread_cancelled)
			session->state = State::Cancelled;
		else if (session->error.empty())
			session->state = State::Finished;
		else
			session->state = State::Failed;
		event = progress_event(*session);
	}
	data.descriptor = nullptr; // Owned by libdivecomputer's static table.
	emit(event);
}

json dive_row(const struct dive &d, int index)
{
	return json{
		{ "index", index },
		{ "when", static_cast<int64_t>(d.when) },
		{ "durationSec", d.duration.seconds },
		{ "maxDepthMm", d.maxdepth.mm },
	};
}

// --- Scanning --------------------------------------------------------------

struct ScanEntry {
	std::string name;
	int rssi = 0;
	std::optional<dc_identity> identity;
};

std::mutex g_scan_mutex;
std::map<std::string, ScanEntry> g_scan_results;
ble::AdapterState g_adapter = ble::AdapterState::Unknown;
bool g_scanning = false;

const char *adapter_name(ble::AdapterState state)
{
	switch (state) {
	case ble::AdapterState::Unknown:
		return "unknown";
	case ble::AdapterState::Unsupported:
		return "unsupported";
	case ble::AdapterState::Unauthorized:
		return "unauthorized";
	case ble::AdapterState::Off:
		return "off";
	case ble::AdapterState::On:
		return "on";
	}
	return "unknown";
}

json scan_entry_json(const std::string &address, const ScanEntry &entry)
{
	return json{
		{ "address", address },
		{ "name", entry.name },
		{ "rssi", entry.rssi },
		{ "vendor", entry.identity ? json(entry.identity->vendor) : json(nullptr) },
		{ "product", entry.identity ? json(entry.identity->product) : json(nullptr) },
	};
}

// The core lock is deliberately not needed for any of this: dc-detect only reads
// libdivecomputer's static table, and the driver's thread must not wait for a
// profile computation on the JS thread.
json scan_status_locked()
{
	json devices = json::array();
	for (const auto &[address, entry] : g_scan_results)
		devices.push_back(scan_entry_json(address, entry));
	return json{
		{ "adapter", adapter_name(g_adapter) },
		{ "scanning", g_scanning },
		{ "available", ble::gatt_driver() != nullptr },
		{ "devices", std::move(devices) },
	};
}

std::string required_string(const json &args, const char *key)
{
	const auto it = args.find(key);
	if (it == args.end() || !it->is_string() || it->get<std::string>().empty())
		throw api_error(std::string("missing required argument '") + key + "'");
	return it->get<std::string>();
}

} // namespace

void set_event_sink(event_sink sink)
{
	g_sink = sink;
}

void set_download_directory(const std::string &path)
{
	g_directory = path;
}

bool collect_thread_error(const std::string &message)
{
	if (!t_error_sink)
		return false;
	t_error_sink->push_back(message);
	return true;
}

json dc_list_computers()
{
	std::map<std::string, std::vector<std::string>> vendors;
	dc_iterator_t *iterator = nullptr;
	dc_descriptor_t *descriptor = nullptr;
	dc_descriptor_iterator(&iterator);
	while (dc_iterator_next(iterator, &descriptor) == DC_STATUS_SUCCESS) {
		// BLE is the one transport this app has. A later one (Android USB serial)
		// is added here and in download start. "FIT" is a pseudo-device for files.
		if (!(dc_descriptor_get_transports(descriptor) & DC_TRANSPORT_BLE))
			continue;
		const std::string vendor = dc_descriptor_get_vendor(descriptor);
		if (vendor == "FIT")
			continue;
		auto &products = vendors[vendor];
		const std::string product = dc_descriptor_get_product(descriptor);
		if (std::find(products.begin(), products.end(), product) == products.end())
			products.push_back(product);
	}
	dc_iterator_free(iterator);

	json out = json::array();
	for (auto &[vendor, products] : vendors) {
		std::sort(products.begin(), products.end());
		out.push_back(json{ { "vendor", vendor }, { "products", products } });
	}
	return out;
}

json dc_detect(const json &args)
{
	const auto identity = detect_dive_computer(required_string(args, "name"));
	if (!identity)
		return nullptr;
	return json{ { "vendor", identity->vendor }, { "product", identity->product } };
}

json dc_download_start(const json &args)
{
	{
		std::lock_guard<std::mutex> lock(g_session->mutex);
		if (g_session->state == State::Running)
			throw api_error("a download is already running");
	}
	const std::string vendor = required_string(args, "vendor");
	const std::string product = required_string(args, "product");
	const std::string address = required_string(args, "address");
	const dc_descriptor_t *descriptor = find_descriptor(vendor, product);
	if (!descriptor)
		throw api_error("unknown dive computer: " + vendor + " " + product);
	if (!(dc_descriptor_get_transports(descriptor) & DC_TRANSPORT_BLE))
		throw api_error(vendor + " " + product + " cannot be reached over Bluetooth LE");
	if (!ble::gatt_driver())
		throw api_error("Bluetooth is not available on this device");

	auto session = std::make_shared<Session>();
	session->state = State::Running;
	session->vendor = vendor;
	session->product = product;
	session->address = address;
	session->force = args.value("force", false);
	if (!g_directory.empty())
		session->log_path = g_directory + "/libdivecomputer.log";
	const bool sync_time = args.value("syncTime", false);
	const std::string bt_name = args.value("btName", std::string());

	g_session = session;
	import_thread_cancelled = 0;
	progress_bar_fraction = 0;
	progress_bar_text.clear();
	logfile_name = session->log_path;
	progress_callback = on_progress;
	{
		std::lock_guard<std::mutex> lock(g_running_mutex);
		g_running = session;
	}
	emit(progress_event(*session));
	// Detached: nothing waits for it, and the thread holds its session.
	std::thread([session, sync_time, bt_name] { run_download(session, sync_time, bt_name); }).detach();
	return json::object();
}

json dc_download_status()
{
	std::lock_guard<std::mutex> lock(g_session->mutex);
	const Session &s = *g_session;
	json dives = json::array();
	int index = 0;
	// Only worth building once it is over. The count is enough until then.
	if (s.state != State::Running) {
		for (const auto &d : s.log.dives)
			dives.push_back(dive_row(*d, index++));
	}
	return json{
		{ "state", state_name(s.state) },
		{ "text", s.text },
		{ "fraction", s.fraction },
		{ "error", s.error },
		{ "errors", s.errors },
		{ "vendor", s.vendor },
		{ "product", s.product },
		{ "address", s.address },
		{ "serial", s.serial },
		{ "firmware", s.firmware },
		{ "diveCount", static_cast<int>(s.log.dives.size()) },
		{ "dives", std::move(dives) },
		{ "logPath", s.log_path },
	};
}

json dc_download_cancel()
{
	import_thread_cancelled = 1;
	return json::object();
}

json dc_download_accept(const json &args, const download_merge &merge)
{
	std::lock_guard<std::mutex> lock(g_session->mutex);
	Session &s = *g_session;
	if (s.state == State::Running)
		throw api_error("the download is still running");
	const auto selection = args.find("indices");
	if (selection == args.end() || !selection->is_array())
		throw api_error("missing required argument 'indices'");

	std::set<int> keep;
	for (const json &entry : *selection) {
		if (!entry.is_number_integer())
			throw api_error("'indices' must hold dive indices");
		const int index = entry.get<int>();
		if (index < 0 || static_cast<size_t>(index) >= s.log.dives.size())
			throw api_error("no downloaded dive with index " + std::to_string(index));
		keep.insert(index);
	}

	// As upstream's DiveImportedModel::deleteDeselected.
	for (int index = static_cast<int>(s.log.dives.size()) - 1; index >= 0; index--) {
		if (!keep.count(index))
			s.log.dives.erase(s.log.dives.begin() + index);
	}

	const int imported = static_cast<int>(s.log.dives.size());
	json result = merge(s.log, imported);
	s.log.clear();
	s.state = State::Idle;
	return result;
}

json dc_download_discard()
{
	std::lock_guard<std::mutex> lock(g_session->mutex);
	if (g_session->state == State::Running)
		throw api_error("the download is still running");
	g_session->log.clear();
	g_session->state = State::Idle;
	return json::object();
}

json ble_scan_start(const json &args)
{
	ble::GattDriver *driver = ble::gatt_driver();
	if (!driver)
		throw api_error("Bluetooth is not available on this device");
	std::vector<std::string> known;
	if (const auto it = args.find("knownAddresses"); it != args.end() && it->is_array())
		known = it->get<std::vector<std::string>>();
	{
		std::lock_guard<std::mutex> lock(g_scan_mutex);
		g_scan_results.clear();
		g_scanning = true;
	}
	driver->start_scan(known, ble::serial_service_uuids());
	return json::object();
}

json ble_scan_stop()
{
	if (ble::GattDriver *driver = ble::gatt_driver())
		driver->stop_scan();
	std::lock_guard<std::mutex> lock(g_scan_mutex);
	g_scanning = false;
	return json::object();
}

json ble_scan_status()
{
	std::lock_guard<std::mutex> lock(g_scan_mutex);
	return scan_status_locked();
}

namespace ble {

void gatt_event_adapter_state(AdapterState state)
{
	{
		std::lock_guard<std::mutex> lock(g_scan_mutex);
		g_adapter = state;
	}
	emit(json{ { "type", "ble" }, { "adapter", adapter_name(state) } });
}

void gatt_event_device_found(const std::string &address, const std::string &name, int rssi)
{
	json device;
	{
		std::lock_guard<std::mutex> lock(g_scan_mutex);
		ScanEntry &entry = g_scan_results[address];
		// Advertisements come without a name now and then; keep the one we have.
		if (!name.empty() && entry.name != name) {
			entry.name = name;
			entry.identity = detect_dive_computer(name);
		}
		entry.rssi = rssi;
		device = scan_entry_json(address, entry);
	}
	emit(json{ { "type", "ble" }, { "device", std::move(device) } });
}

} // namespace ble

} // namespace ssrf
