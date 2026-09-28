import type { Vec2, Pentagon, ParticleState, CollisionEvent, Edge } from '../types';
import { vec2 } from '../types';

/** Dynamic harmonic color palette for any number of nesting levels (up to 16) */
export function getLevelColor(level: number, totalLevels = 12): string {
  const hue = Math.round((195 + (level * 360) / Math.max(totalLevels, 5)) % 360);
  return `hsla(${hue}, 86%, 66%, 0.88)`;
}

export function getLevelGlowBase(level: number, totalLevels = 12): string {
  const hue = Math.round((195 + (level * 360) / Math.max(totalLevels, 5)) % 360);
  return `hsla(${hue}, 95%, 72%,`;
}

const FLASH_DURATION_MS = 250;
const HOVER_THRESHOLD = 18; // pixels — max distance to detect hover

interface Flash {
  point: Vec2;
  edgeIndex: number;
  pentagonLevel: number;
  startTime: number;
}

export interface EdgeHit {
  edge: Edge;
  pentagon: Pentagon;
  param: number;      // [0,1] position along the edge
  distance: number;   // perpendicular distance in pixels
  point: Vec2;        // nearest point on the edge
}

export interface BowTrailPoint {
  x: number;
  y: number;
  time: number;
  speed: number;
  force: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private flashes: Flash[] = [];
  private bowTrail: BowTrailPoint[] = [];
  public centerX = 0;
  public centerY = 0;

  /** Currently hovered edge (set externally by app.ts) */
  public hoveredEdge: { pentagonLevel: number; edgeIndex: number } | null = null;
  public showCelloStrings = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  /** Handle window resize. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.centerX = rect.width / 2;
    this.centerY = rect.height / 2;
  }

  /**
   * Find the nearest edge to a point in canvas coordinates (pixels).
   */
  findNearestEdge(
    canvasX: number,
    canvasY: number,
    pentagons: ReadonlyArray<Pentagon>,
    threshold = HOVER_THRESHOLD,
  ): EdgeHit | null {
    const px = canvasX - this.centerX;
    const py = canvasY - this.centerY;

    let best: EdgeHit | null = null;

    for (const pent of pentagons) {
      for (const edge of pent.edges) {
        const ex = edge.p2.x - edge.p1.x;
        const ey = edge.p2.y - edge.p1.y;
        const edgeLenSq = ex * ex + ey * ey;
        if (edgeLenSq < 1e-10) continue;

        let t = ((px - edge.p1.x) * ex + (py - edge.p1.y) * ey) / edgeLenSq;
        t = Math.max(0, Math.min(1, t));

        const nearX = edge.p1.x + t * ex;
        const nearY = edge.p1.y + t * ey;
        const dist = Math.hypot(px - nearX, py - nearY);

        if (dist < threshold && (!best || dist < best.distance)) {
          best = {
            edge,
            pentagon: pent,
            param: t,
            distance: dist,
            point: { x: nearX, y: nearY },
          };
        }
      }
    }

    return best;
  }

  /** Register a collision flash effect. */
  addFlash(event: CollisionEvent): void {
    this.flashes.push({
      point: event.impactPoint,
      edgeIndex: event.edge.index,
      pentagonLevel: event.pentagon.level,
      startTime: performance.now(),
    });
  }

  /** Register a manual pluck flash. */
  addManualFlash(point: Vec2, pentagonLevel: number, edgeIndex: number): void {
    this.flashes.push({
      point,
      edgeIndex,
      pentagonLevel,
      startTime: performance.now(),
    });
  }

  /** Add point to real-time physical bow gesture trail */
  addBowTrailPoint(canvasX: number, canvasY: number, speed: number, force = 0.6): void {
    this.bowTrail.push({
      x: canvasX - this.centerX,
      y: canvasY - this.centerY,
      time: performance.now(),
      speed,
      force,
    });
  }

  public clearBowTrail(): void {
    this.bowTrail = [];
  }

  private lastTotalLevels = 3;

  /** Draw a full frame. */
  draw(
    pentagons: ReadonlyArray<Pentagon>,
    particles: ReadonlyArray<ParticleState>,
    activeVoices: number,
  ): void {
    this.lastTotalLevels = pentagons.length;
    const { ctx } = this;
    const w = this.canvas.getBoundingClientRect().width;
    const h = this.canvas.getBoundingClientRect().height;

    // Clear
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.centerX, this.centerY);

    // Draw Cello Acoustic Resonance Guidelines if enabled
    if (this.showCelloStrings) {
      this.drawCelloGuidelines(pentagons);
    }

    // Draw pentagons
    for (const pent of pentagons) {
      this.drawPentagon(pent);
    }

    // Draw collision flashes
    const now = performance.now();
    this.flashes = this.flashes.filter(f => now - f.startTime < FLASH_DURATION_MS);
    for (const flash of this.flashes) {
      this.drawFlash(flash, now);
    }

    // Draw physical bow gesture trail
    this.drawBowTrail(now);

    // Draw particles
    for (const particle of particles) {
      this.drawParticle(particle);
    }

    ctx.restore();

