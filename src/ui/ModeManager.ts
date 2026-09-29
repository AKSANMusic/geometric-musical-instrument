/**
 * ModeManager.ts — Three-Tier User Experience Manager
 *
 * Implements REBUILD_SPEC_V2.md Section 7:
 * [ PLAY | GENERATE | LAB ]
 *
 * PLAY: Immediate, beautiful defaults (Mood, Energy, Motion, Complexity, Musical Freedom, Instrument, Key).
 * GENERATE: Generative controls (Particles, Orbit, Rain, Pulse, Swarm, Phrase Duration, Motif Memory).
 * LAB: Scala .scl tuning importer, MPE allocator, Voice-leading cost sliders, Telemetry.
 */

import type { ViewMode } from '../domain/project-state';
import { ProjectStore } from '../domain/project-state';

export class ModeManager {
  private currentMode: ViewMode = 'play';
  private store: ProjectStore;
  private onModeChangeCallbacks: Set<(mode: ViewMode) => void> = new Set();

  constructor(store: ProjectStore) {
    this.store = store;
    this.currentMode = store.getState().ui.activeView;
  }

  public setMode(mode: ViewMode): void {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.store.update(state => {
      state.ui.activeView = mode;
    });

    this.updateDomVisibility(mode);
    for (const cb of this.onModeChangeCallbacks) {
      cb(mode);
    }
  }

  public getMode(): ViewMode {
    return this.currentMode;
  }

  public onModeChange(callback: (mode: ViewMode) => void): () => void {
    this.onModeChangeCallbacks.add(callback);
    return () => this.onModeChangeCallbacks.delete(callback);
  }

  private updateDomVisibility(mode: ViewMode): void {
    const playElements = document.querySelectorAll('.mode-play-only');
    const generateElements = document.querySelectorAll('.mode-generate-only');
    const labElements = document.querySelectorAll('.mode-lab-only');

    playElements.forEach(el => {
      (el as HTMLElement).style.display = (mode === 'play') ? '' : 'none';
    });
    generateElements.forEach(el => {
      (el as HTMLElement).style.display = (mode === 'generate') ? '' : 'none';
    });
    labElements.forEach(el => {
      (el as HTMLElement).style.display = (mode === 'lab') ? '' : 'none';
    });

    // Update tab button classes
    document.querySelectorAll('.mode-tab-btn').forEach(btn => {
      const btnMode = btn.getAttribute('data-mode');
      if (btnMode === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}
