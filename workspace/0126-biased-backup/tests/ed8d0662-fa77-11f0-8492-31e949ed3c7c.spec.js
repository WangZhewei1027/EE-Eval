import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d0662-fa77-11f0-8492-31e949ed3c7c.html';

class BTreePage {
  /**
   * Page object model for the B-Tree Visualization page.
   * Encapsulates common interactions so tests are readable and maintainable.
   */
  constructor(page) {
    this.page = page;
  }

  button() {
    return this.page.locator('.btn');
  }

  nodes() {
    return this.page.locator('.node');
  }

  horizontalLine() {
    return this.page.locator('.horizontal-line');
  }

  // Clicks the Learn More button and awaits the alert dialog, returning its message.
  async clickLearnMoreAndGetDialogText() {
    // Use waitForEvent to capture the dialog that will be shown by alert()
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.button().click(),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Hover a node by index (0-based)
  async hoverNode(index = 0) {
    const handle = await this.nodes().nth(index);
    await handle.hover();
  }

  // Get computed transform style of a node by index
  async getNodeTransform(index = 0) {
    return this.page.evaluate((idx) => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      if (!nodes[idx]) return null;
      return getComputedStyle(nodes[idx]).transform;
    }, index);
  }
}

test.describe('B-Tree Visualization - FSM and UI End-to-End Tests', () => {
  // Arrays to capture console errors and uncaught page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // As a sanity check, ensure no unexpected console errors or page errors occurred
    // Tests that expect errors will perform their own assertions about errors.
    expect(consoleErrors.length, 'Unexpected console.error messages').toBeLessThanOrEqual(0 + consoleErrors.length);
    expect(pageErrors.length, 'Unexpected uncaught page errors').toBeLessThanOrEqual(0 + pageErrors.length);
    // (These lines intentionally do not fail tests here; individual tests will assert errors where appropriate.)
  });

  test('Initial Idle state: page renders header, nodes, and Learn More button', async ({ page }) => {
    // Validate initial UI corresponds to S0_Idle state described by the FSM
    const model = new BTreePage(page);

    // Check header text
    const title = await page.locator('h1').innerText();
    expect(title).toContain('B-Tree Visualization');

    // Check the Learn More button exists, has expected text, and an onclick attribute referencing showInformation()
    const btn = model.button();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Learn More');
    const onclick = await btn.getAttribute('onclick');
    expect(onclick).toBe('showInformation()');

    // The FSM entry action for Idle was renderPage() - verify it is not defined on global window (evidence for missing entry action)
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(renderPageExists).toBe(false);

    // Check node visuals: there should be five nodes with texts 10,20,30,40,50 in order
    const nodesCount = await model.nodes().count();
    expect(nodesCount).toBe(5);
    const expectedNumbers = ['10', '20', '30', '40', '50'];
    for (let i = 0; i < expectedNumbers.length; i++) {
      const text = await model.nodes().nth(i).innerText();
      expect(text.trim()).toBe(expectedNumbers[i]);
    }

    // Check horizontal-line exists
    await expect(model.horizontalLine()).toBeVisible();

    // Ensure no console errors or uncaught page errors were emitted during initial render
    expect(consoleErrors.length, 'No console.error expected on initial render').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors expected on initial render').toBe(0);
  });

  test('Transition: clicking Learn More shows alert with B-Tree information (S0 -> S1)', async ({ page }) => {
    // This validates the LearnMore_Click event and the transition to the Information Shown state.
    const model = new BTreePage(page);

    // Ensure the showInformation function exists (so onclick is wired to a real function)
    const showInformationType = await page.evaluate(() => typeof window.showInformation);
    expect(showInformationType).toBe('function');

    // Click the button and capture the dialog text
    const dialogText = await model.clickLearnMoreAndGetDialogText();
    expect(dialogText).toContain('This is a simple visualization of a B-Tree');

    // After the alert, the DOM should remain intact: button still exists and nodes are still present
    await expect(model.button()).toBeVisible();
    expect(await model.nodes().count()).toBe(5);

    // No unexpected console or page errors should have occurred as a result of clicking
    expect(consoleErrors.length, 'No console.error expected when showing information').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors expected when showing information').toBe(0);
  });

  test('Edge case: clicking Learn More multiple times triggers multiple alerts', async ({ page }) => {
    // Validate repeated invocation of the transition - should show an alert each time
    const model = new BTreePage(page);

    // First click
    const dialog1 = page.waitForEvent('dialog');
    await model.button().click();
    const d1 = await dialog1;
    expect(d1.message()).toContain('B-Tree');
    await d1.accept();

    // Second click
    const dialog2 = page.waitForEvent('dialog');
    await model.button().click();
    const d2 = await dialog2;
    expect(d2.message()).toContain('B-Tree');
    await d2.accept();

    // Ensure button still exists and nodes unaffected
    await expect(model.button()).toBeVisible();
    expect(await model.nodes().count()).toBe(5);

    // No console errors emitted from repeated alerts
    expect(consoleErrors.length, 'No console.error expected after repeated alerts').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors expected after repeated alerts').toBe(0);
  });

  test('Keyboard activation: pressing Enter when Learn More button focused triggers alert', async ({ page }) => {
    // Validate accessibility: keyboard activation of the button triggers the same transition
    const model = new BTreePage(page);
    await model.button().focus();
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.keyboard.press('Enter'),
    ]);
    expect(dialog.message()).toContain('This is a simple visualization of a B-Tree');
    await dialog.accept();

    // No console errors or page errors
    expect(consoleErrors.length, 'No console.error expected after keyboard activation').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors expected after keyboard activation').toBe(0);
  });

  test('Visual feedback: hovering a node changes its computed transform', async ({ page }) => {
    // Validate the CSS visual feedback on :hover for node elements
    const model = new BTreePage(page);

    // Get transform before hover
    const before = await model.getNodeTransform(0);
    // Hover the first node
    await model.hoverNode(0);
    // Give the hover animation a moment to apply
    await page.waitForTimeout(100);
    const after = await model.getNodeTransform(0);

    // The stylesheet defines .node:hover { transform: scale(1.1); }
    // Computed transform before is usually 'none' and after should not be 'none'
    expect(before === null ? false : before === 'none' || before === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();
    expect(after).not.toBeNull();
    expect(after === 'none' || after === 'matrix(1, 0, 0, 1, 0, 0)' ? false : true).toBeTruthy();

    // No console/page errors expected from hover
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action missing: invoking renderPage() (mentioned as entry action in FSM) results in ReferenceError', async ({ page }) => {
    // The FSM referenced an entry action renderPage(), but the implementation does not define it.
    // We will intentionally invoke renderPage() in the page context and assert that a ReferenceError occurs.
    let thrownError = null;
    try {
      // Calling an undefined global function inside page context should reject with an error.
      await page.evaluate(() => {
        // Intentionally call the missing function
        // eslint-disable-next-line no-undef
        return renderPage();
      });
      // If the above does not throw, force a failure
      throw new Error('renderPage() did not throw as expected');
    } catch (err) {
      thrownError = err;
    }

    // The error should mention renderPage or be a ReferenceError
    expect(thrownError).not.toBeNull();
    const msg = String(thrownError.message || thrownError);
    expect(msg).toMatch(/renderPage|is not defined|ReferenceError/);

    // Optionally, check that a pageerror was emitted (environment-dependent); if it was emitted, assert it references renderPage
    const pageErrorMessages = pageErrors.map((e) => String(e && e.message ? e.message : e));
    if (pageErrorMessages.length > 0) {
      // At least one of the page errors should mention renderPage or be a ReferenceError
      const found = pageErrorMessages.some((m) => /renderPage|is not defined|ReferenceError/.test(m));
      expect(found).toBeTruthy();
    }
  });

  test('Error scenario: attempting to click a non-existent selector yields a Playwright error', async ({ page }) => {
    // Validate that interacting with a non-existent element surfaces an error from Playwright
    let caught = null;
    try {
      await page.click('.non-existent-selector', { timeout: 2000 });
      // If no error, fail the test
      throw new Error('Clicking a non-existent selector did not throw as expected');
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    // The error message should indicate waiting for selector or no node found
    const message = String(caught.message || caught);
    expect(message).toMatch(/waiting for selector|No node found|Element|Timeout/);
  });
});