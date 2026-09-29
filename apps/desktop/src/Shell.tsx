import type { Model } from '@dm/core';
import type { Registry } from '@dm/metamodel';
import { useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import {
  addDiagramActions,
  addElementActions,
  editActions,
  fileActions,
  type ActionContext,
} from './actions';
import { CanvasArea } from './CanvasArea';
import { MenuBar, type Menu } from './MenuBar';
import { ModelExplorer } from './ModelExplorer';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { runTextCommand } from './platform';
import { PropertiesPanel } from './PropertiesPanel';
import './shell.css';
import { bindToModel, createUiStore, type UiStore } from './ui-store';
import { useShortcuts } from './use-shortcuts';
import { createShortcutLog } from './menu/shortcut-log';

interface ShellProps {
  readonly registry: Registry;
  readonly createModel: () => Model;
}

interface Session {
  readonly model: Model;
  readonly ui: UiStore;
}

export function Shell({ registry, createModel }: ShellProps) {
  // Selection and open tabs belong to one model, so a new project replaces both together.
  const [session, setSession] = useState<Session>(() => ({
    model: createModel(),
    ui: createUiStore(),
  }));
  const [shortcutLog] = useState(createShortcutLog);
  const { model, ui } = session;
  useEffect(() => bindToModel(ui, model), [ui, model]);

  const ctx = useMemo<ActionContext>(
    () => ({
      model,
      registry,
      ui,
      newProject: () => {
        setSession({ model: createModel(), ui: createUiStore() });
      },
      exit: () => {
        window.close();
      },
      textCommand: runTextCommand,
    }),
    [model, registry, ui, createModel],
  );

  const menus = useMemo<readonly Menu[]>(
    () => [
      { label: 'File', actions: fileActions },
      { label: 'Edit', actions: editActions },
      { label: 'Add', actions: [...addElementActions(registry), ...addDiagramActions(registry)] },
    ],
    [registry],
  );
  const allActions = useMemo(() => menus.flatMap((menu) => menu.actions), [menus]);
  useShortcuts(allActions, ctx, shortcutLog);

  const panelProps = { model, registry, ui };
  return (
    <div className="shell">
      <MenuBar menus={menus} ctx={ctx} />
      <Group className="shell-body" orientation="horizontal">
        <Panel defaultSize="20%" minSize="10%">
          <PanelErrorBoundary>
            <ModelExplorer {...panelProps} />
          </PanelErrorBoundary>
        </Panel>
        <Separator className="resize-handle" />
        <Panel minSize="30%">
          <PanelErrorBoundary>
            <CanvasArea {...panelProps} />
          </PanelErrorBoundary>
        </Panel>
        <Separator className="resize-handle" />
        <Panel defaultSize="22%" minSize="12%">
          <PanelErrorBoundary>
            <PropertiesPanel {...panelProps} />
          </PanelErrorBoundary>
        </Panel>
      </Group>
    </div>
  );
}
