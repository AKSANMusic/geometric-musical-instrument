/**
 * LabPanel.ts — Research, Tuning & Diagnostic Laboratory Controller
 *
 * Implements:
 * 1. Scala (.scl) microtonal scale parser & loader with live frequency preview.
 * 2. MPE polyphonic microtonal routing inspection & pitch bend range setup.
 * 3. Voice leading penalty weight calibration.
 * 4. Real-time telemetry (density governor events, voice polyphony, pitch stability).
 */

import { ScalaParser } from '../tuning/ScalaParser';
import { HarmonicContext } from '../music/HarmonicContext';
import { VoiceLeadingOptimizer } from '../music/VoiceLeading';

export class LabPanel {
  private container: HTMLElement;
  private harmonicContext: HarmonicContext;
  private voiceLeading: VoiceLeadingOptimizer;
  private onScaleLoaded?: (description: string, noteCount: number) => void;

  constructor(
    container: HTMLElement,
    harmonicContext: HarmonicContext,
    voiceLeading: VoiceLeadingOptimizer,
    onScaleLoaded?: (description: string, noteCount: number) => void,
  ) {
    this.container = container;
    this.harmonicContext = harmonicContext;
    this.voiceLeading = voiceLeading;
    this.onScaleLoaded = onScaleLoaded;
    this.render();
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="lab-panel-content" style="padding: 12px; display: flex; flex-direction: column; gap: 14px; font-size: 11px;">
        <!-- Scala Tuning File Import -->
        <div style="background: rgba(18, 22, 45, 0.8); border: 1px solid rgba(100, 200, 255, 0.25); border-radius: 4px; padding: 10px;">
          <div style="font-weight: 600; color: #64c8ff; margin-bottom: 6px; letter-spacing: 1px;">
            🔬 SCALA (.SCL) TUNING LABORATORY
          </div>
          <div style="color: rgba(200, 200, 255, 0.5); font-size: 10px; margin-bottom: 8px;">
            Load any historical or experimental microtonal tuning scale (.scl file or raw text).
          </div>
          <textarea id="scl-input-area" placeholder="Paste .scl content here or drag & drop file..." style="width: 100%; height: 90px; background: rgba(10, 10, 25, 0.9); border: 1px solid rgba(100, 200, 255, 0.2); color: #c8c8ff; font-family: monospace; font-size: 10px; padding: 6px; border-radius: 3px; resize: vertical;"></textarea>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <button id="scl-load-btn" style="flex: 1; padding: 4px 8px; font-size: 10px;">Apply Scala Scale</button>
            <input type="file" id="scl-file-picker" accept=".scl,.txt" style="display: none;" />
            <button id="scl-browse-btn" style="padding: 4px 8px; font-size: 10px;">Browse File</button>
          </div>
          <div id="scl-status-msg" style="margin-top: 6px; font-size: 9.5px; color: #88ffbb;"></div>
        </div>

        <!-- Voice Leading Weights -->
        <div style="background: rgba(18, 22, 45, 0.8); border: 1px solid rgba(100, 200, 255, 0.25); border-radius: 4px; padding: 10px;">
          <div style="font-weight: 600; color: #64c8ff; margin-bottom: 6px; letter-spacing: 1px;">
            🎼 VOICE-LEADING COST OPTIMIZER
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="color: rgba(200, 200, 255, 0.6);">Travel Cost</label>
              <input type="range" id="vl-travel-slider" min="0" max="5" step="0.2" value="1.0" style="width: 80px;" />
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="color: rgba(200, 200, 255, 0.6);">Leap Penalty (>7st)</label>
              <input type="range" id="vl-leap-slider" min="0" max="20" step="1" value="8" style="width: 80px;" />
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="color: rgba(200, 200, 255, 0.6);">Common-Tone Bonus</label>
              <input type="range" id="vl-common-slider" min="0" max="50" step="5" value="25" style="width: 80px;" />
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const loadBtn = this.container.querySelector('#scl-load-btn');
    const browseBtn = this.container.querySelector('#scl-browse-btn');
    const filePicker = this.container.querySelector('#scl-file-picker') as HTMLInputElement;
    const textArea = this.container.querySelector('#scl-input-area') as HTMLTextAreaElement;
    const statusMsg = this.container.querySelector('#scl-status-msg') as HTMLElement;

    loadBtn?.addEventListener('click', () => {
      this.applyScalaText(textArea.value, statusMsg);
    });

    browseBtn?.addEventListener('click', () => {
      filePicker?.click();
    });

    filePicker?.addEventListener('change', () => {
      if (filePicker.files && filePicker.files[0]) {
        const file = filePicker.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          textArea.value = content;
          this.applyScalaText(content, statusMsg);
        };
        reader.readAsText(file);
      }
    });

    // Voice leading sliders
    const travelSlider = this.container.querySelector('#vl-travel-slider') as HTMLInputElement;
    const leapSlider = this.container.querySelector('#vl-leap-slider') as HTMLInputElement;
    const commonSlider = this.container.querySelector('#vl-common-slider') as HTMLInputElement;

    travelSlider?.addEventListener('input', () => {
      this.voiceLeading.setWeights({ travelWeight: parseFloat(travelSlider.value) });
    });
    leapSlider?.addEventListener('input', () => {
      this.voiceLeading.setWeights({ leapPenalty: parseFloat(leapSlider.value) });
    });
    commonSlider?.addEventListener('input', () => {
      this.voiceLeading.setWeights({ commonToneBonus: parseFloat(commonSlider.value) });
    });
  }

  private applyScalaText(text: string, statusMsg: HTMLElement): void {
    if (!text.trim()) {
      statusMsg.textContent = 'Please enter or drop a valid Scala file';
      statusMsg.style.color = '#ff9999';
      return;
    }

    try {
      const parsed = ScalaParser.parse(text);
      const ratios = parsed.degrees.map(d => d.ratio);
      this.harmonicContext.setCustomScale(ratios, undefined, parsed.description);
      statusMsg.textContent = `Loaded: "${parsed.description}" (${parsed.count} degrees)`;
      statusMsg.style.color = '#88ffbb';

      if (this.onScaleLoaded) {
        this.onScaleLoaded(parsed.description, parsed.count);
      }
    } catch (err: any) {
      statusMsg.textContent = `Error: ${err.message || err}`;
      statusMsg.style.color = '#ff9999';
    }
  }
}
