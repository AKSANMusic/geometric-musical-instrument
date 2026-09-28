/**
 * app.ts — Main orchestrator for the Pentagon Sequencer.
 *
 * Wires together:
 *   - Geometry Solver (Irregular cyclic pentagons, 1 to 16 rings, Auto-Fit Harmonic Linear spacing)
 *   - Physics Engine (Continuous collision detection, Particle toggle/removal for acoustic mode)
 *   - Audio Renderer (FM synthesis, micro-timbre from pluck point, voice allocation)
 *   - Chord Engine (Geometric chords, radial voicings, multi-style strumming, keyboard hotkeys)
 *   - Circle of Fifths (12-tone modulation dial, step clockwise/counter-clockwise, octave shift)
 *   - Canvas Visualization (Dynamic harmonic rainbow rings, hover glow, pluck flashes)
 *   - Active Notes & Harmonics Monitor
 */

import { DEFAULT_CONFIG } from './config';
import type { SequencerConfig, Pentagon, CollisionEvent, Vec2, NoteEvent } from './types';
import { vec2 } from './types';
import { buildNestedPentagons } from './geometry/solver';
import {
  SCALES,
  ROOT_NOTES,
  DEFAULT_SCALE,
  DEFAULT_ROOT,
  CIRCLE_OF_FIFTHS,
  CIRCLE_OF_FIFTHS_PAIRS,
  getNextFifth,
  getPreviousFifth,
  getRelativeMinor,
  getRelativeMajor,
} from './geometry/constants';
import {
  CHORD_PRESETS,
  ACCORDION_DEGREE_CHORDS,
  GEOMETRIC_CHORD_PRESETS,
  playChord,
  findChordByHotkey,
  getChordNoteBreakdown,
  type ChordDefinition,
  type StrumMode,
} from './audio/chord-engine';
import { PhysicsEngine } from './physics/engine';
import { AudioRenderer } from './audio/renderer';
import { CanvasRenderer } from './visualization/canvas-renderer';
import { MidiManager } from './midi/midi-manager';
import type { Edge } from './types';
import {
  INSTRUMENT_PRESETS,
  DEFAULT_RANGE_CONFIG,
  type InstrumentRangeConfig,
  type RangeBehavior,
  midiToNoteName,
  midiToFrequency,
  foldFrequencyToRange,
  computeAutoFitRangeParameters,
} from './audio/instrument-range';
import { RangeKeyboardVisualizer } from './visualization/range-keyboard';

// ─── Musical Helpers ─────────────────────────────────────────────────────────

