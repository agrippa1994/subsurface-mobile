// AI-generated (Claude)
#import "SsrfCoreBridge.h"

#include "ssrfcore.h"

@implementation SsrfCoreBridge

+ (NSInteger)add:(NSInteger)a b:(NSInteger)b
{
  return ssrf::add(static_cast<int>(a), static_cast<int>(b));
}

@end
