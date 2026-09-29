/**
 * ExcitationEngine.ts — Generative Physical & Geometric Excitation System
 *
 * Implements REBUILD_SPEC_V2.md Layer B:
 * Generative excitation engines producing canonical GeometricEvents:
 * 1. manual: Passive; gestures only.
 * 2. bounce: Elastic billiard particles with continuous collision detection against pentagon edges.
 * 3. orbit: Revolving orbital attractors crossing rings.
 * 4. rain: Stochastic musical raindrops falling onto strings.
 * 5. pulse: Periodic rhythmic radial shockwaves expanding across rings.
 * 6. swarm: Flocking particle swarm guided by harmonic gravitation.
 */

import type { GeometricEvent } from '../domain/events';
import { generateEventId } from '../domain/events';
import type { Pentagon } from '../geometry/PentagonModel';
import { SeededRandom, type ExcitationMode } from '../domain/project-state';

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ringLevel: number;
}

export type ExcitationCallback = (event: GeometricEvent) => void;

export class ExcitationEngine {
  public mode: ExcitationMode = 'bounce';
  public particles: Particle[] = [];
  public pentagons: Pentagon[] = [];

  private onEvent: ExcitationCallback;
  private rng: SeededRandom;
  private speedMultiplier = 1.0;
  private damping = 0.985;
  private lastPulseTime = 0;
  private lastRainTime = 0;
  private orbitAngle = 0;

  constructor(
    onEvent: ExcitationCallback,
    seed = 777,
  ) {
    this.onEvent = onEvent;
    this.rng = new SeededRandom(seed);
  }

  public setGeometry(pentagons: Pentagon[]): void {
    this.pentagons = pentagons;
  }

  public setMode(mode: ExcitationMode): void {
    this.mode = mode;
    this.resetParticles();
  }

  public setParameters(speed: number, damping: number, particleCount = 2): void {
    this.speedMultiplier = Math.max(0.1, Math.min(3.0, speed / 250));
    this.damping = Math.max(0.8, Math.min(0.999, damping));
    this.adjustParticleCount(particleCount);
  }

  public resetParticles(): void {
    this.particles = [];
    if (this.mode === 'bounce' || this.mode === 'orbit' || this.mode === 'swarm') {
      this.adjustParticleCount(2);
    }
  }

  private adjustParticleCount(targetCount: number): void {
    const count = Math.max(1, Math.min(12, targetCount));
    while (this.particles.length < count) {
      const angle = this.rng.nextRange(0, Math.PI * 2);
      const dist = this.rng.nextRange(20, 100);
      const speed = 180 * this.speedMultiplier;
      this.particles.push({
        id: this.particles.length,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vx: -Math.sin(angle) * speed,
        vy: Math.cos(angle) * speed,
        radius: 4,
        ringLevel: 0,
      });
    }
    while (this.particles.length > count) {
      this.particles.pop();
    }
  }

  /**
   * Advance simulation by dt seconds.
   */
  public update(dt: number, currentTime: number): void {
    if (this.pentagons.length === 0 || this.mode === 'manual') return;

    switch (this.mode) {
      case 'bounce':
        this.updateBounce(dt, currentTime);
        break;
      case 'orbit':
        this.updateOrbit(dt, currentTime);
        break;
      case 'rain':
        this.updateRain(dt, currentTime);
        break;
      case 'pulse':
        this.updatePulse(dt, currentTime);
        break;
      case 'swarm':
        this.updateSwarm(dt, currentTime);
        break;
    }
  }

