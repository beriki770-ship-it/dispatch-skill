'use strict';

// Every module reads time through a clock object instead of calling
// Date.now() directly, so tests can freeze or advance time.

const systemClock = {
  now: () => Date.now(),
};

function fixedClock(start = Date.UTC(2026, 0, 1)) {
  let current = typeof start === 'number' ? start : Date.parse(start);
  return {
    now: () => current,
    set(value) {
      current = typeof value === 'number' ? value : Date.parse(value);
    },
    advance(ms) {
      current += ms;
    },
  };
}

module.exports = { systemClock, fixedClock };
