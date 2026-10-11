#!/bin/bash
# AI-generated (Claude)
#
# Cross-compiles the C libraries the core needs as static libraries for
# Android: libxml2, libxslt (+ libexslt) and SQLite. The counterpart of
# ios/vendor/build/build-libxslt.sh.
#
#   ./build-deps.sh
#
# Output: modules/ssrf-core/android/vendor/<abi>/lib{xml2,xslt,exslt,sqlite3}.a
# for arm64-v8a (devices, Apple Silicon emulators) and x86_64 (Intel
# emulators), and the public headers in ../include.
#
# On iOS only libxslt has to be built: the SDK ships libxml2 and SQLite. The
# NDK ships neither, so both are built here too. SQLite is what the Suunto
# DM4/DM5 importer reads its databases with; the version matches the iOS 26
# SDK's. zlib is the NDK's (libz is a stable NDK system library), as it is the
# SDK's on iOS.
# Every optional libxml2 feature the core does not use is off: no network
# I/O, no iconv (bionic has no full iconv before API 28, and the core only
# feeds UTF-8), no ICU, no Python.

set -euo pipefail

LIBXML2_VERSION="2.13.8"
LIBXML2_SHA256="277294cb33119ab71b2bc81f2f445e9bc9435b893ad15bb2cd2b0e859a0ee84a"
LIBXML2_URL="https://download.gnome.org/sources/libxml2/2.13/libxml2-${LIBXML2_VERSION}.tar.xz"

LIBXSLT_VERSION="1.1.43"
LIBXSLT_SHA256="5a3d6b383ca5afc235b171118e90f5ff6aa27e9fea3303065231a6d403f0183a"
LIBXSLT_URL="https://download.gnome.org/sources/libxslt/1.1/libxslt-${LIBXSLT_VERSION}.tar.xz"

SQLITE_VERSION="3540000"
SQLITE_SHA256="68e913b0fe8ec6b4e5f391c594a28872884e80d6cd042a1e50c957be46b5aa4d"
SQLITE_URL="https://www.sqlite.org/2026/sqlite-amalgamation-${SQLITE_VERSION}.zip"

# The app's minSdkVersion (React Native's default).
ANDROID_API=24
ABIS=(arm64-v8a x86_64)

VENDOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$VENDOR_DIR/build/.work"
JOBS="$(sysctl -n hw.ncpu 2>/dev/null || nproc)"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
# The NDK React Native builds the app with (gradle/libs.versions.toml), so the
# archives and the module are compiled by the same toolchain.
NDK_VERSION="27.1.12297006"
NDK="${ANDROID_NDK_HOME:-$SDK/ndk/$NDK_VERSION}"
TOOLCHAIN="$NDK/build/cmake/android.toolchain.cmake"
[[ -f "$TOOLCHAIN" ]] || { echo "Android NDK not found (looked in $NDK)"; exit 1; }

mkdir -p "$WORK"
cd "$WORK"

fetch() {
	local url="$1" sha="$2" file="$3"
	if [[ ! -f "$file" ]]; then
		echo "[deps] downloading $file"
		curl -fsSL "$url" -o "$file"
	fi
	echo "$sha  $file" | shasum -a 256 -c - >/dev/null
}

fetch "$LIBXML2_URL" "$LIBXML2_SHA256" "libxml2-${LIBXML2_VERSION}.tar.xz"
fetch "$LIBXSLT_URL" "$LIBXSLT_SHA256" "libxslt-${LIBXSLT_VERSION}.tar.xz"
fetch "$SQLITE_URL" "$SQLITE_SHA256" "sqlite-amalgamation-${SQLITE_VERSION}.zip"
rm -rf "sqlite-amalgamation-${SQLITE_VERSION}"
unzip -q "sqlite-amalgamation-${SQLITE_VERSION}.zip"

