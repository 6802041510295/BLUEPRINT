import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { BlePort, Peripheral, SERVICE_UUID, CHAR_UUID, Connection } from './core';
export const liveSupported = true;
export class NativePort implements BlePort {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private subscription: Subscription | null = null;
  private response = true;
  private closed = false;
  private scanning = false;
  private getManager() {
    if (this.closed) throw new Error('Session closed');
    if (!this.manager) {
      try { this.manager = new BleManager(); }
      catch { throw new Error('ต้องติดตั้ง APK หรือ Development Build ของ BLUEPRINT บนมือถือจริง (Expo Go ไม่รองรับ BLE)'); }
    }
    return this.manager;
  }
  private async permission() {
    if (Platform.OS !== 'android') return;
    const permissions = Number(Platform.Version) >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(permissions);
    if (!permissions.every(p => result[p] === PermissionsAndroid.RESULTS.GRANTED))
      throw new Error('กรุณาอนุญาต Bluetooth / Nearby devices ใน Settings ของแอป (Android 11 หรือต่ำกว่าต้องเปิด Location ด้วย)');
  }
  async scan(found: (d: Peripheral) => void, failed: (e: Error) => void) {
    this.scanning = true;
    await this.permission();
    if (!this.scanning || this.closed) return;
    const manager = this.getManager();
    let state = await manager.state();
    if (state === State.Unknown) {
      await new Promise(resolve => setTimeout(resolve, 500));
      state = await manager.state();
    }
    if (state !== State.PoweredOn) throw new Error(state === State.Unsupported ? 'อุปกรณ์นี้ไม่รองรับ Bluetooth Low Energy' : state === State.Unauthorized ? 'ยังไม่ได้อนุญาต Bluetooth กรุณาเปิดสิทธิ์ใน Settings' : 'กรุณาเปิด Bluetooth แล้วกดค้นหาอีกครั้ง');
    if (!this.scanning || this.closed) return;
    // Scan all: some peripherals do not advertise their service UUID.
    await manager.startDeviceScan(null, { allowDuplicates: false }, (error, d) => {
      if (!this.scanning || this.closed) return;
      if (error) { failed(new Error(error.message)); return; }
      if (!d || d.isConnectable === false) return;
      found({ id: d.id, name: d.name || d.localName || 'Unnamed BLE device', rssi: d.rssi,
        target: d.serviceUUIDs?.some(u => u.toLowerCase() === SERVICE_UUID) });
    });
  }
  async stopScan() { this.scanning = false; if (this.manager) await this.manager.stopDeviceScan(); }
  async connect(id: string, lost: () => void): Promise<Connection> {
    const manager = this.getManager();
    try {
      let d = await manager.connectToDevice(id, { timeout: 15000 });
      d = await d.discoverAllServicesAndCharacteristics();
      const services = await d.services();
      if (!services.some(s => s.uuid.toLowerCase() === SERVICE_UUID)) throw new Error('อุปกรณ์นี้ไม่มี Service UUID ของอาจารย์ กรุณาเลือกอุปกรณ์อื่น');
      const chars = await d.characteristicsForService(SERVICE_UUID);
      const characteristic = chars.find(c => c.uuid.toLowerCase() === CHAR_UUID);
      if (!characteristic?.isReadable || !(characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse))
        throw new Error('ไม่พบ Characteristic ที่อ่านและเขียนได้ตาม UUID ที่กำหนด');
      if (Platform.OS === 'android') {
        try { d = await d.requestMTU(185); } catch { /* Keep negotiated default; write checks size. */ }
      }
      this.device = d;
      this.response = characteristic.isWritableWithResponse;
      this.subscription?.remove();
      this.subscription = manager.onDeviceDisconnected(id, () => { this.device = null; lost(); });
      return { id: d.id, name: d.name || d.localName || 'Classroom BLE device', rssi: d.rssi, mtu: d.mtu, canWriteResponse: this.response, target: true };
    } catch (e) { await manager.cancelDeviceConnection(id).catch(() => {}); throw e; }
  }
  async disconnect() {
    const id = this.device?.id;
    this.subscription?.remove(); this.subscription = null;
    if (id && this.manager) await this.manager.cancelDeviceConnection(id);
    this.device = null;
  }
  async read() {
    if (!this.device) throw new Error('อุปกรณ์หลุดการเชื่อมต่อ กรุณาเชื่อมต่อใหม่');
    const c = await this.device.readCharacteristicForService(SERVICE_UUID, CHAR_UUID);
    if (c.value === null) throw new Error('อุปกรณ์ไม่คืนค่า Characteristic');
    return Buffer.from(c.value, 'base64').toString('utf8');
  }
  async write(text: string) {
    if (!this.device) throw new Error('อุปกรณ์หลุดการเชื่อมต่อ กรุณาเชื่อมต่อใหม่');
    const bytes = Buffer.from(text, 'utf8');
    if (bytes.length > 512) throw new Error('ข้อความเกินขนาดสูงสุด 512 bytes กรุณาย่อข้อความ');
    if (Platform.OS === 'android' && bytes.length > this.device.mtu - 3)
      throw new Error(`ข้อความ ${bytes.length} bytes เกิน MTU ที่อุปกรณ์รองรับ (${this.device.mtu - 3} bytes) ลองเชื่อมต่อใหม่หรือให้อาจารย์เพิ่ม MTU แอปจะไม่แบ่งชื่อเป็นหลายคำสั่งโดยอัตโนมัติ`);
    const value = bytes.toString('base64');
    if (this.response) await this.device.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID, value);
    else await this.device.writeCharacteristicWithoutResponseForService(SERVICE_UUID, CHAR_UUID, value);
  }
  destroy() {
    this.closed = true; this.scanning = false;
    this.subscription?.remove();
    const manager = this.manager, id = this.device?.id;
    if (manager) void (async () => {
      await manager.stopDeviceScan().catch(() => {});
      if (id) await manager.cancelDeviceConnection(id).catch(() => {});
      await manager.destroy().catch(() => {});
    })();
    this.manager = null; this.device = null;
  }
}
