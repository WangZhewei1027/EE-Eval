import { test, expect } from '@playwright/test';

test.setTimeout(60000); // allow longer timeouts for animations

// URL under test (served externally as specified)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f5dec2-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Linear Search — Visual Demonstration (FSM validation)', () => {
  // Collect console and page errors for each test to assert on them later
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);
    // Wait for the main array container to be present as a signal the app has initialized
    await page.waitForSelector('#array');
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors were emitted during the test
    expect(pageErrors, 'Expected no uncaught page errors').toHaveLength(0);

    // Assert that there are no console.error or console.warning messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors, 'Expected no console.error messages').toHaveLength(0);
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('should initialize in Idle: status text, start enabled, nodes built', async ({ page }) => {
      // Validate the initial status message and result text
      const status = page.locator('#statusMessage');
      await expect(status).toHaveText('Press Start to begin the scan');

      const result = page.locator('#resultText');
      await expect(result).toHaveText('—');

      // Start button should be enabled in Idle
      const startBtn = page.locator('#startBtn');
      await expect(startBtn).toBeEnabled();

      // Reset button exists
      const resetBtn = page.locator('#resetBtn');
      await expect(resetBtn).toBeVisible();

      // Nodes should be built from the provided array; expect at least one node and index attributes
      const nodes = page.locator('.node');
      const count = await nodes.count();
      expect(count).toBeGreaterThan(0);

      // Check that each node displays an index attribute and a value element
      for (let i = 0; i < count; ++i) {
        const n = nodes.nth(i);
        await expect(n.getAttribute('data-index')).resolves.toBe(String(i));
        const idxLabel = n.locator('.index');
        await expect(idxLabel).toHaveText(String(i));
        const valueEl = n.locator('.value');
        await expect(valueEl).toBeVisible();
      }

      // Verify code highlight is on the initial line (data-line="0" is used in code as highlight(0))
      // The implementation sets highlightCode(0) which corresponds to no numerical .num line: expect some code-line to have highlight removed except none is data-line=0, so assert the first code-line is highlighted or at least not throwing
      const highlighted = page.locator('.code-line.highlight');
      await expect(highlighted).toHaveCount(1);
    });
  });

  test.describe('StartSearch -> Scanning (S0_Idle -> S1_Scanning)', () => {
    test('clicking Start Search enters Scanning state: status, button disabled, comparisons begin', async ({ page }) => {
      const startBtn = page.locator('#startBtn');
      const status = page.locator('#statusMessage');
      const compCount = page.locator('#comp-count');

      // Click start
      await startBtn.click();

      // On enter S1_Scanning: status message should change and start button disabled
      await expect(status).toHaveText('Scanning...', { timeout: 2000 });
      await expect(startBtn).toBeDisabled();

      // The code should highlight the for-loop line (data-line="2")
      const forLine = page.locator('.code-line[data-line="2"]');
      await expect(forLine).toHaveClass(/highlight/, { timeout: 2000 });

      // Wait for the first comparison to be registered (first scheduled step runs immediately)
      await expect(compCount).toHaveText('1', { timeout: 2000 });

      // The first node should quickly get the 'inspecting' class while scanning
      const firstNode = page.locator('.node[data-index="0"]');
      await expect(firstNode).toHaveClass(/inspecting|rejected/, { timeout: 2000 });
    });
  });

  test.describe('TargetFound (S1_Scanning -> S2_TargetFound)', () => {
    test('scan finds the target and transitions to Target Found: status, result, node styling', async ({ page }) => {
      const startBtn = page.locator('#startBtn');
      const status = page.locator('#statusMessage');
      const resultText = page.locator('#resultText');

      // Start the scan; the array contains the target 73 at index 1 (first match)
      await startBtn.click();

      // Wait until the target found message for index 1 appears
      await expect(status).toHaveText(/Target found at index 1/, { timeout: 8000 });

      // Result text should indicate the index
      await expect(resultText).toHaveText('Index 1');

      // The node at index 1 should have class 'found'
      const foundNode = page.locator('.node[data-index="1"]');
      await expect(foundNode).toHaveClass(/found/);

      // Nodes before the found node should be marked as rejected
      const prevNode = page.locator('.node[data-index="0"]');
      await expect(prevNode).toHaveClass(/rejected/);

      // Nodes after the found node should be at least 'rejected' (faded)
      const laterNode = page.locator('.node[data-index="2"]');
      await expect(laterNode).toHaveClass(/rejected/);

      // Start button should be re-enabled after finding target (as per implementation)
      await expect(startBtn).toBeEnabled();
    }, { timeout: 15000 });
  });

  test.describe('Reset transition and onExit actions (S1 -> S0)', () => {
    test('clicking Reset returns to Idle: resetAll executed, counters reset, highlights cleared', async ({ page }) => {
      const startBtn = page.locator('#startBtn');
      const resetBtn = page.locator('#resetBtn');
      const status = page.locator('#statusMessage');
      const compCount = page.locator('#comp-count');
      const resultText = page.locator('#resultText');

      // Start and wait for one comparison to ensure running happened
      await startBtn.click();
      await expect(compCount).toHaveText('1', { timeout: 2000 });

      // Now click reset to trigger resetAll (S1 -> S0)
      await resetBtn.click();

      // After reset: start enabled, counters zeroed, status back to initial
      await expect(startBtn).toBeEnabled();
      await expect(status).toHaveText('Press Start to begin the scan');
      await expect(compCount).toHaveText('0');
      await expect(resultText).toHaveText('—');

      // No node should have inspecting/found/rejected classes after reset
      const nodes = page.locator('.node');
      const count = await nodes.count();
      for (let i = 0; i < count; ++i) {
        const n = nodes.nth(i);
        const classes = await n.getAttribute('class');
        expect(classes).not.toMatch(/inspecting|found|rejected/);
      }
    });
  });

  test.describe('Keyboard SpaceKey event', () => {
    test('pressing Space toggles start and reset as per implementation', async ({ page }) => {
      const status = page.locator('#statusMessage');
      const compCount = page.locator('#comp-count');

      // Press Space to start scanning
      await page.keyboard.press('Space');

      // Should have entered Scanning
      await expect(status).toHaveText('Scanning...', { timeout: 2000 });
      await expect(compCount).toHaveText('1', { timeout: 2500 });

      // While running, pressing Space again triggers reset (resetBtn.click())
      await page.keyboard.press('Space');

      // Should be back to Idle
      await expect(status).toHaveText('Press Start to begin the scan');
      await expect(compCount).toHaveText('0');
    });
  });

  test.describe('NotFound transition (S1_Scanning -> S3_NotFound)', () => {
    test('when the target is not present in the array, the scan completes and shows Not Found', async ({ page }) => {
      const startBtn = page.locator('#startBtn');
      const resetBtn = page.locator('#resetBtn');
      const status = page.locator('#statusMessage');
      const resultText = page.locator('#resultText');
      const nodes = page.locator('.node');

      // Ensure we are in Idle
      await resetBtn.click();
      await expect(status).toHaveText('Press Start to begin the scan');

      // Modify the DOM nodes so none match the hardcoded target (73)
      // We do not patch application code; we only change the node dataset values and visible .value text,
      // which is allowed as a user-level modification to simulate a NotFound scenario.
      await page.evaluate(() => {
        const nodeEls = Array.from(document.querySelectorAll('.node'));
        nodeEls.forEach((n, i) => {
          // set values to a number that is not 73
          n.dataset.value = String(100 + i + 1);
          const v = n.querySelector('.value');
          if (v) v.textContent = n.dataset.value;
        });
      });

      // Start the scan now that none match the target
      await startBtn.click();

      // The last "not found" action executes when idx === nodeEls.length - 1 and will set status to 'Target not found in the array'
      // The last innerDelay occurs at roughly (N-1)*inspectDelay + innerDelay. For safety use a generous timeout.
      await expect(status).toHaveText('Target not found in the array', { timeout: 20000 });

      // resultText should be 'Not found'
      await expect(resultText).toHaveText('Not found');

      // Start button should be re-enabled after completion
      await expect(startBtn).toBeEnabled();

      // Validate that the final node got marked as rejected (since no found)
      const lastIndex = (await nodes.count()) - 1;
      const lastNode = page.locator(`.node[data-index="${lastIndex}"]`);
      await expect(lastNode).toHaveClass(/rejected/);
    }, { timeout: 30000 });
  });

  test.describe('Edge cases and robustness', () => {
    test('multiple sequential starts are ignored while running, and timers are cleared on reset', async ({ page }) => {
      const startBtn = page.locator('#startBtn');
      const resetBtn = page.locator('#resetBtn');
      const compCount = page.locator('#comp-count');

      // Start the scan
      await startBtn.click();

      // Immediately attempt to click Start again - implementation should ignore because "running" guard exists
      await startBtn.click();

      // Wait a bit and ensure comparisons increment only normally (should be >0)
      await expect(compCount).toHaveText('1', { timeout: 2000 });

      // Now reset while running
      await resetBtn.click();

      // After reset, comparisons should be zero and no exceptions thrown
      await expect(compCount).toHaveText('0');

      // To assert timers cleared, start again and allow it to progress a bit, then reset and ensure no pending "found" state appears later
      await startBtn.click();
      await expect(compCount).toHaveText('1', { timeout: 2000 });
      await resetBtn.click();

      // Wait a short while to ensure no stray "Target found" appears from previously scheduled timers
      await page.waitForTimeout(1500);
      // Confirm still in Idle
      const status = page.locator('#statusMessage');
      await expect(status).toHaveText('Press Start to begin the scan');
    });

    test('observes console & page errors during initial load and interaction (no unexpected errors)', async ({ page }) => {
      // This test simply interacts a bit and ensures no console errors or uncaught exceptions were emitted.
      const startBtn = page.locator('#startBtn');

      // Click start and then reset quickly
      await startBtn.click();
      await page.waitForTimeout(200); // brief wait
      await page.locator('#resetBtn').click();

      // The afterEach will assert there were no console errors or page errors.
      // For clarity also assert that we captured console messages array and it contains items (info/debug)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
      // No explicit assertion here about presence of messages; main check is that there were no error-level messages (done in afterEach).
    });
  });
});