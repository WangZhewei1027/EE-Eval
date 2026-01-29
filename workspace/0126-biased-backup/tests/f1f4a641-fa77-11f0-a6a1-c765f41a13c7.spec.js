import { test, expect } from '@playwright/test';

test.setTimeout(120000); // Allow enough time for animations to complete

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f4a641-fa77-11f0-a6a1-c765f41a13c7.html';

// Helper to compute expected bucket indices for verification
function computeBucketsForKeys(keys, tableSize = 11) {
  const map = new Map();
  keys.forEach(k => {
    const idx = ((k % tableSize) + tableSize) % tableSize;
    map.set(idx, (map.get(idx) || 0) + 1);
  });
  return map;
}

test.describe('Hash Table — Visual Exploration (FSM validation)', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', msg => {
      // store console data (type and text)
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      page.context()._pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
    // Wait for key UI elements to be present
    await page.waitForSelector('#animateBtn');
    await page.waitForSelector('#resetBtn');
    await page.waitForSelector('#bucketsRow');
    await page.waitForSelector('#orbsLayer');
  });

  test.afterEach(async ({ page }) => {
    // Small pause to let any late console messages surface before assertions in tests read them
    await page.waitForTimeout(50);
  });

  test('Initial state S0_Idle: entry action reset() applied and UI is idle', async ({ page }) => {
    // This test validates the initial idle state:
    // - animateBtn and resetBtn should be enabled (as per reset() call on entry)
    // - no chain nodes exist
    // - orbs exist in the orbsLayer with expected keys
    // - there were no runtime page errors or console error messages during load

    // Assert animate and reset buttons exist and are enabled
    const animateDisabled = await page.$eval('#animateBtn', el => el.disabled);
    const resetDisabled = await page.$eval('#resetBtn', el => el.disabled);

    // According to FSM entry actions, reset() is called on initial state.
    // reset() sets animateBtn.disabled = false. We expect both buttons to be enabled at start.
    expect(animateDisabled).toBe(false);
    expect(resetDisabled).toBe(false);

    // Ensure there are no chain nodes initially
    const nodeCount = await page.$$eval('.bucket .node', nodes => nodes.length);
    expect(nodeCount).toBe(0);

    // Ensure orb elements exist and match the expected insertion keys
    const orbTexts = await page.$$eval('#orbsLayer .orb', orbs => orbs.map(o => o.textContent.trim()));
    // The implementation defines keys: [22, 41, 53, 46, 30, 13, 27, 59]
    expect(orbTexts).toEqual(['22', '41', '53', '46', '30', '13', '27', '59']);

    // Check no page errors and no console errors (TypeError/ReferenceError/SyntaxError) reported on load
    const consoleMessages = page.context()._consoleMessages || [];
    const pageErrors = page.context()._pageErrors || [];

    // Fail if any pageerror occurred
    expect(pageErrors.length).toBe(0);

    // Fail if any console messages of type 'error' or containing JS error keywords appear
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' ||
      /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Animating via click: animateBtn click triggers animation and state changes', async ({ page }) => {
    // This test validates:
    // - Clicking "Animate Insertions" disables both animateBtn and resetBtn during animation
    // - Animation produces chain nodes in buckets according to the keys
    // - At animation end, resetBtn becomes enabled and animateBtn remains disabled (per implementation)
    // - No unexpected console errors or page errors during the animation

    // Start animation by clicking the animate button
    await page.click('#animateBtn');

    // Immediately after click, implementation sets animateBtn.disabled = true and resetBtn.disabled = true
    // Wait shortly for the JS to update the attributes
    await page.waitForTimeout(50);

    const animateDisabledDuring = await page.$eval('#animateBtn', el => el.disabled);
    const resetDisabledDuring = await page.$eval('#resetBtn', el => el.disabled);

    expect(animateDisabledDuring).toBe(true);
    expect(resetDisabledDuring).toBe(true);

    // Wait until the animation signals completion by enabling the reset button
    // runAnimation() sets resetBtn.disabled = false at the end
    await page.waitForFunction(() => {
      const b = document.getElementById('resetBtn');
      return b && b.disabled === false;
    }, null, { timeout: 70000 }); // generous timeout for full animation

    // After completion, animateBtn should remain disabled, resetBtn should be enabled
    const animateDisabledAfter = await page.$eval('#animateBtn', el => el.disabled);
    const resetDisabledAfter = await page.$eval('#resetBtn', el => el.disabled);
    expect(animateDisabledAfter).toBe(true);
    expect(resetDisabledAfter).toBe(false);

    // Verify that nodes were created in expected buckets
    // expected distribution for KEYS [22,41,53,46,30,13,27,59] mod 11:
    // 22 -> 0, 41 -> 8, 53 -> 9, 46 -> 2, 30 -> 8, 13 -> 2, 27 -> 5, 59 -> 4
    const expected = computeBucketsForKeys([22, 41, 53, 46, 30, 13, 27, 59], 11);

    // Gather actual counts from DOM: count .node elements within each bucket chain
    const actualCounts = await page.$$eval('.bucket', buckets => {
      return buckets.map(b => {
        const idx = b.dataset.idx;
        const nodes = b.querySelectorAll('.chain .node');
        return { idx: Number(idx), count: nodes.length };
      });
    });

    // Convert to map for assertions
    const actualMap = new Map(actualCounts.map(x => [x.idx, x.count]));

    for (const [idx, count] of expected.entries()) {
      const actual = actualMap.get(idx) || 0;
      expect(actual).toBe(count);
    }

    // Also assert buckets that should be empty are indeed empty
    for (const [idx, count] of actualMap) {
      if (!expected.has(idx)) {
        expect(count).toBe(0);
      }
    }

    // Verify no unexpected runtime errors were logged during animation
    const consoleMessages = page.context()._consoleMessages || [];
    const pageErrors = page.context()._pageErrors || [];
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Animating via keyboard activation (Enter): animateBtn keyup triggers animation', async ({ page }) => {
    // This test validates keyboard activation:
    // - Focusing the animate button and pressing Enter triggers the same animation flow
    // - At the end, nodes appear and resetBtn is enabled
    // - No page errors occur

    // Focus animate button and press Enter (which will generate keyup handlers)
    await page.focus('#animateBtn');

    // Press Enter - keyboard.press sends keydown/keyup events; the implementation listens for keyup
    await page.keyboard.press('Enter');

    // Immediately expect both buttons to be disabled during animation
    await page.waitForTimeout(80);
    const animateDisabledDuring = await page.$eval('#animateBtn', el => el.disabled);
    const resetDisabledDuring = await page.$eval('#resetBtn', el => el.disabled);
    expect(animateDisabledDuring).toBe(true);
    expect(resetDisabledDuring).toBe(true);

    // Wait for end-of-animation signal (resetBtn becoming enabled)
    await page.waitForFunction(() => {
      const b = document.getElementById('resetBtn');
      return b && b.disabled === false;
    }, null, { timeout: 70000 });

    // Validate final state
    const animateDisabledAfter = await page.$eval('#animateBtn', el => el.disabled);
    const resetDisabledAfter = await page.$eval('#resetBtn', el => el.disabled);
    expect(animateDisabledAfter).toBe(true);
    expect(resetDisabledAfter).toBe(false);

    // Verify expected nodes (simple spot check: bucket 2 should have 2 nodes as earlier)
    const bucket2Count = await page.$eval('.bucket[data-idx="2"] .chain', ch => ch ? ch.querySelectorAll('.node').length : 0);
    expect(bucket2Count).toBe(2);

    // No runtime errors
    const pageErrors = page.context()._pageErrors || [];
    expect(pageErrors.length).toBe(0);
    const consoleErrors = (page.context()._consoleMessages || []).filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset transition from S0_Idle via click and via keyboard: resets visualization state', async ({ page }) => {
    // This test covers both Reset (click) and Reset_Keyboard (keyup) events from the Idle state.
    // Verify that reset() clears nodes and re-enables animate button.

    // First, ensure we're in Idle with no nodes: call reset via click
    // Click reset in Idle to ensure reset() does not throw and leaves UI in idle state
    await page.click('#resetBtn');
    await page.waitForTimeout(50);

    // After reset, animate button should be enabled and no chain nodes should exist
    const animateDisabledAfterResetClick = await page.$eval('#animateBtn', el => el.disabled);
    expect(animateDisabledAfterResetClick).toBe(false);

    const nodeCountAfterResetClick = await page.$$eval('.bucket .node', nodes => nodes.length);
    expect(nodeCountAfterResetClick).toBe(0);

    // Now test keyboard activation of reset: ensure focus on resetBtn and press Enter
    await page.focus('#resetBtn');
    await page.keyboard.press('Enter');

    // Confirm still idle and nodes cleared
    await page.waitForTimeout(50);
    const animateDisabledAfterResetKey = await page.$eval('#animateBtn', el => el.disabled);
    expect(animateDisabledAfterResetKey).toBe(false);
    const nodeCountAfterResetKey = await page.$$eval('.bucket .node', nodes => nodes.length);
    expect(nodeCountAfterResetKey).toBe(0);

    // Confirm no runtime errors occurred
    const pageErrors = page.context()._pageErrors || [];
    expect(pageErrors.length).toBe(0);
    const consoleErrors = (page.context()._consoleMessages || []).filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: attempting Reset during animation (disabled button) has no effect and does not throw', async ({ page }) => {
    // This test attempts to click the reset button while it is disabled during animation.
    // We do not patch environment; we simply assert that no errors occur, and that the animation still completes to its normal end state.
    // Note: In the implementation resetBtn is disabled during runAnimation, so a user cannot trigger reset by clicking; this test verifies that behavior and absence of runtime errors.

    // Start animation
    await page.click('#animateBtn');

    // Wait a short time to ensure animation started and resetBtn is disabled
    await page.waitForTimeout(100);
    const resetDisabledDuring = await page.$eval('#resetBtn', el => el.disabled);
    expect(resetDisabledDuring).toBe(true);

    // Attempt to click the reset button while disabled (Playwright will still try to click; this should not cause JS errors)
    // Use try/catch: clicking a disabled element may throw (element not enabled) or may succeed in Playwright depending on hit-target;
    // We don't fail the test on click exceptions here; we only want to ensure no page errors are produced.
    let clickError = null;
    try {
      await page.click('#resetBtn', { timeout: 500 }).catch(e => { throw e; });
    } catch (err) {
      clickError = err;
      // swallow the error because the important check is that no runtime JS errors were logged to the page
    }

    // Wait for animation to finish (resetBtn will be re-enabled by runAnimation on completion)
    await page.waitForFunction(() => {
      const b = document.getElementById('resetBtn');
      return b && b.disabled === false;
    }, null, { timeout: 70000 });

    // After animation ends, confirm resetBtn enabled and animation completed normally
    const resetDisabledAfter = await page.$eval('#resetBtn', el => el.disabled);
    expect(resetDisabledAfter).toBe(false);

    // Ensure no page runtime errors occurred during the attempted click and animation
    const pageErrors = page.context()._pageErrors || [];
    expect(pageErrors.length).toBe(0);

    const consoleErrors = (page.context()._consoleMessages || []).filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text));
    expect(consoleErrors.length).toBe(0);

    // If Playwright threw an error attempting to click disabled button, that is acceptable—ensure it was caught above.
    // But the application itself must not have logged JS errors.
    // Record that a Playwright click attempt may have thrown (not a failure of the app)
    // (Do not fail the test because of Playwright click behavior)
    expect(true).toBe(true);
  });

  test('Sanity: Inspect console and page errors across user flows for absence of JS exceptions', async ({ page }) => {
    // This test runs a quick animate -> reset cycle and asserts that no ReferenceError/TypeError/SyntaxError occurred anywhere.

    // Trigger animation via keyboard to exercise alternate path
    await page.focus('#animateBtn');
    await page.keyboard.press(' '); // spacebar triggers keyup handling as well

    // Wait for animation completion
    await page.waitForFunction(() => {
      const b = document.getElementById('resetBtn');
      return b && b.disabled === false;
    }, null, { timeout: 70000 });

    // Click reset to return to Idle
    await page.click('#resetBtn');
    await page.waitForTimeout(50);

    // Gather console and page errors
    const consoleMessages = page.context()._consoleMessages || [];
    const pageErrors = page.context()._pageErrors || [];

    // Ensure pageErrors empty
    expect(pageErrors.length).toBe(0);

    // Filter for error-level console messages or JS exception text
    const jsExceptionMsgs = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text));
    expect(jsExceptionMsgs.length).toBe(0);
  });
});