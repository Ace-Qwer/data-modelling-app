import { Box, Boxes, FolderOpen, Package, Square, Workflow, type LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

function iconElement(id: string, Icon: LucideIcon): ReactElement {
  return <Icon className="kind-icon" size={16} aria-hidden="true" data-icon={id} />;
}

// Notations pick from this vocabulary by id, so the shell never names a notation's concepts.
// A Map rather than an object literal, so ids such as "toString" cannot hit Object.prototype.
const ICONS = new Map<string, ReactElement>([
  ['project', iconElement('project', FolderOpen)],
  ['model', iconElement('model', Boxes)],
  ['package', iconElement('package', Package)],
  ['diagram', iconElement('diagram', Workflow)],
  ['box', iconElement('box', Box)],
]);

const FALLBACK = iconElement('fallback', Square);

export function KindIcon({ icon }: { icon: string | undefined }) {
  return (icon === undefined ? undefined : ICONS.get(icon)) ?? FALLBACK;
}
