import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d833f311-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Heap (Max) — FSM-driven demonstration (d833f311-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type "error"
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // ignore instrumentation errors
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown explicitly; listeners are per-page and removed automatically.
  });

  test('Initial Idle state (S0_Idle) - page renders and shows the Run demonstration button', async ({ page }) => {
    // Validate Idle state's evidence: the demo button exists and is enabled
    const demoBtn = page.locator('#demoBtn');
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toBeEnabled();

    // The demo output area should be hidden initially (display: none)
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeHidden();

    // Ensure the brief example text near the button is present
    await expect(page.locator('.demo-area .muted')).toContainText('Example input: [3, 1, 6, 5, 2, 4]');

    // Assert no runtime console errors or page errors occurred during initial render
    expect(consoleErrors.length, `Expected no console.error messages on load, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Expected no uncaught page errors on load, found: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemonstrationRunning on click (#demoBtn) - output appears and steps rendered', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const demoOutput = page.locator('#demoOutput');
    const stepsDiv = page.locator('#steps');

    // Click the Run demonstration button to trigger the transition
    await demoBtn.click();

    // After click, button should become disabled (evidence of transition and protection against re-click)
    await expect(demoBtn).toBeDisabled();

    // The demo output container should now be visible (output.style.display = 'block')
    await expect(demoOutput).toBeVisible();

    // The steps container should have been populated with multiple step blocks
    await expect(stepsDiv).toHaveCount(1); // #steps exists as one container
    // But it should contain multiple child step entries (renderSteps appends many divs inside #steps)
    const stepChildren = stepsDiv.locator('div');
    const count = await stepChildren.count();
    expect(count, 'Expected multiple child step entries inside #steps after running demonstration').toBeGreaterThan(3);

    // Validate that the first step describes the initial array
    const firstTitle = stepChildren.nth(0).locator('div').first();
    await expect(firstTitle).toContainText('1. Initial array');

    const firstArrayPre = stepChildren.nth(0).locator('pre').first();
    await expect(firstArrayPre).toContainText('Array: [3, 1, 6, 5, 2, 4]');

    // Validate that the final step describes the finished heap
    const lastIndex = (await stepChildren.count()) - 1;
    const lastTitle = stepChildren.nth(lastIndex).locator('div').first();
    await expect(lastTitle).toContainText(/Finished: resulting max heap/i);

    // The final array presented should be the resulting max heap for the example array
    const lastArrayPre = stepChildren.nth(lastIndex).locator('pre').nth(0); // first pre is array
    // The implementation uses Array.join(', ') so expect spaces after commas
    await expect(lastArrayPre).toContainText('Array: [6, 5, 4, 1, 2, 3]');

    // The ASCII tree should also be present for the last step and include the root "(0)6"
    const lastTreePre = stepChildren.nth(lastIndex).locator('.ascii-tree');
    await expect(lastTreePre).toHaveCount(1);
    await expect(lastTreePre).toContainText('(0)6');

    // Confirm no console or page errors occurred as a result of running the demo
    expect(consoleErrors.length, `Expected no console.error messages after running demo, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Expected no uncaught page errors after running demo, found: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Idempotency / edge-case: clicking the button again after it is disabled should not add more steps', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const stepsDiv = page.locator('#steps');

    // Run the demo once
    await demoBtn.click();

    // Capture number of child step entries after first run
    const stepChildren = stepsDiv.locator('div');
    const initialCount = await stepChildren.count();
    expect(initialCount).toBeGreaterThan(0);

    // Attempt to click again; button should be disabled and clicking it should not increase steps
    // Use JavaScript click via evaluate to verify disabled buttons do not trigger the handler
    await demoBtn.evaluate(btn => {
      try {
        btn.click();
      } catch (e) {
        // ignore any errors coming from triggering native click on disabled button
      }
    });

    // Wait a short time to allow any (unexpected) asynchronous work to run if the click erroneously fired
    await page.waitForTimeout(200);

    const afterCount = await stepChildren.count();
    expect(afterCount, 'Clicking the disabled button should not change the number of rendered steps').toBe(initialCount);

    // Confirm the button remains disabled
    await expect(demoBtn).toBeDisabled();

    // Verify again that no new console or page errors were introduced
    expect(consoleErrors.length, `Expected no console.error messages after re-click attempt, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Expected no uncaught page errors after re-click attempt, found: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Validate content structure of a sample intermediate step - looking for sift-down swap logs', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const stepsDiv = page.locator('#steps');

    // Run the demo
    await demoBtn.click();

    // Find any step that includes the word "Swap index"
    const swapSteps = stepsDiv.locator('div').filter({ hasText: 'Swap index' });
    const swapCount = await swapSteps.count();

    // For the provided example, there should be at least one swap logged in the steps
    expect(swapCount, 'Expected at least one "Swap index" log in the rendered steps').toBeGreaterThan(0);

    // Validate the textual structure of a swap step: contains indices and values formatted like "Swap index 1 (value 1) with index 3 (value 5)"
    const sampleSwapText = await swapSteps.nth(0).textContent();
    expect(sampleSwapText).toMatch(/Swap index\s+\d+\s+\(value\s+\d+\)\s+with index\s+\d+\s+\(value\s+\d+\)/i);
  });

  test('FSM expectations and transitions summary assertions', async ({ page }) => {
    const demoBtn = page.locator('#demoBtn');
    const demoOutput = page.locator('#demoOutput');

    // Initial Idle evidence: button present and text matches expected label
    await expect(demoBtn).toHaveText('Run demonstration');

    // Trigger the RunDemonstration event
    await demoBtn.click();

    // Transition S0 -> S1 observable: output visible (output.style.display = "block")
    await expect(demoOutput).toBeVisible();

    // Transition S1 exit action per FSM mentions renderSteps(steps) — ensure steps were rendered (steps container non-empty)
    const stepsDiv = page.locator('#steps');
    const childCount = await stepsDiv.locator('div').count();
    expect(childCount, 'Expected renderSteps to populate steps container during exit actions').toBeGreaterThan(0);

    // The FSM also mentioned btn.disabled = true as expected after demonstration — assert this holds
    await expect(demoBtn).toBeDisabled();

    // Final sanity: ensure the first and last step markers exist and are logical
    const titles = stepsDiv.locator('div > div');
    const titlesCount = await titles.count();
    expect(titlesCount).toBeGreaterThan(2);
    await expect(titles.first()).toContainText('1. Initial array');
    await expect(titles.nth(titlesCount - 1)).toContainText('Finished: resulting max heap');
  });

  test('No accidental global/function redefinitions and no runtime exceptions (observability test)', async ({ page }) => {
    // This test primarily asserts that the page did not emit unexpected runtime errors while exercising features.
    // We've already captured consoleErrors and pageErrors during navigation and interaction in beforeEach.
    // Re-check counts to enforce that they remain zero for the application's typical flows.
    expect(consoleErrors.length, `Unexpected console.error entries: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Unexpected uncaught page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});