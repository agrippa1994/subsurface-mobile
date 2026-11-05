# AI-generated (Claude)
# ssrfcore-jni.cpp resolves this class and callback by name in JNI_OnLoad.
# It is also called from native download threads, outside R8's call graph.
-keep class expo.modules.ssrfcore.SsrfCoreModule {
  public static void onCoreEvent(java.lang.String);
}

# AndroidGattDriver resolves these methods with GetMethodID. Keep their
# signatures in sync with the lookups in ssrfcore-jni.cpp.
-keepclassmembers class expo.modules.ssrfcore.SsrfGattDriver {
  public void startScan(java.lang.String[]);
  public void stopScan();
  public void connect(java.lang.String);
  public void discover();
  public void enableNotify(java.lang.String, java.lang.String);
  public void write(java.lang.String, java.lang.String, byte[], boolean);
  public void read(java.lang.String, java.lang.String);
  public void disconnect();
}
