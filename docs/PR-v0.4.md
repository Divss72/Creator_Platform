# Pull Request: v0.4 Realtime Socket.io & Live Chat

## Summary of Changes
This PR implements **Version 0.4 (v0.4)** of the CreatorHub platform. It adds real-time live chat to every post using Socket.io on the same HTTP server port, enforces paywall rules on rooms and comments, tracks distinct viewer counts, adds a REST chat history endpoint with cursor pagination, and enables real-time access revocation when subscriptions or post tiers change.

---

### Key Changes:

1. **Dependencies & Environment**:
   - Added `socket.io` to production dependencies and `socket.io-client` to devDependencies.
   - Added `CORS_ORIGIN` env variable with production safeguard (refuses to boot with `*` when `NODE_ENV=production`).

2. **Decoupled Comment Store & Pure Business Service**:
   - `src/store/commentStore.js`: Sequelize-based data store with cursor pagination (`listByContentWithCursor`) and strict allow-list serialization (`{ id, contentId, body, createdAt, user: { id, name, role } }`). Never leaks user emails or password hashes.
   - `src/services/commentService.js`: Framework-independent comment rules with zero Express/Socket.io coupling. Re-verifies access against the database on every write via `accessService.resolveAccess`.

3. **REST Chat History Endpoint (`GET /api/content/:id/comments`)**:
   - Uses `optionalAuth` and `validate(listCommentsSchema)`.
   - Paginated with `limit` (default 50, max 100) and cursor `before` (older comments).
   - Enforces paywall: returns `403 Forbidden` (`TIER_REQUIRED` with `details: { requiredTier, viewerTier }`) if locked, or `404 Not Found` if the post does not exist.
   - Comment creation happens **strictly via Socket.io** (single write path).

4. **Socket.io Server & Handshake Authentication**:
   - Attached to the shared HTTP server in `src/server.js` (single port, single process).
   - Handshake middleware (`src/realtime/auth.js`) reads `{ auth: { token } }` (rejects query string tokens).
   - Anonymous allowed (read-only); valid JWT loads active user from DB and joins private room `user:{id}`.
   - Malformed/expired tokens reject the connection with `INVALID_TOKEN` or `TOKEN_EXPIRED`.
   - Mid-session token expiry check on `comment:create` prevents expired tokens from posting.
   - `maxHttpBufferSize: 16 KB` to reject oversized socket payloads.

5. **Distinct Viewer Presence Tracking (`src/realtime/presence.js`)**:
   - In-memory tracker (`Map<contentId, Map<viewerKey, Set<socketId>>>`).
   - Counts distinct users (`userId` for authenticated, `socket.id` for anonymous).
   - Opening multiple tabs under the same account counts as 1 viewer.
   - Emits `viewers:update` only when the count actually changes.

6. **Sliding-Window Rate Limiting (`src/realtime/rateLimiter.js`)**:
   - In-memory rolling window limiter enforcing max 5 comments per 10 seconds per socket.
   - Returns `RATE_LIMITED` error ack when exceeded.

7. **Socket Event Handlers (`src/realtime/handlers/`)**:
   - `post:join`: Verifies paywall access via `accessService`, joins `post:{contentId}`, tracks distinct viewer presence. Idempotent. Max 10 rooms per socket.
   - `post:leave`: Leaves room, decrements distinct presence, broadcasts update if count changed.
   - `comment:create`: Validates body (1-1000 characters, trimmed, plain-text), checks room membership, re-verifies live DB access, persists row, and broadcasts `comment:new` to the entire room including sender.

8. **Live Access Revalidation & Events Facade (`src/realtime/events.js`)**:
   - Non-blocking facade called from REST controllers:
     - `onSubscriptionChanged({ userId, creatorId })`: Called on subscribe, upgrade, downgrade, and cancel. Immediately evicts sockets from that creator's locked posts, updates presence, and sends `access:revoked`.
     - `onContentUpdated({ contentId })`: Revalidates room sockets when `minTier` is raised and evicts unqualified sockets.
     - `onContentDeleted({ contentId })`: Emits `post:deleted` to room and clears presence.
   - All facade calls are wrapped in `try/catch` and safe against uninitialized realtime layer (REST calls never fail).

9. **Interactive Dev Test Page (`public/dev-chat.html`)**:
   - Served at `/dev/chat` when `NODE_ENV=development`.
   - Plain HTML/CSS/JS test interface supporting token/anonymous connections, room joining/leaving, history loading, live comment posting, and real-time event logs.

10. **Graceful Shutdown**:
    - `src/server.js` listens for `SIGINT` / `SIGTERM` and cleanly closes Socket.io connections, then HTTP server, then DB pool.

11. **Testing & Verification**:
    - Created `scripts/verify-realtime.js` covering 65 automated checks (handshake, room paywall, comments, rate limits, viewer counts, live revocation, chat history, security).
    - Verified `scripts/verify-paywall.js` still passes 56/56 checks (100% backward compatible).

---

## How to Test

### 1. Reset Database & Run Automated Verifications
```bash
npm run db:reset
npm run dev # in background or separate terminal
npm run verify:realtime
npm run verify:paywall
```
*Expected output: All 65 realtime checks pass, and all 56 paywall checks pass.*

### 2. Test Interactive Live Chat (/dev/chat)
1. Start the server in development mode:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:5000/dev/chat` in your browser.
3. Test Anonymous Viewing:
   - Leave token empty, click **Connect**.
   - Content ID: `c1111111-1111-4111-8111-111111111111` (Alice's Free Post).
   - Click **Get History** &rarr; see comments.
   - Click **Join Room** &rarr; viewer count increases, `canComment: No`.
4. Test Live Commenting:
   - Open a second tab, login via REST to get Subscriber A's token (`suba.vip@creatorhub.local` / `Password123!`).
   - Paste token in tab 2, click **Connect**.
   - Join room `c1111111-1111-4111-8111-111111111111`.
   - Send a comment &rarr; comment appears immediately in both tabs.
5. Test Live Revocation:
   - In tab 2, join Alice's VIP post `c3333333-3333-4333-8333-333333333333`.
   - In terminal/Postman, cancel Subscriber A's subscription (`DELETE /api/subscriptions/a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa`).
   - Notice tab 2 receives `access:revoked` immediately.
