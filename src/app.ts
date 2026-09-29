/**
 * app.ts — Version 2 Master Orchestrator for Geometric Musical Instrument
 *
 * Implements REBUILD_SPEC_V2.md:
 * - 4-Layer Architecture:
 *     Layer A: PentagonModel (strictly 5 sides per ring)
 *     Layer B: PointerController (tap/pluck/swipe/bow) & ExcitationEngine (bounce/orbit/rain/pulse/swarm)
 *     Layer C: PitchMapper -> MusicalGate (HarmonicContext, DensityGovernor, PhraseEngine, MotifMemory, VoiceLeading, MusicalFreedom)
 *     Layer D: AudioEngineV2 (MasterLimiter, KarplusStrong physical synthesis, VoiceManager, AudioScheduler) + MidiManager + InstrumentView
 * - 3-Tier UX: PLAY | GENERATE | LAB
 * - Single Canonical Pipeline: GeometricEvent -> CandidateMusicalIntent -> MusicalGate -> MusicalEvent -> Rendering
 */

import { ProjectStore, type ViewMode, type ExcitationMode } from './domain/project-state';
import { buildConcentricPentagons, type PentagonRing } from './geometry/PentagonModel';
import { PitchMapper } from './mapping/PitchMapper';
import { HarmonicContext, BUILTIN_SCALES } from './music/HarmonicContext';
import { MusicalGate } from './music/MusicalGate';
import { AudioEngineV2 } from './audio/AudioEngineV2';
import { PointerController } from './interaction/PointerController';
import { ExcitationEngine } from './physics/ExcitationEngine';
import { InstrumentView } from './visualization/InstrumentView';
import { MidiManager } from './midi/midi-manager';
import { ModeManager } from './ui/ModeManager';
import { LabPanel } from './ui/LabPanel';
import type { GeometricEvent, MusicalEvent } from './domain/events';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHROMATIC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function formatNoteWithOctave(frequency: number): string {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const note = CHROMATIC_NAMES[(midi % 12 + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

// ─── Application State & Instances ───────────────────────────────────────────

const store = new ProjectStore();
let pentagonRings: PentagonRing[] = [];

let harmonicContext: HarmonicContext;
let musicalGate: MusicalGate;
let audioEngine: AudioEngineV2;
let pointerController: PointerController;
let excitationEngine: ExcitationEngine;
let instrumentView: InstrumentView;
let midiManager: MidiManager;
let modeManager: ModeManager;
let labPanel: LabPanel;

let isPaused = false;
let lastFrameTime = performance.now();
let lastPlayedNoteLabel = '—';

// DOM Elements
let canvas: HTMLCanvasElement;
let startOverlay: HTMLElement | null;
let startBtn: HTMLElement | null;
let rootSelect: HTMLSelectElement | null;
let scaleSelect: HTMLSelectElement | null;
let motionSelect: HTMLSelectElement | null;
let energySlider: HTMLInputElement | null;
let complexitySlider: HTMLInputElement | null;
let freedomSlider: HTMLInputElement | null;
let volumeSlider: HTMLInputElement | null;
let droneBtn: HTMLElement | null;
let droneVolumeSlider: HTMLInputElement | null;
let ballBtn: HTMLElement | null;
let resetBtn: HTMLElement | null;
let pauseBtn: HTMLElement | null;
let levelsSelect: HTMLSelectElement | null;
let hudNote: HTMLElement | null;
let hudVoices: HTMLElement | null;
let hudBounces: HTMLElement | null;
let activeNotesList: HTMLElement | null;

// ─── Canonical Event Pipeline Dispatcher ──────────────────────────────────────

function handleGeometricEvent(geoEvent: GeometricEvent): void {
  const state = store.getState();
  const scaleContext = harmonicContext.toScaleContext();

  // 1. Map 5 physical sides to CandidateMusicalIntent
  const candidate = PitchMapper.mapToCandidate(
    geoEvent,
    scaleContext,
    state.harmony.scaleId.includes('chord') ? 'chordTone' : 'scaleDegree',
    state.geometry.ringStrategy,
    pentagonRings.length,
  );

  // 2. Filter & Shape through Layer C Musical Intelligence
  const currentAudioTime = audioEngine.currentAudioTime;
  const activeVoices = audioEngine.isInitialized ? [] : [];
  const musicalEvent = musicalGate.process(candidate, activeVoices, currentAudioTime);

  // 3. Render through Layer D (Audio, MIDI, Visuals)
  if (musicalEvent) {
    if (audioEngine.isInitialized) {
      audioEngine.scheduleEvent(musicalEvent);
    }

    if (midiManager.supported) {
      midiManager.handleMusicalEvent(musicalEvent);
    }

    // Trigger visual string vibration & flash
    instrumentView.triggerNoteVisual(
      geoEvent.ringIndex,
      geoEvent.sideIndex,
      geoEvent.normalizedPosition,
      musicalEvent.role,
      musicalEvent.velocity,
    );

    recordNoteDisplay(musicalEvent);
  }
}

function recordNoteDisplay(event: MusicalEvent): void {
  const noteName = formatNoteWithOctave(event.pitchHz);
  lastPlayedNoteLabel = `${noteName} (${event.pitchHz.toFixed(1)} Hz) [${event.role}]`;
  if (hudNote) {
    hudNote.textContent = lastPlayedNoteLabel;
  }

  if (activeNotesList) {
    const badge = document.createElement('span');
    badge.className = 'note-badge';
    badge.innerHTML = `${noteName} <span class="note-freq">${event.pitchHz.toFixed(0)}Hz</span>`;
    activeNotesList.prepend(badge);

    while (activeNotesList.children.length > 8) {
      activeNotesList.lastElementChild?.remove();
    }
  }
}

// ─── Geometry Setup ──────────────────────────────────────────────────────────

function rebuildGeometry(): void {
  const rect = canvas.getBoundingClientRect();
  const baseRadius = Math.min(rect.width, rect.height) * 0.44;
  const nestingLevels = store.getState().geometry.nestingLevels;

  pentagonRings = buildConcentricPentagons(baseRadius, nestingLevels, 0.88);

  instrumentView.setGeometry(pentagonRings);
  pointerController.setGeometry(pentagonRings, instrumentView.centerX, instrumentView.centerY);
  excitationEngine.setGeometry(pentagonRings as any);
}

// ─── Animation Loop ──────────────────────────────────────────────────────────

function animationLoop(timestamp: number): void {
  requestAnimationFrame(animationLoop);

  const dt = Math.min(0.1, (timestamp - lastFrameTime) / 1000);
  lastFrameTime = timestamp;

  if (!isPaused) {
    const audioTime = audioEngine.currentAudioTime;

    // Advance excitation physics
    excitationEngine.update(dt, audioTime);

    // Update phrase breathing state
    const phrase = musicalGate.getPhraseEngine().getContext(audioTime);
    instrumentView.setPhraseStatus(phrase.phase, phrase.phraseProgress);
  }

  // Render High-DPI Canvas
  const activeCount = audioEngine.isInitialized ? audioEngine.getActiveVoiceCount() : 0;
  instrumentView.render(excitationEngine.particles, activeCount);

  if (hudVoices) {
    hudVoices.textContent = `${activeCount}`;
  }
}

// ─── Initialization ──────────────────────────────────────────────────────────

async function init(): Promise<void> {
  canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) return;

  // 1. Initialize Domain & Subsystems
  harmonicContext = new HarmonicContext('D4', 'shur');
  musicalGate = new MusicalGate(harmonicContext, {
    musicalFreedom: 65,
    phraseDurationSeconds: 4.0,
    energy: 50,
    complexity: 50,
  });

  audioEngine = new AudioEngineV2();
  instrumentView = new InstrumentView(canvas);
  midiManager = new MidiManager();
  modeManager = new ModeManager(store);

  pointerController = new PointerController(canvas, handleGeometricEvent);
  excitationEngine = new ExcitationEngine(handleGeometricEvent);

  rebuildGeometry();
  window.addEventListener('resize', () => rebuildGeometry());

  // 2. Initialize UI Components
  setupDomReferences();
  setupEventListeners();

  // Lab Panel
  const labContainer = document.getElementById('lab-container');
  if (labContainer) {
    labPanel = new LabPanel(
      labContainer,
      harmonicContext,
      (musicalGate as any).voiceLeading,
      (desc, count) => {
        if (scaleSelect) {
          scaleSelect.value = 'custom';
        }
      },
    );
  }

  // 3. Start Animation Loop
  requestAnimationFrame(animationLoop);
}

function setupDomReferences(): void {
  startOverlay = document.getElementById('start-overlay');
  startBtn = document.getElementById('start-btn');
  rootSelect = document.getElementById('root-select') as HTMLSelectElement;
  scaleSelect = document.getElementById('scale-select') as HTMLSelectElement;
  motionSelect = document.getElementById('motion-select') as HTMLSelectElement;
  energySlider = document.getElementById('energy-slider') as HTMLInputElement;
  complexitySlider = document.getElementById('complexity-slider') as HTMLInputElement;
  freedomSlider = document.getElementById('freedom-slider') as HTMLInputElement;
  volumeSlider = document.getElementById('volume') as HTMLInputElement;
  droneBtn = document.getElementById('drone-toggle-btn');
  droneVolumeSlider = document.getElementById('drone-volume') as HTMLInputElement;
  ballBtn = document.getElementById('ball-toggle-btn');
  resetBtn = document.getElementById('reset-btn');
  pauseBtn = document.getElementById('pause-btn');
  levelsSelect = document.getElementById('levels') as HTMLSelectElement;
  hudNote = document.getElementById('hud-note');
  hudVoices = document.getElementById('hud-voices');
  hudBounces = document.getElementById('hud-bounces');
  activeNotesList = document.getElementById('active-notes-list');
}

function setupEventListeners(): void {
  // Start button (unlock AudioContext on user gesture)
  startBtn?.addEventListener('click', async () => {
    await audioEngine.init();
    if (midiManager.supported) {
      await midiManager.init();
    }
    if (startOverlay) {
      startOverlay.classList.add('hidden');
    }
  });

  // Mode Tabs (PLAY | GENERATE | LAB)
  document.querySelectorAll('.mode-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode') as ViewMode;
      if (mode) {
        modeManager.setMode(mode);
      }
    });
  });

  // Root Key Selector
  rootSelect?.addEventListener('change', () => {
    const root = rootSelect?.value || 'D';
    harmonicContext.setRoot(`${root}4`);
  });

  // Mood / Scale Selector
  scaleSelect?.addEventListener('change', () => {
    const scale = scaleSelect?.value || 'shur';
    harmonicContext.setScale(scale);
  });

  // Motion / Excitation Mode Selector
  motionSelect?.addEventListener('change', () => {
    const mode = (motionSelect?.value || 'bounce') as ExcitationMode;
    excitationEngine.setMode(mode);
    instrumentView.setExcitationMode(mode);
  });

  // Energy & Complexity Sliders
  energySlider?.addEventListener('input', () => {
    const energy = parseFloat(energySlider?.value || '50');
    musicalGate.updateConfig({ energy });
    excitationEngine.setParameters(energy * 3, 0.985);
  });

  complexitySlider?.addEventListener('input', () => {
    const complexity = parseFloat(complexitySlider?.value || '50');
    musicalGate.updateConfig({ complexity });
  });

  // Musical Freedom Slider
  freedomSlider?.addEventListener('input', () => {
    const freedom = parseFloat(freedomSlider?.value || '65');
    musicalGate.updateConfig({ musicalFreedom: freedom });
  });

  // Master Volume
  volumeSlider?.addEventListener('input', () => {
    const vol = parseFloat(volumeSlider?.value || '0.7');
    audioEngine.setMasterVolume(vol);
  });

  // Rings / Levels Selector
  levelsSelect?.addEventListener('change', () => {
    const levels = parseInt(levelsSelect?.value || '6', 10);
    store.update((s) => {
      s.geometry.nestingLevels = levels;
    });
    rebuildGeometry();
  });

  // Pause / Resume
  pauseBtn?.addEventListener('click', () => {
    isPaused = !isPaused;
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? 'RESUME' : 'PAUSE';
      pauseBtn.classList.toggle('active', isPaused);
    }
  });

  // Reset
  resetBtn?.addEventListener('click', () => {
    audioEngine.stopAll();
    musicalGate.reset();
    excitationEngine.resetParticles();
    if (activeNotesList) activeNotesList.innerHTML = '';
  });

  // Left-Hand Accordion & Modal Drone Performance Console
  setupAccordionConsole();
}

