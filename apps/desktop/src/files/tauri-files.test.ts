import { exists, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTauriFiles, toDiscardAnswer } from './tauri-files';

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  writeTextFile: vi.fn(),
}));

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

describe('writeAtomically', () => {
  beforeEach(() => {
    vi.mocked(remove).mockReset().mockResolvedValue();
    vi.mocked(writeTextFile).mockReset().mockResolvedValue();
    vi.mocked(rename).mockReset().mockResolvedValue();
    vi.mocked(exists).mockReset();
    vi.mocked(readTextFile).mockReset();
  });

  it('removes whatever sits at the temporary path and creates it afresh, never writing through it', async () => {
    const order: string[] = [];
    vi.mocked(remove).mockImplementation((path) => {
      order.push(`remove ${String(path)}`);
      return Promise.resolve();
    });
    vi.mocked(writeTextFile).mockImplementation((path) => {
      order.push(`write ${String(path)}`);
      return Promise.resolve();
    });

    await createTauriFiles().writeAtomically('/p/A.dmproj', '{}');

    expect(order).toEqual(['remove /p/A.dmproj.tmp', 'write /p/A.dmproj.tmp']);
    expect(writeTextFile).toHaveBeenCalledWith('/p/A.dmproj.tmp', '{}', { createNew: true });
    expect(rename).toHaveBeenCalledWith('/p/A.dmproj.tmp', '/p/A.dmproj');
  });

  it('writes when there was no temporary file to remove', async () => {
    vi.mocked(remove).mockRejectedValue(new Error('No such file or directory'));

    await createTauriFiles().writeAtomically('/p/A.dmproj', '{}');

    expect(rename).toHaveBeenCalledWith('/p/A.dmproj.tmp', '/p/A.dmproj');
  });

  it('cleans up the temporary file when the rename fails', async () => {
    vi.mocked(rename).mockRejectedValue(new Error('Access is denied'));

    await expect(createTauriFiles().writeAtomically('/p/A.dmproj', '{}')).rejects.toThrow(
      'Access is denied',
    );
    expect(remove).toHaveBeenLastCalledWith('/p/A.dmproj.tmp');
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
