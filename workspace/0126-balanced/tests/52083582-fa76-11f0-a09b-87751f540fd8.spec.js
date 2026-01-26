import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52083582-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Set Demo (FSM) - 52083582-fa76-11f0-a09b-87751f540fd8', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup before each test: open the page and capture console logs and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, log, error, etc.)
    page.on('console', (msg) => {
      // Save both the type and the text for richer assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application HTML - the page's inline script will run on load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Best-effort cleanup: remove listeners by closing the page (test runner handles it)
    // Nothing else to teardown since tests do not modify external state.
    await page.close();
  });

  test('Initial load - should emit expected console logs for FSM entry actions', async ({ page }) => {
    // This test validates that the inline script executed and logged the expected entry messages
    // which correspond to the FSM states' entry_actions from the FSM definition.

    // Helper to assert a console label exists
    const hasLogContaining = (substr) => consoleMessages.some(m => m.text.includes(substr));

    // Check presence of each expected log label emitted by the page script
    expect(hasLogContaining('Initial Set')).toBe(true); // S0 entry action
    expect(hasLogContaining('After adding 7')).toBe(true); // S1 entry action
    expect(hasLogContaining('After deleting 3')).toBe(true); // S2 entry action
    expect(hasLogContaining('After clearing Set')).toBe(true); // S3 entry action
    expect(hasLogContaining('After adding 8')).toBe(true); // S4 entry action
    expect(hasLogContaining('After deleting 8')).toBe(true); // S5 entry action
    expect(hasLogContaining('After deleting 3 and 4')).toBe(true); // S6 entry action

    // Additional logs that exist in the HTML script: contains checks
    expect(hasLogContaining('Set contains 3')).toBe(true);
    expect(hasLogContaining('Set contains 7')).toBe(true);
    expect(hasLogContaining('Set contains 8')).toBe(true);
    expect(hasLogContaining('Set contains 3 and 4')).toBe(true);

    // Ensure no unexpected ReferenceError / SyntaxError / TypeError occurred during load
    const fatalErrors = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError'
    );
    expect(fatalErrors.length).toBe(0);
  });

  test('Final state after page script completes should match FSM expected state (contains only 7)', async ({ page }) => {
    // The inline script runs a sequence of operations. After completion, the resulting mySet
    // should reflect the final FSM state. We read window.mySet and validate its contents.

    const finalSetArray = await page.evaluate(() => Array.from(window.mySet));
    // Based on the HTML sequence:
    // start: [1,2,3,4,5,6]
    // add 7 => includes 7
    // delete 3 => 3 removed
    // clear => empty
    // add 7, add 8 => [7,8]
    // delete 8 => [7]
    // delete 3 and 4 => still [7]
    expect(Array.isArray(finalSetArray)).toBe(true);
    expect(finalSetArray.length).toBe(1);
    expect(finalSetArray).toEqual([7]);

    // Also assert that mySet.has(7) && not has(8)
    const contains7 = await page.evaluate(() => window.mySet.has(7));
    const contains8 = await page.evaluate(() => window.mySet.has(8));
    expect(contains7).toBe(true);
    expect(contains8).toBe(false);
  });

  test('Step-by-step FSM transitions on a fresh set: Add7 -> Delete3 -> Clear -> Add8 -> Delete8 -> Delete3And4', async ({ page }) => {
    // This test resets the existing mySet to a known initial state (using the existing global mySet)
    // and then performs each FSM event in sequence, verifying the set contents after each transition.
    // We do not redefine globals; we operate on the existing window.mySet provided by the page.

    // Reset mySet to initial evidence: new Set([1,2,3,4,5,6]) by clearing and re-adding
    await page.evaluate(() => {
      window.mySet.clear();
      [1, 2, 3, 4, 5, 6].forEach(n => window.mySet.add(n));
      // Return the set so Playwright can implicitly await completion (no-op)
      return Array.from(window.mySet);
    });

    // 1) Add7
    const afterAdd7 = await page.evaluate(() => {
      window.mySet.add(7);
      return Array.from(window.mySet);
    });
    expect(afterAdd7.includes(7)).toBe(true);
    expect(afterAdd7.length).toBe(7); // initial 6 + 1 new

    // 2) Delete3
    const delete3Result = await page.evaluate(() => {
      const ok = window.mySet.delete(3);
      return { ok, arr: Array.from(window.mySet) };
    });
    expect(delete3Result.ok).toBe(true);
    expect(delete3Result.arr.includes(3)).toBe(false);
    expect(delete3Result.arr.length).toBe(6);

    // 3) ClearSet
    const afterClear = await page.evaluate(() => {
      window.mySet.clear();
      return Array.from(window.mySet);
    });
    expect(afterClear.length).toBe(0);

    // 4) Add8
    const afterAdd8 = await page.evaluate(() => {
      window.mySet.add(8);
      return Array.from(window.mySet);
    });
    expect(afterAdd8).toEqual([8]);

    // 5) Delete8
    const afterDelete8 = await page.evaluate(() => {
      const ok = window.mySet.delete(8);
      return { ok, arr: Array.from(window.mySet) };
    });
    expect(afterDelete8.ok).toBe(true);
    expect(afterDelete8.arr.length).toBe(0);

    // 6) Delete3And4 (on an empty set, these deletes should return false)
    const afterDelete3And4 = await page.evaluate(() => {
      const r3 = window.mySet.delete(3);
      const r4 = window.mySet.delete(4);
      return { r3, r4, arr: Array.from(window.mySet) };
    });
    // Since 3 and 4 are not present after clear, both deletes should be false
    expect(afterDelete3And4.r3).toBe(false);
    expect(afterDelete3And4.r4).toBe(false);
    expect(afterDelete3And4.arr.length).toBe(0);

    // Confirm no page errors were emitted during these manipulations
    const fatalErrors = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError'
    );
    expect(fatalErrors.length).toBe(0);
  });

  test('Edge cases and error scenarios: duplicates, deleting non-existent items, and return values', async ({ page }) => {
    // This test explores edge behaviors of Set operations:
    // - Adding duplicate values should not increase size
    // - Deleting a non-existent item should return false
    // - delete() return values are boolean as expected

    // Reset mySet to initial: [1..6]
    await page.evaluate(() => {
      window.mySet.clear();
      [1, 2, 3, 4, 5, 6].forEach(n => window.mySet.add(n));
      return Array.from(window.mySet);
    });

    // Confirm initial size is 6
    const initialSize = await page.evaluate(() => window.mySet.size);
    expect(initialSize).toBe(6);

    // Add 7 once, then again - second add should not increase size
    const afterFirstAdd7 = await page.evaluate(() => {
      const s1 = window.mySet.size;
      const add1 = window.mySet.add(7); // returns the Set
      const s2 = window.mySet.size;
      window.mySet.add(7); // duplicate
      const s3 = window.mySet.size;
      return { s1, s2, s3, contains7: window.mySet.has(7) };
    });
    expect(afterFirstAdd7.s2).toBe(afterFirstAdd7.s1 + 1); // size increased by 1 after first add
    expect(afterFirstAdd7.s3).toBe(afterFirstAdd7.s2); // duplicate add did not increase size
    expect(afterFirstAdd7.contains7).toBe(true);

    // Attempt to delete a non-existent value (e.g., 999) - should return false and size unchanged
    const deleteNonExistent = await page.evaluate(() => {
      const before = window.mySet.size;
      const ok = window.mySet.delete(999);
      const after = window.mySet.size;
      return { before, ok, after };
    });
    expect(deleteNonExistent.ok).toBe(false);
    expect(deleteNonExistent.before).toBe(deleteNonExistent.after);

    // Attempt to delete an existing value (e.g., 7) - should return true and reduce size by 1
    const delete7 = await page.evaluate(() => {
      const before = window.mySet.size;
      const ok = window.mySet.delete(7);
      const after = window.mySet.size;
      return { before, ok, after, contains7: window.mySet.has(7) };
    });
    expect(delete7.ok).toBe(true);
    expect(delete7.after).toBe(delete7.before - 1);
    expect(delete7.contains7).toBe(false);

    // Ensure no unexpected runtime errors occurred while performing these operations
    const fatalErrors = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError'
    );
    expect(fatalErrors.length).toBe(0);
  });

  test('Console and page error inspection - ensure logs include FSM sequence labels and no uncaught errors', async ({ page }) => {
    // This final test summarizes the console output and page errors collected during page load.
    // It ensures each FSM state's entry log was emitted and verifies there are no uncaught errors.

    // Confirm each of the FSM's entry labels are present in the console messages
    const labels = [
      'Initial Set',
      'After adding 7',
      'After deleting 3',
      'After clearing Set',
      'After adding 8',
      'After deleting 8',
      'After deleting 3 and 4'
    ];
    for (const label of labels) {
      const found = consoleMessages.some(m => m.text.includes(label));
      expect(found, `Expected console log containing "${label}"`).toBe(true);
    }

    // Confirm there are no captured page errors of critical JS types
    const critical = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError'
    );
    expect(critical.length).toBe(0);

    // Also assert that console did not emit any explicit 'error' type messages (helpful to detect runtime issues)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});