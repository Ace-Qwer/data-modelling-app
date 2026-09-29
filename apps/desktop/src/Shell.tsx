import type { Model } from '@dm/core';
import type { Registry } from '@dm/metamodel';
import { useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { allActions, type ActionContext } from './actions';
import { CanvasArea } from './CanvasArea';
import { MenuBar } from './MenuBar';
import { buildMenuBar, runMenuItem } from './menu/menu-model';
import { isMacPlatform } from './shortcuts';
import { useModel } from './use-model';
import { useStore } from 'zustand';
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
  useModel(model);
  useStore(ui);

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

  const actions = useMemo(() => allActions(registry), [registry]);
  useShortcuts(actions, ctx, shortcutLog);
  const isMac = isMacPlatform();

  const panelProps = { model, registry, ui };
  return (
    <div className="shell">
      <MenuBar
        menus={buildMenuBar(ctx, { isTauri: false, isMac })}
        isMac={isMac}
        onRun={(id) => {
          runMenuItem(id, ctx);
        }}
      />
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
