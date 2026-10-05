import { describe, expect, it } from 'vitest';
import { toDiscardAnswer } from './tauri-files';

describe('toDiscardAnswer', () => {
  it.each<[string, 'save' | 'discard' | 'cancel']>([
    ['Save', 'save'],
    ['Yes', 'save'],
    ["Don't Save", 'discard'],
    ['No', 'discard'],
    ['Cancel', 'cancel'],
    ['anything else', 'cancel'],
  ])('maps %j to %s', (result, answer) => {
    expect(toDiscardAnswer(result)).toBe(answer);
  });
});
