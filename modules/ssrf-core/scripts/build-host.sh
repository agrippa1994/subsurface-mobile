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
#   ./scripts/build-host.sh --asan   build only, with AddressSanitizer, into
#                                    build/asan (the vitest suite uses
#                                    build/host, so the two never collide)
#   ./scripts/build-host.sh --tsan   build only, with ThreadSanitizer, into
#                                    build/tsan. The dive computer download is
#                                    the only multi-threaded code in the module;
#                                    SSRF_HOST_BINARY runs its tests against this.
#
# The sanitizer build is worth running against the whole fixture corpus after
# any change to the shim or the bindings: it is how the dangling `current_dive`
# in shim/selection.cpp and the upstream o2-sensor overflow (once patch 0005) were
# found, both of which only showed up as rare, silent data corruption otherwise.
#
# Host libxml2/libxslt come from the macOS SDK. On iOS the SDK ships the
# libraries but not the libxslt headers - that is task 04's problem.

set -euo pipefail

MODULE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GEN="$MODULE_ROOT/cpp/generated"
SDK="$(xcrun --sdk macosx --show-sdk-path)"

ASAN=()
BUILD="$MODULE_ROOT/build/host"
if [[ "${1:-}" == "--asan" ]]; then
	# -O1 keeps the sanitized build usable; -O0 makes it crawl.
	ASAN=(-fsanitize=address -O1)
	BUILD="$MODULE_ROOT/build/asan"
	shift
	set -- --build "$@"
fi

if [[ "${1:-}" == "--tsan" ]]; then
	ASAN=(-fsanitize=thread -O1)
	BUILD="$MODULE_ROOT/build/tsan"
	shift
	set -- --build "$@"
fi

node "$MODULE_ROOT/scripts/vendor-core.mjs"

mkdir -p "$BUILD"

CXXFLAGS=(
	-std=c++20 -g -O0 -fno-omit-frame-pointer
	-isysroot "$SDK"
	-I"$GEN" -I"$GEN/core" -I"$MODULE_ROOT/cpp" -I"$MODULE_ROOT/cpp/shim/include"
	-I"$MODULE_ROOT/cpp/third_party"
	-I"$SDK/usr/include/libxml2"
	# The core is built without Qt; SUBSURFACE_MOBILE keeps the desktop-only
	# code paths (undo stack, printing, cloud) out of the vendored sources.
	-DSUBSURFACE_MOBILE
	-include "$MODULE_ROOT/cpp/shim/include/ssrf-stdlib-compat.h"
	-Wall -Wno-unused-parameter -Wno-unused-variable
	# Last, so the sanitizer build's -O1 overrides the -O0 above.
	${ASAN[@]+"${ASAN[@]}"}
)
# gnu11, not c11: libdivecomputer uses POSIX and BSD calls that strict C hides.
CFLAGS=(-std=gnu11 -g -O0 -isysroot "$SDK" -I"$GEN" -DHAVE_CONFIG_H -Wno-everything ${ASAN[@]+"${ASAN[@]}"})
LDFLAGS=(-isysroot "$SDK" -lxml2 -lxslt -lz -lsqlite3 ${ASAN[@]+"${ASAN[@]}"})

# vendor-core re-copies the whole subset whenever an input changes, which makes
# every core object look stale; ccache turns that full rebuild into cache hits.
# Same switch as the iOS build (expo-build-properties ccacheEnabled), and
# optional in the same way: without ccache the compilers run directly.
CCACHE=()
if command -v ccache >/dev/null; then CCACHE=(ccache); fi

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
		${CCACHE[@]+"${CCACHE[@]}"} cc "${CFLAGS[@]}" -c "$src" -o "$obj" || failed=1
	else
		${CCACHE[@]+"${CCACHE[@]}"} c++ "${CXXFLAGS[@]}" -c "$src" -o "$obj" || failed=1
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
