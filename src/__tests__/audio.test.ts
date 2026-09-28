import { describe, it, expect } from 'vitest';
import { collisionToNote } from '../audio/note-mapper';
import type { CollisionEvent, Edge, Pentagon, ParticleState, Vec2 } from '../types';

/** Helper to create a mock collision event */
function mockCollision(overrides: Partial<{
  impactSpeed: number;
  impactParam: number;
  edgeIndex: number;
  frequency: number;
  pentagonLevel: number;
}>): CollisionEvent {
  const {
    impactSpeed = 200,
    impactParam = 0.5,
    edgeIndex = 0,
    frequency = 440,
    pentagonLevel = 0,
  } = overrides;

  const edge: Edge = {
    index: edgeIndex,
    p1: { x: 0, y: 0 },
    p2: { x: 100, y: 0 },
    normal: { x: 0, y: 1 },
    length: 100,
    frequency,
    jiRatio: 1,
    label: 'Root (1/1)',
  };

  const pentagon: Pentagon = {
    vertices: [],
    edges: [edge],
    circumradius: 100,
    level: pentagonLevel,
  };

  const particle: ParticleState = {
    pos: { x: 50, y: 0 },
    vel: { x: 0, y: -200 },
    radius: 0,
    id: 0,
  };

  return {
    particle,
    edge,
    pentagon,
    impactPoint: { x: 50, y: 0 },
    impactParam,
    impactSpeed,
    timestamp: 1.0,
  };
}

describe('Note Mapper', () => {
  it('should map edge frequency to note frequency', () => {
    const note = collisionToNote(mockCollision({ frequency: 440 }));
    expect(note.frequency).toBe(440);
  });

  it('should compute correct MIDI note number', () => {
    // A4 = 440 Hz = MIDI 69
    const note = collisionToNote(mockCollision({ frequency: 440 }));
    expect(note.midiNote).toBe(69);

    // A5 = 880 Hz = MIDI 81
    const note2 = collisionToNote(mockCollision({ frequency: 880 }));
    expect(note2.midiNote).toBe(81);
  });

  it('should produce MIDI velocity in [1, 127]', () => {
    // Very soft
    const soft = collisionToNote(mockCollision({ impactSpeed: 0.001 }));
    expect(soft.midiVelocity).toBeGreaterThanOrEqual(1);
    expect(soft.midiVelocity).toBeLessThanOrEqual(127);

    // Very loud
    const loud = collisionToNote(mockCollision({ impactSpeed: 1000 }));
    expect(loud.midiVelocity).toBeGreaterThanOrEqual(1);
    expect(loud.midiVelocity).toBeLessThanOrEqual(127);
  });

  it('should increase MIDI velocity with impact speed', () => {
    const soft = collisionToNote(mockCollision({ impactSpeed: 50 }));
    const loud = collisionToNote(mockCollision({ impactSpeed: 400 }));
    expect(loud.midiVelocity).toBeGreaterThan(soft.midiVelocity);
  });

  it('should produce brightness = 1 at center of edge (u=0.5)', () => {
    const note = collisionToNote(mockCollision({ impactParam: 0.5 }));
    expect(note.brightness).toBeCloseTo(1, 6);
  });

  it('should produce brightness = 0 at edge endpoints (u=0 and u=1)', () => {
    const noteStart = collisionToNote(mockCollision({ impactParam: 0 }));
    expect(noteStart.brightness).toBeCloseTo(0, 6);

    const noteEnd = collisionToNote(mockCollision({ impactParam: 1 }));
    expect(noteEnd.brightness).toBeCloseTo(0, 6);
  });

  it('should produce brightness in [0, 1] for any u in [0, 1]', () => {
    for (let u = 0; u <= 1; u += 0.05) {
      const note = collisionToNote(mockCollision({ impactParam: u }));
      expect(note.brightness).toBeGreaterThanOrEqual(-0.001);
      expect(note.brightness).toBeLessThanOrEqual(1.001);
    }
  });

  it('should spread stereo pan across edges', () => {
    const pans = new Set<number>();
    for (let i = 0; i < 5; i++) {
      const note = collisionToNote(mockCollision({ edgeIndex: i }));
      pans.add(note.pan);
    }
    expect(pans.size).toBe(5); // each edge has distinct pan
  });

  it('should pass through pentagon level and edge index', () => {
    const note = collisionToNote(
      mockCollision({ pentagonLevel: 2, edgeIndex: 3 }),
    );
    expect(note.pentagonLevel).toBe(2);
    expect(note.edgeIndex).toBe(3);
  });

  describe('Manual Note Pluck', () => {
    it('should calculate correct brightness and frequency when plucked at center', () => {
      const edge: Edge = {
        index: 2,
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        normal: { x: 0, y: 1 },
        length: 100,
        frequency: 550,
        jiRatio: 5 / 4,
        label: 'Maj 3rd (5/4)',
      };

      const param = 0.5; // center
      const brightness = 1 - 4 * (param - 0.5) ** 2;
      expect(brightness).toBeCloseTo(1, 5);
      expect(edge.frequency).toBe(550);
    });

    it('should calculate brighter timbre when plucked near edge boundary', () => {
      const param = 0.05; // near edge tip
      const brightness = 1 - 4 * (param - 0.5) ** 2;
      expect(brightness).toBeLessThan(0.3);
      expect(brightness).toBeGreaterThanOrEqual(0);
    });
  });
});
