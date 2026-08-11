// AI-generated (Claude)
#import "SsrfCoreBridge.h"

#include "ssrfcore.h"

@implementation SsrfCoreBridge

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
