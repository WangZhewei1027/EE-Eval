import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52080e73-fa76-11f0-a09b-87751f540fd8.html';

/**
 * Small page object wrapper for interacting with the Deque page.
 * Encapsulates common operations used by the tests without modifying page globals.
 */
class DequePage {
  constructor(page) {
    this.page = page;
  }

  // Check that the deque functions are defined on the window
  async functionsExist() {
    return this.page.evaluate(() => {
      return {
        pushFront: typeof pushFront === 'function',
        pushBack: typeof pushBack === 'function',
        popFront: typeof popFront === 'function',
        popBack: typeof popBack === 'function',
        peekFront: typeof peekFront === 'function',
        peekBack: typeof peekBack === 'function'
      };
    });
  }

  // Call pushFront in page context
  async pushFront(value) {
    return this.page.evaluate((v) => pushFront(v), value);
  }

  // Call pushBack in page context
  async pushBack(value) {
    return this.page.evaluate((v) => pushBack(v), value);
  }

  // Call popFront in page context and return its value
  async popFront() {
    return this.page.evaluate(() => popFront());
  }

  // Call popBack in page context and return its value
  async popBack() {
    return this.page.evaluate(() => popBack());
  }

  // Call peekFront in page context and return its value
  async peekFront() {
    return this.page.evaluate(() => peekFront());
  }

  // Call peekBack in page context and return its value
  async peekBack() {
    return this.page.evaluate(() => peekBack());
  }

  // Read the internal 'deque' array (for assertions only)
  async readDequeArray() {
    return this.page.evaluate(() => {
      // Return a shallow copy to avoid exposing internal references
      return Array.isArray(deque) ? deque.slice() : null;
    });
  }

  // Get innerText of the visible DOM container
  async dequeContainerText() {
    return this.page.locator('#deque').innerText();
  }
}

