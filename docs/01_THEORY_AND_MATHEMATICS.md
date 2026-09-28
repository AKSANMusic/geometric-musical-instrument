# Mathematical & Theoretical Foundations

This document provides the complete mathematical, physical, and musical theory underpinning the **Geometric Musical Instrument**. Any AI model or human engineer can use this specification to reimplement or verify the core mathematical formulas.

---

## 1. Geometric Theory: Irregular Cyclic Polygons

A **cyclic polygon** is a polygon whose vertices all lie on a single common circle of radius $R$ (the circumscribed circle).

### 1.1 Ptolemy's & Central Angle Formulation
For any polygon inscribed in a circle with circumradius $R$, each chord (edge $i$) with length $s_i$ subtends a central angle $\theta_i$:

$$\sin\left(\frac{\theta_i}{2}\right) = \frac{s_i}{2R}$$

When edge lengths are defined proportional to Just Intonation wavelength ratios $r_i$ (where $s_i = c \cdot r_i$):

$$\theta_i = 2 \arcsin(\lambda \cdot r_i)$$

where $\lambda = \frac{c}{2R} \in (0, 1)$ is the scaling parameter.

For the polygon to form a closed convex loop enclosing the origin, the sum of all central angles must equal $2\pi$:

$$\sum_{i=1}^{N} \theta_i = 2\pi \iff \sum_{i=1}^{N} 2 \arcsin(\lambda \cdot r_i) = 2\pi \iff \sum_{i=1}^{N} \arcsin(\lambda \cdot r_i) = \pi$$

### 1.2 Bisection Solver
Define the continuous function:

$$f(\lambda) = \sum_{i=1}^{N} \arcsin(\lambda \cdot r_i) - \pi$$

* **Monotonicity:** Since $\frac{d}{dx} \arcsin(x) = \frac{1}{\sqrt{1-x^2}} > 0$ for $x \in (-1, 1)$, $f(\lambda)$ is strictly monotonically increasing.
* **Boundary Conditions:**
  $$f(0) = -\pi < 0$$
  If $\sum_{i=1}^{N} \arcsin(r_i) > \pi$, by the Intermediate Value Theorem there exists a unique $\lambda^* \in (0, 1)$ such that $f(\lambda^*) = 0$.
* **Bisection Algorithm:**
  1. Set $\text{lo} = 10^{-10}$, $\text{hi} = 1 - 10^{-10}$.
  2. While $\text{hi} - \text{lo} > \text{tol}$ (typically $10^{-12}$):
     $$\text{mid} = \frac{\text{lo} + \text{hi}}{2}$$
     $$\text{if } f(\text{mid}) < 0 \implies \text{lo} = \text{mid} \quad \text{else} \implies \text{hi} = \text{mid}$$
  3. Returns $\lambda^* \approx 0.7362928962$ for the 5-limit pentatonic ratios $[1, 8/9, 4/5, 2/3, 3/5]$.

### 1.3 Vertex Placement & Edge Normals
Given $\lambda^*$, central angles $\theta_i = 2\arcsin(\lambda^* r_i)$ are accumulated starting at $\alpha_0 = -\frac{\pi}{2}$ (top of canvas):

$$V_i = \left( R \cos\left(\sum_{k=0}^{i-1} \theta_k - \frac{\pi}{2}\right), R \sin\left(\sum_{k=0}^{i-1} \theta_k - \frac{\pi}{2}\right) \right)$$

For edge $E_i = (V_i, V_{i+1})$, edge vector $\mathbf{d} = V_{i+1} - V_i$.
The outward-pointing unit normal $\hat{\mathbf{n}}$ is computed by rotating $\mathbf{d}$ clockwise or counter-clockwise and verifying against the polygon centroid $\mathbf{C} = \frac{1}{N}\sum V_i$:

$$\mathbf{m}_i = \frac{V_i + V_{i+1}}{2}$$
$$\hat{\mathbf{n}}_i \cdot (\mathbf{m}_i - \mathbf{C}) > 0$$

### 1.4 Concentric Nesting (Homothety)
Nesting depth $k \in (0, 1)$ scales circumradius and transposes frequency:

$$R_l = R_0 \cdot k^l$$
$$f_{0, l} = f_0 \cdot \left(\frac{1}{k}\right)^l$$

For an octave per concentric layer, $k = 0.5$, doubling the frequency each inner ring ($1/0.5 = 2.0$).

---

## 2. Physics & Continuous Collision Detection (CCD)

To prevent discrete tunneling (particles passing through polygon boundaries between frames), Continuous Collision Detection using 2D Ray-Segment intersection is implemented.

### 2.1 Ray-Segment Intersection (Cramer's Rule)
Given particle ray $\mathbf{P}(t) = \mathbf{P}_0 + t\mathbf{v}$ with remaining timestep $\Delta t$, and polygon edge segment $\mathbf{S}(u) = \mathbf{A} + u(\mathbf{B} - \mathbf{A})$ for $u \in [0, 1]$:

