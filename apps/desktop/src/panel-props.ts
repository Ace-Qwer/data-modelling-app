import type { Model } from '@dm/core';
import type { Registry } from '@dm/metamodel';
import type { UiStore } from './ui-store';

export interface PanelProps {
  readonly model: Model;
  readonly registry: Registry;
  readonly ui: UiStore;
}
