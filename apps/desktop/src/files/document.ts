import type { Model } from '@dm/core';

export interface ProjectDocument {
  readonly filePath: string | null;
  readonly savedRevision: number;
}

export interface DocumentSession {
  readonly model: Model;
  readonly document: ProjectDocument;
}

const APP_NAME = 'Data Modelling App';

export function freshSession(createModel: () => Model): DocumentSession {
  const model = createModel();
  return { model, document: { filePath: null, savedRevision: model.revision } };
}

export function isDirty(session: DocumentSession): boolean {
  return session.model.revision !== session.document.savedRevision;
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}

export function documentName(session: DocumentSession): string {
  const { filePath } = session.document;
  return filePath === null ? 'Untitled' : fileName(filePath);
}

export function documentTitle(session: DocumentSession): string {
  return `${isDirty(session) ? '• ' : ''}${documentName(session)} — ${APP_NAME}`;
}
