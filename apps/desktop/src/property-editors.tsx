import type { PropertyDefinition, PropertyValue } from '@dm/metamodel';
import type { ReactNode } from 'react';
import { TextField } from './TextField';

export interface EditorProps {
  readonly id: string;
  readonly definition: PropertyDefinition;
  readonly value: PropertyValue;
  readonly onCommit: (value: PropertyValue) => void;
}

export type PropertyEditor = (props: EditorProps) => ReactNode;

function StringEditor({ id, value, onCommit }: EditorProps) {
  return <TextField id={id} value={String(value)} onCommit={onCommit} />;
}

function TextEditor({ id, value, onCommit }: EditorProps) {
  return <TextField id={id} value={String(value)} multiline onCommit={onCommit} />;
}

function BooleanEditor({ id, value, onCommit }: EditorProps) {
  return (
    <input
      id={id}
      type="checkbox"
      checked={value === true}
      onChange={(event) => {
        onCommit(event.target.checked);
      }}
    />
  );
}

function EnumEditor({ id, definition, value, onCommit }: EditorProps) {
  const options = definition.type === 'enum' ? definition.options : [];
  return (
    <select
      id={id}
      value={String(value)}
      onChange={(event) => {
        onCommit(event.target.value);
      }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

// Keyed by property type so a notation-specific editor can be added without touching the panel.
export const propertyEditors: ReadonlyMap<PropertyDefinition['type'], PropertyEditor> = new Map([
  ['string', StringEditor],
  ['text', TextEditor],
  ['boolean', BooleanEditor],
  ['enum', EnumEditor],
]);
