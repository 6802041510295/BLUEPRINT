# Validation performed

- TypeScript: `npm run typecheck` passed.
- Dependency alignment: `npx expo install --check` passed.
- 8 session tests passed: exact UUIDs, ordered read/write/read with both names, step guards, failed-write state reset, unchanged raw/empty responses, disconnect invalidation, overlap guard, and name validation.
- Web JavaScript export passed.
- Android JavaScript/Hermes export passed.
- Android native prebuild passed. Generated manifest has SCAN/CONNECT for Android 12+ and location capped at Android 11; scan flag is neverForLocation.
- Standalone preview tested in headless Chromium through scan, connect, initial read, write both names, final read, and session record. No browser page errors.
- Visual review of actual rendered preview screens completed, including Thai rendering.

## Still requires a real device

No Gradle APK build, EAS cloud build, iOS build, radio-level BLE test, or test against the instructor's peripheral was performed. Hardware permissions, negotiated MTU, firmware response timing and actual grade text must be checked in class. Preview mode uses a separate mock driver and is labelled DEMO throughout. Never use demo screenshots as submission evidence.
