# AI-generated (Claude)
#
# Builds the git-sync JNI bridge (src/main/cpp/git-sync-jni.cpp) against the
# static libgit2, libssh2 and libcrypto that vendor/build/build-libgit2.sh
# cross-compiles. The Gradle build (build.gradle) drives this per ABI.

cmake_minimum_required(VERSION 3.22)
project(gitsync CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(VENDOR "${CMAKE_CURRENT_SOURCE_DIR}/vendor")

if(NOT EXISTS "${VENDOR}/${ANDROID_ABI}/libgit2.a")
  message(FATAL_ERROR "git-sync: no libgit2 for ${ANDROID_ABI} - run modules/git-sync/android/vendor/build/build-libgit2.sh")
endif()

add_library(gitsync SHARED src/main/cpp/git-sync-jni.cpp)
target_include_directories(gitsync PRIVATE "${VENDOR}/include")

foreach(lib git2 ssh2 crypto)
  add_library(${lib} STATIC IMPORTED)
  set_target_properties(${lib} PROPERTIES IMPORTED_LOCATION "${VENDOR}/${ANDROID_ABI}/lib${lib}.a")
endforeach()

# Order matters for static archives: libgit2 needs libssh2, which needs
# libcrypto; libgit2 also needs zlib.
target_link_libraries(gitsync PRIVATE git2 ssh2 crypto z log)

# 16 KB page alignment, required for apps targeting Android 15+ on Play.
target_link_options(gitsync PRIVATE "-Wl,-z,max-page-size=16384")
