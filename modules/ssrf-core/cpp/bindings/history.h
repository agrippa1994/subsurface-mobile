// AI-generated (Claude)
// Undo and redo for the logbook.
//
// Wraps the dispatch in api.cpp rather than each mutation: a method this file does
// not know is taken to change the log, so a new mutation has undo from its first
// line. See history.cpp for how, and docs/tasks/PROGRESS.md for why.
#pragma once

#include <functional>
#include <optional>
#include <string>

#include "marshal.h"

namespace ssrf {

using history_dispatch = std::function<json(const std::string &method, const json &args)>;

// Runs `method`, through `dispatch` or as one of the history's own methods
// (undo, redo, historyState, clearHistory), and records any change it makes to
// the log. Rethrows whatever `dispatch` threw, having recorded what it had changed
// by then.
json history_run(const std::string &method, const json &args, const history_dispatch &dispatch);

// The exact XML of the state an undo or redo just restored, until the log next
// changes: what a save writes then, so that an undo gives back the very file.
std::optional<std::string> history_restored_xml();

// The history's state if the call just made changed it, for the reply's envelope:
// every path that changes the log then updates the screens without saying so.
std::optional<json> history_take_change();

} // namespace ssrf
