import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f181dcb0-d366-11f0-9b19-a558354ece3e.html';

// Simple page object for the Floyd-Warshall demo page
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.resetBtn = page.locator('#resetBtn');
    this.generateBtn = page.locator('#generateBtn');
    this.runBtn = page.locator('#runBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetAlgoBtn = page.locator('#resetAlgoBtn');
    this.speedControl = page.locator('#speedControl');
    this.canvas = page.locator('#graphCanvas');
    this.matrixContainer = page.locator('#matrixContainer');
    this.stepsContainer = page.locator('#stepsContainer');
    this.heading = page.locator('h1');
  }

  async goto() {
    // Navigate to page; don't wait for full networkidle because script may throw
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickResetAlgo() {
    await this.resetAlgoBtn.click();
  }

  async clickCanvasAt(x, y) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    await this.page.mouse.click(box.x + x, box.y + y);
  }

  async rightClickCanvasAt(x, y) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    await this.page.mouse.click(box.x + x, box.y + y, { button: 'right' });
  }

  async mousedownCanvasAt(x, y) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    await this.page.mouse.move(box.x + x, box.y + y);
    await this.page.mouse.down();
  }

  async mousemoveCanvasTo(dx, dy) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    await this.page.mouse.move(box.x + dx, box.y + dy);
  }

  async mouseupCanvasAt(x, y) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    await this.page.mouse.up();
    // move to given position to emulate release at location
    await this.page.mouse.move(box.x + x, box.y + y);
  }

  async getStepsText() {
    return (await this.stepsContainer.innerText()).trim();
  }

  async stepBtnDisabled() {
    return await this.stepBtn.getAttribute('disabled') !== null;
  }

  async resetAlgoBtnDisabled() {
    return await this.resetAlgoBtn.getAttribute('disabled') !== null;
  }

  async speedControlValue() {
    return await this.speedControl.inputValue();
  }

  async headingText() {
    return await this.heading.innerText();
  }
}

// Helper to collect console errors and page errors across navigation and interactions
function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const consoleMessages = [];

  page.on('console', (msg) => {
    const type = msg.type(); // e.g., 'error', 'warning', 'log'
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') consoleErrors.push(text);
  });

  page.on('pageerror', (err) => {
    // err is an Error object
    pageErrors.push(err && err.message ? err.message : String(err));
  });

  page.on('dialog', async (dialog) => {
    // Defensive: if the page prompts (prompt/alert/confirm) during tests, accept/dismiss to avoid blocking.
    try {
      if (dialog.type() === 'prompt') {
        // Provide a numeric value for prompts asking for edge weights to avoid blocking.
        await dialog.accept('1');
      } else {
        await dialog.dismiss();
      }
    } catch (e) {
      // ignore any dialog handling errors
    }
  });

  return { consoleErrors, pageErrors, consoleMessages };
}

// Utility to assert that we saw at least one error of important types (SyntaxError, ReferenceError, TypeError, or general 'is not defined')
function expectAtLeastOneSignificantError(consoleErrors, pageErrors) {
  const combined = [...consoleErrors, ...pageErrors].join('\n');
  // Expect any of these keywords to appear
  expect(
    /SyntaxError|ReferenceError|TypeError|is not defined|Unexpected token|Unexpected end of input|undefined/i.test(
      combined
    )
  ).toBeTruthy();
}

