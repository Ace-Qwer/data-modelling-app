import { Model } from '@dm/core';
import { serializeProject } from '@dm/io';
import { Registry } from '@dm/metamodel';
import { umlNotation } from '@dm/notation-uml';
import { describe, expect, it, vi } from 'vitest';
import { addElement } from '../testing/fixture';
import { createMemoryFiles, createMemoryRecent } from '../testing/memory-files';
import { isDirty, type DocumentSession } from './document';
import { exit, guardUnsaved, newProject, open, openPath, save, saveAs } from './document-flow';

const registry = Registry.create([umlNotation]);

function setup(disk: Readonly<Record<string, string>> = {}, recentPaths: readonly string[] = []) {
  const memory = createMemoryFiles(disk);
  const recent = createMemoryRecent(recentPaths);
  const deps = {
    files: memory.files,
    recent,
    registry,
    createModel: () => new Model(registry),
    appVersion: '0.1.0',
  };
  const model = new Model(registry);
  const session: DocumentSession = {
    model,
    document: { filePath: null, savedRevision: model.revision },
  };
  const modelId = model.children(model.root.id)[0]?.id ?? '';
  const edit = (name = 'Billing') => addElement(model, 'core:Package', modelId, name);
  return { memory, recent, deps, session, model, edit };
}

function projectText(className: string): string {
  const other = new Model(registry);
  const modelId = other.children(other.root.id)[0]?.id ?? '';
  addElement(other, 'uml:Class', modelId, className);
  return serializeProject(other, '0.1.0');
}

describe('save and save as', () => {
  it('asks where to save a new project, adds the extension and becomes clean', async () => {
    const { memory, deps, session, edit, recent } = setup();
    edit();
    memory.answers.save.push('/p/Ordering');

    const saved = await save(session, deps);

    expect(memory.suggestions).toEqual(['Untitled.dmproj']);
    expect(saved.document.filePath).toBe('/p/Ordering.dmproj');
    expect(memory.disk.get('/p/Ordering.dmproj')).toContain('"format": "dmproj"');
    expect(isDirty(saved)).toBe(false);
    expect(await recent.list()).toEqual(['/p/Ordering.dmproj']);
  });

  it('saves a known file without asking', async () => {
    const { memory, deps, session, edit } = setup();
    memory.answers.save.push('/p/Ordering.dmproj');
    const first = await save(session, deps);
    edit('Later');

    const second = await save(first, deps);

    expect(memory.suggestions).toHaveLength(1);
    expect(memory.disk.get('/p/Ordering.dmproj')).toContain('Later');
    expect(isDirty(second)).toBe(false);
  });

  it('save as always asks and suggests the current name', async () => {
    const { memory, deps, session } = setup();
    memory.answers.save.push('/p/Ordering.dmproj', '/p/Copy.dmproj');
    const first = await save(session, deps);

    const copy = await saveAs(first, deps);

    expect(memory.suggestions).toEqual(['Untitled.dmproj', 'Ordering.dmproj']);
    expect(copy.document.filePath).toBe('/p/Copy.dmproj');
  });

  it('changes nothing when the save dialog is cancelled', async () => {
    const { deps, session, edit } = setup();
    edit();

    const result = await save(session, deps);

    expect(result).toBe(session);
    expect(isDirty(result)).toBe(true);
  });

  it('keeps the document dirty, reports the error and leaves recents alone when writing fails', async () => {
    const { memory, deps, session, edit, recent } = setup();
    edit();
    memory.state.failWrites = true;
    memory.answers.save.push('/p/Ordering.dmproj');

    const result = await save(session, deps);

    expect(isDirty(result)).toBe(true);
    expect(memory.errors).toEqual([
      { title: 'Could not save project', message: 'The disk is full.' },
    ]);
    expect(await recent.list()).toEqual([]);
  });
});

describe('saving while the model changes or the recent list fails', () => {
  it('stays dirty for an edit made while the file was being written', async () => {
    const { memory, deps, session, edit } = setup();
    memory.answers.save.push('/p/Ordering.dmproj');
    const write = memory.files.writeAtomically;
    const files = {
      ...memory.files,
      writeAtomically: async (path: string, text: string) => {
        edit('Typed during the save');
        await write(path, text);
      },
    };

    const saved = await save(session, { ...deps, files });

    expect(isDirty(saved)).toBe(true);
  });

  it('is saved even when remembering it as recent fails', async () => {
    const { memory, deps, session, edit } = setup();
    edit();
    memory.answers.save.push('/p/Ordering.dmproj');
    const recent = { ...deps.recent, add: () => Promise.reject(new Error('Store is locked')) };

    const saved = await save(session, { ...deps, recent });

    expect(saved.document.filePath).toBe('/p/Ordering.dmproj');
    expect(isDirty(saved)).toBe(false);
  });
});

