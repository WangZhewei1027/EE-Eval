import { test, expect } from '@playwright/test';

// Test file: d8374e70-fa7b-11f0-b314-ad8654ee5de8.spec.js
// Application URL (served by the test environment)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8374e70-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the interactive page
class SpaceComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.revealBtn = page.locator('#revealBtn');
    this.refDiv = page.locator('#refDiv');
    this.refTableRows = page.locator('#refDiv table.small-table tbody tr');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getButtonText() {
    return (await this.revealBtn.textContent())?.trim();
  }

  async isRefDivDisplayed() {
    // evaluate computed style to be robust
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      // prefer computed style since inline style could be not set in some browsers
      return window.getComputedStyle(el).display !== 'none';
    }, '#refDiv');
  }

  async getRefDivDisplayValue() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.style.display : null;
    }, '#refDiv');
  }

  async clickReveal() {
    await this.revealBtn.click();
  }

  async countReferenceRows() {
    return await this.refTableRows.count();
  }
}

// Helper to attach console and pageerror listeners and capture events for assertions
function registerErrorCollectors(page) {
  const consoleMessages = [];
  const consoleErrors = [];
  const pageErrors = [];

  const consoleHandler = (msg) => {
    // capture all console messages for diagnostics; keep error-level separately
    consoleMessages.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  };

  const pageErrorHandler = (err) => {
    // uncaught exceptions on the page
    pageErrors.push(err && err.message ? err.message : String(err));
  };

  page.on('console', consoleHandler);
  page.on('pageerror', pageErrorHandler);

  return {
    getConsoleMessages: () => consoleMessages,
    getConsoleErrors: () => consoleErrors,
    getPageErrors: () => pageErrors,
    dispose: () => {
      page.removeListener('console', consoleHandler);
      page.removeListener('pageerror', pageErrorHandler);
    },
  };
}

