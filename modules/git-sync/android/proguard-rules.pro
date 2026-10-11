# AI-generated (Claude)
# git-sync-jni.cpp looks this class and its constructor up by name
# (FindClass/GetMethodID) to throw it from native code, so R8 must not
# rename or strip them.
-keep class expo.modules.gitsync.GitSyncException {
  <init>(int, java.lang.String, java.lang.String, java.lang.String, java.lang.String);
}
