import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d2d72-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object encapsulating interactions and observability for the Trie Visualization app
class TriePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // capture arrays for diagnostics
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.pageErrors = [];
    this.dialogs = [];

    // Bind handlers early so we capture events that happen during navigation
    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') this.consoleErrors.push(text);
      if (type === 'warning') this.consoleWarnings.push(text);
    });

    this.page.on('pageerror', (err) => {
      // pageerror is for uncaught exceptions
      this.pageErrors.push(String(err && err.message ? err.message : err));
    });

    this.page.on('dialog', async (dialog) => {
      // Record dialog message and accept to allow page script to continue execution
      try {
        this.dialogs.push(dialog.message());
        await dialog.accept();
      } catch (e) {
        // If accepting fails, still record the error in pageErrors for assertions
        this.pageErrors.push(`Dialog handling failed: ${String(e)}`);
      }
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getButton() {
    return this.page.locator('.button');
  }

  async clickVisualize() {
    const btn = await this.getButton();
    await btn.click();
    // Give the page a short moment to process all event handlers and dialogs
    await this.page.waitForTimeout(100);
  }

  // helper to reset captured dialogs/errors between steps/tests
  resetCaptured() {
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.pageErrors = [];
    this.dialogs = [];
  }
}

test.describe('Trie Visualization - FSM driven end-to-end tests', () => {
  // Shared page object per test
  let trie;

  test.beforeEach(async ({ page }) => {
    trie = new TriePage(page);
    // Navigate to the application page for each test
    await trie.goto();
  });

  test.afterEach(async () => {
    // nothing to tear down explicitly; Playwright will close contexts
  });

  test('S0_Idle: initial render shows expected DOM components and attributes', async ({ page }) => {
    // Validate initial Idle state as described in the FSM
    // - Entry action: renderPage() is listed in FSM but not implemented in the page.
    //   Assert that no global renderPage function exists (we do not patch the app)
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // If renderPage were expected to run, it would exist; here we assert it is not defined.
    expect(renderPageExists).toBe(false);

    // Check the main title is present
    const title = page.locator('h1');
    await expect(title).toHaveText('Trie Visualization');

    // Check the trie container and nodes/edges exist
    const container = page.locator('.trie-container');
    await expect(container).toBeVisible();

    const nodes = container.locator('.node');
    const edges = container.locator('.edge');

    // There are multiple nodes and edges per the HTML
    await expect(nodes).toHaveCountGreaterThan(0);
    await expect(edges).toHaveCountGreaterThan(0);

    // Validate that the Visualize button exists, has the correct visible text and the inline onclick attribute
    const button = await trie.getButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Visualize');

    // Check inline onclick attribute exactly as in the HTML implementation
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toContain("alert('Visualizing Trie...')");

    // Ensure no runtime console errors or page errors have been captured on load
    expect(trie.consoleErrors).toEqual([]);
    expect(trie.pageErrors).toEqual([]);
  });

  test('ButtonClick event: clicking Visualize triggers alerts and transitions to Visualizing state', async ({ page }) => {
    // This test validates the ButtonClick event and the transition from S0_Idle -> S1_Visualizing
    // FSM expects an alert with "Meet the Trie data structure!" on entering S1_Visualizing,
    // and the button has an inline onclick alert "Visualizing Trie..." as well.
    trie.resetCaptured();

    // Click the button and let dialog handler capture the alerts (the page.on('dialog') in the PO handles acceptance)
    await trie.clickVisualize();

    // Wait briefly to ensure any queued dialogs were handled
    await page.waitForTimeout(100);

    // At least one dialog must have appeared (the visualizing alert or the meet-the-trie alert)
    expect(trie.dialogs.length).toBeGreaterThanOrEqual(1);

    // Assert that the FSM-expected message "Meet the Trie data structure!" was observed
    // and also assert the inline 'Visualizing Trie...' alert was observed.
    // The page registers both an inline onclick and an addEventListener handler; both should fire.
    const sawMeetMessage = trie.dialogs.some((m) => m.includes('Meet the Trie data structure!'));
    const sawVisualizingMessage = trie.dialogs.some((m) => m.includes('Visualizing Trie...'));

    expect(sawMeetMessage).toBeTruthy(); // Required by FSM transition evidence
    expect(sawVisualizingMessage).toBeTruthy(); // Evidence of inline attribute

    // Ensure no JavaScript runtime errors were emitted during the click/alerts
    expect(trie.consoleErrors).toEqual([]);
    expect(trie.pageErrors).toEqual([]);
  });

  test('Multiple clicks produce repeated alerts (robustness / edge case)', async ({ page }) => {
    // Validate repeated interactions: clicking multiple times should repeat the behavior
    trie.resetCaptured();

    // Click twice
    await trie.clickVisualize();
    await trie.clickVisualize();

    // Allow time for dialogs/handlers
    await page.waitForTimeout(200);

    // Per click, HTML adds two alert handlers (inline + event listener), so for 2 clicks expect 4 dialogs.
    // We will assert at least 2 (one per click) and check that expected messages appear multiple times.
    expect(trie.dialogs.length).toBeGreaterThanOrEqual(2);

    // Count occurrences
    const meetCount = trie.dialogs.filter((m) => m.includes('Meet the Trie data structure!')).length;
    const visualizingCount = trie.dialogs.filter((m) => m.includes('Visualizing Trie...')).length;

    // Since both handlers are registered, expect both messages to appear at least once and usually equal to number of clicks
    expect(meetCount).toBeGreaterThanOrEqual(1);
    expect(visualizingCount).toBeGreaterThanOrEqual(1);

    // For robustness, ensure no console/page errors
    expect(trie.consoleErrors).toEqual([]);
    expect(trie.pageErrors).toEqual([]);
  });

  test('Edge case: clicking a non-existent element yields a Playwright error (error scenario)', async ({ page }) => {
    // This test intentionally attempts to click a selector that does not exist to validate error handling.
    // We do not modify the page or global environment - we only assert the failure occurs naturally.
    let threw = false;
    try {
      await page.click('.non-existent-button', { timeout: 500 });
    } catch (err) {
      threw = true;
      // Expect Playwright to throw a TimeoutError / ElementHandle error when the selector is not found
      expect(String(err)).toContain('Timeout');
    }
    expect(threw).toBe(true);
  });

  test('Verify that S1_Visualizing entry action manifests as an alert (explicit verification)', async ({ page }) => {
    // Ensure S1 entry action (alert('Meet the Trie data structure!')) is observable when the event occurs.
    trie.resetCaptured();

    // Trigger the event
    await trie.clickVisualize();

    // Wait to ensure dialogs handled
    await page.waitForTimeout(100);

    // Confirm presence of the S1 alert
    const sawMeetMessage = trie.dialogs.some((m) => m === 'Meet the Trie data structure!');
    expect(sawMeetMessage).toBeTruthy();

    // Also assert that there were no uncaught exceptions emitted to the console while performing this transition
    expect(trie.consoleErrors).toEqual([]);
    expect(trie.pageErrors).toEqual([]);
  });

  test('Sanity: verify visual styling hints exist (non-functional DOM checks)', async ({ page }) => {
    // Check a few style-related attributes to validate visual feedback described in the HTML (non-interactive)
    const node = page.locator('.node').first();
    await expect(node).toBeVisible();

    // Verify CSS properties are present via computed style (we do not depend on exact pixels)
    const bgColor = await node.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(typeof bgColor).toBe('string');
    expect(bgColor.length).toBeGreaterThan(0);

    // Ensure button hover style exists in CSS by checking that style rule is in the sheet (best-effort)
    const hasButtonClass = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && rule.selectorText.includes('.button:hover')) return true;
          }
        } catch (e) {
          // Some sheets may be cross-origin and not accessible; ignore those
        }
      }
      return false;
    });
    // Not asserting strict requirement, but expecting styling to be present per implementation
    expect(hasButtonClass).toBeTruthy();
  });
});