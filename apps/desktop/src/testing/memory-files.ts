import type { DiscardAnswer, ProjectFiles, RecentProjects } from '../files/ports';
import { pushRecent, withoutRecent } from '../files/recent-list';

export function createMemoryFiles(initial: Readonly<Record<string, string>> = {}) {
  const disk = new Map(Object.entries(initial));
  const answers = {
    open: [] as (string | null)[],
    save: [] as (string | null)[],
    discard: [] as DiscardAnswer[],
  };
  const errors: { title: string; message: string }[] = [];
  const prompts: string[] = [];
  const suggestions: string[] = [];
  const state = { failWrites: false };
  const files: ProjectFiles = {
    pickOpenPath: () => Promise.resolve(answers.open.shift() ?? null),
    pickSavePath: (suggestedName) => {
      suggestions.push(suggestedName);
      return Promise.resolve(answers.save.shift() ?? null);
    },
    read: (path) => {
      const text = disk.get(path);
      return text === undefined
        ? Promise.reject(new Error(`No such file: ${path}`))
        : Promise.resolve(text);
    },
    writeAtomically: (path, text) => {
      if (state.failWrites) return Promise.reject(new Error('The disk is full.'));
      disk.set(path, text);
      return Promise.resolve();
    },
    exists: (path) => Promise.resolve(disk.has(path)),
    confirmDiscard: (name) => {
      prompts.push(name);
      return Promise.resolve(answers.discard.shift() ?? 'cancel');
    },
    showError: (title, message) => {
      errors.push({ title, message });
      return Promise.resolve();
    },
  };
  return { files, disk, answers, errors, prompts, suggestions, state };
}

export function createMemoryRecent(initial: readonly string[] = []): RecentProjects {
  let list: readonly string[] = [...initial];
  return {
    list: () => Promise.resolve(list),
    add: (path) => {
      list = pushRecent(list, path);
      return Promise.resolve(list);
    },
    remove: (path) => {
      list = withoutRecent(list, path);
      return Promise.resolve(list);
    },
    clear: () => {
      list = [];
      return Promise.resolve();
    },
  };
}
