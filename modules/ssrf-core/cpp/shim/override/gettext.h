// AI-generated (Claude)
//
// Replacement for core/gettext.h.
//
// Same two declarations as upstream (translate() forwarding to trGettext(),
// which shim/gettext.cpp implements as the identity), plus the QT_TRANSLATE_NOOP
// macro. dive.cpp and equipment.cpp mark literals with that macro while
// including only this header - in the desktop build it arrives through Qt.
#ifndef MYGETTEXT_H
#define MYGETTEXT_H

#include <QtGlobal>

const char *trGettext(const char *);
static inline const char *translate(const char *, const char *arg)
{
	return trGettext(arg);
}

#endif // MYGETTEXT_H
