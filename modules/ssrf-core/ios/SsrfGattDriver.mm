// AI-generated (Claude)
//
// The GATT driver on CoreBluetooth; see cpp/bindings/gatt-driver.h for the
// contract. It only translates: which service to use, the credit protocol,
// timeouts and retries all live in cpp/bindings/ble-stream.cpp.
//
// Everything here runs on one private serial queue. A driver method only
// dispatches onto it, so the download thread never touches CoreBluetooth.

#import "SsrfGattDriver.h"

#import <CoreBluetooth/CoreBluetooth.h>

#include "bindings/ble-stream.h"

#include <string>
#include <vector>

using namespace ssrf::ble;

static std::string std_string(NSString *value)
{
  return value ? std::string(value.UTF8String) : std::string();
}

static std::string error_string(NSError *error)
{
  return error ? std_string(error.localizedDescription) : std::string();
}

static std::vector<uint8_t> bytes_of(NSData *data)
{
  const auto *bytes = static_cast<const uint8_t *>(data.bytes);
  return bytes ? std::vector<uint8_t>(bytes, bytes + data.length) : std::vector<uint8_t>();
}

static CBUUID *cb_uuid(const std::string &uuid)
{
  return [CBUUID UUIDWithString:[NSString stringWithUTF8String:uuid.c_str()]];
}

@interface SsrfCentral : NSObject <CBCentralManagerDelegate, CBPeripheralDelegate>
- (void)startScanKnown:(std::vector<std::string>)known services:(std::vector<std::string>)services;
- (void)stopScan;
- (void)connect:(std::string)address;
- (void)discover;
- (void)enableNotify:(std::string)service characteristic:(std::string)characteristic;
- (void)write:(std::string)service characteristic:(std::string)characteristic data:(std::vector<uint8_t>)data withResponse:(BOOL)withResponse;
- (void)read:(std::string)service characteristic:(std::string)characteristic;
- (void)disconnect;
@property(nonatomic, readonly) dispatch_queue_t queue;
@end

@implementation SsrfCentral {
  CBCentralManager *_manager;
  // Kept here too: CoreBluetooth cancels a connection whose peripheral is released.
  NSMutableDictionary<NSUUID *, CBPeripheral *> *_seen;
  CBPeripheral *_peripheral;
  // Waiting for the adapter to be ready, because the manager was only just made.
  dispatch_block_t _whenPoweredOn;
  // Service discovery comes back per service.
  NSUInteger _servicesPending;
  // A write without response whose answer waits for room in the send queue.
  std::string _waitingToSend;
}

- (instancetype)init
{
  if ((self = [super init])) {
    _queue = dispatch_queue_create("codes.mani.subsurface.ble", DISPATCH_QUEUE_SERIAL);
    _seen = [NSMutableDictionary new];
  }
  return self;
}

- (void)ensureManager
{
  if (!_manager) {
    _manager = [[CBCentralManager alloc] initWithDelegate:self
                                                    queue:_queue
                                                  options:@{ CBCentralManagerOptionShowPowerAlertKey : @NO }];
  }
}

- (void)whenPoweredOn:(dispatch_block_t)block
{
  [self ensureManager];
  if (_manager.state == CBManagerStatePoweredOn) {
    block();
  } else {
    _whenPoweredOn = block;
  }
}

- (void)centralManagerDidUpdateState:(CBCentralManager *)central
{
  switch (central.state) {
    case CBManagerStatePoweredOn:
      gatt_event_adapter_state(AdapterState::On);
      if (_whenPoweredOn) {
        dispatch_block_t block = _whenPoweredOn;
        _whenPoweredOn = nil;
        block();
      }
      return;
    case CBManagerStatePoweredOff:
      gatt_event_adapter_state(AdapterState::Off);
      break;
    case CBManagerStateUnauthorized:
      gatt_event_adapter_state(AdapterState::Unauthorized);
      break;
    case CBManagerStateUnsupported:
      gatt_event_adapter_state(AdapterState::Unsupported);
      break;
    default:
      return; // Resetting and unknown settle by themselves.
  }
  // Whatever was waiting for the adapter will not get it now.
  _whenPoweredOn = nil;
}

- (void)reportPeripheral:(CBPeripheral *)peripheral name:(NSString *)name rssi:(int)rssi
{
  _seen[peripheral.identifier] = peripheral;
  gatt_event_device_found(std_string(peripheral.identifier.UUIDString), std_string(name), rssi);
}

