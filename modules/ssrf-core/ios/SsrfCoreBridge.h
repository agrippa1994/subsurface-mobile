// AI-generated (Claude)
// Objective-C facade over the pure C++ core in ../cpp.
//
// This header must stay free of C++ so it can be imported from Swift through
// the module's bridging header. All C++ types live in the .mm implementation.
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SsrfCoreBridge : NSObject

// The whole core API: `method` names the call, `argsJson` carries its
// arguments, and the reply is the JSON envelope described in cpp/api.h.
// Deliberately one entry point - see cpp/API.md.
+ (NSString *)call:(NSString *)method argsJson:(NSString *)argsJson;

// Calls ssrf::add in native C++.
+ (NSInteger)add:(NSInteger)a b:(NSInteger)b;

// Builds a minimal divelog in the vendored Subsurface core and serializes it
// through save-xml. Returns the XML document, or nil if serialization failed.
+ (nullable NSString *)smokeSerializeMinimalLog;

// Parses an SSRF/XML logbook and returns its dive count, or -1 on failure.
+ (NSInteger)smokeCountDivesInFile:(NSString *)path;

@end

NS_ASSUME_NONNULL_END
