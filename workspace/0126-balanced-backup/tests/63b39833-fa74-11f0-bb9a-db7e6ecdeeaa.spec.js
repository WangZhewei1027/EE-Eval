import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b39833-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Expected stages and descriptions based on the provided HTML / FSM
const EXPECTED_STAGES = [
  {
    name: 'Requirement Analysis',
    description:
      'Gather and analyze the business needs and user requirements to understand what the software must achieve.'
  },
  {
    name: 'System Design',
    description:
      'Architect the software by defining components, modules, interfaces, and data flow to meet the specified requirements.'
  },
  {
    name: 'Implementation (Coding)',
    description:
      'Write the actual source code according to the design documents and coding standards.'
  },
  {
    name: 'Testing',
    description:
      'Verify that the software works correctly by identifying defects and ensuring requirements are met.'
  },
  {
    name: 'Deployment',
    description:
      'Release the software to users and install it in the target environment.'
  },
  {
    name: 'Maintenance',
    description:
      'Provide ongoing support, fix bugs, update features, and ensure the software remains effective over time.'
  }
];

test.describe('SDLC Demo - Interactive FSM validation', () => {
  // Arrays to capture console errors and uncaught page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages emitted from the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled exceptions / page errors
    page.on('pageerror', (err) => {
      // Push the error message (let errors happen naturally)
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Assert that the page did not produce runtime errors or console errors unexpectedly.
    // This validates that the inline script executed without throwing uncaught exceptions.
    expect(pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should be logged').toHaveLength(0);
  });

  test('Initial render shows Requirement Analysis and correct controls', async ({ page }) => {
    // This test validates the initial state (S0_RequirementAnalysis)
    const stageName = page.locator('#stage-name');
    const stageDescription = page.locator('#stage-description');
    const progress = page.locator('#progress');
    const nextBtn = page.locator('#next-btn');

    // Verify text contents match the Requirement Analysis state
    await expect(stageName).toHaveText(EXPECTED_STAGES[0].name);
    await expect(stageDescription).toHaveText(EXPECTED_STAGES[0].description);

    // Verify progress reads "Stage 1 of 6"
    await expect(progress).toHaveText('Stage 1 of 6');

    // Verify the next button is enabled and has the expected label and aria attributes
    await expect(nextBtn).toBeEnabled();
    await expect(nextBtn).toHaveText('Next Stage »');
    await expect(nextBtn).toHaveAttribute('aria-label', 'Next SDLC Stage');

    // Verify aria-live attributes are present on both name and description
    await expect(stageName).toHaveAttribute('aria-live', 'polite');
    await expect(stageDescription).toHaveAttribute('aria-live', 'polite');
  });

  test('Navigate sequentially through all SDLC stages with Next button', async ({ page }) => {
    // This test walks the FSM through all transitions S0 -> S1 -> ... -> S5
    const stageName = page.locator('#stage-name');
    const stageDescription = page.locator('#stage-description');
    const progress = page.locator('#progress');
    const nextBtn = page.locator('#next-btn');

    // Confirm starting at stage 1
    await expect(stageName).toHaveText(EXPECTED_STAGES[0].name);
    await expect(progress).toHaveText('Stage 1 of 6');

    // Iterate through the stages using clicks and validate the DOM on each entry
    for (let i = 1; i < EXPECTED_STAGES.length; i++) {
      // Click the Next button to transition to the next stage
      await nextBtn.click();

      // After clicking, check that the displayed stage matches expected
      await expect(stageName).toHaveText(EXPECTED_STAGES[i].name);
      await expect(stageDescription).toHaveText(EXPECTED_STAGES[i].description);
      await expect(progress).toHaveText(`Stage ${i + 1} of ${EXPECTED_STAGES.length}`);
    }

    // After reaching final stage (Maintenance), the button should become disabled and its text should update
    await expect(stageName).toHaveText('Maintenance');
    await expect(nextBtn).toBeDisabled();
    await expect(nextBtn).toHaveText('End of SDLC');
    await expect(nextBtn).toHaveAttribute('aria-label', 'End of Software Development Life Cycle');
  });

  test('Clicking Next at final state does not change the state (button disabled)', async ({ page }) => {
    // This test validates the terminal transition behavior (S5 -> S5)
    const stageName = page.locator('#stage-name');
    const nextBtn = page.locator('#next-btn');
    const progress = page.locator('#progress');

    // Move to final stage by clicking until button is disabled
    // Use page.evaluate to safely trigger clicks in page context repeatedly
    await page.evaluate(() => {
      const btn = document.getElementById('next-btn');
      // Click until disabled (up to 10 times to be resilient)
      for (let i = 0; i < 10; i++) {
        if (btn.disabled) break;
        btn.click();
      }
    });

    // Validate we are at the final state
    await expect(stageName).toHaveText('Maintenance');
    await expect(progress).toHaveText('Stage 6 of 6');
    await expect(nextBtn).toBeDisabled();

    // Attempting to click the disabled button via Playwright's click should throw.
    // We assert that Playwright throws when trying to click a disabled control.
    let clickError = null;
    try {
      await nextBtn.click({ timeout: 1000 });
    } catch (err) {
      clickError = err;
    }
    expect(clickError, 'Clicking a disabled button should throw an error').not.toBeNull();

    // Additionally, invoking click in page context should be a no-op when disabled
    // (it should not change the stage name or progress)
    const beforeName = await stageName.textContent();
    const beforeProgress = await progress.textContent();
    await page.evaluate(() => {
      document.getElementById('next-btn').click();
    });
    await expect(stageName).toHaveText(beforeName || 'Maintenance');
    await expect(progress).toHaveText(beforeProgress || 'Stage 6 of 6');
  });

  test('Rapid / repeated clicks do not exceed final stage', async ({ page }) => {
    // Edge case: simulate many rapid clicks to ensure FSM caps at last state and does not error
    const stageName = page.locator('#stage-name');
    const progress = page.locator('#progress');
    const nextBtn = page.locator('#next-btn');

    // Rapidly trigger click events from page context to avoid Playwright's "element disabled" check
    await page.evaluate(() => {
      const btn = document.getElementById('next-btn');
      // Fire click 20 times in quick succession
      for (let i = 0; i < 20; i++) {
        btn.click();
      }
    });

    // Ensure final state is reached and no overflow occurred
    await expect(stageName).toHaveText('Maintenance');
    await expect(progress).toHaveText('Stage 6 of 6');
    await expect(nextBtn).toBeDisabled();
  });

  test('DOM evidence for each state matches FSM descriptions (comprehensive check)', async ({ page }) => {
    // This test iterates through states and validates both label and description exactly match FSM evidence
    const stageName = page.locator('#stage-name');
    const stageDescription = page.locator('#stage-description');
    const progress = page.locator('#progress');

    // Ensure starting at state 0
    await expect(stageName).toHaveText(EXPECTED_STAGES[0].name);

    for (let i = 0; i < EXPECTED_STAGES.length; i++) {
      // Validate the displayed name and description
      await expect(stageName).toHaveText(EXPECTED_STAGES[i].name);
      await expect(stageDescription).toHaveText(EXPECTED_STAGES[i].description);

      // Validate progress text
      await expect(progress).toHaveText(`Stage ${i + 1} of ${EXPECTED_STAGES.length}`);

      // Move to the next stage if not at the end
      if (i < EXPECTED_STAGES.length - 1) {
        await page.locator('#next-btn').click();
      }
    }

    // After final iteration, ensure button is disabled and text updates to "End of SDLC"
    const nextBtn = page.locator('#next-btn');
    await expect(nextBtn).toBeDisabled();
    await expect(nextBtn).toHaveText('End of SDLC');
  });

  test('Accessibility attributes remain consistent through transitions', async ({ page }) => {
    // Check that aria-live on stage name/description remains 'polite' through all states
    const stageName = page.locator('#stage-name');
    const stageDescription = page.locator('#stage-description');
    const nextBtn = page.locator('#next-btn');

    for (let i = 0; i < EXPECTED_STAGES.length; i++) {
      await expect(stageName).toHaveAttribute('aria-live', 'polite');
      await expect(stageDescription).toHaveAttribute('aria-live', 'polite');

      // After the final state the aria-label on the button should update
      if (i === EXPECTED_STAGES.length - 1) {
        await expect(nextBtn).toHaveAttribute('aria-label', 'End of Software Development Life Cycle');
      } else {
        await expect(nextBtn).toHaveAttribute('aria-label', 'Next SDLC Stage');
        await nextBtn.click();
      }
    }
  });
});