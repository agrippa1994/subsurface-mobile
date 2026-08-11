// AI-generated (Claude)
//
// Force-included (via -include) into every core translation unit.
//
// Several core files use std::accumulate / std::iota without including
// <numeric>: in the desktop build a Qt header drags it in transitively. With Qt
// gone the omission surfaces as a compile error in upstream code we must not
// edit, so the include is supplied from outside instead. Keep this list short -
// each entry is a papered-over upstream omission, not a place to add helpers.
#pragma once

#ifdef __cplusplus
#include <numeric>
#endif
