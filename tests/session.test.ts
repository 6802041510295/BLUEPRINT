import test from 'node:test';
import assert from 'node:assert/strict';
import { LabSession, BlePort, Connection, SERVICE_UUID, CHAR_UUID, makePayload } from '../src/ble/core';
class FakePort implements BlePort {
  calls: string[] = []; value = 'hello'; failWrite = false;
  lost: () => void = () => {}; pending: (() => void) | null = null;
  async scan() {} async stopScan() {}
  async connect(id: string, lost: () => void): Promise<Connection> { this.lost = lost; return { id, name: 'Teacher device', rssi: -50, mtu: 185, canWriteResponse: true }; }
  async disconnect() {} destroy() {}
  async read() { this.calls.push('read'); return this.value; }
  async write(value: string) { this.calls.push('write:' + value); if (this.failWrite) throw new Error('Write failed'); this.value = 'Your grade is B+'; }
}
test('UUIDs exactly match the assignment', () => {
  assert.equal(SERVICE_UUID, 'aee04821-1973-4e1f-a590-e84b10d580e7');
  assert.equal(CHAR_UUID, 'cde07b1a-889b-44b7-a99f-c888dddac729');
});
test('real order read → write both exact names → read unchanged device text', async () => {
  const p = new FakePort(), s = new LabSession(p);
  await s.connect('teacher'); await s.readInitial(); await s.writeNames('chayanis nusati', 'suwimol tongkam'); await s.readResult();
  assert.deepEqual(p.calls, ['read', 'write:chayanis nusati & suwimol tongkam', 'read']);
  assert.equal(s.state.initial?.value, 'hello'); assert.equal(s.state.sent?.value, 'chayanis nusati & suwimol tongkam');
  assert.equal(s.state.result?.value, 'Your grade is B+'); s.destroy();
});
test('cannot write before first read or reveal before write', async () => {
  const p = new FakePort(), s = new LabSession(p); await s.connect('teacher');
  await s.writeNames('a', 'b'); await s.readResult(); assert.equal(p.calls.length, 0); assert.ok(s.state.error); s.destroy();
});
test('failed write clears previous success and blocks reveal', async () => {
  const p = new FakePort(), s = new LabSession(p); await s.connect('teacher'); await s.readInitial(); await s.writeNames('a', 'b'); await s.readResult();
  p.failWrite = true; await s.writeNames('a', 'b'); assert.equal(s.state.sent, null); assert.equal(s.state.result, null);
  const count = p.calls.length; await s.readResult(); assert.equal(p.calls.length, count); s.destroy();
});
test('empty and non-grade responses remain exact; app invents no result', async () => {
  const p = new FakePort(), s = new LabSession(p); await s.connect('teacher'); p.value = ''; await s.readInitial();
  assert.equal(s.state.initial?.value, ''); await s.writeNames('a', 'b'); p.value = 'Processing…\nPlease wait'; await s.readResult();
  assert.equal(s.state.result?.value, p.value); s.destroy();
});
test('disconnect invalidates in-flight read and all completed steps', async () => {
  const p = new FakePort(), s = new LabSession(p); await s.connect('teacher'); await s.readInitial();
  let finish: (value: string) => void = () => {};
  p.read = () => new Promise<string>(r => { finish = r; });
  const reading = s.readInitial(); p.lost(); finish('stale data'); await reading;
  assert.equal(s.state.device, null); assert.equal(s.state.initial, null); assert.equal(s.state.busy, null); s.destroy();
});
test('overlapping operations are ignored', async () => {
  const p = new FakePort(), s = new LabSession(p); await s.connect('teacher');
  let finish: (v: string) => void = () => {}; let count = 0;
  p.read = () => { count++; return new Promise<string>(r => { finish = r; }); };
  const first = s.readInitial(); await s.readInitial(); assert.equal(count, 1); finish('ok'); await first; s.destroy();
});
test('validates names and trims only outside whitespace', () => {
  assert.throws(() => makePayload(' ', 'friend')); assert.equal(makePayload(' chayanis nusati ', 'suwimol tongkam'), 'chayanis nusati & suwimol tongkam');
});
