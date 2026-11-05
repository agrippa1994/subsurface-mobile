// AI-generated (Claude)
//
// A simulated BLE dive computer for the host driver: speaks the real Deep Six
// Excursion protocol over a fake GATT stack, so a download from it goes through
// the same code as one from hardware - ble-stream.cpp, libdivecomputer's device
// and parser backends, upstream's dive_cb and fingerprint logic.
#pragma once

#include <string>

void install_fake_dive_computer();

// Handles the sim.* methods of the repl. Replies with the usual envelope.
std::string fake_dive_computer_call(const std::string &method, const std::string &args_json);
