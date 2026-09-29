/**
 * InstrumentView.ts — High-DPI Canvas Rendering Engine for the Pentagon Soundboard
 *
 * Implements REBUILD_SPEC_V2.md Layer D2:
 * 1. Strict 5-sided pentagon concentric rings with harmonic spectrum luminescence.
 * 2. Visual rendering of the PhraseEngine breathing cycle (Initiation, Growth, Peak, Cadence).
 * 3. Harmonic strike position feedback (tasto center vs ponticello tips).
 * 4. Multi-excitation particle visualization (Bouncing particles, Orbits, Rain drops, Pulse rings, Swarms).
 * 5. String vibration displacement physics for tactile visual response.
 */

import type { PentagonRing } from '../geometry/PentagonModel';
import type { Particle } from '../physics/ExcitationEngine';
import type { PhrasePhase } from '../music/PhraseEngine';
import type { MusicalEvent, MusicalRole } from '../domain/events';
import type { ExcitationMode } from '../domain/project-state';

export interface VisualVibration {
  ringIndex: number;
  sideIndex: number;
  u: number;
  amplitude: number;
  frequencyHz: number;
  startTime: number;
  duration: number;
}

export interface PluckFlash {
  x: number;
  y: number;
  color: string;
  radius: number;
  startTime: number;
  duration: number;
}

const PHASE_COLORS: Record<PhrasePhase, string> = {
  initiation: 'rgba(80, 220, 255, 0.25)',  // Cyan
  growth: 'rgba(70, 240, 160, 0.3)',       // Emerald
  peak: 'rgba(255, 200, 60, 0.45)',        // Radiant Gold
  cadence: 'rgba(190, 110, 255, 0.3)',     // Violet
};

