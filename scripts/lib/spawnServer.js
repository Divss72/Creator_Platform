'use strict';

const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Finds an open TCP port on localhost.
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * Polls http://127.0.0.1:<port>/health until it returns 200 OK or timeout.
 */
async function waitForHealth(port, maxAttempts = 100, delayMs = 200) {
  const url = `http://127.0.0.1:${port}/health`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return true;
      }
    } catch (_) {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Server at port ${port} did not become healthy in time.`);
}

/**
 * Spawns a dedicated child server process with custom environment variable overrides.
 *
 * @param {Object} [envOverrides={}] Environment variables to override
 * @returns {Promise<{ port: number, baseUrl: string, proc: ChildProcess, stop: () => Promise<void> }>}
 */
async function spawnServer(envOverrides = {}) {
  const port = envOverrides.PORT || (await getFreePort());
  const serverPath = path.resolve(__dirname, '../../src/server.js');

  const childEnv = {
    ...process.env,
    PORT: String(port),
    ...envOverrides
  };

  const proc = spawn(process.execPath, [serverPath], {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let logs = '';
  proc.stdout.on('data', (d) => {
    logs += d.toString();
  });
  proc.stderr.on('data', (d) => {
    logs += d.toString();
  });

  // Ensure process is cleaned up if parent exits
  const cleanup = () => {
    try {
      proc.kill();
    } catch (_) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await waitForHealth(port);
  } catch (err) {
    proc.kill();
    throw new Error(`Failed to spawn server on port ${port}: ${err.message}\nLogs:\n${logs}`);
  }

  const stop = () => {
    return new Promise((resolve) => {
      if (proc.killed || proc.exitCode !== null) {
        return resolve();
      }
      proc.once('exit', () => resolve());
      proc.kill();
      // Fallback kill
      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch (_) {}
        resolve();
      }, 2000);
    });
  };

  return {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    proc,
    stop,
    getLogs: () => logs
  };
}

module.exports = {
  spawnServer,
  getFreePort,
  waitForHealth
};
