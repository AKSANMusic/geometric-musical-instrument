/**
 * chord-engine.ts — Geometric Chord Generator, Voice-Leading & Accordion Harmonizer
 *
 * Implements harmonic voicings adhering to the cyclic Just Intonation polygon geometry.
 * Features an Accordion-style degree accompaniment model (I, ii, iii, IV, V, vi, vii)
 * with smooth voice-leading (حل شدن گوش‌نواز آکوردها در یکدیگر) and detailed note inspections.
 */

import type { Pentagon, Edge, NoteEvent } from '../types';
import type { AudioRenderer } from './renderer';
import type { CanvasRenderer } from '../visualization/canvas-renderer';

export interface ChordDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly hotkey?: string;
  readonly category: 'accordion' | 'geometric';
  readonly degreeIndices?: readonly number[];
  /** Function returning list of { level: number, edgeIndex: number, param: number } */
  readonly getVoicing: (
    pentagons: ReadonlyArray<Pentagon>,
    targetRing: number | 'all',
  ) => Array<{ level: number; edgeIndex: number; param: number }>;
}

export type StrumMode = 'block' | 'fast-strum' | 'slow-strum' | 'down-strum' | 'cascade';

export const STRUM_DELAYS: Record<StrumMode, number> = {
  block: 0,
  'fast-strum': 25,
  'slow-strum': 55,
  'down-strum': 35,
  cascade: 80,
};

// ─── Voice-Leading Manager ───────────────────────────────────────────────────

export class VoiceLeadingManager {
  private previousNotes: Array<{ frequency: number; level: number; edgeIndex: number }> = [];
  public enabled = true;
  public maxSearchDepth = 6;

  public reset(): void {
    this.previousNotes = [];
  }

  /**
   * Resolves chord degrees across concentric rings to minimize voice displacement (Voice Leading).
   */
  public resolveVoicing(
    degrees: readonly number[],
    pentagons: ReadonlyArray<Pentagon>,
    targetRing: number | 'all',
  ): Array<{ level: number; edgeIndex: number; param: number }> {
    const numRings = pentagons.length;
    if (numRings === 0) return [];

    // When a specific ring is targeted, voice directly on that ring
    if (targetRing !== 'all') {
      const ring = Math.min(targetRing, numRings - 1);
      const pent = pentagons[ring];
      const count = pent ? pent.edges.length : 5;
      return degrees.map(deg => ({
        level: ring,
        edgeIndex: deg % count,
        param: 0.5,
      }));
    }

    // If disabled or first chord or single ring, distribute evenly across rings (Bass on 0, mid on 1, top on 2)
    if (!this.enabled || this.previousNotes.length === 0 || numRings <= 1) {
      const voicing = degrees.map((deg, i) => {
        const level = Math.min(i, numRings - 1);
        const count = pentagons[level]?.edges.length || 5;
        return {
          level,
          edgeIndex: deg % count,
          param: 0.5,
        };
      });
      this.recordVoiceHistory(voicing, pentagons);
      return voicing;
    }

    // Smooth Voice Leading:
    // For each degree in the new chord, find the ring level that places its frequency
    // closest to one of the previous notes (minimizing total distance in log frequency).
    const prevFreqs = this.previousNotes.map(n => n.frequency);
    const chosenVoicing: Array<{ level: number; edgeIndex: number; param: number }> = [];
    const maxCandidateRing = Math.min(this.maxSearchDepth, numRings);

    for (let i = 0; i < degrees.length; i++) {
      const deg = degrees[i];
      let bestLevel = 0;
      let bestDist = Infinity;

      for (let ring = 0; ring < maxCandidateRing; ring++) {
        const pent = pentagons[ring];
        if (!pent) continue;
        const edgeIdx = deg % pent.edges.length;
        const freq = pent.edges[edgeIdx]?.frequency;
        if (!freq) continue;

        // Compare against corresponding previous voice or closest previous voice
        const targetPrevFreq = prevFreqs[Math.min(i, prevFreqs.length - 1)];
        const dist = Math.abs(Math.log2(freq / targetPrevFreq));

        if (dist < bestDist) {
          bestDist = dist;
          bestLevel = ring;
        }
      }

      chosenVoicing.push({
        level: bestLevel,
        edgeIndex: deg % (pentagons[bestLevel]?.edges.length || 5),
        param: 0.5,
      });
    }

    // Voice crossing prevention: sort voicing so frequencies ascend monotonically (bass is lowest)
    chosenVoicing.sort((a, b) => {
      const freqA = pentagons[a.level]?.edges[a.edgeIndex]?.frequency || 0;
      const freqB = pentagons[b.level]?.edges[b.edgeIndex]?.frequency || 0;
      return freqA - freqB;
    });

    this.recordVoiceHistory(chosenVoicing, pentagons);
    return chosenVoicing;
  }

