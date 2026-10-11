// AI-generated (Claude)
import CryptoKit
import ExpoModulesCore

// Every git call goes over the network or the disk, so all of them are
// AsyncFunctions: Expo runs those off the JS thread.
//
// Replies are an envelope rather than a thrown exception, the same shape as
// ssrf-core's: { ok: true, result } or { ok: false, error: { code, message,
// ... } }. An Expo exception carries a message and little else, and an
// untrusted host key has to reach the screen with its fingerprint attached.
public class GitSyncModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GitSync")

    AsyncFunction("generateKeyPair") { () -> [String: Any] in
      // Ed25519, what `ssh-keygen` defaults to and every git host accepts. The
      // OpenSSH key file is assembled in TypeScript (src/models/git/ssh-key.ts),
      // which keeps the format testable; only the randomness has to be native.
      let key = Curve25519.Signing.PrivateKey()
      return [
        "seed": key.rawRepresentation.base64EncodedString(),
        "publicKey": key.publicKey.rawRepresentation.base64EncodedString(),
        "checkInt": Int(UInt32.random(in: 0...UInt32.max)),
      ]
    }

    AsyncFunction("repositoryPath") { () -> String in
      GitSyncBridge.repositoryPath()
    }

    AsyncFunction("resetRepository") { () -> [String: Any] in
      envelope { try GitSyncBridge.resetRepository(); return NSNull() }
    }

    AsyncFunction("ensureRepository") { () -> [String: Any] in
      envelope { try GitSyncBridge.ensureRepository(); return NSNull() }
    }

    AsyncFunction("heads") { (branch: String) -> [String: Any] in
      envelope {
        try GitSyncBridge.ensureRepository()
        let local = try nullable { try GitSyncBridge.localHead(ofBranch: branch) }
        let remote = try nullable { try GitSyncBridge.remoteHead(ofBranch: branch) }
        return ["local": local as Any? ?? NSNull(), "remote": remote as Any? ?? NSNull()]
      }
    }

    AsyncFunction("fetch") { (branch: String, remote: [String: Any]) -> [String: Any] in
      envelope { try GitSyncBridge.fetchBranch(branch, remote: makeRemote(remote)) }
    }

    AsyncFunction("push") { (branch: String, remote: [String: Any]) -> [String: Any] in
      envelope { try GitSyncBridge.pushBranch(branch, remote: makeRemote(remote)); return NSNull() }
    }

    AsyncFunction("commitFile") { (args: [String: Any]) -> [String: Any] in
      envelope {
        try GitSyncBridge.commitFile(
          args["file"] as? String ?? "",
          asPath: args["pathInRepo"] as? String ?? "",
          branch: args["branch"] as? String ?? "",
          parents: args["parents"] as? [String] ?? [],
          message: args["message"] as? String ?? "",
          authorName: args["authorName"] as? String ?? "",
          authorEmail: args["authorEmail"] as? String ?? "",
          skipIfUnchanged: args["skipIfUnchanged"] as? Bool ?? false)
      }
    }

    AsyncFunction("setBranch") { (branch: String, commit: String) -> [String: Any] in
      envelope { try GitSyncBridge.setBranch(branch, toCommit: commit); return NSNull() }
    }

    AsyncFunction("extractFile") { (commit: String, pathInRepo: String, destination: String) -> [String: Any] in
      envelope {
        try GitSyncBridge.extractPath(pathInRepo, fromCommit: commit, toFile: destination)
      }
    }

    AsyncFunction("aheadBehind") { (local: String, upstream: String) -> [String: Any] in
      envelope { try GitSyncBridge.aheadBehindLocal(local, upstream: upstream) }
    }

    AsyncFunction("describeCommit") { (commit: String) -> [String: Any] in
      envelope { try GitSyncBridge.describeCommit(commit) }
    }
  }
}

private func makeRemote(_ dictionary: [String: Any]) -> GitSyncRemote {
  let remote = GitSyncRemote()
  remote.url = dictionary["url"] as? String ?? ""
  remote.privateKey = dictionary["privateKey"] as? String ?? ""
  remote.passphrase = dictionary["passphrase"] as? String
  remote.trustedHostKey = dictionary["trustedHostKey"] as? String
  return remote
}

// The bridge's "nil without an error" (a branch with no commits yet) arrives in
// Swift as a thrown error with no domain of ours. Anything that is a GitSync
// error is rethrown; the rest means "absent".
private func nullable(_ body: () throws -> String) throws -> String? {
  do {
    return try body()
  } catch let error as NSError where error.domain == GitSyncErrorDomain {
    throw error
  } catch {
    return nil
  }
}

private func envelope(_ body: () throws -> Any) -> [String: Any] {
  do {
    return ["ok": true, "result": try body()]
  } catch let error as NSError {
    var details: [String: Any] = [
      "code": code(of: error),
      "message": error.localizedDescription,
    ]
    for key in ["host", "fingerprint", "reason"] {
      if let value = error.userInfo[key] {
        details[key] = value
      }
    }
    return ["ok": false, "error": details]
  }
}

// Raw values of GitSyncErrorCode in GitSyncBridge.h.
private func code(of error: NSError) -> String {
  guard error.domain == GitSyncErrorDomain else {
    return "failed"
  }
  switch error.code {
  case 2: return "unknown-host-key"
  case 3: return "host-key-mismatch"
  case 4: return "auth-failed"
  case 5: return "push-rejected"
  default: return "failed"
  }
}
