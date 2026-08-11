// AI-generated (Claude)
//
// Stubs for the git storage entry points the vendored subset calls. Cloud/git
// logbooks are out of scope; see cpp/shim/override/git-access.h.

#include "git-access.h"

git_info::git_info() : is_subsurface_cloud(0)
{
}

git_info::~git_info()
{
}

bool is_git_repository(const char *, struct git_info *)
{
	// A plain file path is never a git repository here, so save-xml always
	// takes its regular XML path.
	return false;
}

int git_save_dives(struct git_info *, bool)
{
	return -1;
}

void clear_git_id()
{
}

void set_git_id(const struct git_oid *)
{
}
