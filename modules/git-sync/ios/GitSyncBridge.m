// AI-generated (Claude)
#import "GitSyncBridge.h"

#include <git2.h>
#include <git2/sys/errors.h>
#include <CommonCrypto/CommonDigest.h>

NSErrorDomain const GitSyncErrorDomain = @"GitSync";

@implementation GitSyncRemote
@end

// What the libgit2 callbacks of one network operation share. The callbacks run
// on the calling thread, inside git_remote_fetch / git_remote_push.
typedef struct {
  const char *privateKey;
  const char *passphrase;
  const char *trustedHostKey;
  // Whether the key has been offered: libgit2 asks again after a refusal.
  BOOL keyOffered;
  // Set by the certificate check when it turns a host key down, so the error
  // can say why instead of libgit2's generic "certificate check failed".
  GitSyncErrorCode hostKeyProblem;
  char host[256];
  char fingerprint[128];
  // First ref the server refused on push, with its reason.
  char pushRejection[256];
} RemoteContext;

static NSLock *repositoryLock(void)
{
  static NSLock *lock;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    lock = [NSLock new];
  });
  return lock;
}

static void initOnce(void)
{
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    git_libgit2_init();
  });
}

static NSError *makeError(GitSyncErrorCode code, NSString *message, NSDictionary *extra)
{
  NSMutableDictionary *info = [NSMutableDictionary dictionaryWithDictionary:extra ?: @{}];
  info[NSLocalizedDescriptionKey] = message;
  return [NSError errorWithDomain:GitSyncErrorDomain code:code userInfo:info];
}

// libgit2's last error message for a failed call, prefixed with what the app
// was doing.
static NSError *gitError(NSString *what, int code)
{
  const git_error *last = git_error_last();
  NSString *detail = (last != NULL && last->message != NULL) ? @(last->message)
                                                              : [NSString stringWithFormat:@"error %d", code];
  GitSyncErrorCode kind = code == GIT_EAUTH            ? GitSyncErrorAuthFailed
                          : code == GIT_ENONFASTFORWARD ? GitSyncErrorPushRejected
                                                        : GitSyncErrorFailed;
  return makeError(kind, [NSString stringWithFormat:@"%@: %@", what, detail], nil);
}

// Sets *error and returns NO when `code` is a failure, so call sites read
// `if (!ok(...)) goto done;`.
static BOOL ok(int code, NSString *what, NSError **error)
{
  if (code >= 0) {
    return YES;
  }
  if (error != NULL) {
    *error = gitError(what, code);
  }
  return NO;
}

static NSString *oidString(const git_oid *oid)
{
  char buffer[GIT_OID_MAX_HEXSIZE + 1];
  git_oid_tostr(buffer, sizeof buffer, oid);
  return @(buffer);
}

static BOOL parseOid(git_oid *out, NSString *string, NSError **error)
{
  return ok(git_oid_fromstr(out, string.UTF8String), @"Invalid commit id", error);
}

static NSString *branchRef(NSString *branch)
{
  return [@"refs/heads/" stringByAppendingString:branch];
}

static NSString *trackingRef(NSString *branch)
{
  return [@"refs/remotes/origin/" stringByAppendingString:branch];
}

// The fingerprint OpenSSH prints: "SHA256:" and the unpadded base64 digest of
// the host key blob.
static NSString *sha256Fingerprint(const unsigned char *digest)
{
  NSData *data = [NSData dataWithBytes:digest length:32];
  NSString *base64 = [data base64EncodedStringWithOptions:0];
  base64 = [base64 stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"="]];
  return [@"SHA256:" stringByAppendingString:base64];
}

static int certificateCheck(git_cert *cert, int valid, const char *host, void *payload)
{
  (void)valid;
  RemoteContext *context = payload;
  strlcpy(context->host, host != NULL ? host : "", sizeof context->host);

  if (cert->cert_type != GIT_CERT_HOSTKEY_LIBSSH2) {
    git_error_set_str(GIT_ERROR_SSH, "only SSH remotes are supported");
    return GIT_ECERTIFICATE;
  }
  git_cert_hostkey *hostkey = (git_cert_hostkey *)cert;
  unsigned char digest[32];
  if (hostkey->type & GIT_CERT_SSH_SHA256) {
    memcpy(digest, hostkey->hash_sha256, sizeof digest);
  } else if (hostkey->type & GIT_CERT_SSH_RAW) {
    CC_SHA256(hostkey->hostkey, (CC_LONG)hostkey->hostkey_len, digest);
  } else {
    git_error_set_str(GIT_ERROR_SSH, "the server's host key could not be fingerprinted");
    return GIT_ECERTIFICATE;
  }
  NSString *fingerprint = sha256Fingerprint(digest);
  strlcpy(context->fingerprint, fingerprint.UTF8String, sizeof context->fingerprint);

  if (context->trustedHostKey == NULL) {
    context->hostKeyProblem = GitSyncErrorUnknownHostKey;
    git_error_set_str(GIT_ERROR_SSH, "the server's host key is not trusted yet");
    return GIT_ECERTIFICATE;
  }
  if (strcmp(context->trustedHostKey, context->fingerprint) != 0) {
    context->hostKeyProblem = GitSyncErrorHostKeyMismatch;
    git_error_set_str(GIT_ERROR_SSH, "the server's host key has changed");
    return GIT_ECERTIFICATE;
  }
  return 0;
}

