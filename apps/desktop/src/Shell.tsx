import type { Model } from '@dm/core';
import type { Registry } from '@dm/metamodel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useStore } from 'zustand';
import { AboutDialog } from './AboutDialog';
import { allActions, commitPendingEdit, type ActionContext } from './actions';
import { CanvasArea } from './CanvasArea';
import { documentTitle, freshSession, type DocumentSession } from './files/document';
import {
  exit as exitFlow,
  newProject as newProjectFlow,
  open as openFlow,
  openPath,
  save as saveFlow,
  saveAs as saveAsFlow,
  type FlowDeps,
} from './files/document-flow';
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

// One flow at a time: a second one would start from the document the first is replacing, and
// its result would overwrite the first's when adopted.
function createFlowGate() {
  let running = false;
  return {
    enter: () => {
      if (running) return false;
      running = true;
      return true;
    },
    leave: () => {
      running = false;
    },
  };
}

interface Session {
  readonly doc: DocumentSession;
  readonly ui: UiStore;
}

export function Shell({ registry, createModel, platform }: ShellProps) {
  // Selection and open tabs belong to one model, so a new or opened project replaces both together.
  const [session, setSession] = useState<Session>(() => ({
    doc: freshSession(createModel),
    ui: createUiStore(),
  }));
  const [recentProjects, setRecentProjects] = useState<readonly string[]>([]);
  const [shortcutLog] = useState(createShortcutLog);
  const [contextMenuAt, setContextMenuAt] = useState<{ x: number; y: number } | null>(null);
  const { doc, ui } = session;
  const { model } = doc;
  useEffect(() => bindToModel(ui, model), [ui, model]);
  useModel(model);
  useFocusVersion();

  const deps: FlowDeps | null = useMemo(
    () =>
      platform.files && platform.recent
        ? {
            files: platform.files,
            recent: platform.recent,
            registry,
            createModel,
            appVersion: __APP_VERSION__,
          }
        : null,
    [platform, registry, createModel],
  );

  const refreshRecent = useCallback(async () => {
    if (platform.recent) setRecentProjects(await platform.recent.list());
  }, [platform]);
  useEffect(() => {
    void platform.recent?.list().then(setRecentProjects);
  }, [platform]);

  const [flowGate] = useState(createFlowGate);

  // Flows are async; adopting their result compares models so a save keeps the UI state.
  const runFlow = useCallback(
    (flow: (current: DocumentSession, flowDeps: FlowDeps) => Promise<DocumentSession>) => {
      if (!deps || !flowGate.enter()) return;
      void (async () => {
        try {
          const next = await flow(doc, deps);
          setSession((current) =>
            next.model === current.doc.model
              ? { doc: next, ui: current.ui }
              : { doc: next, ui: createUiStore() },
          );
          await refreshRecent();
        } catch (error) {
          await deps.files.showError(
            'Could not complete the action',
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          flowGate.leave();
        }
      })();
    },
    [doc, deps, refreshRecent, flowGate],
  );

  const title = documentTitle(doc);
  useEffect(() => {
    platform.setTitle(title);
  }, [platform, title]);

  const requestExit = useCallback(() => {
    commitPendingEdit();
    runFlow((current, flowDeps) => exitFlow(current, flowDeps, platform.exit));
  }, [runFlow, platform]);
  useEffect(() => platform.onCloseRequested(requestExit), [platform, requestExit]);
  const hidden = useStore(ui, (s) => s.hiddenPanels);
  useStore(ui);

  const ctx = useMemo<ActionContext>(
    () => ({
      model,
      registry,
      ui,
      canUseFiles: deps !== null,
      recentProjects,
      newProject: () => {
        if (deps) runFlow(newProjectFlow);
        else setSession({ doc: freshSession(createModel), ui: createUiStore() });
      },
      open: () => {
        runFlow(openFlow);
      },
      save: () => {
        runFlow(saveFlow);
      },
      saveAs: () => {
        runFlow(saveAsFlow);
      },
      openRecent: (path: string) => {
        runFlow((current, flowDeps) => openPath(current, path, flowDeps));
      },
      clearRecent: () => {
        void platform.recent?.clear().then(refreshRecent);
      },
      exit: () => {
        if (deps) requestExit();
        else platform.exit();
      },
      textCommand: platform.textCommand,
    }),
    [
      model,
      registry,
      ui,
      deps,
      recentProjects,
      createModel,
      platform,
      runFlow,
      requestExit,
      refreshRecent,
    ],
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
