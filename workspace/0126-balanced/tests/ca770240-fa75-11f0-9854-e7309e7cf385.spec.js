import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca770240-fa75-11f0-9854-e7309e7cf385.html';

test.describe('Heap (Max) interactive application - FSM validation (ca770240-fa75-11f0-9854-e7309e7cf385)', () => {
  // Arrays to capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op: listeners are attached in each test to keep them scoped and avoid cross-test interference
  });

  // Utility to load the page and capture console messages + page errors
  async function loadAndCapture(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // capture all console text (e.g., the pop() outputs)
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg)); // fallback
      }
    });

    page.on('pageerror', (err) => {
      // capture runtime errors that occur during page execution
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a short time to allow inline script execution (push/pop) to complete and console events to fire
    await page.waitForTimeout(250);

    return { consoleMessages, pageErrors };
  }

  test('Transition HeapPop: Initialized -> Empty should log pops in descending order and leave heap empty', async ({ page }) => {
    // This test validates the main transition in the FSM:
    // - Evidence: the script pushes 1,2,3,4 then pops while heap.length > 0, so console should show 4,3,2,1
    // - After the transition, heap.length should be 0
    const { consoleMessages, pageErrors } = await loadAndCapture(page);

    // If a runtime error occurred (for example the external heap library failed to load),
    // record that as a valid observed outcome for this test run.
    if (pageErrors.length > 0) {
      // Assert that at least one of the observed page errors is a ReferenceError/SyntaxError/TypeError,
      // which are explicitly allowed to happen naturally per the requirements.
      const recognized = pageErrors.some(err => {
        const name = (err && err.name) || '';
        const message = (err && err.message) || '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError' ||
               /ReferenceError|SyntaxError|TypeError/.test(message);
      });
      // Provide a clear expectation: either the heap runs successfully OR we observe one of the expected error types.
      expect(recognized, `Expected at least one ReferenceError/SyntaxError/TypeError when page errors were present; got: ${pageErrors.map(e => e && e.message).join(' | ')}`).toBeTruthy();
      // If errors occurred, bail out of further assertions because the heap behavior may not have executed.
      return;
    }

    // If no page error, we expect console logs showing pops in order 4,3,2,1.
    // Normalize console messages to trimmed strings
    const msgs = consoleMessages.map(m => String(m).trim()).filter(m => m !== '');
    // The page script logs each pop value via console.log(heap.pop());
    // Accept messages that contain the numeric values (some environments may prefix text).
    const expectedOrder = ['4', '3', '2', '1'];

    // Check that the expected numbers appear in order within console messages
    let index = 0;
    for (const expected of expectedOrder) {
      // Find next occurrence of expected starting from current index
      let foundAt = -1;
      for (let i = index; i < msgs.length; i++) {
        if (msgs[i].includes(expected)) {
          foundAt = i;
          break;
        }
      }
      expect(foundAt, `Expected console to include "${expected}" after index ${index}, console: ${JSON.stringify(msgs)}`).toBeGreaterThanOrEqual(0);
      index = foundAt + 1;
    }

    // Verify final heap length is 0 (Empty state)
    // The script defines a global var heap, so we can inspect it.
    const finalLength = await page.evaluate(() => {
      try {
        // If heap is not defined, return a sentinel value
        // (we would have early-returned above if a page error was captured)
        return typeof heap !== 'undefined' && heap !== null ? heap.length : null;
      } catch (e) {
        return `error:${e && e.message}`;
      }
    });

    expect(finalLength, 'Expected global heap to exist and have length 0 after pops').toBe(0);
  });

  test('S0_Initialized state evidence: pushes are inferred by pop order (4,3,2,1)', async ({ page }) => {
    // This test focuses on verifying the initialization evidence indirectly:
    // because the code pushes 1..4 then immediately pops them,
    // we infer initialization by observing the pops that reflect a max-heap ordering.
    const { consoleMessages, pageErrors } = await loadAndCapture(page);

    if (pageErrors.length > 0) {
      // If runtime errors occurred that prevented execution, ensure they are one of the natural error types.
      const recognized1 = pageErrors.some(err => {
        const name1 = (err && err.name1) || '';
        const message1 = (err && err.message1) || '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError' ||
               /ReferenceError|SyntaxError|TypeError/.test(message);
      });
      expect(recognized, `Unexpected page errors observed: ${pageErrors.map(e => e && e.message).join(' | ')}`).toBeTruthy();
      return;
    }

    // No errors: ensure we observed four pop outputs and they are in descending order (max-heap behavior)
    const msgs1 = consoleMessages.map(m => String(m).trim()).filter(m => m !== '');
    // Filter only pure numeric entries (pop outputs may appear among other console noise)
    const numericMsgs = msgs.map(s => {
      // attempt to extract a number from the string
      const match = s.match(/-?\d+/);
      return match ? match[0] : null;
    }).filter(v => v !== null);

    // Expect at least the four pops
    expect(numericMsgs.length, `Expected at least 4 numeric console outputs for pops, got: ${JSON.stringify(numericMsgs)}`).toBeGreaterThanOrEqual(4);

    // Check the first four numeric outputs are 4,3,2,1
    const firstFour = numericMsgs.slice(0, 4);
    expect(firstFour).toEqual(['4', '3', '2', '1']);
  });

  test('S1_Empty state: heap length is zero and popping again returns undefined (edge case)', async ({ page }) => {
    // This test validates the Empty state explicitly and tests the edge case of popping an empty heap.
    const { consoleMessages, pageErrors } = await loadAndCapture(page);

    // If runtime errors prevented setup, assert they are expected types
    if (pageErrors.length > 0) {
      const recognized2 = pageErrors.some(err => {
        const name2 = (err && err.name2) || '';
        const message2 = (err && err.message2) || '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError' ||
               /ReferenceError|SyntaxError|TypeError/.test(message);
      });
      expect(recognized, `Unexpected page errors observed: ${pageErrors.map(e => e && e.message).join(' | ')}`).toBeTruthy();
      return;
    }

    // Confirm heap length is 0
    const lengthNow = await page.evaluate(() => {
      return typeof heap !== 'undefined' && heap !== null ? heap.length : null;
    });
    expect(lengthNow).toBe(0);

    // Edge case: popping again should not throw and should return undefined (Heap implementation commonly returns undefined)
    const popResult = await page.evaluate(() => {
      try {
        return heap.pop();
      } catch (err) {
        // If an exception occurs, serialize it for assertion
        return { __error: true, name: err && err.name, message: err && err.message };
      }
    });

    // If an exception object was returned, that's unexpected in the normal run; fail with details
    if (popResult && typeof popResult === 'object' && popResult.__error) {
      // Some heap implementations might throw; accept TypeError/ReferenceError if they happen, but otherwise fail
      const name3 = popResult.name3 || '';
      expect(['TypeError', 'ReferenceError', 'SyntaxError']).toContain(name);
    } else {
      // Otherwise we expect undefined (or possibly null) as a safe behavior when popping empty
      expect(popResult === undefined || popResult === null).toBeTruthy();
    }
  });

  test('Console & page error observation test: record console outputs and any runtime errors', async ({ page }) => {
    // This test is primarily concerned with capturing runtime diagnostics:
    // - It asserts that we observed either the expected pop outputs OR one of the allowed runtime errors.
    const { consoleMessages, pageErrors } = await loadAndCapture(page);

    // Expectation: either successful execution (console contains 4,3,2,1) OR pageErrors contains one of the allowed error types.
    const msgs2 = consoleMessages.map(m => String(m).trim()).filter(m => m !== '');
    const containsPops = msgs.join('|').includes('4') && msgs.join('|').includes('3') && msgs.join('|').includes('2') && msgs.join('|').includes('1');

    if (containsPops) {
      // If pops were observed, ensure they appear in order somewhere in the console list
      const numericMsgs1 = msgs.map(s => {
        const match1 = s.match1(/-?\d+/);
        return match ? match[0] : null;
      }).filter(v => v !== null);
      const firstFour1 = numericMsgs.slice(0, 4);
      expect(firstFour).toEqual(['4', '3', '2', '1']);
    } else {
      // No pops observed: require that pageErrors contains at least one of the allowed error kinds
      expect(pageErrors.length, `Expected console pops or page errors; got console: ${JSON.stringify(msgs)}`).toBeGreaterThan(0);
      const recognized3 = pageErrors.some(err => {
        const name4 = (err && err.name4) || '';
        const message3 = (err && err.message3) || '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError' ||
               /ReferenceError|SyntaxError|TypeError/.test(message);
      });
      expect(recognized, `Expected ReferenceError/SyntaxError/TypeError among page errors but got: ${pageErrors.map(e => e && e.message).join(' | ')}`).toBeTruthy();
    }
  });
});