export type GroupRect = {id: string; left: number; top: number; width: number; height: number};
export type GroupDropTarget = {id: string; index: number; edge: 'before' | 'after'; axis: 'x' | 'y'};

export function reorderGroups<T extends {id: string}>(groups: T[], id: string, index: number): T[] {
  const from = groups.findIndex(group => group.id === id);
  if (from < 0 || !Number.isFinite(index)) return groups;
  const to = Math.max(0, Math.min(groups.length - 1, Math.trunc(index)));
  if (from === to) return groups;
  const next = groups.filter(group => group.id !== id);
  next.splice(to, 0, groups[from]);
  return next;
}

export function findGroupDropTarget(rects: GroupRect[], sourceId: string, x: number, y: number, layout: string): GroupDropTarget | null {
  const source = rects.find(rect => rect.id === sourceId);
  if (!source || (x >= source.left && x <= source.left + source.width && y >= source.top && y <= source.top + source.height)) return null;
  const others = rects.filter(rect => rect.id !== sourceId);
  if (!others.length) return null;
  const oneColumn = rects.every(rect => Math.abs(rect.left - rects[0].left) < 8);
  const axis = layout === 'vertical' || (layout === 'grid' && oneColumn) ? 'y' : 'x';
  const distance = (rect: GroupRect) => Math.max(rect.left - x, 0, x - rect.left - rect.width) ** 2
    + Math.max(rect.top - y, 0, y - rect.top - rect.height) ** 2;
  let target = others.reduce((nearest, rect) => distance(rect) < distance(nearest) ? rect : nearest);
  let edge: 'before' | 'after' = (axis === 'x' ? x < target.left + target.width / 2 : y < target.top + target.height / 2) ? 'before' : 'after';
  if ((axis === 'x' && layout === 'horizontal' && x > Math.max(...rects.map(rect => rect.left + rect.width)))
    || (axis === 'y' && y > Math.max(...rects.map(rect => rect.top + rect.height)))
    || (layout === 'grid' && y > Math.max(...rects.map(rect => rect.top + rect.height)))) {
    target = others[others.length - 1]; edge = 'after';
  }
  return {id: target.id, index: others.findIndex(rect => rect.id === target.id) + (edge === 'after' ? 1 : 0), edge, axis};
}

export function groupPosition(x: number, y: number, dx: number, dy: number) {
  return {x: Math.max(0, Math.round(x + dx)), y: Math.max(0, Math.round(y + dy))};
}
