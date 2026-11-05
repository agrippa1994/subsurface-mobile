// AI-generated (Claude)
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// Registers the CoreBluetooth driver with the core. CBCentralManager is only
// created on the first scan or connect, so no permission prompt shows at launch.
@interface SsrfGattDriver : NSObject
+ (void)install;
@end

NS_ASSUME_NONNULL_END