test.describe('Space Complexity — Concise Reference Table interaction (FSM validation)', () => {
  // We'll reuse a fresh page object per test to avoid test bleed
  test('Initial state S0_Idle: button visible and reference table hidden', async ({ page }) => {
    // Attach collectors to observe runtime console and page errors
    const collectors = registerErrorCollectors(page);

    const p = new SpaceComplexityPage(page);
    await p.goto();

    // Validate initial button presence and text (FSM evidence)
    await expect(p.revealBtn).toBeVisible({ timeout: 2000 });
    const initialText = await p.getButtonText();
    expect(initialText).toBe('Reveal concise reference table');

    // Validate reference div is present in DOM but hidden (style.display === 'none')
    await expect(p.refDiv).toBeAttached();
    const displayed = await p.isRefDivDisplayed();
    expect(displayed).toBe(false);
    const inlineDisplay = await p.getRefDivDisplayValue();
    // Implementation sets style="display:none" initially; check inline style value
    expect(inlineDisplay === 'none' || inlineDisplay === 'none').toBeTruthy();

    // Ensure no runtime page errors or console.error occurred during load
    // (We observe the runtime and assert there are no severe errors)
    expect(collectors.getConsoleErrors()).toEqual([]);
    expect(collectors.getPageErrors()).toEqual([]);

    collectors.dispose();
  });

  test('Transition S0_Idle -> S1_ReferenceVisible: clicking reveal shows table and updates button text', async ({ page }) => {
    const collectors = registerErrorCollectors(page);

    const p = new SpaceComplexityPage(page);
    await p.goto();

    // Click the reveal button to trigger the "RevealReferenceTable" event
    await p.clickReveal();

    // After click, the FSM expects refDiv.style.display = 'block' and button text updated
    // Use computed style check for visibility
    await expect.poll(async () => await p.isRefDivDisplayed(), {
      message: 'refDiv should be visible after first click',
    }).toBeTruthy();

    const btnText = await p.getButtonText();
    expect(btnText).toBe('Hide concise reference table');

    // Also verify inline style changed to 'block' as mentioned by entry action evidence
    const inlineDisplay = await p.getRefDivDisplayValue();
    expect(inlineDisplay === 'block' || inlineDisplay === 'block').toBeTruthy();

    // Verify the reference table is present and contains the expected number of rows (14 rows expected)
    const rowCount = await p.countReferenceRows();
    expect(rowCount).toBe(14);

    // Ensure no runtime console errors or page errors occurred during the interaction
    expect(collectors.getConsoleErrors()).toEqual([]);
    expect(collectors.getPageErrors()).toEqual([]);

    collectors.dispose();
  });

  test('Transition S1_ReferenceVisible -> S0_Idle: clicking again hides table and restores button text', async ({ page }) => {
    const collectors = registerErrorCollectors(page);

    const p = new SpaceComplexityPage(page);
    await p.goto();

    // First click to show
    await p.clickReveal();
    await expect.poll(async () => await p.isRefDivDisplayed()).toBeTruthy();

    // Second click to hide (toggle back)
    await p.clickReveal();

    // After second click, refDiv should be hidden again and button text reset
    await expect.poll(async () => await p.isRefDivDisplayed()).toBe(false);

    const btnTextAfter = await p.getButtonText();
    expect(btnTextAfter).toBe('Reveal concise reference table');

    // Inline style should be 'none' again
    const inlineDisplay = await p.getRefDivDisplayValue();
    expect(inlineDisplay === 'none' || inlineDisplay === 'none').toBeTruthy();

    // Ensure no runtime console errors or page errors occurred during the interactions
    expect(collectors.getConsoleErrors()).toEqual([]);
    expect(collectors.getPageErrors()).toEqual([]);

    collectors.dispose();
  });

  test('Rapid toggles (edge case): multiple quick clicks maintain consistent toggling behavior', async ({ page }) => {
    const collectors = registerErrorCollectors(page);

    const p = new SpaceComplexityPage(page);
    await p.goto();

    // Rapidly click the button several times
    // We will click 5 times and then assert final state corresponds to odd/even count
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      await p.revealBtn.click();
    }

    // After 5 clicks (odd), the table should be visible
    const isVisible = await p.isRefDivDisplayed();
    expect(isVisible).toBe(true);

    const btnText = await p.getButtonText();
    expect(btnText).toBe('Hide concise reference table');

    // Now click one more time to return to hidden state
    await p.revealBtn.click();
    await expect.poll(async () => await p.isRefDivDisplayed()).toBe(false);

    // Final button text should be original
    expect(await p.getButtonText()).toBe('Reveal concise reference table');

    // Confirm table row count still correct when visible (show again and inspect)
    await p.revealBtn.click();
    await expect.poll(async () => await p.isRefDivDisplayed()).toBeTruthy();
    expect(await p.countReferenceRows()).toBe(14);

    // Ensure no runtime console errors or page errors throughout these rapid interactions
    expect(collectors.getConsoleErrors()).toEqual([]);
    expect(collectors.getPageErrors()).toEqual([]);

    collectors.dispose();
  });

  test('Non-interaction sanity checks and DOM integrity: other elements unaffected', async ({ page }) => {
    const collectors = registerErrorCollectors(page);

    const p = new SpaceComplexityPage(page);
    await p.goto();

    // Ensure multiple other sections and headings exist and are not removed by interaction
    const headings = page.locator('main.container h2');
    // Expect at least the documented 11 headings (sections 1..11)
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThanOrEqual(11);

    // Ensure clicking the reveal button does not remove other sections
    await p.clickReveal();
    await expect(page.locator('#how-to-measure')).toBeVisible();
    await expect(page.locator('#models')).toBeVisible();
    await expect(page.locator('#worked-examples')).toBeVisible();

    // Validate that no JavaScript runtime errors were thrown while manipulating DOM
    expect(collectors.getConsoleErrors()).toEqual([]);
    expect(collectors.getPageErrors()).toEqual([]);

    collectors.dispose();
  });

  test('Observe page console output and page errors across lifecycle (diagnostic test)', async ({ page }) => {
    // This test intentionally collects any console message and page errors emitted during a typical session.
    const collectors = registerErrorCollectors(page);

    const p = new SpaceComplexityPage(page);
    await p.goto();

    // Perform interactions: show, hide, show
    await p.clickReveal();
    await p.clickReveal();
    await p.clickReveal();

    // At this point we expect no uncaught exceptions or console.error calls from the provided script.
    // Assert that there are no page errors recorded.
    const pageErrors = collectors.getPageErrors();
    const consoleErrors = collectors.getConsoleErrors();

    // We assert that the environment behaved without raising ReferenceError, SyntaxError, TypeError, or other uncaught exceptions.
    // If any did occur, include diagnostic info in test failure message.
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`).toEqual([]);

    // Optionally, validate that some benign console messages (like info/debug) may exist, but we don't rely on them.
    const allConsole = collectors.getConsoleMessages();
    // Sanity: there should be at least zero console messages, but we don't assert a minimum.
    expect(Array.isArray(allConsole)).toBeTruthy();

    collectors.dispose();
  });
});