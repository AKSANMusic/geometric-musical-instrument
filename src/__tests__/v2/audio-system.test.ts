import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterLimiter } from '../../audio/MasterLimiter';
import { VoiceManager } from '../../audio/VoiceManager';
import { AudioScheduler } from '../../audio/AudioScheduler';
import { KarplusStrongVoice } from '../../audio/KarplusStrongVoice';
import type { MusicalEvent } from '../../domain/events';

function createMockAudioContext(currentTime = 10.0): AudioContext {
  const mockParam = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };

  const mockNode = {
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  };

  return {
    currentTime,
    sampleRate: 44100,
    createGain: vi.fn(() => ({ ...mockNode, gain: { ...mockParam, value: 1 } })),
    createDelay: vi.fn(() => ({ ...mockNode, delayTime: { ...mockParam, value: 0.01 } })),
    createDynamicsCompressor: vi.fn(() => ({
      ...mockNode,
      threshold: { ...mockParam, value: -12 },
      knee: { ...mockParam, value: 8 },
      ratio: { ...mockParam, value: 3.5 },
      attack: { ...mockParam, value: 0.005 },
      release: { ...mockParam, value: 0.12 },
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
    createBuffer: vi.fn((channels, length) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
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

describe('Audio System V2', () => {
  let ctx: AudioContext;

  beforeEach(() => {
    ctx = createMockAudioContext(10.0);
  });

  describe('MasterLimiter', () => {
    it('should build limiter chain with DC blocker, saturation, compressors, and output', () => {
      const limiter = new MasterLimiter(ctx);
      expect(limiter.input).toBeDefined();
      expect(limiter.output).toBeDefined();
      expect(ctx.createWaveShaper).toHaveBeenCalled();
      expect(ctx.createDynamicsCompressor).toHaveBeenCalledTimes(2); // compressor + brickwall limiter
    });

    it('should update master volume smoothly', () => {
      const limiter = new MasterLimiter(ctx);
      limiter.setVolume(0.5);
      expect(limiter.output.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 10.02);
    });
  });

  describe('KarplusStrongVoice', () => {
    it('should initialize delay line period matching pitch frequency', () => {
      const dest = ctx.createGain();
      const event: MusicalEvent = {
        id: 'test-evt-1',
        time: 10.0,
        pitchHz: 440,
        midiNoteFloat: 69,
        velocity: 0.8,
        duration: 0.5,
        brightness: 0.5,
        pan: 0,
        articulation: 'pluck',
        role: 'stable',
      };

      const voice = new KarplusStrongVoice(ctx, dest, event, 'voice-ks-1');
      expect(voice.pitchHz).toBe(440);
      expect(ctx.createDelay).toHaveBeenCalled();
      expect(ctx.createBuffer).toHaveBeenCalled(); // Excitation impulse synthesized
    });
  });

  describe('VoiceManager', () => {
    it('should track active voices and re-excite common tones without voice allocation', () => {
      const dest = ctx.createGain();
      const vm = new VoiceManager(ctx, dest, 4);

      const event1: MusicalEvent = {
        id: 'evt-vm-1',
        time: 10.0,
        pitchHz: 440,
        midiNoteFloat: 69,
        velocity: 0.8,
        duration: 0.5,
        brightness: 0.5,
        pan: 0,
        articulation: 'pluck',
        role: 'stable',
        voiceId: 'v1',
      };

      vm.trigger(event1);
      expect(vm.getActiveCount()).toBe(1);

      // Trigger identical pitch (common tone)
      const event2: MusicalEvent = {
        ...event1,
        id: 'evt-vm-2',
        time: 10.2,
        commonToneRetained: true,
      };

      vm.trigger(event2);
      expect(vm.getActiveCount()).toBe(1); // Same voice retained, no voice doubling!
    });
  });

  describe('AudioScheduler', () => {
    it('should schedule upcoming events and fire callbacks', () => {
      const dest = ctx.createGain();
      const vm = new VoiceManager(ctx, dest, 4);
      const scheduler = new AudioScheduler(ctx, vm);

      const dispatched: MusicalEvent[] = [];
      scheduler.onDispatch(e => dispatched.push(e));

      // Schedule immediate event
      const immediateEvent: MusicalEvent = {
        id: 'evt-sched-1',
        time: 10.0,
        pitchHz: 440,
        midiNoteFloat: 69,
        velocity: 0.8,
        duration: 0.5,
        brightness: 0.5,
        pan: 0,
        articulation: 'pluck',
        role: 'stable',
      };

      scheduler.schedule(immediateEvent);
      expect(dispatched.length).toBe(1);
      expect(dispatched[0].id).toBe('evt-sched-1');
    });
  });
});
