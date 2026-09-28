# Audio DSP & Synthesis Architecture

This document specifies the real-time DSP, voice allocation, filter topologies, acoustic modelling, and spatial audio graph utilized by the Web Audio synthesis engine.

---

## 1. Web Audio Graph Topology

The audio graph follows a low-latency, modular chain:

```
[Modulator Osc]
       │
       ▼
 [ModGain Node]
       │ (audio-rate FM modulation)
       ▼
 [Carrier Osc] ──▶ [Biquad Filter] ──▶ [Amp Envelope Gain] ──▶ [Stereo Panner]
                                                                        │
 ┌──────────────────────────────────────────────────────────────────────┘
 │
 ▼
[DC Blocker Biquad (Highpass 20Hz)]
 │
 ├─── dry (1 - mix) ───────────────────────┐
 │                                         │
 └─── wet (mix) ──▶ [Convolver / Reverb] ──┴─▶ [Master Gain] ──▶ [AudioContext.destination]
```

---

## 2. FM Synthesis Voice Architecture (`FMVoice`)

Each polyphonic note instance creates an isolated voice cluster:

### 2.1 Carrier-Modulator Relationship
* **Carrier Oscillator:** Generates the fundamental pitch $f_c = f_{\text{note}}$ (sine wave).
* **Modulator Oscillator:** Generates sideband harmonics $f_m = c \cdot f_{\text{note}}$.
  - In the default harmonic preset: Carrier-to-Modulator ratio $C:M = 1:2$.
  - In reed/organ models: $C:M = 1:1$ or $1:3$ with slight detune ($+0.5\text{ Hz}$) for acoustic beating.

### 2.2 Dynamic Modulation Index
Modulation index $I$ defines the bandwidth of generated sidebands:

$$I(\beta) = I_{\min} + (I_{\max} - I_{\min})(1 - \beta)$$
$$\text{gain}_{\text{mod}} = f_{\text{note}} \cdot I(\beta)$$

where $\beta \in [0, 1]$ is the brightness parameter computed from collision parameter $u$:
- When strike is at center ($\beta = 1.0$), $I = 1.0 \implies$ pure, mellow tone.
- When strike is near vertex ($\beta = 0.0$), $I = 6.0 \implies$ rich, metallic timbre with higher partials.

### 2.3 Resonant Biquad Filtering
A 2nd-order lowpass filter shapes spectral roll-off:
* **Cutoff Frequency:**
  $$f_{\text{cutoff}} = f_{\text{note}} \cdot \left( 2.0 + 6.0 \cdot (1 - \beta) \right)$$
* **Resonance ($Q$ factor):**
  $$Q = 1.0 + 3.0 \cdot (1 - \beta)$$

### 2.4 Amplitude Envelope (ADSR)
* **Attack:** $3\text{ ms}$ linear ramp (prevents pop/click artifacts while maintaining sharp onset transient).
* **Decay / Release:** Exponential decay to $-80\text{ dB}$ ($10^{-4}$ gain):
  $$g(t) = g_{\text{peak}} \cdot e^{-\gamma (t - t_{\text{attack}})}$$
* **Sustained Keys (Accordion / Organ mode):** Voice sustains at level $S = 0.75 \cdot g_{\text{peak}}$ until `stopKeyHold()` or MIDI `NoteOff` trigger release ramp ($15\text{ ms}$).

---

## 3. Instrument Modeling & Presets

### 3.1 Cello Preset (Solo / Chamber)
* **Register Range:** $C_2$ ($65.41\text{ Hz}$) to $G_5$ ($783.99\text{ Hz}$).
* **Attack Characteristic:** Slower onset ($25\text{ ms}$ bow acceleration).
* **Formant Shaping:** Dual bandpass resonance approximating wooden body air resonances ($220\text{ Hz}$ and $440\text{ Hz}$).
* **Dynamic Timbre:** Higher bow velocity ($\text{vel} > 90$) dynamically lowers $u$ offset towards ponticello.

### 3.2 Accordion Preset (Bellows & Double Reeds)
* **Reed Coupling:** Dual detuned oscillators ($\Delta f = \pm 1.2\text{ Hz}$) producing natural musette tremolo.
* **Instantaneous Sustain:** Infinite sustain while key is pressed (`KeyHold`), bellows pressure controlled via Expression / CC 11.
* **Release Noise:** Subtle reed decay choke ($8\text{ ms}$).

---

## 4. Voice Allocation & Polyphony Management (`VoiceAllocator`)

With up to 8–16 simultaneous polyphonic voices, CPU spikes and acoustic clipping are prevented by three interlocking mechanisms:

### 4.1 Temporal De-bounce (Minimum IOI)
When multiple rapid collisions occur on the same polygon edge (e.g. edge jitter), triggers within a minimum Inter-Onset Interval ($\text{minIOI} = 30\text{ ms}$) are rejected:

$$\text{if } (t_{\text{current}} - t_{\text{last}}[level, edge] < \text{minIOI}) \implies \text{drop event}$$

### 4.2 Priority & Age-Based Voice Stealing
When active voice count reaches `maxVoices`:
1. Lowest priority voices (released or decaying voices) are targeted first.
2. If all voices are sustaining, the oldest voice ($\min t_{\text{start}}$) is stolen.
3. The stolen voice is faded to zero over $10\text{ ms}$ (`linearRampToValueAtTime`) before being disconnected.

### 4.3 Dynamic Amplitude Ducking
To prevent summing gain from clipping the master DAC:

$$G_{\text{duck}} = \begin{cases} 1.0 & \text{if } N_{\text{voices}} \le \lfloor 0.6 \cdot N_{\max} \rfloor \\ \max\left(0.3, 1.0 - \frac{N_{\text{voices}} - 0.6 N_{\max}}{0.4 N_{\max}}\right) & \text{otherwise} \end{cases}$$

### 4.4 DC-Blocker Filter
A high-pass biquad filter with cutoff $f_c = 20\text{ Hz}$ and $Q = 0.707$ is placed in series after voice summation to remove any accumulated DC bias from non-linear envelope ramps.

---

## 5. Spatial Audio & Reverb (`AcousticReverb`)

* **Spatial Panning:** Each edge $i \in \{0, \dots, N-1\}$ is mapped symmetrically across the stereo panorama:
  $$\text{pan}_i = \frac{2i}{N - 1} - 1 \in [-1.0, +1.0]$$
* **Synthetic Reverb:** An impulse response created via exponentially decaying Gaussian noise with high-frequency absorption ($e^{-\alpha t} \cdot \cos(\omega t)$) simulating a wooden concert hall.
