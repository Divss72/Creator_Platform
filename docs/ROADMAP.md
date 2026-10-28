# CreatorHub Roadmap

A subscription platform where creators publish tiered content (Free / Pro / VIP) and fans subscribe and chat live on each post. (Substack meets Patreon).

| Version | Focus | Description | Status |
| :--- | :--- | :--- | :--- |
| **v0.1** | **Skeleton + auth** | Express server, register/login, JWT, roles, profiles, content CRUD (in-memory store) | **In Progress** |
| **v0.2** | **MySQL + Sequelize** | Schema, associations, move CRUD to database, seed script | Upcoming |
| **v0.3** | **Subscriptions + paywall** | Mock subscribe, tier ranking (Free < Pro < VIP), `requireTier` middleware, preview vs full content | Upcoming |
| **v0.4** | **Socket.io** | Live comments per post, viewer count, JWT-authenticated sockets, tier-gated rooms | Upcoming |
| **v0.5** | **GraphQL** | Content feed filtered by tier and creator | Upcoming |
| **v0.6** | **Media + security** | Cloudinary uploads, rich-text XSS sanitisation, helmet, rate limiting | Upcoming |
| **v0.7** | **Email + Firebase** | Welcome / new-post / weekly digest emails, live subscriber count | Upcoming |
| **v0.8** | **Tests + CI/CD** | Integration and unit tests, health check, auto-deploy | Upcoming |
| **v1.0** | **Analytics & Launch** | Analytics dashboard, trending algorithm, final demo | Upcoming |

> **Rule**: Do NOT build anything from a later version, even if it seems easy. If you see something that would help later, leave a `TODO(v0.x)` comment and move on.