  // ─── 1. Bounce Mode (Elastic Billiards) ──────────────────────────────────────
  private updateBounce(dt: number, currentTime: number): void {
    if (this.pentagons.length === 0) return;
    const outerPent = this.pentagons[0];

    for (const p of this.particles) {
      // Predict motion
      const nextX = p.x + p.vx * dt;
      const nextY = p.y + p.vy * dt;

      // Check collision with outer pentagon edges
      for (let i = 0; i < outerPent.edges.length; i++) {
        const edge = outerPent.edges[i];
        const hit = this.raySegmentIntersect(p.x, p.y, nextX - p.x, nextY - p.y, edge.p1.x, edge.p1.y, edge.p2.x, edge.p2.y);

        if (hit && hit.t >= 0 && hit.t <= 1) {
          // Reflect velocity: v' = v - 2(v·n)n
          const nx = edge.normal.x;
          const ny = edge.normal.y;
          const vDotN = p.vx * nx + p.vy * ny;

          p.vx = this.damping * (p.vx - 2 * vDotN * nx);
          p.vy = this.damping * (p.vy - 2 * vDotN * ny);

          // Position at bounce point
          p.x = edge.p1.x + hit.u * (edge.p2.x - edge.p1.x) - nx * 2;
          p.y = edge.p1.y + hit.u * (edge.p2.y - edge.p1.y) - ny * 2;

          const speed = Math.hypot(p.vx, p.vy);
          const event: GeometricEvent = {
            id: generateEventId('geo-bounce'),
            time: currentTime,
            source: 'collision',
            sideIndex: i,
            ringIndex: 0,
            normalizedPosition: hit.u,
            velocity: Math.min(1.0, speed / 350),
            durationHint: 0.35,
          };
          this.onEvent(event);
          break;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  // ─── 2. Orbit Mode ──────────────────────────────────────────────────────────
  private updateOrbit(dt: number, currentTime: number): void {
    this.orbitAngle += dt * 1.5 * this.speedMultiplier;
    const numRings = this.pentagons.length;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const ringIdx = i % numRings;
      const pent = this.pentagons[ringIdx];
      const radius = pent.circumradius * 0.95;

      const angle = this.orbitAngle + (i * Math.PI * 2) / this.particles.length;
      p.x = Math.cos(angle) * radius;
      p.y = Math.sin(angle) * radius;

      // Check if crossing any vertex or side
      const side = Math.floor(((angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / 5));
      if (Math.abs(angle % (Math.PI * 2 / 5)) < 0.08) {
        const event: GeometricEvent = {
          id: generateEventId('geo-orbit'),
          time: currentTime,
          source: 'orbit',
          sideIndex: side % 5,
          ringIndex: ringIdx,
          normalizedPosition: 0.5,
          velocity: 0.7,
          durationHint: 0.45,
        };
        this.onEvent(event);
      }
    }
  }

  // ─── 3. Rain Mode (Generative Drops) ────────────────────────────────────────
  private updateRain(dt: number, currentTime: number): void {
    const rainInterval = 0.35 / this.speedMultiplier;
    if (currentTime - this.lastRainTime > rainInterval) {
      this.lastRainTime = currentTime;

      const ringIdx = this.rng.nextInt(0, Math.max(0, this.pentagons.length - 1));
      const sideIdx = this.rng.nextInt(0, 4);
      const u = this.rng.nextRange(0.1, 0.9);
      const vel = this.rng.nextRange(0.4, 0.95);

      const event: GeometricEvent = {
        id: generateEventId('geo-rain'),
        time: currentTime,
        source: 'rain',
        sideIndex: sideIdx,
        ringIndex: ringIdx,
        normalizedPosition: u,
        velocity: vel,
        durationHint: 0.3,
      };
      this.onEvent(event);
    }
  }

  // ─── 4. Pulse Mode (Concentric Radial Waves) ────────────────────────────────
  private updatePulse(dt: number, currentTime: number): void {
    const pulseInterval = 1.0 / this.speedMultiplier;
    if (currentTime - this.lastPulseTime > pulseInterval) {
      this.lastPulseTime = currentTime;

      // Excites a coherent pentagonal chord
      const sideIdx = this.rng.nextInt(0, 4);
      for (let r = 0; r < Math.min(3, this.pentagons.length); r++) {
        const event: GeometricEvent = {
          id: generateEventId('geo-pulse'),
          time: currentTime + r * 0.04, // Micro strum
          source: 'pulse',
          sideIndex: (sideIdx + r) % 5,
          ringIndex: r,
          normalizedPosition: 0.5,
          velocity: Math.max(0.3, 0.9 - r * 0.2),
          durationHint: 0.5,
        };
        this.onEvent(event);
      }
    }
  }

  // ─── 5. Swarm Mode (Harmonic Boids) ─────────────────────────────────────────
  private updateSwarm(dt: number, currentTime: number): void {
    for (const p of this.particles) {
      // Swarm attracted towards center with orbital swirling
      const dist = Math.hypot(p.x, p.y);
      const targetDist = 120;
      const radialForce = (targetDist - dist) * 2.0;

      // Tangential velocity
      p.vx += (-p.y * 3.0 + radialForce * (p.x / Math.max(1, dist))) * dt;
      p.vy += (p.x * 3.0 + radialForce * (p.y / Math.max(1, dist))) * dt;

      p.vx *= 0.96;
      p.vy *= 0.96;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Stochastic boundary plucking
      if (this.rng.next() < 0.03 * this.speedMultiplier) {
        const sideIdx = this.rng.nextInt(0, 4);
        const ringIdx = this.rng.nextInt(0, Math.max(0, this.pentagons.length - 1));
        const event: GeometricEvent = {
          id: generateEventId('geo-swarm'),
          time: currentTime,
          source: 'swarm',
          sideIndex: sideIdx,
          ringIndex: ringIdx,
          normalizedPosition: this.rng.nextRange(0.2, 0.8),
          velocity: this.rng.nextRange(0.4, 0.8),
          durationHint: 0.4,
        };
        this.onEvent(event);
      }
    }
  }

  private raySegmentIntersect(
    px: number, py: number,
    dx: number, dy: number,
    ax: number, ay: number,
    bx: number, by: number,
  ): { t: number; u: number } | null {
    const segDx = bx - ax;
    const segDy = by - ay;
    const denom = dx * segDy - dy * segDx;
    if (Math.abs(denom) < 1e-9) return null;

    const t = ((ax - px) * segDy - (ay - py) * segDx) / denom;
    const u = (dx * (ay - py) - dy * (ax - px)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { t, u };
    }
    return null;
  }
}
