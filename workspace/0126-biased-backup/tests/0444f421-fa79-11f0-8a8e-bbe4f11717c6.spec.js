import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0444f421-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object Model for the Decision Trees page
class DecisionTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Show Tree button (uses onclick="showTree()")
  async clickShow() {
    return this.page.click("button[onclick='showTree()']");
  }

  // Click the Hide Tree button (uses onclick="hideTree()")
  async clickHide() {
    return this.page.click("button[onclick='hideTree()']");
  }

  // Return the locator for the graph element (note: implementation uses class, script expects id)
  graphLocator() {
    return this.page.locator('.graph');
  }

  // Return the inline style value for display of the .graph element
  async graphDisplayStyle() {
    return this.page.$eval('.graph', el => {
      // return computed and inline style for clarity
      return {
        inlineDisplay: el.style.display || '',
        computedDisplay: window.getComputedStyle(el).display
      };
    });
  }
}

test.describe('Decision Trees - FSM states & transitions (0444f421-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Arrays to capture page errors and console error messages for assertions
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture runtime uncaught errors (pageerror)
    page.on('pageerror', (err) => {
      // Store the Error object for later inspection
      pageErrors.push(err);
    });

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // brief cleanup: navigate away to ensure no leftover timers/handlers
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore navigation errors during teardown
    }
  });

  // Helper to wait until at least expectedCount page errors have been captured or timeout
  async function waitForPageErrors(expectedCount, timeout = 1000) {
    const pollInterval = 20;
    const maxTries = Math.ceil(timeout / pollInterval);
    let tries = 0;
    while (pageErrors.length < expectedCount && tries < maxTries) {
      await new Promise(r => setTimeout(r, pollInterval));
      tries++;
    }
  }

  test('Initial state: graph element exists and is visible by default (S1_Shown expectation check)', async ({ page }) => {
    // Verifies initial DOM state before interactions
    const dtPage = new DecisionTreePage(page);
    await dtPage.goto();

    // Ensure the .graph element is present in DOM
    const graphCount = await page.locator('.graph').count();
    expect(graphCount).toBeGreaterThan(0);

    // The implementation's script expects an element with id="graph" (but the DOM uses class="graph").
    // We assert presence of the class-based element and its computed visibility.
    const styles = await dtPage.graphDisplayStyle();
    // Computed display should not be 'none' in the provided HTML (visible by default).
    expect(styles.computedDisplay).not.toBe('none');

    // No runtime errors should have occurred just by loading the page (functions defined but not executed)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ShowTree event triggers a runtime error due to implementation mismatch and does NOT hide/show the actual .graph element (S0_Hidden -> S1_Shown transition attempt)', async ({ page }) => {
    // This test exercises the Show Tree button click which calls showTree().
    // The page's script uses document.getElementById("graph") but the element has class="graph" (no id).
    // That results in a TypeError when attempting to access .style on null. We must let that error occur naturally and assert it.
    const dtPage = new DecisionTreePage(page);
    await dtPage.goto();

    // Sanity: confirm onclick attribute exists on the Show button
    const showButton = page.locator("button[onclick='showTree()']");
    await expect(showButton).toHaveCount(1);

    // Click the Show Tree button and wait briefly for the runtime error to surface
    await dtPage.clickShow();

    // Wait for at least one pageerror to be emitted
    await waitForPageErrors(1, 1000);

    // Assert that a page error occurred
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Assert that the captured error message indicates a null reference / property access issue.
    // Different engines produce different messages; check for common substrings.
    const messages = pageErrors.map(e => String(e && e.message ? e.message : e));
    const matched = messages.some(m => /cannot read|cannot set|reading|of null|null/.test(m.toLowerCase()));
    expect(matched).toBeTruthy();

    // The actual .graph element in the DOM should remain visible (since the script failed to change it)
    const stylesAfter = await dtPage.graphDisplayStyle();
    expect(stylesAfter.computedDisplay).not.toBe('none');

    // Also assert that the console captured at least one error message (depends on browser)
    // We don't require consoleErrors to be non-empty on all engines, but if present, they should reference showTree/hideTree or null
    if (consoleErrors.length > 0) {
      const found = consoleErrors.some(c => /showTree|hideTree|null|cannot read|of null|reading/i.test(c.text));
      expect(found).toBeTruthy();
    }
  });

  test('HideTree event triggers a runtime error due to implementation mismatch and does NOT hide the actual .graph element (S1_Shown -> S0_Hidden transition attempt)', async ({ page }) => {
    // This test exercises the Hide Tree button click which calls hideTree().
    // As with showTree(), hideTree() attempts to access document.getElementById("graph") and will throw.
    const dtPage = new DecisionTreePage(page);
    await dtPage.goto();

    // Confirm onclick attribute exists on the Hide button
    const hideButton = page.locator("button[onclick='hideTree()']");
    await expect(hideButton).toHaveCount(1);

    // Click the Hide Tree button
    await dtPage.clickHide();

    // Wait for at least one pageerror to be emitted
    await waitForPageErrors(1, 1000);

    // Assert that a page error occurred
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Assert the message suggests a null/ref error
    const messages = pageErrors.map(e => String(e && e.message ? e.message : e));
    const matched = messages.some(m => /cannot read|cannot set|reading|of null|null/.test(m.toLowerCase()));
    expect(matched).toBeTruthy();

    // Assert that the .graph element remains visible (script failed)
    const stylesAfter = await dtPage.graphDisplayStyle();
    expect(stylesAfter.computedDisplay).not.toBe('none');
  });

  test('Sequence: Show then Hide clicks produce errors for both handlers and errors accumulate (S0_Hidden <-> S1_Shown attempts)', async ({ page }) => {
    // This test clicks Show and Hide in sequence and asserts errors for each call.
    const dtPage = new DecisionTreePage(page);
    await dtPage.goto();

    // Ensure starting with no errors
    expect(pageErrors.length).toBe(0);

    // Click Show
    await dtPage.clickShow();
    await waitForPageErrors(1, 1000);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Click Hide
    await dtPage.clickHide();
    // Wait for a second error to be added
    await waitForPageErrors(2, 1000);
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);

    // Collect all messages and ensure at least one message for each attempted handler invocation
    const msgs = pageErrors.map(e => (e && e.message) ? String(e.message) : String(e));
    // At least two errors captured
    expect(msgs.length).toBeGreaterThanOrEqual(2);

    // The .graph element should still be visible after both failed attempts
    const styles = await dtPage.graphDisplayStyle();
    expect(styles.computedDisplay).not.toBe('none');
  });

  test('Edge case: rapid multiple clicks on Show and Hide accumulate multiple runtime errors (robustness of error handling)', async ({ page }) => {
    // Rapidly click Show and Hide multiple times to ensure multiple errors are observed and nothing breaks the page beyond expected errors.
    const dtPage = new DecisionTreePage(page);
    await dtPage.goto();

    // Click sequence rapidly
    const clicks = [
      dtPage.clickShow(),
      dtPage.clickHide(),
      dtPage.clickShow(),
      dtPage.clickHide()
    ];

    // Fire clicks concurrently (rapid user clicks)
    await Promise.allSettled(clicks);

    // Wait for multiple errors to be captured (expect at least 2, likely 4)
    await waitForPageErrors(2, 1500);

    expect(pageErrors.length).toBeGreaterThanOrEqual(2);

    // Ensure the page is still interactive: the buttons still exist and are clickable (even if handlers throw)
    await expect(page.locator("button[onclick='showTree()']")).toHaveCount(1);
    await expect(page.locator("button[onclick='hideTree()']")).toHaveCount(1);

    // The DOM's .graph element remains present and visible
    const styles = await dtPage.graphDisplayStyle();
    expect(styles.computedDisplay).not.toBe('none');
  });

  test('Sanity check: onclick attributes exist for both buttons as described by FSM components', async ({ page }) => {
    // Validate that the DOM contains the event handler attributes referenced in the FSM.
    await new DecisionTreePage(page).goto();

    // Both buttons should exist and have onclick attributes matching the FSM extraction evidence.
    const show = page.locator("button[onclick='showTree()']");
    const hide = page.locator("button[onclick='hideTree()']");

    await expect(show).toHaveCount(1);
    await expect(hide).toHaveCount(1);

    // Verify button text content matches expected labels
    await expect(show).toHaveText(/Show Tree/i);
    await expect(hide).toHaveText(/Hide Tree/i);
  });
});