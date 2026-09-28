# MIDI & MPE (MIDI Polyphonic Expression) Specification

This document details the communication protocol, message ordering, channel allocation policies, and 14-bit pitch bend algorithms used for microtonal precision with external hardware and DAWs.

---

## 1. The Microtonal Polyphony Dilemma

Standard MIDI 1.0 transmits Pitch Bend (`0xE0`) on a per-channel basis.
If note $A_4$ ($440\text{ Hz}$, $0\text{ cents}$) and note $B_{4\text{koron}}$ ($480\text{ Hz}$, $+51\text{ cents}$) are played polyphonically on Channel 1:
- Sending a $+51\text{ cents}$ pitch bend for $B_{4\text{koron}}$ will simultaneously detune the sustaining $A_4$ out of pitch!

**The Solution: MPE (MIDI Polyphonic Expression)**
MPE divides the 16 MIDI channels into a Master Channel and a set of Member Channels, giving every distinct note its own isolated channel with independent pitch bend.

---

## 2. MPE Zone Architecture

The system implements the full MPE profile with both Lower and Upper zone capabilities:

### 2.1 Lower Zone Configuration (Default)
* **Master Channel:** Channel 1 (`0x00` in 0-indexed byte representation).
  - Used for global parameters, program changes, master pitch bend.
* **Member Channels:** Channels 2 to 15 (excluding drum channel 10):
  $$\text{Members} = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14] \quad (\text{capacity} = 13 \text{ notes})$$

### 2.2 Upper Zone Configuration
* **Master Channel:** Channel 16 (`0x0F`).
* **Member Channels:** Channels 15 down to 2 (reverse order, skipping channel 10).

---

## 3. High-Resolution 14-Bit Pitch Bend Mathematics

Standard pitch bend consists of a 14-bit integer formed by two 7-bit MIDI bytes (LSB and MSB):

$$\text{bend}_{14} \in [0, 16383], \quad \text{center} = 8192 \quad (\text{exact 12-TET})$$

### 3.1 Deriving Cent Offsets
Given target frequency $f$ and base MIDI note $m = \text{round}(69 + 12\log_2(f / 440))$:

$$\Delta \text{cents} = 100 \cdot \left( \left(69 + 12\log_2\left(\frac{f}{440}\right)\right) - m \right) \in [-50, +50]$$

### 3.2 Conversion to 14-Bit Value
With configurable pitch bend sensitivity range $R_{\text{semitones}}$ (default $R = 2$, range $= \pm 200\text{ cents}$):

$$\Delta \text{cents}_{\text{clamped}} = \max(-100 R, \min(100 R, \Delta \text{cents}))$$
$$\text{bend}_{14} = \text{round}\left( 8192 + \frac{\Delta \text{cents}_{\text{clamped}}}{100 R} \cdot 8191 \right)$$
$$\text{LSB} = \text{bend}_{14} \ \& \ 0x7F$$
$$\text{MSB} = (\text{bend}_{14} \gg 7) \ \& \ 0x7F$$

---

## 4. Message Ordering Protocol: "Bend-Before-Note"

A common flaw in rudimentary MIDI generators is sending `NoteOn` followed by `PitchBend`. In sample-based instruments or virtual synths, this causes an audible "swoop" or pitch glide as the note starts at 12-TET and quickly bends to the microtonal pitch.

**Mandatory Invariant:**
Every allocated note **MUST** transmit the `PitchBend` message **prior** to the `NoteOn` message:

```
Step 1: [0xEn, LSB, MSB]  (Channel n Pitch Bend configured to exact cents)
Step 2: [0x9n, Note, Vel] (Channel n Note-On triggered at already-bent pitch)
```

### Note Release Cycle
Upon note cessation:
```
Step 1: [0x8n, Note, 0]   (Note-Off on Channel n)
Step 2: [0xEn, 0x00, 0x40] (Reset Pitch Bend to Center: 8192)
```

---

## 5. Channel Exhaustion Policies

When all 13 member channels are occupied and a 14th microtonal note arrives, the `MPEAllocator` enforces one of four selectable policies:

1. **`steal-oldest` (Default):**
   Identifies the active note with the earliest allocation timestamp. Releases that note (`NoteOff` + bend reset) and immediately reallocates its channel.
2. **`quantize`:**
   Sends the note to the Master Channel without pitch bend, quantized to the nearest 12-TET semitone.
3. **`reject`:**
   Silently ignores external MIDI output for this note, avoiding detuning any existing voice.
4. **`internal-only`:**
   Sounds the note in the internal Web Audio engine (which has unlimited microtonal polyphony) while omitting MIDI transmission.

---

## 6. RPN Initialization & All-Notes-Off (Panic)

### 6.1 RPN 0 Sensitivity Messages
Upon DAW connection, `buildRPNMessages()` broadcasts the pitch bend sensitivity to all channels:
* CC 101 (`0x65`) = 0 (RPN Parameter MSB)
* CC 100 (`0x64`) = 0 (RPN Parameter LSB: Pitch Bend Sensitivity)
* CC 6 (`0x06`) = $R_{\text{semitones}}$ (Data Entry MSB)
* CC 38 (`0x26`) = 0 (Data Entry LSB: Fine cents)

### 6.2 Panic Routine
`panic()` sends CC 120 (All Sound Off) and CC 123 (All Notes Off) across all member channels plus the master channel, followed by clearing all active voice registries.
