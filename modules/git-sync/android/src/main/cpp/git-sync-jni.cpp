// AI-generated (Claude)
// JNI facade over libgit2 for the logbook sync, the Android counterpart of
// ios/GitSyncBridge.m. Each function is one git primitive on the app's private
// bare repository; the sync logic itself is TypeScript (src/lib/git/sync.ts).
//
// Failures are thrown as expo.modules.gitsync.GitSyncException, carrying the
// same codes and details the iOS bridge puts in its NSError, so
// GitSyncModule.kt can build the identical envelope. Every function blocks and
// is called off the JS thread; GitSyncModule.kt serializes them, since two
// syncs touching one repository at once would race on its refs.

#include <jni.h>

#include <git2.h>
#include <git2/sys/errors.h>
#include <openssl/evp.h>
#include <openssl/sha.h>

#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

namespace {

// Raw values of GitSyncErrorCode in ios/GitSyncBridge.h.
enum ErrorCode {
	Failed = 1,
	UnknownHostKey = 2,
	HostKeyMismatch = 3,
	AuthFailed = 4,
	PushRejected = 5,
};

// Thrown inside a bridge function, turned into a Java exception at its edge.
struct BridgeError {
	int code;
	std::string message;
	std::string host;
	std::string fingerprint;
	std::string reason;
};

void throw_java(JNIEnv *env, const BridgeError &error)
{
	jclass cls = env->FindClass("expo/modules/gitsync/GitSyncException");
	jmethodID ctor = env->GetMethodID(
		cls, "<init>", "(ILjava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V");
	auto str = [env](const std::string &s) -> jstring { return s.empty() ? nullptr : env->NewStringUTF(s.c_str()); };
	auto exception = static_cast<jthrowable>(env->NewObject(cls, ctor, static_cast<jint>(error.code),
								 env->NewStringUTF(error.message.c_str()),
								 str(error.host), str(error.fingerprint), str(error.reason)));
	env->Throw(exception);
}

// Runs a bridge function body, converting a BridgeError into a Java exception
// and returning `fallback` in that case.
template <typename T, typename F> T guarded(JNIEnv *env, T fallback, F body)
{
	try {
		return body();
	} catch (const BridgeError &error) {
		throw_java(env, error);
		return fallback;
	}
}

std::string to_string(JNIEnv *env, jstring value)
{
	if (value == nullptr)
		return {};
	const char *chars = env->GetStringUTFChars(value, nullptr);
	std::string out(chars);
	env->ReleaseStringUTFChars(value, chars);
	return out;
}

void init_once()
{
	static std::once_flag once;
	std::call_once(once, [] { git_libgit2_init(); });
}

// libgit2's last error message for a failed call, prefixed with what the app
// was doing.
BridgeError last_git_error(const std::string &what, int code)
{
	const git_error *last = git_error_last();
	std::string detail = (last != nullptr && last->message != nullptr) ? last->message
									     : "error " + std::to_string(code);
	int kind = code == GIT_EAUTH ? AuthFailed : code == GIT_ENONFASTFORWARD ? PushRejected : Failed;
	return BridgeError{ kind, what + ": " + detail, {}, {}, {} };
}

void check(int code, const std::string &what)
{
	if (code < 0)
		throw last_git_error(what, code);
}

std::string oid_string(const git_oid *oid)
{
	char buffer[GIT_OID_MAX_HEXSIZE + 1];
	git_oid_tostr(buffer, sizeof buffer, oid);
	return buffer;
}

git_oid parse_oid(const std::string &value)
{
	git_oid oid;
	check(git_oid_fromstr(&oid, value.c_str()), "Invalid commit id");
	return oid;
}

std::string branch_ref(const std::string &branch)
{
	return "refs/heads/" + branch;
}

std::string tracking_ref(const std::string &branch)
{
	return "refs/remotes/origin/" + branch;
}

// RAII owners for the libgit2 handles a function opens, so every early throw
// frees them.
template <typename T, void (*Free)(T *)> struct Owned {
	T *ptr = nullptr;
	Owned() = default;
	Owned(const Owned &) = delete;
	Owned &operator=(const Owned &) = delete;
	~Owned() { Free(ptr); }
	T **out() { return &ptr; }
	T *get() const { return ptr; }
};
using Repo = Owned<git_repository, git_repository_free>;
using Remote = Owned<git_remote, git_remote_free>;
using Commit = Owned<git_commit, git_commit_free>;
using Tree = Owned<git_tree, git_tree_free>;
using TreeEntry = Owned<git_tree_entry, git_tree_entry_free>;
using Blob = Owned<git_blob, git_blob_free>;
using Signature = Owned<git_signature, git_signature_free>;
using Reference = Owned<git_reference, git_reference_free>;

void open_repository(Repo &repo, const std::string &path)
{
	check(git_repository_open_bare(repo.out(), path.c_str()), "Could not open the sync repository");
}

// What the libgit2 callbacks of one network operation share. The callbacks run
// on the calling thread, inside git_remote_fetch / git_remote_push.
struct RemoteContext {
	std::string url;
	std::string private_key;
	std::string passphrase;
	std::string trusted_host_key;
	// Whether the key has been offered: libgit2 asks again after a refusal.
	bool key_offered = false;
	// Set by the certificate check when it turns a host key down, so the error
	// can say why instead of libgit2's generic "certificate check failed".
	int host_key_problem = 0;
	std::string host;
	std::string fingerprint;
	// First ref the server refused on push, with its reason.
	std::string push_rejection;
};

// The fingerprint OpenSSH prints: "SHA256:" and the unpadded base64 digest of
// the host key blob.
std::string sha256_fingerprint(const unsigned char *digest)
{
	unsigned char base64[64];
	int length = EVP_EncodeBlock(base64, digest, 32);
	std::string out(reinterpret_cast<char *>(base64), length);
	while (!out.empty() && out.back() == '=')
		out.pop_back();
	return "SHA256:" + out;
}

int certificate_check(git_cert *cert, int, const char *host, void *payload)
{
	auto *context = static_cast<RemoteContext *>(payload);
	context->host = host != nullptr ? host : "";

	if (cert->cert_type != GIT_CERT_HOSTKEY_LIBSSH2) {
		git_error_set_str(GIT_ERROR_SSH, "only SSH remotes are supported");
		return GIT_ECERTIFICATE;
	}
	auto *hostkey = reinterpret_cast<git_cert_hostkey *>(cert);
	unsigned char digest[32];
	if (hostkey->type & GIT_CERT_SSH_SHA256) {
		memcpy(digest, hostkey->hash_sha256, sizeof digest);
	} else if (hostkey->type & GIT_CERT_SSH_RAW) {
		SHA256(reinterpret_cast<const unsigned char *>(hostkey->hostkey), hostkey->hostkey_len, digest);
	} else {
		git_error_set_str(GIT_ERROR_SSH, "the server's host key could not be fingerprinted");
		return GIT_ECERTIFICATE;
	}
	context->fingerprint = sha256_fingerprint(digest);

	if (context->trusted_host_key.empty()) {
		context->host_key_problem = UnknownHostKey;
		git_error_set_str(GIT_ERROR_SSH, "the server's host key is not trusted yet");
		return GIT_ECERTIFICATE;
	}
	if (context->trusted_host_key != context->fingerprint) {
		context->host_key_problem = HostKeyMismatch;
		git_error_set_str(GIT_ERROR_SSH, "the server's host key has changed");
		return GIT_ECERTIFICATE;
	}
	return 0;
}

int credentials(git_credential **out, const char *, const char *username_from_url, unsigned int allowed_types,
		void *payload)
{
	auto *context = static_cast<RemoteContext *>(payload);
	const char *username =
		(username_from_url != nullptr && *username_from_url != '\0') ? username_from_url : "git";

	if (allowed_types & GIT_CREDENTIAL_USERNAME)
		return git_credential_username_new(out, username);
	if (allowed_types & GIT_CREDENTIAL_SSH_MEMORY) {
		// One key is all there is, so being asked a second time means it was
		// turned down - and libgit2 would otherwise keep asking.
		if (context->key_offered) {
			git_error_set_str(GIT_ERROR_SSH, "the server did not accept the SSH key");
			return GIT_EAUTH;
		}
		context->key_offered = true;
		// No public key: libssh2 derives it from the private one.
		return git_credential_ssh_key_memory_new(out, username, nullptr, context->private_key.c_str(),
							 context->passphrase.empty() ? nullptr
										     : context->passphrase.c_str());
	}
	git_error_set_str(GIT_ERROR_SSH, "the server offers no authentication the app supports");
	return GIT_EAUTH;
}

int push_update_reference(const char *refname, const char *status, void *data)
{
	auto *context = static_cast<RemoteContext *>(data);
	if (status != nullptr && context->push_rejection.empty())
		context->push_rejection = std::string(refname) + ": " + status;
	return 0;
}

void prepare_callbacks(git_remote_callbacks *callbacks, RemoteContext *context)
{
	callbacks->credentials = credentials;
	callbacks->certificate_check = certificate_check;
	callbacks->push_update_reference = push_update_reference;
	callbacks->payload = context;
}

// A network failure, reworded when it was the host key check that ended it.
BridgeError remote_error(const std::string &what, int code, const RemoteContext &context)
{
	if (context.host_key_problem != 0) {
		std::string message = context.host_key_problem == UnknownHostKey
					      ? "The host key of " + context.host + " is not trusted yet."
					      : "The host key of " + context.host + " has changed.";
		return BridgeError{ context.host_key_problem, message, context.host, context.fingerprint, {} };
	}
	return last_git_error(what, code);
}

RemoteContext make_context(JNIEnv *env, jstring url, jstring private_key, jstring passphrase, jstring trusted)
{
	RemoteContext context;
	context.url = to_string(env, url);
	context.private_key = to_string(env, private_key);
	context.passphrase = to_string(env, passphrase);
	context.trusted_host_key = to_string(env, trusted);
	return context;
}

// The "origin" remote, created on first use and re-pointed whenever the URL in
// the settings has changed since.
void lookup_remote(Remote &remote, git_repository *repo, const std::string &url)
{
	int code = git_remote_lookup(remote.out(), repo, "origin");
	if (code == GIT_ENOTFOUND) {
		check(git_remote_create(remote.out(), repo, "origin", url.c_str()), "Could not add the remote");
		return;
	}
	check(code, "Could not read the remote");
	if (strcmp(git_remote_url(remote.get()), url.c_str()) == 0)
		return;
	git_remote_free(remote.ptr);
	remote.ptr = nullptr;
	check(git_remote_set_url(repo, "origin", url.c_str()), "Could not change the remote");
	check(git_remote_lookup(remote.out(), repo, "origin"), "Could not read the remote");
}

// Commit id a ref points at, or "" when it does not exist.
std::string resolve_ref(git_repository *repo, const std::string &ref)
{
	git_oid oid;
	int code = git_reference_name_to_id(&oid, repo, ref.c_str());
	if (code == GIT_ENOTFOUND)
		return {};
	check(code, "Could not read a branch");
	return oid_string(&oid);
}

jstring nullable_string(JNIEnv *env, const std::string &value)
{
	return value.empty() ? nullptr : env->NewStringUTF(value.c_str());
}

jobjectArray string_array(JNIEnv *env, const std::vector<std::string> &values)
{
	jobjectArray out = env->NewObjectArray(static_cast<jsize>(values.size()), env->FindClass("java/lang/String"),
					       nullptr);
	for (size_t i = 0; i < values.size(); ++i)
		env->SetObjectArrayElement(out, static_cast<jsize>(i), env->NewStringUTF(values[i].c_str()));
	return out;
}

bool read_file(const std::string &path, std::string &out)
{
	FILE *f = fopen(path.c_str(), "rb");
	if (f == nullptr)
		return false;
	char buffer[65536];
	size_t n;
	while ((n = fread(buffer, 1, sizeof buffer, f)) > 0)
		out.append(buffer, n);
	bool ok = ferror(f) == 0;
	fclose(f);
	return ok;
}

// Atomic, as on iOS: the destination may be the app's working logbook.
bool write_file_atomic(const std::string &path, const void *data, size_t size)
{
	std::string temp = path + ".git-sync-tmp";
	FILE *f = fopen(temp.c_str(), "wb");
	if (f == nullptr)
		return false;
	bool ok = fwrite(data, 1, size, f) == size;
	ok = fflush(f) == 0 && ok;
	ok = fclose(f) == 0 && ok;
	if (!ok || rename(temp.c_str(), path.c_str()) != 0) {
		remove(temp.c_str());
		return false;
	}
	return true;
}

} // namespace

