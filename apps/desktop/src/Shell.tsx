import type { Model } from '@dm/core';
import type { Registry } from '@dm/metamodel';
import { useMemo, useEffect, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useStore } from 'zustand';
import { AboutDialog } from './AboutDialog';
import { allActions, type ActionContext } from './actions';
import { CanvasArea } from './CanvasArea';
import { ContextMenu } from './menu/ContextMenu';
import { buildMenuBar, buildTreeContextMenu, runMenuItem } from './menu/menu-model';
import { showNativeContextMenu, useNativeMenu } from './menu/native-menu';
import { createShortcutLog } from './menu/shortcut-log';
import { MenuBar } from './MenuBar';
import { ModelExplorer } from './ModelExplorer';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import type { Platform } from './platform';
import { handleNativeActivation } from './menu/shortcut-routing';
import { PropertiesPanel } from './PropertiesPanel';
import './shell.css';
import { Toolbox } from './Toolbox';
import { bindToModel, createUiStore, type UiStore } from './ui-store';
import { useFocusVersion } from './use-focus-version';
import { useModel } from './use-model';
import { useShortcuts } from './use-shortcuts';

interface ShellProps {
  readonly registry: Registry;
  readonly createModel: () => Model;
  readonly platform: Platform;
}

interface Session {
  readonly model: Model;
  readonly ui: UiStore;
}

export function Shell({ registry, createModel, platform }: ShellProps) {
  // Selection and open tabs belong to one model, so a new project replaces both together.
  const [session, setSession] = useState<Session>(() => ({
    model: createModel(),
    ui: createUiStore(),
  }));
  const [shortcutLog] = useState(createShortcutLog);
  const [contextMenuAt, setContextMenuAt] = useState<{ x: number; y: number } | null>(null);
  const { model, ui } = session;
  useEffect(() => bindToModel(ui, model), [ui, model]);
  useModel(model);
  useFocusVersion();
  const hidden = useStore(ui, (s) => s.hiddenPanels);
  useStore(ui);

  const ctx = useMemo<ActionContext>(
    () => ({
      model,
      registry,
      ui,
      newProject: () => {
        setSession({ model: createModel(), ui: createUiStore() });
      },
      exit: platform.exit,
      textCommand: platform.textCommand,
      canUseFiles: false,
      recentProjects: [],
      open: () => undefined,
      save: () => undefined,
      saveAs: () => undefined,
      openRecent: () => undefined,
      clearRecent: () => undefined,
    }),
    [model, registry, ui, createModel, platform],
  );
  const actions = useMemo(() => allActions(registry), [registry]);
  useShortcuts(actions, ctx, shortcutLog);

  const run = (id: string) => {
    runMenuItem(id, ctx);
  };
  const menus = buildMenuBar(ctx, platform);
  const nativeMenu = useNativeMenu(menus, platform, (id) => {
    handleNativeActivation(id, shortcutLog, run);
  });

  const openContextMenu = (at: { x: number; y: number }) => {
    if (nativeMenu !== 'active') {
      setContextMenuAt(at);
      return;
    }
    showNativeContextMenu(buildTreeContextMenu(ctx), run).catch((error: unknown) => {
      console.error('Native context menu unavailable', error);
      setContextMenuAt(at);
    });
  };

  const panelProps = { model, registry, ui };
  const showExplorer = !hidden.has('explorer');
  const showProperties = !hidden.has('properties');
  return (
    <div className="shell">
      {(nativeMenu === 'off' || nativeMenu === 'failed') && (
        <MenuBar menus={menus} isMac={platform.isMac} onRun={run} />
      )}
      <Group className="shell-body" orientation="horizontal">
        {!hidden.has('toolbox') && (
          <>
            <Panel id="toolbox" defaultSize="15%" minSize="8%">
              <PanelErrorBoundary>
                <Toolbox {...panelProps} />
              </PanelErrorBoundary>
            </Panel>
            <Separator className="resize-handle" />
          </>
        )}
        <Panel id="canvas" minSize="30%">
          <PanelErrorBoundary>
            <CanvasArea {...panelProps} />
          </PanelErrorBoundary>
        </Panel>
        {(showExplorer || showProperties) && (
          <>
            <Separator className="resize-handle" />
            <Panel id="right" defaultSize="25%" minSize="12%">
              <Group orientation="vertical">
                {showExplorer && (
                  <Panel id="explorer" minSize="15%">
                    <PanelErrorBoundary>
                      <ModelExplorer {...panelProps} onContextMenu={openContextMenu} />
                    </PanelErrorBoundary>
                  </Panel>
                )}
                {showExplorer && showProperties && (
                  <Separator className="resize-handle resize-handle-horizontal" />
                )}
                {showProperties && (
                  <Panel id="properties" minSize="15%">
                    <PanelErrorBoundary>
                      <PropertiesPanel {...panelProps} />
                    </PanelErrorBoundary>
                  </Panel>
                )}
              </Group>
            </Panel>
          </>
        )}
      </Group>
      {contextMenuAt && (
        <ContextMenu
          nodes={buildTreeContextMenu(ctx)}
          at={contextMenuAt}
          isMac={platform.isMac}
          onRun={run}
          onClose={() => {
            setContextMenuAt(null);
          }}
        />
      )}
      <AboutDialog ui={ui} />
    </div>
  );
}
