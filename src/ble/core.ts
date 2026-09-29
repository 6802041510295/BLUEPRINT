export const SERVICE_UUID = 'aee04821-1973-4e1f-a590-e84b10d580e7';
export const CHAR_UUID = 'cde07b1a-889b-44b7-a99f-c888dddac729';
export const DEFAULT_NAME = 'chayanis nusati';
export type Mode = 'live' | 'demo';
export type Peripheral = { id: string; name: string; rssi: number | null; target?: boolean };
export type Connection = Peripheral & { mtu: number; canWriteResponse: boolean };
export interface BlePort {
  scan(found: (device: Peripheral) => void, failed: (error: Error) => void): Promise<void>;
  stopScan(): Promise<void>;
  connect(id: string, lost: () => void): Promise<Connection>;
  disconnect(): Promise<void>;
  read(): Promise<string>;
  write(text: string): Promise<void>;
  destroy(): void;
}
export type Reading = { value: string; time: string };
export type Entry = { action: string; detail: string; time: string; kind: 'ok' | 'info' | 'error' };
export type Snapshot = {
  mode: Mode; scanning: boolean; busy: string | null; devices: Peripheral[];
  device: Connection | null; initial: Reading | null; sent: Reading | null; result: Reading | null;
  error: string | null; logs: Entry[];
};
export function makePayload(name: string) {
  if (!name.trim()) throw new Error('กรอกชื่อก่อนส่ง');
  return name.trim();
}
export class LabSession {
  state: Snapshot;
  private listeners = new Set<() => void>();
  private scanTimer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;
  private scanRevision = 0;
  private alive = true;
  constructor(private port: BlePort, mode: Mode = 'live') {
    this.state = { mode, scanning: false, busy: null, devices: [], device: null, initial: null, sent: null, result: null, error: null, logs: [] };
  }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.state;
  private patch(value: Partial<Snapshot>) { if (!this.alive) return; this.state = { ...this.state, ...value }; this.listeners.forEach(fn => fn()); }
  private log(action: string, detail: string, kind: Entry['kind'] = 'ok') {
    this.patch({ logs: [{ action, detail, kind, time: new Date().toISOString() }, ...this.state.logs].slice(0, 80) });
  }
  private fail(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.patch({ error: message }); this.log('ERROR', message, 'error');
  }
  clearError() { this.patch({ error: null }); }
  async stopScan() {
    ++this.scanRevision;
    clearTimeout(this.scanTimer);
    await this.port.stopScan().catch(() => {});
    this.patch({ scanning: false });
  }
  async scan() {
    if (this.state.busy || this.state.device || this.state.scanning) return;
    const generation = ++this.scanRevision;
    this.patch({ devices: [], scanning: true, error: null });
    this.log('SCAN', 'Searching for nearby BLE devices', 'info');
    try {
      await this.port.scan(device => {
        if (!this.alive || generation !== this.scanRevision) return;
        const list = this.state.devices.filter(d => d.id !== device.id);
        this.patch({ devices: [...list, device].sort((a, b) => Number(!!b.target) - Number(!!a.target) || (b.rssi ?? -999) - (a.rssi ?? -999)) });
      }, error => { if (generation === this.scanRevision) { this.fail(error); void this.stopScan(); } });
      if (generation !== this.scanRevision || !this.alive) return;
      this.scanTimer = setTimeout(() => { void this.stopScan(); }, 12000);
    } catch (error) { if (generation === this.scanRevision) { this.fail(error); await this.stopScan(); } }
  }
  private async run(label: string, work: (revision: number) => Promise<void>) {
    if (this.state.busy) return;
    this.patch({ busy: label, error: null });
    const revision = this.revision;
    try { await work(revision); } catch (error) { if (revision === this.revision) this.fail(error); }
    finally { this.patch({ busy: null }); }
  }
  async connect(id: string) {
    await this.run('Connecting', async rev => {
      await this.stopScan();
      const device = await this.port.connect(id, () => {
        ++this.revision;
        this.patch({ device: null, initial: null, sent: null, result: null, error: 'การเชื่อมต่อสิ้นสุด กรุณาเชื่อมต่อใหม่และทำตามขั้นตอนอีกครั้ง' });
        this.log('DISCONNECTED', 'Connection ended; start a new session', 'info');
      });
      if (rev !== this.revision || !this.alive) { await this.port.disconnect(); return; }
      this.patch({ device, initial: null, sent: null, result: null });
      this.log('CONNECTED', `${device.name} · ${device.id} · MTU ${device.mtu}`);
    });
  }
  async disconnect() {
    await this.run('Disconnecting', async () => {
      await this.port.disconnect(); ++this.revision;
      this.patch({ device: null, initial: null, sent: null, result: null });
      this.log('DISCONNECTED', 'Disconnected by user', 'info');
    });
  }
  async readInitial() {
    await this.run('Reading', async rev => {
      if (!this.state.device) throw new Error('เชื่อมต่ออุปกรณ์ก่อนอ่านค่า');
      const value = await this.port.read();
      if (rev !== this.revision) return;
      this.patch({ initial: { value, time: new Date().toISOString() }, sent: null, result: null });
      this.log('READ 01', value);
    });
  }
  async writeName(name: string) {
    await this.run('Writing', async rev => {
      if (!this.state.device || !this.state.initial) throw new Error('อ่านค่าเริ่มต้นให้สำเร็จก่อนส่งชื่อ');
      const value = makePayload(name);
      // Clear previous success first: a failed retry must never look successful.
      this.patch({ sent: null, result: null });
      await this.port.write(value);
      if (rev !== this.revision) return;
      this.patch({ sent: { value, time: new Date().toISOString() } });
      this.log('WRITE', value);
    });
  }
  async readResult() {
    await this.run('Reading result', async rev => {
      if (!this.state.device || !this.state.sent) throw new Error('ส่งชื่อให้สำเร็จก่อนอ่านผล');
      const value = await this.port.read();
      if (rev !== this.revision) return;
      this.patch({ result: { value, time: new Date().toISOString() } });
      this.log('READ 02', value);
    });
  }
  destroy() { this.alive = false; ++this.revision; ++this.scanRevision; clearTimeout(this.scanTimer); this.listeners.clear(); this.port.destroy(); }
}
