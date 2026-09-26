# Mosa - Web-Based Ephemeral Social Media Platform

A modern, web-native ephemeral social media application replicating a 3-pane horizontal swipe interface, browser AR camera with 3D filters, 24-hour stories with Firestore TTL, and disappearing direct snaps.

**Lead Engineer & QA:** MacCarthy Collins Setor  
**Primary Infrastructure:** Vercel (Frontend & Edge) + Firebase (BaaS)

---

## Key Features

1. **3-Pane Horizontal Swipe Engine (UI)**:
   - **Chat (Left)** $\leftrightarrow$ **Camera (Center)** $\leftrightarrow$ **Stories (Right)**
   - Implemented via a Framer Motion carousel with `100vw` viewports.
   - Built as a single-page layout to avoid unmounting the camera component on screen transitions.

2. **Browser-Native AR Camera & 3D Filters**:
   - WebGL Three.js overlay canvas coupled with Google MediaPipe Face Landmarker (478 facial mesh landmarks).
   - Real-time filters:
     - **Cyberpunk 2077 Visor**: Holographic HUD band and neon scanlines.
     - **Neon Bunny**: 3D ears with physics oscillation and nose whisker sparkle.
     - **Star Shades**: 3D metallic retro star glasses.
     - **Holy Halo**: Orbiting golden sparkles and floating halo.
     - **Fire Crown**: Dynamic animated fire spires atop head.
   - Photo capture (merged high-res canvas) & video recording (MediaRecorder).
   - Hardware fallbacks (file upload option, fallback feature tracking).

3. **Strict Direct-to-Storage Architecture (Vercel 4.5 MB Limit)**:
   - Media files **never** touch Next.js API routes.
   - Client pushes heavy media directly to Firebase Storage or S3 pre-signed upload URLs.

4. **Ephemerality (Disappearing Media)**:
   - **Stories (24h TTL)**: Managed via Firestore TTL policy on the `expiresAt` index.
   - **Direct Snaps**: Client-side countdown timer (1s - 10s) upon opening. Automatically transitions `viewStatus` to `viewed` and triggers cloud storage permanent purge.

5. **Real-Time Chat Engine**:
   - Firestore `onSnapshot` real-time listeners.
   - Debounced typing indicator (`typing` boolean flag updated on keypress with 1.5s timeout).
   - Friend management and status tracking.

6. **Lead QA Audit Suite**:
   - In-app QA modal verifying bandwidth direct upload, WebGL context, and memory leak disposal (`track.stop()`).

---

## Getting Started

### 1. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Recommended Active Workspace
Set the active workspace in Antigravity IDE to:
```
C:\Users\Carthy\.gemini\antigravity-ide\scratch\ephemeral-social
```

### 3. Environment Variables (Optional)
The platform includes an immediate zero-config mock/standalone mode with sample data (Elena Vance, Alex Chen, Sarah Connor). To connect your live Firebase project, create a `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Firestore Security Rules & TTL Setup
Deploy the provided `firestore.rules` and `firestore.indexes.json`:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```
Enable TTL on `stories.expiresAt`:
```bash
gcloud firestore fields ttls update expiresAt --collection-group=stories --enable-ttl
```
