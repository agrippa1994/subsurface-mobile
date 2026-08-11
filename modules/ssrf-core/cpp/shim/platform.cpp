// AI-generated (Claude)
//
// Replaces core/ios.cpp (and core/unix.cpp on the host).
//
// Upstream's iOS file is a set of thin POSIX wrappers plus two Qt calls:
// QStandardPaths for the app data directory, and libzip for the zipped import
// formats. The wrappers are reproduced verbatim here; the data directory comes
// from the app instead (set_data_directory(), called by the native module with
// the container path); libzip lands in task 04, so the zip wrappers are not
// defined here yet - nothing in the current subset references them.

#include "device.h"
#include "file.h"

#include <cstdio>
#include <dirent.h>
#include <fcntl.h>
#include <string>
#include <sys/stat.h>
#include <unistd.h>

namespace {
std::string data_directory;
} // namespace

void set_data_directory(const std::string &path)
{
	data_directory = path;
}

std::string system_default_directory()
{
	return data_directory;
}

std::string system_default_filename()
{
	return data_directory + "/subsurface.xml";
}

std::string system_divelist_default_font = "Arial";
double system_divelist_default_font_size = -1.0;

void subsurface_OS_pref_setup()
{
	// nothing
}

bool subsurface_ignore_font(const std::string &)
{
	// there are no old default fonts that we would want to ignore
	return false;
}

int enumerate_devices(device_callback_t, void *, unsigned int)
{
	// we can't read from devices on iOS
	return -1;
}

int subsurface_rename(const char *path, const char *newpath)
{
	return rename(path, newpath);
}

int subsurface_open(const char *path, int oflags, mode_t mode)
{
	return open(path, oflags, mode);
}

FILE *subsurface_fopen(const char *path, const char *mode)
{
	return fopen(path, mode);
}

void *subsurface_opendir(const char *path)
{
	return (void *)opendir(path);
}

int subsurface_access(const char *path, int mode)
{
	return access(path, mode);
}

int subsurface_stat(const char *path, struct stat *buf)
{
	return stat(path, buf);
}

void subsurface_console_init()
{
	/* NOP */
}

void subsurface_console_exit()
{
	/* NOP */
}

bool subsurface_user_is_root()
{
	return false;
}
