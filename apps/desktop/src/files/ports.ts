export type DiscardAnswer = 'save' | 'discard' | 'cancel';

export interface ProjectFiles {
  readonly pickOpenPath: () => Promise<string | null>;
  readonly pickSavePath: (suggestedName: string) => Promise<string | null>;
  readonly read: (path: string) => Promise<string>;
  readonly writeAtomically: (path: string, text: string) => Promise<void>;
  readonly exists: (path: string) => Promise<boolean>;
  readonly confirmDiscard: (documentName: string) => Promise<DiscardAnswer>;
  readonly showError: (title: string, message: string) => Promise<void>;
}

export interface RecentProjects {
  readonly list: () => Promise<readonly string[]>;
  readonly add: (path: string) => Promise<readonly string[]>;
  readonly remove: (path: string) => Promise<readonly string[]>;
  readonly clear: () => Promise<void>;
}