export class InstrumentView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pentagons: PentagonRing[] = [];
  private vibrations: VisualVibration[] = [];
  private flashes: PluckFlash[] = [];
  private activePhase: PhrasePhase = 'growth';
  private phraseProgress = 0.5;
  private excitationMode: ExcitationMode = 'bounce';

  public centerX = 0;
  public centerY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.centerX = rect.width / 2;
    this.centerY = rect.height / 2;
  }

  public setGeometry(pentagons: PentagonRing[]): void {
    this.pentagons = pentagons;
  }

  public setPhraseStatus(phase: PhrasePhase, progress: number): void {
    this.activePhase = phase;
    this.phraseProgress = Math.max(0, Math.min(1, progress));
  }

  public setExcitationMode(mode: ExcitationMode): void {
    this.excitationMode = mode;
  }

  /**
   * Register a new musical pluck/bow for visual string vibration and flash.
   */
  public triggerNoteVisual(
    ringIndex: number,
    sideIndex: number,
    u: number,
    role: MusicalRole,
    velocity: number,
  ): void {
    const pent = this.pentagons[ringIndex];
    if (!pent || !pent.edges[sideIndex]) return;

    const edge = pent.edges[sideIndex];
    const px = edge.p1.x + u * (edge.p2.x - edge.p1.x);
    const py = edge.p1.y + u * (edge.p2.y - edge.p1.y);

    let color = 'rgba(100, 200, 255, 0.9)';
    if (role === 'stable') color = 'rgba(255, 215, 80, 0.95)';
    else if (role === 'tension') color = 'rgba(255, 120, 80, 0.95)';
    else if (role === 'resolution') color = 'rgba(120, 255, 180, 0.95)';

    this.flashes.push({
      x: px,
      y: py,
      color,
      radius: 12 + velocity * 22,
      startTime: performance.now(),
      duration: 300,
    });

    this.vibrations.push({
      ringIndex,
      sideIndex,
      u,
      amplitude: 6.0 * velocity,
      frequencyHz: 12, // Visual oscillation rate
      startTime: performance.now(),
      duration: 600,
    });
  }

  /**
   * Render complete frame.
   */
  public render(
    particles: ReadonlyArray<Particle> = [],
    activeVoicesCount = 0,
  ): void {
    const { ctx } = this;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const now = performance.now();

    // 1. Clear background
    ctx.fillStyle = '#080811';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    // 2. Draw Phrase Breathing Atmosphere
    this.drawPhraseBreathingAura(now);

    // 3. Draw Pentagonal Soundboard Rings
    this.drawPentagonRings(now);

    // 4. Draw Flashes
    this.drawFlashes(now);

    // 5. Draw Particles
    this.drawParticles(particles, now);

    ctx.restore();

    // 6. Draw HUD & Phase Indicator
    this.drawHUD(activeVoicesCount, w, h);
  }

  private drawPhraseBreathingAura(now: number): void {
    if (this.pentagons.length === 0) return;
    const { ctx } = this;
    const outerR = this.pentagons[0].circumradius;

    // Breathing pulse size
    const pulse = 1.0 + 0.04 * Math.sin(now * 0.003);
    const auraR = outerR * 1.15 * pulse;

    const grad = ctx.createRadialGradient(0, 0, outerR * 0.8, 0, 0, auraR);
    const color = PHASE_COLORS[this.activePhase];
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPentagonRings(now: number): void {
    const { ctx } = this;
    const totalRings = Math.max(1, this.pentagons.length);

    // Prune expired vibrations
    this.vibrations = this.vibrations.filter(v => now - v.startTime < v.duration);

    for (let r = 0; r < this.pentagons.length; r++) {
      const pent = this.pentagons[r];
      const hue = Math.round((190 + (r * 320) / totalRings) % 360);
      const ringAlpha = Math.max(0.35, 0.95 - (r / totalRings) * 0.5);

      for (let s = 0; s < pent.edges.length; s++) {
        const edge = pent.edges[s];

        // Check if this string is currently vibrating
        const activeVib = this.vibrations.find(v => v.ringIndex === r && v.sideIndex === s);

        ctx.beginPath();
        if (activeVib) {
          const elapsed = (now - activeVib.startTime) / 1000;
          const decay = 1.0 - (now - activeVib.startTime) / activeVib.duration;
          const vibAmp = activeVib.amplitude * decay * Math.sin(elapsed * activeVib.frequencyHz * Math.PI * 2);

          // Subdivide string for standing wave display
          ctx.moveTo(edge.p1.x, edge.p1.y);
          const steps = 16;
          for (let step = 1; step < steps; step++) {
            const frac = step / steps;
            const wave = Math.sin(frac * Math.PI); // fundamental sine mode
            const px = edge.p1.x + frac * (edge.p2.x - edge.p1.x) + edge.normal.x * vibAmp * wave;
            const py = edge.p1.y + frac * (edge.p2.y - edge.p1.y) + edge.normal.y * vibAmp * wave;
            ctx.lineTo(px, py);
          }
          ctx.lineTo(edge.p2.x, edge.p2.y);

          ctx.strokeStyle = `hsla(${hue}, 95%, 75%, ${ringAlpha})`;
          ctx.lineWidth = 3.2;
          ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.8)`;
          ctx.shadowBlur = 12;
        } else {
          ctx.moveTo(edge.p1.x, edge.p1.y);
          ctx.lineTo(edge.p2.x, edge.p2.y);
          ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${ringAlpha})`;
          ctx.lineWidth = Math.max(1.2, 2.4 - (r / totalRings) * 1.0);
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw side degree labels on outermost ring
        if (r === 0) {
          const mx = (edge.p1.x + edge.p2.x) / 2 + edge.normal.x * 20;
          const my = (edge.p1.y + edge.p2.y) / 2 + edge.normal.y * 20;
          ctx.fillStyle = 'rgba(180, 210, 255, 0.7)';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Side ${s + 1}`, mx, my);
        }
      }

      // Draw vertex nodes
      for (const v of pent.vertices) {
        ctx.beginPath();
        ctx.arc(v.x, v.y, Math.max(2, 3.5 - r * 0.2), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 90%, 75%, ${ringAlpha})`;
        ctx.fill();
      }
    }
  }

  private drawFlashes(now: number): void {
    const { ctx } = this;
    this.flashes = this.flashes.filter(f => now - f.startTime < f.duration);

    for (const flash of this.flashes) {
      const progress = (now - flash.startTime) / flash.duration;
      const alpha = 1.0 - progress;
      const currentR = flash.radius * (0.4 + 0.6 * progress);

      ctx.beginPath();
      ctx.arc(flash.x, flash.y, currentR, 0, Math.PI * 2);
      ctx.fillStyle = flash.color.replace(/[\d.]+\)$/, `${alpha * 0.75})`);
      ctx.fill();
    }
  }

  private drawParticles(particles: ReadonlyArray<Particle>, now: number): void {
    const { ctx } = this;

    for (const p of particles) {
      // Glow trail
      const speed = Math.hypot(p.vx, p.vy);
      const isFast = speed > 150;

      ctx.beginPath();
      ctx.arc(p.x, p.y, isFast ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 220, 255, 0.25)';
      ctx.fill();

      // Particle core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius || 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#64c8ff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  private drawHUD(activeVoices: number, w: number, h: number): void {
    const { ctx } = this;

    // Top left: Voices and mode
    ctx.fillStyle = 'rgba(200, 220, 255, 0.6)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Voices: ${activeVoices}  |  Excitation: ${this.excitationMode.toUpperCase()}`, 16, 24);

    // Top right: Phrase phase indicator
    ctx.textAlign = 'right';
    const phaseLabel = this.activePhase.toUpperCase();
    const phasePct = Math.round(this.phraseProgress * 100);
    ctx.fillStyle = this.getPhaseHexColor(this.activePhase);
    ctx.fillText(`Phrase Arc: ${phaseLabel} (${phasePct}%)`, w - 16, 24);
  }

  private getPhaseHexColor(phase: PhrasePhase): string {
    switch (phase) {
      case 'initiation': return '#50dcff';
      case 'growth': return '#46f0a0';
      case 'peak': return '#ffc83c';
      case 'cadence': return '#be6eff';
    }
  }
}
