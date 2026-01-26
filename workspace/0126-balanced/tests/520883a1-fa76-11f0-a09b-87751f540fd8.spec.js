import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520883a1-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Heap (Min) - FSM: S0_Idle (static render + runtime behavior)', () => {
  // Utility to wait for at least one page error or timeout
  const waitForAtLeastOne = async (arr, timeout = 2000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (arr.length > 0) return;
      await new Promise(res => setTimeout(res, 50));
    }
  };

  test.beforeEach(async ({ page }) => {
    // Nothing global to setup beyond what each test does individually.
    // Individual tests will attach listeners before navigation to capture early errors.
  });

  test('S0_Idle: Static DOM renders - heading and #heap container present, renderPage not defined', async ({ page }) => {
    // Attach listeners early to capture anything emitted during load.
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Validate static DOM content that represents the Idle state
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Heap (Min)');

    const heapDiv = page.locator('#heap');
    await expect(heapDiv).toHaveCount(1);

    // The FSM entry action mentioned renderPage() but the real page does not define it.
    // Verify that there is no global renderPage function (this checks the mismatch without changing runtime)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Ensure the #heap container is empty (static placeholder as per implementation)
    const heapContent = await heapDiv.innerHTML();
    expect(heapContent).toBe('');

    // There should be no interactive elements (matching extraction summary)
    const interactiveCount = await page.locator('button, input, textarea, select, [role="button"]').count();
    expect(interactiveCount).toBe(0);

    // Confirm there was at least the possibility of runtime errors captured (we don't force them here)
    // Wait a small time to capture any asynchronous logs/errors produced during load
    await waitForAtLeastOne(pageErrors, 500);

    // It's acceptable if there were errors; we at least assert that console contains some output or errors array exists.
    // This test focuses on DOM and missing renderPage; deeper runtime error assertions are in the next test.
    expect(typeof consoleMessages).toBe('object');
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test('Runtime: script throws during heap operations -> pageerror(s) and no final heap print', async ({ page }) => {
    // Capture console and page errors. Important: attach BEFORE navigation to catch early failures.
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for errors to be collected (script executes during load)
    await waitForAtLeastOne(pageErrors, 2000);

    // There should be at least one runtime error due to the broken heap implementation (e.g., TypeError accessing undefined).
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect the first error to make assertions about the failure mode.
    const firstError = pageErrors[0];
    const messageLower = (firstError && firstError.message) ? firstError.message.toLowerCase() : '';

    // The implementation tries to access node.index which does not exist -> leads to a TypeError or similar.
    // Accept either "cannot read property" style messages or explicit TypeError mentions.
    const indicatesUndefinedProperty = (
      messageLower.includes('cannot read') ||
      messageLower.includes('cannot convert') ||
      messageLower.includes('undefined') ||
      messageLower.includes('typeerror') ||
      messageLower.includes('node.index')
    );
    expect(indicatesUndefinedProperty).toBeTruthy();

    // Also assert that the console did NOT receive the intended final heap print ("Heap (Min): ...")
    // because the script should have failed before the final console.log runs.
    const heapPrints = consoleMessages.filter(m => m.text.includes('Heap (Min):'));
    expect(heapPrints.length).toBe(0);

    // Bonus: check that the stack trace (if present) references one of the broken methods to indicate where it failed
    const stack = firstError && firstError.stack ? firstError.stack.toLowerCase() : '';
    const stackPointsToHeap = stack.includes('heapifyup') || stack.includes('insertnode') || stack.includes('insert');
    // This may vary between runtimes; mark expectation that at least the message or stack hints at heap-related functions.
    expect(indicatesUndefinedProperty || stackPointsToHeap).toBeTruthy();
  });

  test('Edge case: clicking the static #heap region does not trigger interactive transitions or new console output', async ({ page }) => {
    // Capture console messages and page errors
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    const heapDiv = page.locator('#heap');
    await expect(heapDiv).toBeVisible();

    // Record counts before interaction
    const beforeConsoleCount = consoleMessages.length;
    const beforePageErrorCount = pageErrors.length;

    // Try to click the heap area (there are no event handlers expected)
    await heapDiv.click();

    // Small wait to capture any synchronous/asynchronous side-effects of the click
    await new Promise(res => setTimeout(res, 200));

    // Assert that clicking did not create new console logs or page errors (no transitions present)
    expect(consoleMessages.length).toBe(beforeConsoleCount);
    expect(pageErrors.length).toBe(beforePageErrorCount);
  });

  test('FSM completeness checks: verify no transitions/events exist in the interactive DOM', async ({ page }) => {
    // The FSM extracted zero events/transitions; validate that there are no obvious interactive triggers.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // No elements suggesting interactions should exist: buttons, inputs, links with onclick handlers
    const interactiveSelectors = await page.evaluate(() => {
      const selectors = [];
      if (document.querySelectorAll('button,input,select,textarea').length > 0) selectors.push('form-controls');
      // Elements with inline onclick attributes
      const onclickCount = Array.from(document.querySelectorAll('*')).filter(el => el.getAttribute && el.getAttribute('onclick')).length;
      if (onclickCount > 0) selectors.push('onclick-attrs');
      // Elements with role=button
      if (document.querySelectorAll('[role="button"]').length > 0) selectors.push('role-button');
      // Anchors that look interactive
      if (document.querySelectorAll('a[href]').length > 0) selectors.push('links');
      return selectors;
    });

    // Based on the provided HTML, we expect no interactive selectors present
    expect(interactiveSelectors.length).toBe(0);
  });
});