import type { Model } from '@dm/core';
import { useSyncExternalStore } from 'react';

export function useModel(model: Model): number {
  return useSyncExternalStore(model.subscribe, () => model.version);
}
