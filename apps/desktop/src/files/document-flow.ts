import type { Model } from '@dm/core';
import { loadProject, serializeProject } from '@dm/io';
import type { Registry } from '@dm/metamodel';
import { documentName, freshSession, isDirty, type DocumentSession } from './document';
import type { ProjectFiles, RecentProjects } from './ports';

export interface FlowDeps {
  readonly files: ProjectFiles;
  readonly recent: RecentProjects;
  readonly registry: Registry;
  readonly createModel: () => Model;
  readonly appVersion: string;
}

export interface Guard {
  readonly outcome: 'proceed' | 'cancel';
  readonly session: DocumentSession;
}

const EXTENSION = '.dmproj';

function withExtension(path: string): string {
  return path.toLowerCase().endsWith(EXTENSION) ? path : `${path}${EXTENSION}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeTo(
  session: DocumentSession,
  path: string,
  deps: FlowDeps,
): Promise<DocumentSession> {
  try {
    await deps.files.writeAtomically(path, serializeProject(session.model, deps.appVersion));
  } catch (error) {
    await deps.files.showError('Could not save project', messageOf(error));
    return session;
  }
  await deps.recent.add(path);
  return {
    model: session.model,
    document: { filePath: path, savedRevision: session.model.revision },
  };
}

export async function saveAs(session: DocumentSession, deps: FlowDeps): Promise<DocumentSession> {
  const suggested = documentName(session).replace(/\.dmproj$/i, '');
  const picked = await deps.files.pickSavePath(`${suggested}${EXTENSION}`);
  if (picked === null) return session;
  return writeTo(session, withExtension(picked), deps);
}

export async function save(session: DocumentSession, deps: FlowDeps): Promise<DocumentSession> {
  const { filePath } = session.document;
  return filePath === null ? saveAs(session, deps) : writeTo(session, filePath, deps);
}

export async function guardUnsaved(session: DocumentSession, deps: FlowDeps): Promise<Guard> {
  if (!isDirty(session)) return { outcome: 'proceed', session };
  const answer = await deps.files.confirmDiscard(documentName(session));
  if (answer === 'discard') return { outcome: 'proceed', session };
  if (answer === 'cancel') return { outcome: 'cancel', session };
  const saved = await save(session, deps);
  // A cancelled or failed save leaves the session dirty, which must stop whatever asked.
  return { outcome: isDirty(saved) ? 'cancel' : 'proceed', session: saved };
}

export async function newProject(
  session: DocumentSession,
  deps: FlowDeps,
): Promise<DocumentSession> {
  const guard = await guardUnsaved(session, deps);
  return guard.outcome === 'cancel' ? guard.session : freshSession(deps.createModel);
}

export async function openPath(
  session: DocumentSession,
  path: string,
  deps: FlowDeps,
): Promise<DocumentSession> {
  // Checked first so the user is not asked to save for an open that cannot happen.
  if (!(await deps.files.exists(path))) {
    await deps.recent.remove(path);
    await deps.files.showError('Could not open project', `File not found: ${path}`);
    return session;
  }
  const guard = await guardUnsaved(session, deps);
  if (guard.outcome === 'cancel') return guard.session;
  try {
    const model = loadProject(await deps.files.read(path), deps.registry);
    await deps.recent.add(path);
    return { model, document: { filePath: path, savedRevision: model.revision } };
  } catch (error) {
    await deps.files.showError('Could not open project', messageOf(error));
    return guard.session;
  }
}

export async function open(session: DocumentSession, deps: FlowDeps): Promise<DocumentSession> {
  const path = await deps.files.pickOpenPath();
  return path === null ? session : openPath(session, path, deps);
}

export async function exit(
  session: DocumentSession,
  deps: FlowDeps,
  quit: () => void,
): Promise<DocumentSession> {
  const guard = await guardUnsaved(session, deps);
  if (guard.outcome === 'proceed') quit();
  return guard.session;
}
