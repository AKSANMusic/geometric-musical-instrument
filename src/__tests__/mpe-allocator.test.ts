import { describe, it, expect, beforeEach } from 'vitest';
import {
  MPEAllocator,
  DEFAULT_MPE_CONFIG,
  type MPEConfig,
  type MPEAllocateResult,
} from '../midi/mpe-allocator';

describe('MPEAllocator', () => {
  let allocator: MPEAllocator;

  beforeEach(() => {
    allocator = new MPEAllocator();
  });

  describe('initialization', () => {
    it('should use lower zone by default', () => {
      expect(allocator.masterChannel).toBe(0);
    });

    it('should have 13 member channels (skipping drum ch 10)', () => {
      expect(allocator.capacity).toBe(13);
    });

    it('should start with zero active notes', () => {
      expect(allocator.activeCount).toBe(0);
    });

    it('should support upper zone configuration', () => {
      const upper = new MPEAllocator({ ...DEFAULT_MPE_CONFIG, zone: 'upper' });
      expect(upper.masterChannel).toBe(15);
      expect(upper.capacity).toBe(13);
    });
  });

  describe('channel allocation', () => {
    it('should allocate a channel for a new note', () => {
      const result = allocator.allocate('note-1', 440, 100);
      expect(result.success).toBe(true);
      expect(result.allocation).toBeDefined();
      expect(result.allocation!.channel).toBeGreaterThan(0); // Not master ch
      expect(allocator.activeCount).toBe(1);
    });

    it('should allocate different channels for simultaneous notes', () => {
      const r1 = allocator.allocate('n1', 440, 100);
      const r2 = allocator.allocate('n2', 550, 100);
      expect(r1.allocation!.channel).not.toBe(r2.allocation!.channel);
      expect(allocator.activeCount).toBe(2);
    });

    it('should reject when disabled', () => {
      allocator.setConfig({ enabled: false });
      const result = allocator.allocate('n1', 440, 100);
      expect(result.success).toBe(false);
    });
  });

  describe('bend-before-note ordering', () => {
    it('should send pitch bend BEFORE note-on', () => {
      const result = allocator.allocate('n1', 440, 100);
      expect(result.messages.length).toBe(2);
      // First message should be pitch bend (0xEn)
      expect(result.messages[0].data[0] & 0xf0).toBe(0xe0);
      // Second message should be note on (0x9n)
      expect(result.messages[1].data[0] & 0xf0).toBe(0x90);
    });
  });

  describe('microtonal pitch bend', () => {
    it('should calculate correct bend for A4 (440 Hz) = zero offset', () => {
      const result = allocator.allocate('n1', 440, 100);
      const bendMsg = result.messages[0].data;
      const bend14 = bendMsg[1] | (bendMsg[2] << 7);
      // 440 Hz = MIDI 69 exactly, so bend should be center (8192)
      expect(bend14).toBe(8192);
    });

    it('should calculate non-zero bend for microtonal frequency', () => {
      // 12/11 * 440 ≈ 480 Hz (koron second, ~150.6 cents above A4)
      // This rounds to MIDI 71 (B♭4), with a negative offset of ~-49.4 cents
      const koronFreq = 440 * (12 / 11);
      const result = allocator.allocate('n1', koronFreq, 100);
      const bendMsg = result.messages[0].data;
      const bend14 = bendMsg[1] | (bendMsg[2] << 7);
      // Bend should NOT be at center (8192) since this is a microtonal pitch
      expect(bend14).not.toBe(8192);
      expect(bend14).toBeGreaterThanOrEqual(0);
      expect(bend14).toBeLessThanOrEqual(16383);
    });

    it('should isolate bends between simultaneous notes', () => {
      const r1 = allocator.allocate('n1', 440, 100);         // A4 exact
      const r2 = allocator.allocate('n2', 440 * 12 / 11, 100); // Koron
      
      // Different channels
      const ch1 = r1.allocation!.channel;
      const ch2 = r2.allocation!.channel;
      expect(ch1).not.toBe(ch2);

      // Different pitch bends
      const bend1 = r1.messages[0].data[1] | (r1.messages[0].data[2] << 7);
      const bend2 = r2.messages[0].data[1] | (r2.messages[0].data[2] << 7);
      expect(bend1).not.toBe(bend2);
    });
  });

  describe('note release', () => {
    it('should free channel on release', () => {
      allocator.allocate('n1', 440, 100);
      expect(allocator.activeCount).toBe(1);
      const result = allocator.release('n1');
      expect(result.success).toBe(true);
      expect(allocator.activeCount).toBe(0);
    });

    it('should send note-off and reset pitch bend on release', () => {
      allocator.allocate('n1', 440, 100);
      const result = allocator.release('n1');
      expect(result.messages.length).toBe(2);
      // Note off
      expect(result.messages[0].data[0] & 0xf0).toBe(0x80);
      // Pitch bend reset to center
      expect(result.messages[1].data[0] & 0xf0).toBe(0xe0);
      const resetBend = result.messages[1].data[1] | (result.messages[1].data[2] << 7);
      expect(resetBend).toBe(8192); // Center
    });

    it('should fail silently for unknown note ID', () => {
      const result = allocator.release('nonexistent');
      expect(result.success).toBe(false);
      expect(result.messages).toHaveLength(0);
    });

    it('should allow channel reuse after release', () => {
      const r1 = allocator.allocate('n1', 440, 100);
      const ch1 = r1.allocation!.channel;
      allocator.release('n1');
      
      const r2 = allocator.allocate('n2', 550, 100);
      expect(r2.allocation!.channel).toBe(ch1); // Same channel reused
    });
  });

  describe('channel exhaustion', () => {
    it('should steal oldest when all channels occupied (default policy)', () => {
      // Fill all 13 channels
      for (let i = 0; i < 13; i++) {
        allocator.allocate(`n${i}`, 220 + i * 20, 100, i * 100);
      }
      expect(allocator.activeCount).toBe(13);

      // Allocate one more — should steal oldest
      const result = allocator.allocate('n-new', 800, 100, 5000);
      expect(result.success).toBe(true);
      expect(result.stolenNoteId).toBe('n0'); // Oldest
      expect(allocator.activeCount).toBe(13); // Still at capacity
    });

    it('should reject when policy is reject', () => {
      const rejectAlloc = new MPEAllocator({
        ...DEFAULT_MPE_CONFIG,
        exhaustionPolicy: 'reject',
      });

      for (let i = 0; i < 13; i++) {
        rejectAlloc.allocate(`n${i}`, 220 + i * 20, 100);
      }

      const result = rejectAlloc.allocate('overflow', 800, 100);
      expect(result.success).toBe(false);
      expect(result.policy).toBe('reject');
    });

    it('should quantize to 12-TET on master channel when policy is quantize', () => {
      const quantizeAlloc = new MPEAllocator({
        ...DEFAULT_MPE_CONFIG,
        exhaustionPolicy: 'quantize',
      });

      for (let i = 0; i < 13; i++) {
        quantizeAlloc.allocate(`n${i}`, 220 + i * 20, 100);
      }

      const result = quantizeAlloc.allocate('overflow', 800, 100);
      expect(result.success).toBe(true);
      expect(result.policy).toBe('quantize');
      // Should use master channel (0)
      expect(result.messages[1].data[0] & 0x0f).toBe(0);
    });
  });

  describe('RPN messages', () => {
    it('should generate RPN pitch bend range messages for all member channels', () => {
      const messages = allocator.buildRPNMessages();
      // 4 messages per channel × 13 channels = 52 messages
      expect(messages.length).toBe(52);
      // First message should be CC 101 = 0 on channel 2 (index 1)
      expect(messages[0].data).toEqual([0xb0 | 1, 101, 0]);
    });

    it('should use configured pitch bend range', () => {
      const custom = new MPEAllocator({
        ...DEFAULT_MPE_CONFIG,
        pitchBendRangeSemitones: 4,
      });
      const messages = custom.buildRPNMessages();
      // Check CC 6 (data entry) = 4
      expect(messages[2].data[2]).toBe(4);
    });
  });

  describe('panic', () => {
    it('should clear all notes and send all-notes-off on every channel', () => {
      allocator.allocate('n1', 440, 100);
      allocator.allocate('n2', 550, 100);
      
      const messages = allocator.panic();
      expect(allocator.activeCount).toBe(0);
      // 2 messages per member channel (13) + 2 for master = 28
      expect(messages.length).toBe(28);
    });
  });

  describe('velocity and note clamping', () => {
    it('should clamp MIDI note to 0-127', () => {
      // Very low frequency
      const result = allocator.allocate('low', 8.0, 100);
      expect(result.allocation!.midiNote).toBeGreaterThanOrEqual(0);
      expect(result.allocation!.midiNote).toBeLessThanOrEqual(127);
    });

    it('should clamp velocity to 1-127', () => {
      const r1 = allocator.allocate('n1', 440, 0);
      expect(r1.allocation!.velocity).toBe(1);
      const r2 = allocator.allocate('n2', 440, 200);
      expect(r2.allocation!.velocity).toBe(127);
    });
  });
});
