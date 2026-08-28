import test from 'node:test';
import assert from 'node:assert/strict';
import { isLoopbackUrl, parseArgs, validateTarget } from '../src/index.js';

test('accepts loopback targets', () => {
  assert.equal(isLoopbackUrl('http://127.0.0.1:3000'), true);
  assert.equal(isLoopbackUrl('http://localhost:3000'), true);
  assert.equal(isLoopbackUrl('http://[::1]:3000'), true);
});

test('rejects remote targets without explicit override', () => {
  assert.throws(() => validateTarget('https://example.com'), /Refusing non-loopback/);
  assert.equal(validateTarget('https://example.com', true).hostname, 'example.com');
});

test('parses the base URL and scanner options', () => {
  const options = parseArgs(['http://localhost:3000', '--allow-remote', '--delay', '500', '--output-dir', 'out']);
  assert.deepEqual(options, {
    baseUrl: 'http://localhost:3000',
    allowRemote: true,
    delay: 500,
    outputDir: 'out'
  });
});