static int credentials(git_credential **out, const char *url, const char *usernameFromUrl,
                       unsigned int allowedTypes, void *payload)
{
  (void)url;
  RemoteContext *context = payload;
  const char *username = (usernameFromUrl != NULL && *usernameFromUrl != '\0') ? usernameFromUrl : "git";

  if (allowedTypes & GIT_CREDENTIAL_USERNAME) {
    return git_credential_username_new(out, username);
  }
  if (allowedTypes & GIT_CREDENTIAL_SSH_MEMORY) {
    // One key is all there is, so being asked a second time means it was
    // turned down - and libgit2 would otherwise keep asking.
    if (context->keyOffered) {
      git_error_set_str(GIT_ERROR_SSH, "the server did not accept the SSH key");
      return GIT_EAUTH;
    }
    context->keyOffered = YES;
    // No public key: libssh2 derives it from the private one.
    return git_credential_ssh_key_memory_new(out, username, NULL, context->privateKey,
                                             context->passphrase);
  }
  git_error_set_str(GIT_ERROR_SSH, "the server offers no authentication the app supports");
  return GIT_EAUTH;
}

static int pushUpdateReference(const char *refname, const char *status, void *data)
{
  RemoteContext *context = data;
  if (status != NULL && context->pushRejection[0] == '\0') {
    snprintf(context->pushRejection, sizeof context->pushRejection, "%s: %s", refname, status);
  }
  return 0;
}

static void prepareContext(RemoteContext *context, GitSyncRemote *remote)
{
  memset(context, 0, sizeof *context);
  context->privateKey = remote.privateKey.UTF8String;
  context->passphrase = remote.passphrase.length > 0 ? remote.passphrase.UTF8String : NULL;
  context->trustedHostKey = remote.trustedHostKey.length > 0 ? remote.trustedHostKey.UTF8String : NULL;
}

static void prepareCallbacks(git_remote_callbacks *callbacks, RemoteContext *context)
{
  callbacks->credentials = credentials;
  callbacks->certificate_check = certificateCheck;
  callbacks->push_update_reference = pushUpdateReference;
  callbacks->payload = context;
}

// A network failure, reworded when it was the host key check that ended it.
static NSError *remoteError(NSString *what, int code, RemoteContext *context)
{
  if (context->hostKeyProblem != 0) {
    NSString *host = @(context->host);
    NSString *message = context->hostKeyProblem == GitSyncErrorUnknownHostKey
                          ? [NSString stringWithFormat:@"The host key of %@ is not trusted yet.", host]
                          : [NSString stringWithFormat:@"The host key of %@ has changed.", host];
    return makeError(context->hostKeyProblem, message,
                     @{ @"host" : host, @"fingerprint" : @(context->fingerprint) });
  }
  return gitError(what, code);
}

static BOOL openRepository(git_repository **out, NSError **error)
{
  return ok(git_repository_open_bare(out, [GitSyncBridge repositoryPath].fileSystemRepresentation),
            @"Could not open the sync repository", error);
}

// The "origin" remote, created on first use and re-pointed whenever the URL in
// the settings has changed since.
static BOOL lookupRemote(git_remote **out, git_repository *repo, NSString *url, NSError **error)
{
  int code = git_remote_lookup(out, repo, "origin");
  if (code == GIT_ENOTFOUND) {
    return ok(git_remote_create(out, repo, "origin", url.UTF8String), @"Could not add the remote", error);
  }
  if (!ok(code, @"Could not read the remote", error)) {
    return NO;
  }
  if (strcmp(git_remote_url(*out), url.UTF8String) == 0) {
    return YES;
  }
  git_remote_free(*out);
  *out = NULL;
  if (!ok(git_remote_set_url(repo, "origin", url.UTF8String), @"Could not change the remote", error)) {
    return NO;
  }
  return ok(git_remote_lookup(out, repo, "origin"), @"Could not read the remote", error);
}