- (void)startScanKnown:(std::vector<std::string>)known services:(std::vector<std::string>)services
{
  [self whenPoweredOn:^{
    // Many dive computers stop advertising once bonded, so a scan alone would not
    // list them: what the system already knows goes first.
    NSMutableArray<NSUUID *> *identifiers = [NSMutableArray new];
    for (const std::string &id : known) {
      NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:[NSString stringWithUTF8String:id.c_str()]];
      if (uuid) {
        [identifiers addObject:uuid];
      }
    }
    for (CBPeripheral *peripheral in [self->_manager retrievePeripheralsWithIdentifiers:identifiers]) {
      [self reportPeripheral:peripheral name:peripheral.name rssi:0];
    }
    NSMutableArray<CBUUID *> *uuids = [NSMutableArray new];
    for (const std::string &service : services) {
      [uuids addObject:cb_uuid(service)];
    }
    for (CBPeripheral *peripheral in [self->_manager retrieveConnectedPeripheralsWithServices:uuids]) {
      [self reportPeripheral:peripheral name:peripheral.name rssi:0];
    }
    // No service filter: several dive computers do not advertise their service.
    [self->_manager scanForPeripheralsWithServices:nil options:nil];
  }];
}

- (void)centralManager:(CBCentralManager *)central
 didDiscoverPeripheral:(CBPeripheral *)peripheral
     advertisementData:(NSDictionary<NSString *, id> *)advertisementData
                  RSSI:(NSNumber *)RSSI
{
  // The advertised name is fresher than peripheral.name, which iOS caches per
  // device, sometimes from a time before the firmware changed it.
  NSString *name = advertisementData[CBAdvertisementDataLocalNameKey] ?: peripheral.name;
  [self reportPeripheral:peripheral name:name rssi:RSSI.intValue];
}

- (void)stopScan
{
  _whenPoweredOn = nil;
  [_manager stopScan];
}

- (void)connect:(std::string)address
{
  [self whenPoweredOn:^{
    [self->_manager stopScan];
    NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:[NSString stringWithUTF8String:address.c_str()]];
    CBPeripheral *peripheral = uuid ? self->_seen[uuid] : nil;
    if (!peripheral && uuid) {
      peripheral = [self->_manager retrievePeripheralsWithIdentifiers:@[ uuid ]].firstObject;
    }
    if (!peripheral) {
      gatt_event_connected("The dive computer is not known to this device. Bring it close and rescan.");
      return;
    }
    self->_peripheral = peripheral;
    peripheral.delegate = self;
    [self->_manager connectPeripheral:peripheral options:nil];
  }];
}

- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
  if (peripheral == _peripheral) {
    gatt_event_connected("");
  }
}

- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
  if (peripheral == _peripheral) {
    _peripheral = nil;
    gatt_event_connected(error ? error_string(error) : "Connection failed");
  }
}

- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error
{
  // A peripheral this driver has moved on from must not end the next connection.
  if (peripheral == _peripheral) {
    _peripheral = nil;
    gatt_event_disconnected(error_string(error));
  }
}

- (void)disconnect
{
  CBPeripheral *peripheral = _peripheral;
  _peripheral = nil;
  _waitingToSend.clear();
  if (peripheral) {
    [_manager cancelPeripheralConnection:peripheral];
    gatt_event_disconnected("");
  }
}

- (void)discover
{
  [_peripheral discoverServices:nil];
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(NSError *)error
{
  if (peripheral != _peripheral) {
    return;
  }
  if (error) {
    gatt_event_services({}, error_string(error));
    return;
  }
  _servicesPending = peripheral.services.count;
  if (_servicesPending == 0) {
    gatt_event_services({}, "");
    return;
  }
  for (CBService *service in peripheral.services) {
    [peripheral discoverCharacteristics:nil forService:service];
  }
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service error:(NSError *)error
{
  if (peripheral != _peripheral || _servicesPending == 0) {
    return;
  }
  // One service failing does not matter unless it is the serial one, in which
  // case it will have no characteristics and the selection will skip it.
  if (--_servicesPending > 0) {
    return;
  }
  std::vector<Service> services;
  for (CBService *s in peripheral.services) {
    Service out;
    out.uuid = normalize_uuid(std_string(s.UUID.UUIDString));
    for (CBCharacteristic *c in s.characteristics) {
      unsigned props = 0;
      if (c.properties & CBCharacteristicPropertyRead) {
        props |= PROP_READ;
      }
      if (c.properties & CBCharacteristicPropertyWrite) {
        props |= PROP_WRITE;
      }
      if (c.properties & CBCharacteristicPropertyWriteWithoutResponse) {
        props |= PROP_WRITE_NO_RESPONSE;
      }
      if (c.properties & CBCharacteristicPropertyNotify) {
        props |= PROP_NOTIFY;
      }
      if (c.properties & CBCharacteristicPropertyIndicate) {
        props |= PROP_INDICATE;
      }
      out.characteristics.push_back({ normalize_uuid(std_string(c.UUID.UUIDString)), props });
    }
    services.push_back(std::move(out));
  }
  gatt_event_services(services, "");
}

- (CBCharacteristic *)find:(const std::string &)service characteristic:(const std::string &)characteristic
{
  const CBUUID *serviceUuid = cb_uuid(service);
  const CBUUID *characteristicUuid = cb_uuid(characteristic);
  for (CBService *s in _peripheral.services) {
    if (![s.UUID isEqual:serviceUuid]) {
      continue;
    }
    for (CBCharacteristic *c in s.characteristics) {
      if ([c.UUID isEqual:characteristicUuid]) {
        return c;
      }
    }
  }
  return nil;
}

- (void)enableNotify:(std::string)service characteristic:(std::string)characteristic
{
  CBCharacteristic *c = [self find:service characteristic:characteristic];
  if (!c) {
    gatt_event_notify_enabled(characteristic, "No such characteristic");
    return;
  }
  [_peripheral setNotifyValue:YES forCharacteristic:c];
}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateNotificationStateForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
  if (peripheral == _peripheral) {
    gatt_event_notify_enabled(normalize_uuid(std_string(characteristic.UUID.UUIDString)), error_string(error));
  }
}

- (void)write:(std::string)service characteristic:(std::string)characteristic data:(std::vector<uint8_t>)data withResponse:(BOOL)withResponse
{
  CBCharacteristic *c = [self find:service characteristic:characteristic];
  if (!c) {
    gatt_event_write_complete(characteristic, "No such characteristic");
    return;
  }
  NSData *value = [NSData dataWithBytes:data.data() length:data.size()];
  if (withResponse) {
    [_peripheral writeValue:value forCharacteristic:c type:CBCharacteristicWriteWithResponse];
    return;
  }
  [_peripheral writeValue:value forCharacteristic:c type:CBCharacteristicWriteWithoutResponse];
  // The answer is "there is room for the next one", so a burst cannot overrun
  // what iOS queues (and silently drops).
  if (_peripheral.canSendWriteWithoutResponse) {
    gatt_event_write_complete(characteristic, "");
  } else {
    _waitingToSend = characteristic;
  }
}

- (void)peripheralIsReadyToSendWriteWithoutResponse:(CBPeripheral *)peripheral
{
  if (peripheral == _peripheral && !_waitingToSend.empty()) {
    const std::string characteristic = _waitingToSend;
    _waitingToSend.clear();
    gatt_event_write_complete(characteristic, "");
  }
}

- (void)peripheral:(CBPeripheral *)peripheral didWriteValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
  if (peripheral == _peripheral) {
    gatt_event_write_complete(normalize_uuid(std_string(characteristic.UUID.UUIDString)), error_string(error));
  }
}

