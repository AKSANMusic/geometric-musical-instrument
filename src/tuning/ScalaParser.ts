/**
 * ScalaParser.ts — Pure TypeScript Parser for Huygens-Fokker Scala (.scl) Tuning Files
 *
 * Supports:
 * 1. Arbitrary scale sizes (5, 7, 12, 17, 24, 53-EDO, etc.).
 * 2. Cents values (e.g. 150.6, 701.955).
 * 3. Rational integer ratios (e.g. 9/8, 5/4, 12/11, 2/1).
 * 4. Octave and non-octave scales (e.g. Bohlen-Pierce 3/1 tritave).
 * 5. Complete metadata extraction (description, note count, degree ratios).
 */

export interface ScalaDegree {
  readonly index: number;           // 1 to N
  readonly cents: number;           // Absolute cents from 1/1 tonic
  readonly ratio: number;           // Decimal frequency ratio
  readonly rawText: string;         // Original string in .scl file
}

export interface ScalaScale {
  readonly description: string;
  readonly count: number;
  readonly degrees: ReadonlyArray<ScalaDegree>;
  readonly formalOctaveRatio: number;   // Usually 2.0 (1200 cents), or 3.0 for Bohlen-Pierce
  readonly formalOctaveCents: number;
}

export class ScalaParser {
  /**
   * Parse a raw .scl text string into a structured ScalaScale.
   */
  public static parse(sclContent: string): ScalaScale {
    const lines = sclContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('!'));

    if (lines.length < 2) {
      throw new Error('Invalid Scala (.scl) file: insufficient lines for description and note count');
    }

    const description = lines[0];
    const count = parseInt(lines[1], 10);

    if (isNaN(count) || count < 1) {
      throw new Error(`Invalid Scala note count: "${lines[1]}"`);
    }

    const degrees: ScalaDegree[] = [];

    for (let i = 2; i < lines.length && degrees.length < count; i++) {
      const line = lines[i].split(/\s+/)[0]; // First token before any whitespace comment
      if (!line) continue;

      let cents: number;
      let ratio: number;

      if (line.includes('.')) {
        // Cents value: e.g. "1200.0" or "150.6"
        cents = parseFloat(line);
        if (isNaN(cents)) throw new Error(`Invalid cents value: "${line}"`);
        ratio = Math.pow(2, cents / 1200);
      } else if (line.includes('/')) {
        // Ratio: e.g. "9/8" or "12/11"
        const parts = line.split('/');
        const num = parseInt(parts[0], 10);
        const den = parseInt(parts[1], 10);
        if (isNaN(num) || isNaN(den) || den === 0) {
          throw new Error(`Invalid ratio string: "${line}"`);
        }
        ratio = num / den;
        cents = 1200 * Math.log2(ratio);
      } else {
        // Single integer ratio without slash: e.g. "2" means 2/1
        const num = parseInt(line, 10);
        if (isNaN(num) || num <= 0) {
          throw new Error(`Invalid integer ratio: "${line}"`);
        }
        ratio = num;
        cents = 1200 * Math.log2(ratio);
      }

      degrees.push({
        index: degrees.length + 1,
        cents,
        ratio,
        rawText: line,
      });
    }

    if (degrees.length !== count) {
      throw new Error(`Scala file note count mismatch: expected ${count}, found ${degrees.length}`);
    }

    const lastDegree = degrees[degrees.length - 1];
    const formalOctaveRatio = lastDegree.ratio;
    const formalOctaveCents = lastDegree.cents;

    return {
      description,
      count,
      degrees,
      formalOctaveRatio,
      formalOctaveCents,
    };
  }

  /**
   * Convert Scala scale degrees to full frequencies given base tonic frequency.
   */
  public static getFrequencies(scale: ScalaScale, baseFreqHz: number): number[] {
    // 0th degree is always tonic unison (1/1, 0 cents)
    const freqs = [baseFreqHz];
    for (const deg of scale.degrees) {
      freqs.push(baseFreqHz * deg.ratio);
    }
    return freqs;
  }
}