static NSString *resolveRef(git_repository *repo, NSString *ref, NSError **error)
{
  git_oid oid;
  int code = git_reference_name_to_id(&oid, repo, ref.UTF8String);
  if (code == GIT_ENOTFOUND) {
    return nil;
  }
  if (!ok(code, @"Could not read a branch", error)) {
    return nil;
  }
  return oidString(&oid);
}

@implementation GitSyncBridge

+ (NSString *)repositoryPath
{
  NSURL *support = [[NSFileManager defaultManager] URLsForDirectory:NSApplicationSupportDirectory
                                                          inDomains:NSUserDomainMask].firstObject;
  return [support URLByAppendingPathComponent:@"git-sync/logbook.git"].path;
}

+ (BOOL)resetRepository:(NSError **)error
{
  [repositoryLock() lock];
  NSString *path = [self repositoryPath];
  BOOL result = YES;
  if ([[NSFileManager defaultManager] fileExistsAtPath:path]) {
    result = [[NSFileManager defaultManager] removeItemAtPath:path error:error];
  }
  [repositoryLock() unlock];
  return result;
}

+ (BOOL)ensureRepository:(NSError **)error
{
  initOnce();
  [repositoryLock() lock];
  NSString *path = [self repositoryPath];
  BOOL result = YES;
  if (![[NSFileManager defaultManager] fileExistsAtPath:[path stringByAppendingPathComponent:@"HEAD"]]) {
    git_repository *repo = NULL;
    result = ok(git_repository_init(&repo, path.fileSystemRepresentation, 1),
                @"Could not create the sync repository", error);
    git_repository_free(repo);
  }
  [repositoryLock() unlock];
  return result;
}

+ (NSString *)localHeadOfBranch:(NSString *)branch error:(NSError **)error
{
  return [self headOfRef:branchRef(branch) error:error];
}

+ (NSString *)remoteHeadOfBranch:(NSString *)branch error:(NSError **)error
{
  return [self headOfRef:trackingRef(branch) error:error];
}

+ (NSString *)headOfRef:(NSString *)ref error:(NSError **)error
{
  initOnce();
  [repositoryLock() lock];
  git_repository *repo = NULL;
  NSString *result = nil;
  if (openRepository(&repo, error)) {
    result = resolveRef(repo, ref, error);
  }
  git_repository_free(repo);
  [repositoryLock() unlock];
  return result;
}

+ (id)fetchBranch:(NSString *)branch remote:(GitSyncRemote *)remoteInfo error:(NSError **)error
{
  initOnce();
  [repositoryLock() lock];
  git_repository *repo = NULL;
  git_remote *remote = NULL;
  id result = nil;
  RemoteContext context;
  prepareContext(&context, remoteInfo);

  if (openRepository(&repo, error) && lookupRemote(&remote, repo, remoteInfo.url, error)) {
    // Just the one branch, force-updated: the tracking ref mirrors the server,
    // whatever it did to its history.
    NSString *spec = [NSString stringWithFormat:@"+%@:%@", branchRef(branch), trackingRef(branch)];
    char *specs[] = { (char *)spec.UTF8String };
    git_strarray refspecs = { specs, 1 };

    git_fetch_options options = GIT_FETCH_OPTIONS_INIT;
    prepareCallbacks(&options.callbacks, &context);
    // Prune, so a branch deleted on the server stops looking present here.
    options.prune = GIT_FETCH_PRUNE;

    int code = git_remote_fetch(remote, &refspecs, &options, "fetch");
    if (code < 0) {
      if (error != NULL) {
        *error = remoteError(@"Fetch failed", code, &context);
      }
    } else {
      NSError *refError = nil;
      NSString *head = resolveRef(repo, trackingRef(branch), &refError);
      if (refError != nil) {
        if (error != NULL) {
          *error = refError;
        }
      } else {
        result = head ?: [NSNull null];
      }
    }
  }
  git_remote_free(remote);
  git_repository_free(repo);
  [repositoryLock() unlock];
  return result;
}

