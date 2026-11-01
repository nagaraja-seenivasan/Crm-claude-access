/**
 * Streaming quantile estimator using the **P²** algorithm
 * (Jain & Chlamtac, 1985).
 *
 * Estimates a single quantile (e.g. the 95th percentile of resolution time)
 * from a stream of observations in **O(1) time and O(1) memory per update** —
 * five markers, no sorting, no retained sample. This is what lets the report
 * engine compute P50/P90/P95/P99 over millions of SLA records in a single pass
 * without materialising the data.
 *
 * The estimate is approximate; accuracy improves with sample size and is
 * excellent for the smooth, heavy-tailed distributions typical of SLA metrics.
 */
export class P2Quantile {
  private readonly p: number;
  private n = 0;
  private readonly q = new Float64Array(5); // marker heights
  private readonly np = new Float64Array(5); // actual positions
  private readonly npDesired = new Float64Array(5); // desired positions
  private readonly dn = new Float64Array(5); // desired increments
  private readonly init: number[] = [];

  constructor(p: number) {
    if (p <= 0 || p >= 1) throw new RangeError(`Quantile must be in (0,1), got ${p}`);
    this.p = p;
    this.dn[0] = 0;
    this.dn[1] = p / 2;
    this.dn[2] = p;
    this.dn[3] = (1 + p) / 2;
    this.dn[4] = 1;
  }

  /** Feed one observation. */
  push(x: number): void {
    if (this.n < 5) {
      this.init.push(x);
      this.n++;
      if (this.n === 5) {
        this.init.sort((a, b) => a - b);
        for (let i = 0; i < 5; i++) {
          this.q[i] = this.init[i];
          this.np[i] = i + 1;
        }
        this.npDesired[0] = 1;
        this.npDesired[1] = 1 + 2 * this.p;
        this.npDesired[2] = 1 + 4 * this.p;
        this.npDesired[3] = 3 + 2 * this.p;
        this.npDesired[4] = 5;
      }
      return;
    }

    this.n++;
    let k: number;
    if (x < this.q[0]) {
      this.q[0] = x;
      k = 0;
    } else if (x < this.q[1]) k = 0;
    else if (x < this.q[2]) k = 1;
    else if (x < this.q[3]) k = 2;
    else if (x <= this.q[4]) k = 3;
    else {
      this.q[4] = x;
      k = 3;
    }

    for (let i = k + 1; i < 5; i++) this.np[i] += 1;
    for (let i = 0; i < 5; i++) this.npDesired[i] += this.dn[i];

    for (let i = 1; i <= 3; i++) {
      const d = this.npDesired[i] - this.np[i];
      if (
        (d >= 1 && this.np[i + 1] - this.np[i] > 1) ||
        (d <= -1 && this.np[i - 1] - this.np[i] < -1)
      ) {
        const dir = d >= 0 ? 1 : -1;
        const parab = this.parabolic(i, dir);
        if (this.q[i - 1] < parab && parab < this.q[i + 1]) {
          this.q[i] = parab;
        } else {
          this.q[i] = this.linear(i, dir);
        }
        this.np[i] += dir;
      }
    }
  }

  private parabolic(i: number, d: number): number {
    const {q, np} = this;
    return (
      q[i] +
      (d / (np[i + 1] - np[i - 1])) *
        ((np[i] - np[i - 1] + d) * ((q[i + 1] - q[i]) / (np[i + 1] - np[i])) +
          (np[i + 1] - np[i] - d) * ((q[i] - q[i - 1]) / (np[i] - np[i - 1])))
    );
  }

  private linear(i: number, d: number): number {
    const {q, np} = this;
    return q[i] + d * ((q[i + d] - q[i]) / (np[i + d] - np[i]));
  }

  /** The current quantile estimate, or `undefined` if nothing was observed. */
  value(): number | undefined {
    if (this.n === 0) return undefined;
    if (this.n < 5) {
      // Exact from the retained bootstrap sample.
      const s = [...this.init].sort((a, b) => a - b);
      const idx = Math.min(s.length - 1, Math.round(this.p * (s.length - 1)));
      return s[idx];
    }
    return this.q[2];
  }

  /** Number of observations seen. */
  get count(): number {
    return this.n;
  }
}
