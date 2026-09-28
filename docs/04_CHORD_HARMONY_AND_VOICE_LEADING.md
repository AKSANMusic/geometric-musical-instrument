# Chord Harmony, Voice Leading & Instrument Range Mapping

This document explains the harmonic foundation, accordion-style chord mechanics, intelligent voice leading algorithms, and instrument range confinement designed into the system.

---

## 1. Accordion-Style Harmonic Model

In traditional accordions (Stradella bass system), buttons are grouped into bass notes and pre-formed chords (Major, Minor, 7th, Diminished).
In this instrument:
- **Keys `A` to `J`:** Trigger distinct geometric chord configurations (e.g. Tonic, Dominant, Subdominant, Mediant, Koron-Modal).
- **Keys `1` to `7`:** Trigger high-register soprano melody notes.
- **Physical Key Hold:** Chords sustain as long as the key is physically depressed and dissolve smoothly into each other when transitioning.

```
Harmonic Layout (Left Hand / Lower Row):
[ A ]  Tonic Major (1/1, 5/4, 3/2)
[ S ]  Subdominant (4/3, 5/3, 2/1)
[ D ]  Dominant (3/2, 15/8, 9/4)
[ F ]  Relative Minor (5/3, 1/1, 5/4)
[ G ]  Koron Modal (Dastgah Shur: 1/1, 12/11, 3/2)
[ H ]  Extended 7th
[ J ]  Deep Pedal Bass
```

---

## 2. Intelligent Voice Leading (Smooth Harmonic Transitions)

When moving between chords (e.g. from chord $C = \{p_1, p_2, \dots, p_k\}$ to chord $C' = \{p'_1, p'_2, \dots, p'_k\}$), raw transposition sounds disjointed. The voice-leading engine calculates the optimal permutation and octave inversions that minimize the total melodic distance traveled by all voices.

### 2.1 The Pitch Distance Metric
Let $P(v)$ be the continuous pitch value in semitones of voice $v$.
For any bijective assignment $\pi: C \to C'$, the total voice leading distance is:

$$\mathcal{D}(\pi) = \sum_{i=1}^{k} |P(p_i) - P(\pi(p_i))|$$

### 2.2 Inversion Search & Octave Permutations
For each candidate target chord inversion $C'_{\text{inv}}$ (root, 1st, 2nd, 3rd inversion):
1. Compute the optimal bipartite matching between current voice pitches and target voice pitches (using the Hungarian algorithm or greedy smallest distance for $k \le 4$).
2. Apply penalty terms for:
   - Voice crossing ($\text{voice}_a < \text{voice}_b$ but $P(a) > P(b)$).
   - Large leaps ($|P_i - P'_i| > 7$ semitones).
   - Parallel perfect octaves or fifths where applicable.
3. Select the chord voicing that minimizes:
   $$\mathcal{J} = \mathcal{D}(\pi) + \lambda_1 \cdot \text{leaps} + \lambda_2 \cdot \text{crossings}$$

### 2.3 Common-Tone Retention
If a pitch class in $C'$ is within $\pm 10\text{ cents}$ of an already sounding voice in $C$, that physical voice is sustained or tied over rather than retriggered, producing seamless transitions like acoustic organ bellows.

---

## 3. Instrument Range Constraints & Octave Folding

Different acoustic instruments operate within strict physical tessituras. The engine includes an explicit Range Limiter and Octave Folding module (`InstrumentRange`).

### 3.1 Supported Instrument Profiles
* **Cello (Violoncello):**
  - Minimum Note: $C_2$ ($65.41\text{ Hz}$, MIDI 36)
  - Maximum Note: $G_5$ ($783.99\text{ Hz}$, MIDI 79)
  - Sweet Spot: $G_2$ to $C_5$
* **Piano (88-key):**
  - $A_0$ ($27.50\text{ Hz}$, MIDI 21) to $C_8$ ($4186.01\text{ Hz}$, MIDI 108)
* **Kamancheh / Violin:**
  - $G_3$ ($196.00\text{ Hz}$, MIDI 55) to $E_7$ ($2637.02\text{ Hz}$, MIDI 100)
* **Tar / Setar:**
  - $C_3$ ($130.81\text{ Hz}$, MIDI 48) to $G_5$ ($783.99\text{ Hz}$, MIDI 79)

### 3.2 Octave Folding Algorithm
When an event pitch $f$ falls outside $[f_{\min}, f_{\max}]$:

$$\text{while } f < f_{\min}: \quad f \leftarrow f \times 2, \quad \text{foldedOctaves} \leftarrow \text{foldedOctaves} + 1$$
$$\text{while } f > f_{\max}: \quad f \leftarrow f / 2, \quad \text{foldedOctaves} \leftarrow \text{foldedOctaves} - 1$$

The resulting note preserves its exact Just Intonation harmonic degree, scale context, and cent deviation while sounding inside the physical acoustic range of the selected instrument.