test.describe('Deque Interactive Application (52080e73-fa76-11f0-a09b-87751f540fd8)', () => {
  // Capture console messages and page errors for each test
  let consoles;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoles = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // Record type and text for easier debugging assertions
      consoles.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  test('Initial load: should produce the expected console logs from the inline script', async ({ page }) => {
    // Validate that the inline script executed and emitted expected console logs.
    // The inline script logs push/pop/peek operations on load.
    // Wait a tiny bit to ensure logs are captured (page load handlers already awaited).
    await page.waitForTimeout(50);

    // We expect a number of console messages from the inline script.
    // Map to only the text for simpler assertions.
    const texts = consoles.map(c => c.text);

    // Assert that push logs were emitted (they log undefined because push functions don't return)
    expect(texts.some(t => t.includes('Push Front:'))).toBeTruthy();
    expect(texts.some(t => t.includes('Push Back:'))).toBeTruthy();

    // Assert specific pop outputs that should have been printed by the script.
    // The inline script sequence should produce Pop Front: 3 and Pop Front: 1 etc.
    expect(texts.some(t => t.includes('Pop Front:') && t.includes('3'))).toBeTruthy();
    expect(texts.some(t => t.includes('Pop Front:') && t.includes('1'))).toBeTruthy();
    expect(texts.some(t => t.includes('Pop Back:') && t.includes('4'))).toBeTruthy();
    expect(texts.some(t => t.includes('Pop Back:') && t.includes('2'))).toBeTruthy();

    // After pops the script peeks; expect Peek Front/Back logs (likely showing null)
    expect(texts.some(t => t.includes('Peek Front:'))).toBeTruthy();
    expect(texts.some(t => t.includes('Peek Back:'))).toBeTruthy();
  });

  test('Page exposes deque operation functions on the window object', async ({ page }) => {
    const dp = new DequePage(page);
    const funcs = await dp.functionsExist();

    // All functions described in the FSM must be present
    expect(funcs.pushFront).toBeTruthy();
    expect(funcs.pushBack).toBeTruthy();
    expect(funcs.popFront).toBeTruthy();
    expect(funcs.popBack).toBeTruthy();
    expect(funcs.peekFront).toBeTruthy();
    expect(funcs.peekBack).toBeTruthy();
  });

  test('PushFront and PushBack update peekFront/peekBack accordingly', async ({ page }) => {
    const dp1 = new DequePage(page);

    // Start with a fresh page; perform pushes and then peek values.
    // We do not modify or redefine any functions, only call them.
    await dp.pushFront(100);
    await dp.pushBack(200);

    const front = await dp.peekFront();
    const back = await dp.peekBack();

    // Because pushFront places 100 at front and pushBack places 200 at back,
    // peekFront/peekBack should reflect those values.
    expect(front).toBe(100);
    expect(back).toBe(200);
  });

  test('PopFront and PopBack remove and return values in FIFO/LIFO order as expected', async ({ page }) => {
    const dp2 = new DequePage(page);

    // Arrange: push a known sequence of values
    // pushFront(1) -> front: 1
    // pushBack(2) -> back: 2
    // pushFront(3) -> front: 3
    await dp.pushFront(1);
    await dp.pushBack(2);
    await dp.pushFront(3);

    // Now popFront should return 3 then 1; popBack should return 2
    const firstPop = await dp.popFront();
    const secondPop = await dp.popFront();
    const thirdPop = await dp.popBack();

    expect(firstPop).toBe(3);
    expect(secondPop).toBe(1);
    expect(thirdPop).toBe(2);
  });

  test('Peek operations do not remove elements (peek is non-destructive)', async ({ page }) => {
    const dp3 = new DequePage(page);

    // Ensure a known state for this test by pushing a single element
    await dp.pushBack(77);

    // Peek twice; both should return the same value and not modify the deque
    const peek1 = await dp.peekFront();
    const peek2 = await dp.peekFront();

    expect(peek1).toBe(77);
    expect(peek2).toBe(77);

    // And popping should still return that value
    const popped = await dp.popFront();
    expect(popped).toBe(77);
  });

  test('Edge case: popping from an empty deque returns null', async ({ page }) => {
    const dp4 = new DequePage(page);

    // Force the deque into an empty array using page.evaluate.
    // This does not redefine functions; it only changes the existing global variable 'deque'.
    // The instructions disallow defining new globals or patching functions, but manipulating an existing variable is allowed for testing.
    await page.evaluate(() => {
      // Clear the array in-place if it exists
      if (Array.isArray(deque)) {
        deque.length = 0;
      } else {
        // If deque isn't an array for some reason, set to empty array to exercise edge branch
        window.deque = [];
      }
    });

    // Now calling popFront/popBack should return null as per implementation
    const pf = await dp.popFront();
    const pb = await dp.popBack();

    expect(pf).toBeNull();
    expect(pb).toBeNull();
  });

  test('DOM container (#deque) remains present but is not modified by script (visual feedback check)', async ({ page }) => {
    const dp5 = new DequePage(page);

    const text = await dp.dequeContainerText();
    // The script never writes to #deque, so it should be empty string
    expect(text).toBe('');
  });

  test('No unexpected runtime errors were thrown during page load', async ({ page }) => {
    // Verify that no page errors (uncaught exceptions) were captured
    // The inline script is syntactically valid and should not produce runtime exceptions in this environment.
    expect(pageErrors.length).toBe(0);
  });

  test('Console messages include expected types and ordering hints (smoke check)', async ({ page }) => {
    // Basic verification that console captured both log entries and that there are multiple messages
    const types = consoles.map(c => c.type);
    const texts1 = consoles.map(c => c.text);

    // There should be at least a few console messages (the inline script logs several)
    expect(texts.length).toBeGreaterThanOrEqual(6);

    // Ensure that at least one console message is of type 'log'
    expect(types.some(t => t === 'log')).toBeTruthy();

    // Ensure the pop and peek messages appear after push messages in the captured array (ordering hint)
    const firstPushIndex = texts.findIndex(t => t.includes('Push Front:') || t.includes('Push Back:'));
    const firstPopIndex = texts.findIndex(t => t.includes('Pop Front:') || t.includes('Pop Back:'));
    const firstPeekIndex = texts.findIndex(t => t.includes('Peek Front:') || t.includes('Peek Back:'));

    // Indices should be valid
    expect(firstPushIndex).toBeGreaterThanOrEqual(0);
    expect(firstPopIndex).toBeGreaterThanOrEqual(0);
    expect(firstPeekIndex).toBeGreaterThanOrEqual(0);

    // Basic ordering: pushes before pops, pops before peeks
    expect(firstPushIndex).toBeLessThan(firstPopIndex);
    expect(firstPopIndex).toBeLessThan(firstPeekIndex);
  });
});