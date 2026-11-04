# CreatorHub GraphQL API Reference (v0.5)

CreatorHub provides a read-only GraphQL API at `POST /graphql` running on the same HTTP server port (`PORT=5000`) alongside REST and Socket.io.

In development mode (`NODE_ENV=development`), opening `http://localhost:5000/graphql` in your browser provides an interactive Apollo Sandbox / landing page explorer.

---

## 1. Schema Overview

The GraphQL schema is strictly read-only in Version 0.5. Writes (user registration, login, content creation, subscribing) remain on REST, and live interactive comments remain on Socket.io.

### Primary Queries

```graphql
type Query {
  # Platform subscription tiers with rank and pricing in cents
  tiers: [Tier!]!

  # Keyset paginated feed of posts, with optional filters
  feed(filter: FeedFilter, first: Int = 20, after: String): ContentConnection!

  # Single post preview or full content by ID
  content(id: ID!): ContentItem

  # Public creator profile lookup by creator User ID
  creator(id: ID!): Creator

  # Top-level comment history for a post, gated by post access rules
  contentComments(contentId: ID!, limit: Int = 50, before: ID): CommentPage!
}
```

### Core Types & Enums

```graphql
scalar DateTime

enum TierName {
  FREE
  PRO
  VIP
}

enum Role {
  CREATOR
  SUBSCRIBER
}

type Tier {
  name: TierName!
  rank: Int!
  priceCents: Int!
}

type Creator {
  id: ID!
  displayName: String!
  bio: String
}

type ContentItem {
  id: ID!
  title: String!
  minTier: TierName!
  creator: Creator!
  locked: Boolean!
  body: String                 # null whenever locked
  excerpt: String!
  viewerTier: TierName!        # effective tier with THIS creator
  commentCount: Int!           # batched via DataLoader
  createdAt: DateTime!
  updatedAt: DateTime!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

type ContentEdge {
  cursor: String!
  node: ContentItem!
}

type ContentConnection {
  edges: [ContentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

input FeedFilter {
  creatorId: ID
  minTiers: [TierName!]
  accessibleOnly: Boolean
  subscribedOnly: Boolean
}

type CommentAuthor {
  id: ID!
  name: String!
  role: Role!
}

type Comment {
  id: ID!
  contentId: ID!
  body: String!
  createdAt: DateTime!
  user: CommentAuthor!
}

type CommentPage {
  items: [Comment!]!
  nextBefore: ID
}
```

---

## 2. Authentication

Requests are authenticated using the standard HTTP header:
```http
Authorization: Bearer <jwt_token>
```

- **No header**: Request executes as an anonymous viewer (`viewer = null`). Anonymous viewers can run all queries except `feed(filter: { subscribedOnly: true })`.
- **Valid token**: Request executes as the authenticated user (`viewer = { id, role, name }`).
- **Malformed or expired token**: The entire request is rejected with **HTTP 401 Unauthorized** and `extensions.code: "INVALID_TOKEN"` or `"TOKEN_EXPIRED"`. A bad token is never downgraded to anonymous.

---

## 3. Query Examples with Variables

### 3.1 Tiered Content Feed with Filtering & Pagination

**GraphQL Document:**
```graphql
query GetCreatorFeed($filter: FeedFilter, $first: Int, $after: String) {
  feed(filter: $filter, first: $first, after: $after) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        title
        minTier
        locked
        body
        excerpt
        viewerTier
        commentCount
        creator {
          id
          displayName
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "filter": {
    "creatorId": "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "accessibleOnly": true
  },
  "first": 10,
  "after": null
}
```

### 3.2 Pagination Loop
To fetch the subsequent page:
1. Extract `endCursor` from `pageInfo`.
2. Pass `after: endCursor` in variables for the next request until `hasNextPage === false`.

### 3.3 Handling Locked Content Previews
When `locked` is `true`:
- `body` is strictly `null`.
- `excerpt` contains a 200-character plain text teaser preview.
- `viewerTier` indicates your effective tier with that post's creator (`FREE`, `PRO`, or `VIP`).

**Query Document:**
```graphql
query GetPost($id: ID!) {
  content(id: $id) {
    id
    title
    minTier
    locked
    body
    excerpt
    viewerTier
  }
}
```

### 3.4 Querying Post Comments
`contentComments` is a top-level query that verifies your access to the post before returning comments. If the post is locked to your viewer level, it returns `TIER_REQUIRED`.

```graphql
query GetPostComments($contentId: ID!, $limit: Int, $before: ID) {
  contentComments(contentId: $contentId, limit: $limit, before: $before) {
    items {
      id
      body
      createdAt
      user {
        id
        name
        role
      }
    }
    nextBefore
  }
}
```

---

## 4. Error Codes & Format

Errors follow uniform platform error codes placed in `errors[].extensions.code`:

| Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `UNAUTHENTICATED` | 200 (or 401) | User authentication is required for this action |
| `INVALID_TOKEN` | 401 | The Bearer token is malformed, invalid, or belongs to a nonexistent user |
| `TOKEN_EXPIRED` | 401 | The Bearer token has expired |
| `NOT_FOUND` | 200 | The requested resource (content item or user) does not exist |
| `TIER_REQUIRED` | 200 | Higher subscription tier required. Includes `extensions.details: { requiredTier, viewerTier }` |
| `VALIDATION_ERROR` | 200 | Argument validation failed (e.g. invalid cursor, `first` out of range 1-50) |
| `INTERNAL_ERROR` | 200 | Unexpected error (generic message; stack traces and SQL masked) |
| `GRAPHQL_VALIDATION_FAILED` | 200 | GraphQL document validation failed (e.g. query depth limit exceeded) |

---

## 5. Safety & Performance Limits

- **Maximum Query Depth**: Queries are capped at a depth of **6 selection levels**. Deeper queries are rejected before execution with `GRAPHQL_VALIDATION_FAILED`.
- **Feed Page Size**: `first` is capped at **50 items** (min: 1, default: 20).
- **Comment Page Size**: `limit` is capped at **100 comments** (min: 1, default: 50).
- **Request Body Limit**: JSON payloads on `/graphql` are capped at **100 KB**.
- **Introspection**: Enabled only in `NODE_ENV=development`. Strictly disabled in production.
- **Landing Page**: Apollo Sandbox is served only in `NODE_ENV=development`.

---

## 6. N+1 Query Prevention & Performance

Feed requests execute in a **constant number of SQL queries** regardless of the requested page size:
1. **Tier Memoization**: Platform tiers are loaded once per request in context.
2. **Access Profile Single Query**: The viewer's active subscriptions across all creators are fetched in a single query via `accessService.getViewerAccessProfile({ viewerId })`.
3. **Pre-Pagination SQL Translation**: `accessibleOnly` and `subscribedOnly` filters are translated into SQL `WHERE` conditions before keyset pagination, ensuring pages are always full and cursors are continuous.
4. **DataLoaders**:
   - `creatorLoader`: Batches creator profile queries by user ID using DataLoader.
   - `commentCountLoader`: Batches post comment counts using `SELECT content_id, COUNT(*) ... GROUP BY content_id`.
5. **Development Query Counter**: In development mode, responses include `extensions.queryCount` tracking the total database queries executed for the request.
