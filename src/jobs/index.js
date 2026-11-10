'use strict';

const emailWorker = require('./emailWorker');
const { startPurgeJob, stopPurgeJob } = require('./purgeJob');
const { startDigestJob, stopDigestJob } = require('./digestJob');
const { startReconcileJob, stopReconcileJob } = require('./firebaseReconcileJob');
const { startTrendingJob, stopTrendingJob } = require('./trendingJob');
const { startRollupJob, stopRollupJob } = require('./rollupJob');

let jobsStarted = false;

function startJobs() {
  if (jobsStarted) return;
  jobsStarted = true;

  console.log('[Jobs] Starting background workers and schedulers...');
  emailWorker.start();
  startPurgeJob();
  startDigestJob();
  startReconcileJob();
  startTrendingJob();
  startRollupJob();
}

async function stopJobs() {
  if (!jobsStarted) return;
  jobsStarted = false;

  console.log('[Jobs] Stopping background workers and schedulers...');
  stopRollupJob();
  stopTrendingJob();
  stopReconcileJob();
  stopDigestJob();
  stopPurgeJob();
  await emailWorker.stop();
}

module.exports = {
  startJobs,
  stopJobs
};
