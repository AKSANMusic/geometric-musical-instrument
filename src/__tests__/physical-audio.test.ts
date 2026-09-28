import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BowedStringVoice } from '../audio/physical-bow-string';
import { AccordionReedVoice } from '../audio/accordion-reed';
import { DASTGAH_PRESETS, DroneSynthesizer } from '../audio/dastgah-engine';
import { VoiceAllocator } from '../audio/voice-allocator';
import type { NoteEvent } from '../types';

// Mock Web Audio API for headless testing
function createMockAudioContext(): AudioContext {
  const mockParam = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };

  const mockNode = {
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  return {
    currentTime: 10.0,
    sampleRate: 44100,
    createGain: vi.fn(() => ({ ...mockNode, gain: { ...mockParam, value: 1 } })),
    createOscillator: vi.fn(() => ({
      ...mockNode,
      frequency: { ...mockParam, value: 440 },
      detune: { ...mockParam, value: 0 },
      type: 'sine',
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
      ...mockNode,
      frequency: { ...mockParam, value: 1000 },
      Q: { ...mockParam, value: 1 },
      gain: { ...mockParam, value: 0 },
      type: 'lowpass',
    })),
    createStereoPanner: vi.fn(() => ({ ...mockNode, pan: { ...mockParam, value: 0 } })),
    createWaveShaper: vi.fn(() => ({ ...mockNode, curve: null, oversample: 'none' })),
    createBuffer: vi.fn(() => ({
      getChannelData: vi.fn(() => new Float32Array(100)),
    })),
    createBufferSource: vi.fn(() => ({
      ...mockNode,
      buffer: null,
      loop: false,
      start: vi.fn(),
      stop: vi.fn(),
    })),
  } as unknown as AudioContext;
}

describe('Physical Bowed String Model (Cello / Kamancheh)', () => {
  let ctx: AudioContext;
  let destination: AudioNode;

  beforeEach(() => {
    ctx = createMockAudioContext();
    destination = ctx.createGain();
  });

  it('should initialize BowedStringVoice with realistic parameters', () => {
    const voice = new BowedStringVoice(
      ctx,
      destination,
      {
        frequency: 130.81, // C3 cello
        bowVelocity: 0.7,
        bowForce: 0.8,
        contactPoint: 0.08, // Near bridge (ponticello)
      },
      1,
      -0.2,
    );

    expect(voice.id).toBe(1);
    expect(voice.ended).toBe(false);
    expect(voice.startTime).toBe(10.0);
  });

  it('should support dynamic bow updates during performance', () => {
    const voice = new BowedStringVoice(
      ctx,
      destination,
      {
        frequency: 220,
        bowVelocity: 0.5,
        bowForce: 0.5,
        contactPoint: 0.15,
      },
      2,
    );

    expect(() => voice.updateBow(0.9, 0.85, 0.06)).not.toThrow();
  });

  it('should calculate priority score favoring bass and newly struck notes', () => {
    const bassVoice = new BowedStringVoice(
      ctx,
      destination,
      { frequency: 65.41, bowVelocity: 0.5, bowForce: 0.5, contactPoint: 0.15 },
      1,
    );

    const trebleVoice = new BowedStringVoice(
      ctx,
      destination,
      { frequency: 523.25, bowVelocity: 0.5, bowForce: 0.5, contactPoint: 0.15 },
      2,
    );

    // At onset (time = 10.0), bass voice should have higher priority score
    expect(bassVoice.getPriorityScore(10.0)).toBeGreaterThan(trebleVoice.getPriorityScore(10.0));
  });

  it('should release cleanly without throwing', () => {
    const voice = new BowedStringVoice(
      ctx,
      destination,
      { frequency: 196, bowVelocity: 0.5, bowForce: 0.5, contactPoint: 0.15 },
      1,
    );

    voice.release(0.1);
    expect(voice.ended).toBe(true);
  });
});

describe('Physical Accordion Reed Model', () => {
  let ctx: AudioContext;
  let destination: AudioNode;

  beforeEach(() => {
    ctx = createMockAudioContext();
    destination = ctx.createGain();
  });

  it('should initialize AccordionReedVoice with dual-reed musette detune', () => {
    const voice = new AccordionReedVoice(
      ctx,
      destination,
      {
        frequency: 261.63, // C4
        bellowsPressure: 0.75,
        musetteDetuneCents: 6.0,
        cassottoTone: true,
      },
      1,
    );

    expect(voice.id).toBe(1);
    expect(voice.ended).toBe(false);
  });

  it('should modulate bellows pressure dynamically', () => {
    const voice = new AccordionReedVoice(
      ctx,
      destination,
      { frequency: 440, bellowsPressure: 0.4 },
      2,
    );

    expect(() => voice.setBellowsPressure(0.95)).not.toThrow();
  });
});

describe('Dastgah & Modal Drone Engine', () => {
  it('should provide complete scale definitions for Persian Dastgahs', () => {
    expect(DASTGAH_PRESETS.shur).toBeDefined();
    expect(DASTGAH_PRESETS.homayoun).toBeDefined();
    expect(DASTGAH_PRESETS.segah).toBeDefined();
    expect(DASTGAH_PRESETS.chahargah).toBeDefined();
    expect(DASTGAH_PRESETS.mahur).toBeDefined();
    expect(DASTGAH_PRESETS.esfahan).toBeDefined();
    expect(DASTGAH_PRESETS.nava).toBeDefined();
  });

  it('should contain Koron degree in Dastgah-e Shur with neutral second', () => {
    const shur = DASTGAH_PRESETS.shur;
    const koronDegree = shur.degrees[1];
    expect(koronDegree.name).toContain('کرون');
    expect(koronDegree.ratio).toBeCloseTo(12 / 11, 4);
    expect(koronDegree.intervalCents).toBeGreaterThan(140);
    expect(koronDegree.intervalCents).toBeLessThan(160);
  });

  it('should instantiate DroneSynthesizer and support modulation', () => {
    const ctx = createMockAudioContext();
    const dest = ctx.createGain();
    const drone = new DroneSynthesizer(ctx, dest);

    expect(drone.active).toBe(false);
    drone.start(DASTGAH_PRESETS.shur, 146.83);
    expect(drone.active).toBe(true);

    // Modulate to Homayoun
    expect(() => drone.modulateTo(DASTGAH_PRESETS.homayoun, 130.81)).not.toThrow();

    drone.stop(0.1);
  });
});

describe('Physical Voice Allocator Routing', () => {
  let ctx: AudioContext;
  let destination: AudioNode;

  beforeEach(() => {
    ctx = createMockAudioContext();
    destination = ctx.createGain();
  });

  const dummyNote: NoteEvent = {
    frequency: 146.83,
    midiNote: 50,
    midiVelocity: 100,
    brightness: 0.5,
    pentagonLevel: 0,
    edgeIndex: 0,
    timestamp: 10.0,
    pan: 0,
  };

  it('should instantiate BowedStringVoice when preset is swamCello', () => {
    const allocator = new VoiceAllocator(ctx, destination, 8, 20, 1.8, 'swamCello');
    const voice = allocator.trigger(dummyNote);

    expect(voice).toBeInstanceOf(BowedStringVoice);
    expect(allocator.activeVoices).toBe(1);
  });

  it('should instantiate AccordionReedVoice when preset is accordion', () => {
    const allocator = new VoiceAllocator(ctx, destination, 8, 20, 1.8, 'accordion');
    const voice = allocator.trigger(dummyNote);

    expect(voice).toBeInstanceOf(AccordionReedVoice);
    expect(allocator.activeVoices).toBe(1);
  });
});