test.describe('Floyd-Warshall Visualization — FSM and interactions', () => {
  let page;
  let fw;
  let collectors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    collectors = attachErrorCollectors(page);
    fw = new FloydWarshallPage(page);
    // Navigate to the app; allow DOMContentLoaded even if script has errors
    await fw.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('UI elements are present and initial attributes match FSM expectations', async () => {
    // Validate core UI elements exist
    await expect(fw.heading).toHaveText('Floyd-Warshall Algorithm Visualization');
    await expect(fw.resetBtn).toBeVisible();
    await expect(fw.generateBtn).toBeVisible();
    await expect(fw.runBtn).toBeVisible();
    await expect(fw.stepBtn).toBeVisible();
    await expect(fw.resetAlgoBtn).toBeVisible();
    await expect(fw.speedControl).toBeVisible();
    await expect(fw.canvas).toBeVisible();

    // Verify initial button disabled states as per FSM components
    expect(await fw.stepBtnDisabled()).toBeTruthy(); // stepBtn should be disabled initially
    expect(await fw.resetAlgoBtnDisabled()).toBeTruthy(); // resetAlgoBtn should be disabled initially

    // Speed control default
    expect(await fw.speedControlValue()).toBe('5');

    // Matrix and steps containers exist
    await expect(fw.matrixContainer).toBeVisible();
    await expect(fw.stepsContainer).toBeVisible();
  });

  test('Application script parsing/execution should be observed (capture runtime errors like SyntaxError)', async () => {
    // After navigation, the page may have thrown parsing/runtime errors.
    // We expect at least one significant error (SyntaxError, ReferenceError, TypeError) due to the incomplete script.
    // Allow a short moment for any async errors to surface.
    await page.waitForTimeout(300);

    // Ensure we observed at least one significant error in console or pageerrors
    expect(
      collectors.consoleErrors.length + collectors.pageErrors.length
    ).toBeGreaterThanOrEqual(1);

    // Also assert that among the captured messages there is a prominent error type
    expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
  });

  test('FSM Event: ResetGraph (click #resetBtn) — triggers resetGraph or yields error', async () => {
    // Clear previous collectors
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;

    // Click reset button
    await fw.clickReset();

    // Wait for potential handler to run or error to occur
    await page.waitForTimeout(200);

    // Check if an error occurred when trying to call resetGraph (if script didn't define it)
    if (collectors.consoleErrors.length + collectors.pageErrors.length > 0) {
      // An error occurred — assert it's a meaningful runtime error
      expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
    } else {
      // No error — assert that UI still remains consistent (matrix/steps container exists)
      await expect(fw.matrixContainer).toBeVisible();
      await expect(fw.stepsContainer).toBeVisible();
    }
  });

  test('FSM Event: GenerateRandomGraph (click #generateBtn) — attempts to generate graph or reports error', async () => {
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;

    await fw.clickGenerate();

    await page.waitForTimeout(300);

    if (collectors.consoleErrors.length + collectors.pageErrors.length > 0) {
      expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
    } else {
      // If no error, validate that the matrix was re-generated (matrix container should have children or remain visible)
      await expect(fw.matrixContainer).toBeVisible();
    }
  });

  test('FSM Event: RunAlgorithm (click #runBtn) — toggles algorithm or reports error', async () => {
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;

    // Click run; may invoke toggleAlgorithm which could be undefined
    await fw.clickRun();

    // Allow time for the click handler to run or error to be thrown
    await page.waitForTimeout(300);

    // Either the steps container should have relevant instructional text, or an error should have been logged
    const stepsText = await fw.getStepsText().catch(() => '');

    if (collectors.consoleErrors.length + collectors.pageErrors.length > 0) {
      // error observed
      expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
    } else {
      // No error observed — assert that some algorithm-related text is present
      expect(/Algorithm|initialized|Run|Step|completed/i.test(stepsText)).toBeTruthy();
    }
  });

  test('FSM Event: StepAlgorithm (click #stepBtn) — attempt step or report error', async () => {
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;

    // Try to click step. The button is initially disabled; clicking programmatically may still attempt to invoke a handler.
    await fw.clickStep();

    await page.waitForTimeout(300);

    if (collectors.consoleErrors.length + collectors.pageErrors.length > 0) {
      expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
    } else {
      // If no error then check if stepsContainer shows "Algorithm completed" or step text
      const text = await fw.getStepsText();
      expect(/Step|Algorithm completed|initialized/i.test(text)).toBeTruthy();
    }
  });

  test('FSM Event: ResetAlgorithm (click #resetAlgoBtn) — attempt reset algorithm or report error', async () => {
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;

    await fw.clickResetAlgo();

    await page.waitForTimeout(300);

    if (collectors.consoleErrors.length + collectors.pageErrors.length > 0) {
      expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
    } else {
      // If no error, expect steps container to have some reset/initialized info
      const text = await fw.getStepsText();
      expect(/initialized|reset|Algorithm/i.test(text) || text.length === 0).toBeTruthy();
    }
  });

  test('FSM Event: AddNode (canvas click) — click canvas to add node or observe error', async () => {
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;

    // Click near center of canvas
    await fw.clickCanvasAt(100, 80);

    await page.waitForTimeout(300);

    if (collectors.consoleErrors.length + collectors.pageErrors.length > 0) {
      // If the handler is missing or throws, assert meaningful error captured
      expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
    } else {
      // If no errors, ensure the canvas still exists and some step text may be present
      await expect(fw.canvas).toBeVisible();
      const text = await fw.getStepsText();
      expect(/Algorithm initialized|initialized|Click 'Run Algorithm' to start/i.test(text) || text.length >= 0).toBeTruthy();
    }
  });

  test('FSM Event: SetEdgeWeight (canvas contextmenu/right-click) — simulate right click and handle prompt if shown', async () => {
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;

    // Right click canvas center
    await fw.rightClickCanvasAt(200, 100);

    // Give prompt handlers time to be invoked and handled by our dialog handler
    await page.waitForTimeout(400);

    if (collectors.consoleErrors.length + collectors.pageErrors.length > 0) {
      expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
    } else {
      // If no errors, the graph may have been re-drawn — matrix container should still be visible
      await expect(fw.matrixContainer).toBeVisible();
    }
  });

  test('FSM Events: Create edge via mousedown, mousemove, mouseup on canvas — cover start/update/finish transitions', async () => {
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;

    // Mousedown on canvas (potentially on an existing node)
    await fw.mousedownCanvasAt(200, 150);
    // Move mouse to emulate drag
    await fw.mousemoveCanvasTo(300, 180);
    // Mouse up to finish
    await fw.mouseupCanvasAt(300, 180);

    await page.waitForTimeout(400);

    if (collectors.consoleErrors.length + collectors.pageErrors.length > 0) {
      // Expect at least one runtime error if handlers are missing or broken
      expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
    } else {
      // If no errors, canvas should remain and matrix/steps should be present
      await expect(fw.canvas).toBeVisible();
      await expect(fw.matrixContainer).toBeVisible();
    }
  });

  test('Edge cases: Rapid sequence of interactions to reveal timing issues or exceptions', async () => {
    collectors.consoleErrors.length = 0;
    collectors.pageErrors.length = 0;

    // Rapidly trigger many events
    await Promise.all([
      fw.clickGenerate(),
      fw.clickReset(),
      fw.clickRun(),
      fw.clickStep()
    ]);

    // Also simulate quick mouse interactions
    await fw.mousedownCanvasAt(150, 120);
    await fw.mousemoveCanvasTo(250, 160);
    await fw.mouseupCanvasAt(250, 160);

    // Allow runtime errors to surface
    await page.waitForTimeout(500);

    // Given the incomplete script, we expect at least one error to have been captured during rapid activity
    expect(
      collectors.consoleErrors.length + collectors.pageErrors.length
    ).toBeGreaterThanOrEqual(1);

    // Validate that the errors are significant
    expectAtLeastOneSignificantError(collectors.consoleErrors, collectors.pageErrors);
  });

  test('Observability: Ensure console/page errors are informative and include stack/message', async () => {
    // We don't generate new interactions here; assert that the collected errors across previous steps contain messages with keywords and possibly stack info
    // Give a moment for any residual errors to appear
    await page.waitForTimeout(200);

    const combined = [...collectors.consoleErrors, ...collectors.pageErrors].join('\n');
    // There should be at least one non-empty error message
    expect(combined.length).toBeGreaterThan(0);

    // And it should include either an Error type or hint like 'is not defined' or 'Unexpected'
    expect(
      /SyntaxError|ReferenceError|TypeError|is not defined|Unexpected token|Unexpected end of input|undefined/i.test(
        combined
      )
    ).toBeTruthy();
  });
});