extern "C" {

JNIEXPORT void JNICALL Java_expo_modules_gitsync_GitSyncModule_nativeEnsureRepository(JNIEnv *env, jclass,
										       jstring path)
{
	init_once();
	guarded(env, 0, [&] {
		Repo repo;
		check(git_repository_init(repo.out(), to_string(env, path).c_str(), 1),
		      "Could not create the sync repository");
		return 0;
	});
}

// Commit id of a ref, or null if it has no commits.
JNIEXPORT jstring JNICALL Java_expo_modules_gitsync_GitSyncModule_nativeHead(JNIEnv *env, jclass, jstring path,
									  jstring ref)
{
	init_once();
	return guarded(env, static_cast<jstring>(nullptr), [&] {
		Repo repo;
		open_repository(repo, to_string(env, path));
		return nullable_string(env, resolve_ref(repo.get(), to_string(env, ref)));
	});
}

// Fetches <branch>; the remote's commit id, or null when it has no such branch.
JNIEXPORT jstring JNICALL Java_expo_modules_gitsync_GitSyncModule_nativeFetch(JNIEnv *env, jclass, jstring path,
									   jstring branch_, jstring url,
									   jstring key, jstring passphrase,
									   jstring trusted)
{
	init_once();
	return guarded(env, static_cast<jstring>(nullptr), [&] {
		std::string branch = to_string(env, branch_);
		RemoteContext context = make_context(env, url, key, passphrase, trusted);
		Repo repo;
		Remote remote;
		open_repository(repo, to_string(env, path));
		lookup_remote(remote, repo.get(), context.url);

		// Just the one branch, force-updated: the tracking ref mirrors the
		// server, whatever it did to its history.
		std::string spec = "+" + branch_ref(branch) + ":" + tracking_ref(branch);
		char *specs[] = { spec.data() };
		git_strarray refspecs = { specs, 1 };

		git_fetch_options options = GIT_FETCH_OPTIONS_INIT;
		prepare_callbacks(&options.callbacks, &context);
		// Prune, so a branch deleted on the server stops looking present here.
		options.prune = GIT_FETCH_PRUNE;

		int code = git_remote_fetch(remote.get(), &refspecs, &options, "fetch");
		if (code < 0)
			throw remote_error("Fetch failed", code, context);
		return nullable_string(env, resolve_ref(repo.get(), tracking_ref(branch)));
	});
}

// Pushes refs/heads/<branch>, fast-forward only.
JNIEXPORT void JNICALL Java_expo_modules_gitsync_GitSyncModule_nativePush(JNIEnv *env, jclass, jstring path,
									jstring branch_, jstring url, jstring key,
									jstring passphrase, jstring trusted)
{
	init_once();
	guarded(env, 0, [&] {
		std::string branch = to_string(env, branch_);
		RemoteContext context = make_context(env, url, key, passphrase, trusted);
		Repo repo;
		Remote remote;
		open_repository(repo, to_string(env, path));
		lookup_remote(remote, repo.get(), context.url);

		// No "+": a push that is not a fast-forward of the server's branch is
		// refused rather than overwriting what another device pushed.
		std::string spec = branch_ref(branch) + ":" + branch_ref(branch);
		char *specs[] = { spec.data() };
		git_strarray refspecs = { specs, 1 };

		git_push_options options = GIT_PUSH_OPTIONS_INIT;
		prepare_callbacks(&options.callbacks, &context);

		int code = git_remote_push(remote.get(), &refspecs, &options);
		if (code < 0)
			throw remote_error("Push failed", code, context);
		if (!context.push_rejection.empty())
			throw BridgeError{ PushRejected, "The server refused the push (" + context.push_rejection + ").",
					   {}, {}, context.push_rejection };
		return 0;
	});
}

// Commits `file` as `pathInRepo` on top of the first parent's tree. Returns
// [commit id, "true" | "false" (created)].
JNIEXPORT jobjectArray JNICALL Java_expo_modules_gitsync_GitSyncModule_nativeCommitFile(
	JNIEnv *env, jclass, jstring path, jstring file_, jstring path_in_repo_, jstring branch_, jobjectArray parent_ids,
	jstring message_, jstring author_name, jstring author_email, jboolean skip_if_unchanged)
{
	init_once();
	return guarded(env, static_cast<jobjectArray>(nullptr), [&] {
		std::string file = to_string(env, file_);
		std::string path_in_repo = to_string(env, path_in_repo_);
		std::string branch = to_string(env, branch_);
		std::vector<std::string> ids;
		for (jsize i = 0; i < env->GetArrayLength(parent_ids); ++i)
			ids.push_back(to_string(env, static_cast<jstring>(env->GetObjectArrayElement(parent_ids, i))));

		std::string content;
		if (!read_file(file, content))
			throw BridgeError{ Failed, "Could not read " + file, {}, {}, {} };
		if (ids.size() > 2)
			throw BridgeError{ Failed, "A commit has at most two parents here.", {}, {}, {} };

		Repo repo;
		open_repository(repo, to_string(env, path));
		Commit parents[2];
		const git_commit *parent_ptrs[2] = { nullptr, nullptr };
		for (size_t i = 0; i < ids.size(); ++i) {
			git_oid oid = parse_oid(ids[i]);
			check(git_commit_lookup(parents[i].out(), repo.get(), &oid), "Unknown parent commit");
			parent_ptrs[i] = parents[i].get();
		}
		Tree base_tree;
		if (parents[0].get() != nullptr)
			check(git_commit_tree(base_tree.out(), parents[0].get()), "Could not read a tree");

		git_oid blob;
		check(git_blob_create_from_buffer(&blob, repo.get(), content.data(), content.size()),
		      "Could not store the logbook");
		git_tree_update update = {};
		update.action = GIT_TREE_UPDATE_UPSERT;
		update.id = blob;
		update.filemode = GIT_FILEMODE_BLOB;
		update.path = path_in_repo.c_str();
		git_oid tree_id;
		Tree tree;
		check(git_tree_create_updated(&tree_id, repo.get(), base_tree.get(), 1, &update),
		      "Could not build the tree");
		check(git_tree_lookup(tree.out(), repo.get(), &tree_id), "Could not read the tree");

		if (skip_if_unchanged && ids.size() == 1 && git_oid_equal(&tree_id, git_tree_id(base_tree.get())))
			return string_array(env, { ids[0], "false" });

		Signature signature;
		check(git_signature_now(signature.out(), to_string(env, author_name).c_str(),
					to_string(env, author_email).c_str()),
		      "Invalid author");
		git_oid commit_id;
		check(git_commit_create(&commit_id, repo.get(), nullptr, signature.get(), signature.get(), "UTF-8",
					to_string(env, message_).c_str(), tree.get(), ids.size(), parent_ptrs),
		      "Could not commit the logbook");
		Reference ref;
		check(git_reference_create(ref.out(), repo.get(), branch_ref(branch).c_str(), &commit_id, 1, "commit"),
		      "Could not move the branch");
		check(git_repository_set_head(repo.get(), branch_ref(branch).c_str()), "Could not set HEAD");
		return string_array(env, { oid_string(&commit_id), "true" });
	});
}

// Points refs/heads/<branch> at `commit` (a fast-forward to a fetched commit).
JNIEXPORT void JNICALL Java_expo_modules_gitsync_GitSyncModule_nativeSetBranch(JNIEnv *env, jclass, jstring path,
									     jstring branch_, jstring commit)
{
	init_once();
	guarded(env, 0, [&] {
		std::string branch = to_string(env, branch_);
		Repo repo;
		open_repository(repo, to_string(env, path));
		git_oid oid = parse_oid(to_string(env, commit));
		Reference ref;
		check(git_reference_create(ref.out(), repo.get(), branch_ref(branch).c_str(), &oid, 1, "fast-forward"),
		      "Could not move the branch");
		check(git_repository_set_head(repo.get(), branch_ref(branch).c_str()), "Could not set HEAD");
		return 0;
	});
}

// Writes `pathInRepo` as of `commit` to `destination`; false when the commit
// has no such file.
JNIEXPORT jboolean JNICALL Java_expo_modules_gitsync_GitSyncModule_nativeExtractFile(JNIEnv *env, jclass,
										   jstring path, jstring commit,
										   jstring path_in_repo,
										   jstring destination)
{
	init_once();
	return guarded(env, static_cast<jboolean>(JNI_FALSE), [&]() -> jboolean {
		Repo repo;
		open_repository(repo, to_string(env, path));
		git_oid oid = parse_oid(to_string(env, commit));
		Commit found;
		Tree tree;
		check(git_commit_lookup(found.out(), repo.get(), &oid), "Unknown commit");
		check(git_commit_tree(tree.out(), found.get()), "Could not read a tree");
		TreeEntry entry;
		int code = git_tree_entry_bypath(entry.out(), tree.get(), to_string(env, path_in_repo).c_str());
		if (code == GIT_ENOTFOUND)
			return JNI_FALSE;
		check(code, "Could not find the logbook");
		if (git_tree_entry_type(entry.get()) != GIT_OBJECT_BLOB)
			return JNI_FALSE;
		Blob blob;
		check(git_blob_lookup(blob.out(), repo.get(), git_tree_entry_id(entry.get())),
		      "Could not read the logbook");
		std::string dest = to_string(env, destination);
		if (!write_file_atomic(dest, git_blob_rawcontent(blob.get()),
				       static_cast<size_t>(git_blob_rawsize(blob.get()))))
			throw BridgeError{ Failed, "Could not write " + dest, {}, {}, {} };
		return JNI_TRUE;
	});
}

// [ahead, behind]
JNIEXPORT jlongArray JNICALL Java_expo_modules_gitsync_GitSyncModule_nativeAheadBehind(JNIEnv *env, jclass,
										     jstring path, jstring local,
										     jstring upstream)
{
	init_once();
	return guarded(env, static_cast<jlongArray>(nullptr), [&] {
		Repo repo;
		open_repository(repo, to_string(env, path));
		git_oid local_id = parse_oid(to_string(env, local));
		git_oid upstream_id = parse_oid(to_string(env, upstream));
		size_t ahead = 0, behind = 0;
		check(git_graph_ahead_behind(&ahead, &behind, repo.get(), &local_id, &upstream_id),
		      "Could not compare branches");
		jlong values[2] = { static_cast<jlong>(ahead), static_cast<jlong>(behind) };
		jlongArray out = env->NewLongArray(2);
		env->SetLongArrayRegion(out, 0, 2, values);
		return out;
	});
}

// [summary, unix time]
JNIEXPORT jobjectArray JNICALL Java_expo_modules_gitsync_GitSyncModule_nativeDescribeCommit(JNIEnv *env, jclass,
											  jstring path,
											  jstring commit)
{
	init_once();
	return guarded(env, static_cast<jobjectArray>(nullptr), [&] {
		Repo repo;
		open_repository(repo, to_string(env, path));
		git_oid oid = parse_oid(to_string(env, commit));
		Commit found;
		check(git_commit_lookup(found.out(), repo.get(), &oid), "Unknown commit");
		const char *summary = git_commit_summary(found.get());
		return string_array(env, { summary != nullptr ? summary : "",
					   std::to_string(static_cast<long long>(git_commit_time(found.get()))) });
	});
}

// A fresh Ed25519 key: [seed (32 bytes), public key (32 bytes)]. libcrypto is
// already linked for libssh2, and Android's own Ed25519 needs API 33.
JNIEXPORT jobjectArray JNICALL Java_expo_modules_gitsync_GitSyncModule_nativeGenerateEd25519(JNIEnv *env, jclass)
{
	return guarded(env, static_cast<jobjectArray>(nullptr), [&] {
		EVP_PKEY *key = nullptr;
		EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new_id(EVP_PKEY_ED25519, nullptr);
		bool ok = ctx != nullptr && EVP_PKEY_keygen_init(ctx) == 1 && EVP_PKEY_keygen(ctx, &key) == 1;
		EVP_PKEY_CTX_free(ctx);
		unsigned char seed[32], pub[32];
		size_t seed_len = sizeof seed, pub_len = sizeof pub;
		ok = ok && EVP_PKEY_get_raw_private_key(key, seed, &seed_len) == 1 &&
		     EVP_PKEY_get_raw_public_key(key, pub, &pub_len) == 1 && seed_len == 32 && pub_len == 32;
		EVP_PKEY_free(key);
		if (!ok)
			throw BridgeError{ Failed, "Could not generate an SSH key", {}, {}, {} };

		jobjectArray out = env->NewObjectArray(2, env->FindClass("[B"), nullptr);
		jbyteArray s = env->NewByteArray(32);
		env->SetByteArrayRegion(s, 0, 32, reinterpret_cast<const jbyte *>(seed));
		jbyteArray p = env->NewByteArray(32);
		env->SetByteArrayRegion(p, 0, 32, reinterpret_cast<const jbyte *>(pub));
		env->SetObjectArrayElement(out, 0, s);
		env->SetObjectArrayElement(out, 1, p);
		OPENSSL_cleanse(seed, sizeof seed);
		return out;
	});
}

} // extern "C"