  private recordVoiceHistory(
    voicing: Array<{ level: number; edgeIndex: number; param: number }>,
    pentagons: ReadonlyArray<Pentagon>,
  ): void {
    this.previousNotes = voicing.map(v => {
      const edge = pentagons[v.level]?.edges[v.edgeIndex];
      return {
        frequency: edge?.frequency || 440,
        level: v.level,
        edgeIndex: v.edgeIndex,
      };
    });
  }
}

export const voiceLeadingManager = new VoiceLeadingManager();

// ─── Degree Helper for Scale Invariance (5 or 7 tones) ────────────────────────

function buildDegreeVoicing(
  degreeIndices: [number, number, number],
  pentagons: ReadonlyArray<Pentagon>,
  targetRing: number | 'all',
): Array<{ level: number; edgeIndex: number; param: number }> {
  return voiceLeadingManager.resolveVoicing(degreeIndices, pentagons, targetRing);
}

// ─── Accordion Diatonic / Modal Degree Chords (A, S, D, F, G, H, J) ───────────

export const ACCORDION_DEGREE_CHORDS: ChordDefinition[] = [
  {
    id: 'deg-1',
    name: 'Degree I (پایه / Tonic)',
    description: 'Tonic triad (1 - 3 - 5) • Foundation harmony',
    hotkey: 'A',
    category: 'accordion',
    degreeIndices: [0, 2, 4],
    getVoicing: (pentagons, targetRing) => buildDegreeVoicing([0, 2, 4], pentagons, targetRing),
  },
  {
    id: 'deg-2',
    name: 'Degree ii (درجه ۲ / Supertonic)',
    description: 'Supertonic triad (2 - 4 - 6) • Pre-dominant tension',
    hotkey: 'S',
    category: 'accordion',
    degreeIndices: [1, 3, 5],
    getVoicing: (pentagons, targetRing) => buildDegreeVoicing([1, 3, 5], pentagons, targetRing),
  },
  {
    id: 'deg-3',
    name: 'Degree iii (درجه ۳ / Mediant)',
    description: 'Mediant triad (3 - 5 - 7) • Soft emotional color',
    hotkey: 'D',
    category: 'accordion',
    degreeIndices: [2, 4, 6],
    getVoicing: (pentagons, targetRing) => buildDegreeVoicing([2, 4, 6], pentagons, targetRing),
  },
  {
    id: 'deg-4',
    name: 'Degree IV (درجه ۴ / Subdominant)',
    description: 'Subdominant triad (4 - 6 - 1) • Expansive openness',
    hotkey: 'F',
    category: 'accordion',
    degreeIndices: [3, 5, 0],
    getVoicing: (pentagons, targetRing) => buildDegreeVoicing([3, 5, 0], pentagons, targetRing),
  },
  {
    id: 'deg-5',
    name: 'Degree V (درجه ۵ / Dominant)',
    description: 'Dominant triad (5 - 7 - 2) • Bright resolution driver',
    hotkey: 'G',
    category: 'accordion',
    degreeIndices: [4, 6, 1],
    getVoicing: (pentagons, targetRing) => buildDegreeVoicing([4, 6, 1], pentagons, targetRing),
  },
  {
    id: 'deg-6',
    name: 'Degree vi (درجه ۶ / Submediant)',
    description: 'Submediant triad (6 - 1 - 3) • Relative minor warmth',
    hotkey: 'H',
    category: 'accordion',
    degreeIndices: [5, 0, 2],
    getVoicing: (pentagons, targetRing) => buildDegreeVoicing([5, 0, 2], pentagons, targetRing),
  },
  {
    id: 'deg-7',
    name: 'Degree vii° (درجه ۷ / Leading Tone)',
    description: 'Leading Tone triad (7 - 2 - 4) • High tension pull to root',
    hotkey: 'J',
    category: 'accordion',
    degreeIndices: [6, 1, 3],
    getVoicing: (pentagons, targetRing) => buildDegreeVoicing([6, 1, 3], pentagons, targetRing),
  },
];

// ─── Geometric & Cosmic Presets (Q, W, E, R, T, Y, U, I, O) ──────────────────

