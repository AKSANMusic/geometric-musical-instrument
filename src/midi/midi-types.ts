/**
 * midi-types.ts — Minimal standalone Web MIDI API type definitions
 *
 * Ensures 100% strict TypeScript compilation and cross-environment testing
 * without requiring external @types/webmidi.
 */

export interface MIDIInput {
  readonly id: string;
  readonly name?: string;
  readonly manufacturer?: string;
  readonly state: string;
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

export interface MIDIOutput {
  readonly id: string;
  readonly name?: string;
  readonly manufacturer?: string;
  readonly state: string;
  send(data: number[] | Uint8Array, timestamp?: number): void;
}

export interface MIDIMessageEvent {
  readonly data: Uint8Array | number[];
  readonly timeStamp?: number;
}

export interface MIDIAccess {
  readonly inputs: Map<string, MIDIInput>;
  readonly outputs: Map<string, MIDIOutput>;
  onstatechange: ((event: Event) => void) | null;
}
