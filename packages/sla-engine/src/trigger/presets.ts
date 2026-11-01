import type {LifecycleTrigger, SlaTriggerConfig, TimeTrigger} from './types';

export interface IncidentPresetOptions {
  policyId: string;
  /** Incident field holding the status. @default 'status' */
  statusField?: string;
  /** Statuses that hold the clock, e.g. waiting on the customer. */
  pauseStatuses?: string[];
  /** Statuses that complete the SLA. @default ['resolved', 'closed'] */
  stopStatuses?: string[];
  /** Statuses that cancel the SLA. @default ['cancelled'] */
  cancelStatuses?: string[];
  /** Fields whose change re-resolves the target. @default ['priority'] */
  retargetOn?: string[];
  /** Reopening resumes the same clock (`reopen`) or starts over (`restart`). @default 'reopen' */
  onReopen?: 'reopen' | 'restart';
  /** Time triggers. @default warning at 75 %, breach at 100 % */
  timers?: TimeTrigger[];
  /** Incident fields copied to dimensions. @default ['priority'] */
  dimensions?: SlaTriggerConfig['dimensions'];
}

/**
 * A ready-made trigger set for a typical incident lifecycle:
 * start on create → pause/resume on waiting statuses → retarget on priority
 * change → stop on resolve/close → reopen (or restart) → cancel.
 */
export function incidentTriggerPreset(o: IncidentPresetOptions): SlaTriggerConfig {
  const f = o.statusField ?? 'status';
  const pause = o.pauseStatuses ?? [];
  const stop = o.stopStatuses ?? ['resolved', 'closed'];
  const cancel = o.cancelStatuses ?? ['cancelled'];
  const triggers: LifecycleTrigger[] = [
    {action: 'start', on: ['create'], when: [{field: f, op: 'nin', value: [...stop, ...cancel]}]},
    {action: o.onReopen ?? 'reopen', on: ['update'], when: [
      {field: f, op: 'changed_from', value: stop},
      {field: f, op: 'nin', value: [...stop, ...cancel]},
    ], reason: 'reopened'},
  ];
  if (pause.length) {
    triggers.push(
      {action: 'resume', on: ['update'], when: [{field: f, op: 'changed_from', value: pause}, {field: f, op: 'nin', value: pause}]},
      {action: 'pause', when: [{field: f, op: 'in', value: pause}], reason: 'status'},
    );
  }
  for (const field of o.retargetOn ?? ['priority']) {
    triggers.push({action: 'retarget', on: ['update'], when: [{field, op: 'changed'}]});
  }
  triggers.push(
    {action: 'stop', when: [{field: f, op: 'in', value: stop}]},
    {action: 'cancel', when: [{field: f, op: 'in', value: cancel}]},
  );
  return {
    policyId: o.policyId,
    triggers,
    timers: o.timers ?? [
      {kind: 'warning', atRatio: 0.75},
      {kind: 'breach', atRatio: 1},
    ],
    dimensions: o.dimensions ?? ['priority'],
  };
}
