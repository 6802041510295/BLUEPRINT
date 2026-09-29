import { BlePort, Peripheral, Connection } from './core';
const pause = () => new Promise(r => setTimeout(r, 500));
export class DemoPort implements BlePort {
  private written = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  async scan(found: (d: Peripheral) => void) {
    this.timer = setTimeout(() => found({ id: 'DEMO-DEVICE', name: 'Classroom device · DEMO', rssi: -48, target: true }), 700);
  }
  async stopScan() { clearTimeout(this.timer); }
  async connect(): Promise<Connection> { await pause(); this.written = false; return { id: 'DEMO-DEVICE', name: 'Classroom device · DEMO', rssi: -48, mtu: 185, canWriteResponse: true, target: true }; }
  async disconnect() {}
  async read() { await pause(); return this.written ? 'DEMO ONLY — Your predicted grade: A' : 'DEMO ONLY — Hello! Write your name.'; }
  async write() { await pause(); this.written = true; }
  destroy() { clearTimeout(this.timer); }
}