describe('guarding unsaved changes', () => {
  it('proceeds without asking when there is nothing to lose', async () => {
    const { memory, deps, session } = setup();

    expect((await guardUnsaved(session, deps)).outcome).toBe('proceed');
    expect(memory.prompts).toEqual([]);
  });

  it.each<['discard' | 'cancel', 'proceed' | 'cancel']>([
    ['discard', 'proceed'],
    ['cancel', 'cancel'],
  ])('answering %s leads to %s', async (answer, outcome) => {
    const { memory, deps, session, edit } = setup();
    edit();
    memory.answers.discard.push(answer);

    expect((await guardUnsaved(session, deps)).outcome).toBe(outcome);
    expect(memory.prompts).toEqual(['Untitled']);
  });

  it('saves first when the answer is Save', async () => {
    const { memory, deps, session, edit } = setup();
    edit();
    memory.answers.discard.push('save');
    memory.answers.save.push('/p/Ordering.dmproj');

    const guard = await guardUnsaved(session, deps);

    expect(guard.outcome).toBe('proceed');
    expect(isDirty(guard.session)).toBe(false);
    expect(memory.disk.has('/p/Ordering.dmproj')).toBe(true);
  });

  it('cancels when Save was chosen but the save dialog was cancelled', async () => {
    const { memory, deps, session, edit } = setup();
    edit();
    memory.answers.discard.push('save');

    const guard = await guardUnsaved(session, deps);

    expect(guard.outcome).toBe('cancel');
    expect(guard.session).toBe(session);
  });
});

describe('new, open and exit', () => {
  it('starts a new clean project after the unsaved-changes guard', async () => {
    const { memory, deps, session, edit } = setup();
    edit();
    memory.answers.discard.push('discard');

    const next = await newProject(session, deps);

    expect(next.model).not.toBe(session.model);
    expect(next.document.filePath).toBeNull();
  });

  it('opens a project file, recording it as recent', async () => {
    const { memory, deps, session, recent } = setup({ '/p/Shop.dmproj': projectText('Invoice') });
    memory.answers.open.push('/p/Shop.dmproj');

    const opened = await open(session, deps);

    expect(opened.document.filePath).toBe('/p/Shop.dmproj');
    expect(opened.model.elements().some((e) => e.name === 'Invoice')).toBe(true);
    expect(isDirty(opened)).toBe(false);
    expect(await recent.list()).toEqual(['/p/Shop.dmproj']);
  });

  it('keeps the current work when the opened file is damaged', async () => {
    const { memory, deps, session, edit } = setup({ '/p/Broken.dmproj': '{ nope' });
    edit();
    memory.answers.discard.push('discard');

    const result = await openPath(session, '/p/Broken.dmproj', deps);

    expect(result).toBe(session);
    expect(isDirty(result)).toBe(true);
    expect(memory.errors).toEqual([
      { title: 'Could not open project', message: 'This file is not a Data Modelling project.' },
    ]);
  });

  it('reports a missing recent file without asking to save, and forgets it', async () => {
    const { memory, deps, session, edit, recent } = setup({}, ['/p/Gone.dmproj']);
    edit();

    const result = await openPath(session, '/p/Gone.dmproj', deps);

    expect(result).toBe(session);
    expect(memory.prompts).toEqual([]);
    expect(memory.errors).toEqual([
      { title: 'Could not open project', message: 'File not found: /p/Gone.dmproj' },
    ]);
    expect(await recent.list()).toEqual([]);
  });

  it('changes nothing when the open dialog is cancelled', async () => {
    const { deps, session } = setup();

    expect(await open(session, deps)).toBe(session);
  });

  it('quits only after the guard allows it', async () => {
    const { memory, deps, session, edit } = setup();
    edit();
    const quit = vi.fn<() => void>();

    memory.answers.discard.push('cancel');
    await exit(session, deps, quit);
    expect(quit).not.toHaveBeenCalled();

    memory.answers.discard.push('discard');
    await exit(session, deps, quit);
    expect(quit).toHaveBeenCalledOnce();
  });
});
