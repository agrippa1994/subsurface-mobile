// AI-generated (Claude)
//
// libgit2-free replacement for core/git-access.h.
//
// Subsurface's cloud storage keeps logbooks in a git repository. The mobile app
// is file-based (the SSRF file is the source of truth), so git storage is out
// of scope - but save-xml.cpp asks "is this filename a git repository?" before
// it writes, and divelist.cpp clears the git id after a change. Those three
// entry points are kept and stubbed in `shim/git-access.cpp`; the cloud host
// names are kept because parse/save reference them for URL detection.
#ifndef GITACCESS_H
#define GITACCESS_H

#include <string>

struct divelog;
struct git_repository;
struct git_oid;

#define CLOUD_HOST_US "ssrf-cloud-us.subsurface-divelog.org"  // preferred (faster/bigger) server in the US
#define CLOUD_HOST_U2 "ssrf-cloud-u2.subsurface-divelog.org"  // secondary (older) server in the US
#define CLOUD_HOST_EU "ssrf-cloud-eu.subsurface-divelog.org"  // preferred (faster/bigger) server in Germany
#define CLOUD_HOST_E2 "ssrf-cloud-e2.subsurface-divelog.org"  // secondary (older) server in Germany
#define CLOUD_HOST_PATTERN "ssrf-cloud-..\\.subsurface-divelog\\.org"
#define CLOUD_HOST_GENERIC "cloud.subsurface-divelog.org"

enum remote_transport { RT_LOCAL, RT_HTTPS, RT_SSH, RT_OTHER };

// Same shape as upstream minus the libgit2 handle's use: nothing in the mobile
// build ever populates it, but save-xml declares one on the stack.
struct git_info {
	std::string url;
	std::string branch;
	std::string username;
	std::string localdir;
	struct git_repository *repo = nullptr;
	unsigned is_subsurface_cloud : 1;
	enum remote_transport transport = RT_LOCAL;
	git_info();
	~git_info();
};

// Always false in the mobile build: logbooks are plain files.
extern bool is_git_repository(const char *filename, struct git_info *info);
extern int git_save_dives(struct git_info *, bool select_only);
extern void clear_git_id();
extern void set_git_id(const struct git_oid *);

#endif
