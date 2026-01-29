import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0ec24-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page Object for the Bucket Sort demo page.
 * Encapsulates common selectors and actions so tests read clearly.
 */
class BucketSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showButton = page.locator("button[onclick='showAlgorithm()']");
    this.algorithmDiv = page.locator('#algorithm');
    this.pseudocode = page.locator('#algorithm pre');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickShowButton() {
    await this.showButton.click();
  }

  async focusAndPressEnter() {
    await this.showButton.focus();
    await this.page.keyboard.press('Enter');
  }

  async isAlgorithmVisible() {
    // Use computed style in page context to account for inline style and CSS
    return await this.page.evaluate(() => {
      const el = document.getElementById('algorithm');
      if (!el) return false;
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async algorithmDisplayStyle() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('algorithm');
      if (!el) return null;
      return el.style.display;
    });
  }

  async showAlgorithmFunctionType() {
    return await this.page.evaluate(() => typeof window.showAlgorithm);
  }

  async renderPageFunctionType() {
    return await this.page.evaluate(() => typeof window.renderPage);
  }
}

test.describe('Bucket Sort Interactive Page - FSM validation (Idle -> AlgorithmVisible)', () => {
  // Arrays to capture console messages and uncaught page errors during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      // Record the console message text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push({ message: err.message, stack: err.stack });
    });
  });

  test('Initial state (S0_Idle): page loads and algorithm content is hidden', async ({ page }) => {
    // Arrange - navigate to the app
    const app = new BucketSortPage(page);
    await app.goto();

    // Assert - the Show Algorithm Steps button exists and is visible
    await expect(app.showButton).toBeVisible({ timeout: 2000 });
    await expect(app.showButton).toHaveText('Show Algorithm Steps');

    // Assert - #algorithm exists in the DOM but is hidden (display: none)
    const algorithmExists = await page.$('#algorithm');
    expect(algorithmExists, 'The #algorithm element should exist in the DOM').toBeTruthy();

    const isVisible = await app.isAlgorithmVisible();
    expect(isVisible, '#algorithm should be hidden initially (Idle state)').toBe(false);

    // Verify the inline style attribute initially contains display: none;
    const inlineStyle = await page.getAttribute('#algorithm', 'style');
    expect(inlineStyle).toContain('display: none');

    // Verify that the showAlgorithm function exists and is a function
    const showType = await app.showAlgorithmFunctionType();
    expect(showType).toBe('function');

    // The FSM specification mentions an entry action renderPage() for S0.
    // The HTML does not implement renderPage(); assert that it is undefined on the page (no silent injection).
    const renderType = await app.renderPageFunctionType();
    expect(renderType).toBe('undefined');

    // No uncaught page errors should have occurred during a normal load of this page.
    // If any errors occurred, include their messages to aid debugging.
    expect(pageErrors.length, `Expected no uncaught page errors on load. Errors: ${JSON.stringify(pageErrors)}`).toBe(0);

    // Console may contain informational messages; ensure there are no console messages of type 'error'.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `No console.error expected on load. console.error entries: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Transition (ShowAlgorithm event): clicking button reveals the algorithm (S0 -> S1)', async ({ page }) => {
    // Arrange
    const app = new BucketSortPage(page);
    await app.goto();

    // Precondition: algorithm is hidden
    expect(await app.isAlgorithmVisible()).toBe(false);

    // Act: click the button that triggers the ShowAlgorithm event
    await app.clickShowButton();

    // Assert: the algorithm div should become visible (entry action effect)
    await expect(app.algorithmDiv).toBeVisible({ timeout: 2000 });
    expect(await app.isAlgorithmVisible()).toBe(true);

    // The expected onEnter action in the FSM is: document.getElementById('algorithm').style.display = 'block';
    // Verify the inline style was updated to 'block' (or computed style shows visible). We prefer to check inline style matches the action.
    const displayStyle = await app.algorithmDisplayStyle();
    expect(displayStyle, 'Expected inline style display to be set to block by showAlgorithm()').toBe('block');

    // Verify the pseudocode content is present
    await expect(app.pseudocode).toContainText('procedure bucketSort');

    // Ensure the showAlgorithm function exists and is the one invoked by the button's onclick attribute
    const onclickAttr = await page.getAttribute("button[onclick='showAlgorithm()']", 'onclick');
    expect(onclickAttr).toBe('showAlgorithm()');

    // No uncaught page errors should have occurred as a result of this interaction
    expect(pageErrors.length, `Expected no uncaught page errors after clicking. Errors: ${JSON.stringify(pageErrors)}`).toBe(0);

    // No console.error entries expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `No console.error expected after clicking. console.error entries: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Idempotent and repeated interactions: multiple clicks and keyboard activation keep algorithm visible', async ({ page }) => {
    const app = new BucketSortPage(page);
    await app.goto();

    // Rapidly click the button multiple times to simulate noisy user input
    await Promise.all([
      app.clickShowButton(),
      app.clickShowButton(),
      app.clickShowButton()
    ]);

    // Should be visible
    await expect(app.algorithmDiv).toBeVisible({ timeout: 2000 });
    expect(await app.isAlgorithmVisible()).toBe(true);
    expect(await app.algorithmDisplayStyle()).toBe('block');

    // Now blur and use keyboard activation (Enter) to ensure keyboard triggers the same event
    await app.focusAndPressEnter();

    // Still visible and style remains block
    await expect(app.algorithmDiv).toBeVisible();
    expect(await app.isAlgorithmVisible()).toBe(true);
    expect(await app.algorithmDisplayStyle()).toBe('block');

    // Clicking elsewhere should not hide it since no hide handler is implemented
    await page.click('body', { position: { x: 5, y: 5 } });
    expect(await app.isAlgorithmVisible()).toBe(true);

    // No page errors produced during repeated interactions
    expect(pageErrors.length, `Expected no uncaught page errors during repeated interactions. Errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Edge cases & defensive checks: DOM integrity and unexpected functions', async ({ page }) => {
    const app = new BucketSortPage(page);
    await app.goto();

    // Verify that there are exactly one show button and one algorithm container in the DOM
    const allShowButtons = await page.$$eval("button[onclick='showAlgorithm()']", els => els.length);
    expect(allShowButtons).toBe(1);

    const algorithmCount = await page.$$eval('#algorithm', els => els.length);
    expect(algorithmCount).toBe(1);

    // Confirm that clicking the button sets computed style to something other than 'none' (robustness)
    await app.clickShowButton();
    const computedDisplay = await page.evaluate(() => {
      const el = document.getElementById('algorithm');
      return window.getComputedStyle(el).display;
    });
    expect(computedDisplay === 'block' || computedDisplay !== 'none').toBeTruthy();

    // Verify that there are no global variables accidentally injected other than showAlgorithm
    // We only check the specific ones referenced by the FSM: showAlgorithm and renderPage
    const globals = await page.evaluate(() => {
      return {
        hasShow: typeof window.showAlgorithm !== 'undefined',
        hasRender: typeof window.renderPage !== 'undefined'
      };
    });
    expect(globals.hasShow).toBe(true);
    expect(globals.hasRender).toBe(false);

    // Final check: no uncaught page errors during these edge checks
    expect(pageErrors.length, `Expected no uncaught page errors in edge-case test. Errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Observability: capture and report any console errors or page errors (fail if any occur)', async ({ page }) => {
    // This test is specifically to surface any runtime errors produced by the page under normal usage.
    // It will fail if any uncaught exceptions or console.error messages are observed.
    const app = new BucketSortPage(page);
    await app.goto();

    // Interact with the page in a few common ways
    await app.clickShowButton();
    await app.focusAndPressEnter();

    // Allow a small grace period for any asynchronous errors to surface
    await page.waitForTimeout(200);

    // If pageErrors exist, fail with details
    if (pageErrors.length > 0) {
      // Fail the test and include captured error info
      throw new Error(`Uncaught page errors were observed: ${JSON.stringify(pageErrors, null, 2)}`);
    }

    // If any console messages of type 'error' were captured, fail and include them
    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrorEntries.length > 0) {
      throw new Error(`console.error messages observed: ${JSON.stringify(consoleErrorEntries, null, 2)}`);
    }

    // Otherwise pass - this indicates the page behaved without runtime exceptions during the interactions above
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorEntries.length).toBe(0);
  });
});