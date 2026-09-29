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

// jsdom lays nothing out, so every box is 0×0 at the origin — exactly where user-event
// clicks. react-resizable-panels would then treat every click as grabbing a resize handle
// and steal focus. Parking empty boxes far away keeps its hit-testing out of the way.
const measure = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect')
  ?.value as (this: Element) => DOMRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  const rect = measure.call(this);
  return rect.width === 0 && rect.height === 0 ? new DOMRect(-10_000, -10_000, 0, 0) : rect;
};
