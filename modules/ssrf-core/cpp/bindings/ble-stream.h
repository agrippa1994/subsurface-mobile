// AI-generated (Claude)
//
// libdivecomputer's I/O stream over the GATT driver, and what the upstream code
// expects of a BLE transport: `ble_packet_open()` is declared in
// core/libdivecomputer.h and defined in ble-stream.cpp, replacing the Qt one in
// core/qtserialbluetooth.cpp.
#pragma once

#include "gatt-driver.h"

#include <string>
#include <vector>

namespace ssrf::ble {

// The known serial services, most specific first (the same list as qt-ble.cpp).
std::vector<std::string> serial_service_uuids();

// Picks the service that carries the serial data out of everything the device
// exposes, or null if there is none. Exposed for the tests: getting this wrong is
// how "Unable to open" happens on a dive computer nobody here owns.
const Service *select_serial_service(const std::vector<Service> &services);

} // namespace ssrf::ble
