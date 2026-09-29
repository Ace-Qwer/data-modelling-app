import { describe, expect, it } from 'vitest';
import { pushRecent, withoutRecent } from './recent-list';

describe('recent list', () => {
  it('puts the newest path first without duplicates', () => {
    expect(pushRecent(['/a', '/b', '/c'], '/b')).toEqual(['/b', '/a', '/c']);
  });

  it('keeps at most ten entries', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `/p${String(i)}`);

    const list = eleven.reduce<readonly string[]>((acc, path) => pushRecent(acc, path), []);

    expect(list).toHaveLength(10);
    expect(list[0]).toBe('/p10');
    expect(list).not.toContain('/p0');
  });

  it('removes a path', () => {
    expect(withoutRecent(['/a', '/b'], '/a')).toEqual(['/b']);
  });
});