const CHROMATIC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function formatNoteWithOctave(frequency: number): string {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const note = CHROMATIC_NAMES[(midi % 12 + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

// ─── State ───────────────────────────────────────────────────────────────────

let config: SequencerConfig = { ...DEFAULT_CONFIG };
let octaveShift = 0; // -2 to +2 octave transposition
let rangeConfig: InstrumentRangeConfig = { ...DEFAULT_RANGE_CONFIG };
let rangeKeyboardVisualizer: RangeKeyboardVisualizer | null = null;
let pentagons: Pentagon[] = [];
let physicsEngine: PhysicsEngine;
let audioRenderer: AudioRenderer;
let canvasRenderer: CanvasRenderer;
let midiManager: MidiManager;

let running = false;
let paused = false;
let totalBounces = 0;
let lastNoteLabel = '—';
let lastFrameTime = 0;
let physicsAccumulator = 0;
let fps = 0;
let frameCount = 0;
let fpsTime = 0;

// Tracking for mouse strumming across strings
let lastPluckedKey: string | null = null;

// Active notes for visual monitor
interface MonitoredNote {
  id: string;
  name: string;
  freq: number;
  label: string;
  timestamp: number;
}
let activeNotesQueue: MonitoredNote[] = [];

// ─── DOM Elements ────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const startOverlay = document.getElementById('start-overlay') as HTMLDivElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const ballToggleBtn = document.getElementById('ball-toggle-btn') as HTMLButtonElement;

const rootSelect = document.getElementById('root-select') as HTMLSelectElement;
const scaleSelect = document.getElementById('scale-select') as HTMLSelectElement;
const timbreSelect = document.getElementById('timbre-select') as HTMLSelectElement;
const reverbSlider = document.getElementById('reverb-slider') as HTMLInputElement;
const decaySlider = document.getElementById('decay-slider') as HTMLInputElement;
const levelsSelect = document.getElementById('levels') as HTMLSelectElement;
const scalingSelect = document.getElementById('scaling') as HTMLSelectElement;
const volumeSlider = document.getElementById('volume') as HTMLInputElement;

const fifthPrevBtn = document.getElementById('fifth-prev-btn') as HTMLButtonElement;
const fifthNextBtn = document.getElementById('fifth-next-btn') as HTMLButtonElement;
const circleModeToggleBtn = document.getElementById('circle-mode-toggle-btn') as HTMLButtonElement;
const circleActiveKeyText = document.getElementById('circle-active-key-text') as HTMLSpanElement;
const circleActiveModeBadge = document.getElementById('circle-active-mode-badge') as HTMLSpanElement;
const circleConnectorsGroup = document.getElementById('circle-connectors-group') as unknown as SVGGElement;
const circleNodesGroup = document.getElementById('circle-nodes-group') as unknown as SVGGElement;

const octaveDownBtn = document.getElementById('octave-down-btn') as HTMLButtonElement;
const octaveUpBtn = document.getElementById('octave-up-btn') as HTMLButtonElement;
const octaveCascadeBtn = document.getElementById('octave-cascade-btn') as HTMLButtonElement;

const strumStyleSelect = document.getElementById('strum-style-select') as HTMLSelectElement;
const chordRingSelect = document.getElementById('chord-ring-select') as HTMLSelectElement;
const chordButtonsContainer = document.getElementById('chord-buttons-container') as HTMLDivElement;
const activeNotesList = document.getElementById('active-notes-list') as HTMLDivElement;
const voiceLeadingToggleBtn = document.getElementById('voice-leading-toggle-btn') as HTMLButtonElement | null;
const voiceLeadingStatus = document.getElementById('voice-leading-status') as HTMLSpanElement | null;
let voiceLeadingEnabled = true;

// MIDI DOM Elements
const midiInSelect = document.getElementById('midi-in-select') as HTMLSelectElement;
const midiOutSelect = document.getElementById('midi-out-select') as HTMLSelectElement;
const midiChannelSelect = document.getElementById('midi-channel-select') as HTMLSelectElement;
const midiPitchbendSelect = document.getElementById('midi-pitchbend-select') as HTMLSelectElement;
const midiPanicBtn = document.getElementById('midi-panic-btn') as HTMLButtonElement;
const midiLedIn = document.getElementById('midi-led-in') as HTMLSpanElement;
const midiLedOut = document.getElementById('midi-led-out') as HTMLSpanElement;

// Target Instrument Range DOM Elements
const rangeToggleBtn = document.getElementById('range-toggle-btn') as HTMLButtonElement | null;
const rangePresetSelect = document.getElementById('range-preset-select') as HTMLSelectElement | null;
const rangeMinSelect = document.getElementById('range-min-select') as HTMLSelectElement | null;
const rangeMaxSelect = document.getElementById('range-max-select') as HTMLSelectElement | null;
const rangeBehaviorSelect = document.getElementById('range-behavior-select') as HTMLSelectElement | null;
const rangeSpanInfo = document.getElementById('range-span-info') as HTMLSpanElement | null;
const rangeStatusBadge = document.getElementById('range-status-badge') as HTMLSpanElement | null;
const rangeKeyboardContainer = document.getElementById('range-keyboard-container') as HTMLDivElement | null;

const hudVoices = document.getElementById('hud-voices') as HTMLSpanElement;
const hudBall = document.getElementById('hud-ball') as HTMLSpanElement;
const hudTime = document.getElementById('hud-time') as HTMLSpanElement;
const hudBounces = document.getElementById('hud-bounces') as HTMLSpanElement;
const hudNote = document.getElementById('hud-note') as HTMLSpanElement;
const hudFps = document.getElementById('hud-fps') as HTMLSpanElement;

// ─── MIDI Integration Helpers ────────────────────────────────────────────────

function findClosestEdgeToFrequency(
  targetFreq: number,
): { pentagon: Pentagon; edge: Edge; level: number } | null {
  if (pentagons.length === 0) return null;
  let closestDist = Infinity;
  let match: { pentagon: Pentagon; edge: Edge; level: number } | null = null;

  for (let level = 0; level < pentagons.length; level++) {
    const pent = pentagons[level];
    for (const edge of pent.edges) {
      const dist = Math.abs(1200 * Math.log2(edge.frequency / targetFreq));
      if (dist < closestDist) {
        closestDist = dist;
        match = { pentagon: pent, edge, level };
      }
    }
  }
  return match;
}

function updateMidiPortsUI(): void {
  if (!midiManager) return;

  if (midiInSelect) {
    const currentVal = midiInSelect.value;
    const inputs = midiManager.getInputs();
    midiInSelect.innerHTML = `
      <option value="all">All Available Inputs</option>
      <option value="none">Disabled</option>
    `;
    inputs.forEach(input => {
      const opt = document.createElement('option');
      opt.value = input.id;
      opt.textContent = `${input.name} ${input.manufacturer ? `(${input.manufacturer})` : ''}`;
      midiInSelect.appendChild(opt);
    });
    if (inputs.some(i => i.id === currentVal) || currentVal === 'none' || currentVal === 'all') {
      midiInSelect.value = currentVal;
    }
  }

  if (midiOutSelect) {
    const currentVal = midiOutSelect.value;
    const outputs = midiManager.getOutputs();
    midiOutSelect.innerHTML = `
      <option value="none">Disabled (Local Audio Only)</option>
    `;
    outputs.forEach(output => {
      const opt = document.createElement('option');
      opt.value = output.id;
      opt.textContent = `${output.name} ${output.manufacturer ? `(${output.manufacturer})` : ''}`;
      midiOutSelect.appendChild(opt);
    });
    if (outputs.some(o => o.id === currentVal) || currentVal === 'none') {
      midiOutSelect.value = currentVal;
    }
  }
}

async function initMidi(): Promise<void> {
  midiManager = new MidiManager();
  midiManager.setMpeEnabled(true);
  const supported = await midiManager.init();

  if (supported) {
    updateMidiPortsUI();
    midiManager.onPortsChanged = () => updateMidiPortsUI();

    midiManager.onActivity = (dir) => {
      const led = dir === 'in' ? midiLedIn : midiLedOut;
      if (led) {
        led.classList.add(dir === 'in' ? 'active-in' : 'active-out');
        setTimeout(() => led.classList.remove(dir === 'in' ? 'active-in' : 'active-out'), 120);
      }
    };

    midiManager.onNoteIn = (midiNote, velocity) => {
      const noteFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
      const target = findClosestEdgeToFrequency(noteFreq);
      if (!target) return;

      const note = audioRenderer?.triggerManualNote(
        target.edge,
        target.level,
        0.5,
        velocity,
        target.pentagon.edges.length,
      );

      if (note && canvasRenderer) {
        const impactPoint = {
          x: (target.edge.p1.x + target.edge.p2.x) / 2,
          y: (target.edge.p1.y + target.edge.p2.y) / 2,
        };
        canvasRenderer.addManualFlash(impactPoint, target.level, target.edge.index);
        recordPlayedNote(note, `MIDI IN: ${target.edge.label} • Ring ${target.level}`);
      }
    };

    midiManager.onCCIn = (cc, val) => {
      if (cc === 7 && volumeSlider) { // Master Volume
        const normalized = val / 127;
        volumeSlider.value = normalized.toFixed(2);
        audioRenderer?.setVolume(normalized);
      } else if (cc === 1 && reverbSlider) { // Modulation Wheel -> Reverb
        const normalized = (val / 127) * 0.9;
        reverbSlider.value = normalized.toFixed(2);
        audioRenderer?.setReverbMix(normalized);
      } else if (cc === 64) { // Sustain Pedal
        const duration = val >= 64 ? 3.5 : (decaySlider ? parseFloat(decaySlider.value) : 1.8);
        audioRenderer?.setNoteDuration(duration);
      }
    };
  }
}

// ─── Initialization ──────────────────────────────────────────────────────────

function initGeometry(): void {
  const rect = canvas.getBoundingClientRect();
  config.circumradius = Math.min(rect.width, rect.height) * 0.44;

  const currentScale = SCALES[config.scaleKey || DEFAULT_SCALE] || SCALES[DEFAULT_SCALE];
  const rootNote = ROOT_NOTES[config.rootKey || DEFAULT_ROOT];
  if (rootNote) {
    config.baseFrequency = rootNote.frequency * Math.pow(2, octaveShift);
  }

  let baseFreq = config.baseFrequency;
  let scaleFactor = config.scalingFactor;

  if (rangeConfig?.enabled && rangeConfig.behavior === 'auto-fit') {
    const autoFit = computeAutoFitRangeParameters(
      rangeConfig.minMidi,
      rangeConfig.maxMidi,
      config.nestingLevels,
    );
    baseFreq = autoFit.baseFrequency;
    scaleFactor = autoFit.scalingFactor;
  }

  pentagons = buildNestedPentagons(
    config.circumradius,
    baseFreq,
    config.nestingLevels,
    scaleFactor,
    currentScale,
  );

  updateChordRingDropdown();
  updateCircleOfFifthsUI();
  initChordButtons();
}

function initPhysics(): void {
  physicsEngine = new PhysicsEngine(config.damping);
  physicsEngine.setPentagons(pentagons);

  if (config.ballEnabled) {
    spawnParticle();
  }

  totalBounces = 0;
  lastNoteLabel = '—';
}

function spawnParticle(): void {
  if (!physicsEngine) return;
  physicsEngine.particles = [];
  const angle = Math.random() * Math.PI * 2;
  const speed = config.particleSpeed;
  physicsEngine.addParticle(
    { x: 0, y: 0 },
    { x: speed * Math.cos(angle), y: speed * Math.sin(angle) },
    0,
    0,
  );
}

function resetSimulation(): void {
  audioRenderer?.stopAll();
  initGeometry();
  initPhysics();
  physicsAccumulator = 0;
  activeNotesQueue = [];
  updateNotesMonitor();
}

/** Update geometry live without resetting particle state */
function updateTuning(): void {
  initGeometry();
  physicsEngine?.setPentagons(pentagons);
}

function updateChordRingDropdown(): void {
  if (!chordRingSelect) return;
  const currentVal = chordRingSelect.value;
  chordRingSelect.innerHTML = `<option value="all">All / Auto-Voicing</option>`;

  for (let i = 0; i < pentagons.length; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Ring ${i} (${i === 0 ? 'Outermost' : i === pentagons.length - 1 ? 'Innermost' : 'Mid'})`;
    chordRingSelect.appendChild(opt);
  }

  if (currentVal === 'all' || parseInt(currentVal) < pentagons.length) {
    chordRingSelect.value = currentVal;
  } else {
    chordRingSelect.value = 'all';
  }
}

// ─── Target Instrument Range & SWAM Mapping Controls ─────────────────────────

function updateRangeUI(): void {
  if (rangeToggleBtn) {
    if (rangeConfig.enabled) {
      rangeToggleBtn.classList.add('enabled');
      rangeToggleBtn.textContent = 'RANGE: ON';
    } else {
      rangeToggleBtn.classList.remove('enabled');
      rangeToggleBtn.textContent = 'RANGE: OFF';
    }
  }

  const minName = midiToNoteName(rangeConfig.minMidi);
  const maxName = midiToNoteName(rangeConfig.maxMidi);
  const minF = midiToFrequency(rangeConfig.minMidi);
  const maxF = midiToFrequency(rangeConfig.maxMidi);
  const semitones = rangeConfig.maxMidi - rangeConfig.minMidi;

  if (rangeSpanInfo) {
    rangeSpanInfo.textContent = `${minName} (${minF.toFixed(0)}Hz) – ${maxName} (${maxF.toFixed(0)}Hz) • ${semitones}st`;
  }

  if (rangeStatusBadge) {
    const isCello = rangeConfig.minMidi === 36 && rangeConfig.maxMidi === 79;
    rangeStatusBadge.textContent = isCello
      ? 'SWAM Cello Ready'
      : `${minName}–${maxName} Active`;
  }

  rangeKeyboardVisualizer?.render(rangeConfig.minMidi, rangeConfig.maxMidi, rangeConfig.enabled);
}

function initRangeControls(): void {
  if (!rangeKeyboardContainer || !rangeMinSelect || !rangeMaxSelect) return;

  // 1. Populate Min and Max dropdowns (from C1 = 24 to C8 = 108)
  rangeMinSelect.innerHTML = '';
  rangeMaxSelect.innerHTML = '';

  for (let m = 24; m <= 108; m++) {
    const name = midiToNoteName(m);
    const freq = midiToFrequency(m);
    const label = `${name} (${freq.toFixed(1)} Hz)`;

    const optMin = document.createElement('option');
    optMin.value = String(m);
    optMin.textContent = label;
    rangeMinSelect.appendChild(optMin);

    const optMax = document.createElement('option');
    optMax.value = String(m);
    optMax.textContent = label;
    rangeMaxSelect.appendChild(optMax);
  }

  rangeMinSelect.value = String(rangeConfig.minMidi);
  rangeMaxSelect.value = String(rangeConfig.maxMidi);

  // 2. Initialize Virtual Keyboard Visualizer
  rangeKeyboardVisualizer = new RangeKeyboardVisualizer(rangeKeyboardContainer);
  updateRangeUI();

  // 3. Event Listeners
  rangeToggleBtn?.addEventListener('click', () => {
    rangeConfig.enabled = !rangeConfig.enabled;
    updateRangeUI();
    midiManager?.setRangeConfig(rangeConfig);
    if (rangeConfig.behavior === 'auto-fit') {
      initGeometry();
      physicsEngine?.setPentagons(pentagons);
    }
  });

  rangePresetSelect?.addEventListener('change', () => {
    const presetId = rangePresetSelect.value;
    const preset = INSTRUMENT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      rangeConfig.presetId = preset.id;
      rangeConfig.minMidi = preset.minMidi;
      rangeConfig.maxMidi = preset.maxMidi;
      rangeMinSelect.value = String(preset.minMidi);
      rangeMaxSelect.value = String(preset.maxMidi);
      updateRangeUI();
      midiManager?.setRangeConfig(rangeConfig);
      if (rangeConfig.behavior === 'auto-fit') {
        initGeometry();
        physicsEngine?.setPentagons(pentagons);
      }
    }
  });

  const onMinMaxChange = () => {
    let minVal = parseInt(rangeMinSelect.value, 10);
    let maxVal = parseInt(rangeMaxSelect.value, 10);
    if (minVal >= maxVal) {
      maxVal = minVal + 12;
      rangeMaxSelect.value = String(maxVal);
    }
    rangeConfig.minMidi = minVal;
    rangeConfig.maxMidi = maxVal;
    rangeConfig.presetId = 'custom';
    if (rangePresetSelect) rangePresetSelect.value = 'custom';

    updateRangeUI();
    midiManager?.setRangeConfig(rangeConfig);
    if (rangeConfig.behavior === 'auto-fit') {
      initGeometry();
      physicsEngine?.setPentagons(pentagons);
    }
  };

  rangeMinSelect.addEventListener('change', onMinMaxChange);
  rangeMaxSelect.addEventListener('change', onMinMaxChange);

  rangeBehaviorSelect?.addEventListener('change', () => {
    rangeConfig.behavior = rangeBehaviorSelect.value as RangeBehavior;
    midiManager?.setRangeConfig(rangeConfig);
    if (rangeConfig.behavior === 'auto-fit') {
      initGeometry();
      physicsEngine?.setPentagons(pentagons);
    }
  });
}

// ─── Circle of Fifths Interactive Dial (Concentric Major & Minor) ────────────

function initCircleOfFifthsDial(): void {
  if (!circleNodesGroup || !circleConnectorsGroup) return;
  circleNodesGroup.innerHTML = '';
  circleConnectorsGroup.innerHTML = '';

  const cx = 75;
  const cy = 75;
  const rOuter = 56;
  const rInner = 34;

  CIRCLE_OF_FIFTHS_PAIRS.forEach((pair, index) => {
    const angle = -Math.PI / 2 + index * ((2 * Math.PI) / 12);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const xOuter = cx + rOuter * cosA;
    const yOuter = cy + rOuter * sinA;
    const xInner = cx + rInner * cosA;
    const yInner = cy + rInner * sinA;

    // Radial connector line between Major and Relative Minor
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', xInner.toFixed(1));
    line.setAttribute('y1', yInner.toFixed(1));
    line.setAttribute('x2', xOuter.toFixed(1));
    line.setAttribute('y2', yOuter.toFixed(1));
    line.setAttribute('stroke', 'rgba(100, 200, 255, 0.18)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '2,2');
    circleConnectorsGroup.appendChild(line);

    // 1. Outer Ring Node: Major Key
    const gMajor = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMajor.setAttribute('class', 'circle-node node-major');
    gMajor.setAttribute('data-key', pair.majorKey);
    gMajor.setAttribute('data-mode', 'major');
    gMajor.setAttribute('transform', `translate(${xOuter.toFixed(1)}, ${yOuter.toFixed(1)})`);

    const cMajor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cMajor.setAttribute('r', '8.5');

    const tMajor = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tMajor.textContent = pair.majorLabel;

    gMajor.appendChild(cMajor);
    gMajor.appendChild(tMajor);

    gMajor.addEventListener('click', () => {
      setKeyAndMode(pair.majorKey, 'majorPentatonic');
    });
    circleNodesGroup.appendChild(gMajor);

    // 2. Inner Ring Node: Relative Minor Key
    const gMinor = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMinor.setAttribute('class', 'circle-node node-minor');
    gMinor.setAttribute('data-key', pair.minorKey);
    gMinor.setAttribute('data-mode', 'minor');
    gMinor.setAttribute('transform', `translate(${xInner.toFixed(1)}, ${yInner.toFixed(1)})`);

    const cMinor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cMinor.setAttribute('r', '7.2');

    const tMinor = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tMinor.textContent = pair.minorLabel;

    gMinor.appendChild(cMinor);
    gMinor.appendChild(tMinor);

    gMinor.addEventListener('click', () => {
      setKeyAndMode(pair.minorKey, 'minorPentatonic');
    });
    circleNodesGroup.appendChild(gMinor);
  });

  updateCircleOfFifthsUI();
}

function setKeyAndMode(key: string, scaleMode: 'majorPentatonic' | 'minorPentatonic'): void {
  if (!ROOT_NOTES[key]) return;
  config.rootKey = key;
  config.scaleKey = scaleMode;

  if (rootSelect) rootSelect.value = key;
  if (scaleSelect) scaleSelect.value = scaleMode;

  updateTuning();
  updateCircleOfFifthsUI();

  const noteName = ROOT_NOTES[key].name;
  const isMinor = scaleMode === 'minorPentatonic';
  const labelSuffix = isMinor ? 'm (Relative Minor)' : ' (Major)';
  recordPlayedNote(
    {
      frequency: config.baseFrequency,
      midiNote: 69,
      midiVelocity: 100,
      brightness: 0.8,
      pentagonLevel: 0,
      edgeIndex: 0,
      timestamp: performance.now() / 1000,
      pan: 0,
    },
    `Tonic: ${noteName}${labelSuffix} • ${config.baseFrequency.toFixed(1)} Hz`,
  );
}

function toggleMajorMinorMode(): void {
  const currentKey = config.rootKey || DEFAULT_ROOT;
  const isMinor = config.scaleKey === 'minorPentatonic';

  if (isMinor) {
    const majorKey = getRelativeMajor(currentKey);
    setKeyAndMode(majorKey, 'majorPentatonic');
  } else {
    const minorKey = getRelativeMinor(currentKey);
    setKeyAndMode(minorKey, 'minorPentatonic');
  }
}

function setKey(key: string): void {
  const isMinor = config.scaleKey === 'minorPentatonic';
  setKeyAndMode(key, isMinor ? 'minorPentatonic' : 'majorPentatonic');
}

function stepCircleOfFifths(direction: 1 | -1): void {
  const current = config.rootKey || DEFAULT_ROOT;
  const nextKey = direction === 1 ? getNextFifth(current) : getPreviousFifth(current);
  setKey(nextKey);
}

function updateCircleOfFifthsUI(): void {
  const currentKey = config.rootKey || DEFAULT_ROOT;
  const isMinor = config.scaleKey === 'minorPentatonic';
  const rootNote = ROOT_NOTES[currentKey];
  const octaveNum = 4 + octaveShift;

  if (circleActiveKeyText && rootNote) {
    const modeLabel = isMinor ? 'm' : '';
    circleActiveKeyText.textContent = `${rootNote.name}${modeLabel}${octaveNum} (${config.baseFrequency.toFixed(0)}Hz)`;
  }

  if (circleActiveModeBadge) {
    circleActiveModeBadge.textContent = isMinor ? 'Relative Minor' : 'Major';
    circleActiveModeBadge.style.color = isMinor ? '#e0a0ff' : '#9be0ff';
    circleActiveModeBadge.style.background = isMinor ? 'rgba(215, 120, 255, 0.2)' : 'rgba(100, 200, 255, 0.2)';
  }

  // Update SVG node active classes
  const nodes = document.querySelectorAll('.circle-node');
  nodes.forEach(node => {
    const key = node.getAttribute('data-key');
    const mode = node.getAttribute('data-mode');
    const isNodeMinor = mode === 'minor';

    if (key === currentKey && isNodeMinor === isMinor) {
      node.classList.add('active-key');
    } else {
      node.classList.remove('active-key');
    }
  });
}

// ─── Octave Shift Functions ──────────────────────────────────────────────────

function shiftOctave(delta: number): void {
  octaveShift = Math.max(-3, Math.min(3, octaveShift + delta));
  updateTuning();
  updateCircleOfFifthsUI();

  const currentKey = config.rootKey || DEFAULT_ROOT;
  const rootNote = ROOT_NOTES[currentKey];
  const octaveNum = 4 + octaveShift;
  const label = `Octave: ${rootNote?.name ?? ''}${octaveNum} (${config.baseFrequency.toFixed(0)} Hz)`;
  lastNoteLabel = label;
  hudNote.textContent = lastNoteLabel;
}

// ─── Note Monitor ────────────────────────────────────────────────────────────

function recordPlayedNote(note: NoteEvent, customLabel?: string): void {
  const noteName = formatNoteWithOctave(note.frequency);
  const label = customLabel || `${noteName} (${note.frequency.toFixed(0)} Hz)`;
  lastNoteLabel = label;
  hudNote.textContent = lastNoteLabel;

  // Transmit over Standard MIDI OUT
  midiManager?.sendNoteOn(note.frequency, note.midiVelocity, config.noteDuration);

  // Trigger real-time key strike light on SWAM virtual keyboard
  const rawMidi = Math.round(69 + 12 * Math.log2(note.frequency / 440));
  let displayMidi = rawMidi;
  if (rangeConfig.enabled && rangeConfig.behavior !== 'mute') {
    displayMidi = foldFrequencyToRange(note.frequency, rangeConfig.minMidi, rangeConfig.maxMidi).midiNote;
  }
  rangeKeyboardVisualizer?.triggerKeyLight(displayMidi);

  const item: MonitoredNote = {
    id: `${Date.now()}-${Math.random()}`,
    name: noteName,
    freq: note.frequency,
    label,
    timestamp: performance.now(),
  };

  activeNotesQueue.unshift(item);
  if (activeNotesQueue.length > 8) {
    activeNotesQueue.pop();
  }
  updateNotesMonitor();
}

function updateNotesMonitor(): void {
  if (!activeNotesList) return;
  const now = performance.now();
  activeNotesQueue = activeNotesQueue.filter(n => now - n.timestamp < 4000);

  if (activeNotesQueue.length === 0) {
    activeNotesList.innerHTML = `<span style="font-size: 10px; color: rgba(200, 200, 255, 0.4);">Ready — press keys, click strings or chords</span>`;
    return;
  }

  activeNotesList.innerHTML = activeNotesQueue
    .map(
      n =>
        `<span class="note-badge">${n.name} <span class="note-freq">${n.freq.toFixed(0)}Hz</span></span>`,
    )
    .join('');
}

// ─── Interactive String Plucking ─────────────────────────────────────────────

function pluckAtCoordinates(clientX: number, clientY: number, velocity = 100): boolean {
  if (!canvasRenderer || !audioRenderer?.initialized) return false;

  const rect = canvas.getBoundingClientRect();
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;

  const hit = canvasRenderer.findNearestEdge(canvasX, canvasY, pentagons, 20);
  if (hit) {
    const key = `${hit.pentagon.level}-${hit.edge.index}`;
    if (key === lastPluckedKey) return false;
    lastPluckedKey = key;

    const note = audioRenderer.triggerManualNote(
      hit.edge,
      hit.pentagon.level,
      hit.param,
      velocity,
      hit.pentagon.edges.length,
    );

    if (note) {
      canvasRenderer.addManualFlash(hit.point, hit.pentagon.level, hit.edge.index);
      recordPlayedNote(note, `${hit.edge.label} • Ring ${hit.pentagon.level}`);
      return true;
    }
  }
  return false;
}

// ─── Interactive String & Melody Plucking ───────────────────────────────────

// ─── Interactive String & Melody Plucking ───────────────────────────────────

function pluckRingEdge(level: number, edgeIndex: number, velocity = 110): void {
  const pent = pentagons[level];
  if (!pent) return;
  const count = pent.edges.length;
  const edge = pent.edges[edgeIndex % count];
  if (!edge) return;

  const note = audioRenderer?.triggerManualNote(edge, level, 0.5, velocity, count);
  if (note && canvasRenderer) {
    const impactPoint = {
      x: (edge.p1.x + edge.p2.x) / 2,
      y: (edge.p1.y + edge.p2.y) / 2,
    };
    canvasRenderer.addManualFlash(impactPoint, level, edge.index);
    recordPlayedNote(note, `Melody: ${edge.label} • Ring ${level}`);
  }
}

function startHeldMelody(key: string, level: number, edgeIndex: number, velocity = 115): void {
  const pent = pentagons[level];
  if (!pent) return;
  const count = pent.edges.length;
  const edge = pent.edges[edgeIndex % count];
  if (!edge) return;

  const keyId = `melody-${key}`;
  const note = audioRenderer?.startKeyNote(keyId, edge, level, 0.5, velocity, count);
  if (note && canvasRenderer) {
    const impactPoint = {
      x: (edge.p1.x + edge.p2.x) / 2,
      y: (edge.p1.y + edge.p2.y) / 2,
    };
    canvasRenderer.addManualFlash(impactPoint, level, edge.index);
    recordPlayedNote(note, `Melody: ${edge.label} • Ring ${level}`);
  }
}

function stopHeldMelody(key: string): void {
  const keyId = `melody-${key}`;
  audioRenderer?.stopKeyNote(keyId);
}

// ─── Chord Engine UI Binding & Execution (Sustained & Instant) ────────────────

function startHeldChord(chordId: string, triggerKey: string): void {
  if (!audioRenderer?.initialized) return;

  const strumMode = (strumStyleSelect?.value || 'fast-strum') as StrumMode;
  const ringVal = chordRingSelect?.value || 'all';
  const targetRing = ringVal === 'all' ? 'all' : parseInt(ringVal);

  const chordDef = CHORD_PRESETS.find(c => c.id === chordId) || CHORD_PRESETS[0];
  let targets = chordDef.getVoicing(pentagons, targetRing);
  if (targets.length === 0) return;

  if (strumMode === 'down-strum') {
    targets = [...targets].reverse();
  }

  const keyId = `chord-${chordId}-${triggerKey}`;
  const delayMs = strumMode === 'block' ? 0 : 25; // Block or fast roll

  targets.forEach((target, idx) => {
    const playNote = () => {
      const pent = pentagons[target.level];
      if (!pent) return;
      const edge = pent.edges[target.edgeIndex];
      if (!edge) return;

      const velocity = Math.min(127, Math.max(1, 105 + (Math.random() * 8 - 4)));
      const note = audioRenderer?.startKeyNote(keyId, edge, target.level, target.param, velocity, pent.edges.length);

      if (note && canvasRenderer) {
        const impactPoint = {
          x: edge.p1.x + target.param * (edge.p2.x - edge.p1.x),
          y: edge.p1.y + target.param * (edge.p2.y - edge.p1.y),
        };
        canvasRenderer.addManualFlash(impactPoint, target.level, edge.index);
      }

      if (note) {
        recordPlayedNote(note, `${chordDef.name}: ${formatNoteWithOctave(note.frequency)}`);
      }
    };

    if (delayMs === 0 || idx === 0) {
      playNote();
    } else {
      setTimeout(playNote, idx * delayMs);
    }
  });

  // Highlight matching chord card visually while held down
  const btns = document.querySelectorAll<HTMLElement>('.chord-btn');
  btns.forEach(b => {
    if (b.getAttribute('data-chord-id') === chordId) {
      b.classList.add('active');
    }
  });
}

function stopHeldChord(chordId: string, triggerKey: string): void {
  const keyId = `chord-${chordId}-${triggerKey}`;
  audioRenderer?.stopKeyNote(keyId);

  // Un-highlight matching chord card
  const btns = document.querySelectorAll<HTMLElement>('.chord-btn');
  btns.forEach(b => {
    if (b.getAttribute('data-chord-id') === chordId) {
      b.classList.remove('active');
    }
  });
}

function executeChordById(chordId: string): void {
  startHeldChord(chordId, 'one-shot');
  setTimeout(() => stopHeldChord(chordId, 'one-shot'), 1800);
}

function createChordCard(chord: ChordDefinition, targetRing: number | 'all'): HTMLElement {
  const card = document.createElement('div');
  card.className = 'chord-btn';
  card.setAttribute('data-chord-id', chord.id);

  const hotkeyHtml = chord.hotkey ? `<span class="hotkey-badge">[${chord.hotkey}]</span>` : '';
  const notesBreakdown = getChordNoteBreakdown(chord, pentagons, targetRing);

  const chipsHtml = notesBreakdown
    .map(n => {
      const microClass = n.isMicrotonal ? 'koron-chip' : '';
      return `
        <span class="note-chip ${microClass}" data-ring="${n.ring}" data-edge="${n.edgeIndex}" title="Ring ${n.ring} • String ${n.edgeIndex} • Click to pluck note">
          <strong>${n.noteName}${n.octave}</strong>
          <span class="chip-freq">${n.frequency.toFixed(0)}Hz</span>
          <span class="chip-piano">${n.pianoKey} ${n.centsLabel}</span>
        </span>
      `;
    })
    .join('');

  card.innerHTML = `
    <div class="chord-btn-title">${hotkeyHtml}▶ ${chord.name}</div>
    <div class="chord-btn-desc">${chord.description}</div>
    <div class="chord-notes-row">${chipsHtml}</div>
  `;

  // Clicking on individual note chip plucks that single note
  const chips = card.querySelectorAll<HTMLSpanElement>('.note-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const ring = parseInt(chip.getAttribute('data-ring') || '0');
      const edge = parseInt(chip.getAttribute('data-edge') || '0');
      pluckRingEdge(ring, edge, 115);
    });
  });

  // Clicking anywhere else on the card executes the full chord
  card.addEventListener('click', () => {
    executeChordById(chord.id);
  });

  return card;
}

function initChordButtons(): void {
  if (!chordButtonsContainer) return;
  chordButtonsContainer.innerHTML = '';

  const targetRingVal = chordRingSelect?.value || 'all';
  const targetRing = targetRingVal === 'all' ? 'all' : parseInt(targetRingVal);

  // 1. Accordion Degree Harmony Section (Left Hand)
  const accordionHeader = document.createElement('div');
  accordionHeader.className = 'chord-section-header';
  accordionHeader.innerHTML = `<span>ACCORDION HARMONY (آکورد درجات گام)</span><span>[A-J]</span>`;
  chordButtonsContainer.appendChild(accordionHeader);

  ACCORDION_DEGREE_CHORDS.forEach(chord => {
    chordButtonsContainer.appendChild(createChordCard(chord, targetRing));
  });

  // 2. Geometric & Cosmic Voicings Section
  const geometricHeader = document.createElement('div');
  geometricHeader.className = 'chord-section-header';
  geometricHeader.innerHTML = `<span>GEOMETRIC VOICINGS (آکوردهای هندسی)</span><span>[Q-O]</span>`;
  chordButtonsContainer.appendChild(geometricHeader);

  GEOMETRIC_CHORD_PRESETS.forEach(chord => {
    chordButtonsContainer.appendChild(createChordCard(chord, targetRing));
  });
}

// ─── Keyboard Hotkeys (Accordion Dual-Tier: Sustained Chords + Singing Melody) ──

function setupKeyboardListeners(): void {
  const activeHeldKeys = new Set<string>();

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Prevent machine-gun OS auto-repeat stutter
    if (e.repeat) return;

    // Ignore events if user is focused inside a select dropdown or input
    if (
      document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'SELECT'
    ) {
      return;
    }

    const key = e.key;
    if (activeHeldKeys.has(key.toLowerCase())) return;
    activeHeldKeys.add(key.toLowerCase());

    // 1. Octave Controls
    if (key === 'z' || key === 'Z') {
      e.preventDefault();
      shiftOctave(-1);
      return;
    }
    if (key === 'x' || key === 'X') {
      e.preventDefault();
      shiftOctave(+1);
      return;
    }
    if (key === 'o' || key === 'O') {
      e.preventDefault();
      executeChordById('radial-root-cascade');
      return;
    }

    // 2. Circle of Fifths Modulations
    if (key === '[' || key === 'ArrowLeft') {
      e.preventDefault();
      stepCircleOfFifths(-1); // Counter-clockwise (Fourth)
      return;
    }
    if (key === ']' || key === 'ArrowRight') {
      e.preventDefault();
      stepCircleOfFifths(+1); // Clockwise (Fifth)
      return;
    }
    if (key === 'm' || key === 'M') {
      e.preventDefault();
      toggleMajorMinorMode(); // Toggle between Major (outer) and Relative Minor (inner)
      return;
    }

    // 3. Accordion Right-Hand Melody Strings (Keys 1 - 7 without shift/ctrl/alt)
    // Melody plays in the singing soprano/alto register, floating over the bass/chords!
    if (key >= '1' && key <= '7' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const stringIdx = parseInt(key) - 1;
      const defaultMelodyRing = pentagons.length >= 6
        ? Math.floor(pentagons.length * 0.42)
        : Math.min(2, Math.max(0, pentagons.length - 1));
      const targetRing = chordRingSelect?.value === 'all'
        ? defaultMelodyRing
        : parseInt(chordRingSelect?.value || String(defaultMelodyRing));

      startHeldMelody(key, targetRing, stringIdx, 115);
      return;
    }

    // 4. Ring Selection via Shift + 1-9 (or 0 for all)
    if (e.shiftKey && key >= '1' && key <= '9') {
      e.preventDefault();
      const ringIndex = parseInt(key) - 1;
      if (ringIndex < pentagons.length && chordRingSelect) {
        chordRingSelect.value = String(ringIndex);
        lastNoteLabel = `Selected Ring: ${ringIndex}`;
        hudNote.textContent = lastNoteLabel;
        initChordButtons();
      }
      return;
    }
    if ((e.shiftKey && key === '0') || key === '0') {
      e.preventDefault();
      if (chordRingSelect) {
        chordRingSelect.value = 'all';
        lastNoteLabel = 'Selected: All Rings';
        hudNote.textContent = lastNoteLabel;
        initChordButtons();
      }
      return;
    }

    // 5. Strum / Spacebar
    if (key === ' ') {
      e.preventDefault();
      executeChordById('pentachord-cluster');
      return;
    }

    // 6. Accordion Left-Hand Chords (A-J) & Geometric Chords (Q-I)
    // Sustains rich harmony as long as the key is held down!
    const chord = findChordByHotkey(key);
    if (chord) {
      e.preventDefault();
      startHeldChord(chord.id, key);

      // Launch targeted impulse to excite the physical polygon geometry soundboard
      const edgeIdx = ['a', 's', 'd', 'f', 'g', 'h', 'j'].indexOf(key.toLowerCase());
      if (edgeIdx >= 0 && pentagons[0]) {
        physicsEngine?.launchTargetedImpulse(0, edgeIdx % pentagons[0].edges.length, 480, 0.5);
        document.querySelector(`.acc-btn[data-key="${key.toLowerCase()}"]`)?.classList.add('active');
      }
      return;
    }
  });

  // KeyUp handler: Smoothly release held chords and melody notes
  window.addEventListener('keyup', (e: KeyboardEvent) => {
    const key = e.key;
    activeHeldKeys.delete(key.toLowerCase());

    // Release melody note
    if (key >= '1' && key <= '7') {
      stopHeldMelody(key);
      return;
    }

    // Release chord
    const chord = findChordByHotkey(key);
    if (chord) {
      stopHeldChord(chord.id, key);
      document.querySelector(`.acc-btn[data-key="${key.toLowerCase()}"]`)?.classList.remove('active');
      return;
    }
  });
}

// ─── Main Animation Loop ─────────────────────────────────────────────────────

function mainLoop(timestamp: number): void {
  if (!running) return;

  frameCount++;
  if (timestamp - fpsTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    fpsTime = timestamp;
  }

  if (!paused) {
    const dt = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.05) : 0;
    lastFrameTime = timestamp;

    if (config.ballEnabled && physicsEngine.particles.length > 0) {
      physicsAccumulator += dt;
      const allEvents: CollisionEvent[] = [];

      while (physicsAccumulator >= config.physicsTick) {
        const events = physicsEngine.step(config.physicsTick);
        allEvents.push(...events);
        physicsAccumulator -= config.physicsTick;
      }

      if (allEvents.length > 0) {
        totalBounces += allEvents.length;
        const notes = audioRenderer.processCollisions(allEvents);
        if (notes.length > 0) {
          const last = notes[notes.length - 1];
          const edgeLabel = pentagons[last.pentagonLevel]?.edges[last.edgeIndex]?.label ?? '?';
          recordPlayedNote(last, `${edgeLabel} (Ring ${last.pentagonLevel})`);
        }

        for (const event of allEvents) {
          canvasRenderer.addFlash(event);
        }
      }
    } else {
      physicsAccumulator = 0;
    }
  } else {
    lastFrameTime = timestamp;
  }

  // Render canvas
  canvasRenderer.draw(
    pentagons,
    physicsEngine.particles,
    audioRenderer.activeVoices,
  );

  // Update HUD
  hudVoices.textContent = String(audioRenderer.activeVoices);
  hudBall.textContent = config.ballEnabled ? 'Active' : 'Removed (Acoustic)';
  hudTime.textContent = physicsEngine.time.toFixed(2);
  hudBounces.textContent = String(totalBounces);
  hudFps.textContent = String(fps);

  requestAnimationFrame(mainLoop);
}

// ─── Left Hand Accordion & Modal Drone Performance Console ──────────────────

function initAccordionConsole(): void {
  const accBtns = document.querySelectorAll<HTMLElement>('.acc-btn');
  accBtns.forEach(btn => {
    const key = btn.getAttribute('data-key');
    if (!key) return;

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('active');
      const chord = findChordByHotkey(key);
      if (chord) {
        startHeldChord(chord.id, key);
        const edgeIdx = ['a', 's', 'd', 'f', 'g', 'h', 'j'].indexOf(key);
        if (edgeIdx >= 0 && pentagons[0]) {
          physicsEngine?.launchTargetedImpulse(0, edgeIdx % pentagons[0].edges.length, 480, 0.5);
        }
      }
    });

    const release = () => {
      btn.classList.remove('active');
      const chord = findChordByHotkey(key);
      if (chord) {
        stopHeldChord(chord.id, key);
      }
    };

    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
  });
}

function initDroneControls(): void {
  const droneToggleBtn = document.getElementById('drone-toggle-btn') as HTMLButtonElement | null;
  const droneVolumeSlider = document.getElementById('drone-volume') as HTMLInputElement | null;

  droneToggleBtn?.addEventListener('click', () => {
    if (!audioRenderer) return;
    if (audioRenderer.isDroneActive) {
      audioRenderer.stopDrone(0.5);
      droneToggleBtn.textContent = '🎵 DRONE: OFF';
      droneToggleBtn.classList.remove('active');
    } else {
      audioRenderer.startDrone(config.scaleKey || 'shur', config.baseFrequency / 2);
      droneToggleBtn.textContent = '🎵 DRONE: ON';
      droneToggleBtn.classList.add('active');
    }
  });

  droneVolumeSlider?.addEventListener('input', () => {
    audioRenderer?.setDroneVolume(parseFloat(droneVolumeSlider.value));
  });
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

startBtn.addEventListener('click', async () => {
  config.nestingLevels = parseInt(levelsSelect.value);
  config.scalingFactor = parseFloat(scalingSelect.value);
  config.rootKey = rootSelect.value;
  config.scaleKey = scaleSelect.value;
  config.timbreKey = timbreSelect?.value || 'swamCello';
  config.reverbMix = reverbSlider ? parseFloat(reverbSlider.value) : 0.38;
  config.noteDuration = decaySlider ? parseFloat(decaySlider.value) : 1.8;

  // Initialize audio
  audioRenderer = new AudioRenderer();
  await audioRenderer.init(
    config.maxVoices,
    config.minIOI,
    config.noteDuration,
    config.reverbMix,
    config.timbreKey,
  );

  // Initialize canvas
  canvasRenderer = new CanvasRenderer(canvas);

  // Build geometry, physics, chord UI, Accordion Console & Circle of Fifths
  initGeometry();
  initPhysics();
  initChordButtons();
  initAccordionConsole();
  initDroneControls();
  initCircleOfFifthsDial();
  initRangeControls();
  setupKeyboardListeners();

  // Initialize Web MIDI API
  await initMidi();

  // Hide overlay
  startOverlay.classList.add('hidden');

  // Start loop
  running = true;
  lastFrameTime = 0;
  fpsTime = performance.now();
  requestAnimationFrame(mainLoop);
});

// Ball Toggle
ballToggleBtn.addEventListener('click', () => {
  config.ballEnabled = !config.ballEnabled;

  if (config.ballEnabled) {
    spawnParticle();
    ballToggleBtn.textContent = '⚽ BALL: ON';
    ballToggleBtn.classList.remove('btn-warn');
  } else {
    physicsEngine.particles = [];
    ballToggleBtn.textContent = '🚫 BALL: OFF';
    ballToggleBtn.classList.add('btn-warn');
  }
});

resetBtn.addEventListener('click', () => {
  resetSimulation();
});

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'RESUME' : 'PAUSE';
  pauseBtn.classList.toggle('active', paused);
  if (paused) {
    audioRenderer.stopAll();
  }
});

// Circle of Fifths Modulation Buttons
fifthPrevBtn?.addEventListener('click', () => stepCircleOfFifths(-1));
fifthNextBtn?.addEventListener('click', () => stepCircleOfFifths(+1));
circleModeToggleBtn?.addEventListener('click', () => toggleMajorMinorMode());

// Octave Control Buttons
octaveDownBtn?.addEventListener('click', () => shiftOctave(-1));
octaveUpBtn?.addEventListener('click', () => shiftOctave(+1));
octaveCascadeBtn?.addEventListener('click', () => executeChordById('radial-root-cascade'));

rootSelect.addEventListener('change', () => {
  setKey(rootSelect.value);
});

scaleSelect.addEventListener('change', () => {
  config.scaleKey = scaleSelect.value;
  updateTuning();
});

timbreSelect?.addEventListener('change', () => {
  config.timbreKey = timbreSelect.value;
  audioRenderer?.setInstrumentPreset(timbreSelect.value);
});

reverbSlider?.addEventListener('input', () => {
  const val = parseFloat(reverbSlider.value);
  config.reverbMix = val;
  audioRenderer?.setReverbMix(val);
});

decaySlider?.addEventListener('input', () => {
  const val = parseFloat(decaySlider.value);
  config.noteDuration = val;
  audioRenderer?.setNoteDuration(val);
});

// MIDI Control Event Listeners
const midiModeSelect = document.getElementById('midi-mode-select') as HTMLSelectElement | null;
midiModeSelect?.addEventListener('change', () => {
  const isMpe = midiModeSelect.value === 'mpe';
  midiManager?.setMpeEnabled(isMpe);
  if (isMpe) {
    midiManager?.sendMpeRPN();
  }
});

midiInSelect?.addEventListener('change', () => {
  midiManager?.setInput(midiInSelect.value);
});

midiOutSelect?.addEventListener('change', () => {
  midiManager?.setOutput(midiOutSelect.value);
});

midiChannelSelect?.addEventListener('change', () => {
  midiManager?.setChannel(parseInt(midiChannelSelect.value));
});

midiPitchbendSelect?.addEventListener('change', () => {
  midiManager?.setPitchBendEnabled(midiPitchbendSelect.value === 'true');
});

midiPanicBtn?.addEventListener('click', () => {
  midiManager?.panic();
  audioRenderer?.stopAll();
});

levelsSelect.addEventListener('change', () => {
  config.nestingLevels = parseInt(levelsSelect.value);
  initGeometry();
  physicsEngine.setPentagons(pentagons);
  if (config.ballEnabled && physicsEngine.particles.length === 0) {
    spawnParticle();
  }
});

scalingSelect.addEventListener('change', () => {
  config.scalingFactor = parseFloat(scalingSelect.value);
  initGeometry();
  physicsEngine.setPentagons(pentagons);
});

volumeSlider.addEventListener('input', () => {
  audioRenderer?.setVolume(parseFloat(volumeSlider.value));
});

chordRingSelect?.addEventListener('change', () => {
  initChordButtons();
});

strumStyleSelect?.addEventListener('change', () => {
  initChordButtons();
});

voiceLeadingToggleBtn?.addEventListener('click', () => {
  voiceLeadingEnabled = !voiceLeadingEnabled;
  if (voiceLeadingToggleBtn) {
    if (voiceLeadingEnabled) {
      voiceLeadingToggleBtn.classList.add('enabled');
    } else {
      voiceLeadingToggleBtn.classList.remove('enabled');
    }
  }
  if (voiceLeadingStatus) {
    voiceLeadingStatus.textContent = voiceLeadingEnabled ? 'SMOOTH: ON' : 'FIXED: OFF';
  }
});

// ─── Canvas String Plucking Interactions ─────────────────────────────────────

canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  if (!running) return;
  lastPluckedKey = null;
  pluckAtCoordinates(e.clientX, e.clientY, 110);
});

canvas.addEventListener('pointermove', (e: PointerEvent) => {
  if (!canvasRenderer || !running) return;

  const rect = canvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;

  const hit = canvasRenderer.findNearestEdge(canvasX, canvasY, pentagons, 20);

  if (hit) {
    canvasRenderer.hoveredEdge = {
      pentagonLevel: hit.pentagon.level,
      edgeIndex: hit.edge.index,
    };
    canvas.style.cursor = 'pointer';
  } else {
    canvasRenderer.hoveredEdge = null;
    canvas.style.cursor = 'crosshair';
    lastPluckedKey = null;
  }

  if (e.buttons === 1) {
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    const speed = Math.min(1.0, Math.hypot(dx, dy) / 20);

    if (hit && speed > 0.04) {
      // Direct acoustic bowing of the string/edge
      const force = 0.5 + 0.4 * (1 - hit.param);
      const contactPoint = 0.05 + 0.25 * hit.param;
      audioRenderer?.startBowing(hit.edge.frequency, speed, force, contactPoint, (hit.edge.index / 2) - 1);
      canvasRenderer.addBowTrailPoint(canvasX, canvasY, speed, force);
    } else {
      pluckAtCoordinates(e.clientX, e.clientY, 95);
    }
  }
});

canvas.addEventListener('pointerup', () => {
  lastPluckedKey = null;
  audioRenderer?.stopBowing();
  canvasRenderer?.clearBowTrail();
});

canvas.addEventListener('pointerleave', () => {
  if (canvasRenderer) {
    canvasRenderer.hoveredEdge = null;
  }
  lastPluckedKey = null;
  audioRenderer?.stopBowing();
  canvasRenderer?.clearBowTrail();
});

window.addEventListener('resize', () => {
  if (canvasRenderer) {
    canvasRenderer.resize();
    if (running && !paused) {
      initGeometry();
      physicsEngine.setPentagons(pentagons);
    }
  }
});

// Initial UI renders on load (only Circle of Fifths dial, not range controls
// which are initialized inside the start handler to avoid duplicate event listeners)
initCircleOfFifthsDial();
