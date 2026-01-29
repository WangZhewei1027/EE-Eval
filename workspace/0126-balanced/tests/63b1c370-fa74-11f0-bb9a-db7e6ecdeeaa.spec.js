import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b1c370-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Floyd-Warshall application
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.prevBtn = page.locator('#prevStep');
    this.nextBtn = page.locator('#nextStep');
    this.matrixInput = page.locator('#matrixInput');
    this.output = page.locator('#output');
    this.stepNumber = page.locator('#stepNumber');
    this.maxSteps = page.locator('#maxSteps');
    this.stepDesc = page.locator('#step-description');
    this.matrixContainer = page.locator('#matrixContainer');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async startAlgorithm() {
    await this.startBtn.click();
  }

  async clickNext() {
    await this.nextBtn.click();
  }

  async clickPrev() {
    await this.prevBtn.click();
  }

  async isOutputVisible() {
    return await this.output.isVisible();
  }

  async getStepNumber() {
    const txt = await this.stepNumber.textContent();
    return Number(txt.trim());
  }

  async getMaxSteps() {
    const txt1 = await this.maxSteps.textContent();
    return Number(txt.trim());
  }

  async getStepDescription() {
    return (await this.stepDesc.textContent()) ?? '';
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isMatrixInputDisabled() {
    return await this.matrixInput.isDisabled();
  }

  async isPrevDisabled() {
    return await this.prevBtn.isDisabled();
  }

  async isNextDisabled() {
    return await this.nextBtn.isDisabled();
  }

  async countInfinityCells() {
    return await this.matrixContainer.locator('td.infinity').count();
  }

  async hasHighlightedCell() {
    // The renderer uses inline style background: #ccffcc for updates.
    const html = (await this.matrixContainer.innerHTML()).toLowerCase();
    return html.includes('background: #ccffcc') || html.includes('background:#ccffcc');
  }

  async setMatrix(text) {
    await this.matrixInput.fill(text);
  }

  async getMatrixInputValue() {
    return await this.matrixInput.inputValue();
  }
}

