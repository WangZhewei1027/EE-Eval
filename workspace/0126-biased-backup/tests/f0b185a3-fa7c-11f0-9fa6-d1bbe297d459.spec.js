import { test, expect } from '@playwright/test';

// Test file: f0b185a3-fa7c-11f0-9fa6-d1bbe297d459.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/f0b185a3-fa7c-11f0-9fa6-d1bbe297d459.html

// Page object model for the demo controls and observables
class RBTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = page.locator('#demo-btn');
    this.insertionDemo = page.locator('#insertion-demo');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/f0b185a3-fa7c-11f0-9fa6-d1bbe297d459.html', { waitUntil: 'domcontentloaded' });
  }

  async getButtonText() {
    return (await this.demoBtn.textContent())?.trim();
  }

  async isDemoHidden() {
    // Use DOM classList (we do not alter page). This inspects the class attribute.
    return await this.page.evaluate(() => {
      const el = document.getElementById('insertion-demo');
      if (!el) return null;
      return el.classList.contains('hidden');
    });
  }

  async clickDemoButton() {
    await this.demoBtn.click();
  }

  async demoIsVisibleByPlaywright() {
    return await this.insertionDemo.isVisible();
  }

  async getDemoInnerText() {
    return (await this.insertionDemo.textContent())?.trim();
  }
}

