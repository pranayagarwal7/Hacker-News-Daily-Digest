import '@testing-library/jest-dom';

// scrollIntoView is not implemented in jsdom — only polyfill when window exists
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
}

// ReadableStream and TextEncoder/TextDecoder are available in Node 18+ but
// jsdom doesn't always expose them on globalThis.
if (typeof globalThis.ReadableStream === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ReadableStream } = require('stream/web');
  globalThis.ReadableStream = ReadableStream;
}
if (typeof globalThis.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextEncoder, TextDecoder } = require('util');
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}
