import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { nativeHttpTimeouts } from '../mobile/http-timeouts.ts';

test('iOS native timeout survives first-byte waits past 15s but stays below the outer AI deadline', () => {
  const source = readFileSync(new URL('../node_modules/@capacitor/ios/Capacitor/Capacitor/Plugins/HttpRequestHandler.swift', import.meta.url), 'utf8');
  // Guard the installed bridge behavior that caused the real-device failure.
  assert.match(source, /connectTimeout \?\? readTimeout/);
  const { connectTimeout, readTimeout } = nativeHttpTimeouts('ios', 'http://192.0.2.1:3001/api/ai/cards', 'POST');
  const nativeDeadline = connectTimeout ?? readTimeout;
  assert.ok(nativeDeadline > 45000 && nativeDeadline < 75000);
  assert.ok(23893 < nativeDeadline, 'observed provider response survives the native idle deadline');
  assert.equal(nativeHttpTimeouts('ios', 'http://192.0.2.1:3001/api/ai/chat', 'post').connectTimeout, 65000);
  assert.equal(nativeHttpTimeouts('android', 'https://api.example/api/ai/cards', 'POST').connectTimeout, 15000);
  for (const [path, method] of [['/api/data', 'POST'], ['/api/ai/cancel', 'POST'], ['/api/ai/cards', 'GET']]) {
    assert.equal(nativeHttpTimeouts('ios', 'http://192.0.2.1:3001' + path, method).connectTimeout, 15000);
  }
});
