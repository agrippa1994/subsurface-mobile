#!/bin/bash
# AI-generated (Claude)
#
# Compiles the vendored core subset + shim for the macOS host and links the
# test driver in tests/. This exists purely as a fast iteration loop: an
# `expo run:ios` round trip costs minutes, this costs seconds, and the code
# being compiled is byte-identical (the iOS build uses the same cpp/generated/
# tree through the podspec).
#
#   ./scripts/build-host.sh          build and run the smoke test
#   ./scripts/build-host.sh --build  build only
#
# Host libxml2/libxslt come from the macOS SDK. On iOS the SDK ships the
# libraries but not the libxslt headers - that is task 04's problem.

set -euo pipefail

MODULE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$MODULE_ROOT/build/host"
GEN="$MODULE_ROOT/cpp/generated"
SDK="$(xcrun --sdk macosx --show-sdk-path)"

node "$MODULE_ROOT/scripts/vendor-core.mjs"

mkdir -p "$BUILD"

CXXFLAGS=(
	-std=c++20 -g -O0 -fno-omit-frame-pointer
	-isysroot "$SDK"
	-I"$GEN" -I"$GEN/core" -I"$MODULE_ROOT/cpp" -I"$MODULE_ROOT/cpp/shim/include"
	-I"$SDK/usr/include/libxml2"
	# The core is built without Qt; SUBSURFACE_MOBILE keeps the desktop-only
	# code paths (undo stack, printing, cloud) out of the vendored sources.
	-DSUBSURFACE_MOBILE
	-include "$MODULE_ROOT/cpp/shim/include/ssrf-stdlib-compat.h"
	-Wall -Wno-unused-parameter -Wno-unused-variable
)
CFLAGS=(-std=c11 -g -O0 -isysroot "$SDK" -I"$GEN" -I"$GEN/core")
LDFLAGS=(-isysroot "$SDK" -lxml2 -lxslt -lz -lsqlite3)

sources=()
while IFS= read -r f; do sources+=("$f"); done < <(
	# cpp/ already contains the vendored tree (cpp/generated) and the shim.
	find "$MODULE_ROOT/cpp" "$MODULE_ROOT/tests" \
		\( -name '*.cpp' -o -name '*.c' \) -print | sort
)

objects=()
failed=0
for src in "${sources[@]}"; do
	obj="$BUILD/$(echo "${src#"$MODULE_ROOT/"}" | tr '/' '_').o"
	objects+=("$obj")
	# Rebuild only what changed: the subset is ~35 translation units and a
	# full rebuild is slow enough to break the edit/compile rhythm.
	if [[ -f "$obj" && "$obj" -nt "$src" ]]; then continue; fi
	if [[ "$src" == *.c ]]; then
		cc "${CFLAGS[@]}" -c "$src" -o "$obj" || failed=1
	else
		c++ "${CXXFLAGS[@]}" -c "$src" -o "$obj" || failed=1
	fi
done

if [[ $failed -ne 0 ]]; then
	echo "[build-host] compilation failed" >&2
	exit 1
fi

c++ "${objects[@]}" "${LDFLAGS[@]}" -o "$BUILD/ssrf-smoke"
echo "[build-host] linked $BUILD/ssrf-smoke"

if [[ "${1:-}" != "--build" ]]; then
	"$BUILD/ssrf-smoke" "$@"
fi
