import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8337de0-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Binary Tree — Minimal Interactive Demo (FSM Validation)', () => {
  // Collect console errors and page errors for each test
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen for uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // Capture error details for assertions and diagnostics
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });

    // Capture console messages and specifically note errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
    // Wait for main interactive elements to be present
    await page.waitForSelector('#runDemo');
    await page.waitForSelector('#demoOutput');
    await page.waitForSelector('#stepsContainer');
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors during the test run
    // (We observe and assert pageErrors so any ReferenceError/SyntaxError/TypeError would be reported)
    expect(pageErrors, 'No uncaught page errors (pageerror events)').toHaveLength(0);
    // Assert no console error messages were emitted
    expect(consoleErrors, 'No console.error messages emitted').toHaveLength(0);
  });

  test('Idle state (S0_Idle) - page renders the control and components correctly', async ({ page }) => {
    // This test validates the S0_Idle state: the Run Traversal Demo button and hidden demo output exist
    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');
    const steps = page.locator('#stepsContainer');

    // Button should be visible, enabled initially, and have expected text and attributes
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run Traversal Demo');
    await expect(runBtn).toHaveAttribute('class', /btn/);
    await expect(runBtn).toHaveAttribute('aria-controls', 'demoOutput');
    await expect(runBtn).toBeEnabled();

    // Demo output should be present but hidden (style display:none)
    await expect(demoOutput).toHaveAttribute('style', /display:none/);
    // Steps container should be empty initially
    await expect(steps.locator('.step')).toHaveCount(0);
  });

  test('Transition S0 -> S1 on RunDemoClick: demo output becomes visible and steps initialized', async ({ page }) => {
    // Validate that clicking the button triggers showDemoOutput behavior (onEnter) and populates steps
    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');
    const steps = page.locator('#stepsContainer');

    // Click to start demo. The handler disables the button and sets demoOutput.style.display = 'block' and clears steps
    await runBtn.click();

    // Immediately after clicking:
    // - button should be disabled
    await expect(runBtn).toBeDisabled();
    // - demo output should be visible (showDemoOutput entry action)
    await expect(demoOutput).toBeVisible();
    // - steps should have at least the initial "Starting demo..." message appended immediately
    // Give a small tick to allow the synchronous appendStep call to create the first step
    await page.waitForTimeout(50);
    const initialSteps = steps.locator('.step');
    await expect(initialSteps).toHaveCountGreaterThan(0);
    const firstText = await initialSteps.nth(0).innerText();
    expect(firstText).toMatch(/Starting demo for sample tree/i);
  });

  test('Demo runs fully, produces traversal sequences and re-enables the button (S1 completes)', async ({ page }) => {
    // This test waits for the demo to complete and verifies the sequences and final states
    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');
    const steps = page.locator('#stepsContainer');

    // Start the demo
    await runBtn.click();

    // Verify demo output visible and button disabled initially
    await expect(demoOutput).toBeVisible();
    await expect(runBtn).toBeDisabled();

    // The demo uses timeouts to append steps. According to the implementation,
    // final "Demo complete." appears around ~5800ms. Allow a generous timeout.
    await page.waitForTimeout(7000);

    // After the demo completes, the button should be re-enabled
    await expect(runBtn).toBeEnabled();

    // The demoOutput remains visible in the implementation (there is no hideDemoOutput call)
    await expect(demoOutput).toBeVisible();

    // Verify that traversal sequences are present as steps
    const stepTexts = await steps.locator('.step').allInnerTexts();
    // We expect at least these sequences somewhere in the steps
    const expectedSequences = [
      'Pre-order (root, left, right): A B D E C F G',
      'In-order (left, root, right): D B E A C G F',
      'Post-order (left, right, root): D E B G F C A',
      'Level-order (breadth-first): A B C D E F G',
      'Demo complete.'
    ];

    for (const expected of expectedSequences) {
      const found = stepTexts.some(t => t.includes(expected));
      expect(found, `Expected step text to include: "${expected}"`).toBeTruthy();
    }

    // Verify that steps contains explanatory follow-ups (implementation appends explanations)
    const explanationFound = stepTexts.some(t => t.startsWith('Explanation:') || t.includes('Visit the node'));
    expect(explanationFound).toBeTruthy();

    // Since the FSM mentions hideDemoOutput as an exit action for S1 but the implementation does not hide,
    // explicitly assert that demoOutput is still visible (i.e., hideDemoOutput was not called)
    expect(await demoOutput.isVisible()).toBeTruthy();
  });

  test('Edge case: rapid multiple clicks - second click while demo running should be ignored', async ({ page }) => {
    // Start the demo and attempt to click multiple times rapidly to ensure handler prevents re-entry
    const runBtn = page.locator('#runDemo');
    const steps = page.locator('#stepsContainer');

    // Click once to start
    await runBtn.click();

    // Immediately attempt a second click while the button should already be disabled.
    // Playwright will attempt to click, but the browser should not dispatch the click handler because the button is disabled.
    // We allow the click and then check that only one "Starting demo..." initial step exists.
    await Promise.all([
      // a tiny pause and a click to simulate a rapid second user click
      page.waitForTimeout(10).then(() => runBtn.click().catch(() => {})),
      page.waitForTimeout(20)
    ]);

    // Small wait for synchronous DOM update
    await page.waitForTimeout(50);

    // Count steps - initial starting message + subsequent ones will appear later.
    // Verify that we do not have duplicate "Starting demo..." immediate entries caused by multiple click handlers.
    const allStepTexts = await steps.locator('.step').allInnerTexts();
    const startingCount = allStepTexts.filter(t => /Starting demo for sample tree/i.test(t)).length;
    expect(startingCount).toBe(1);

    // Wait for demo to finish to avoid interfering with afterEach assertions
    await page.waitForTimeout(7000);
  });

  test('Accessibility and attributes: components have expected ARIA and attributes per FSM components list', async ({ page }) => {
    // Validate ARIA attributes and structural roles described in FSM components
    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');
    const steps = page.locator('#stepsContainer');

    // Button has aria-controls pointing to demoOutput
    await expect(runBtn).toHaveAttribute('aria-controls', 'demoOutput');

    // demoOutput has aria-live polite and initial style
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');
    await expect(demoOutput.getAttribute('style')).resolves.toMatch(/display:none/);

    // steps container should have aria-atomic true
    await expect(steps).toHaveAttribute('aria-atomic', 'true');
  });
});