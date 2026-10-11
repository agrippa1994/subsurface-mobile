# AI-generated (Claude)
#
# Builds the ssrf-core native library for Android: the same vendored core
# subset, shim and bindings the podspec compiles for iOS, plus the JNI entry
# point in src/main/cpp. The Gradle build (build.gradle) drives this per ABI.

cmake_minimum_required(VERSION 3.22)
project(ssrfcore C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

get_filename_component(MODULE_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/.." ABSOLUTE)
set(CPP "${MODULE_ROOT}/cpp")
set(VENDOR "${CMAKE_CURRENT_SOURCE_DIR}/vendor")

# cpp/generated is materialized by scripts/vendor-core.mjs (the config plugin
# runs it at prebuild). Fail loudly rather than building a module with no core.
if(NOT EXISTS "${CPP}/generated/core")
  message(FATAL_ERROR "ssrf-core: cpp/generated is missing - run `node modules/ssrf-core/scripts/vendor-core.mjs`")
endif()

if(NOT EXISTS "${VENDOR}/${ANDROID_ABI}/libxslt.a")
  message(FATAL_ERROR "ssrf-core: no libxslt for ${ANDROID_ABI} - run modules/ssrf-core/android/vendor/build/build-deps.sh")
endif()

# Everything under cpp/ - the vendored subset (cpp/generated), the shim and the
# bindings - as the podspec's source_files and scripts/build-host.sh compile.
# CONFIGURE_DEPENDS so a newly vendored core file is picked up without wiping
# the CMake cache.
file(GLOB_RECURSE SOURCES CONFIGURE_DEPENDS "${CPP}/*.cpp" "${CPP}/*.c")

add_library(ssrfcore SHARED ${SOURCES} src/main/cpp/ssrfcore-jni.cpp)

target_include_directories(ssrfcore PRIVATE
  "${CPP}"
  "${CPP}/generated"
  "${CPP}/generated/core"
  "${CPP}/third_party"
  "${CPP}/shim/include"
  "${VENDOR}/include/libxml2"
  "${VENDOR}/include"
)

# SUBSURFACE_MOBILE keeps the desktop-only code paths out of the core.
# ssrf-stdlib-compat.h supplies includes upstream gets through Qt.
target_compile_definitions(ssrfcore PRIVATE SUBSURFACE_MOBILE)
target_compile_options(ssrfcore PRIVATE
  $<$<COMPILE_LANGUAGE:CXX>:-include ${CPP}/shim/include/ssrf-stdlib-compat.h>
  -Wno-unused-parameter -Wno-unused-variable
)

foreach(lib exslt xslt xml2 sqlite3)
  add_library(${lib} STATIC IMPORTED)
  set_target_properties(${lib} PROPERTIES IMPORTED_LOCATION "${VENDOR}/${ANDROID_ABI}/lib${lib}.a")
endforeach()

# Order matters for static archives: exslt needs xslt, both need xml2, xml2
# needs zlib and libm. SQLite is for the Suunto DM4/DM5 databases.
target_link_libraries(ssrfcore PRIVATE exslt xslt xml2 sqlite3 z m log)

# 16 KB page alignment, required for apps targeting Android 15+ on Play.
target_link_options(ssrfcore PRIVATE "-Wl,-z,max-page-size=16384")
