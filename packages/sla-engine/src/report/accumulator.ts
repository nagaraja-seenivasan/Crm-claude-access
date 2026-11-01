import {P2Quantile} from './p-square';

/** Which quantiles a group should estimate (fractions in (0,1)). */
export type QuantileSpec = number[];

/**
 * A single group's running statistics. Every field updates incrementally in
 * {@link add} — no values are retained — giving O(1) memory per group
 * regardless of how many records flow through it.
 */
export class GroupAccumulator {
  count = 0;
  breached = 0;
  met = 0;
  open = 0;
  sum = 0;
  min = Number.POSITIVE_INFINITY;
  max = Number.NEGATIVE_INFINITY;
  private readonly quantiles: Map<number, P2Quantile>;

  constructor(quantileSpec: QuantileSpec = []) {
    this.quantiles = new Map();
    for (const p of quantileSpec) this.quantiles.set(p, new P2Quantile(p));
  }

  /**
   * @param value       the measured metric (e.g. elapsed seconds)
   * @param isBreached  whether this record breached its SLA
   * @param isComplete  whether this record is finished (met/breached) vs open
   */
  add(value: number, isBreached: boolean, isComplete: boolean): void {
    this.count++;
    this.sum += value;
    if (value < this.min) this.min = value;
    if (value > this.max) this.max = value;
    if (isBreached) this.breached++;
    else if (isComplete) this.met++;
    if (!isComplete) this.open++;
    for (const est of this.quantiles.values()) est.push(value);
  }

  get avg(): number {
    return this.count > 0 ? this.sum / this.count : 0;
  }

  /** Fraction of records that met their SLA (of completed records). */
  get attainment(): number {
    const completed = this.count - this.open;
    return completed > 0 ? this.met / completed : 1;
  }

  get breachRate(): number {
    return this.count > 0 ? this.breached / this.count : 0;
  }

  quantile(p: number): number | undefined {
    return this.quantiles.get(p)?.value();
  }

  /** Snapshot as a plain object for serialisation / reporting. */
  toJSON(): GroupStats {
    const quantiles: Record<string, number> = {};
    for (const [p, est] of this.quantiles) {
      const v = est.value();
      if (v !== undefined) quantiles[`p${Math.round(p * 100)}`] = round(v);
    }
    return {
      count: this.count,
      breached: this.breached,
      met: this.met,
      open: this.open,
      sum: round(this.sum),
      avg: round(this.avg),
      min: this.count ? round(this.min) : 0,
      max: this.count ? round(this.max) : 0,
      breachRate: round(this.breachRate, 4),
      attainment: round(this.attainment, 4),
      quantiles,
    };
  }
}

export interface GroupStats {
  count: number;
  breached: number;
  met: number;
  open: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  breachRate: number;
  attainment: number;
  quantiles: Record<string, number>;
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