build_abi() {
	local abi="$1"
	local prefix="$WORK/install-$abi"
	local src="$WORK/src-$abi"

	rm -rf "$prefix" "$src"
	mkdir -p "$src"
	tar xf "libxml2-${LIBXML2_VERSION}.tar.xz" -C "$src"
	tar xf "libxslt-${LIBXSLT_VERSION}.tar.xz" -C "$src"

	local cmake_common=(
		-G Ninja
		-DCMAKE_BUILD_TYPE=Release
		-DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN"
		-DANDROID_ABI="$abi"
		-DANDROID_PLATFORM="android-$ANDROID_API"
		-DCMAKE_INSTALL_PREFIX="$prefix"
		-DCMAKE_PREFIX_PATH="$prefix"
		-DCMAKE_FIND_ROOT_PATH="$prefix"
		-DCMAKE_POSITION_INDEPENDENT_CODE=ON
		-DBUILD_SHARED_LIBS=OFF
	)

	echo "[deps] building libxml2 $LIBXML2_VERSION for $abi"
	(
		cd "$src/libxml2-${LIBXML2_VERSION}"
		cmake -S . -B build "${cmake_common[@]}" \
			-DLIBXML2_WITH_ICONV=OFF \
			-DLIBXML2_WITH_ICU=OFF \
			-DLIBXML2_WITH_LZMA=OFF \
			-DLIBXML2_WITH_ZLIB=ON \
			-DLIBXML2_WITH_HTTP=OFF \
			-DLIBXML2_WITH_FTP=OFF \
			-DLIBXML2_WITH_PYTHON=OFF \
			-DLIBXML2_WITH_PROGRAMS=OFF \
			-DLIBXML2_WITH_TESTS=OFF \
			-DLIBXML2_WITH_DEBUG=OFF \
			>configure.log 2>&1 || { tail -30 configure.log; exit 1; }
		cmake --build build -j"$JOBS" >make.log 2>&1 || { tail -30 make.log; exit 1; }
		cmake --install build >install.log 2>&1
	)

	echo "[deps] building libxslt $LIBXSLT_VERSION for $abi"
	(
		cd "$src/libxslt-${LIBXSLT_VERSION}"
		cmake -S . -B build "${cmake_common[@]}" \
			-DLibXml2_DIR="$prefix/lib/cmake/libxml2-${LIBXML2_VERSION}" \
			-DLIBXSLT_WITH_CRYPTO=OFF \
			-DLIBXSLT_WITH_DEBUGGER=OFF \
			-DLIBXSLT_WITH_MODULES=OFF \
			-DLIBXSLT_WITH_PROFILER=OFF \
			-DLIBXSLT_WITH_PROGRAMS=OFF \
			-DLIBXSLT_WITH_PYTHON=OFF \
			-DLIBXSLT_WITH_TESTS=OFF \
			>configure.log 2>&1 || { tail -30 configure.log; exit 1; }
		cmake --build build -j"$JOBS" >make.log 2>&1 || { tail -30 make.log; exit 1; }
		cmake --install build >install.log 2>&1
	)

	echo "[deps] building SQLite $SQLITE_VERSION for $abi"
	(
		# The amalgamation is one C file; a two-line CMake project is the
		# simplest way to compile it with the NDK toolchain's flags.
		local sqlite="$src/sqlite"
		mkdir -p "$sqlite"
		cp "$WORK/sqlite-amalgamation-${SQLITE_VERSION}"/sqlite3.{c,h} "$sqlite/"
		cat > "$sqlite/CMakeLists.txt" <<'CMAKE'
cmake_minimum_required(VERSION 3.22)
project(sqlite3 C)
add_library(sqlite3 STATIC sqlite3.c)
# Threadsafe (the default), no extension loading (no dlopen of arbitrary code).
target_compile_definitions(sqlite3 PRIVATE SQLITE_OMIT_LOAD_EXTENSION SQLITE_DQS=0)
install(TARGETS sqlite3 ARCHIVE DESTINATION lib)
install(FILES sqlite3.h DESTINATION include)
CMAKE
		cd "$sqlite"
		cmake -S . -B build "${cmake_common[@]}" >configure.log 2>&1 || { tail -30 configure.log; exit 1; }
		cmake --build build -j"$JOBS" >make.log 2>&1 || { tail -30 make.log; exit 1; }
		cmake --install build >install.log 2>&1
	)

	rm -rf "${VENDOR_DIR:?}/$abi"
	mkdir -p "$VENDOR_DIR/$abi"
	local strip="$NDK/toolchains/llvm/prebuilt/$(ls "$NDK/toolchains/llvm/prebuilt" | head -1)/bin/llvm-strip"
	for lib in libxml2 libxslt libexslt libsqlite3; do
		cp "$prefix/lib/$lib.a" "$VENDOR_DIR/$abi/"
		# Debug info only; the symbols the module links against stay.
		"$strip" -S "$VENDOR_DIR/$abi/$lib.a"
	done
}

for abi in "${ABIS[@]}"; do
	build_abi "$abi"
done

# Every ABI's headers are identical (same configure options), so one copy
# serves all of them. libxml2's land under include/libxml2/libxml, which is
# where the module's CMakeLists.txt points, the same layout as the iOS SDK.
rm -rf "$VENDOR_DIR/include"
mkdir -p "$VENDOR_DIR/include"
first="$WORK/install-${ABIS[0]}/include"
cp -R "$first/libxml2" "$first/libxslt" "$first/libexslt" "$first/sqlite3.h" "$VENDOR_DIR/include/"

echo "[deps] wrote $VENDOR_DIR/{$(IFS=,; echo "${ABIS[*]}")} and $VENDOR_DIR/include" \
	"(libxml2 $LIBXML2_VERSION, libxslt $LIBXSLT_VERSION, SQLite $SQLITE_VERSION)"
