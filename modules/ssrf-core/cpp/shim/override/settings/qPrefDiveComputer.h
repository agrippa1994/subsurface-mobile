// AI-generated (Claude)
//
// Qt-free replacement for core/settings/qPrefDiveComputer.h.
//
// Upstream backs this with QSettings and Qt properties; it remembers the last
// dive computer the user downloaded from. The mobile app does no downloading in
// v1 (imports come from Suunto DM/SDE files), and device.cpp reaches into it for
// exactly one query - "is this the default dive computer?" - which is always
// false without a download flow. `shim/qPrefDiveComputer.cpp` answers that.
#ifndef QPREFDIVECOMPUTER_H
#define QPREFDIVECOMPUTER_H

#include <string>

namespace qPrefDiveComputer {

// Empty until a download flow exists (task 13 territory at the earliest).
const std::string &device();

} // namespace qPrefDiveComputer

#endif // QPREFDIVECOMPUTER_H
