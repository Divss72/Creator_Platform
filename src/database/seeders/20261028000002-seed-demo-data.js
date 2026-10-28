'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const passwordHash = bcrypt.hashSync('Password123!', 10);

    // Fixed UUIDs for predictable relational connections
    const aliceId = 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const charlieId = 'c1111111-cccc-4ccc-8ccc-cccccccccccc';
    const bobId = 'b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const daveId = 'd1111111-dddd-4ddd-8ddd-dddddddddddd';
    const eveId = 'e1111111-eeee-4eee-8eee-eeeeeeeeeeee';

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
        id: bobId,
        name: 'Bob Subscriber',
        email: 'bob.subscriber@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        created_at: now,
        updated_at: now
      },
      {
        id: daveId,
        name: 'Dave Subscriber',
        email: 'dave.subscriber@creatorhub.local',
        password_hash: passwordHash,
        role: 'subscriber',
        created_at: now,
        updated_at: now
      },
      {
        id: eveId,
        name: 'Eve Subscriber',
        email: 'eve.subscriber@creatorhub.local',
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

    // 3. Content items
    const contentItems = [
      {
        id: 'cf111111-1111-4111-8111-111111111111',
        creator_id: aliceId,
        title: 'Building Resilient Event-Driven Microservices',
        body: 'Event-driven systems decouple producer and consumer lifecycles. In this guide we explore outbox patterns, idempotent processing, and dead letter queues.',
        min_tier_id: freeTierId,
        created_at: new Date(Date.now() - 3600000 * 5),
        updated_at: now
      },
      {
        id: 'cp222222-2222-4222-8222-222222222222',
        creator_id: aliceId,
        title: 'Pro Guide: Distributed Consensus & Raft Explained',
        body: 'A deep dive into how leader elections, log replication, and commit indexes prevent split-brain conditions in distributed storage engines.',
        min_tier_id: proTierId,
        created_at: new Date(Date.now() - 3600000 * 3),
        updated_at: now
      },
      {
        id: 'cv333333-3333-4333-8333-333333333333',
        creator_id: aliceId,
        title: 'VIP Masterclass: Systems Architecture Review Checklist',
        body: 'Private access checklist and template for evaluating latency SLA guarantees, fault domains, and stateful partition recovery.',
        min_tier_id: vipTierId,
        created_at: new Date(Date.now() - 3600000 * 1),
        updated_at: now
      },
      {
        id: 'cf444444-4444-4444-8444-444444444444',
        creator_id: charlieId,
        title: 'Getting Started with Kubernetes on Bare Metal',
        body: 'Demystifying kubeadm, CNI network plugins, and ingress controllers when provisioning Kubernetes outside managed clouds.',
        min_tier_id: freeTierId,
        created_at: new Date(Date.now() - 3600000 * 4),
        updated_at: now
      },
      {
        id: 'cp555555-5555-4555-8555-555555555555',
        creator_id: charlieId,
        title: 'Pro Guide: GitOps with ArgoCD & Helm',
        body: 'Continuous reconciliation and declarative configuration for zero-downtime multi-cluster deployments.',
        min_tier_id: proTierId,
        created_at: new Date(Date.now() - 3600000 * 2),
        updated_at: now
      },
      {
        id: 'cv666666-6666-4666-8666-666666666666',
        creator_id: charlieId,
        title: 'VIP Workshop: Production Incident Post-Mortem Analysis',
        body: 'Exclusive case studies of cascading failures, thundering herds, and root cause mitigation strategies.',
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

    // 4. Subscriptions
    const subscriptions = [
      {
        id: 's1111111-1111-4111-8111-111111111111',
        subscriber_id: bobId,
        creator_id: aliceId,
        tier_id: proTierId,
        status: 'active',
        started_at: now,
        ends_at: null,
        created_at: now,
        updated_at: now
      },
      {
        id: 's2222222-2222-4222-8222-222222222222',
        subscriber_id: daveId,
        creator_id: aliceId,
        tier_id: vipTierId,
        status: 'active',
        started_at: now,
        ends_at: null,
        created_at: now,
        updated_at: now
      },
      {
        id: 's3333333-3333-4333-8333-333333333333',
        subscriber_id: eveId,
        creator_id: charlieId,
        tier_id: freeTierId,
        status: 'active',
        started_at: now,
        ends_at: null,
        created_at: now,
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

    // 5. Comments
    const comments = [
      {
        id: 'cm111111-1111-4111-8111-111111111111',
        content_id: 'cf111111-1111-4111-8111-111111111111',
        user_id: bobId,
        body: 'Super clear breakdown of the outbox pattern! Implemented it yesterday.',
        created_at: now,
        updated_at: now
      },
      {
        id: 'cm222222-2222-4222-8222-222222222222',
        content_id: 'cp222222-2222-4222-8222-222222222222',
        user_id: daveId,
        body: 'The Raft leader election visualizations made this click immediately.',
        created_at: now,
        updated_at: now
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
