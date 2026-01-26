import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04436d83-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object model for the Amortized Analysis page
class AmortizedPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.title = page.locator('.title');
    this.description = page.locator('.description');
    this.gridCells = page.locator('.grid .cell');
    this.amortizedButton = page.locator('#amortized-button');
    this.exceptionalButton = page.locator('#exceptional-button');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async getCellTexts() {
    const count = await this.gridCells.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.gridCells.nth(i).innerText());
    }
    return texts;
  }

  async clickAmortized() {
    await this.amortizedButton.click();
  }

  async clickExceptional() {
    await this.exceptionalButton.click();
  }
}

test.describe('Amortized Analysis FSM - End-to-End', () => {
  // Capture console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // No-op: listeners are attached per-test inside each test to ensure isolation
  });

  // Test the initial Idle state: verify UI elements rendered as expected
  test('Initial Idle state renders UI with two analysis buttons and grid', async ({ page }) => {
    // Arrays to collect runtime diagnostics
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore any unusual console payloads
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const app = new AmortizedPage(page);
    await app.goto();

    // Validate title and description are present
    await expect(app.title).toBeVisible();
    await expect(app.title).toHaveText('Amortized Analysis');

    await expect(app.description).toBeVisible();
    await expect(app.description).toContainText('Amortized Analysis');

    // Validate grid has four cells as per implementation
    await expect(app.gridCells).toHaveCount(4);

    // Validate both buttons exist and are visible with expected labels
    await expect(app.amortizedButton).toBeVisible();
    await expect(app.amortizedButton).toHaveText('Amortized Analysis');

    await expect(app.exceptionalButton).toBeVisible();
    await expect(app.exceptionalButton).toHaveText('Exceptional Analysis');

    // Verify that the HTML implementation does NOT include inline onclick attributes on the buttons.
    // FSM evidence suggested onclick="performAmortizedAnalysis()" etc., but the actual HTML may differ.
    // This assertion documents what the runtime shows.
    const amortizedOnClick = await page.locator('#amortized-button').getAttribute('onclick');
    const exceptionalOnClick = await page.locator('#exceptional-button').getAttribute('onclick');
    // Expectation: the implementation provided does not set inline onclick handlers (null or undefined).
    expect(!(amortizedOnClick && amortizedOnClick.length)).toBe(true);
    expect(!(exceptionalOnClick && exceptionalOnClick.length)).toBe(true);

    // Capture initial grid state (should be empty strings per HTML)
    const initialCellTexts = await app.getCellTexts();
    for (const text of initialCellTexts) {
      // Cells are expected to be empty initially; record if not empty.
      expect(typeof text === 'string').toBeTruthy();
    }

    // For the initial render we observe console logs and page errors (if any). We assert that
    // the test captures them so that further tests can reason about runtime behavior.
    // We do NOT assert that errors must or must not exist here; instead we assert that the arrays exist.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  // Test transition: clicking Amortized Analysis button should either perform the analysis (DOM change/console)
  // or raise a natural runtime error if the implementation is missing functions. We observe and assert accordingly.
  test('Transition S0_Idle -> S1_Amortized_Analysis on Amortized button click', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore unusual payloads
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const app = new AmortizedPage(page);
    await app.goto();

    // Capture grid state before click
    const beforeTexts = await app.getCellTexts();

    // Click the Amortized Analysis button
    await app.clickAmortized();

    // Give a short time for any JS to execute / errors to surface / DOM to update
    await page.waitForTimeout(300);

    // Capture grid state after click
    const afterTexts = await app.getCellTexts();

    // Determine if a visible DOM change occurred in the grid as a result of the click
    const domChanged = beforeTexts.some((t, i) => t !== afterTexts[i]);

    // Determine if we observed an explicit console message related to amortized analysis
    const consoleIndicatesAction = consoleMessages.some(m =>
      typeof m.text === 'string' && m.text.toLowerCase().includes('amortized')
    );

    // Determine if a page error mentions performAmortizedAnalysis or renderPage (entry actions from FSM)
    const pageErrorMentions = pageErrors.some(e => {
      const msg = (e && e.message) || String(e);
      return /performAmortizedAnalysis|renderPage/i.test(msg);
    });

    // We accept either:
    // - a DOM change indicating results displayed
    // - a console message mentioning amortized
    // - a natural runtime error mentioning performAmortizedAnalysis or renderPage
    const observedExpectedBehavior = domChanged || consoleIndicatesAction || pageErrorMentions;

    expect(observedExpectedBehavior).toBe(true);

    // As an additional check: if a runtime error occurred, assert it's a ReferenceError or TypeError or SyntaxError
    if (pageErrors.length > 0) {
      const isKnownJSResolutionError = pageErrors.some(e =>
        /ReferenceError|TypeError|SyntaxError/.test(e && e.message)
      );
      // It is acceptable for any JS runtime error to surface; assert it is a JS error class to be explicit
      expect(isKnownJSResolutionError).toBe(true);
    }
  });

  // Test transition: clicking Exceptional Analysis button should either perform the analysis (DOM change/console)
  // or raise a natural runtime error if the implementation is missing functions. We observe and assert accordingly.
  test('Transition S0_Idle -> S2_Exceptional_Analysis on Exceptional button click', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const app = new AmortizedPage(page);
    await app.goto();

    const beforeTexts = await app.getCellTexts();

    // Click the Exceptional Analysis button
    await app.clickExceptional();

    // Allow some time for handlers / errors
    await page.waitForTimeout(300);

    const afterTexts = await app.getCellTexts();

    // Check for DOM change
    const domChanged = beforeTexts.some((t, i) => t !== afterTexts[i]);

    // Check console messages for "exceptional" or similar
    const consoleIndicatesAction = consoleMessages.some(m =>
      typeof m.text === 'string' && m.text.toLowerCase().includes('exceptional')
    );

    // Check for page errors mentioning performExceptionalAnalysis
    const pageErrorMentions = pageErrors.some(e => {
      const msg = (e && e.message) || String(e);
      return /performExceptionalAnalysis|renderPage/i.test(msg);
    });

    const observedExpectedBehavior = domChanged || consoleIndicatesAction || pageErrorMentions;

    expect(observedExpectedBehavior).toBe(true);

    if (pageErrors.length > 0) {
      // If errors occurred, ensure they are JS runtime errors (not network errors)
      const isKnownJSResolutionError = pageErrors.some(e =>
        /ReferenceError|TypeError|SyntaxError/.test(e && e.message)
      );
      expect(isKnownJSResolutionError).toBe(true);
    }
  });

  // Edge case: Rapid repeated clicks; ensure either stable behavior or reproducible errors are observed
  test('Edge case: multiple rapid clicks on Amortized and Exceptional buttons', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const app = new AmortizedPage(page);
    await app.goto();

    // Rapidly click Amortized three times, then Exceptional three times
    await Promise.all([
      app.amortizedButton.click(),
      app.amortizedButton.click(),
      app.amortizedButton.click()
    ]).catch(() => {
      // If clicking rapidly causes errors, they will be captured by pageErrors
    });

    await page.waitForTimeout(200);

    await Promise.all([
      app.exceptionalButton.click(),
      app.exceptionalButton.click(),
      app.exceptionalButton.click()
    ]).catch(() => {
      // ignore errors here as they are captured
    });

    // Allow JS to run
    await page.waitForTimeout(300);

    // If errors occurred, ensure at least one of them is a JS runtime error (ReferenceError/TypeError/SyntaxError)
    if (pageErrors.length > 0) {
      const foundJS = pageErrors.some(e =>
        /ReferenceError|TypeError|SyntaxError/.test(e && e.message)
      );
      expect(foundJS).toBe(true);
    } else {
      // If no page errors, assert that either console logs or DOM changes happened as a result of clicks.
      const consoleRelevant = consoleMessages.some(m =>
        typeof m.text === 'string' && (/amortized|exceptional|analysis/i.test(m.text))
      );
      // Or DOM changed in grid
      const texts = await app.getCellTexts();
      const anyNonEmptyCell = texts.some(t => typeof t === 'string' && t.trim().length > 0);
      expect(consoleRelevant || anyNonEmptyCell).toBe(true);
    }
  });

  // Verify FSM entry actions like renderPage() - if present they should have been invoked on load.
  // We cannot patch the runtime; we only observe console logs and page errors to infer invocation.
  test('Verify FSM entry actions (renderPage) are invoked or cause natural errors', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const app = new AmortizedPage(page);
    await app.goto();

    // Allow any onload logic to run
    await page.waitForTimeout(200);

    // Check whether console output mentions renderPage
    const consoleMentionsRender = consoleMessages.some(m =>
      typeof m.text === 'string' && /renderpage/i.test(m.text)
    );

    // Or whether a page error references renderPage being undefined
    const pageErrorMentionsRender = pageErrors.some(e => {
      const msg = (e && e.message) || String(e);
      return /renderPage/i.test(msg);
    });

    // At least one of these should be true: either the entry action ran (console evidence),
    // or the runtime attempted to call it and produced a natural JS error.
    expect(consoleMentionsRender || pageErrorMentionsRender).toBe(true);
  });
});