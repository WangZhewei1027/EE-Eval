import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d835eee2-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Topological Sort — Kahn demonstration (d835eee2-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Capture console messages and page errors for each test run.
  test.beforeEach(async ({ page }) => {
    // Ensure we start with a fresh listeners array per test.
    page.setDefaultTimeout(5000);
  });

  // Utility to collect console and page errors while interacting with the page.
  async function loadPageAndCollect(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // pageerror captures uncaught exceptions
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a small time to allow any synchronous runtime errors to surface.
    await page.waitForTimeout(100);

    return { consoleMessages, pageErrors };
  }

  // Test initial idle state S0_Idle and presence of button and text.
  test('S0_Idle: initial render shows idle text and button is present with correct attributes', async ({ page }) => {
    // Load the page and collect runtime diagnostics.
    const { consoleMessages, pageErrors } = await loadPageAndCollect(page);

    const demoText = page.locator('#demo-text');
    const button = page.locator('#demo-btn');

    // Verify the initial demo text (Idle state)
    await expect(demoText).toHaveText(/Press\s+Advance step\s+to begin\./);

    // Verify the button exists and has expected properties per FSM/components
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('class', /btn/);
    await expect(button).toHaveAttribute('aria-controls', 'demo-text');
    await expect(button).toHaveText('Advance step');

    // Assert no uncaught page errors occurred during initial load.
    expect(pageErrors.length, 'No uncaught page errors on load').toBe(0);

    // Assert there are no console.error messages emitted during load.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console errors during initial load').toBe(0);
  });

  test('Sequence of steps S1..S7 and final check step show expected textual content on each click', async ({ page }) => {
    // Load page and collect console/page errors
    const { consoleMessages, pageErrors } = await loadPageAndCollect(page);

    const demoText = page.locator('#demo-text');
    const button = page.locator('#demo-btn');

    // Helper to click and assert that the demo-text contains expected fragment.
    async function clickAndAssertContains(fragment) {
      await button.click();
      // Wait a tick for the click handler to update DOM
      await page.waitForTimeout(50);
      await expect(demoText).toContainText(fragment);
    }

    // S1_Step0 (first click -> steps[0])
    await clickAndAssertContains('Step 0 — Initialization');
    await expect(demoText).toContainText('Compute in-degrees');
    await expect(demoText).toContainText('Initial queue (in-degree 0): [A, B]');
    await expect(demoText).toContainText('Output list: []');

    // S2_Step1 (second click)
    await clickAndAssertContains('Step 1 — Pop A from queue');
    await expect(demoText).toContainText('Output: [A]');
    await expect(demoText).toContainText('Decrease in-degree(C): 2 -> 1');

    // S3_Step2 (third click)
    await clickAndAssertContains('Step 2 — Pop B from queue');
    await expect(demoText).toContainText('Output: [A, B]');
    await expect(demoText).toContainText('Decrease in-degree(C): 1 -> 0');
    await expect(demoText).toContainText('Decrease in-degree(E): 1 -> 0');

    // S4_Step3 (fourth click)
    await clickAndAssertContains('Step 3 — Pop C from queue');
    await expect(demoText).toContainText('Output: [A, B, C]');
    await expect(demoText).toContainText('Decrease in-degree(D): 1 -> 0');

    // S5_Step4 (fifth click)
    await clickAndAssertContains('Step 4 — Pop E from queue');
    await expect(demoText).toContainText('Output: [A, B, C, E]');
    await expect(demoText).toContainText('Decrease in-degree(F): 2 -> 1');

    // S6_Step5 (sixth click)
    await clickAndAssertContains('Step 5 — Pop D from queue');
    await expect(demoText).toContainText('Output: [A, B, C, E, D]');
    await expect(demoText).toContainText('Decrease in-degree(F): 1 -> 0');

    // S7_Step6 (seventh click)
    await clickAndAssertContains('Step 6 — Pop F from queue');
    await expect(demoText).toContainText('Output: [A, B, C, E, D, F]');
    await expect(demoText).toContainText('Queue now: []');

    // Final check step (eighth click) - the steps array includes a final "Final check" message
    await clickAndAssertContains('Final check:');
    await expect(demoText).toContainText('All 6 vertices have been output');
    await expect(demoText).toContainText('A, B, C, E, D, F');

    // After this sequence there should be no unexpected runtime errors.
    expect(pageErrors.length, 'No uncaught page errors while stepping through').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.errors while stepping through').toBe(0);
  });

  test('S8_Complete: complete message is shown after steps exhausted and replay works (cycle back to S1_Step0)', async ({ page }) => {
    // Load and collect
    const { consoleMessages, pageErrors } = await loadPageAndCollect(page);
    const demoText = page.locator('#demo-text');
    const button = page.locator('#demo-btn');

    // Click enough times to move past the prepared steps and reach the "Demonstration complete" message.
    // As implemented in the page script:
    // idx starts at -1; clicks produce steps[0]..steps[7] for first 8 clicks.
    // The next click (9th) triggers out.textContent = 'Demonstration complete...'; idx = -1
    for (let i = 0; i < 8; i++) {
      await button.click();
      await page.waitForTimeout(20);
    }

    // Now one more click to reach the explicit "Demonstration complete..." message.
    await button.click();
    await page.waitForTimeout(50);

    // Validate the complete message corresponds to S8_Complete evidence.
    await expect(demoText).toHaveText('Demonstration complete. Press again to replay from the beginning.');

    // Now simulate replay: click again should start over at Step 0 (S1_Step0)
    await button.click();
    await page.waitForTimeout(50);
    await expect(demoText).toContainText('Step 0 — Initialization');

    // Ensure no uncaught exceptions happened in this cycle
    expect(pageErrors.length, 'No pageerrors after completing and replaying').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error after completing and replaying').toBe(0);
  });

  test('Edge case: rapid multiple clicks and long-running cycling does not produce runtime errors and behavior remains consistent', async ({ page }) => {
    // Load and start capturing
    const { consoleMessages, pageErrors } = await loadPageAndCollect(page);
    const demoText = page.locator('#demo-text');
    const button = page.locator('#demo-btn');

    // Simulate rapid clicking more times than necessary to observe cycling behavior.
    // We'll click 20 times; with cycles into the demo, it should never throw.
    for (let i = 0; i < 20; i++) {
      await button.click();
      // Minimal delay to mimic a fast user; allow handler to process
      await page.waitForTimeout(10);
    }

    // After many clicks, demo-text should either be one of the defined step strings or the complete message.
    const currentText = (await demoText.textContent()) || '';

    const allowedFragments = [
      'Press Advance step to begin.',
      'Step 0 — Initialization',
      'Step 1 — Pop A from queue',
      'Step 2 — Pop B from queue',
      'Step 3 — Pop C from queue',
      'Step 4 — Pop E from queue',
      'Step 5 — Pop D from queue',
      'Step 6 — Pop F from queue',
      'Final check:',
      'Demonstration complete. Press again to replay from the beginning.'
    ];

    // Confirm that at least one of the allowed fragments is present in the current text.
    const matchesAllowed = allowedFragments.some(frag => currentText.includes(frag));
    expect(matchesAllowed, `After rapid clicks, demo text should match an expected fragment. Actual: ${currentText}`).toBe(true);

    // Assert again no uncaught exceptions were thrown during aggressive interactions.
    expect(pageErrors.length, 'No page errors during rapid interactions').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error during rapid interactions').toBe(0);
  });

  test('Sanity checks: text content exactness for some critical states and presence of queue/output lines', async ({ page }) => {
    // This test checks for more precise fragments from FSM evidence, ensuring the demo displays the expected explanatory lines.
    await page.goto(APP_URL, { waitUntil: 'load' });
    const demoText = page.locator('#demo-text');
    const button = page.locator('#demo-btn');

    // Initial idle text
    await expect(demoText).toHaveText(/Press\s+Advance step\s+to begin\./);

    // Advance to Step 0 and assert some exact lines exist in the multi-line text.
    await button.click();
    await page.waitForTimeout(20);
    await expect(demoText).toContainText('Compute in-degrees:');
    await expect(demoText).toContainText('A:0, B:0, C:2, D:1, E:1, F:2');
    await expect(demoText).toContainText('Initial queue (in-degree 0): [A, B]');

    // Advance to Step 2 (two more clicks)
    await button.click();
    await page.waitForTimeout(20);
    await button.click();
    await page.waitForTimeout(20);
    await expect(demoText).toContainText('Step 2 — Pop B from queue');
    // Confirm the text mentions enqueueing C and E (in-degree -> 0)
    await expect(demoText).toContainText('(enqueue C)');
    await expect(demoText).toContainText('(enqueue E)');

    // No page errors observed in these precise assertions
    // (Collecting via page.on('pageerror') is not necessary here; previous tests already covered error-free runs)
  });

});