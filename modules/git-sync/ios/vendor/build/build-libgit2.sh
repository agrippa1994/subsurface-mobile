#!/bin/bash
# AI-generated (Claude)
#
# Cross-compiles libgit2 with SSH support as a static xcframework for iOS.
#
#   ./build-libgit2.sh
#
# Output: modules/git-sync/ios/vendor/libgit2.xcframework (device arm64 +
# simulator arm64/x86_64) and the git2 headers in ../include.
#
# The stack is libgit2 -> libssh2 -> OpenSSL's libcrypto (libssh2 does its own
# protocol and needs no libssl). The three archives of a slice are merged into
# one library, because an xcframework slice holds a single library. zlib is the
# SDK's, as it is for the core.
#
# Why OpenSSL rather than mbedTLS: libssh2 only supports ed25519 keys - the
# key type the app generates - with its OpenSSL backend.
#
# HTTPS is deliberately off: the sync talks SSH only. Turning it on later means
# picking a TLS backend that sees the iOS trust store (SecureTransport), not
# OpenSSL, which would ship without any CA roots.

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

MIN_IOS="16.4"

# Algorithms and protocols libssh2 never asks libcrypto for. Leaving them out
# is purely size: the committed archives are what every clone downloads.
OPENSSL_UNUSED=(
	no-aria no-bf no-blake2 no-camellia no-cast no-cmp no-cms no-comp no-ct
	no-gost no-idea no-mdc2 no-ocsp no-rc2 no-rc4 no-rc5 no-rmd160 no-scrypt
	no-seed no-siphash no-sm2 no-sm3 no-sm4 no-srp no-ts no-whirlpool
	no-ssl-trace no-dtls no-ocb no-sctp no-srtp no-argon2 no-ml-kem no-ml-dsa
	no-slh-dsa
)

VENDOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$VENDOR_DIR/build/.work"
OUT="$VENDOR_DIR/libgit2.xcframework"
JOBS="$(sysctl -n hw.ncpu)"

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

