import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9013a1-fa77-11f0-8492-31e949ed3c7c.html';

test.describe.serial('Runtime Environment Showcase - ed9013a1-fa77-11f0-8492-31e949ed3c7c', () => {
  // Arrays to collect runtime issues observed during each test
  let pageErrors = [];
  let consoleErrors = [];

  // Page Object for the application under test
  class RuntimePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
      this.page = page;
      this.startButton = page.locator('#startButton');
      this.animationArea = page.locator('#animationArea');
      this.header = page.locator('h1');
      this.scriptTag = page.locator('script').first();
    }

    async goto() {
      await this.page.goto(APP_URL, { waitUntil: 'load' });
    }

    async clickStart() {
      await this.startButton.click();
    }

    async isAnimationVisible() {
      return await this.animationArea.isVisible();
    }

    async getAnimationDisplayStyle() {
      return await this.page.evaluate(() => {
        const el = document.getElementById('animationArea');
        return el ? getComputedStyle(el).display : null;
      });
    }

    async getHeaderText() {
      return await this.header.textContent();
    }

    async getStartButtonText() {
      return await this.startButton.textContent();
    }

    async getScriptContent() {
      return await this.scriptTag.textContent();
    }

    async renderPageType() {
      return await this.page.evaluate(() => {
        // do not create or call renderPage; only inspect existence
        return typeof window.renderPage;
      });
    }
  }

  // Attach listeners and navigate before each test, so we capture console/page errors
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console messages of error severity
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });
  });

  // Test initial Idle state as described by the FSM
  test('Idle state: page renders header, start button and animation area is hidden', async ({ page }) => {
    // Purpose: Validate initial rendering and FSM S0_Idle evidence
    const app = new RuntimePage(page);
    await app.goto();

    // Header should be present and match expected text
    await expect(app.header).toBeVisible();
    const headerText = await app.getHeaderText();
    expect(headerText.trim()).toBe('Runtime Environment');

    // Start button should be present and have expected label
    await expect(app.startButton).toBeVisible();
    const buttonText = await app.getStartButtonText();
    expect(buttonText.trim()).toBe('Start Visualization');

    // animationArea should be present in DOM but hidden (display: none)
    const displayStyle = await app.getAnimationDisplayStyle();
    expect(displayStyle).toBe('none');

    // FSM expected entry action "renderPage()": verify whether a global renderPage exists
    const renderPageType = await app.renderPageType();
    // We do not call or define renderPage; assert its type so we detect absence/mismatch explicitly
    expect(renderPageType).toBe('undefined');

    // Assert no runtime page errors or console errors occurred on initial load
    expect(pageErrors.length, `Expected no page errors on load, but found: ${pageErrors.map(e=>String(e))}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages on load, but found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Test the transition from Idle -> Visualizing by clicking the StartVisualization button
  test('Transition StartVisualization: clicking Start Visualization shows the animation area (S0 -> S1)', async ({ page }) => {
    // Purpose: Validate the event and transition defined in the FSM
    const app = new RuntimePage(page);
    await app.goto();

    // Precondition: animationArea hidden
    expect(await app.getAnimationDisplayStyle()).toBe('none');

    // Trigger event: click start button
    await app.clickStart();

    // After transition: animationArea should be visible (style.display = 'block')
    await expect(app.animationArea).toBeVisible();
    const afterDisplay = await app.getAnimationDisplayStyle();
    // The implementation sets style.display = 'block' explicitly
    expect(afterDisplay).toBe('block');

    // Validate that the visual element (the red pulsing circle) exists inside the animation area
    const child = page.locator('#animationArea > div');
    await expect(child).toBeVisible();

    // Ensure no runtime errors or console.error messages resulted from the click
    expect(pageErrors.length, `Page errors after clicking start: ${pageErrors.map(e=>String(e))}`).toBe(0);
    expect(consoleErrors.length, `Console errors after clicking start: ${JSON.stringify(consoleErrors)}`).toBe(0);

    // Also assert that the script includes an addEventListener call for evidence of the event binding
    const scriptContent = await app.getScriptContent();
    expect(scriptContent).not.toBeNull();
    expect(scriptContent).toMatch(/addEventListener\s*\(\s*['"]click['"]/);
  });

  // Test idempotency and repeated interactions (clicking multiple times)
  test('Idempotent clicks: clicking Start multiple times keeps animation area visible without errors', async ({ page }) => {
    // Purpose: Check robustness of interaction and absence of errors on repeated events
    const app = new RuntimePage(page);
    await app.goto();

    // Click the start button multiple times
    await app.clickStart();
    await app.clickStart();
    await app.clickStart();

    // Animation area remains visible and display style is still block
    expect(await app.isAnimationVisible()).toBe(true);
    expect(await app.getAnimationDisplayStyle()).toBe('block');

    // No additional runtime or console errors should have been emitted
    expect(pageErrors.length, `Page errors after repeated clicks: ${pageErrors.map(e=>String(e))}`).toBe(0);
    expect(consoleErrors.length, `Console errors after repeated clicks: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Edge-case: clicking elsewhere should not trigger the visualization
  test('Edge case: clicking outside the Start button does not show animation area', async ({ page }) => {
    // Purpose: Validate that only the designated event triggers state transition
    const app = new RuntimePage(page);
    await app.goto();

    // Click on the container (not the start button)
    await page.click('.container');

    // Animation area should remain hidden
    const displayAfterClick = await app.getAnimationDisplayStyle();
    expect(displayAfterClick).toBe('none');

    // Now explicitly confirm clicking the body (definitely not bound) also doesn't show it
    await page.click('body', { position: { x: 5, y: 5 } });
    expect(await app.getAnimationDisplayStyle()).toBe('none');

    // No runtime or console errors should have occurred
    expect(pageErrors.length, `Page errors after outside clicks: ${pageErrors.map(e=>String(e))}`).toBe(0);
    expect(consoleErrors.length, `Console errors after outside clicks: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Validate that FSM-specified evidence code snippet exists or that behavior matches evidence
  test('FSM evidence verification: ensure event handler and expected observable behavior exist', async ({ page }) => {
    // Purpose: Cross-check FSM evidence strings with actual implementation
    const app = new RuntimePage(page);
    await app.goto();

    const scriptContent = await app.getScriptContent();
    expect(scriptContent).not.toBeNull();

    // FSM evidence expects explicit addEventListener call that sets animationArea.style.display = 'block'
    expect(scriptContent).toMatch(/document\.getElementById\(['"]startButton['"]\)\.addEventListener/);
    expect(scriptContent).toMatch(/document\.getElementById\(['"]animationArea['"]\)\.style\.display\s*=\s*['"]block['"]/);

    // Also verify observable behavior by triggering the event once more
    await app.clickStart();
    expect(await app.getAnimationDisplayStyle()).toBe('block');

    // Confirm absence of runtime errors during this verification
    expect(pageErrors.length, `Page errors during evidence verification: ${pageErrors.map(e=>String(e))}`).toBe(0);
    expect(consoleErrors.length, `Console errors during evidence verification: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Dedicated test to explicitly expose any runtime exceptions (ReferenceError, TypeError, SyntaxError) if they occur
  test('Runtime exceptions: collect and report any ReferenceError/TypeError/SyntaxError that occur naturally', async ({ page }) => {
    // Purpose: Observe and assert on runtime exceptions emitted by the page without altering runtime
    const app = new RuntimePage(page);
    await app.goto();

    // Stimulate interactions likely to surface errors
    await app.clickStart();
    // Also try a second navigation to ensure no errors thrown during reload
    await page.reload({ waitUntil: 'load' });

    // Examine collected pageErrors and consoleErrors
    // We expect none for this implementation; if any occurred they will fail the assertion and report contents
    if (pageErrors.length > 0) {
      // If errors exist, assert their types are one of the allowed JS error types (for observability)
      for (const err of pageErrors) {
        const errString = String(err);
        // This assertion helps document what kind of error occurred
        expect(
          /ReferenceError|TypeError|SyntaxError|Error/.test(errString),
          `Unexpected page error type: ${errString}`
        ).toBeTruthy();
      }
    }
    // Fail if any page errors present (keeps tests strict and reports the actual exceptions)
    expect(pageErrors.length, `Unexpected runtime page errors: ${pageErrors.map(e=>String(e))}`).toBe(0);

    // Also assert there are no console.error messages
    expect(consoleErrors.length, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});