import type { SequencerConfig } from './types';
import { DEFAULT_SCALE, DEFAULT_ROOT } from './geometry/constants';

export const DEFAULT_CONFIG: SequencerConfig = {
  circumradius: 300,            // pixels (unit circle scaled to canvas)
  baseFrequency: 440,           // A4
  nestingLevels: 12,            // 12 concentric pentagons
  scalingFactor: -1,            // -1 = auto-fit harmonic linear spacing (f ∝ 1/L)
  damping: 0.985,               // slight energy loss per bounce
  maxVoices: 32,                // polyphony limit (expanded for full resonant chords)
  particleSpeed: 250,           // pixels/second initial speed
  physicsTick: 1 / 240,         // 240 Hz physics
  minIOI: 20,                   // ms de-bounce
  noteDuration: 1.8,            // seconds (natural acoustic string ring-out)
  scaleKey: DEFAULT_SCALE,
  rootKey: DEFAULT_ROOT,
  ballEnabled: true,
  timbreKey: 'santur',
  reverbMix: 0.38,              // warm acoustic reverb chamber
};
