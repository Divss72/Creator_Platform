#!/usr/bin/env node
'use strict';

const { reconcileAllCreators } = require('../src/jobs/firebaseReconcileJob');

async function main() {
  console.log('\n==================================================');
  console.log('CreatorHub Firebase Live Metrics Full Resync (CLI)');
  console.log('==================================================\n');

  try {
    await reconcileAllCreators();
    console.log('\n✓ Resync completed successfully.\n');
    process.exit(0);
  } catch (err) {
    console.error('💥 Resync failed:', err);
    process.exit(1);
  }
}

main();

