import type { CollisionEvent, NoteEvent } from '../types';

/**
 * Convert a physics CollisionEvent into a musical NoteEvent.
 *
 * Mappings:
 * - Edge index → frequency (already on the edge)
 * - |v·n| → MIDI velocity (logarithmic compression)
 * - Impact parameter u → brightness / timbre
 * - Edge index → stereo pan position
 */
export function collisionToNote(
  event: CollisionEvent,
  vMax = 500,
  beta = 10,
): NoteEvent {
  const freq = event.edge.frequency;

  // MIDI note number (rounded to nearest semitone for display; actual pitch uses freq)
  const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));

  // Logarithmic velocity mapping: more natural dynamic feel
  const normalizedSpeed = Math.min(event.impactSpeed / vMax, 1);
  const midiVelocity = Math.min(
    127,
    Math.max(
      1,
      Math.floor(
        127 * Math.log(1 + beta * normalizedSpeed) / Math.log(1 + beta),
      ),
    ),
  );

  // Brightness: 1 at center of edge (warm/tasto), 0 at ends (bright/ponticello)
  const u = event.impactParam;
  const brightness = 1 - 4 * (u - 0.5) ** 2;

  // Stereo pan: spread edges across stereo field
  const totalEdges = event.pentagon.edges.length > 1 ? event.pentagon.edges.length - 1 : 4;
  const pan = (2 * event.edge.index) / totalEdges - 1; // [-1, +1]

  return {
    frequency: freq,
    midiNote,
    midiVelocity,
    brightness,
    pentagonLevel: event.pentagon.level,
    edgeIndex: event.edge.index,
    timestamp: event.timestamp,
    pan,
  };
}
