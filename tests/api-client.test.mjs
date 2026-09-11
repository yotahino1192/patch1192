import assert from 'node:assert/strict';
import test from 'node:test';
import { apiFetch, configureApi } from '../lib/api-client.ts';

test('web API requests remain same-origin and preserve request options', async () => {
  const original = globalThis.fetch;
  const options = { method: 'POST', body: '{"action":"reviewCard"}' };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/data');
    assert.equal(init, options);
    return new Response('{}');
  };
  try { await apiFetch('/api/data', options); } finally { globalThis.fetch = original; }
});

test('mobile API transport preserves queries, payloads and error responses', async () => {
  const body = JSON.stringify({ operationId: 'same-operation', expectedReviewCount: 2 });
  configureApi('https://backend.example/', async (url, options) => {
    assert.equal(url, 'https://backend.example/api/data?sessionId=abc');
    assert.equal(options.body, body);
    return new Response('{"error":"conflict"}', { status: 409 });
  });
  const response = await apiFetch('/api/data?sessionId=abc', { method: 'POST', body });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'conflict' });
});

test('API configuration rejects credentials and non-origin URLs', () => {
  for (const url of ['file:///tmp/data', 'https://user:secret@example.com', 'https://example.com/api', 'https://example.com?key=secret', 'https://example.com#fragment']) {
    assert.throws(() => configureApi(url, fetch));
  }
});

test('API transport rejects external and traversal paths', () => {
  for (const path of ['https://other.example/api/data', '//other.example/api/data', '/api/../private', '/api/\\other']) {
    assert.throws(() => apiFetch(path));
  }
});
