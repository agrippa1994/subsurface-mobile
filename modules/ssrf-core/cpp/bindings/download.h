// AI-generated (Claude)
//
// Downloading dives from a dive computer: the session behind the dc* and ble*
// methods of api.cpp. See cpp/API.md.
//
// The download runs on its own thread, through upstream's
// do_libdivecomputer_import(), into a log of its own. Nothing reaches the
// module's divelog until the user has reviewed it and dcDownloadAccept merges it.
#pragma once

#include <nlohmann/json.hpp>

#include <functional>
#include <string>
#include <vector>

struct divelog;

namespace ssrf {

// Pushes a JSON event to the app, from any thread: { "type": "download" | "ble" ...}.
// Set once by the platform glue; the host has none, and polls dcDownloadStatus.
using event_sink = void (*)(const std::string &json);
void set_event_sink(event_sink sink);

// Set by api.cpp: merges a downloaded log, like an imported one.
using download_merge = std::function<nlohmann::json(struct divelog &log, int imported)>;

nlohmann::json dc_list_computers();
nlohmann::json dc_detect(const nlohmann::json &args);
nlohmann::json dc_download_start(const nlohmann::json &args);
nlohmann::json dc_download_status();
nlohmann::json dc_download_cancel();
nlohmann::json dc_download_accept(const nlohmann::json &args, const download_merge &merge);
nlohmann::json dc_download_discard();
nlohmann::json ble_scan_start(const nlohmann::json &args);
nlohmann::json ble_scan_stop();
nlohmann::json ble_scan_status();

// Where fingerprints and the libdivecomputer log go.
void set_download_directory(const std::string &path);

// True on a download thread, which keeps report_error() messages for its status.
bool collect_thread_error(const std::string &message);

} // namespace ssrf
