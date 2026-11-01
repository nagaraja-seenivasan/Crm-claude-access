import type {ChangeKind, IncidentRecord, LifecycleTrigger, TriggerCondition} from './types';

/** Read a dotted path (`owner.team`) from a record. */
export function getPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (!path.includes('.')) return (obj as Record<string, unknown>)[path];
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export interface ChangeContext {
  change: ChangeKind;
  current: IncidentRecord;
  previous?: IncidentRecord;
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function matchesValue(actual: unknown, expected: unknown): boolean {
  return Array.isArray(expected) ? expected.some(e => same(actual, e)) : same(actual, expected);
}

export function evaluateCondition(c: TriggerCondition, ctx: ChangeContext): boolean {
  const cur = getPath(ctx.current, c.field);
  const prev = ctx.previous ? getPath(ctx.previous, c.field) : undefined;
  switch (c.op) {
    case 'eq':
      return same(cur, c.value);
    case 'ne':
      return !same(cur, c.value);
    case 'in':
      return matchesValue(cur, c.value);
    case 'nin':
      return !matchesValue(cur, c.value);
    case 'gt':
      return (cur as number) > (c.value as number);
    case 'gte':
      return (cur as number) >= (c.value as number);
    case 'lt':
      return (cur as number) < (c.value as number);
    case 'lte':
      return (cur as number) <= (c.value as number);
    case 'exists':
      return cur !== undefined && cur !== null;
    case 'missing':
      return cur === undefined || cur === null;
    case 'changed':
      return !same(cur, prev);
    case 'changed_to':
      return !same(cur, prev) && matchesValue(cur, c.value);
    case 'changed_from':
      return ctx.previous !== undefined && !same(cur, prev) && matchesValue(prev, c.value);
    default:
      return false;
  }
}

/** Whether a lifecycle trigger fires for this change. */
export function triggerMatches(t: LifecycleTrigger, ctx: ChangeContext): boolean {
  if (t.on && !t.on.includes(ctx.change)) return false;
  if (t.when && !t.when.every(c => evaluateCondition(c, ctx))) return false;
  if (t.any && t.any.length && !t.any.some(c => evaluateCondition(c, ctx))) return false;
  return true;
}