function setupAccordionConsole(): void {
  const consoleGrid = document.getElementById('accordion-console-grid');
  if (!consoleGrid) return;

  const accordions = [
    { key: 'a', ratio: 1.0, role: 'stable' as const },      // Tonic
    { key: 's', ratio: 4 / 3, role: 'passing' as const },    // Subdominant 4th
    { key: 'd', ratio: 3 / 2, role: 'stable' as const },     // Dominant 5th
    { key: 'f', ratio: 12 / 11, role: 'tension' as const },  // Koron 2nd (Shahid)
    { key: 'g', ratio: 6 / 5, role: 'passing' as const },    // Neutral 3rd
    { key: 'h', ratio: 18 / 11, role: 'tension' as const },  // Koron 6th
    { key: 'j', ratio: 0.5, role: 'stable' as const },       // Deep Bass
  ];

  accordions.forEach(acc => {
    const btn = consoleGrid.querySelector(`[data-key="${acc.key}"]`);
    if (!btn) return;

    btn.addEventListener('pointerdown', () => {
      triggerModalChord(acc.ratio, acc.role);
      btn.classList.add('active');
    });

    const release = () => btn.classList.remove('active');
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
  });

  // Keyboard Hotkeys
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const match = accordions.find(a => a.key === e.key.toLowerCase());
    if (match) {
      triggerModalChord(match.ratio, match.role);
      const btn = consoleGrid.querySelector(`[data-key="${match.key}"]`);
      btn?.classList.add('active');
    }
  });

  window.addEventListener('keyup', (e) => {
    const match = accordions.find(a => a.key === e.key.toLowerCase());
    if (match) {
      const btn = consoleGrid.querySelector(`[data-key="${match.key}"]`);
      btn?.classList.remove('active');
    }
  });
}

function triggerModalChord(ratio: number, role: 'stable' | 'passing' | 'tension'): void {
  const baseFreq = harmonicContext.getTonicFrequency();
  const pitchHz = baseFreq * ratio;

  const musicalEvent: MusicalEvent = {
    id: `accordion-${Date.now()}`,
    time: audioEngine.currentAudioTime,
    pitchHz,
    midiNoteFloat: 69 + 12 * Math.log2(pitchHz / 440),
    velocity: 0.85,
    duration: 1.8,
    brightness: 0.6,
    pan: 0,
    articulation: 'sustain',
    role,
  };

  if (audioEngine.isInitialized) {
    audioEngine.scheduleEvent(musicalEvent);
  }
  if (midiManager.supported) {
    midiManager.handleMusicalEvent(musicalEvent);
  }

  // Trigger visual flash at center ring
  instrumentView.triggerNoteVisual(0, 0, 0.5, role, 0.85);
  recordNoteDisplay(musicalEvent);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
