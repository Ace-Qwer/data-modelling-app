import type { PropertyValue } from '@dm/metamodel';
import { useStore } from 'zustand';
import type { PanelProps } from './panel-props';
import { propertyEditors } from './property-editors';
import { TextField } from './TextField';
import { useModel } from './use-model';

export function PropertiesPanel({ model, registry, ui }: PanelProps) {
  useModel(model);
  const selectedId = useStore(ui, (s) => s.selectedId);
  const element = selectedId === null ? undefined : model.getElement(selectedId);
  const kind = element ? registry.kind(element.kind) : undefined;

  if (!element || !kind) {
    return (
      <div className="panel properties-panel">
        <h2 className="panel-title">Properties</h2>
        <p className="panel-empty">Nothing selected</p>
      </div>
    );
  }

  // Reads the model at commit time: a blur can fire after Enter already committed the same value.
  const setName = (name: string) => {
    if (model.getElement(element.id)?.name === name) return;
    model.execute({ type: 'SetName', id: element.id, name });
  };
  const setProperty = (key: string, value: PropertyValue) => {
    if (model.getElement(element.id)?.properties[key] === value) return;
    model.execute({ type: 'SetProperty', id: element.id, key, value });
  };

  return (
    <div className="panel properties-panel">
      <h2 className="panel-title">Properties</h2>
      <p className="property-kind">{kind.label}</p>
      <div className="property-list">
        <label htmlFor="prop-name">Name</label>
        <TextField
          key={`${element.id}:name`}
          id="prop-name"
          value={element.name}
          required
          onCommit={setName}
        />
        {kind.properties.map((definition) => {
          const Editor = propertyEditors.get(definition.type);
          const value = element.properties[definition.key] ?? definition.default;
          const id = `prop-${definition.key}`;
          if (!Editor) return null;
          return [
            <label key={`${id}-label`} htmlFor={id}>
              {definition.label}
            </label>,
            <Editor
              key={`${element.id}:${definition.key}`}
              id={id}
              definition={definition}
              value={value}
              onCommit={(next) => {
                setProperty(definition.key, next);
              }}
            />,
          ];
        })}
      </div>
    </div>
  );
}
