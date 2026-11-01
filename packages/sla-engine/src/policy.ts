import type {PolicyRule, SlaInstance, SlaPolicyConfig} from './types';

/**
 * A resolved, immutable SLA policy. Rules are pre-sorted by descending priority
 * at construction so target resolution is a short linear scan with the first
 * match winning — no per-call sorting.
 */
export class SlaPolicy {
  readonly id: string;
  readonly name: string;
  readonly metric: string;
  readonly calendarId: string;
  readonly defaultTargetSeconds: number;
  private readonly rules: PolicyRule[];

  constructor(config: SlaPolicyConfig) {
    this.id = config.id;
    this.name = config.name ?? config.id;
    this.metric = config.metric;
    this.calendarId = config.calendarId ?? 'default';
    this.defaultTargetSeconds = config.defaultTargetSeconds;
    this.rules = [...(config.rules ?? [])].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
  }

  /**
   * Resolve the target budget (seconds) for the given dimensions. Returns the
   * first matching rule's target, else the policy default.
   */
  resolveTargetSeconds(dimensions?: SlaInstance['dimensions']): number {
    const dims = dimensions ?? {};
    for (let i = 0; i < this.rules.length; i++) {
      if (matches(this.rules[i].when, dims)) return this.rules[i].targetSeconds;
    }
    return this.defaultTargetSeconds;
  }
}

function matches(
  when: PolicyRule['when'],
  dims: Record<string, unknown>,
): boolean {
  if (!when) return true;
  for (const key in when) {
    if (dims[key] !== when[key]) return false;
  }
  return true;
}
