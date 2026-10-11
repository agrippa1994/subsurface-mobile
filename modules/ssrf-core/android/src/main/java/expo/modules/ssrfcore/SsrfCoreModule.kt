// AI-generated (Claude)
package expo.modules.ssrfcore

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File

// The Android counterpart of ios/SsrfCoreModule.swift. Expo Modules
// synchronous functions are dispatched over JSI, so the calls below run C++ on
// the JS thread, exactly as on iOS.
class SsrfCoreModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SsrfCore")

    // The entire core API goes through this one function; adding a method is a
    // C++ and a TypeScript change only, never a native-glue change.
    Function("call") { method: String, argsJson: String ->
      configureOnce()
      nativeCall(method, argsJson)
    }

    Function("add") { a: Int, b: Int ->
      nativeAdd(a, b)
    }

    Function("smokeSerializeMinimalLog") {
      nativeSmokeSerializeMinimalLog()
    }

    Function("smokeCountDivesInFile") { path: String ->
      nativeSmokeCountDivesInFile(path)
    }

    // Android only. A file opened with the app arrives as a content:// URL,
    // which the core cannot fopen(); this copies it into the cache under the
    // name the sending app gave it (the extension is how the importer picks a
    // format) and returns the plain path. expo-file-system cannot do this: it
    // names a content:// file after the last URL segment, often a bare id.
    AsyncFunction("copyContentUri") { uri: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("No Android context")
      val source = Uri.parse(uri)
      val resolver = context.contentResolver
      val displayName = resolver.query(source, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
        if (it.moveToFirst() && !it.isNull(0)) it.getString(0) else null
      }
      // Only the last path component: a provider's name is not trusted to stay
      // inside the directory.
      val name = File(displayName ?: source.lastPathSegment ?: "incoming").name.ifEmpty { "incoming" }
      val dir = File(context.cacheDir, "incoming")
      dir.mkdirs()
      val target = File(dir, name)
      val input = resolver.openInputStream(source) ?: throw IllegalStateException("Cannot read $uri")
      input.use { stream -> target.outputStream().use { stream.copyTo(it) } }
      target.absolutePath
    }
  }

  // The core loads an XSLT stylesheet by name from a directory when it reads
  // a non-SSRF XML format (Suunto DM4, UDDF, ...). On Android they ship as
  // APK assets, which are not files libxslt can open, so they are copied out
  // into the app's private storage once per process and the core is pointed
  // there. Copying every launch keeps them in step with an app update; the
  // set is a few hundred kilobytes.
  private fun configureOnce() {
    if (configured) return
    synchronized(SsrfCoreModule::class.java) {
      if (configured) return
      configured = true
      val context = appContext.reactContext ?: return
      try {
        val dir = copyStylesheets(context)
        nativeCall("configure", JSONObject().put("xsltDir", dir.absolutePath).toString())
      } catch (e: Exception) {
        Log.w(TAG, "XSLT stylesheets unavailable - XML imports other than SSRF will fail", e)
      }
    }
  }

  private fun copyStylesheets(context: Context): File {
    val dir = File(context.filesDir, "ssrf-core/xslt")
    dir.mkdirs()
    val assets = context.assets
    for (name in assets.list(ASSET_DIR).orEmpty()) {
      assets.open("$ASSET_DIR/$name").use { input ->
        File(dir, name).outputStream().use { input.copyTo(it) }
      }
    }
    return dir
  }

  companion object {
    private const val TAG = "ssrf-core"
    // build.gradle adds modules/ssrf-core/resources as an asset root.
    private const val ASSET_DIR = "xslt"

    @Volatile
    private var configured = false

    init {
      System.loadLibrary("ssrfcore")
    }

    @JvmStatic external fun nativeCall(method: String, argsJson: String): String
    @JvmStatic external fun nativeAdd(a: Int, b: Int): Int
    @JvmStatic external fun nativeSmokeSerializeMinimalLog(): String?
    @JvmStatic external fun nativeSmokeCountDivesInFile(path: String): Int
  }
}
