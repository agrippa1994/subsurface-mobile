#!/bin/bash
# AI-generated (Claude)
#
# Cross-compiles libxslt (+ libexslt) as a static xcframework for iOS.
#
#   ./build-libxslt.sh
#
# Output: modules/ssrf-core/ios/vendor/libxslt.xcframework (device arm64 +
# simulator arm64), with the public headers attached.
#
# Why we build it at all: the iOS SDK ships libxslt.tbd but *no* libxslt
# headers, so the core's `#include <libxslt/transform.h>` cannot resolve.
# Building from source also pins the version instead of inheriting whatever
# Apple shipped (SDK 26.5 carries 1.1.35).
#
# libxslt needs libxml2. The iOS SDK does ship that one complete with headers,
# so we point libxslt at it through a stub xml2-config - upstream's configure
# only ever asks that script for flags.

set -euo pipefail

VERSION="1.1.43"
SHA256="5a3d6b383ca5afc235b171118e90f5ff6aa27e9fea3303065231a6d403f0183a"
URL="https://download.gnome.org/sources/libxslt/1.1/libxslt-${VERSION}.tar.xz"

VENDOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$VENDOR_DIR/build/.work"
OUT="$VENDOR_DIR/libxslt.xcframework"

mkdir -p "$WORK"
cd "$WORK"

tarball="libxslt-${VERSION}.tar.xz"
if [[ ! -f "$tarball" ]]; then
	echo "[libxslt] downloading $VERSION"
	curl -fsSL "$URL" -o "$tarball"
fi
echo "$SHA256  $tarball" | shasum -a 256 -c - >/dev/null

rm -rf "libxslt-${VERSION}"
tar xf "$tarball"

# Builds one (platform, arch) slice into $WORK/install-<platform>.
build_slice() {
	local platform="$1" arch="$2" min_flag="$3"
	local sdk_path prefix src
	sdk_path="$(xcrun --sdk "$platform" --show-sdk-path)"
	prefix="$WORK/install-$platform-$arch"
	src="$WORK/build-$platform-$arch"

	rm -rf "$prefix" "$src"
	cp -R "libxslt-${VERSION}" "$src"

	# Stub xml2-config: libxslt's configure shells out to it for the libxml2
	# cflags/libs. The SDK has the library and headers but not the script.
	local fake_bin="$WORK/bin-$platform-$arch"
	mkdir -p "$fake_bin"
	cat > "$fake_bin/xml2-config" <<EOF
#!/bin/bash
case "\$1" in
	--version) echo "2.9.13" ;;
	--cflags)  echo "-I$sdk_path/usr/include/libxml2" ;;
	--libs)    echo "-lxml2 -lz -lm" ;;
	--prefix)  echo "$sdk_path/usr" ;;
	*)         echo "" ;;
esac
EOF
	chmod +x "$fake_bin/xml2-config"

	local cflags="-arch $arch -isysroot $sdk_path $min_flag -O2"

	echo "[libxslt] building $platform/$arch"
	(
		cd "$src"
		PATH="$fake_bin:$PATH" \
		CC="$(xcrun -f clang)" \
		CFLAGS="$cflags" \
		LDFLAGS="-arch $arch -isysroot $sdk_path $min_flag" \
		./configure \
			--host="${arch}-apple-darwin" \
			--prefix="$prefix" \
			--enable-static \
			--disable-shared \
			--without-python \
			--without-crypto \
			--without-debug \
			--without-plugins \
			>configure.log 2>&1 || { tail -30 configure.log; exit 1; }
		make -j"$(sysctl -n hw.ncpu)" >make.log 2>&1 || { tail -30 make.log; exit 1; }
		make install >install.log 2>&1
	)

	# libexslt is a separate archive; the core links both, so merge them into
	# one static library per slice - an xcframework slice is a single library.
	libtool -static -o "$prefix/lib/libxslt-combined.a" \
		"$prefix/lib/libxslt.a" "$prefix/lib/libexslt.a" 2>/dev/null
}

build_slice iphoneos arm64 "-miphoneos-version-min=16.4"
# The simulator slice covers both host architectures: a generic
# "platform=iOS Simulator" build compiles arm64 *and* x86_64, and a slice
# missing either one fails the link.
build_slice iphonesimulator arm64 "-mios-simulator-version-min=16.4"
build_slice iphonesimulator x86_64 "-mios-simulator-version-min=16.4"

lipo -create \
	"$WORK/install-iphonesimulator-arm64/lib/libxslt-combined.a" \
	"$WORK/install-iphonesimulator-x86_64/lib/libxslt-combined.a" \
	-output "$WORK/libxslt-simulator.a"

rm -rf "$OUT"
# Deliberately no -headers: headers attached to an xcframework become *public*
# headers of the pod, which flattens them into Pods/Headers/Public and pulls
# exslt.h into the module umbrella. They go next to it instead, reached through
# HEADER_SEARCH_PATHS, so `#include <libxslt/...>` keeps working unchanged.
xcodebuild -create-xcframework \
	-library "$WORK/install-iphoneos-arm64/lib/libxslt-combined.a" \
	-library "$WORK/libxslt-simulator.a" \
	-output "$OUT" >/dev/null

# All slices' headers are identical (same configure options), so one copy serves
# every platform.
rm -rf "$VENDOR_DIR/include"
mkdir -p "$VENDOR_DIR/include"
cp -R "$WORK/install-iphoneos-arm64/include/libxslt" "$WORK/install-iphoneos-arm64/include/libexslt" \
	"$VENDOR_DIR/include/"

echo "[libxslt] wrote $OUT and $VENDOR_DIR/include (libxslt $VERSION)"
