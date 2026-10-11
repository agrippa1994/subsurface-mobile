#!/bin/bash
# AI-generated (Claude)
#
# Cross-compiles libgit2 with SSH support as static libraries for Android, the
# counterpart of ios/vendor/build/build-libgit2.sh (same versions, same
# options - see that script for why each one is what it is).
#
#   ./build-libgit2.sh
#
# Output: modules/git-sync/android/vendor/<abi>/lib{git2,ssh2,crypto}.a for
# arm64-v8a and x86_64, and the git2 and OpenSSL headers in ../include (the
# JNI bridge uses libcrypto directly for Ed25519 key generation and SHA-256).
#
# zlib is the NDK's.

set -euo pipefail

OPENSSL_VERSION="3.5.9"
OPENSSL_SHA256="603f5602e2eef00d77fbd429d34dcd5822bb301757a1bc9cdb24c670f1eb859a"
OPENSSL_URL="https://github.com/openssl/openssl/releases/download/openssl-${OPENSSL_VERSION}/openssl-${OPENSSL_VERSION}.tar.gz"

LIBSSH2_VERSION="1.11.1"
LIBSSH2_SHA256="d9ec76cbe34db98eec3539fe2c899d26b0c837cb3eb466a56b0f109cabf658f7"
LIBSSH2_URL="https://github.com/libssh2/libssh2/releases/download/libssh2-${LIBSSH2_VERSION}/libssh2-${LIBSSH2_VERSION}.tar.gz"

LIBGIT2_VERSION="1.9.7"
LIBGIT2_SHA256="1a4fbe7589e814777ae76b64734ad80f4ecad22cd33a22682a2aaea4ae5375e7"
LIBGIT2_URL="https://github.com/libgit2/libgit2/archive/refs/tags/v${LIBGIT2_VERSION}.tar.gz"

# The app's minSdkVersion (React Native's default).
ANDROID_API=24

OPENSSL_UNUSED=(
	no-aria no-bf no-blake2 no-camellia no-cast no-cmp no-cms no-comp no-ct
	no-gost no-idea no-mdc2 no-ocsp no-rc2 no-rc4 no-rc5 no-rmd160 no-scrypt
	no-seed no-siphash no-sm2 no-sm3 no-sm4 no-srp no-ts no-whirlpool
	no-ssl-trace no-dtls no-ocb no-sctp no-srtp no-argon2 no-ml-kem no-ml-dsa
	no-slh-dsa
)

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
LLVM_BIN="$NDK/toolchains/llvm/prebuilt/$(ls "$NDK/toolchains/llvm/prebuilt" | head -1)/bin"

mkdir -p "$WORK"
cd "$WORK"

fetch() {
	local url="$1" sha="$2" file="$3"
	if [[ ! -f "$file" ]]; then
		echo "[libgit2] downloading $file"
		curl -fsSL "$url" -o "$file"
	fi
	echo "$sha  $file" | shasum -a 256 -c - >/dev/null
}

fetch "$OPENSSL_URL" "$OPENSSL_SHA256" "openssl-${OPENSSL_VERSION}.tar.gz"
fetch "$LIBSSH2_URL" "$LIBSSH2_SHA256" "libssh2-${LIBSSH2_VERSION}.tar.gz"
fetch "$LIBGIT2_URL" "$LIBGIT2_SHA256" "libgit2-${LIBGIT2_VERSION}.tar.gz"