+ (BOOL)pushBranch:(NSString *)branch remote:(GitSyncRemote *)remoteInfo error:(NSError **)error
{
  initOnce();
  [repositoryLock() lock];
  git_repository *repo = NULL;
  git_remote *remote = NULL;
  BOOL result = NO;
  RemoteContext context;
  prepareContext(&context, remoteInfo);

  if (openRepository(&repo, error) && lookupRemote(&remote, repo, remoteInfo.url, error)) {
    // No "+": a push that is not a fast-forward of the server's branch is
    // refused rather than overwriting what another device pushed.
    NSString *spec = [NSString stringWithFormat:@"%@:%@", branchRef(branch), branchRef(branch)];
    char *specs[] = { (char *)spec.UTF8String };
    git_strarray refspecs = { specs, 1 };

    git_push_options options = GIT_PUSH_OPTIONS_INIT;
    prepareCallbacks(&options.callbacks, &context);

    int code = git_remote_push(remote, &refspecs, &options);
    if (code < 0) {
      if (error != NULL) {
        *error = remoteError(@"Push failed", code, &context);
      }
    } else if (context.pushRejection[0] != '\0') {
      if (error != NULL) {
        NSString *reason = @(context.pushRejection);
        *error = makeError(GitSyncErrorPushRejected,
                           [NSString stringWithFormat:@"The server refused the push (%@).", reason],
                           @{ @"reason" : reason });
      }
    } else {
      result = YES;
    }
  }
  git_remote_free(remote);
  git_repository_free(repo);
  [repositoryLock() unlock];
  return result;
}

+ (NSDictionary *)commitFile:(NSString *)file
                      asPath:(NSString *)pathInRepo
                      branch:(NSString *)branch
                     parents:(NSArray<NSString *> *)parentIds
                     message:(NSString *)message
                  authorName:(NSString *)authorName
                 authorEmail:(NSString *)authorEmail
             skipIfUnchanged:(BOOL)skipIfUnchanged
                       error:(NSError **)error
{
  initOnce();
  NSData *content = [NSData dataWithContentsOfFile:file options:0 error:error];
  if (content == nil) {
    return nil;
  }

  [repositoryLock() lock];
  git_repository *repo = NULL;
  const git_commit *parents[2] = { NULL, NULL };
  git_tree *baseTree = NULL;
  git_tree *tree = NULL;
  git_signature *signature = NULL;
  git_reference *ref = NULL;
  NSDictionary *result = nil;

  if (parentIds.count > 2) {
    if (error != NULL) {
      *error = makeError(GitSyncErrorFailed, @"A commit has at most two parents here.", nil);
    }
    goto done;
  }
  if (!openRepository(&repo, error)) {
    goto done;
  }
  for (NSUInteger i = 0; i < parentIds.count; i++) {
    git_oid oid;
    if (!parseOid(&oid, parentIds[i], error) ||
        !ok(git_commit_lookup((git_commit **)&parents[i], repo, &oid), @"Unknown parent commit", error)) {
      goto done;
    }
  }
  if (parents[0] != NULL && !ok(git_commit_tree(&baseTree, parents[0]), @"Could not read a tree", error)) {
    goto done;
  }

  {
    git_oid blob;
    if (!ok(git_blob_create_from_buffer(&blob, repo, content.bytes, content.length),
            @"Could not store the logbook", error)) {
      goto done;
    }
    git_tree_update update = {
      .action = GIT_TREE_UPDATE_UPSERT,
      .id = blob,
      .filemode = GIT_FILEMODE_BLOB,
      .path = pathInRepo.UTF8String,
    };
    git_oid treeId;
    if (!ok(git_tree_create_updated(&treeId, repo, baseTree, 1, &update), @"Could not build the tree", error) ||
        !ok(git_tree_lookup(&tree, repo, &treeId), @"Could not read the tree", error)) {
      goto done;
    }

    if (skipIfUnchanged && parentIds.count == 1 && git_oid_equal(&treeId, git_tree_id(baseTree))) {
      result = @{ @"commit" : parentIds[0], @"created" : @NO };
      goto done;
    }

    if (!ok(git_signature_now(&signature, authorName.UTF8String, authorEmail.UTF8String),
            @"Invalid author", error)) {
      goto done;
    }
    git_oid commitId;
    if (!ok(git_commit_create(&commitId, repo, NULL, signature, signature, "UTF-8", message.UTF8String, tree,
                              parentIds.count, parents),
            @"Could not commit the logbook", error)) {
      goto done;
    }
    if (!ok(git_reference_create(&ref, repo, branchRef(branch).UTF8String, &commitId, 1, "commit"),
            @"Could not move the branch", error) ||
        !ok(git_repository_set_head(repo, branchRef(branch).UTF8String), @"Could not set HEAD", error)) {
      goto done;
    }
    result = @{ @"commit" : oidString(&commitId), @"created" : @YES };
  }

done:
  git_reference_free(ref);
  git_signature_free(signature);
  git_tree_free(tree);
  git_tree_free(baseTree);
  git_commit_free((git_commit *)parents[0]);
  git_commit_free((git_commit *)parents[1]);
  git_repository_free(repo);
  [repositoryLock() unlock];
  return result;
}

