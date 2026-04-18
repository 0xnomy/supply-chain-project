/**
 * Mulberry32 seeded PRNG — deterministic random number generator.
 * All randomness in the simulation goes through this. No Math.random() anywhere.
 */

export class SeededRandom {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] inclusive */
  uniformInt(min: number, max: number): number {
    return Math.floor(this.uniform(min, max + 1));
  }

  /** Box-Muller gaussian */
  gaussian(mean: number, stdDev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1 + 1e-10)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  /** Pick from array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick — returns index */
  weightedPick(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return 0;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}
