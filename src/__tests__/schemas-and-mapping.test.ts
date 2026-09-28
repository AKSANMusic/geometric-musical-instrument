import { describe, it, expect } from 'vitest';
import {
  createDefaultProjectState,
  validateProjectState,
  migrateProjectState,
  createDefaultMidiRouting,
  createDefaultRangeSchema,
} from '../schemas/project-schema';
import {
  mapSpeedToVelocity,
  mapParamToBrightness,
  mapEdgeToPan,
  mapRadiusToRegister,
  mapCollisionToMusicalEvent,
  DEFAULT_MAPPING_CONFIG,
} from '../mapping/mapping-engine';
import type { CollisionEvent, Pentagon, Edge, ParticleState } from '../types';

describe('Project Schemas & Migration', () => {
  describe('createDefaultProjectState', () => {
    it('should generate valid version 1.0.0 project state', () => {
      const state = createDefaultProjectState('Test Preset');
      expect(state.schemaVersion).toBe('1.0.0');
      expect(state.name).toBe('Test Preset');
      expect(state.geometry.circumradius).toBe(300);
      expect(state.audio.maxVoices).toBe(32);
      expect(state.midi.mode).toBe('mpe');

      const validation = validateProjectState(state);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('validateProjectState', () => {
    it('should reject invalid schema version', () => {
      const invalid = { ...createDefaultProjectState(), schemaVersion: '0.8.0' };
      const res = validateProjectState(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Unsupported schemaVersion');
    });

    it('should reject non-object inputs', () => {
      expect(validateProjectState(null).valid).toBe(false);
      expect(validateProjectState(undefined).valid).toBe(false);
      expect(validateProjectState('string').valid).toBe(false);
    });

    it('should identify missing required blocks', () => {
      const broken = { schemaVersion: '1.0.0' };
      const res = validateProjectState(broken);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(1);
    });
  });

  describe('migrateProjectState', () => {
    it('should migrate partial unversioned legacy config to 1.0.0', () => {
      const legacy = {
        name: 'Old Session',
        scaleKey: 'chahargah',
        rootKey: 'D',
        ballEnabled: false,
        reverbMix: 0.5,
      };

      const migrated = migrateProjectState(legacy);
      expect(migrated.schemaVersion).toBe('1.0.0');
      expect(migrated.name).toBe('Old Session');
      expect(migrated.geometry.scaleKey).toBe('chahargah');
      expect(migrated.geometry.rootKey).toBe('D');
      expect(migrated.physics.enabled).toBe(false);
      expect(migrated.audio.reverbMix).toBe(0.5);
      expect(migrated.midi.mode).toBe('mpe'); // upgraded to MPE default
    });

    it('should return valid default state when given empty or null input', () => {
      const migrated = migrateProjectState(null);
      expect(migrated.schemaVersion).toBe('1.0.0');
      expect(validateProjectState(migrated).valid).toBe(true);
    });
  });
});

describe('Mapping Engine', () => {
  describe('mapSpeedToVelocity', () => {
    it('should compress speed logarithmically by default', () => {
      const vMin = mapSpeedToVelocity(0);
      const vMid = mapSpeedToVelocity(250);
      const vMax = mapSpeedToVelocity(500);

      expect(vMin).toBe(1);
      expect(vMax).toBe(127);
      // Logarithmic curve: mid-speed gives higher than half velocity
      expect(vMid).toBeGreaterThan(64);
    });

    it('should support linear curve', () => {
      const vLinear = mapSpeedToVelocity(250, {
        ...DEFAULT_MAPPING_CONFIG,
        velocityCurve: 'linear',
      });
      expect(vLinear).toBeCloseTo(64, -1);
    });

    it('should clamp speeds exceeding maxImpactSpeed', () => {
      const vOver = mapSpeedToVelocity(1000);
      expect(vOver).toBe(127);
    });
  });

  describe('mapParamToBrightness', () => {
    it('should peak at edge center (u=0.5) for parabolic-center curve', () => {
      const center = mapParamToBrightness(0.5);
      const tip0 = mapParamToBrightness(0);
      const tip1 = mapParamToBrightness(1);

      expect(center).toBe(1.0);
      expect(tip0).toBe(0.0);
      expect(tip1).toBe(0.0);
    });

    it('should clamp u out of range', () => {
      expect(mapParamToBrightness(-0.2)).toBe(0);
      expect(mapParamToBrightness(1.5)).toBe(0);
    });
  });

  describe('mapEdgeToPan', () => {
    it('should spread edges across [-1, +1]', () => {
      // 5-sided polygon: indices 0, 1, 2, 3, 4
      expect(mapEdgeToPan(0, 5)).toBe(-1);
      expect(mapEdgeToPan(2, 5)).toBe(0);
      expect(mapEdgeToPan(4, 5)).toBe(1);
    });

    it('should return 0 for single edge', () => {
      expect(mapEdgeToPan(0, 1)).toBe(0);
    });
  });

  describe('mapRadiusToRegister', () => {
    it('should map ring level to octave register', () => {
      expect(mapRadiusToRegister(0)).toBe(0);
      expect(mapRadiusToRegister(2)).toBe(2);
    });
  });

  describe('mapCollisionToMusicalEvent', () => {
    it('should produce a complete canonical MusicalEvent from a CollisionEvent', () => {
      const mockEdge: Edge = {
        index: 2,
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        normal: { x: 0, y: 1 },
        length: 100,
        frequency: 440,
        jiRatio: 1,
        label: 'A4',
      };

      const mockPentagon: Pentagon = {
        vertices: [],
        edges: [mockEdge, mockEdge, mockEdge, mockEdge, mockEdge],
        circumradius: 300,
        level: 1,
      };

      const mockParticle: ParticleState = {
        pos: { x: 50, y: 0 },
        vel: { x: 0, y: -250 },
        radius: 0,
        id: 1,
      };

      const mockCollision: CollisionEvent = {
        particle: mockParticle,
        edge: mockEdge,
        pentagon: mockPentagon,
        impactPoint: { x: 50, y: 0 },
        impactParam: 0.5, // exact center
        impactSpeed: 250,
        timestamp: 1.25,
      };

      const event = mapCollisionToMusicalEvent(mockCollision);

      expect(event.type).toBe('noteOn');
      expect(event.source).toBe('physics');
      expect(event.frequencyHz).toBe(440);
      expect(event.midiNote).toBe(69);
      expect(event.cents).toBe(0);
      expect(event.brightness).toBe(1.0); // center of edge
      expect(event.pentagonLevel).toBe(1);
      expect(event.audioEnabled).toBe(true);
      expect(event.midiEnabled).toBe(true);
    });
  });
});