build_abi() {
	local abi="$1" openssl_target="$2"
	local prefix="$WORK/install-$abi"
	local src="$WORK/src-$abi"

	rm -rf "$prefix" "$src"
	mkdir -p "$src"
	tar xzf "openssl-${OPENSSL_VERSION}.tar.gz" -C "$src"
	tar xzf "libssh2-${LIBSSH2_VERSION}.tar.gz" -C "$src"
	tar xzf "libgit2-${LIBGIT2_VERSION}.tar.gz" -C "$src"

	echo "[libgit2] building OpenSSL $OPENSSL_VERSION for $abi"
	(
		cd "$src/openssl-${OPENSSL_VERSION}"
		# OpenSSL's android-* targets find clang through PATH and the NDK
		# through ANDROID_NDK_ROOT.
		PATH="$LLVM_BIN:$PATH" ANDROID_NDK_ROOT="$NDK" \
		./Configure "$openssl_target" \
			-D__ANDROID_API__="$ANDROID_API" \
			--prefix="$prefix" \
			--libdir=lib \
			no-shared no-module no-tests no-apps no-docs no-engine no-async \
			no-dso no-ui-console no-legacy no-quic \
			"${OPENSSL_UNUSED[@]}" \
			>configure.log 2>&1 || { tail -30 configure.log; exit 1; }
		PATH="$LLVM_BIN:$PATH" ANDROID_NDK_ROOT="$NDK" \
			make -j"$JOBS" build_libs >make.log 2>&1 || { tail -30 make.log; exit 1; }
		make install_dev >install.log 2>&1 || { tail -30 install.log; exit 1; }
	)

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
		-DCMAKE_DISABLE_FIND_PACKAGE_PkgConfig=ON
	)

	echo "[libgit2] building libssh2 $LIBSSH2_VERSION for $abi"
	(
		cd "$src/libssh2-${LIBSSH2_VERSION}"
		cmake -S . -B build "${cmake_common[@]}" \
			-DCRYPTO_BACKEND=OpenSSL \
			-DOPENSSL_ROOT_DIR="$prefix" \
			-DOPENSSL_USE_STATIC_LIBS=ON \
			-DENABLE_ZLIB_COMPRESSION=OFF \
			-DBUILD_EXAMPLES=OFF \
			-DBUILD_TESTING=OFF \
			>configure.log 2>&1 || { tail -30 configure.log; exit 1; }
		cmake --build build -j"$JOBS" >make.log 2>&1 || { tail -30 make.log; exit 1; }
		cmake --install build >install.log 2>&1
	)

	echo "[libgit2] building libgit2 $LIBGIT2_VERSION for $abi"
	(
		cd "$src/libgit2-${LIBGIT2_VERSION}"
		# HAVE_LIBSSH2_MEMORY_CREDENTIALS is preseeded, as on iOS: the check
		# cannot link a static libssh2 without OpenSSL on the line.
		cmake -S . -B build "${cmake_common[@]}" \
			-DUSE_SSH=libssh2 \
			-DLIBSSH2_INCLUDE_DIR="$prefix/include" \
			-DLIBSSH2_LIBRARY="$prefix/lib/libssh2.a" \
			-DHAVE_LIBSSH2_MEMORY_CREDENTIALS=1 \
			-DUSE_HTTPS=OFF \
			-DUSE_SHA1=CollisionDetection \
			-DUSE_SHA256=Builtin \
			-DUSE_BUNDLED_ZLIB=OFF \
			-DUSE_ICONV=OFF \
			-DUSE_GSSAPI=OFF \
			-DUSE_NTLMCLIENT=OFF \
			-DREGEX_BACKEND=builtin \
			-DUSE_HTTP_PARSER=builtin \
			-DBUILD_TESTS=OFF \
			-DBUILD_CLI=OFF \
			-DBUILD_EXAMPLES=OFF \
			>configure.log 2>&1 || { tail -30 configure.log; exit 1; }
		grep -q "GIT_SSH_LIBSSH2_MEMORY_CREDENTIALS 1" build/gen_headers/git2_features.h \
			|| { echo "libgit2 configured without in-memory SSH keys"; exit 1; }
		cmake --build build -j"$JOBS" >make.log 2>&1 || { tail -30 make.log; exit 1; }
		cmake --install build >install.log 2>&1
	)

	rm -rf "${VENDOR_DIR:?}/$abi"
	mkdir -p "$VENDOR_DIR/$abi"
	for lib in libgit2 libssh2 libcrypto; do
		cp "$prefix/lib/$lib.a" "$VENDOR_DIR/$abi/"
		# Debug info only; the symbols the module links against stay.
		"$LLVM_BIN/llvm-strip" -S "$VENDOR_DIR/$abi/$lib.a"
	done
}

build_abi arm64-v8a android-arm64
build_abi x86_64 android-x86_64

rm -rf "$VENDOR_DIR/include"
mkdir -p "$VENDOR_DIR/include"
first="$WORK/install-arm64-v8a/include"
cp -R "$first/git2" "$first/git2.h" "$first/openssl" "$VENDOR_DIR/include/"

echo "[libgit2] wrote $VENDOR_DIR/{arm64-v8a,x86_64} and $VENDOR_DIR/include" \
	"(libgit2 $LIBGIT2_VERSION, libssh2 $LIBSSH2_VERSION, OpenSSL $OPENSSL_VERSION)"
