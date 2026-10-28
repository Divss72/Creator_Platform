const crypto = require('crypto');
const {
  sequelize,
  User,
  CreatorProfile,
  Tier,
  Content,
  Subscription,
  Comment
} = require('../src/models');

async function verifyAssociations() {
  console.log('\n--- Running Associations Verification Script ---\n');

  const testIdSuffix = crypto.randomUUID().slice(0, 8);
  const testCreatorEmail = `verify.creator.${testIdSuffix}@test.local`;
  const testSubEmail = `verify.sub.${testIdSuffix}@test.local`;

  let testCreator, testProfile, testTier, testContent, testSubscriber, testSubscription, testComment;

  try {
    // 0. Ensure a tier exists
    testTier = await Tier.findOne({ where: { name: 'pro' } });
    if (!testTier) {
      throw new Error("Tier 'pro' not found. Please run seeders first.");
    }
    console.log(`[Setup] Resolved Tier: ${testTier.name} (rank ${testTier.rank})`);

    // 1. Create creator and profile
    testCreator = await User.create({
      name: 'Verify Creator',
      email: testCreatorEmail,
      passwordHash: 'dummy-hash',
      role: 'creator'
    });

    testProfile = await CreatorProfile.create({
      userId: testCreator.id,
      displayName: 'Verify Creator Profile',
      bio: 'Testing profile associations'
    });
    console.log('[Setup] Created test Creator and CreatorProfile');

    // 2. Create content
    testContent = await Content.create({
      creatorId: testCreator.id,
      title: 'Association Test Post',
      body: 'Body testing associations',
      minTierId: testTier.id
    });
    console.log('[Setup] Created test Content');

    // 3. Create subscriber
    testSubscriber = await User.create({
      name: 'Verify Subscriber',
      email: testSubEmail,
      passwordHash: 'dummy-hash',
      role: 'subscriber'
    });
    console.log('[Setup] Created test Subscriber');

    // 4. Create subscription
    testSubscription = await Subscription.create({
      subscriberId: testSubscriber.id,
      creatorId: testCreator.id,
      tierId: testTier.id,
      status: 'active',
      startedAt: new Date()
    });
    console.log('[Setup] Created test Subscription');

    // 5. Create comment
    testComment = await Comment.create({
      contentId: testContent.id,
      userId: testSubscriber.id,
      body: 'Test comment verifying associations'
    });
    console.log('[Setup] Created test Comment');

    console.log('\n--- Verifying Bidirectional Associations ---\n');

    // Assertion helper
    const assert = (condition, description) => {
      if (!condition) {
        throw new Error(`Assertion failed: ${description}`);
      }
      console.log(`✅ Verified: ${description}`);
    };

    // A. User.profile
    const creatorWithProfile = await User.findByPk(testCreator.id, {
      include: [{ model: CreatorProfile, as: 'profile' }]
    });
    assert(creatorWithProfile?.profile?.displayName === 'Verify Creator Profile', 'User hasOne CreatorProfile (creator.profile)');

    // B. CreatorProfile.user
    const profileWithUser = await CreatorProfile.findOne({
      where: { userId: testCreator.id },
      include: [{ model: User, as: 'user' }]
    });
    assert(profileWithUser?.user?.email === testCreatorEmail, 'CreatorProfile belongsTo User (profile.user)');

    // C. User.contents
    const creatorWithContents = await User.findByPk(testCreator.id, {
      include: [{ model: Content, as: 'contents' }]
    });
    assert(creatorWithContents?.contents?.length === 1, 'User hasMany Content (creator.contents)');

    // D. Content.creator
    const contentWithCreator = await Content.findByPk(testContent.id, {
      include: [{ model: User, as: 'creator' }]
    });
    assert(contentWithCreator?.creator?.name === 'Verify Creator', 'Content belongsTo User (content.creator)');

    // E. Content.minTier
    const contentWithTier = await Content.findByPk(testContent.id, {
      include: [{ model: Tier, as: 'minTier' }]
    });
    assert(contentWithTier?.minTier?.name === 'pro', 'Content belongsTo Tier (content.minTier)');

    // F. Tier.contents
    const tierWithContents = await Tier.findByPk(testTier.id, {
      include: [{ model: Content, as: 'contents', where: { id: testContent.id } }]
    });
    assert(tierWithContents?.contents?.length >= 1, 'Tier hasMany Content (tier.contents)');

    // G. User (subscriber).subscribedTo
    const subWithCreators = await User.findByPk(testSubscriber.id, {
      include: [{ model: User, as: 'subscribedTo' }]
    });
    assert(subWithCreators?.subscribedTo?.some((c) => c.id === testCreator.id), 'User belongsToMany User as subscribedTo (subscriber.subscribedTo)');

    // H. User (creator).subscribers
    const creatorWithSubs = await User.findByPk(testCreator.id, {
      include: [{ model: User, as: 'subscribers' }]
    });
    assert(creatorWithSubs?.subscribers?.some((s) => s.id === testSubscriber.id), 'User belongsToMany User as subscribers (creator.subscribers)');

    // I. Subscription.tier
    const subWithTier = await Subscription.findByPk(testSubscription.id, {
      include: [{ model: Tier, as: 'tier' }]
    });
    assert(subWithTier?.tier?.name === 'pro', 'Subscription belongsTo Tier (subscription.tier)');

    // J. Content.comments
    const contentWithComments = await Content.findByPk(testContent.id, {
      include: [{ model: Comment, as: 'comments' }]
    });
    assert(contentWithComments?.comments?.length === 1, 'Content hasMany Comment (content.comments)');

    // K. Comment.user and Comment.content
    const commentWithRelations = await Comment.findByPk(testComment.id, {
      include: [
        { model: User, as: 'user' },
        { model: Content, as: 'content' }
      ]
    });
    assert(commentWithRelations?.user?.id === testSubscriber.id, 'Comment belongsTo User (comment.user)');
    assert(commentWithRelations?.content?.id === testContent.id, 'Comment belongsTo Content (comment.content)');

    console.log('\n🎉 ALL 11 ASSOCIATIONS VERIFIED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('--- Cleaning Up Test Verification Data ---');
    if (testComment) await Comment.destroy({ where: { id: testComment.id } });
    if (testSubscription) await Subscription.destroy({ where: { id: testSubscription.id } });
    if (testContent) await Content.destroy({ where: { id: testContent.id } });
    if (testProfile) await CreatorProfile.destroy({ where: { id: testProfile.id } });
    if (testSubscriber) await User.destroy({ where: { id: testSubscriber.id } });
    if (testCreator) await User.destroy({ where: { id: testCreator.id } });
    console.log('Clean up complete.');
    await sequelize.close();
  }
}

verifyAssociations();
