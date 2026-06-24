import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Tauri APIs. The app imports through `@/lib/transport`, which delegates to
// these when running under Tauri — so we mark the test env as "Tauri" (below)
// to keep these mocks in effect instead of hitting fetch/WebSocket.
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(() => Promise.resolve('test')),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve(null)),
}));

// Make `@/lib/transport` take the Tauri path so the mocks above are used.
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: { invoke: vi.fn() },
  writable: true,
  configurable: true,
});

// Legacy global some code may probe.
Object.defineProperty(window, '__TAURI__', {
  value: { invoke: vi.fn() },
  writable: true,
  configurable: true,
});
