# Drowsiness Detection System

A real-time, browser-based drowsiness detection web application powered by TensorFlow.js and Google's MediaPipe FaceMesh. Detects eye closure using the Eye Aspect Ratio (EAR) algorithm and triggers an audio alarm when a user's eyes remain closed for 5 or more seconds — entirely on-device, with zero data leaving the browser.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20App-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://your-deployment-url.onrender.com)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.22-FF6F00?logo=tensorflow&logoColor=white)](https://www.tensorflow.org/js)
[![Express](https://img.shields.io/badge/Express-5.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What it does

The system continuously analyzes a webcam feed frame-by-frame. For each frame, it:

1. Runs the MediaPipe FaceMesh model to detect **478 3D facial landmarks**
2. Isolates the 6 landmark points that describe each eye
3. Computes the **Eye Aspect Ratio (EAR)** from those points
4. If EAR drops below `0.21` (eyes closed) for **5 continuous seconds**, it triggers a multi-beep audio alarm via the Web Audio API

All inference runs locally on the GPU through TensorFlow.js's WebGL backend — the camera stream never reaches any server.

---

## The Core Algorithm: Eye Aspect Ratio (EAR)

EAR is a single scalar value that captures how open or closed an eye is. It was introduced by Soukupová and Čech in their 2016 paper *"Real-Time Eye Blink Detection using Facial Landmarks"*.

```
        p2    p3
         •----•
p1 •              • p4
         •----•
        p6    p5
```

**Formula:**

```
EAR = ( ||p2 - p6|| + ||p3 - p5|| ) / ( 2 × ||p1 - p4|| )
```

- The numerator sums the two vertical distances across the eye
- The denominator is twice the horizontal width of the eye
- When eyes are **open**: EAR ≈ 0.28–0.35
- When eyes are **closed**: EAR drops to ≤ 0.21 (threshold used in this project)
- The ratio is computed for both eyes independently; the average is used for the final decision

In code, Euclidean distance is calculated with `Math.hypot(dx, dy)`, which gives `sqrt(dx² + dy²)`.

**Why EAR and not just pixel brightness?**  
EAR is scale-invariant and works regardless of face size in the frame. Brightness-based methods are sensitive to lighting conditions. EAR also handles partial blinks gracefully since the ratio changes smoothly.

---

## MediaPipe FaceMesh — the landmark indices

MediaPipe's FaceMesh model produces **478 3D keypoints** per face. This project uses only 12 of them — 6 per eye:

| Eye       | Landmark Indices            |
|-----------|-----------------------------|
| Left eye  | 33, 160, 158, 133, 153, 144 |
| Right eye | 362, 385, 387, 263, 373, 380 |

These indices follow the standard MediaPipe topology and map to the corners and eyelid edges of each eye.

The model is loaded using `@tensorflow-models/face-landmarks-detection`:

```ts
const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
const detector = await faceLandmarksDetection.createDetector(model, {
  runtime: 'tfjs',       // uses TensorFlow.js (browser)
  maxFaces: 1,           // only track one face for performance
  refineLandmarks: false // faster; full refinement not needed for EAR
});
```

---

## Detection Loop

The detection runs inside a `requestAnimationFrame` loop — the browser's native mechanism for smooth, 60fps rendering. On each frame:

```ts
const faces = await detector.estimateFaces(videoElement);
const keypoints = faces[0].keypoints;

// Extract 6 points per eye, compute EAR
const leftEAR  = calculateEAR(leftEyePoints);
const rightEAR = calculateEAR(rightEyePoints);
const avgEAR   = (leftEAR + rightEAR) / 2;

if (avgEAR < 0.21) {
  // track closed duration
} else {
  // reset timer
}
```

The closed-eye timer uses `Date.now()` timestamps stored in a `useRef` — not React state — to avoid re-render overhead during the high-frequency loop. The alarm fires exactly once per closure event (guarded by `hasAlertedRef`).

---

## Audio Alarm

The alarm is generated entirely in the browser using the **Web Audio API** — no audio files needed:

```ts
const oscillator = ctx.createOscillator();
oscillator.frequency.value = 1000;  // 1kHz sine wave
oscillator.type = 'sine';
// plays 3 beeps, 400ms apart
```

A `GainNode` is used to ramp the volume down smoothly (`exponentialRampToValueAtTime`) to avoid an abrupt cut. Mobile devices also receive a `navigator.vibrate([500, 100, 500])` haptic pattern.

---

## Architecture

```
Browser (Client)                         Node.js Server
─────────────────────────────────────    ──────────────────────────
React + Vite SPA                         Express 5
│                                        │
├── /drowsiness ──→ DrowsinessDetector   ├── /api/auth/login
│     │                                  ├── /api/auth/register
│     ├── tf.ready()                     ├── /api/auth/google (OAuth2)
│     ├── createDetector (MediaPipe)     ├── /api/auth/me
│     ├── getUserMedia (webcam)          └── /api/health
│     └── rAF detection loop
│
├── /builder  ──→ Resume Builder
└── /screener ──→ Resume Screener
```

The server's only job is authentication and serving the static SPA in production. All the CV (computer vision) logic lives entirely in the browser.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI Framework | React 19 | Component architecture |
| Language | TypeScript 5.6 | Type-safe development |
| Build Tool | Vite 7 | Dev server + HMR + production bundling |
| ML Engine | TensorFlow.js 4.22 | GPU-accelerated in-browser inference via WebGL |
| CV Model | MediaPipe FaceMesh | 478-landmark 3D face mesh |
| Styling | TailwindCSS v4 | Utility-first CSS |
| UI Components | Radix UI + shadcn/ui | Accessible component primitives |
| Routing | Wouter | Lightweight client-side router |
| State / Data | TanStack Query v5 | Server state management |
| Backend | Express 5 | REST API + static file serving |
| Auth | Passport.js | Local + Google OAuth2 strategies |
| Password Hashing | Node.js `crypto.scrypt` | Timing-safe password verification |
| Session | express-session + memorystore | Server-side session management |
| ORM | Drizzle ORM + Zod | Schema definition + validation |
| Database | PostgreSQL (or in-memory) | User persistence |
| Deployment | Render.com (`render.yaml`) | Cloud web service |

---

## Project Structure

```
drowsiness-detection-system/
├── client/
│   ├── index.html
│   └── src/
│       ├── App.tsx                              # Router + providers
│       ├── components/
│       │   ├── DrowsinessDetector.tsx           # Primary: TensorFlow.js + EAR
│       │   ├── SimpleDrowsinessDetector.tsx     # Fallback: brightness-based
│       │   ├── layout/Navbar.tsx
│       │   └── ui/                              # shadcn/ui primitives
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── login.tsx
│       │   ├── drowsiness/index.tsx             # Drowsiness detection page
│       │   ├── builder/index.tsx                # Resume builder
│       │   └── screener/index.tsx               # Resume screener
│       ├── hooks/
│       └── lib/
├── server/
│   ├── index.ts                                 # Server entry + port binding
│   ├── routes.ts                                # Auth API routes
│   ├── storage.ts                               # In-memory user store
│   ├── static.ts                                # Production static serving
│   └── vite.ts                                  # Vite dev middleware
├── shared/
│   └── schema.ts                                # Drizzle/Zod user schema
├── script/
│   └── build.ts                                 # esbuild + Vite build script
├── .env.example                                 # Environment variable template
├── render.yaml                                  # Render deployment config
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Fallback Detector

`SimpleDrowsinessDetector.tsx` provides an instant-start alternative with no model download. It samples pixel brightness in the approximate eye regions of the frame (~25–40% width, ~40–48% height) and treats average brightness below `100` as eyes closed.

Trade-off: fast startup but accuracy is affected by lighting. The EAR-based detector is significantly more robust.

---

## Authentication

The backend uses Passport.js with two strategies:

- **Local strategy**: email + password. Passwords are hashed with `crypto.scryptSync` (salt + derived key, 64 bytes). Verification uses `timingSafeEqual` to prevent timing attacks.
- **Google OAuth2**: configured via `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Requires a Google Cloud Console project with the OAuth2 callback URL set.

Sessions are managed with `express-session` backed by `memorystore`. In production, swap to `connect-pg-simple` with PostgreSQL for persistence.

---

## Getting Started

### Prerequisites

- Node.js v20+
- npm v10+
- A webcam

### Run locally

```bash
git clone https://github.com/chandanm0005/Drowsiness-Detection-System.git
cd Drowsiness-Detection-System

npm install
npm run dev
```

Open [http://localhost:5030/drowsiness](http://localhost:5030/drowsiness), allow camera access, and click **Start Detection**.

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SESSION_SECRET=a-long-random-string
```

Google OAuth is optional — the app works without it (local auth and the detection feature are always available).

---

## Deployment (Render)

The included `render.yaml` configures a Render Web Service:

```yaml
buildCommand: npm install && npm run build
startCommand:  npm run start
```

Push to GitHub, connect the repo on [render.com](https://render.com), and deploy.

---

## Key Design Decisions

**Why run inference in the browser?**  
Privacy. Sending a live webcam stream to a server is a significant privacy risk. Running TensorFlow.js with the WebGL backend means inference happens on the local GPU — no video data ever leaves the device.

**Why `requestAnimationFrame` instead of `setInterval`?**  
`rAF` is synchronized with the display refresh rate and pauses automatically when the tab is backgrounded, saving CPU/GPU. `setInterval` would keep running even when the user switches tabs.

**Why `useRef` for timing instead of `useState`?**  
Setting state inside a high-frequency `rAF` loop would trigger React re-renders on every frame, causing unnecessary work. Refs are mutable, don't cause re-renders, and are always current inside closures.

**Why EAR threshold 0.21?**  
The original Soukupová & Čech paper recommends 0.3 as a general threshold, but that produces false positives for natural blinks. 0.21 is a conservative value suited for detecting sustained closure (drowsiness) rather than normal blinks.

**Why 5 seconds?**  
A normal blink lasts 150–400ms. A microsleep (the dangerous precursor to driver fatigue accidents) typically starts at 2–5 seconds. 5 seconds is a safe threshold that avoids false alarms from slow blinks.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

*Built with React, TensorFlow.js, and MediaPipe FaceMesh.*