export const GEOMETRIC_CHORD_PRESETS: ChordDefinition[] = [
  {
    id: 'tonic-triad',
    name: 'Tonic Triad (1 - 3 - 5)',
    description: 'Fundamental triad: Root (1/1), 3rd (5/4), and 5th (3/2)',
    hotkey: 'Q',
    category: 'geometric',
    degreeIndices: [0, 2, 4],
    getVoicing: (pentagons, targetRing) => {
      const ring = targetRing === 'all' ? 0 : Math.min(targetRing, pentagons.length - 1);
      const pent = pentagons[ring];
      const fifthEdge = pent && pent.edges.length >= 7 ? 4 : 3;
      return [
        { level: ring, edgeIndex: 0, param: 0.5 },
        { level: ring, edgeIndex: 2, param: 0.5 },
        { level: ring, edgeIndex: fifthEdge, param: 0.5 },
      ];
    },
  },
  {
    id: 'sus2',
    name: 'Sus2 Chord (1 - 2 - 5)',
    description: 'Suspended second: Root (1/1), 2nd (9/8), and 5th (3/2)',
    hotkey: 'W',
    category: 'geometric',
    degreeIndices: [0, 1, 4],
    getVoicing: (pentagons, targetRing) => {
      const ring = targetRing === 'all' ? 0 : Math.min(targetRing, pentagons.length - 1);
      const pent = pentagons[ring];
      const fifthEdge = pent && pent.edges.length >= 7 ? 4 : 3;
      return [
        { level: ring, edgeIndex: 0, param: 0.5 },
        { level: ring, edgeIndex: 1, param: 0.5 },
        { level: ring, edgeIndex: fifthEdge, param: 0.5 },
      ];
    },
  },
  {
    id: 'sus4-6th',
    name: 'Modal 6th (1 - 5 - 6)',
    description: 'Open airy voicing: Root (1/1), 5th (3/2), and 6th',
    hotkey: 'E',
    category: 'geometric',
    degreeIndices: [0, 4, 5],
    getVoicing: (pentagons, targetRing) => {
      const ring = targetRing === 'all' ? 0 : Math.min(targetRing, pentagons.length - 1);
      const pent = pentagons[ring];
      const fifthEdge = pent && pent.edges.length >= 7 ? 4 : 3;
      const sixthEdge = pent && pent.edges.length >= 7 ? 5 : 4;
      return [
        { level: ring, edgeIndex: 0, param: 0.5 },
        { level: ring, edgeIndex: fifthEdge, param: 0.5 },
        { level: ring, edgeIndex: sixthEdge, param: 0.5 },
      ];
    },
  },
  {
    id: 'pentachord-cluster',
    name: 'Full Chord Cluster (All)',
    description: 'Harmonic resonance: all strings sounding simultaneously on the ring',
    hotkey: 'R',
    category: 'geometric',
    getVoicing: (pentagons, targetRing) => {
      const ring = targetRing === 'all' ? 0 : Math.min(targetRing, pentagons.length - 1);
      const pent = pentagons[ring];
      const count = pent ? pent.edges.length : 5;
      return Array.from({ length: count }, (_, edgeIndex) => ({
        level: ring,
        edgeIndex,
        param: 0.3 + edgeIndex * 0.1,
      }));
    },
  },
  {
    id: 'power-fifth',
    name: 'Power 5th + Octaves',
    description: 'Acoustically pure Root and Fifth reinforced across octaves',
    hotkey: 'T',
    category: 'geometric',
    degreeIndices: [0, 4],
    getVoicing: (pentagons, targetRing) => {
      const notes: Array<{ level: number; edgeIndex: number; param: number }> = [];
      const rings =
        targetRing === 'all'
          ? Array.from({ length: Math.min(4, pentagons.length) }, (_, i) => i)
          : [Math.min(targetRing, pentagons.length - 1)];

      for (const r of rings) {
        const fifthEdge = pentagons[r] && pentagons[r].edges.length >= 7 ? 4 : 3;
        notes.push({ level: r, edgeIndex: 0, param: 0.5 });
        notes.push({ level: r, edgeIndex: fifthEdge, param: 0.5 });
      }
      return notes;
    },
  },
  {
    id: 'geometric-open-spread',
    name: 'Geometric Open Voicing',
    description: 'Acoustic pyramid: Bass Root on outer ring, Fifth on mid, Third & Sixth on inner rings',
    hotkey: 'Y',
    category: 'geometric',
    getVoicing: (pentagons) => {
      const count = pentagons.length;
      if (count <= 1) {
        const first = pentagons[0];
        const fifthEdge = first && first.edges.length >= 7 ? 4 : 3;
        const sixthEdge = first && first.edges.length >= 7 ? 5 : 4;
        return [
          { level: 0, edgeIndex: 0, param: 0.5 },
          { level: 0, edgeIndex: 2, param: 0.5 },
          { level: 0, edgeIndex: fifthEdge, param: 0.5 },
          { level: 0, edgeIndex: sixthEdge, param: 0.5 },
        ];
      }
      const outer = 0;
      const mid = Math.min(1, count - 1);
      const inner = Math.min(2, count - 1);
      const high = Math.min(3, count - 1);

      const midFifth = pentagons[mid] && pentagons[mid].edges.length >= 7 ? 4 : 3;
      const highSixth = pentagons[high] && pentagons[high].edges.length >= 7 ? 5 : 4;

      return [
        { level: outer, edgeIndex: 0, param: 0.5 },      // deep root
        { level: mid, edgeIndex: midFifth, param: 0.5 }, // middle fifth
        { level: inner, edgeIndex: 2, param: 0.5 },       // inner third
        { level: high, edgeIndex: highSixth, param: 0.5 },// top sixth
      ];
    },
  },
  {
    id: 'radial-fifth-shimmer',
    name: 'Radial Fifth Shimmer (3/2)',
    description: 'Harmonic pillar: Perfect Fifth edge across all concentric rings',
    hotkey: 'U',
    category: 'geometric',
    getVoicing: (pentagons) => {
      return pentagons.map((pent, level) => ({
        level,
        edgeIndex: pent.edges.length >= 7 ? 4 : 3,
        param: 0.5,
      }));
    },
  },
  {
    id: 'celestial-inward-spiral',
    name: 'Inward Spiral (Cosmic Harp)',
    description: 'Harmonic descent from outer rim to innermost core',
    hotkey: 'I',
    category: 'geometric',
    getVoicing: (pentagons) => {
      const notes: Array<{ level: number; edgeIndex: number; param: number }> = [];
      for (let i = 0; i < pentagons.length; i++) {
        const edgeCount = pentagons[i]?.edges.length ?? 5;
        const edge = (i * 2) % edgeCount;
        notes.push({ level: i, edgeIndex: edge, param: 0.5 });
      }
      return notes;
    },
  },
  {
    id: 'radial-root-cascade',
    name: 'Radial Octave Cascade (Root)',
    description: 'Pure octave column: Root edge (0) sounding across all concentric rings',
    hotkey: 'O',
    category: 'geometric',
    getVoicing: (pentagons) => {
      return pentagons.map((_, level) => ({
        level,
        edgeIndex: 0,
        param: 0.5,
      }));
    },
  },
];