+ (BOOL)setBranch:(NSString *)branch toCommit:(NSString *)commit error:(NSError **)error
{
  initOnce();
  [repositoryLock() lock];
  git_repository *repo = NULL;
  git_reference *ref = NULL;
  git_oid oid;
  BOOL result = openRepository(&repo, error) && parseOid(&oid, commit, error) &&
                ok(git_reference_create(&ref, repo, branchRef(branch).UTF8String, &oid, 1, "fast-forward"),
                   @"Could not move the branch", error) &&
                ok(git_repository_set_head(repo, branchRef(branch).UTF8String), @"Could not set HEAD", error);
  git_reference_free(ref);
  git_repository_free(repo);
  [repositoryLock() unlock];
  return result;
}

+ (NSNumber *)extractPath:(NSString *)pathInRepo
               fromCommit:(NSString *)commitId
                   toFile:(NSString *)destination
                    error:(NSError **)error
{
  initOnce();
  [repositoryLock() lock];
  git_repository *repo = NULL;
  git_commit *commit = NULL;
  git_tree *tree = NULL;
  git_tree_entry *entry = NULL;
  git_blob *blob = NULL;
  NSNumber *result = nil;
  git_oid oid;

  if (!openRepository(&repo, error) || !parseOid(&oid, commitId, error) ||
      !ok(git_commit_lookup(&commit, repo, &oid), @"Unknown commit", error) ||
      !ok(git_commit_tree(&tree, commit), @"Could not read a tree", error)) {
    goto done;
  }
  {
    int code = git_tree_entry_bypath(&entry, tree, pathInRepo.UTF8String);
    if (code == GIT_ENOTFOUND) {
      result = @NO;
      goto done;
    }
    if (!ok(code, @"Could not find the logbook", error)) {
      goto done;
    }
    if (git_tree_entry_type(entry) != GIT_OBJECT_BLOB) {
      result = @NO;
      goto done;
    }
    if (!ok(git_blob_lookup(&blob, repo, git_tree_entry_id(entry)), @"Could not read the logbook", error)) {
      goto done;
    }
    NSData *data = [NSData dataWithBytes:git_blob_rawcontent(blob) length:(NSUInteger)git_blob_rawsize(blob)];
    // Atomic: the destination may be the app's working logbook.
    if ([data writeToFile:destination options:NSDataWritingAtomic error:error]) {
      result = @YES;
    }
  }

done:
  git_blob_free(blob);
  git_tree_entry_free(entry);
  git_tree_free(tree);
  git_commit_free(commit);
  git_repository_free(repo);
  [repositoryLock() unlock];
  return result;
}

+ (NSDictionary *)aheadBehindLocal:(NSString *)local upstream:(NSString *)upstream error:(NSError **)error
{
  initOnce();
  [repositoryLock() lock];
  git_repository *repo = NULL;
  git_oid localId, upstreamId;
  size_t ahead = 0, behind = 0;
  NSDictionary *result = nil;
  if (openRepository(&repo, error) && parseOid(&localId, local, error) && parseOid(&upstreamId, upstream, error) &&
      ok(git_graph_ahead_behind(&ahead, &behind, repo, &localId, &upstreamId), @"Could not compare branches",
         error)) {
    result = @{ @"ahead" : @(ahead), @"behind" : @(behind) };
  }
  git_repository_free(repo);
  [repositoryLock() unlock];
  return result;
}

+ (NSDictionary *)describeCommit:(NSString *)commitId error:(NSError **)error
{
  initOnce();
  [repositoryLock() lock];
  git_repository *repo = NULL;
  git_commit *commit = NULL;
  git_oid oid;
  NSDictionary *result = nil;
  if (openRepository(&repo, error) && parseOid(&oid, commitId, error) &&
      ok(git_commit_lookup(&commit, repo, &oid), @"Unknown commit", error)) {
    const char *summary = git_commit_summary(commit);
    result = @{
      @"id" : commitId,
      @"message" : summary != NULL ? @(summary) : @"",
      @"time" : @(git_commit_time(commit)),
    };
  }
  git_commit_free(commit);
  git_repository_free(repo);
  [repositoryLock() unlock];
  return result;
}

@end
