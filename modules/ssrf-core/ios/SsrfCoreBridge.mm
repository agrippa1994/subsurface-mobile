// AI-generated (Claude)
#import "SsrfCoreBridge.h"

#include "bindings/api.h"
#include "ssrfcore.h"

@implementation SsrfCoreBridge

// The core loads an XSLT stylesheet by name from a directory when it reads a
// non-SSRF XML format (Suunto DM4, UDDF, ...); upstream serves them out of Qt
// resources, which this build does not have. They ship as the pod's resource
// bundle instead, and the core is pointed at it before the first call - doing
// it here rather than from JavaScript means no screen can forget to.
+ (void)configureOnce
{
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    NSBundle *module = [NSBundle bundleForClass:[SsrfCoreBridge class]];
    NSString *path = [module pathForResource:@"SsrfCoreResources" ofType:@"bundle"];
    // Static frameworks put the bundle next to the app executable instead.
    if (path == nil) {
      path = [[NSBundle mainBundle] pathForResource:@"SsrfCoreResources" ofType:@"bundle"];
    }
    if (path == nil) {
      NSLog(@"[ssrf-core] SsrfCoreResources.bundle not found - XML imports other than SSRF will fail");
      return;
    }
    // Serialized rather than concatenated: the sandbox path is not ours to
    // assume anything about, and it has to survive as JSON.
    NSData *args = [NSJSONSerialization dataWithJSONObject:@{ @"xsltDir" : path }
                                                   options:0
                                                     error:nil];
    NSString *argsJson = [[NSString alloc] initWithData:args encoding:NSUTF8StringEncoding];
    ssrf::call("configure", argsJson.UTF8String);
  });
}

+ (NSString *)call:(NSString *)method argsJson:(NSString *)argsJson
{
  [self configureOnce];
  std::string reply = ssrf::call(method.UTF8String, argsJson.UTF8String);
  // The reply is always valid UTF-8 JSON (nlohmann escapes on dump), so
  // stringWithUTF8String cannot return nil here.
  return [NSString stringWithUTF8String:reply.c_str()];
}

+ (NSInteger)add:(NSInteger)a b:(NSInteger)b
{
  return ssrf::add(static_cast<int>(a), static_cast<int>(b));
}

+ (nullable NSString *)smokeSerializeMinimalLog
{
  std::string xml = ssrf::smoke_serialize_minimal_log();
  if (xml.empty()) {
    return nil;
  }
  return [NSString stringWithUTF8String:xml.c_str()];
}

+ (NSInteger)smokeCountDivesInFile:(NSString *)path
{
  std::string error;
  int dives = ssrf::smoke_count_dives_in_file(path.UTF8String, error);
  if (dives < 0) {
    NSLog(@"[ssrf-core] %s", error.c_str());
  }
  return dives;
}

@end
