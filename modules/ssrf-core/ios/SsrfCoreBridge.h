// AI-generated (Claude)
// Objective-C facade over the pure C++ core in ../cpp.
//
// This header must stay free of C++ so it can be imported from Swift through
// the module's bridging header. All C++ types live in the .mm implementation.
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SsrfCoreBridge : NSObject

// Calls ssrf::add in native C++.
+ (NSInteger)add:(NSInteger)a b:(NSInteger)b;

// Builds a minimal divelog in the vendored Subsurface core and serializes it
// through save-xml. Returns the XML document, or nil if serialization failed.
+ (nullable NSString *)smokeSerializeMinimalLog;

// Parses an SSRF/XML logbook and returns its dive count, or -1 on failure.
+ (NSInteger)smokeCountDivesInFile:(NSString *)path;

@end

NS_ASSUME_NONNULL_END
