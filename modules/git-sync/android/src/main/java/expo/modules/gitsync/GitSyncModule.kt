// AI-generated (Claude)
package expo.modules.gitsync

import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.SecureRandom

// A failure of the JNI bridge (src/main/cpp/git-sync-jni.cpp), carrying what
// the iOS bridge puts in its NSError: the GitSyncErrorCode raw value and the
// details an untrusted host key or a refused push has to reach the screen with.
class GitSyncException(
  val code: Int,
  message: String,
  val host: String?,
  val fingerprint: String?,
  val reason: String?,
) : Exception(message)

// The Android counterpart of ios/GitSyncModule.swift: the same functions, the
// same envelope replies ({ ok: true, result } or { ok: false, error: { code,
// message, ... } }). Every git call goes over the network or the disk, so all
// of them are AsyncFunctions, which Expo runs off the JS thread.
class GitSyncModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GitSync")

    AsyncFunction("generateKeyPair") {
      // Ed25519, what `ssh-keygen` defaults to and every git host accepts. The
      // OpenSSH key file is assembled in TypeScript (src/models/git/ssh-key.ts);
      // only the randomness has to be native.
      val pair = locked { nativeGenerateEd25519() }
      mapOf(
        "seed" to Base64.encodeToString(pair[0], Base64.NO_WRAP),
        "publicKey" to Base64.encodeToString(pair[1], Base64.NO_WRAP),
        "checkInt" to (SecureRandom().nextInt().toLong() and 0xFFFFFFFFL).toDouble(),
      )
    }

    AsyncFunction("repositoryPath") {
      repositoryPath()
    }

    AsyncFunction("resetRepository") {
      envelope {
        File(repositoryPath()).deleteRecursively()
        null
      }
    }

    AsyncFunction("ensureRepository") {
      envelope { ensureRepository(); null }
    }

    AsyncFunction("heads") { branch: String ->
      envelope {
        ensureRepository()
        mapOf(
          "local" to nativeHead(repositoryPath(), "refs/heads/$branch"),
          "remote" to nativeHead(repositoryPath(), "refs/remotes/origin/$branch"),
        )
      }
    }

    AsyncFunction("fetch") { branch: String, remote: Map<String, Any?> ->
      envelope {
        nativeFetch(
          repositoryPath(), branch, remote.string("url"), remote.string("privateKey"),
          remote["passphrase"] as? String, remote["trustedHostKey"] as? String,
        )
      }
    }

    AsyncFunction("push") { branch: String, remote: Map<String, Any?> ->
      envelope {
        nativePush(
          repositoryPath(), branch, remote.string("url"), remote.string("privateKey"),
          remote["passphrase"] as? String, remote["trustedHostKey"] as? String,
        )
        null
      }
    }

    AsyncFunction("commitFile") { args: Map<String, Any?> ->
      envelope {
        val parents = (args["parents"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()
        val reply = nativeCommitFile(
          repositoryPath(),
          args.string("file"),
          args.string("pathInRepo"),
          args.string("branch"),
          parents.toTypedArray(),
          args.string("message"),
          args.string("authorName"),
          args.string("authorEmail"),
          args["skipIfUnchanged"] as? Boolean ?: false,
        )
        mapOf("commit" to reply[0], "created" to (reply[1] == "true"))
      }
    }

    AsyncFunction("setBranch") { branch: String, commit: String ->
      envelope { nativeSetBranch(repositoryPath(), branch, commit); null }
    }

    AsyncFunction("extractFile") { commit: String, pathInRepo: String, destination: String ->
      envelope { nativeExtractFile(repositoryPath(), commit, pathInRepo, destination) }
    }

    AsyncFunction("aheadBehind") { local: String, upstream: String ->
      envelope {
        val counts = nativeAheadBehind(repositoryPath(), local, upstream)
        mapOf("ahead" to counts[0].toDouble(), "behind" to counts[1].toDouble())
      }
    }

    AsyncFunction("describeCommit") { commit: String ->
      envelope {
        val reply = nativeDescribeCommit(repositoryPath(), commit)
        mapOf("id" to commit, "message" to reply[0], "time" to reply[1].toDouble())
      }
    }
  }

  // Private app storage, out of anything a file manager shows - the
  // counterpart of Application Support on iOS.
  private fun repositoryPath(): String {
    val context = appContext.reactContext ?: throw GitSyncException(1, "No Android context", null, null, null)
    return File(context.filesDir, "git-sync/logbook.git").absolutePath
  }

  private fun ensureRepository() {
    val path = repositoryPath()
    if (!File(path, "HEAD").exists()) {
      nativeEnsureRepository(path)
    }
  }

  // Runs one bridge call under the repository lock and wraps the outcome in
  // the envelope.
  private fun envelope(body: () -> Any?): Map<String, Any?> =
    try {
      mapOf("ok" to true, "result" to locked(body))
    } catch (e: GitSyncException) {
      val details = mutableMapOf<String, Any?>("code" to codeName(e.code), "message" to (e.message ?: ""))
      e.host?.let { details["host"] = it }
      e.fingerprint?.let { details["fingerprint"] = it }
      e.reason?.let { details["reason"] = it }
      mapOf("ok" to false, "error" to details)
    } catch (e: Exception) {
      mapOf("ok" to false, "error" to mapOf("code" to "failed", "message" to (e.message ?: e.toString())))
    }

  private fun Map<String, Any?>.string(key: String): String = this[key] as? String ?: ""

  companion object {
    // Two syncs touching one repository at once would race on its refs.
    private val lock = Any()

    private fun <T> locked(body: () -> T): T = synchronized(lock) { body() }

    // Raw values of GitSyncErrorCode in ios/GitSyncBridge.h.
    private fun codeName(code: Int): String =
      when (code) {
        2 -> "unknown-host-key"
        3 -> "host-key-mismatch"
        4 -> "auth-failed"
        5 -> "push-rejected"
        else -> "failed"
      }

    init {
      System.loadLibrary("gitsync")
    }

    @JvmStatic external fun nativeEnsureRepository(path: String)
    @JvmStatic external fun nativeHead(path: String, ref: String): String?
    @JvmStatic external fun nativeFetch(
      path: String, branch: String, url: String, privateKey: String, passphrase: String?, trustedHostKey: String?,
    ): String?
    @JvmStatic external fun nativePush(
      path: String, branch: String, url: String, privateKey: String, passphrase: String?, trustedHostKey: String?,
    )
    @JvmStatic external fun nativeCommitFile(
      path: String, file: String, pathInRepo: String, branch: String, parents: Array<String>, message: String,
      authorName: String, authorEmail: String, skipIfUnchanged: Boolean,
    ): Array<String>
    @JvmStatic external fun nativeSetBranch(path: String, branch: String, commit: String)
    @JvmStatic external fun nativeExtractFile(path: String, commit: String, pathInRepo: String, destination: String): Boolean
    @JvmStatic external fun nativeAheadBehind(path: String, local: String, upstream: String): LongArray
    @JvmStatic external fun nativeDescribeCommit(path: String, commit: String): Array<String>
    @JvmStatic external fun nativeGenerateEd25519(): Array<ByteArray>
  }
}