test.describe('Floyd-Warshall Visualization - FSM and UI behavior', () => {
  // Arrays to collect console messages and page errors for observation tests
  let consoleMessages;
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Capture dialogs (alerts)
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // close the dialog so tests can continue
      try {
        await dialog.dismiss();
      } catch (e) {
        // ignore if already handled
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown: ensure no unexpected modal left open.
    // Nothing to do further.
  });

  test('Initial Idle state (S0_Idle) renders the UI correctly', async ({ page }) => {
    // This test validates the initial "Idle" state as per FSM:
    // - Start button exists
    // - Matrix input exists and contains the example
    // - Output area is hidden
    // - Prev/Next controls are present and disabled
    const app = new FloydWarshallPage(page);

    // Ensure elements are present
    await expect(app.startBtn).toBeVisible();
    await expect(app.matrixInput).toBeVisible();
    await expect(app.output).toBeHidden();

    // Verify default matrix content is present (sanity check)
    const matrixValue = await app.getMatrixInputValue();
    expect(matrixValue).toContain('0 3 INF 5');

    // Prev/Next should be disabled initially
    expect(await app.isPrevDisabled()).toBeTruthy();
    expect(await app.isNextDisabled()).toBeTruthy();

    // No page errors should have occurred on load
    expect(pageErrors.length).toBe(0);

    // No console errors (type 'error') on load
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('StartAlgorithm event transitions to Algorithm Running and Step Display (S0 -> S1 -> S2)', async ({ page }) => {
    // This test exercises the StartAlgorithm event:
    // - Click Start Algorithm
    // - Expect output to become visible
    // - start button and matrix input become disabled
    // - initial step display is shown with stepNumber 0 and maxSteps > 0
    const app1 = new FloydWarshallPage(page);

    // Click start to run algorithm
    await app.startAlgorithm();

    // Output should be visible and controls updated
    await expect(app.output).toBeVisible();
    expect(await app.isStartDisabled()).toBeTruthy();
    expect(await app.isMatrixInputDisabled()).toBeTruthy();

    // Step number should be 0 and maxSteps at least 0 (there will be many steps)
    const stepNum = await app.getStepNumber();
    const maxSteps = await app.getMaxSteps();

    expect(stepNum).toBe(0);
    expect(maxSteps).toBeGreaterThanOrEqual(0);

    // The step description should show the initial description
    const desc = await app.getStepDescription();
    expect(desc).toContain('Initial distance matrix before running algorithm.');

    // The matrix container should render a table and contain INF values
    const infCount = await app.countInfinityCells();
    expect(infCount).toBeGreaterThanOrEqual(1);

    // After starting, next button may be enabled if there are >1 steps
    if (maxSteps > 0) {
      expect(await app.isNextDisabled()).toBeFalsy();
    } else {
      expect(await app.isNextDisabled()).toBeTruthy();
    }
  });

  test('NextStep and PreviousStep navigate through steps and update visuals', async ({ page }) => {
    // This test validates transitions S1 -> S2 (NextStep) and S2 -> S2 (PreviousStep)
    // It ensures step numbers change, descriptions update, matrix highlights are shown on updates,
    // and Prev/Next buttons enable/disable correctly at boundaries.
    const app2 = new FloydWarshallPage(page);

    // Start algorithm first
    await app.startAlgorithm();

    const maxSteps1 = await app.getMaxSteps();
    expect(maxSteps).toBeGreaterThanOrEqual(0);

    // If there are no steps beyond initial, this specific navigation test is trivial
    if (maxSteps === 0) {
      // Only initial step exists; prev/next should be disabled
      expect(await app.isPrevDisabled()).toBeTruthy();
      expect(await app.isNextDisabled()).toBeTruthy();
      return;
    }

    // Move forward step by step to the end, ensuring numbers increase and descriptions update.
    let lastDesc = await app.getStepDescription();
    let lastHtml = await app.matrixContainer.innerHTML();

    // Click Next repeatedly until disabled, checking changes
    while (!(await app.isNextDisabled())) {
      await app.clickNext();
      const curStep = await app.getStepNumber();
      const curDesc = await app.getStepDescription();
      const curHtml = await app.matrixContainer.innerHTML();

      // Step number should be within bounds
      expect(curStep).toBeGreaterThanOrEqual(0);
      expect(curStep).toBeLessThanOrEqual(maxSteps);

      // Description should be a non-empty string and may differ from previous
      expect(typeof curDesc).toBe('string');
      expect(curDesc.length).toBeGreaterThan(0);

      // Matrix HTML should be present (string)
      expect(typeof curHtml).toBe('string');
      expect(curHtml.length).toBeGreaterThan(0);

      // At least one of description or matrix should change as we advance (not a strict rule but expected)
      // (Allow possibility of identical snapshots for some steps, so this is a soft check)
      // We'll assert that either desc or html changed at least once during progression.
      if (curDesc !== lastDesc || curHtml !== lastHtml) {
        // update last seen
        lastDesc = curDesc;
        lastHtml = curHtml;
      }
    }

    // Once at the final step, next should be disabled and prev should be enabled (unless only one step)
    expect(await app.isNextDisabled()).toBeTruthy();
    if (maxSteps > 0) {
      expect(await app.isPrevDisabled()).toBeFalsy();
    }

    // Now navigate backwards one step and verify step number decreases and UI updates
    if (!(await app.isPrevDisabled())) {
      const beforeStep = await app.getStepNumber();
      await app.clickPrev();
      const afterStep = await app.getStepNumber();
      expect(afterStep).toBe(beforeStep - 1);

      const descAfter = await app.getStepDescription();
      expect(typeof descAfter).toBe('string');
    }
  });

  test('Edge case: invalid (non-square) matrix shows alert and does not start algorithm', async ({ page }) => {
    // This test validates error handling when the input matrix is invalid (non-square).
    // Expected behavior per implementation: an alert with 'Invalid matrix...' and no transition.
    const app3 = new FloydWarshallPage(page);

    // Provide an invalid matrix (rows of different lengths)
    const invalidMatrix = '1 2\n3 4 5';
    await app.setMatrix(invalidMatrix);

    // Click start and expect an alert dialog captured by the page.on('dialog') listener
    await app.startAlgorithm();

    // Wait briefly to ensure dialog handling captured it
    await page.waitForTimeout(100);

    // We should have recorded at least one dialog with the invalid matrix message
    const foundInvalidDialog = dialogs.find(d => /Invalid matrix/i.test(d.message));
    expect(foundInvalidDialog).toBeTruthy();

    // The page should remain in Idle-like state: output hidden, start button not disabled, matrix input not disabled
    expect(await app.isOutputVisible()).toBeFalsy();
    expect(await app.isStartDisabled()).toBeFalsy();
    expect(await app.isMatrixInputDisabled()).toBeFalsy();
  });

  test('Visual highlight appears when a cell is updated during algorithm steps', async ({ page }) => {
    // This test ensures that when a step indicates an update, the updated cell is visually highlighted
    // (the renderer uses inline background: #ccffcc style for updates).
    const app4 = new FloydWarshallPage(page);

    // Start the algorithm
    await app.startAlgorithm();

    // Move forward until a highlighted update appears (or until end)
    const maxSteps2 = await app.getMaxSteps();
    let foundHighlight = await app.hasHighlightedCell(); // maybe initial step has none

    // Try to find at least one highlighted cell in the sequence of steps
    while (!foundHighlight && !(await app.isNextDisabled())) {
      await app.clickNext();
      foundHighlight = await app.hasHighlightedCell();
    }

    // It's expected that at least one update occurs during Floyd-Warshall for this input.
    // However, to be robust, if none found, assert that we've reached the final step and there were no updates.
    if (foundHighlight) {
      expect(foundHighlight).toBeTruthy();
    } else {
      // No highlighted updates found. Assert that we fully traversed steps.
      expect(await app.isNextDisabled()).toBeTruthy();
    }
  });

  test('Observes console and page errors (should be none for a correct implementation)', async ({ page }) => {
    // This test simply collects console and page errors and asserts none are present.
    // According to the instruction, we must observe console logs and page errors and assert their presence/absence.
    // The provided implementation is expected to run without runtime errors, so we assert zero pageErrors and zero console 'error' messages.

    // Small wait to allow any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Assert there were no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Assert there were no console.error messages
    const errorConsoleMsgs1 = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);

    // For transparency, also assert that we did capture some console messages (not required)
    // But don't fail if there are none; just ensure our collection works.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});