test.describe('Red-Black Tree Insertion Demo - FSM validation', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages;
  let errorConsoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    errorConsoleMessages = [];
    pageErrors = [];

    // Listen to all console events
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });
      // Capture error-type console messages separately for assertions
      if (type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(text)) {
        errorConsoleMessages.push({ type, text });
      }
    });

    // Listen for uncaught exceptions on the page
    page.on('pageerror', err => {
      // err is an Error object; capture stack/message
      pageErrors.push(err);
    });

    // Navigate to the page under test
    const rbt = new RBTPage(page);
    await rbt.goto();
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught page errors or console errors.
    // We observe console logs and errors but do not modify the page. If any occurred,
    // the assertions below will fail and expose the captured diagnostics.
    expect(pageErrors.length, `Expected no uncaught page errors. Found: ${pageErrors.length}. Examples: ${pageErrors.slice(0,3).map(e => e.message).join(' | ')}`).toBe(0);
    expect(errorConsoleMessages.length, `Expected no console.error/JS error messages. Found: ${errorConsoleMessages.length}. Examples: ${errorConsoleMessages.slice(0,3).map(m => m.text).join(' | ')}`).toBe(0);

    // Additionally assert that there are some console messages (optional) to confirm we observed activity,
    // but do not require them. If none exist, we still succeed.
  });

  test('Initial state S0_Idle - button text and insertion demo hidden', async ({ page }) => {
    // This test validates the Idle state described in the FSM:
    // - #demo-btn exists and reads "Show Insertion Demo"
    // - #insertion-demo exists and has class "hidden" (not visible)
    const rbt = new RBTPage(page);

    // Verify button text is exactly as FSM evidence
    const btnText = await rbt.getButtonText();
    expect(btnText).toBe('Show Insertion Demo');

    // Verify insertion-demo has the 'hidden' class via classList inspection
    const hiddenClass = await rbt.isDemoHidden();
    expect(hiddenClass).toBe(true);

    // Playwright visibility API should indicate hidden
    await expect(rbt.insertionDemo).toBeHidden();

    // Sanity: the demo container should contain the expected explanatory heading
    const demoText = await rbt.getDemoInnerText();
    expect(demoText).toContain('Inserting value 5');
  });

  test('Transition S0 -> S1 when clicking #demo-btn: demo becomes visible and button text toggles', async ({ page }) => {
    // This test validates the ShowInsertionDemo event and the transition to S1_DemoVisible:
    // - Clicking the button removes the 'hidden' class from #insertion-demo
    // - Button text changes to 'Hide Insertion Demo'
    const rbt = new RBTPage(page);

    // Precondition sanity checks
    expect(await rbt.getButtonText()).toBe('Show Insertion Demo');
    expect(await rbt.isDemoHidden()).toBe(true);

    // Trigger the event
    await rbt.clickDemoButton();

    // After clicking, the demo should no longer have the 'hidden' class
    const hiddenAfter = await rbt.isDemoHidden();
    expect(hiddenAfter).toBe(false);

    // Playwright should report it visible
    await expect(rbt.insertionDemo).toBeVisible();

    // Button text should have updated to 'Hide Insertion Demo'
    expect(await rbt.getButtonText()).toBe('Hide Insertion Demo');

    // Verify that the demo content remains intact (ensuring DOM content didn't break)
    expect(await rbt.getDemoInnerText()).toContain('1. BST insertion would place 5 as left child of 6');
  });

  test('Transition S1 -> S0 when clicking #demo-btn again: demo hides and button text toggles back', async ({ page }) => {
    // This test validates the HideInsertionDemo event and the transition back to Idle:
    // - Clicking while visible will add the 'hidden' class back and set button text to 'Show Insertion Demo'
    const rbt = new RBTPage(page);

    // Ensure we start by showing the demo (move into S1)
    await rbt.clickDemoButton();
    await expect(rbt.insertionDemo).toBeVisible();
    expect(await rbt.getButtonText()).toBe('Hide Insertion Demo');

    // Now click to hide
    await rbt.clickDemoButton();

    // After clicking, the 'hidden' class should be present
    const hiddenAfter = await rbt.isDemoHidden();
    expect(hiddenAfter).toBe(true);

    // Playwright visibility check
    await expect(rbt.insertionDemo).toBeHidden();

    // Button text should revert to 'Show Insertion Demo'
    expect(await rbt.getButtonText()).toBe('Show Insertion Demo');
  });

  test('Edge cases: rapid toggling, idempotent behavior, and repeated clicks', async ({ page }) => {
    // This test validates edge-case interactions:
    // - Repeated rapid clicks toggle consistently (state should flip each click)
    // - Clicking when already in desired state performs the expected toggle (idempotence not required)
    const rbt = new RBTPage(page);

    // We'll perform an odd number of clicks and assert final state corresponds to parity
    // Start: hidden (S0)
    expect(await rbt.isDemoHidden()).toBe(true);

    // Click 1 -> visible
    await rbt.clickDemoButton();
    expect(await rbt.isDemoHidden()).toBe(false);
    expect(await rbt.getButtonText()).toBe('Hide Insertion Demo');

    // Click 2 -> hidden
    await rbt.clickDemoButton();
    expect(await rbt.isDemoHidden()).toBe(true);
    expect(await rbt.getButtonText()).toBe('Show Insertion Demo');

    // Rapid triple click sequence: final parity is 3 (odd) => visible
    await Promise.all([
      rbt.demoBtn.click(),
      rbt.demoBtn.click(),
      rbt.demoBtn.click()
    ]);
    // Give microtask time to process DOM updates
    await page.waitForTimeout(50);

    // After 3 rapid clicks, we expect visible (odd number toggles)
    expect(await rbt.isDemoHidden()).toBe(false);
    expect(await rbt.getButtonText()).toBe('Hide Insertion Demo');

    // Click once more to return to hidden
    await rbt.clickDemoButton();
    expect(await rbt.isDemoHidden()).toBe(true);
    expect(await rbt.getButtonText()).toBe('Show Insertion Demo');
  });

  test('DOM evidence checks: verify elements match FSM evidence strings', async ({ page }) => {
    // This test asserts that the page contains the evidence snippets indicated in the FSM
    // - The button markup and the insertion-demo markup (with class 'hidden' initially)
    const rbt = new RBTPage(page);

    // Check that #demo-btn exists and contains expected text node
    const buttonHtml = await page.evaluate(() => {
      const btn = document.getElementById('demo-btn');
      return btn ? btn.outerHTML : null;
    });
    expect(buttonHtml).toMatch(/<button[^>]*id="demo-btn"[^>]*>Show Insertion Demo<\/button>/);

    // Check insertion-demo outerHTML includes class="hidden"
    const demoHtml = await page.evaluate(() => {
      const d = document.getElementById('insertion-demo');
      return d ? d.outerHTML : null;
    });
    expect(demoHtml).toContain('id="insertion-demo"');
    expect(demoHtml).toContain('class="hidden"');
  });

  test('Observe and assert absence of specific JS error types (ReferenceError/TypeError/SyntaxError)', async ({ page }) => {
    // This test specifically inspects captured console messages and page errors for severe JS errors.
    // We intentionally do not modify the runtime environment. We only assert that none of the
    // major JS error types were emitted during page load and interactions we perform here.

    const rbt = new RBTPage(page);

    // Interact with the page a bit to surface potential runtime errors
    await rbt.clickDemoButton();
    await rbt.clickDemoButton();
    await page.waitForTimeout(20);

    // Inspect the already collected messages (from beforeEach listener)
    // The afterEach hook will assert no errors overall; here we provide focused assertions:
    const hasReferenceError = consoleMessages.some(m => /ReferenceError/.test(m.text));
    const hasTypeError = consoleMessages.some(m => /TypeError/.test(m.text));
    const hasSyntaxError = consoleMessages.some(m => /SyntaxError/.test(m.text));
    const hasPageError = pageErrors.length > 0;

    expect(hasReferenceError, `No ReferenceError expected in console logs. Found messages: ${consoleMessages.map(m => m.text).slice(0,5).join(' | ')}`).toBe(false);
    expect(hasTypeError, `No TypeError expected in console logs. Found messages: ${consoleMessages.map(m => m.text).slice(0,5).join(' | ')}`).toBe(false);
    expect(hasSyntaxError, `No SyntaxError expected in console logs. Found messages: ${consoleMessages.map(m => m.text).slice(0,5).join(' | ')}`).toBe(false);
    expect(hasPageError, `No uncaught page exceptions expected. Found ${pageErrors.length}.`).toBe(false);
  });
});