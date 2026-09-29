import { describe, expect, it } from 'vitest';
import { formatShortcut, isTextEntryTarget, matchesShortcut, type KeyInput } from './shortcuts';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('matchesShortcut', () => {
  it.each<[string, KeyInput, string, boolean, boolean]>([
    ['Ctrl+Z off Mac', key('z', { ctrlKey: true }), 'Mod+Z', false, true],
    ['Cmd+Z on Mac', key('z', { metaKey: true }), 'Mod+Z', true, true],
    ['Ctrl+Z on Mac', key('z', { ctrlKey: true }), 'Mod+Z', true, false],
    ['plain Z', key('z'), 'Mod+Z', false, false],
    ['Ctrl+Shift+Z for Mod+Z', key('Z', { ctrlKey: true, shiftKey: true }), 'Mod+Z', false, false],
    [
      'Ctrl+Shift+Z for Mod+Shift+Z',
      key('Z', { ctrlKey: true, shiftKey: true }),
      'Mod+Shift+Z',
      false,
      true,
    ],
    ['Ctrl+Y for Mod+Y', key('y', { ctrlKey: true }), 'Mod+Y', false, true],
    ['Delete', key('Delete'), 'Delete', false, true],
    ['Ctrl+Delete for Delete', key('Delete', { ctrlKey: true }), 'Delete', false, false],
    ['Alt+Z for Mod+Z', key('z', { ctrlKey: true, altKey: true }), 'Mod+Z', false, false],
  ])('%s', (_, event, shortcut, isMac, expected) => {
    expect(matchesShortcut(event, shortcut, isMac)).toBe(expected);
  });
});

describe('formatShortcut', () => {
  it('spells Mod as Ctrl off Mac and as ⌘ on Mac', () => {
    expect(formatShortcut('Mod+Shift+Z', false)).toBe('Ctrl+Shift+Z');
    expect(formatShortcut('Mod+Z', true)).toBe('⌘+Z');
  });
});

describe('isTextEntryTarget', () => {
  it.each([
    ['an input', document.createElement('input'), true],
    ['a textarea', document.createElement('textarea'), true],
    ['a select', document.createElement('select'), true],
    ['a button', document.createElement('button'), false],
  ])('treats %s correctly', (_, element, expected) => {
    expect(isTextEntryTarget(element)).toBe(expected);
  });

  it('is true inside a contenteditable region', () => {
    const region = document.createElement('div');
    region.setAttribute('contenteditable', 'true');
    const span = document.createElement('span');
    region.append(span);

    expect(isTextEntryTarget(span)).toBe(true);
  });

  it('is false when there is no target', () => {
    expect(isTextEntryTarget(null)).toBe(false);
  });
});
