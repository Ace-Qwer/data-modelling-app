import { useState, type KeyboardEvent } from 'react';

interface TextFieldProps {
  readonly id: string;
  readonly value: string;
  readonly multiline?: boolean;
  readonly required?: boolean;
  readonly onCommit: (value: string) => void;
}

export function TextField({
  id,
  value,
  multiline = false,
  required = false,
  onCommit,
}: TextFieldProps) {
  const [draft, setDraft] = useState(value);

  const commit = () => {
    if (draft === value) return;
    if (required && draft.trim() === '') {
      setDraft(value);
      return;
    }
    onCommit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') setDraft(value);
    else if (event.key === 'Enter' && !multiline) commit();
  };

  const shared = {
    id,
    value: draft,
    onBlur: commit,
    onKeyDown,
    onChange: (event: { target: { value: string } }) => {
      setDraft(event.target.value);
    },
  };
  return multiline ? <textarea rows={4} {...shared} /> : <input type="text" {...shared} />;
}
