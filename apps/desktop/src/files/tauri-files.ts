import { message, open, save } from '@tauri-apps/plugin-dialog';
import { exists, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import type { DiscardAnswer, ProjectFiles } from './ports';

const filters = [{ name: 'Data Modelling Project', extensions: ['dmproj'] }];

// Custom button labels come back as the label on some platforms and as Yes/No on others.
export function toDiscardAnswer(result: string): DiscardAnswer {
  if (result === 'Save' || result === 'Yes') return 'save';
  if (result === "Don't Save" || result === 'No') return 'discard';
  return 'cancel';
}

export function createTauriFiles(): ProjectFiles {
  return {
    pickOpenPath: async () => {
      const picked = await open({ multiple: false, directory: false, filters });
      return typeof picked === 'string' ? picked : null;
    },
    pickSavePath: async (suggestedName) =>
      (await save({ filters, defaultPath: suggestedName })) ?? null,
    read: (path) => readTextFile(path),
    // Written beside the target first so an interrupted save never destroys the previous file.
    writeAtomically: async (path, text) => {
      const temporary = `${path}.tmp`;
      await writeTextFile(temporary, text);
      await rename(temporary, path);
    },
    exists: (path) => exists(path),
    confirmDiscard: async (name) =>
      toDiscardAnswer(
        await message(`Do you want to save the changes to ${name}?`, {
          title: 'Data Modelling App',
          kind: 'warning',
          buttons: { yes: 'Save', no: "Don't Save", cancel: 'Cancel' },
        }),
      ),
    showError: async (title, text) => {
      await message(text, { title, kind: 'error' });
    },
  };
}
