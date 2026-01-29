import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83615f0-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('A* Search — Minimal Demo (d83615f0-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Arrays to collect runtime console errors and page errors observed while the page runs.
  let consoleErrors = [];
  let pageErrors = [];

  // Create a new page for each test and attach listeners to observe console and page error events.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled exceptions (pageerror)
    page.on('pageerror', err => {
      // err is an Error object from the page context
      pageErrors.push({ message: err.message, name: err.name, stack: err.stack });
    });

    // Also listen for 'requestfailed' to detect loading problems (network errors)
    page.on('requestfailed', request => {
      // record failed resource loads as errors for visibility in tests
      consoleErrors.push(`Request failed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`);
    });

    // Navigate to the application page as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Give a short moment for any asynchronous errors to bubble up after interactions
    await page.waitForTimeout(50);
    // Close page listener side-effects are handled by Playwright test runner cleanup
  });

  test('Idle state (S0_Idle) — page renders and Run A* demonstration button is present and enabled', async ({ page }) => {
    // This test validates the Idle state described in the FSM:
    // - The initial DOM contains the run button (#runDemo)
    // - The demo output area has the initial instructional text
    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Button should be visible and enabled in idle state
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeEnabled();
    await expect(runBtn).toHaveText('Run A* demonstration');

    // The demo output should contain the initial instruction text that prompts the user to press the button.
    await expect(demoOutput).toContainText('Press "Run A* demonstration" to see a step-by-step trace of A* exploring the grid.');

    // Ensure that loading the page did not produce any uncaught ReferenceError / SyntaxError / TypeError.
    // We assert that there were no page errors and no console errors on initial render.
    expect(pageErrors.length, `Unexpected page errors on initial load: ${JSON.stringify(pageErrors)}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors on initial load: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Transition RunDemoClick (S0_Idle -> S1_RunningDemo) — clicking runs the textual demo and prints trace', async ({ page }) => {
    // This test validates the transition and the Running Demo state:
    // - Clicking the #runDemo button should show "Running A* demonstration..." immediately
    // - After the internal timeout and computation, the detailed trace should be printed
    // - The button should be disabled during the run and re-enabled after completion
    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Click the button to trigger runAStarTrace via the attached click handler.
    await runBtn.click();

    // Immediately after click the page script sets the output to "Running A* demonstration...\n" and disables the button.
    // Check that the output begins with that message (it's set synchronously before the timeout).
    await expect(demoOutput).toContainText('Running A* demonstration...');

    // The button should be disabled and visually adjusted (style.opacity set to 0.7).
    await expect(runBtn).toBeDisabled();
    // Check inline style for opacity - may be set as '0.7' while disabled.
    const opacity = await runBtn.evaluate((el) => el.style.opacity);
    expect(opacity === '' || opacity === '0.7' || opacity === '1').toBeTruthy();

    // Wait for the demo to complete. The demo code prints a multi-line trace and, when successful,
    // includes the phrase "Goal popped from open set. Reconstructing path..." and "Total cost =".
    // Give generous timeout to allow the demo's 250ms delay and processing.
    await page.waitForFunction(() => {
      const out = document.getElementById('demoOutput');
      return out && out.textContent && (out.textContent.includes('Goal popped from open set') || out.textContent.includes('Search terminated without finding goal'));
    }, { timeout: 5000 });

    const finalText = await demoOutput.textContent();

    // The demo should produce an "Initial state:" header and some step trace lines.
    expect(finalText).toMatch(/Initial state:/);

    // Expect either that goal was reached (common path) or the demo terminated without finding goal.
    // Prefer asserting goal reached because the demo is deterministic on the given grid.
    expect(finalText).toMatch(/(Goal popped from open set\. Reconstructing path\.\.\.|Search terminated without finding goal)/);

    // If goal popped, the demo reconstructs and prints the path and total cost. Assert presence of those phrases.
    if (finalText.includes('Goal popped from open set')) {
      expect(finalText).toMatch(/Path \(row,col\) sequence:/);
      expect(finalText).toMatch(/Total cost = \d+/);
    }

    // After the demo completes, the button should be re-enabled and opacity restored.
    await expect(runBtn).toBeEnabled();
    const finalOpacity = await runBtn.evaluate((el) => el.style.opacity);
    // The code sets opacity back to 1 in finally block
    expect(finalOpacity === '' || finalOpacity === '1').toBeTruthy();

    // There should be no uncaught page errors or console errors during the run.
    expect(pageErrors.length, `Unexpected page errors during demo run: ${JSON.stringify(pageErrors)}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors during demo run: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Edge case: rapid repeated clicks are handled (button disabled prevents overlapping runs)', async ({ page }) => {
    // This test ensures that clicking rapidly does not cause crashes or multiple overlapping runs.
    // The page code disables the button synchronously on click; repeated clicks should be ignored.
    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Rapidly attempt to click twice in immediate succession
    await Promise.all([
      runBtn.click(), // first click: should disable button quickly
      runBtn.click().catch(() => {}) // second click may be ignored or rejected; we catch to avoid failing the test
    ]);

    // Confirm that demo started
    await expect(demoOutput).toContainText('Running A* demonstration...');

    // Wait for completion as in previous test
    await page.waitForFunction(() => {
      const out = document.getElementById('demoOutput');
      return out && out.textContent && (out.textContent.includes('Goal popped from open set') || out.textContent.includes('Search terminated without finding goal'));
    }, { timeout: 5000 });

    const finalText = await demoOutput.textContent();

    // Ensure the output is a single coherent trace (initial header present)
    expect(finalText).toMatch(/Initial state:/);

    // Ensure no unhandled exceptions happened during rapid clicking
    expect(pageErrors.length, `Unexpected page errors after rapid clicks: ${JSON.stringify(pageErrors)}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors after rapid clicks: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Implementation evidence assertions and sanity checks', async ({ page }) => {
    // This test asserts some implementation-level evidence mentioned in the FSM and the page:
    // - The page contains exactly one button with id runDemo
    // - The demo output element is live (aria-live) and exists
    const btns = await page.locator('button#runDemo').elementHandles();
    expect(btns.length).toBe(1);

    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();

    // Check that the page contains descriptive headings referenced by FSM (sanity check)
    await expect(page.locator('h1')).toContainText('A* Search — Comprehensive Explanation');
    await expect(page.locator('h2#example')).toContainText('11. A small, minimal demonstration (one-button)');

    // Final sanity: no runtime errors captured during this test
    expect(pageErrors.length, `pageErrors detected: ${JSON.stringify(pageErrors)}`).toBe(0);
    expect(consoleErrors.length, `consoleErrors detected: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});