/**
 * PointerController.ts — Multi-Touch & Pointer Gestural Interaction Engine
 *
 * Implements REBUILD_SPEC_V2.md Layer B:
 * - Tap / Pluck: Instantaneous pluck at exact position u along the string.
 * - Swipe / Strum: Rapid arpeggiation across multiple concentric pentagon sides.
 * - Hold / Bow: Continuous friction bowing gesture with durationHint.
 * - Converts raw screen gestures into canonical GeometricEvents.
 */

import type { GeometricEvent } from '../domain/events';
import { generateEventId } from '../domain/events';
import type { Pentagon } from '../geometry/PentagonModel';

export type GeometricEventCallback = (event: GeometricEvent) => void;

interface PointerTrack {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  isBowing: boolean;
  activeSide?: { ringIndex: number; sideIndex: number };
}

export class PointerController {
  private canvas: HTMLCanvasElement;
  private pentagons: Pentagon[] = [];
  private onEvent: GeometricEventCallback;
  private activePointers: Map<number, PointerTrack> = new Map();
  private originX = 0;
  private originY = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onEvent: GeometricEventCallback,
  ) {
    this.canvas = canvas;
    this.onEvent = onEvent;
    this.attachEventListeners();
  }

  public setGeometry(pentagons: Pentagon[], originX: number, originY: number): void {
    this.pentagons = pentagons;
    this.originX = originX;
    this.originY = originY;
  }

  private attachEventListeners(): void {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
  }

  public dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    this.activePointers.clear();
  }

  private getCanvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - this.originX,
      y: e.clientY - rect.top - this.originY,
    };
  }

  private handlePointerDown = (e: PointerEvent): void => {
    const pt = this.getCanvasPoint(e);
    const now = performance.now();

    const track: PointerTrack = {
      id: e.pointerId,
      startX: pt.x,
      startY: pt.y,
      lastX: pt.x,
      lastY: pt.y,
      startTime: now,
      isBowing: false,
    };

    this.activePointers.set(e.pointerId, track);

    // Find nearest string/side to pluck
    const hit = this.findNearestEdge(pt.x, pt.y);
    if (hit && hit.distance < 36) {
      track.activeSide = { ringIndex: hit.ringIndex, sideIndex: hit.sideIndex };

      const event: GeometricEvent = {
        id: generateEventId('geo-pluck'),
        time: now / 1000,
        source: 'manual',
        sideIndex: hit.sideIndex,
        ringIndex: hit.ringIndex,
        normalizedPosition: hit.u,
        velocity: 0.8,
        durationHint: 0.4,
      };

      this.onEvent(event);
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const track = this.activePointers.get(e.pointerId);
    if (!track) return;

    const pt = this.getCanvasPoint(e);
    const now = performance.now();
    const dt = Math.max(1, now - track.startTime);
    const speed = Math.hypot(pt.x - track.lastX, pt.y - track.lastY);

    const hit = this.findNearestEdge(pt.x, pt.y);
    if (hit && hit.distance < 28) {
      const isNewSide = !track.activeSide ||
        track.activeSide.ringIndex !== hit.ringIndex ||
        track.activeSide.sideIndex !== hit.sideIndex;

      if (isNewSide && speed > 5) {
        // Strumming / swipe gesture crossing an edge
        track.activeSide = { ringIndex: hit.ringIndex, sideIndex: hit.sideIndex };

        const normalizedVel = Math.max(0.3, Math.min(1.0, speed / 25));
        const event: GeometricEvent = {
          id: generateEventId('geo-swipe'),
          time: now / 1000,
          source: 'manual',
          sideIndex: hit.sideIndex,
          ringIndex: hit.ringIndex,
          normalizedPosition: hit.u,
          velocity: normalizedVel,
          durationHint: 0.35,
        };
        this.onEvent(event);
      } else if (!isNewSide && dt > 200 && speed < 8) {
        // Sustained bowing along the string
        track.isBowing = true;
        const event: GeometricEvent = {
          id: generateEventId('geo-bow'),
          time: now / 1000,
          source: 'manual',
          sideIndex: hit.sideIndex,
          ringIndex: hit.ringIndex,
          normalizedPosition: hit.u,
          velocity: 0.65,
          durationHint: 1.2, // Continuous sustain hint
        };
        this.onEvent(event);
      }
    }

    track.lastX = pt.x;
    track.lastY = pt.y;
  };

  private handlePointerUp = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
  };

  /**
   * Find nearest edge across all pentagon rings.
   */
  public findNearestEdge(px: number, py: number): {
    ringIndex: number;
    sideIndex: number;
    u: number;
    distance: number;
  } | null {
    if (this.pentagons.length === 0) return null;

    let bestDist = Infinity;
    let bestRing = 0;
    let bestSide = 0;
    let bestU = 0.5;

    for (let r = 0; r < this.pentagons.length; r++) {
      const pent = this.pentagons[r];
      for (let s = 0; s < pent.edges.length; s++) {
        const edge = pent.edges[s];
        const ax = edge.p1.x;
        const ay = edge.p1.y;
        const bx = edge.p2.x;
        const by = edge.p2.y;

        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;

        let u = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
        u = Math.max(0, Math.min(1, u));

        const projX = ax + u * dx;
        const projY = ay + u * dy;
        const dist = Math.hypot(px - projX, py - projY);

        if (dist < bestDist) {
          bestDist = dist;
          bestRing = pent.level;
          bestSide = s;
          bestU = u;
        }
      }
    }

    return {
      ringIndex: bestRing,
      sideIndex: bestSide,
      u: bestU,
      distance: bestDist,
    };
  }
}
