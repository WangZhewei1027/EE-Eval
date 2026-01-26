import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/25ca50b2-fa7c-11f0-ba20-415c525382ea.html';

test.describe('DFS Demo - FSM states and transitions (25ca50b2-fa7c-11f0-ba20-415c525382ea)', () => {
  // Helper to attach listeners to capture console errors and page errors.
  const attachErrorObservers = (page) => {
    const consoleErrors = [];
    const pageErrors = [];

    const consoleListener = (msg) => {
      // Collect only error-level console messages
      try {
        if (msg.type && msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener errors
      }
    };

    const pageErrorListener = (err) => {
      pageErrors.push(err.message || String(err));
    };

    page.on('console', consoleListener);
    page.on('pageerror', pageErrorListener);

    return {
      consoleErrors,
      pageErrors,
      dispose: () => {
        page.off('console', consoleListener);
        page.off('pageerror', pageErrorListener);
      },
    };
  };

  test.beforeEach(async ({ page }) => {
    // Increase default timeout margins in case of slow local server
    test.setTimeout(30_000);
  });

  test('S0 Idle: page renders Run DFS button and empty demo output', async ({ page }) => {
    // This test validates the Idle state (S0_Idle): the button should exist,
    // demo output should be present and initially empty. Also observe console errors
    // during load and assert none occurred.

    const obs = attachErrorObservers(page);

    // Load the page exactly as-is
    await page.goto(APP_URL);

    // Verify the Run DFS button exists and has the expected label
    const runBtn = page.locator('#runDFS');
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run DFS on Example Graph');

    // Verify demo output exists, has correct class and aria attributes, and is empty initially
    const output = page.locator('#demoOutput');
    await expect(output).toBeVisible();
    await expect(output).toHaveAttribute('class', 'demo-output');
    await expect(output).toHaveAttribute('aria-live', 'polite');

    // The initial content should be empty or whitespace only
    const text = (await output.textContent()) || '';
    expect(text.trim()).toBe('', 'Expected demo output to be empty in Idle state');

    // Assert that no console errors or page errors occurred while loading the page
    obs.dispose();
    expect(obs.consoleErrors.length, `Console errors: ${obs.consoleErrors.join(' | ')}`).toBe(0);
    expect(obs.pageErrors.length, `Page errors: ${obs.pageErrors.join(' | ')}`).toBe(0);
  });

  test('S1 -> S2 Transition: clicking Run DFS triggers traversal output with expected order', async ({ page }) => {
    // This test validates the transition from DFS Running (S1) to DFS Completed (S2).
    // It checks the onEnter action for S1 (output header) and the S2 onEnter (append traversal order).
    // It also ensures no runtime errors are emitted.

    const obs = attachErrorObservers(page);

    await page.goto(APP_URL);

    const runBtn = page.locator('#runDFS');
    const output = page.locator('#demoOutput');

    // Click the button to trigger DFS
    await runBtn.click();

    // After clicking, output should begin with the header line
    await expect(output).toContainText('DFS traversal starting at node A:');

    // The expected traversal order from the provided graph and neighbor ordering:
    const expectedOrder = 'A → B → D → E → F → C';

    // Wait for the traversal order text to appear. Use a small timeout given it's synchronous.
    await expect(output).toContainText(expectedOrder);

    // Also assert the full content includes a newline after the header (as script sets)
    const content = (await output.textContent()) || '';
    expect(content.includes('DFS traversal starting at node A:'), 'Header missing in output').toBe(true);
    expect(content.includes(expectedOrder), `Expected traversal order "${expectedOrder}"`).toBe(true);

    // Ensure no console/page errors occurred during the click and processing
    obs.dispose();
    expect(obs.consoleErrors.length, `Console errors: ${obs.consoleErrors.join(' | ')}`).toBe(0);
    expect(obs.pageErrors.length, `Page errors: ${obs.pageErrors.join(' | ')}`).toBe(0);
  });

  test('Repeated clicks: S1->S2 is idempotent and resets output instead of appending', async ({ page }) => {
    // This test checks the behavior when the user triggers the same event multiple times.
    // The implementation resets the output header each click, so results should be identical
    // between consecutive clicks (no concatenation).

    const obs = attachErrorObservers(page);

    await page.goto(APP_URL);

    const runBtn = page.locator('#runDFS');
    const output = page.locator('#demoOutput');

    // First click
    await runBtn.click();
    await expect(output).toContainText('DFS traversal starting at node A:');
    const content1 = (await output.textContent()) || '';

    // Second click
    await runBtn.click();
    await expect(output).toContainText('DFS traversal starting at node A:');
    const content2 = (await output.textContent()) || '';

    // Should be identical since each click overwrites the content rather than appending
    expect(content1, 'First and second click output should match').toBe(content2);

    // Ensure no JS errors emitted
    obs.dispose();
    expect(obs.consoleErrors.length, `Console errors: ${obs.consoleErrors.join(' | ')}`).toBe(0);
    expect(obs.pageErrors.length, `Page errors: ${obs.pageErrors.join(' | ')}`).toBe(0);
  });

  test('Keyboard activation: Enter and Space keys trigger the button (accessibility/edge case)', async ({ page }) => {
    // This test validates alternative user interaction methods (keyboard) triggering the event.
    // It ensures clicking via keyboard produces the same S1->S2 behavior.

    const obs = attachErrorObservers(page);

    await page.goto(APP_URL);

    const runBtn = page.locator('#runDFS');
    const output = page.locator('#demoOutput');

    // Focus the button and press Enter
    await runBtn.focus();
    await page.keyboard.press('Enter');
    await expect(output).toContainText('DFS traversal starting at node A:');
    const contentEnter = (await output.textContent()) || '';

    // Clear by clicking again to reset state
    await runBtn.click();

    // Focus and press Space
    await runBtn.focus();
    await page.keyboard.press('Space');
    // Depending on the browser/Playwright behavior, Space may scroll; ensure the click handler fired
    await expect(output).toContainText('DFS traversal starting at node A:');
    const contentSpace = (await output.textContent()) || '';

    // Validate traversal order is present for both activations
    const expectedOrder = 'A → B → D → E → F → C';
    expect(contentEnter.includes(expectedOrder)).toBe(true);
    expect(contentSpace.includes(expectedOrder)).toBe(true);

    // Ensure no JS errors emitted during keyboard interactions
    obs.dispose();
    expect(obs.consoleErrors.length, `Console errors: ${obs.consoleErrors.join(' | ')}`).toBe(0);
    expect(obs.pageErrors.length, `Page errors: ${obs.pageErrors.join(' | ')}`).toBe(0);
  });

  test('Observes console and page errors during full user scenario (capturing runtime issues)', async ({ page }) => {
    // This test purposely observes console and page errors across a full interaction scenario.
    // It will fail if any ReferenceError/SyntaxError/TypeError or console.error messages appear.
    // This satisfies the requirement to observe and assert presence/absence of such errors.

    const obs = attachErrorObservers(page);

    await page.goto(APP_URL);

    const runBtn = page.locator('#runDFS');
    const output = page.locator('#demoOutput');

    // Perform interactions: click, keyboard activate, click again
    await runBtn.click();
    await expect(output).toContainText('DFS traversal starting at node A:');
    await runBtn.focus();
    await page.keyboard.press('Enter');
    await runBtn.click();

    // Give a short moment to ensure all synchronous handlers have completed
    await page.waitForTimeout(100);

    // If any runtime errors happened, they would be captured. Assert none occurred.
    obs.dispose();
    // Provide diagnostic messages in assertion failure text to help debugging if errors exist.
    expect(obs.consoleErrors.length, `Console errors detected: ${JSON.stringify(obs.consoleErrors)}`).toBe(0);
    expect(obs.pageErrors.length, `Page errors detected: ${JSON.stringify(obs.pageErrors)}`).toBe(0);
  });
});