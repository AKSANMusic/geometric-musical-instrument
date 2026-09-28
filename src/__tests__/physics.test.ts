import { describe, it, expect } from 'vitest';
import { raySegmentIntersect, findNearestCollision } from '../physics/collision';
import { PhysicsEngine } from '../physics/engine';
import { buildPentagon, buildNestedPentagons } from '../geometry/solver';
import { vec2 } from '../types';

describe('Collision Detection', () => {
  describe('raySegmentIntersect', () => {
    it('should detect a head-on intersection', () => {
      // Ray from (0,0) going right, segment from (5,-1) to (5,1)
      const result = raySegmentIntersect(0, 0, 1, 0, 5, -1, 5, 1);
      expect(result).not.toBeNull();
      expect(result!.t).toBeCloseTo(5, 8);
      expect(result!.u).toBeCloseTo(0.5, 8);
    });

    it('should return null for parallel ray and segment', () => {
      // Ray going right, horizontal segment
      const result = raySegmentIntersect(0, 0, 1, 0, 0, 1, 5, 1);
      expect(result).toBeNull();
    });

    it('should return null for backward intersection (t < 0)', () => {
      // Ray from (10,0) going right, segment at x=5
      const result = raySegmentIntersect(10, 0, 1, 0, 5, -1, 5, 1);
      expect(result).toBeNull();
    });

    it('should return null when ray misses segment (u out of range)', () => {
      // Ray from (0,0) going up-right, segment at x=5 from y=10 to y=12
      const result = raySegmentIntersect(0, 0, 1, 0.1, 5, 10, 5, 12);
      expect(result).toBeNull();
    });

    it('should report correct u for edge endpoints', () => {
      // Hit near the start of the segment
      const result = raySegmentIntersect(0, -0.9, 1, 0, 5, -1, 5, 1);
      expect(result).not.toBeNull();
      expect(result!.u).toBeCloseTo(0.05, 1);
    });
  });

  describe('findNearestCollision', () => {
    it('should find the nearest edge when particle is inside a pentagon', () => {
      const pent = buildPentagon(100, 440, 0);
      const particle = {
        pos: { x: 0, y: 0 },
        vel: { x: 100, y: 0 },
        radius: 0,
        id: 0,
      };

      const hit = findNearestCollision(particle, [pent], 10);
      expect(hit).not.toBeNull();
      expect(hit!.t).toBeGreaterThan(0);
      expect(hit!.u).toBeGreaterThanOrEqual(0);
      expect(hit!.u).toBeLessThanOrEqual(1);
    });

    it('should find the closest of multiple pentagon edges', () => {
      const pent = buildPentagon(100, 440, 0);
      const particle = {
        pos: { x: 0, y: 0 },
        vel: { x: 100, y: 0 },
        radius: 0,
        id: 0,
      };

      const hit = findNearestCollision(particle, [pent], 10);
      // Verify it's the truly nearest by checking no other edge is closer
      for (const edge of pent.edges) {
        if (edge.index === hit!.edge.index) continue;
        const otherHit = raySegmentIntersect(
          particle.pos.x, particle.pos.y,
          particle.vel.x, particle.vel.y,
          edge.p1.x, edge.p1.y,
          edge.p2.x, edge.p2.y,
        );
        if (otherHit) {
          expect(otherHit.t).toBeGreaterThanOrEqual(hit!.t - 1e-9);
        }
      }
    });
  });
});

describe('Physics Engine', () => {
  it('should keep the particle inside the pentagon after many bounces', () => {
    const pent = buildPentagon(100, 440, 0);
    const engine = new PhysicsEngine(1.0); // perfectly elastic
    engine.setPentagons([pent]);
    engine.addParticle(
      { x: 0, y: 0 },
      { x: 200, y: 137 }, // arbitrary direction
      0,
      0,
    );

    // Run 1000 steps
    for (let i = 0; i < 1000; i++) {
      engine.step(1 / 240);
    }

    // Particle should still be inside the circumscribed circle
    const p = engine.particles[0];
    const dist = Math.hypot(p.pos.x, p.pos.y);
    expect(dist).toBeLessThan(100 + 1); // allow small numerical tolerance
  });

  it('should conserve speed with damping = 1', () => {
    const pent = buildPentagon(100, 440, 0);
    const engine = new PhysicsEngine(1.0);
    engine.setPentagons([pent]);
    engine.addParticle(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      0,
      0,
    );

    const initialSpeed = vec2.len(engine.particles[0].vel);

    for (let i = 0; i < 500; i++) {
      engine.step(1 / 240);
    }

    const finalSpeed = vec2.len(engine.particles[0].vel);
    expect(finalSpeed).toBeCloseTo(initialSpeed, 4);
  });

  it('should lose energy with damping < 1', () => {
    const pent = buildPentagon(100, 440, 0);
    const engine = new PhysicsEngine(0.98);
    engine.setPentagons([pent]);
    engine.addParticle(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      0,
      0,
    );

    const initialSpeed = vec2.len(engine.particles[0].vel);

    // Run until at least a few bounces
    for (let i = 0; i < 500; i++) {
      engine.step(1 / 240);
    }

    const finalSpeed = vec2.len(engine.particles[0].vel);
    expect(finalSpeed).toBeLessThan(initialSpeed);
  });

  it('should emit CollisionEvents with valid data', () => {
    const pent = buildPentagon(100, 440, 0);
    const engine = new PhysicsEngine(0.99);
    engine.setPentagons([pent]);
    engine.addParticle(
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      0,
      0,
    );

    let allEvents: ReturnType<typeof engine.step> = [];
    for (let i = 0; i < 100; i++) {
      const events = engine.step(1 / 240);
      allEvents.push(...events);
    }

    expect(allEvents.length).toBeGreaterThan(0);
    for (const event of allEvents) {
      expect(event.impactParam).toBeGreaterThanOrEqual(0);
      expect(event.impactParam).toBeLessThanOrEqual(1);
      expect(event.impactSpeed).toBeGreaterThan(0);
      expect(event.edge.index).toBeGreaterThanOrEqual(0);
      expect(event.edge.index).toBeLessThan(5);
      expect(event.timestamp).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle nested pentagons without tunneling', () => {
    const pentagons = buildNestedPentagons(100, 440, 3, 0.5);
    const engine = new PhysicsEngine(0.99);
    engine.setPentagons(pentagons);

    // Start particle between level 0 and level 1
    engine.addParticle(
      { x: 60, y: 0 },
      { x: -200, y: 150 },
      0,
      0,
    );

    for (let i = 0; i < 1000; i++) {
      engine.step(1 / 240);
    }

    // Particle should remain inside outer pentagon
    const p = engine.particles[0];
    const dist = Math.hypot(p.pos.x, p.pos.y);
    expect(dist).toBeLessThan(101);
  });
});