$$\mathbf{P}_0 + t\mathbf{v} = \mathbf{A} + u\mathbf{D} \quad (\text{where } \mathbf{D} = \mathbf{B} - \mathbf{A})$$
$$t\mathbf{v} - u\mathbf{D} = \mathbf{A} - \mathbf{P}_0$$

In matrix form:
$$\begin{bmatrix} v_x & -D_x \\ v_y & -D_y \end{bmatrix} \begin{bmatrix} t \\ u \end{bmatrix} = \begin{bmatrix} A_x - P_{0,x} \\ A_y - P_{0,y} \end{bmatrix}$$

Determinant: $\Delta = -v_x D_y + v_y D_x = v_y D_x - v_x D_y$.
If $|\Delta| < 10^{-9}$, ray and segment are parallel (no intersection).

Otherwise:
$$t = \frac{(A_x - P_{0,x})(-D_y) - (A_y - P_{0,y})(-D_x)}{\Delta} = \frac{(A_x - P_{0,x})D_y - (A_y - P_{0,y})D_x}{v_x D_y - v_y D_x}$$
$$u = \frac{v_x(A_y - P_{0,y}) - v_y(A_x - P_{0,x})}{\Delta}$$

A valid collision occurs if:
$$t \in (10^{-9}, \Delta t] \quad \text{and} \quad u \in [0, 1]$$

### 2.2 Elastic Reflection & Impact Physics
When collision occurs at $t^*$:
1. Position advances to contact point: $\mathbf{P} = \mathbf{P}_0 + t^*\mathbf{v}$.
2. Normal velocity component: $v_n = \mathbf{v} \cdot \hat{\mathbf{n}}$.
3. Reflected velocity with damping factor $\mu \in [0.95, 1.0]$:
   $$\mathbf{v}' = \mu \left( \mathbf{v} - 2(\mathbf{v} \cdot \hat{\mathbf{n}})\hat{\mathbf{n}} \right)$$
4. Particle separation offset (anti-sticking epsilon):
   $$\mathbf{P}' = \mathbf{P} \pm 10^{-7}\hat{\mathbf{n}}$$

### 2.3 Acoustic Timbre Mapping from Impact Parameter
* **Impact Velocity $\to$ MIDI Velocity:**
  $$v_{\text{norm}} = \min\left(1, \frac{|\mathbf{v} \cdot \hat{\mathbf{n}}|}{v_{\max}}\right)$$
  $$\text{vel} = \left\lfloor 127 \cdot \frac{\ln(1 + \beta v_{\text{norm}})}{\ln(1 + \beta)} \right\rfloor \quad (\beta \approx 10)$$
* **Impact Parameter $u \in [0, 1] \to$ Brightness / Timbre $\beta(u)$:**
  $$\beta(u) = 1 - 4(u - 0.5)^2 \in [0, 1]$$
  - $u = 0.5$ (center of edge): $\beta = 1.0$ (warm, dark, sul tasto).
  - $u \to 0$ or $1$ (near vertices): $\beta = 0.0$ (bright, metallic, sul ponticello).

---

## 3. Microtonality & Persian/Eastern Modal Systems

### 3.1 Just Intonation Ratios vs. 12-TET
Just Intonation (JI) derives pitch from integer harmonic ratios:

| Interval Name | JI Ratio | Ratio Value | Cents (JI) | 12-TET Equivalent | Cents Error |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Root (1/1)** | $1/1$ | $1.0000$ | $0.00$ | 0 semitones | $0.0$ |
| **Major Second (9/8)** | $9/8$ | $1.1250$ | $203.91$ | 2 semitones | $+3.91$ |
| **Major Third (5/4)** | $5/4$ | $1.2500$ | $386.31$ | 4 semitones | $-13.69$ |
| **Perfect Fifth (3/2)** | $3/2$ | $1.5000$ | $701.96$ | 7 semitones | $+1.96$ |
| **Major Sixth (5/3)** | $5/3$ | $1.6667$ | $884.36$ | 9 semitones | $-15.64$ |

### 3.2 Persian Dastgah System & Neutral Intervals
The Persian modal system (Dastgah) uses microtonal intervals:
* **Koron ($\text{p}$ / $\sim -50$ cents):** Quarter-tone flat.
* **Sori ($\text{t}$ / $\sim +50$ cents):** Quarter-tone sharp.
* **Neutral Second (Limma + Comma $\approx 140-160$ cents):** Characteristic interval between tonic and second degree in Dastgah-e Shur (e.g., $E^\text{koron}$ with respect to D).
* **Wavelength Proportions:**
  In Shur, frequencies follow $[1, 12/11, 4/3, 3/2, 5/3, 16/9, 2/1]$ approximately, subtending asymmetric polygon segments.

### 3.3 Frequency-to-MIDI & Cent Conversion
$$m_{\text{exact}} = 69 + 12 \log_2\left(\frac{f}{440}\right)$$
$$m_{\text{base}} = \text{round}(m_{\text{exact}})$$
$$\Delta \text{cents} = 100 \cdot (m_{\text{exact}} - m_{\text{base}})$$
$$\text{isMicrotonal} = |\Delta \text{cents}| \ge 20$$
