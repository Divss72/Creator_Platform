'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const passwordHash = bcrypt.hashSync('Password123!', 10);

    // Creator UUIDs
    const aliceId = 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const bobId = 'b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const charlieId = 'c1111111-cccc-4ccc-8ccc-cccccccccccc';

    // 15 Subscriber UUIDs
    const subAId = 'a0000001-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; // Sub A (Alice VIP)
    const subBId = 'b0000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; // Sub B (Alice Pro)
    const subCId = 'c0000003-cccc-4ccc-8ccc-cccccccccccc'; // Sub C (Free)
    const subDId = 'd0000004-dddd-4ddd-8ddd-dddddddddddd'; // Sub D (Cancelled)
    const subEId = 'e0000005-eeee-4eee-8eee-eeeeeeeeeeee'; // Sub E (Expired)
    const subFId = 'f0000006-ffff-4fff-8fff-ffffffffffff'; // Sub F (Opt-out)
    const sub07Id = '00000007-0007-4007-8007-000000000007';
    const sub08Id = '00000008-0008-4008-8008-000000000008';
    const sub09Id = '00000009-0009-4009-8009-000000000009';
    const sub10Id = '00000010-0010-4010-8010-000000000010';
    const sub11Id = '00000011-0011-4011-8011-000000000011';
    const sub12Id = '00000012-0012-4012-8012-000000000012';
    const sub13Id = '00000013-0013-4013-8013-000000000013';
    const sub14Id = '00000014-0014-4014-8014-000000000014';
    const sub15Id = '00000015-0015-4015-8015-000000000015';

    const freeTierId = '11111111-1111-4111-8111-111111111111';
    const proTierId = '22222222-2222-4222-8222-222222222222';
    const vipTierId = '33333333-3333-4333-8333-333333333333';

    // 1. Users (All marked is_demo: true)
    const users = [
      {
        id: aliceId,
        name: 'Alice Creator',
        email: 'alice.creator@creatorhub.local',
        password_hash: passwordHash,
        role: 'creator',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: bobId,
        name: 'Bob Creator',
        email: 'bob.creator@creatorhub.local',
        password_hash: passwordHash,
        role: 'creator',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: charlieId,
        name: 'Charlie Creator',
        email: 'charlie.creator@creatorhub.local',
        password_hash: passwordHash,
        role: 'creator',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: subAId,
        name: 'Subscriber A (VIP)',
        email: 'suba.vip@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: subBId,
        name: 'Subscriber B (Pro)',
        email: 'subb.pro@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: subCId,
        name: 'Subscriber C (Free)',
        email: 'subc.free@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: subDId,
        name: 'Subscriber D (Cancelled)',
        email: 'subd.cancelled@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: subEId,
        name: 'Subscriber E (Expired)',
        email: 'sube.expired@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: subFId,
        name: 'Subscriber F (Opt-out)',
        email: 'subf.optout@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        notify_new_posts: false,
        notify_weekly_digest: false,
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: sub07Id,
        name: 'Subscriber 07 (Alex)',
        email: 'sub07@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: sub08Id,
        name: 'Subscriber 08 (David)',
        email: 'sub08@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: sub09Id,
        name: 'Subscriber 09 (Elena)',
        email: 'sub09@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: sub10Id,
        name: 'Subscriber 10 (Fiona)',
        email: 'sub10@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: sub11Id,
        name: 'Subscriber 11 (George)',
        email: 'sub11@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: sub12Id,
        name: 'Subscriber 12 (Hannah)',
        email: 'sub12@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: sub13Id,
        name: 'Subscriber 13 (Ian)',
        email: 'sub13@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: sub14Id,
        name: 'Subscriber 14 (Julia)',
        email: 'sub14@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      },
      {
        id: sub15Id,
        name: 'Subscriber 15 (Kevin)',
        email: 'sub15@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        is_demo: true,
        created_at: now,
        updated_at: now
      }
    ];

    for (const u of users) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = :email LIMIT 1`,
        { replacements: { email: u.email } }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('users', [u]);
      } else {
        await queryInterface.sequelize.query(
          `UPDATE users SET is_demo = true WHERE email = :email`,
          { replacements: { email: u.email } }
        );
      }
    }

    // 2. Creator Profiles
    const profiles = [
      {
        id: 'a0000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        user_id: aliceId,
        display_name: 'Alice in Techland',
        bio: 'In-depth writing on distributed systems, event streams, and database internals.',
        created_at: now,
        updated_at: now
      },
      {
        id: 'b0000000-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        user_id: bobId,
        display_name: 'Bob Backend & Performance',
        bio: 'High-throughput Node.js internals, low latency caching, and database indexing.',
        created_at: now,
        updated_at: now
      },
      {
        id: 'c0000000-cccc-4ccc-8ccc-cccccccccccc',
        user_id: charlieId,
        display_name: 'Charlie Cloud & DevOps',
        bio: 'Kubernetes production patterns, multi-region failovers, and cloud infrastructure.',
        created_at: now,
        updated_at: now
      }
    ];

    for (const p of profiles) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM creator_profiles WHERE user_id = :userId LIMIT 1`,
        { replacements: { userId: p.user_id } }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('creator_profiles', [p]);
      }
    }

    // 3. Content items across all tiers
    const baseTime = new Date('2026-10-01T10:00:00.000Z');
    const minute = 60000;
    const tiedTimestamp = new Date(baseTime.getTime() + 75 * minute);

    const contentItems = [
      // Alice Items (8 posts)
      {
        id: 'c1111111-1111-4111-8111-111111111111',
        creator_id: aliceId,
        title: 'Building Resilient Event-Driven Microservices (Free)',
        body: '<p>Event-driven systems decouple producer and consumer lifecycles. In this free guide we explore <strong>outbox patterns</strong>, idempotent message processing, and dead letter queues in distributed systems.</p><p>Check the <a href="https://microservices.io">architecture reference</a> for additional details.</p>',
        min_tier_id: freeTierId,
        created_at: new Date(baseTime.getTime() + 10 * minute),
        updated_at: now
      },
      {
        id: 'c2222222-2222-4222-8222-222222222222',
        creator_id: aliceId,
        title: 'Pro Guide: Distributed Consensus & Raft Protocol (Pro)',
        body: '<p>In this exclusive pro guide we introduce the core challenges of distributed consensus across modern database clusters. We will explore network splits, quorum requirements, and term numbering.</p><p>--- DEEP TECHNICAL DIVE BELOW --- Leader elections, log replication, and <strong>commit indexes prevent split-brain</strong> conditions in distributed storage engines like etcd, CockroachDB, and Kafka metadata.</p>',
        min_tier_id: proTierId,
        created_at: new Date(baseTime.getTime() + 20 * minute),
        updated_at: now
      },
      {
        id: 'c3333333-3333-4333-8333-333333333333',
        creator_id: aliceId,
        title: 'VIP Masterclass: Systems Architecture Review Checklist (VIP)',
        body: '<p>Welcome to the private VIP systems architecture review masterclass. In this introductory section we review the essential audit requirements, operational readiness, and service level objectives.</p><p>--- CONFIDENTIAL VIP DEEP DIVE --- Exclusive checklists covering <strong>zero-loss partition failover</strong>, automated chaos injection, and blast radius isolation protocols.</p>',
        min_tier_id: vipTierId,
        created_at: new Date(baseTime.getTime() + 30 * minute),
        updated_at: now
      },
      {
        id: 'ca000004-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        creator_id: aliceId,
        title: 'Understanding PostgreSQL MVCC Internals (Free)',
        body: '<p>Deep dive into row versioning, transaction isolation levels, and vacuuming in PostgreSQL engines.</p>',
        min_tier_id: freeTierId,
        created_at: new Date(baseTime.getTime() + 35 * minute),
        updated_at: now
      },
      {
        id: 'ca000005-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        creator_id: aliceId,
        title: 'Pro Guide: High-Throughput Kafka Partitioning Strategies (Pro)',
        body: '<p>Maximizing streaming ingestion pipelines while avoiding partition hot-spotting and head-of-line blocking.</p>',
        min_tier_id: proTierId,
        created_at: new Date(baseTime.getTime() + 45 * minute),
        updated_at: now
      },
      {
        id: 'ca000006-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        creator_id: aliceId,
        title: 'VIP Deep Dive: Zero-Downtime Database Schema Migrations (VIP)',
        body: '<p>Contract-first backwards compatible column additions, view-based swaps, and live migration safety nets.</p>',
        min_tier_id: vipTierId,
        created_at: new Date(baseTime.getTime() + 55 * minute),
        updated_at: now
      },
      {
        id: 'ca000007-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        creator_id: aliceId,
        title: 'Cache Invalidation Patterns That Actually Work (Free)',
        body: '<p>Cache-aside, write-through, and change data capture cache invalidation strategies explored with benchmarks.</p>',
        min_tier_id: freeTierId,
        created_at: new Date(baseTime.getTime() + 65 * minute),
        updated_at: now
      },
      {
        id: 'ca000008-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        creator_id: aliceId,
        title: 'Pro Guide: Real-Time WebSockets Architecture at Scale (Pro)',
        body: '<p>Scaling Socket.io clusters with Redis adapters, sticky sessions, and horizontal fanout nodes.</p>',
        min_tier_id: proTierId,
        created_at: tiedTimestamp,
        updated_at: now
      },

      // Charlie Items (8 posts)
      {
        id: 'c4444444-4444-4444-8444-444444444444',
        creator_id: charlieId,
        title: 'Getting Started with Kubernetes on Bare Metal (Free)',
        body: '<p>Demystifying kubeadm, CNI network plugins, and ingress controllers when provisioning Kubernetes outside managed clouds. Hands-on configuration steps included.</p>',
        min_tier_id: freeTierId,
        created_at: new Date(baseTime.getTime() + 15 * minute),
        updated_at: now
      },
      {
        id: 'c5555555-5555-4555-8555-555555555555',
        creator_id: charlieId,
        title: 'Pro Guide: GitOps with ArgoCD & Helm (Pro)',
        body: '<p>Continuous automated reconciliation and declarative configuration drift detection for multi-cluster production environments with zero downtime canary rollouts.</p>',
        min_tier_id: proTierId,
        created_at: new Date(baseTime.getTime() + 25 * minute),
        updated_at: now
      },
      {
        id: 'c6666666-6666-4666-8666-666666666666',
        creator_id: charlieId,
        title: 'VIP Workshop: Production Incident Post-Mortem Analysis (VIP)',
        body: '<p>Real incident dissection covering cascading connection pool exhaustion, thundering herd effects on Redis, and automated circuit breaking patterns.</p>',
        min_tier_id: vipTierId,
        created_at: new Date(baseTime.getTime() + 40 * minute),
        updated_at: now
      },
      {
        id: 'cc000004-cccc-4ccc-8ccc-cccccccccccc',
        creator_id: charlieId,
        title: 'Terraform State Management Best Practices (Free)',
        body: '<p>Remote backends, state locking with DynamoDB, and preventing accidental resource destructions.</p>',
        min_tier_id: freeTierId,
        created_at: new Date(baseTime.getTime() + 50 * minute),
        updated_at: now
      },
      {
        id: 'cc000005-cccc-4ccc-8ccc-cccccccccccc',
        creator_id: charlieId,
        title: 'Pro Guide: Multi-Cloud BGP Routing & Anycast Setup (Pro)',
        body: '<p>Configuring BGP peering, routing tables, and latency-optimized global edge failovers.</p>',
        min_tier_id: proTierId,
        created_at: new Date(baseTime.getTime() + 60 * minute),
        updated_at: now
      },
      {
        id: 'cc000006-cccc-4ccc-8ccc-cccccccccccc',
        creator_id: charlieId,
        title: 'VIP Workshop: Multi-Region Kubernetes Disaster Recovery (VIP)',
        body: '<p>Active-passive stateful synchronization, DNS automated switchover, and RPO/RTO verification.</p>',
        min_tier_id: vipTierId,
        created_at: tiedTimestamp,
        updated_at: now
      },
      {
        id: 'cc000007-cccc-4ccc-8ccc-cccccccccccc',
        creator_id: charlieId,
        title: 'Prometheus Alerting Rules That Do Not Wake You Up (Free)',
        body: '<p>SRE-proven alerting principles based on multi-window multi-burn-rate error budget consumption.</p>',
        min_tier_id: freeTierId,
        created_at: new Date(baseTime.getTime() + 70 * minute),
        updated_at: now
      },
      {
        id: 'cc000008-cccc-4ccc-8ccc-cccccccccccc',
        creator_id: charlieId,
        title: 'VIP Masterclass: Kernel Tuning & eBPF Observability (VIP)',
        body: '<p>Deep socket inspection, memory pressure profiling, and tracing kernel network stack bottlenecks.</p>',
        min_tier_id: vipTierId,
        created_at: tiedTimestamp,
        updated_at: now
      },

      // Bob Items (8 posts)
      {
        id: 'cb000001-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        creator_id: bobId,
        title: 'Mastering Node.js Event Loop Microtasks & Macrotasks (Free)',
        body: '<p>Understanding nextTick, promise queues, timers, and I/O polling starvation in Node.js event loops.</p>',
        min_tier_id: freeTierId,
        created_at: new Date(baseTime.getTime() + 12 * minute),
        updated_at: now
      },
      {
        id: 'cb000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        creator_id: bobId,
        title: 'Pro Guide: High-Performance Caching with Redis Cluster (Pro)',
        body: '<p>Memory allocation jemalloc tuning, connection pooling, and multi-key command routing in Redis.</p>',
        min_tier_id: proTierId,
        created_at: new Date(baseTime.getTime() + 22 * minute),
        updated_at: now
      },
      {
        id: 'cb000003-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        creator_id: bobId,
        title: 'VIP Masterclass: Zero-Copy Serialization with FlatBuffers & Protobuf (VIP)',
        body: '<p>Ultra low-latency IPC, binary serialization, and zero-allocation memory buffering.</p>',
        min_tier_id: vipTierId,
        created_at: new Date(baseTime.getTime() + 32 * minute),
        updated_at: now
      },
      {
        id: 'cb000004-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        creator_id: bobId,
        title: 'Database Indexing: B-Trees vs LSM-Trees (Free)',
        body: '<p>Comparison of write amplification, read latency, and compaction overhead across storage engines.</p>',
        min_tier_id: freeTierId,
        created_at: new Date(baseTime.getTime() + 42 * minute),
        updated_at: now
      },
      {
        id: 'cb000005-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        creator_id: bobId,
        title: 'Pro Guide: HTTP/3 & QUIC Transport in Node (Pro)',
        body: '<p>Eliminating head-of-line blocking on packet loss with QUIC streams and 0-RTT handshakes.</p>',
        min_tier_id: proTierId,
        created_at: new Date(baseTime.getTime() + 52 * minute),
        updated_at: now
      },
      {
        id: 'cb000006-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        creator_id: bobId,
        title: 'VIP Masterclass: Profiling Memory Leaks with Chrome V8 DevTools (VIP)',
        body: '<p>Heap snapshots, allocation timelines, and tracking closure reference cycles in production Node.</p>',
        min_tier_id: vipTierId,
        created_at: new Date(baseTime.getTime() + 62 * minute),
        updated_at: now
      },
      {
        id: 'cb000007-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        creator_id: bobId,
        title: 'Async Hooks and Context Propagation in Modern Node (Free)',
        body: '<p>Distributed tracing correlation IDs using AsyncLocalStorage with zero thread overhead.</p>',
        min_tier_id: freeTierId,
        created_at: new Date(baseTime.getTime() + 72 * minute),
        updated_at: now
      },
      {
        id: 'cb000008-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        creator_id: bobId,
        title: 'VIP Masterclass: Writing High-Performance C++ Addons for Node (VIP)',
        body: '<p>N-API, thread safety, and thread pool offloading for compute intensive workloads.</p>',
        min_tier_id: vipTierId,
        created_at: tiedTimestamp,
        updated_at: now
      }
    ];

    for (const item of contentItems) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM content WHERE id = :id LIMIT 1`,
        { replacements: { id: item.id } }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('content', [item]);
      }
    }

    // 4. Subscriptions Matrix
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const fortyDaysAgo = new Date(Date.now() - 40 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

    const subscriptions = [
      // Sub A: VIP to Alice
      {
        id: 'fa111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        subscriber_id: subAId,
        creator_id: aliceId,
        tier_id: vipTierId,
        status: 'active',
        started_at: fortyDaysAgo,
        ends_at: null,
        created_at: fortyDaysAgo,
        updated_at: now
      },
      // Sub B: Pro to Alice
      {
        id: 'fb222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        subscriber_id: subBId,
        creator_id: aliceId,
        tier_id: proTierId,
        status: 'active',
        started_at: thirtyDaysAgo,
        ends_at: null,
        created_at: thirtyDaysAgo,
        updated_at: now
      },
      // Sub F: Pro to Alice (opt-out)
      {
        id: 'ff666666-ffff-4fff-8fff-ffffffffffff',
        subscriber_id: subFId,
        creator_id: aliceId,
        tier_id: proTierId,
        status: 'active',
        started_at: thirtyDaysAgo,
        ends_at: null,
        created_at: thirtyDaysAgo,
        updated_at: now
      },
      // Sub 07: VIP to Alice
      {
        id: 'fa000007-0007-4007-8007-000000000007',
        subscriber_id: sub07Id,
        creator_id: aliceId,
        tier_id: vipTierId,
        status: 'active',
        started_at: thirtyDaysAgo,
        ends_at: null,
        created_at: thirtyDaysAgo,
        updated_at: now
      },
      // Sub 08: Pro to Alice
      {
        id: 'fa000008-0008-4008-8008-000000000008',
        subscriber_id: sub08Id,
        creator_id: aliceId,
        tier_id: proTierId,
        status: 'active',
        started_at: twentyDaysAgo(),
        ends_at: null,
        created_at: twentyDaysAgo(),
        updated_at: now
      },
      // Sub 09: Free to Alice
      {
        id: 'fa000009-0009-4009-8009-000000000009',
        subscriber_id: sub09Id,
        creator_id: aliceId,
        tier_id: freeTierId,
        status: 'active',
        started_at: twentyDaysAgo(),
        ends_at: null,
        created_at: twentyDaysAgo(),
        updated_at: now
      },

      // Sub D: Cancelled to Charlie
      {
        id: 'fd444444-dddd-4ddd-8ddd-dddddddddddd',
        subscriber_id: subDId,
        creator_id: charlieId,
        tier_id: proTierId,
        status: 'cancelled',
        started_at: thirtyDaysAgo,
        ends_at: null,
        created_at: thirtyDaysAgo,
        updated_at: now
      },
      // Sub E: Expired to Charlie
      {
        id: 'fe555555-eeee-4eee-8eee-eeeeeeeeeeee',
        subscriber_id: subEId,
        creator_id: charlieId,
        tier_id: vipTierId,
        status: 'active',
        started_at: sixtyDaysAgo,
        ends_at: thirtyDaysAgo,
        created_at: sixtyDaysAgo,
        updated_at: now
      },
      // Sub 10: VIP to Charlie
      {
        id: 'fc000010-0010-4010-8010-000000000010',
        subscriber_id: sub10Id,
        creator_id: charlieId,
        tier_id: vipTierId,
        status: 'active',
        started_at: thirtyDaysAgo,
        ends_at: null,
        created_at: thirtyDaysAgo,
        updated_at: now
      },
      // Sub 11: Pro to Charlie
      {
        id: 'fc000011-0011-4011-8011-000000000011',
        subscriber_id: sub11Id,
        creator_id: charlieId,
        tier_id: proTierId,
        status: 'active',
        started_at: twentyDaysAgo(),
        ends_at: null,
        created_at: twentyDaysAgo(),
        updated_at: now
      },

      // Sub 12: VIP to Bob
      {
        id: 'fb000012-0012-4012-8012-000000000012',
        subscriber_id: sub12Id,
        creator_id: bobId,
        tier_id: vipTierId,
        status: 'active',
        started_at: thirtyDaysAgo,
        ends_at: null,
        created_at: thirtyDaysAgo,
        updated_at: now
      },
      // Sub 13: Pro to Bob
      {
        id: 'fb000013-0013-4013-8013-000000000013',
        subscriber_id: sub13Id,
        creator_id: bobId,
        tier_id: proTierId,
        status: 'active',
        started_at: twentyDaysAgo(),
        ends_at: null,
        created_at: twentyDaysAgo(),
        updated_at: now
      },
      // Sub 14: Pro to Bob
      {
        id: 'fb000014-0014-4014-8014-000000000014',
        subscriber_id: sub14Id,
        creator_id: bobId,
        tier_id: proTierId,
        status: 'active',
        started_at: tenDaysAgo(),
        ends_at: null,
        created_at: tenDaysAgo(),
        updated_at: now
      },
      // Sub 15: Free to Bob
      {
        id: 'fb000015-0015-4015-8015-000000000015',
        subscriber_id: sub15Id,
        creator_id: bobId,
        tier_id: freeTierId,
        status: 'active',
        started_at: tenDaysAgo(),
        ends_at: null,
        created_at: tenDaysAgo(),
        updated_at: now
      }
    ];

    function twentyDaysAgo() {
      return new Date(Date.now() - 20 * 86400000);
    }
    function tenDaysAgo() {
      return new Date(Date.now() - 10 * 86400000);
    }

    for (const sub of subscriptions) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM subscriptions WHERE subscriber_id = :subId AND creator_id = :creatorId LIMIT 1`,
        { replacements: { subId: sub.subscriber_id, creatorId: sub.creator_id } }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('subscriptions', [sub]);
      }
    }

    // 5. Subscription Events (Deterministic 45-day history)
    const subEvents = [];
    for (const sub of subscriptions) {
      subEvents.push({
        id: require('crypto').randomUUID(),
        subscriber_id: sub.subscriber_id,
        creator_id: sub.creator_id,
        from_tier_id: null,
        to_tier_id: sub.tier_id,
        event: 'created',
        created_at: sub.started_at
      });

      if (sub.status === 'cancelled') {
        subEvents.push({
          id: require('crypto').randomUUID(),
          subscriber_id: sub.subscriber_id,
          creator_id: sub.creator_id,
          from_tier_id: sub.tier_id,
          to_tier_id: null,
          event: 'cancelled',
          created_at: new Date(sub.started_at.getTime() + 5 * 86400000)
        });
      }
    }

    for (const ev of subEvents) {
      await queryInterface.sequelize.query(
        `INSERT IGNORE INTO subscription_events (id, subscriber_id, creator_id, from_tier_id, to_tier_id, event, created_at)
         VALUES (:id, :subscriber_id, :creator_id, :from_tier_id, :to_tier_id, :event, :created_at)`,
        { replacements: ev }
      );
    }

    // 6. Comments
    const tenMinAgo = new Date(Date.now() - 10 * 60000);
    const twentyMinAgo = new Date(Date.now() - 20 * 60000);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    const fiveMinAgo = new Date(Date.now() - 5 * 60000);
    const twoMinAgo = new Date(Date.now() - 2 * 60000);

    const comments = [
      {
        id: 'ca111111-1111-4111-8111-111111111111',
        content_id: 'c1111111-1111-4111-8111-111111111111',
        user_id: subAId,
        body: 'Super clear breakdown of the outbox pattern! Implemented it yesterday.',
        created_at: thirtyMinAgo,
        updated_at: thirtyMinAgo
      },
      {
        id: 'ca111112-1111-4111-8111-111111111112',
        content_id: 'c1111111-1111-4111-8111-111111111111',
        user_id: subBId,
        body: 'Agreed, the retry loop and dead letter handling were especially insightful.',
        created_at: twentyMinAgo,
        updated_at: twentyMinAgo
      },
      {
        id: 'ca111113-1111-4111-8111-111111111113',
        content_id: 'c1111111-1111-4111-8111-111111111111',
        user_id: aliceId,
        body: 'Thanks everyone! Let me know if you run into any edge cases with concurrent pollers.',
        created_at: fiveMinAgo,
        updated_at: fiveMinAgo
      },
      {
        id: 'ca222222-2222-4222-8222-222222222222',
        content_id: 'c2222222-2222-4222-8222-222222222222',
        user_id: subBId,
        body: 'The Raft leader election visualizations made this click immediately.',
        created_at: twentyMinAgo,
        updated_at: twentyMinAgo
      },
      {
        id: 'ca222223-2222-4222-8222-222222222223',
        content_id: 'c2222222-2222-4222-8222-222222222222',
        user_id: subAId,
        body: 'How does this compare to Paxos leases in practical cloud deployments?',
        created_at: tenMinAgo,
        updated_at: tenMinAgo
      },
      {
        id: 'ca333331-3333-4333-8333-333333333331',
        content_id: 'c3333333-3333-4333-8333-333333333333',
        user_id: subAId,
        body: 'The blast radius isolation section is pure gold for our upcoming architecture audit.',
        created_at: tenMinAgo,
        updated_at: tenMinAgo
      },
      {
        id: 'ca333332-3333-4333-8333-333333333332',
        content_id: 'c3333333-3333-4333-8333-333333333333',
        user_id: aliceId,
        body: 'Great to hear, Bob! Feel free to ask any questions in the live chat session.',
        created_at: twoMinAgo,
        updated_at: twoMinAgo
      },
      {
        id: 'ca444441-4444-4444-8444-444444444441',
        content_id: 'ca000004-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        user_id: subCId,
        body: 'Really enjoyed the explanation of tuple visibility in Postgres.',
        created_at: twentyMinAgo,
        updated_at: twentyMinAgo
      }
    ];

    for (const comment of comments) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM comments WHERE id = :id LIMIT 1`,
        { replacements: { id: comment.id } }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('comments', [comment]);
      }
    }

    // 7. Content Reactions (Likes)
    const likes = [
      {
        id: require('crypto').randomUUID(),
        content_id: 'c1111111-1111-4111-8111-111111111111',
        user_id: subAId,
        created_at: thirtyMinAgo
      },
      {
        id: require('crypto').randomUUID(),
        content_id: 'c1111111-1111-4111-8111-111111111111',
        user_id: subBId,
        created_at: twentyMinAgo
      },
      {
        id: require('crypto').randomUUID(),
        content_id: 'c1111111-1111-4111-8111-111111111111',
        user_id: subCId,
        created_at: tenMinAgo
      },
      {
        id: require('crypto').randomUUID(),
        content_id: 'c2222222-2222-4222-8222-222222222222',
        user_id: subAId,
        created_at: twentyMinAgo
      },
      {
        id: require('crypto').randomUUID(),
        content_id: 'c2222222-2222-4222-8222-222222222222',
        user_id: subBId,
        created_at: tenMinAgo
      },
      {
        id: require('crypto').randomUUID(),
        content_id: 'c3333333-3333-4333-8333-333333333333',
        user_id: subAId,
        created_at: tenMinAgo
      },
      {
        id: require('crypto').randomUUID(),
        content_id: 'c4444444-4444-4444-8444-444444444444',
        user_id: sub10Id,
        created_at: tenMinAgo
      },
      {
        id: require('crypto').randomUUID(),
        content_id: 'c5555555-5555-4555-8555-555555555555',
        user_id: sub10Id,
        created_at: tenMinAgo
      }
    ];

    for (const lk of likes) {
      await queryInterface.sequelize.query(
        `INSERT IGNORE INTO content_reactions (id, content_id, user_id, created_at)
         VALUES (:id, :content_id, :user_id, :created_at)`,
        { replacements: lk }
      );
    }

    // 8. 45-day Daily Stats Generation
    const { toUtcDateString } = require('../../services/math/series');
    const today = new Date();
    const fortyFiveDaysAgo = new Date(today.getTime() - 45 * 86400000);

    for (let d = 45; d >= 0; d--) {
      const date = new Date(today.getTime() - d * 86400000);
      const dayStr = toUtcDateString(date);

      // Seed content daily stats for active posts
      for (const item of contentItems.slice(0, 10)) {
        const views = 5 + (d % 7);
        const lockedViews = item.min_tier_id !== freeTierId ? 2 + (d % 3) : 0;
        await queryInterface.sequelize.query(
          `INSERT INTO content_daily_stats (content_id, day, views, locked_views)
           VALUES (:contentId, :day, :views, :lockedViews)
           ON DUPLICATE KEY UPDATE views = :views, locked_views = :lockedViews`,
          {
            replacements: { contentId: item.id, day: dayStr, views, lockedViews }
          }
        );
      }
    }

    // 9. Run Rollups across the 45-day range to populate creator_daily_stats
    const rollupService = require('../../services/rollupService');
    const fromDateStr = toUtcDateString(fortyFiveDaysAgo);
    const yesterdayDate = new Date(today.getTime() - 86400000);
    const yesterdayStr = toUtcDateString(yesterdayDate);

    await rollupService.processRollups({ fromDate: fromDateStr, toDate: yesterdayStr });

    // 10. Run Trending computation
    const trendingService = require('../../services/trendingService');
    await trendingService.computeTrending({ now: today });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('content_trending', null, {});
    await queryInterface.bulkDelete('content_reactions', null, {});
    await queryInterface.bulkDelete('content_view_dedupe', null, {});
    await queryInterface.bulkDelete('content_daily_stats', null, {});
    await queryInterface.bulkDelete('creator_daily_stats', null, {});
    await queryInterface.bulkDelete('subscription_events', null, {});
    await queryInterface.bulkDelete('comments', null, {});
    await queryInterface.bulkDelete('subscriptions', null, {});
    await queryInterface.bulkDelete('content', null, {});
    await queryInterface.bulkDelete('creator_profiles', null, {});
    await queryInterface.bulkDelete('users', { is_demo: true }, {});
  }
};
