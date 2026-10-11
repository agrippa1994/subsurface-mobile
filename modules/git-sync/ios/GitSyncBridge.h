// AI-generated (Claude)
// Objective-C facade over libgit2, for the logbook sync.
//
// Deliberately small: the sync logic (what to commit, when to merge, what to
// push) lives in TypeScript (src/lib/git-sync.ts). Each method here is one git
// primitive on the app's private repository, which is bare - the logbook is
// committed straight from the app's own file, nothing is ever checked out.
//
// Every method blocks; the Swift module calls them off the JS thread. They are
// serialized by a lock, since two syncs touching one repository at once would
// race on its refs.
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

extern NSErrorDomain const GitSyncErrorDomain;

typedef NS_ERROR_ENUM(GitSyncErrorDomain, GitSyncErrorCode) {
  GitSyncErrorFailed = 1,
  // The server's host key is not the one the app was told to trust (or none
  // was). userInfo carries "host" and "fingerprint" (OpenSSH "SHA256:...").
  GitSyncErrorUnknownHostKey = 2,
  GitSyncErrorHostKeyMismatch = 3,
  GitSyncErrorAuthFailed = 4,
  // The server refused the update, normally because it moved on since the
  // fetch. userInfo carries "reason".
  GitSyncErrorPushRejected = 5,
};

/// Credentials and host trust for one network operation.
///
/// `trustedHostKey` is the OpenSSH-style SHA256 fingerprint of the server's
/// host key, or nil when the app has not trusted one yet - every connection
/// then fails with GitSyncErrorUnknownHostKey, reporting what the server
/// presented, so the user can decide.
@interface GitSyncRemote : NSObject
@property (nonatomic, copy) NSString *url;
@property (nonatomic, copy) NSString *privateKey;
@property (nonatomic, copy, nullable) NSString *passphrase;
@property (nonatomic, copy, nullable) NSString *trustedHostKey;
@end

@interface GitSyncBridge : NSObject

/// Where the app's repository lives: Application Support, out of the Documents
/// directory the Files app shows.
+ (NSString *)repositoryPath;

/// Deletes the repository. The logbook itself is untouched.
+ (BOOL)resetRepository:(NSError **)error;

/// Creates the bare repository if there is none yet.
+ (BOOL)ensureRepository:(NSError **)error;

/// Commit id of refs/heads/<branch>, or nil if the branch has no commits.
+ (nullable NSString *)localHeadOfBranch:(NSString *)branch error:(NSError **)error;

/// Commit id of the remote-tracking ref of <branch> as of the last fetch or
/// push, or nil.
+ (nullable NSString *)remoteHeadOfBranch:(NSString *)branch error:(NSError **)error;

/// Fetches <branch> from the remote. Returns the remote's commit id, or NSNull
/// when the remote has no such branch (an empty repository, say).
+ (nullable id)fetchBranch:(NSString *)branch
                    remote:(GitSyncRemote *)remote
                     error:(NSError **)error;

/// Pushes refs/heads/<branch> to the remote, fast-forward only.
+ (BOOL)pushBranch:(NSString *)branch remote:(GitSyncRemote *)remote error:(NSError **)error;

/// Commits the contents of `file` as `pathInRepo`, on top of the first parent's
/// tree (every other file there is kept), and points refs/heads/<branch> at it.
///
/// With `skipIfUnchanged` and a single parent whose tree already holds this
/// exact content, nothing is committed and the parent is returned. The reply is
/// { "commit": id, "created": bool }.
+ (nullable NSDictionary *)commitFile:(NSString *)file
                               asPath:(NSString *)pathInRepo
                               branch:(NSString *)branch
                              parents:(NSArray<NSString *> *)parents
                              message:(NSString *)message
                           authorName:(NSString *)authorName
                          authorEmail:(NSString *)authorEmail
                      skipIfUnchanged:(BOOL)skipIfUnchanged
                                error:(NSError **)error;

/// Points refs/heads/<branch> at `commit` (a fast-forward to a fetched commit).
+ (BOOL)setBranch:(NSString *)branch toCommit:(NSString *)commit error:(NSError **)error;

/// Writes `pathInRepo` as of `commit` to `destination`. Returns @NO when the
/// commit has no such file.
+ (nullable NSNumber *)extractPath:(NSString *)pathInRepo
                        fromCommit:(NSString *)commit
                            toFile:(NSString *)destination
                             error:(NSError **)error;

/// How many commits `local` has that `upstream` lacks and the other way round:
/// { "ahead": n, "behind": n }.
+ (nullable NSDictionary *)aheadBehindLocal:(NSString *)local
                                   upstream:(NSString *)upstream
                                      error:(NSError **)error;

/// Summary of one commit: { "id", "message", "time" (unix seconds) }.
+ (nullable NSDictionary *)describeCommit:(NSString *)commit error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
