/**
 * range-keyboard.ts — SWAM-style Visual Piano Keyboard Strip with Active Register Mapping
 *
 * Renders an interactive miniature keyboard displaying:
 * - Active playable register highlighted (e.g. Cello C2 to G5 in warm amber)
 * - Out-of-bounds registers dimmed (like the SWAM Cello virtual keyboard)
 * - Real-time glowing key-strike indicators when notes are triggered
 */

import { midiToNoteName } from '../audio/instrument-range';

export class RangeKeyboardVisualizer {
  private container: HTMLElement;
  private keyElements = new Map<number, HTMLElement>();
  private startMidi = 24; // C1 (deep contrabass / cello low extension)
  private endMidi = 96;   // C7 (high violin / cello top harmonic register)

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Builds the DOM structure for the virtual keyboard.
   */
  public render(minMidi: number, maxMidi: number, enabled: boolean): void {
    this.container.innerHTML = '';
    this.keyElements.clear();

    const keyboardWrapper = document.createElement('div');
    keyboardWrapper.className = 'swam-kb-wrapper';

    // Black keys indices relative to C in an octave: [1 (C#), 3 (D#), 6 (F#), 8 (G#), 10 (A#)]
    const isBlack = (midi: number) => {
      const noteInOct = midi % 12;
      return [1, 3, 6, 8, 10].includes(noteInOct);
    };

    // First pass: collect all white keys
    const whiteKeys: number[] = [];
    for (let m = this.startMidi; m <= this.endMidi; m++) {
      if (!isBlack(m)) {
        whiteKeys.push(m);
      }
    }

    // Render white keys
    whiteKeys.forEach((m) => {
      const whiteKeyEl = document.createElement('div');
      whiteKeyEl.className = 'swam-white-key';
      whiteKeyEl.setAttribute('data-midi', String(m));
      whiteKeyEl.setAttribute('title', `${midiToNoteName(m)} (MIDI ${m})`);

      const inRange = enabled ? (m >= minMidi && m <= maxMidi) : true;
      if (!inRange) {
        whiteKeyEl.classList.add('dimmed');
      } else {
        whiteKeyEl.classList.add('in-range');
      }

      // If it's a 'C', show subtle octave label at bottom (e.g. C2, C3, C4, C5)
      if (m % 12 === 0) {
        const label = document.createElement('span');
        label.className = 'swam-key-label';
        label.textContent = midiToNoteName(m);
        whiteKeyEl.appendChild(label);
      }

      keyboardWrapper.appendChild(whiteKeyEl);
      this.keyElements.set(m, whiteKeyEl);
    });

    // Second pass: overlay black keys onto appropriate positions
    for (let m = this.startMidi; m <= this.endMidi; m++) {
      if (isBlack(m)) {
        const prevWhite = m - 1;
        const prevWhiteEl = this.keyElements.get(prevWhite);
        if (prevWhiteEl) {
          const blackKeyEl = document.createElement('div');
          blackKeyEl.className = 'swam-black-key';
          blackKeyEl.setAttribute('data-midi', String(m));
          blackKeyEl.setAttribute('title', `${midiToNoteName(m)} (MIDI ${m})`);

          const inRange = enabled ? (m >= minMidi && m <= maxMidi) : true;
          if (!inRange) {
            blackKeyEl.classList.add('dimmed');
          } else {
            blackKeyEl.classList.add('in-range');
          }

          prevWhiteEl.appendChild(blackKeyEl);
          this.keyElements.set(m, blackKeyEl);
        }
      }
    }

    this.container.appendChild(keyboardWrapper);
  }

  /**
   * Highlights a key in real-time when struck.
   */
  public triggerKeyLight(midiNote: number): void {
    const el = this.keyElements.get(midiNote);
    if (!el) return;

    el.classList.add('active-hit');
    setTimeout(() => {
      el.classList.remove('active-hit');
    }, 180);
  }
}
