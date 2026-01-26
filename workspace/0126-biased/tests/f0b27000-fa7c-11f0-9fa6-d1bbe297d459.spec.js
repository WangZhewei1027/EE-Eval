import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b27000-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Ternary Search Interactive Demo - f0b27000-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Capture page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect runtime exceptions and console messages
    page.on('pageerror', (err) => {
      // Save the error object for later assertions
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Navigate to the page and wait for load to complete
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure viewport is large enough so visualization.offsetWidth is non-zero
    await page.setViewportSize({ width: 1200, height: 900 });
  });

  test.afterEach(async ({ page }) => {
    // No special teardown required; Playwright will close pages between tests.
    // Leave listeners to be garbage collected with page.
  });

  test('Idle state (S0_Idle) - initial UI renders with Run Demonstration button and empty visualization', async ({ page }) => {
    // Validate presence and visibility of the demo button (evidence for S0_Idle)
    const demoButton = page.locator('#demo-button');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Run Demonstration');

    // Before interaction, demo steps container should be empty
    const demoSteps = page.locator('#demo-steps');
    await expect(demoSteps).toBeVisible();
    const initialStepsHtml = await demoSteps.innerHTML();
    expect(initialStepsHtml.trim()).toBe('', 'Expected no steps to be present in Idle state');

    // Visualization should be empty on initial render (no points yet)
    const visualization = page.locator('#visualization');
    await expect(visualization).toBeVisible();
    const initialVisualizationHtml = await visualization.innerHTML();
    // Implementation uses innerHTML = '' until demo runs; assert it is empty or whitespace.
    expect(initialVisualizationHtml.trim()).toBe('', 'Expected visualization to be empty in Idle state');

    // No runtime page errors should have occurred during load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemonstrationRunning on click: steps are displayed and visualization updated', async ({ page }) => {
    // Comments:
    // - This test validates the "Run Demonstration" event from the FSM.
    // - It asserts that clicking the button clears previous UI, renders visualization points and labels,
    //   and appends step paragraphs including the "Initial range" and "Found target" evidence.

    // Prepare locators
    const demoButton = page.locator('#demo-button');
    const demoSteps = page.locator('#demo-steps');
    const visualization = page.locator('#visualization');

    // Click the button to start the demonstration (this triggers startDemonstration logic)
    await demoButton.click();

    // Wait for at least one step to be appended
    await demoSteps.locator('p').first().waitFor({ state: 'attached' });

    // Collect step texts
    const stepElements = await demoSteps.locator('p').all();
    expect(stepElements.length).toBeGreaterThan(0);

    const stepsText = [];
    for (const stepEl of stepElements) {
      stepsText.push(await stepEl.textContent());
    }

    // Verify initial range step exists (evidence in FSM and implementation)
    const hasInitialRange = stepsText.some((t) => t && t.includes('Initial range: indices'));
    expect(hasInitialRange).toBeTruthy();

    // Verify that the demonstration finds the target at the expected index (arr has 23 at index 5)
    const foundStep = stepsText.find((t) => t && t.includes('Found target at index 5'));
    expect(foundStep).toBeTruthy();

    // Verify visualization has been populated with points and labels
    const points = await visualization.locator('.point').all();
    const labels = await visualization.locator('.label').all();

    // The sample array has 10 elements; expect 10 visual points and 10 labels
    expect(points.length).toBe(10);
    expect(labels.length).toBe(10);

    // Verify that the label for index 5 displays the value "23"
    const label5Text = await labels[5].textContent();
    expect(label5Text.trim()).toBe('23');

    // Verify that during the final visualization the mid2 element (index 5) is highlighted with the blue color (#3498db)
    // Use getComputedStyle to be robust across browsers (expected rgb(52, 152, 219))
    const bgColorIndex5 = await points[5].evaluate((el) => getComputedStyle(el).backgroundColor);
    // Accept either rgb(...) or rgba(...) but ensure it contains the expected RGB values
    expect(bgColorIndex5).toMatch(/52,\s*152,\s*219/);

    // No runtime errors should have happened while running the demo
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_DemonstrationRunning -> S1_DemonstrationRunning on re-click: demonstration resets/continues', async ({ page }) => {
    // Comments:
    // - This test validates that invoking the same event while in the active demonstration state
    //   resets/continues the demonstration (the implementation clears visualization and steps and re-runs).
    // - We check that the steps container is cleared on re-run and that new steps start again with Step 1.

    const demoButton = page.locator('#demo-button');
    const demoSteps = page.locator('#demo-steps');
    const visualization = page.locator('#visualization');

    // First run
    await demoButton.click();
    await demoSteps.locator('p').first().waitFor({ state: 'attached' });
    const firstRunSteps = await demoSteps.locator('p').all();
    expect(firstRunSteps.length).toBeGreaterThan(0);
    const firstRunFirstStepText = await firstRunSteps[0].textContent();

    // Capture visualization HTML after first run
    const visHtmlAfterFirst = await visualization.innerHTML();

    // Second run (re-click). The handler clears demoSteps and visualization at start.
    await demoButton.click();
    // Wait for the new steps to be appended
    await demoSteps.locator('p').first().waitFor({ state: 'attached' });

    const secondRunSteps = await demoSteps.locator('p').all();
    expect(secondRunSteps.length).toBeGreaterThan(0);

    const secondRunFirstStepText = await secondRunSteps[0].textContent();

    // The first step text of the second run should indicate the new "Step 1" initial range again.
    expect(secondRunFirstStepText).toBeTruthy();
    expect(secondRunFirstStepText).toMatch(/Step\s*1:/);

    // Ensure that visualization was cleared and re-rendered: HTML should change
    const visHtmlAfterSecond = await visualization.innerHTML();
    expect(visHtmlAfterSecond).not.toBe(visHtmlAfterFirst);

    // Confirm that the second run also finds the target at index 5
    const foundInSecondRun = (await Promise.all(secondRunSteps.map(s => s.textContent()))).some(t => t && t.includes('Found target at index 5'));
    expect(foundInSecondRun).toBeTruthy();

    // No runtime page errors during both runs
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks produce consistent resets and no uncaught exceptions', async ({ page }) => {
    // Comments:
    // - Attempt to click the button multiple times in quick succession to ensure each click resets the demo
    //   and no unhandled exceptions are produced. Because the demonstration logic is synchronous, clicks
    //   will be handled one after another; this verifies robustness of clearing/initialization code paths.

    const demoButton = page.locator('#demo-button');
    const demoSteps = page.locator('#demo-steps');

    // Perform three sequential clicks quickly and wait after the last click for completion
    await demoButton.click();
    await demoButton.click();
    await demoButton.click();

    // Wait for at least one step after the final click
    await demoSteps.locator('p').first().waitFor({ state: 'attached' });

    const stepsAfterRapidClicks = await demoSteps.locator('p').all();
    expect(stepsAfterRapidClicks.length).toBeGreaterThan(0);

    // Verify that the final run contains a "Found target at index 5"
    const stepsText = await Promise.all(stepsAfterRapidClicks.map(s => s.textContent()));
    const found = stepsText.some(t => t && t.includes('Found target at index 5'));
    expect(found).toBeTruthy();

    // Confirm no page-level exceptions were thrown during rapid interactions
    expect(pageErrors.length).toBe(0);

    // Also ensure there are no console messages of type "error"
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM integrity checks: labels and points correspond to array values and positions', async ({ page }) => {
    // Comments:
    // - This test ensures that labels reflect the array values and that the number of UI points equals the array length.
    // - It also spot-checks a few label values to ensure consistent rendering.

    const demoButton = page.locator('#demo-button');
    const visualization = page.locator('#visualization');

    // Start the demonstration
    await demoButton.click();
    await visualization.locator('.point').first().waitFor({ state: 'attached' });

    // Labels contain the array: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
    const expectedArray = ['2', '5', '8', '12', '16', '23', '38', '56', '72', '91'];
    const labels = await visualization.locator('.label').all();

    expect(labels.length).toBe(expectedArray.length);

    // Validate text content for a few indices: 0, 5, 9
    const label0 = await labels[0].textContent();
    const label5 = await labels[5].textContent();
    const label9 = await labels[9].textContent();

    expect(label0.trim()).toBe(expectedArray[0]);
    expect(label5.trim()).toBe(expectedArray[5]);
    expect(label9.trim()).toBe(expectedArray[9]);

    // No runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: verify that no unexpected ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
    // Comments:
    // - The project's requirements instruct to observe console logs and page errors.
    // - This test explicitly asserts that no page-level exceptions occurred (ReferenceError, SyntaxError, TypeError, etc.)
    // - We collected page errors in beforeEach; assert there are none.

    // For good measure, perform a run to exercise the demo code paths then check error list.
    await page.click('#demo-button');
    await page.locator('#demo-steps p').first().waitFor({ state: 'attached' });

    // Assert no page errors
    if (pageErrors.length > 0) {
      // If any errors exist, fail with detailed messages for debugging
      const messages = pageErrors.map((e) => e.stack || e.message || String(e)).join('\n---\n');
      throw new Error(`Unexpected page errors were detected:\n${messages}`);
    }
    expect(pageErrors.length).toBe(0);

    // Also assert there are no console.error messages captured
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});