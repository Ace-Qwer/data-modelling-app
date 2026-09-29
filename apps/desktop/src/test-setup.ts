import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

class ResizeObserverStub {
  observe(): void {
    // jsdom performs no layout, so there is never a size change to report.
  }
  unobserve(): void {
    // Nothing is observed; see observe().
  }
  disconnect(): void {
    // Nothing is observed; see observe().
  }
}

if (!('ResizeObserver' in window)) {
  Object.defineProperty(window, 'ResizeObserver', { value: ResizeObserverStub, writable: true });
}