/** Combined list containing Accordion degrees first, then geometric presets */
export const CHORD_PRESETS: ChordDefinition[] = [
  ...ACCORDION_DEGREE_CHORDS,
  ...GEOMETRIC_CHORD_PRESETS,
];

export function findChordByHotkey(key: string): ChordDefinition | undefined {
  const upper = key.toUpperCase();
  return CHORD_PRESETS.find(c => c.hotkey === upper);
}

// ─── Piano Mapping & Microtonal Frequency Analysis ──────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface FrequencyPianoAnalysis {
  pianoKey: string;
  noteName: string;
  octave: number;
  centsOffset: number;
  isMicrotonal: boolean;
  centsLabel: string;
}

export function analyzeFrequencyAgainstPiano(freq: number): FrequencyPianoAnalysis {
  // A4 = 440 Hz = MIDI 69
  const exactMidi = 69 + 12 * Math.log2(freq / 440);
  const roundedMidi = Math.round(exactMidi);
  const cents = Math.round((exactMidi - roundedMidi) * 100);
  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const noteName = NOTE_NAMES[noteIndex];
  const pianoKey = `${noteName}${octave}`;
  const isMicrotonal = Math.abs(cents) >= 20;

  let centsLabel = '';
  if (Math.abs(cents) < 5) {
    centsLabel = '±0¢ (Pure)';
  } else if (isMicrotonal) {
    centsLabel = `${cents > 0 ? '+' : ''}${cents}¢ [Koron / کُرُن]`;
  } else {
    centsLabel = `${cents > 0 ? '+' : ''}${cents}¢ JI`;
  }

  return {
    pianoKey,
    noteName,
    octave,
    centsOffset: cents,
    isMicrotonal,
    centsLabel,
  };
}

export interface ChordNoteDetail {
  readonly noteName: string;
  readonly frequency: number;
  readonly octave: number;
  readonly ring: number;
  readonly edgeIndex: number;
  readonly label: string;
  readonly pianoKey: string;
  readonly centsOffset: number;
  readonly isMicrotonal: boolean;
  readonly centsLabel: string;
  readonly param: number;
}

