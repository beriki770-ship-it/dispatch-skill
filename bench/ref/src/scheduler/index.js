'use strict';

const { systemClock } = require('../util/clock');

// Runs recurring housekeeping jobs (purging sessions, pruning the rate
// limiter). Jobs are not run on their own timers: a single tick checks which
// jobs are due, which keeps the order of execution predictable and makes the
// scheduler easy to drive from tests with runDue().
function createScheduler({ clock = systemClock } = {}) {
  const jobs = new Map();
  let timer = null;

  function every(name, intervalMs, fn) {
    if (jobs.has(name)) throw new Error(`Job "${name}" is already scheduled`);
    if (!Number.isInteger(intervalMs) || intervalMs <= 0) throw new Error('intervalMs must be a positive integer');
    jobs.set(name, {
      name,
      intervalMs,
      fn,
      nextRunAt: clock.now() + intervalMs,
      runs: 0,
      lastError: null,
      running: false,
    });
  }

  function cancel(name) {
    return jobs.delete(name);
  }

  // Runs every job whose time has come, one after another. A failing job
  // records its error and is rescheduled; it does not stop the others.
  // Returns the names of the jobs that ran.
  async function runDue() {
    const now = clock.now();
    const ran = [];
    for (const job of jobs.values()) {
      if (job.running || job.nextRunAt > now) continue;
      job.running = true;
      try {
        await job.fn();
        job.lastError = null;
      } catch (error) {
        job.lastError = error;
      } finally {
        job.running = false;
        job.runs += 1;
        job.nextRunAt = now + job.intervalMs;
        ran.push(job.name);
      }
    }
    return ran;
  }

  function start(tickMs = 1000) {
    if (timer) return;
    timer = setInterval(() => {
      runDue().catch(() => {});
    }, tickMs);
    // Housekeeping must never keep the process alive on its own.
    timer.unref();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function list() {
    return [...jobs.values()].map(({ name, intervalMs, nextRunAt, runs, lastError }) => ({
      name,
      intervalMs,
      nextRunAt,
      runs,
      lastError: lastError ? lastError.message : null,
    }));
  }

  return { every, cancel, runDue, start, stop, list };
}

module.exports = { createScheduler };
