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
	'core/units.cpp',
	'core/pref.cpp',

	// Format: parse + save
	'core/parse.cpp',
	'core/parse-xml.cpp',
	'core/save-xml.cpp',
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

	// Math
	'core/deco.cpp',
	'core/planner.cpp',
	'core/plannernotes.cpp',
	'core/profile.cpp',
	'core/gaspressures.cpp',
	'core/statistics.cpp',
];

// Headers are copied wholesale: the core includes them by bare name and
// cherry-picking them would only produce noisy churn. Copying is cheap.
export const CORE_HEADER_GLOBS = ['core/*.h'];

// libdivecomputer is used by the subset for its enums only (event types,
// sample types, water types) - no dc_* function is ever called, so the headers
// suffice and the C library is not built. See CORE_MANIFEST.md.
export const LIBDC_HEADER_DIR = 'libdivecomputer/include/libdivecomputer';

// Patches applied to the copied core headers, in order. Each is a plain
// unified diff produced with `diff -u`, applied with `patch -p1` inside
// `cpp/generated/`. A patch that no longer applies fails the build loudly -
// that is the intended signal when the submodule pin moves.
export const PATCHES = [
	'0001-strip-qt-metatype-declarations.patch',
	'0002-qt-free-eventtype-and-helpers.patch',
	'0003-profile-use-std-mutex.patch',
	'0004-device-decode-fingerprint-without-qt.patch',
];