- (void)read:(std::string)service characteristic:(std::string)characteristic
{
  CBCharacteristic *c = [self find:service characteristic:characteristic];
  if (!c) {
    gatt_event_read_complete(characteristic, {}, "No such characteristic");
    return;
  }
  [_peripheral readValueForCharacteristic:c];
}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error
{
  if (peripheral != _peripheral) {
    return;
  }
  const std::string uuid = normalize_uuid(std_string(characteristic.UUID.UUIDString));
  // CoreBluetooth has one callback for a notification and for a read. Telling them
  // apart matters only while the stream waits for a read: isNotifying says which.
  if (characteristic.isNotifying && !error) {
    gatt_event_value_changed(uuid, bytes_of(characteristic.value));
  } else {
    gatt_event_read_complete(uuid, bytes_of(characteristic.value), error_string(error));
  }
}

@end

namespace {

class CoreBluetoothDriver : public GattDriver {
public:
  CoreBluetoothDriver() : central([SsrfCentral new]) {}

  void start_scan(const std::vector<std::string> &known_ids, const std::vector<std::string> &service_uuids) override
  {
    std::vector<std::string> known = known_ids, services = service_uuids;
    dispatch_async(central.queue, ^{
      [central startScanKnown:known services:services];
    });
  }

  void stop_scan() override
  {
    dispatch_async(central.queue, ^{
      [central stopScan];
    });
  }

  void connect(const std::string &address) override
  {
    std::string copy = address;
    dispatch_async(central.queue, ^{
      [central connect:copy];
    });
  }

  void discover() override
  {
    dispatch_async(central.queue, ^{
      [central discover];
    });
  }

  void enable_notify(const std::string &service, const std::string &characteristic) override
  {
    std::string s = service, c = characteristic;
    dispatch_async(central.queue, ^{
      [central enableNotify:s characteristic:c];
    });
  }

  void write(const std::string &service, const std::string &characteristic, const std::vector<uint8_t> &data, bool with_response) override
  {
    std::string s = service, c = characteristic;
    std::vector<uint8_t> d = data;
    dispatch_async(central.queue, ^{
      [central write:s characteristic:c data:d withResponse:with_response];
    });
  }

  void read(const std::string &service, const std::string &characteristic) override
  {
    std::string s = service, c = characteristic;
    dispatch_async(central.queue, ^{
      [central read:s characteristic:c];
    });
  }

  void disconnect() override
  {
    dispatch_async(central.queue, ^{
      [central disconnect];
    });
  }

private:
  SsrfCentral *central;
};

} // namespace

@implementation SsrfGattDriver

+ (void)install
{
  // Never destroyed, as the contract in gatt-driver.h asks.
  static CoreBluetoothDriver *driver = new CoreBluetoothDriver();
  set_gatt_driver(driver);
}

@end
