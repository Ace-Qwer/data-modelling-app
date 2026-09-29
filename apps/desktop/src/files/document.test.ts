import { describe, expect, it } from 'vitest';
import { addElement, createFixture } from '../testing/fixture';
import {
  documentName,
  documentTitle,
  freshSession,
  isDirty,
  type DocumentSession,
} from './document';

function session(filePath: string | null = null): DocumentSession {
  const { model } = createFixture();
  return { model, document: { filePath, savedRevision: model.revision } };
}

describe('document', () => {
  it('starts clean and untitled', () => {
    const fresh = freshSession(() => createFixture().model);

    expect(isDirty(fresh)).toBe(false);
    expect(documentTitle(fresh)).toBe('Untitled — Data Modelling App');
  });

  it('names the document after the file, on any platform path style', () => {
    expect(documentName(session('/home/kat/Ordering.dmproj'))).toBe('Ordering.dmproj');
    expect(documentName(session('C:\\Users\\kat\\Billing.dmproj'))).toBe('Billing.dmproj');
  });

  it('marks unsaved changes in the title and clears the mark on undo', () => {
    const s = session('/p/Ordering.dmproj');
    const modelId = s.model.children(s.model.root.id)[0]?.id ?? '';

    addElement(s.model, 'core:Package', modelId, 'Billing');
    expect(isDirty(s)).toBe(true);
    expect(documentTitle(s)).toBe('• Ordering.dmproj — Data Modelling App');

    s.model.undo();
    expect(documentTitle(s)).toBe('Ordering.dmproj — Data Modelling App');
  });
});
