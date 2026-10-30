'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const passwordHash = bcrypt.hashSync('Password123!', 10);

    // Valid hex-compliant UUIDs for deterministic paywall verification
    const aliceId = 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const charlieId = 'c1111111-cccc-4ccc-8ccc-cccccccccccc';

    const subAId = 'a0000001-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; // Subscriber A (Alice VIP)
    const subBId = 'b0000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; // Subscriber B (Alice Pro)
    const subCId = 'c0000003-cccc-4ccc-8ccc-cccccccccccc'; // Subscriber C (No subscriptions)
    const subDId = 'd0000004-dddd-4ddd-8ddd-dddddddddddd'; // Subscriber D (Cancelled sub to Charlie)
    const subEId = 'e0000005-eeee-4eee-8eee-eeeeeeeeeeee'; // Subscriber E (Expired sub to Charlie)

    const freeTierId = '11111111-1111-4111-8111-111111111111';
    const proTierId = '22222222-2222-4222-8222-222222222222';
    const vipTierId = '33333333-3333-4333-8333-333333333333';

    // 1. Users
    const users = [
      {
        id: aliceId,
        name: 'Alice Creator',
        email: 'alice.creator@creatorhub.local',
        password_hash: passwordHash,
        role: 'creator',
        created_at: now,
        updated_at: now
      },
      {
        id: charlieId,
        name: 'Charlie Creator',
        email: 'charlie.creator@creatorhub.local',
        password_hash: passwordHash,
        role: 'creator',
        created_at: now,
        updated_at: now
      },
      {
        id: subAId,
        name: 'Subscriber A (VIP)',
        email: 'suba.vip@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        created_at: now,
        updated_at: now
      },
      {
        id: subBId,
        name: 'Subscriber B (Pro)',
        email: 'subb.pro@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        created_at: now,
        updated_at: now
      },
      {
        id: subCId,
        name: 'Subscriber C (Free)',
        email: 'subc.free@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        created_at: now,
        updated_at: now
      },
      {
        id: subDId,
        name: 'Subscriber D (Cancelled)',
        email: 'subd.cancelled@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        created_at: now,
        updated_at: now
      },
      {
        id: subEId,
        name: 'Subscriber E (Expired)',
        email: 'sube.expired@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
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

    // 3. Content items across all tiers for both creators (Strict Hex UUIDs)
    const contentItems = [
      {
        id: 'c1111111-1111-4111-8111-111111111111',
        creator_id: aliceId,
        title: 'Building Resilient Event-Driven Microservices (Free)',
        body: 'Event-driven systems decouple producer and consumer lifecycles. In this free guide we explore outbox patterns, idempotent message processing, and dead letter queues in distributed systems.',
        min_tier_id: freeTierId,
        created_at: new Date(Date.now() - 3600000 * 5),
        updated_at: now
      },
      {
        id: 'c2222222-2222-4222-8222-222222222222',
        creator_id: aliceId,
        title: 'Pro Guide: Distributed Consensus & Raft Protocol (Pro)',
        body: 'In this exclusive pro guide we introduce the core challenges of distributed consensus across modern database clusters. We will explore network splits, quorum requirements, and term numbering. --- DEEP TECHNICAL DIVE BELOW --- Leader elections, log replication, and commit indexes prevent split-brain conditions in distributed storage engines like etcd, CockroachDB, and Kafka metadata.',
        min_tier_id: proTierId,
        created_at: new Date(Date.now() - 3600000 * 3),
        updated_at: now
      },
      {
        id: 'c3333333-3333-4333-8333-333333333333',
        creator_id: aliceId,
        title: 'VIP Masterclass: Systems Architecture Review Checklist (VIP)',
        body: 'Welcome to the private VIP systems architecture review masterclass. In this introductory section we review the essential audit requirements, operational readiness, and service level objectives. --- CONFIDENTIAL VIP DEEP DIVE --- Exclusive checklists covering zero-loss partition failover, automated chaos injection, and blast radius isolation protocols.',
        min_tier_id: vipTierId,
        created_at: new Date(Date.now() - 3600000 * 1),
        updated_at: now
      },
      {
        id: 'c4444444-4444-4444-8444-444444444444',
        creator_id: charlieId,
        title: 'Getting Started with Kubernetes on Bare Metal (Free)',
        body: 'Demystifying kubeadm, CNI network plugins, and ingress controllers when provisioning Kubernetes outside managed clouds. Hands-on configuration steps included.',
        min_tier_id: freeTierId,
        created_at: new Date(Date.now() - 3600000 * 4),
        updated_at: now
      },
      {
        id: 'c5555555-5555-4555-8555-555555555555',
        creator_id: charlieId,
        title: 'Pro Guide: GitOps with ArgoCD & Helm (Pro)',
        body: 'Continuous automated reconciliation and declarative configuration drift detection for multi-cluster production environments with zero downtime canary rollouts.',
        min_tier_id: proTierId,
        created_at: new Date(Date.now() - 3600000 * 2),
        updated_at: now
      },
      {
        id: 'c6666666-6666-4666-8666-666666666666',
        creator_id: charlieId,
        title: 'VIP Workshop: Production Incident Post-Mortem Analysis (VIP)',
        body: 'Real incident dissection covering cascading connection pool exhaustion, thundering herd effects on Redis, and automated circuit breaking patterns.',
        min_tier_id: vipTierId,
        created_at: now,
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

    // 4. Subscriptions matrix (Active VIP, Active Pro, Cancelled, Expired)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

    const subscriptions = [
      // Subscriber A: VIP subscription to Alice (Creator 1)
      {
        id: 'fa111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        subscriber_id: subAId,
        creator_id: aliceId,
        tier_id: vipTierId,
        status: 'active',
        started_at: now,
        ends_at: null,
        created_at: now,
        updated_at: now
      },
      // Subscriber B: Pro subscription to Alice (Creator 1)
      {
        id: 'fb222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        subscriber_id: subBId,
        creator_id: aliceId,
        tier_id: proTierId,
        status: 'active',
        started_at: now,
        ends_at: null,
        created_at: now,
        updated_at: now
      },
      // Subscriber D: Cancelled Pro subscription to Charlie (Creator 2)
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
      // Subscriber E: Expired VIP subscription to Charlie (Creator 2)
      {
        id: 'fe555555-eeee-4eee-8eee-eeeeeeeeeeee',
        subscriber_id: subEId,
        creator_id: charlieId,
        tier_id: vipTierId,
        status: 'active',
        started_at: sixtyDaysAgo,
        ends_at: thirtyDaysAgo, // ends_at in past -> expired
        created_at: sixtyDaysAgo,
        updated_at: now
      }
    ];

    for (const sub of subscriptions) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM subscriptions WHERE subscriber_id = :subId AND creator_id = :creatorId LIMIT 1`,
        { replacements: { subId: sub.subscriber_id, creatorId: sub.creator_id } }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('subscriptions', [sub]);
      }
    }

    // 5. Comments (plain text, realistic, attached to posts of different tiers)
    const tenMinAgo = new Date(Date.now() - 10 * 60000);
    const twentyMinAgo = new Date(Date.now() - 20 * 60000);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60000);
    const fiveMinAgo = new Date(Date.now() - 5 * 60000);
    const twoMinAgo = new Date(Date.now() - 2 * 60000);

    const comments = [
      // Free Post Comments (c111...)
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
      // Pro Post Comments (c222...)
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
      // VIP Post Comments (c333...)
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('comments', null, {});
    await queryInterface.bulkDelete('subscriptions', null, {});
    await queryInterface.bulkDelete('content', null, {});
    await queryInterface.bulkDelete('creator_profiles', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
