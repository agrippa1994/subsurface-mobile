// AI-generated (Claude)
//
// Declares which files of the Subsurface core are vendored into the native
// module build, and how the Qt leaks in them are neutralized.
//
// The `subsurface/` submodule is consumed strictly read-only. `vendor-core.mjs`
// copies the files named here into `cpp/generated/` (git-ignored), applies the
// patches in `patches/`, then overlays the replacement headers in
// `cpp/shim/override/`. Nothing is ever written back into `subsurface/`.

// Core translation units compiled into the module. Grown incrementally: add a
// file only once the linker actually asks for it, so the surface stays small.
export const CORE_SOURCES = [
	// Model
	'core/dive.cpp',
	'core/divecomputer.cpp',
	'core/divelist.cpp',
	'core/divelog.cpp',
	'core/divesite.cpp',
	'core/device.cpp',
	'core/equipment.cpp',
	'core/event.cpp',
	'core/eventtype.cpp',
	'core/gas.cpp',
	'core/gas-model.cpp',
	'core/picture.cpp',
	'core/sample.cpp',
	'core/tag.cpp',
	'core/taxonomy.cpp',
	'core/trip.cpp',
	'core/triptable.cpp',
	'core/units.cpp',
	'core/pref.cpp',

	// Format: parse + save
	'core/parse.cpp',
	'core/parse-xml.cpp',
	'core/save-xml.cpp',
	'core/save-profiledata.cpp',
	'core/xmlparams.cpp',
	'core/filterpresettable.cpp',
	'core/membuffer.cpp',
	'core/time.cpp',
	'core/subsurface-string.cpp',
	'core/strtod.cpp',
	'core/errorhelper.cpp',
	'core/sha1.cpp',
	'core/version.cpp',

	// Importers
	'core/import-suunto.cpp',
	'core/import-suunto-json.cpp',

	// Downloading from a dive computer (see patches/0008). The dive parsing, the
	// fingerprint logic and the incremental stop are upstream's; only the
	// transport under it is new (cpp/bindings/ble-stream.cpp).
	'core/libdivecomputer.cpp',

	// Math
	'core/deco.cpp',
	'core/planner.cpp',
	'core/plannernotes.cpp',
	'core/profile.cpp',
	'core/gaspressures.cpp',
	'core/po2.cpp',
	'core/statistics.cpp',
];

// Headers are copied wholesale: the core includes them by bare name and
// cherry-picking them would only produce noisy churn. Copying is cheap.
export const CORE_HEADER_GLOBS = ['core/*.h'];

// libdivecomputer is built from source as part of the module: the public
// headers land in cpp/generated/libdivecomputer/, the C sources in its src/.
// Which sources is read out of upstream's own Makefile.am (see vendor-core.mjs),
// so a submodule bump picks up a new backend without touching this file.
export const LIBDC_HEADER_DIR = 'libdivecomputer/include/libdivecomputer';
export const LIBDC_SOURCE_DIR = 'libdivecomputer/src';
// Listed in Makefile.am but not for these platforms.
export const LIBDC_SOURCE_EXCLUDES = ['serial_win32.c', 'libdivecomputer.rc'];

// XSLT stylesheets. parse-xml.cpp transforms every non-SSRF XML format through
// one of these (Suunto DM4/SDM, UDDF, MacDive, ...), loading it by name from a
// directory at runtime - the desktop app serves them out of Qt resources, which
// we do not have. They are copied into `resources/xslt/` and shipped as a pod
// resource bundle; the module points the core at that directory on first use.
export const XSLT_DIR = 'xslt';

// Patches applied to the copied core headers, in order. Each is a plain
// unified diff produced with `diff -u`, applied with `patch -p1` inside
// `cpp/generated/`. A patch that no longer applies fails the build loudly -
// that is the intended signal when the submodule pin moves.
export const PATCHES = [
	'0001-strip-qt-metatype-declarations.patch',
	'0002-qt-free-eventtype-and-helpers.patch',
	'0003-profile-use-std-mutex.patch',
	'0004-device-decode-fingerprint-without-qt.patch',
	'0006-xslt-match-namespace-declaration.patch',
	'0007-suunto-json-without-fit.patch',
	'0008-libdivecomputer-download-without-qt.patch',
	'0009-merge-samples-absent-sensor.patch',
	'0010-planner-wait-until-relative-to-the-stop.patch',
];
