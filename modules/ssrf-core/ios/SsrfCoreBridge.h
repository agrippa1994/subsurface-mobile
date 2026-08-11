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

@end

NS_ASSUME_NONNULL_END