/**
 * Computes a detailed breakdown of all notes in a chord voicing.
 */
export function getChordNoteBreakdown(
  chordDef: ChordDefinition,
  pentagons: ReadonlyArray<Pentagon>,
  targetRing: number | 'all',
): ChordNoteDetail[] {
  const targets = chordDef.getVoicing(pentagons, targetRing);
  const details: ChordNoteDetail[] = [];

  for (const t of targets) {
    const pent = pentagons[t.level];
    if (!pent) continue;
    const edge = pent.edges[t.edgeIndex];
    if (!edge) continue;

    const analysis = analyzeFrequencyAgainstPiano(edge.frequency);
    details.push({
      noteName: analysis.noteName,
      frequency: edge.frequency,
      octave: analysis.octave,
      ring: t.level,
      edgeIndex: t.edgeIndex,
      label: edge.label,
      pianoKey: analysis.pianoKey,
      centsOffset: analysis.centsOffset,
      isMicrotonal: analysis.isMicrotonal,
      centsLabel: analysis.centsLabel,
      param: t.param,
    });
  }

  return details;
}

// ─── Chord Execution ─────────────────────────────────────────────────────────

export interface PlayChordOptions {
  chordId: string;
  pentagons: ReadonlyArray<Pentagon>;
  targetRing: number | 'all';
  strumMode: StrumMode;
  audioRenderer: AudioRenderer;
  canvasRenderer?: CanvasRenderer;
  baseVelocity?: number;
  useVoiceLeading?: boolean;
  onNoteTriggered?: (note: NoteEvent, chordName: string, isLast: boolean) => void;
}

// ─── Active Strum Timer Tracking ─────────────────────────────────────────────

let activeStrumTimers: ReturnType<typeof setTimeout>[] = [];

/**
 * Cancel any in-flight strum timers.
 * Prevents rapid chord re-triggers from interleaving delayed notes uncontrollably.
 */
export function cancelActiveStrums(): void {
  for (const timer of activeStrumTimers) {
    clearTimeout(timer);
  }
  activeStrumTimers = [];
}

/**
 * Executes a chord across the polygon network with optional voice-leading and strumming.
 * Uses AudioContext time for sample-accurate audio scheduling while maintaining visual sync.
 */
export function playChord(options: PlayChordOptions): void {
  const {
    chordId,
    pentagons,
    targetRing,
    strumMode,
    audioRenderer,
    canvasRenderer,
    baseVelocity = 105,
    useVoiceLeading = true,
    onNoteTriggered,
  } = options;

  // Cancel any previous strum timers so notes do not collide
  cancelActiveStrums();

  voiceLeadingManager.enabled = useVoiceLeading;

  const chordDef = CHORD_PRESETS.find(c => c.id === chordId) || CHORD_PRESETS[0];
  let targets = chordDef.getVoicing(pentagons, targetRing);

  if (targets.length === 0) return;

  if (strumMode === 'down-strum') {
    targets = [...targets].reverse();
  }

  const delayMs = STRUM_DELAYS[strumMode];
  const audioCtx = audioRenderer.getAudioContext?.();
  const baseAudioTime = audioCtx ? audioCtx.currentTime : performance.now() / 1000;

  targets.forEach((target, idx) => {
    const delaySec = (idx * delayMs) / 1000;
    const scheduledAudioTime = baseAudioTime + delaySec;

    const playSingleNote = () => {
      const pent = pentagons[target.level];
      if (!pent) return;
      const edge = pent.edges[target.edgeIndex];
      if (!edge) return;

      const velocity = Math.min(127, Math.max(1, baseVelocity + (Math.random() * 10 - 5)));
      const note = audioRenderer.triggerManualNote(
        edge,
        target.level,
        target.param,
        velocity,
        pent.edges.length,
        scheduledAudioTime,
      );

      if (note && canvasRenderer) {
        const impactPoint = {
          x: edge.p1.x + target.param * (edge.p2.x - edge.p1.x),
          y: edge.p1.y + target.param * (edge.p2.y - edge.p1.y),
        };
        canvasRenderer.addManualFlash(impactPoint, target.level, edge.index);
      }

      if (note && onNoteTriggered) {
        onNoteTriggered(note, chordDef.name, idx === targets.length - 1);
      }
    };

    if (delayMs === 0 || idx === 0) {
      playSingleNote();
    } else {
      const timer = setTimeout(playSingleNote, idx * delayMs);
      activeStrumTimers.push(timer);
    }
  });
}
