import type { ParticleState, Pentagon, CollisionEvent, Vec2 } from '../types';
import { findNearestCollision } from './collision';

const EPSILON = 1e-9;

export class PhysicsEngine {
  public particles: ParticleState[] = [];
  public pentagons: Pentagon[] = [];
  public time = 0;
  public damping: number;
  public maxSpeed: number;

  private maxBouncesPerStep: number;

  /**
   * @param damping - Coefficient of restitution / energy retention per bounce (default 0.985)
   *                  Affects velocity components isotropically: v' = damping * (v - 2(v·n)n)
   * @param maxBouncesPerStep - Safety cap to prevent infinite collision loops (default 20)
   * @param maxSpeed - Velocity magnitude ceiling in px/s to prevent exploding speeds (default 2500)
   */
  constructor(damping = 0.985, maxBouncesPerStep = 20, maxSpeed = 2500) {
    this.damping = damping;
    this.maxBouncesPerStep = maxBouncesPerStep;
    this.maxSpeed = maxSpeed;
  }

  /** Add a particle to the simulation. */
  addParticle(pos: Vec2, vel: Vec2, radius = 0, id = 0): ParticleState {
    const p: ParticleState = { pos, vel, radius, id };
    this.particles.push(p);
    return p;
  }

  /** Set the pentagon geometry (call once or when config changes). */
  setPentagons(pentagons: Pentagon[]): void {
    this.pentagons = pentagons;
  }

  /**
   * Advance physics by dt seconds using continuous collision detection.
   * Returns all collision events that occurred during this timestep.
   */
  step(dt: number): CollisionEvent[] {
    const events: CollisionEvent[] = [];

    for (const particle of this.particles) {
      let remaining = dt;
      let bounces = 0;

      while (remaining > EPSILON && bounces < this.maxBouncesPerStep) {
        const hit = findNearestCollision(particle, this.pentagons, remaining);

        if (!hit) {
          // No collision — free flight to end of timestep
          particle.pos = {
            x: particle.pos.x + particle.vel.x * remaining,
            y: particle.pos.y + particle.vel.y * remaining,
          };
          remaining = 0;
        } else {
          // Advance to collision point
          particle.pos = {
            x: particle.pos.x + particle.vel.x * hit.t,
            y: particle.pos.y + particle.vel.y * hit.t,
          };
          remaining -= hit.t;

          // Compute impact metrics BEFORE reflection
          const n = hit.edge.normal;
          const vDotN = particle.vel.x * n.x + particle.vel.y * n.y;
          const impactSpeed = Math.abs(vDotN);

          // Impact point on the edge
          const impactPoint: Vec2 = {
            x: hit.edge.p1.x + hit.u * (hit.edge.p2.x - hit.edge.p1.x),
            y: hit.edge.p1.y + hit.u * (hit.edge.p2.y - hit.edge.p1.y),
          };

          // Elastic reflection: v' = damping * (v - 2(v·n)n)
          let newVx = this.damping * (particle.vel.x - 2 * vDotN * n.x);
          let newVy = this.damping * (particle.vel.y - 2 * vDotN * n.y);

          // Prevent exploding velocities
          const newSpeed = Math.hypot(newVx, newVy);
          if (newSpeed > this.maxSpeed) {
            const scale = this.maxSpeed / newSpeed;
            newVx *= scale;
            newVy *= scale;
          }

          particle.vel = { x: newVx, y: newVy };

          // Nudge particle off the wall to prevent immediate re-collision
          const nudgeDir = vDotN > 0 ? -1 : 1;
          particle.pos = {
            x: particle.pos.x + n.x * EPSILON * 100 * nudgeDir,
            y: particle.pos.y + n.y * EPSILON * 100 * nudgeDir,
          };

          events.push({
            particle,
            edge: hit.edge,
            pentagon: hit.pentagon,
            impactPoint,
            impactParam: hit.u,
            impactSpeed,
            timestamp: this.time + (dt - remaining),
          });

          bounces++;
        }
      }
    }

    this.time += dt;
    return events;
  }

  /** Reset simulation to initial state. */
  reset(): void {
    this.particles = [];
    this.time = 0;
  }
}