    // HUD
    this.drawHUD(activeVoices, w);
  }

  private drawCelloGuidelines(pentagons: ReadonlyArray<Pentagon>): void {
    if (pentagons.length === 0) return;
    const { ctx } = this;
    const outerR = pentagons[0].circumradius;

    // 4 Cello Strings: C2 (65Hz), G2 (98Hz), D3 (146Hz), A3 (220Hz)
    const strings = [
      { name: 'C₂ (سیم بم)', color: 'rgba(255, 120, 60, 0.22)', angle: -Math.PI * 0.75 },
      { name: 'G₂ (سل)', color: 'rgba(255, 180, 50, 0.22)', angle: -Math.PI * 0.25 },
      { name: 'D₃ (رِ)', color: 'rgba(70, 200, 255, 0.22)', angle: Math.PI * 0.25 },
      { name: 'A₃ (لا)', color: 'rgba(180, 130, 255, 0.22)', angle: Math.PI * 0.75 },
    ];

    for (const str of strings) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const ex = Math.cos(str.angle) * (outerR + 25);
      const ey = Math.sin(str.angle) * (outerR + 25);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = str.color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = str.color.replace('0.22', '0.6');
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(str.name, ex * 1.06, ey * 1.06);
    }
  }

  private drawBowTrail(now: number): void {
    const maxAge = 350; // ms trail persistence
    this.bowTrail = this.bowTrail.filter(p => now - p.time < maxAge);
    if (this.bowTrail.length < 2) return;

    const { ctx } = this;
    ctx.save();
    for (let i = 1; i < this.bowTrail.length; i++) {
      const p1 = this.bowTrail[i - 1];
      const p2 = this.bowTrail[i];
      const age = now - p2.time;
      const alpha = (1 - age / maxAge) * 0.85;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      // Rosin stick-slip bow trail color: Warm gold when digging deep, cyan when fast
      const r = Math.round(100 + 155 * p2.force);
      const g = Math.round(200 + 55 * p2.speed);
      const b = 255;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = Math.max(2, p2.force * 6);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPentagon(pent: Pentagon): void {
    const { ctx } = this;
    const color = getLevelColor(pent.level, this.lastTotalLevels);
    const glowBase = getLevelGlowBase(pent.level, this.lastTotalLevels);

    for (const edge of pent.edges) {
      const isHovered =
        this.hoveredEdge?.pentagonLevel === pent.level &&
        this.hoveredEdge?.edgeIndex === edge.index;

      if (isHovered) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(edge.p1.x, edge.p1.y);
        ctx.lineTo(edge.p2.x, edge.p2.y);
        ctx.strokeStyle = `${glowBase} 0.5)`;
        ctx.lineWidth = 10;
        ctx.shadowColor = `${glowBase} 0.8)`;
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.moveTo(edge.p1.x, edge.p1.y);
      ctx.lineTo(edge.p2.x, edge.p2.y);
      ctx.strokeStyle = isHovered ? '#ffffff' : color;
      ctx.lineWidth = isHovered ? 3.2 : Math.max(1.1, 2.2 - pent.level * 0.1);
      ctx.stroke();

      // Edge label (outermost pentagon)
      if (pent.level === 0) {
        const mx = (edge.p1.x + edge.p2.x) / 2;
        const my = (edge.p1.y + edge.p2.y) / 2;
        const offset = 18;
        ctx.fillStyle = isHovered
          ? 'rgba(255, 255, 255, 0.95)'
          : 'rgba(200, 200, 255, 0.65)';
        ctx.font = isHovered ? 'bold 12px monospace' : '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          edge.label,
          mx + edge.normal.x * offset,
          my + edge.normal.y * offset,
        );
      }
    }

    // Vertex dots
    for (const v of pent.vertices) {
      ctx.beginPath();
      ctx.arc(v.x, v.y, Math.max(1.5, 3 - pent.level * 0.15), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  private drawParticle(particle: ParticleState): void {
    const { ctx } = this;
    const speed = vec2.len(particle.vel);
    const maxSpeed = 500;
    const t = Math.min(speed / maxSpeed, 1);

    const r = Math.floor(100 + 155 * t);
    const g = Math.floor(180 + 75 * t);
    const b = 255;

    // Glow
    ctx.beginPath();
    ctx.arc(particle.pos.x, particle.pos.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(particle.pos.x, particle.pos.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();

    // Velocity trail
    const trail = vec2.scale(vec2.normalize(particle.vel), -20 * t);
    ctx.beginPath();
    ctx.moveTo(particle.pos.x, particle.pos.y);
    ctx.lineTo(particle.pos.x + trail.x, particle.pos.y + trail.y);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawFlash(flash: Flash, now: number): void {
    const { ctx } = this;
    const elapsed = now - flash.startTime;
    const progress = elapsed / FLASH_DURATION_MS;
    const alpha = 1 - progress;
    const radius = 8 + 28 * progress;

    const glowBase = getLevelGlowBase(flash.pentagonLevel, this.lastTotalLevels);
    ctx.beginPath();
    ctx.arc(flash.point.x, flash.point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `${glowBase} ${alpha * 0.85})`;
    ctx.fill();
  }

  private drawHUD(activeVoices: number, width: number): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(200, 200, 255, 0.5)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Voices: ${activeVoices}`, 12, 24);
  }
}
