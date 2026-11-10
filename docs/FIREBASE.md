# Firebase Live Metrics Subsystem (v0.7)

## Overview

CreatorHub v0.7 integrates Firebase Realtime Database to provide creators with real-time, low-latency subscriber counters and tier breakdowns directly on their dashboards. MySQL remains the single source of truth; Firebase is an event-driven, mirrored projection.

---

## 1. Architecture & Data Model

### Data Tree

Metrics for each creator are stored at:

```json
{
  "creatorStats": {
    "<creatorId>": {
      "subscriberCount": 42,
      "byTier": {
        "free": 20,
        "pro": 15,
        "vip": 7
      },
      "updatedAt": 1731174600000
    }
  }
}
```

### Event-Driven Sync & Coalescing

```
User Subscribes / Upgrades / Cancels
              │
              ▼
   Subscription Controller
              │ (Commit to MySQL)
              ▼
    emitSubscriptionChanged
              │
              ▼
     Domain Event Listener
              │
              ▼
     firebaseSyncService
              │
       Debounce Buffer (FIREBASE_SYNC_DEBOUNCE_MS = 500ms)
       (Coalesces burst subscriptions for same creator)
              │
              ▼
     MySQL Aggregation Query (Source of Truth)
     SELECT tier_id, COUNT(*) FROM subscriptions ...
              │
              ▼
     Firebase Driver Write
     creatorStats/{creatorId} = { subscriberCount, byTier, updatedAt }
```

---

## 2. Hard Rule: Side-Effect Isolation

Firebase is purely a side effect. Under no circumstances may a Firebase timeout, network partition, or permission error:

1. Throw an unhandled exception.
2. Roll back a MySQL subscription transaction.
3. Slow down or fail a REST, GraphQL, or Socket.io response.

In the event of transient Firebase failures, the sync service performs up to 3 exponential backoff retries. If all retries fail, an error is logged, and the hourly reconciliation job catches up later.

---

## 3. Realtime Database Security Rules

Client writes to `creatorStats` are completely prohibited. Read access is restricted strictly to the authenticated creator matching their user ID:

`firebase/database.rules.json`:

```json
{
  "rules": {
    "creatorStats": {
      "$creatorId": {
        ".read": "auth != null && auth.uid === $creatorId",
        ".write": false
      }
    }
  }
}
```

---

## 4. Creator Custom Auth Token & Endpoints

### Custom Token Minting

- **Endpoint**: `GET /api/creators/me/firebase-token`
- **Role Requirement**: Creator only (`role === 'creator'`).
- **Rate Limit**: 10 requests / 15 minutes per creator (`firebaseTokenLimiter`).
- **Response**:

```json
{
  "token": "<firebase_custom_jwt>",
  "databaseUrl": "https://creatorhub-default-rtdb.firebaseio.com",
  "path": "creatorStats/<creatorId>"
}
```

### REST Fallback Endpoint

If client-side WebSocket connections to Firebase are blocked or offline, creators can fetch metrics directly:

- **Endpoint**: `GET /api/creators/me/dashboard/subscribers`
- **Response**:

```json
{
  "subscriberCount": 42,
  "byTier": {
    "free": 20,
    "pro": 15,
    "vip": 7
  },
  "updatedAt": "2026-11-09T20:00:00.000Z"
}
```

---

## 5. Reconciliation & Maintenance

- **Hourly Cron Job**: Runs every hour at minute 0 (`0 * * * *`) and on server startup to resynchronize all creators from MySQL into Firebase.
- **CLI Resync**: Run on-demand via:
  ```bash
  npm run firebase:resync
  ```
