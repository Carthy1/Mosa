# QA & Architecture Audit Report

**Lead Engineer & QA:** MacCarthy Collins Setor  
**Target Platform:** Web-Based Ephemeral Social Media Platform (AuraSnap)  
**Infrastructure:** Vercel (Edge & Frontend) + Firebase (BaaS)  
**Status:** Implemented & Verified  

---

## 1. Executive Summary & Verification Matrix

| Requirement / Constraint | Target Specification | Implementation Mechanism | Status |
| :--- | :--- | :--- | :--- |
| **Vercel Payload Limit (4.5 MB)** | Media files must NEVER touch Next.js API routes | Direct-to-Storage pattern via Firebase Storage `uploadBytesResumable` & S3 pre-signed upload URLs. API route payload is 0 KB. | **PASSED** |
| **3-Pane Horizontal Interface** | Chat (Left) $\to$ Camera (Center) $\to$ Stories (Right) | Single-page Framer Motion carousel (`300vw`, `100vw` per panel). Eliminates Next.js route unmounting, preserving camera state. | **PASSED** |
| **Browser-Native AR Camera** | Real-time face filters at 30+ FPS | Three.js WebGL canvas overlay + 478 MediaPipe Face Landmarker with GPU acceleration & optical fallback. | **PASSED** |
| **Stories Ephemerality (24h TTL)** | Automated 24-hour expiration without cron dependencies | Firestore TTL enabled on `stories.expiresAt` index + client-side query filters (`expiresAt > now`). | **PASSED** |
| **Direct Snaps Ephemerality** | Timed viewing (1s - 10s countdown) + permanent purge | `EphemeralViewerModal` client-side countdown timer $\to$ updates `viewStatus: 'viewed'` $\to$ triggers Firebase Cloud Function storage purge. | **PASSED** |
| **Real-Time Chat Engine** | Instant messaging & typing status | Firestore `onSnapshot` real-time listeners + debounced `typing` flag (1.5s idle timeout). | **PASSED** |
| **Memory Leak Prevention** | Prevent browser crashes on pane navigation | Explicit `track.stop()` on media streams and Three.js geometry/material/texture disposal when camera is inactive. | **PASSED** |
| **Hardware Fallback** | Graceful degradation without WebGL/Webcam | Automated file picker fallback, CSS color grading, and explicit user permission prompt. | **PASSED** |

---

## 2. Infrastructure & Data Flow

### 2.1 Direct-to-Storage Pattern (Bypassing Vercel 4.5 MB Limit)

```
[Client Browser]
       │
       ├──── 1. (Optional) Request Pre-signed URL [<1 KB Payload] ────► [Next.js API Route]
       │                                                                      │
       │◄─── 2. Return S3/GCS Upload Target URL [<1 KB Payload] ──────────────┘
       │
       └──── 3. PUT 4K Video (50MB - 100MB+) Direct Stream ──────────► [Firebase Storage / S3 Bucket]
                                                                        (Zero Vercel Bandwidth Used)
```

### 2.2 Edge Session Middleware
- Route: `/api/auth/session` sets `__session` as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- Edge Middleware (`src/middleware.ts` / Next.js Proxy) validates user session before route hydration to prevent layout shifts.

---

## 3. Firestore TTL & Cloud Function Setup Instructions

### 3.1 Enabling Native Firestore TTL for Stories

To enable native Firestore TTL on `expiresAt` without running custom cron servers:

```bash
# Using Google Cloud CLI:
gcloud firestore fields ttls update expiresAt \
    --collection-group=stories \
    --enable-ttl \
    --project=YOUR_FIREBASE_PROJECT_ID
```

Or deploy using Firebase CLI:
```bash
firebase deploy --only firestore:indexes
```

### 3.2 Deploying Cloud Functions for Ephemeral Storage Cleanup

Source location: `functions/src/index.ts`
- `onSnapMessageViewed`: Triggered when `chats/{chatId}/messages/{messageId}` transitions to `viewStatus == 'viewed'`. Automatically deletes the underlying storage object.
- `cleanupExpiredStoriesCron`: Optional hourly safety cleanup for orphaned story assets.

Deploy command:
```bash
firebase deploy --only functions
```

---

## 4. QA Diagnostic Audit Suite

The application includes an in-app QA diagnostic modal accessible via the **QA** badge on the top right of the camera view:
1. **6.0 MB Payload Test**: Simulates direct binary streaming, demonstrating 0 bytes hit Next.js serverless functions.
2. **WebGL & GPU Probe**: Queries hardware vendor and unmasked renderer strings.
3. **Memory Leak Profiler**: Validates active track release on pane switch.
4. **State Reset**: Allows 1-click test state replenishment.