# Builds one (platform, arch) slice into $WORK/install-<platform>-<arch>.
build_slice() {
	local platform="$1" arch="$2" openssl_target="$3" min_flag="$4"
	local tag="$platform-$arch"
	local prefix="$WORK/install-$tag"
	local sdk_path
	sdk_path="$(xcrun --sdk "$platform" --show-sdk-path)"

	rm -rf "$prefix" "$WORK/src-$tag"
	mkdir -p "$WORK/src-$tag"
	tar xzf "openssl-${OPENSSL_VERSION}.tar.gz" -C "$WORK/src-$tag"
	tar xzf "libssh2-${LIBSSH2_VERSION}.tar.gz" -C "$WORK/src-$tag"
	tar xzf "libgit2-${LIBGIT2_VERSION}.tar.gz" -C "$WORK/src-$tag"

	echo "[libgit2] building OpenSSL $OPENSSL_VERSION for $tag"
	(
		cd "$WORK/src-$tag/openssl-${OPENSSL_VERSION}"
		./Configure "$openssl_target" \
			--prefix="$prefix" \
			--libdir=lib \
			"$min_flag" \
			no-shared no-module no-tests no-apps no-docs no-engine no-async \
			no-dso no-ui-console no-legacy no-quic \
			"${OPENSSL_UNUSED[@]}" \
			>configure.log 2>&1 || { tail -30 configure.log; exit 1; }
		make -j"$JOBS" build_libs >make.log 2>&1 || { tail -30 make.log; exit 1; }
		make install_dev >install.log 2>&1 || { tail -30 install.log; exit 1; }
	)

	local cmake_common=(
		-G Ninja
		-DCMAKE_BUILD_TYPE=Release
		-DCMAKE_SYSTEM_NAME=iOS
		-DCMAKE_OSX_SYSROOT="$sdk_path"
		-DCMAKE_OSX_ARCHITECTURES="$arch"
		-DCMAKE_OSX_DEPLOYMENT_TARGET="$MIN_IOS"
		-DCMAKE_INSTALL_PREFIX="$prefix"
		-DCMAKE_PREFIX_PATH="$prefix"
		-DCMAKE_FIND_ROOT_PATH="$prefix"
		# iOS executables need signing, so configure checks build static
		# libraries instead.
		-DCMAKE_TRY_COMPILE_TARGET_TYPE=STATIC_LIBRARY
		-DBUILD_SHARED_LIBS=OFF
		-DCMAKE_DISABLE_FIND_PACKAGE_PkgConfig=ON
	)

	echo "[libgit2] building libssh2 $LIBSSH2_VERSION for $tag"
	(
		cd "$WORK/src-$tag/libssh2-${LIBSSH2_VERSION}"
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

	echo "[libgit2] building libgit2 $LIBGIT2_VERSION for $tag"
	(
		cd "$WORK/src-$tag/libgit2-${LIBGIT2_VERSION}"
		# HAVE_LIBSSH2_MEMORY_CREDENTIALS is preseeded: the configure check
		# for it cannot link against a static libssh2 without OpenSSL on the
		# line, and the app only ever hands keys over in memory - the private
		# key lives in the keychain, never in a file libgit2 could read.
		cmake -S . -B build "${cmake_common[@]}" \
			-DUSE_SSH=libssh2 \
			-DLIBSSH2_INCLUDE_DIR="$prefix/include" \
			-DLIBSSH2_LIBRARY="$prefix/lib/libssh2.a" \
			-DHAVE_LIBSSH2_MEMORY_CREDENTIALS=1 \
			-DUSE_HTTPS=OFF \
			-DUSE_SHA1=CollisionDetection \
			-DUSE_SHA256=Builtin \
			-DUSE_BUNDLED_ZLIB=OFF \
			-DZLIB_INCLUDE_DIR="$sdk_path/usr/include" \
			-DZLIB_LIBRARY="$sdk_path/usr/lib/libz.tbd" \
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

	libtool -static -o "$prefix/lib/libgit2-combined.a" \
		"$prefix/lib/libgit2.a" "$prefix/lib/libssh2.a" "$prefix/lib/libcrypto.a" 2>/dev/null
	# Debug info only; the symbols the app links against stay.
	strip -S "$prefix/lib/libgit2-combined.a" 2>/dev/null
}

build_slice iphoneos arm64 ios64-xcrun "-mios-version-min=$MIN_IOS"
# Both simulator architectures, for the same reason as libxslt: a generic
# simulator build compiles arm64 and x86_64, and a missing slice fails the link.
build_slice iphonesimulator arm64 iossimulator-arm64-xcrun "-mios-simulator-version-min=$MIN_IOS"
build_slice iphonesimulator x86_64 iossimulator-x86_64-xcrun "-mios-simulator-version-min=$MIN_IOS"

lipo -create \
	"$WORK/install-iphonesimulator-arm64/lib/libgit2-combined.a" \
	"$WORK/install-iphonesimulator-x86_64/lib/libgit2-combined.a" \
	-output "$WORK/libgit2-simulator.a"

rm -rf "$OUT"
# No -headers, for the reason given in ssrf-core's build-libxslt.sh: headers
# attached to the xcframework become public headers of the pod.
xcodebuild -create-xcframework \
	-library "$WORK/install-iphoneos-arm64/lib/libgit2-combined.a" \
	-library "$WORK/libgit2-simulator.a" \
	-output "$OUT" >/dev/null

rm -rf "$VENDOR_DIR/include"
mkdir -p "$VENDOR_DIR/include"
cp -R "$WORK/install-iphoneos-arm64/include/git2" "$WORK/install-iphoneos-arm64/include/git2.h" \
	"$VENDOR_DIR/include/"

echo "[libgit2] wrote $OUT and $VENDOR_DIR/include" \
	"(libgit2 $LIBGIT2_VERSION, libssh2 $LIBSSH2_VERSION, OpenSSL $OPENSSL_VERSION)"
