// AI-generated (Claude)
package expo.modules.ssrfcore

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import java.util.UUID

// The GATT driver on android.bluetooth; see cpp/bindings/gatt-driver.h for the
// contract. It only translates: which service to use, the credit protocol,
// timeouts and retries all live in cpp/bindings/ble-stream.cpp.
//
// Called from the download thread through JNI (ssrfcore-jni.cpp) and answered from
// Binder threads. BluetoothGatt takes one operation at a time, which the stream
// guarantees: it waits for each answer before issuing the next. The exception is
// the MTU exchange, which connect() finishes before it reports the connection.
@SuppressLint("MissingPermission") // JS asks for them first, see use-ble-permission.
class SsrfGattDriver(private val context: Context) {
  private val adapter: BluetoothAdapter? =
    (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  private var gatt: BluetoothGatt? = null
  private var scanning = false

  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      val name = result.scanRecord?.deviceName ?: result.device.name ?: ""
      SsrfCoreModule.nativeBleDeviceFound(result.device.address, name, result.rssi)
    }

    override fun onScanFailed(errorCode: Int) {
      Log.w(TAG, "BLE scan failed: $errorCode")
    }
  }

  private val stateReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      reportAdapterState()
    }
  }

  init {
    context.registerReceiver(stateReceiver, IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED))
  }

  private fun reportAdapterState() {
    val state = when {
      adapter == null -> ADAPTER_UNSUPPORTED
      adapter.isEnabled -> ADAPTER_ON
      else -> ADAPTER_OFF
    }
    SsrfCoreModule.nativeBleAdapterState(state)
  }

  fun startScan(knownIds: Array<String>) {
    reportAdapterState()
    val adapter = adapter ?: return
    if (!adapter.isEnabled) return
    try {
      // Many dive computers stop advertising once bonded, so a scan alone would
      // not list them: what the system has paired comes first.
      for (device in adapter.bondedDevices.orEmpty()) {
        if (device.type != BluetoothDevice.DEVICE_TYPE_CLASSIC) {
          SsrfCoreModule.nativeBleDeviceFound(device.address, device.name ?: "", 0)
        }
      }
      for (id in knownIds) {
        if (BluetoothAdapter.checkBluetoothAddress(id)) {
          SsrfCoreModule.nativeBleDeviceFound(id, adapter.getRemoteDevice(id).name ?: "", 0)
        }
      }
      adapter.bluetoothLeScanner?.startScan(scanCallback)
      scanning = true
    } catch (e: SecurityException) {
      SsrfCoreModule.nativeBleAdapterState(ADAPTER_UNAUTHORIZED)
    }
  }

  fun stopScan() {
    if (!scanning) return
    scanning = false
    try {
      adapter?.bluetoothLeScanner?.stopScan(scanCallback)
    } catch (e: SecurityException) {
      // The permission went away while scanning, and with it the scan.
    }
  }

  private val callback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      if (gatt !== this@SsrfGattDriver.gatt) {
        gatt.close()
        return
      }
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        // Dive computers send big packets. Qt's Android backend asks for this too.
        if (!gatt.requestMtu(MAX_MTU)) {
          SsrfCoreModule.nativeBleConnected("")
        }
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        this@SsrfGattDriver.gatt = null
        gatt.close()
        val error = if (status == BluetoothGatt.GATT_SUCCESS) "" else "Bluetooth error $status"
        // Before the connection was reported, this is the failure of connect().
        if (!reported) {
          SsrfCoreModule.nativeBleConnected(error.ifEmpty { "Connection failed" })
        }
        SsrfCoreModule.nativeBleDisconnected(error)
      }
    }

    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
      if (gatt === this@SsrfGattDriver.gatt && !reported) {
        reported = true
        SsrfCoreModule.nativeBleConnected("")
      }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      if (gatt !== this@SsrfGattDriver.gatt) return
      if (status != BluetoothGatt.GATT_SUCCESS) {
        SsrfCoreModule.nativeBleServices("", "Service discovery failed: $status")
        return
      }
      // service uuid, then "characteristic uuid:props" pairs. A flat string, so
      // the JNI side does not have to take Java objects apart.
      val lines = gatt.services.joinToString("\n") { service ->
        val characteristics = service.characteristics.joinToString(" ") { c ->
          "${c.uuid}:${props(c.properties)}"
        }
        "${service.uuid} $characteristics".trimEnd()
      }
      SsrfCoreModule.nativeBleServices(lines, "")
    }

    @Deprecated("Below API 33 this is the only one that is called")
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      @Suppress("DEPRECATION")
      valueChanged(gatt, characteristic, characteristic.value ?: ByteArray(0))
    }

    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
      valueChanged(gatt, characteristic, value)
    }

    @Deprecated("Below API 33 this is the only one that is called")
    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      @Suppress("DEPRECATION")
      readComplete(gatt, characteristic, characteristic.value ?: ByteArray(0), status)
    }

    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
      readComplete(gatt, characteristic, value, status)
    }

    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      if (gatt !== this@SsrfGattDriver.gatt) return
      SsrfCoreModule.nativeBleWriteComplete(characteristic.uuid.toString(), statusText(status))
    }

    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
      if (gatt !== this@SsrfGattDriver.gatt) return
      SsrfCoreModule.nativeBleNotifyEnabled(descriptor.characteristic.uuid.toString(), statusText(status))
    }
  }

  // Whether nativeBleConnected() has been called for the current connection.
  @Volatile private var reported = false

  private fun valueChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
    if (gatt === this.gatt) {
      SsrfCoreModule.nativeBleValueChanged(characteristic.uuid.toString(), value)
    }
  }

  private fun readComplete(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
    if (gatt === this.gatt) {
      SsrfCoreModule.nativeBleReadComplete(characteristic.uuid.toString(), value, statusText(status))
    }
  }

  private fun statusText(status: Int): String =
    if (status == BluetoothGatt.GATT_SUCCESS) "" else "Bluetooth error $status"

  private fun props(properties: Int): Int {
    var out = 0
    if (properties and BluetoothGattCharacteristic.PROPERTY_READ != 0) out = out or 1
    if (properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) out = out or 2
    if (properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0) out = out or 4
    if (properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) out = out or 8
    if (properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0) out = out or 16
    return out
  }

  fun connect(address: String) {
    stopScan()
    val adapter = adapter
    if (adapter == null || !adapter.isEnabled) {
      SsrfCoreModule.nativeBleConnected("Bluetooth is off")
      return
    }
    if (!BluetoothAdapter.checkBluetoothAddress(address)) {
      SsrfCoreModule.nativeBleConnected("Not a Bluetooth address: $address")
      return
    }
    try {
      reported = false
      val device = adapter.getRemoteDevice(address)
      gatt = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
      if (gatt == null) {
        SsrfCoreModule.nativeBleConnected("Connection failed")
      }
    } catch (e: SecurityException) {
      SsrfCoreModule.nativeBleConnected("Bluetooth permission is missing")
    }
  }

  fun discover() {
    if (gatt?.discoverServices() != true) {
      SsrfCoreModule.nativeBleServices("", "Service discovery could not start")
    }
  }

  private fun find(service: String, characteristic: String): BluetoothGattCharacteristic? =
    gatt?.getService(UUID.fromString(service))?.getCharacteristic(UUID.fromString(characteristic))

  fun enableNotify(service: String, characteristic: String) {
    val gatt = gatt
    val c = find(service, characteristic)
    if (gatt == null || c == null) {
      SsrfCoreModule.nativeBleNotifyEnabled(characteristic, "No such characteristic")
      return
    }
    val descriptor = c.getDescriptor(CCCD)
    if (!gatt.setCharacteristicNotification(c, true) || descriptor == null) {
      SsrfCoreModule.nativeBleNotifyEnabled(characteristic, "Could not subscribe")
      return
    }
    val value =
      if (c.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) {
        BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
      } else {
        BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
      }
    val started =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        gatt.writeDescriptor(descriptor, value) == BluetoothGatt.GATT_SUCCESS
      } else {
        @Suppress("DEPRECATION")
        descriptor.value = value
        @Suppress("DEPRECATION")
        gatt.writeDescriptor(descriptor)
      }
    if (!started) {
      SsrfCoreModule.nativeBleNotifyEnabled(characteristic, "Could not subscribe")
    }
  }

  fun write(service: String, characteristic: String, data: ByteArray, withResponse: Boolean) {
    val gatt = gatt
    val c = find(service, characteristic)
    if (gatt == null || c == null) {
      SsrfCoreModule.nativeBleWriteComplete(characteristic, "No such characteristic")
      return
    }
    val type =
      if (withResponse) {
        BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
      } else {
        BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
      }
    val started =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        gatt.writeCharacteristic(c, data, type) == BluetoothGatt.GATT_SUCCESS
      } else {
        @Suppress("DEPRECATION")
        c.writeType = type
        @Suppress("DEPRECATION")
        c.value = data
        @Suppress("DEPRECATION")
        gatt.writeCharacteristic(c)
      }
    if (!started) {
      SsrfCoreModule.nativeBleWriteComplete(characteristic, "Write could not start")
    }
  }

  fun read(service: String, characteristic: String) {
    val c = find(service, characteristic)
    if (c == null || gatt?.readCharacteristic(c) != true) {
      SsrfCoreModule.nativeBleReadComplete(characteristic, ByteArray(0), "Read could not start")
    }
  }

  fun disconnect() {
    val current = gatt ?: return
    gatt = null
    // gatt is cleared first, so nothing that arrives from here on is reported, and
    // a retry cannot be ended by the previous connection's late callback.
    current.disconnect()
    current.close()
    SsrfCoreModule.nativeBleDisconnected("")
  }

  companion object {
    private const val TAG = "ssrf-core"
    private const val MAX_MTU = 512
    private val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    // AdapterState in cpp/bindings/gatt-driver.h, by value.
    const val ADAPTER_UNSUPPORTED = 1
    const val ADAPTER_UNAUTHORIZED = 2
    const val ADAPTER_OFF = 3
    const val ADAPTER_ON = 4
  }
}
