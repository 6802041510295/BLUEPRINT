// Web preview intentionally cannot access the classroom device.
// Metro uses transport.native.ts on Android and iOS.
import { BlePort } from './core';
export const liveSupported = false;
export class NativePort implements BlePort {
  async scan() { throw new Error('หน้านี้เป็น Web Preview ให้เปิดโหมด DEMO หรือใช้ APK บน Android สำหรับ Bluetooth จริง'); }
  async stopScan() {}
  async connect(): Promise<never> { throw new Error('Use the native mobile app'); }
  async disconnect() {}
  async read(): Promise<string> { throw new Error('Use the native mobile app'); }
  async write() { throw new Error('Use the native mobile app'); }
  destroy() {}
}
