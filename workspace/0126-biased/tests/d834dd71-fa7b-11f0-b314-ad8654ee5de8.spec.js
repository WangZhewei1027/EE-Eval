import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d834dd71-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Radix Sort demo (FSM: Idle -> DemoRunning) - d834dd71-fa7b-11f0-b314-ad8654ee5de8', () => {
  // Helper to attach listeners to capture console errors and page errors for assertions
  async function attachErrorWatchers(page) {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // collect console messages of type error
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore watcher errors
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    return { consoleErrors, pageErrors };
  }

  test.beforeEach(async ({ page }) => {
    // Ensure we always start from a clean navigation to the HTML page
    await page.goto(APP_URL);
  });

  test('Idle state (S0_Idle) - initial render shows Run demo button and steps placeholder', async ({ page }) => {
    // Attach error watchers and collect any runtime errors or console errors
    const { consoleErrors, pageErrors } = await attachErrorWatchers(page);

    // Validate the demo button exists with expected text and attributes (evidence of S0_Idle)
    const demoButton = page.locator('#runDemo');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Run demo (LSD, base 10)');
    await expect(demoButton).toHaveAttribute('class', 'demo');
    await expect(demoButton).toHaveAttribute('aria-controls', 'steps');
    await expect(demoButton).toHaveAttribute('aria-label', 'Run Radix Sort Demo');

    // Validate the steps area shows the initial placeholder content (evidence: "Demo steps will appear here...")
    const steps = page.locator('#steps');
    await expect(steps).toBeVisible();
    await expect(steps).toHaveAttribute('aria-live', 'polite');

    // The initial markup includes a bolded heading div and one .line showing the example input.
    // Confirm that the placeholder heading text exists and the example input line is present.
    await expect(steps).toContainText('Demo steps will appear here after you click the button.');
    await expect(steps.locator('.line')).toHaveCount(1);
    await expect(steps.locator('.line')).toContainText('Example input: [170, 45, 75, 90, 802, 24, 2, 66]');

    // Assert no unexpected runtime page errors or console errors occurred during initial render.
    // Per the testing policy, we observe and assert the presence/absence of such errors.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Event/Transition (RunDemo) - clicking the button triggers snapshots and moves to DemoRunning (S1_DemoRunning)', async ({ page }) => {
    // Attach watchers to observe console and page errors produced during the click and render.
    const { consoleErrors, pageErrors } = await attachErrorWatchers(page);

    // Precondition: button and steps exist
    const demoButton = page.locator('#runDemo');
    const stepsLines = page.locator('#steps .line');

    await expect(demoButton).toBeVisible();
    await expect(stepsLines).toHaveCount(1); // initial example input line

    // Click the Run demo button to fire the lsdRadixPasses and renderSnapshots actions.
    await demoButton.click();

    // After clicking, the script replaces #steps content with one .line per snapshot.
    // The example has d = 3 digits, so snapshots: Original + 3 passes + Final sorted = 5 lines.
    await expect(page.locator('#steps .line')).toHaveCount(5);

    // Verify the content of the snapshots (labels + arrays).
    const linesText = await page.locator('#steps .line').allTextContents();

    // First snapshot should be the Original array in the same order as example.
    expect(linesText[0]).toContain('Original:');
    expect(linesText[0]).toContain('[170,45,75,90,802,24,2,66]');

    // Intermediate pass checks: ensure pass 1 (units), pass 2 (tens), pass 3 (hundreds) appear in sequence
    expect(linesText[1]).toContain('After pass 1');
    expect(linesText[2]).toContain('After pass 2');
    expect(linesText[3]).toContain('After pass 3');

    // Final snapshot should be the sorted array in ascending numeric order
    expect(linesText[4]).toContain('Final sorted:');
    expect(linesText[4]).toContain('[2,24,45,66,75,90,170,802]');

    // Verify that the aria-controls relationship is intact: the button references the steps element
    const ariaControls = await demoButton.getAttribute('aria-controls');
    expect(ariaControls).toBe('steps');

    // Confirm that no runtime page errors or console errors were produced while executing the demo code
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Multiple clicks / idempotence - clicking the Run demo button multiple times re-renders snapshots without errors', async ({ page }) => {
    // Attach error/page watchers
    const { consoleErrors, pageErrors } = await attachErrorWatchers(page);

    const demoButton = page.locator('#runDemo');
    const linesLocator = page.locator('#steps .line');

    // Click once and capture final snapshot text
    await demoButton.click();
    await expect(linesLocator).toHaveCount(5);
    const firstRunFinal = (await linesLocator.nth(4).textContent()) || '';

    // Click again - the script clears and re-renders the snapshots
    await demoButton.click();
    await expect(linesLocator).toHaveCount(5);
    const secondRunFinal = (await linesLocator.nth(4).textContent()) || '';

    // Both final snapshots should be identical strings (consistent deterministic result)
    expect(secondRunFinal).toBe(firstRunFinal);
    expect(secondRunFinal).toContain('[2,24,45,66,75,90,170,802]');

    // Ensure no page errors or console errors occurred during repeated runs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility and attributes - validate elements required by FSM components', async ({ page }) => {
    // Validate button and steps as described in components section of FSM
    const demoButton = page.locator('#runDemo');
    const steps = page.locator('#steps');

    await expect(demoButton).toHaveAttribute('id', 'runDemo');
    await expect(demoButton).toHaveAttribute('class', 'demo');
    await expect(demoButton).toHaveAttribute('aria-label', 'Run Radix Sort Demo');
    await expect(demoButton).toHaveAttribute('aria-controls', 'steps');

    await expect(steps).toHaveAttribute('id', 'steps');
    await expect(steps).toHaveAttribute('aria-live', 'polite');

    // The steps region should initially contain the placeholder heading text.
    await expect(steps).toContainText('Demo steps will appear here after you click the button.');
  });

  test('Edge case observations: ensure no runtime exceptions when interacting rapidly', async ({ page }) => {
    // Attach watchers to detect any thrown exceptions on rapid interactions
    const { consoleErrors, pageErrors } = await attachErrorWatchers(page);

    const demoButton = page.locator('#runDemo');

    // Rapidly click the button multiple times to surface potential race conditions or errors
    // The underlying script is small and synchronous, but this simulates a user hammering the button.
    await demoButton.click();
    await demoButton.click();
    await demoButton.click();

    // Expect that eventually snapshots settle to expected count (still 5)
    await expect(page.locator('#steps .line')).toHaveCount(5);

    // Validate final sorted array still appears
    const finalText = await page.locator('#steps .line').nth(4).textContent();
    expect(finalText).toBeDefined();
    expect(finalText).toContain('[2,24,45,66,75,90,170,802]');

    // Assert that repeated/rapid interactions did not create console or page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Instrumentation: capture and assert no unexpected console.error messages during page lifecycle', async ({ page }) => {
    // Listen only for console.error type messages
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Also capture any unhandled page errors
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Reload the page to ensure we capture lifecycle messages
    await page.reload();

    // Short delay to allow any potential script execution and errors to occur
    await page.waitForTimeout(200);

    // Assert there are no console.error messages nor page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});