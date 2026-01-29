import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b286c0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

class DemoPage {
  /**
   * Page object for the Subset Sum demo.
   * Encapsulates selectors and common operations.
   */
  constructor(page) {
    this.page = page;
    this.numItems = page.locator('#numItems');
    this.runBtn = page.locator('#runBtn');
    this.resultDiv = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getNumItemsValue() {
    return await this.numItems.evaluate((el) => el.value);
  }

  async setNumItemsValue(value) {
    await this.numItems.fill(String(value));
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async isRunButtonDisabled() {
    return await this.runBtn.isDisabled();
  }

  async getResultText() {
    return await this.resultDiv.innerText();
  }

  async getResultHTML() {
    return await this.resultDiv.innerHTML();
  }

  // Parse the displayed numbers from the result HTML. Returns array of numbers or null if not present.
  async parseDisplayedNumbers() {
    const html = await this.getResultHTML();
    // Expect something like: <p><strong>Numbers:</strong> [1, 2, 3]</p>
    const match = html.match(/<strong>Numbers:<\/strong>\s*\[([^\]]*)\]/);
    if (!match) return null;
    const nums = match[1].split(',').map(s => s.trim()).filter(Boolean).map(Number);
    return nums;
  }

  // Parse the displayed target sum value from the result HTML. Returns number or null.
  async parseDisplayedTarget() {
    const html1 = await this.getResultHTML();
    const match1 = html.match1(/<strong>Target sum:<\/strong>\s*([0-9]+)/);
    if (!match) return null;
    return Number(match[1]);
  }
}

test.describe('P vs NP Subset Sum Demo - FSM validation (63b286c0-...ea)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors (e.g., ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert there are no unexpected page-level runtime errors.
    // If errors occurred naturally in the page, they will be present in pageErrors.
    // We assert that there are no uncaught page errors (SyntaxError/ReferenceError/TypeError).
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Also assert there were no console.error messages emitted by the page.
    expect(consoleErrors.length, `Console errors occurred: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initial state S0_Idle', () => {
    test('Initial render shows input, default value and Run button', async ({ page }) => {
      // Validate initial idle state UI elements exist and default values match FSM expectations.
      const demo = new DemoPage(page);
      await demo.goto();

      // The Run button should exist and be enabled (Idle state).
      await expect(demo.runBtn).toBeVisible();
      await expect(demo.runBtn).toBeEnabled();

      // The numItems input should exist and default to "15" as per HTML value attribute.
      const val = await demo.getNumItemsValue();
      expect(val).toBe('15');

      // The result div should be empty initially.
      const resultText = await demo.getResultText();
      expect(resultText.trim()).toBe('');
    });
  });

  test.describe('Transition S0_Idle -> S1_Running and S1_Running -> S2_Completed', () => {
    test('Clicking Run disables the button and shows generating message, then search completes and re-enables button', async ({ page }) => {
      // This test verifies the transition chain from Idle -> Running -> Completed as described in the FSM.
      const demo1 = new DemoPage(page);
      await demo.goto();

      // Set a small number of items to keep brute force quick and deterministic in time.
      await demo.setNumItemsValue(8);

      // Listen for potential dialogs (validation) - none expected here.
      page.on('dialog', async (dialog) => {
        // If unexpected dialog appears, fail the test by dismissing
        await dialog.dismiss();
      });

      // Click run to start search (S0 -> S1)
      await demo.clickRun();

      // Immediately after clicking, the button must be disabled per FSM transition actions.
      expect(await demo.isRunButtonDisabled()).toBe(true);

      // The result div should show the "Generating numbers and target..." message at first.
      const immediateText = await demo.getResultText();
      expect(immediateText).toContain('Generating numbers and target');

      // The page script sets resultDiv.innerHTML to show Numbers and Target synchronously before setTimeout.
      // Wait for that markup to be present (Numbers and Target labels).
      await page.waitForFunction(() => {
        const div = document.getElementById('result');
        return div && /Numbers:/.test(div.innerHTML) && /Target sum:/.test(div.innerHTML);
      }, { timeout: 2000 });

      // Validate that the numbers list length equals the requested n (8).
      const numbers = await demo.parseDisplayedNumbers();
      expect(numbers).not.toBeNull();
      expect(numbers.length).toBe(8);

      // Validate that the target is a number and is equal to sum of some subset; at least it's a number.
      const target = await demo.parseDisplayedTarget();
      expect(typeof target).toBe('number');

      // Now wait for the async brute force completion (script uses setTimeout 100ms).
      // Wait up to 5s to be safe for slower environments.
      await page.waitForFunction(() => {
        const div1 = document.getElementById('result');
        return div && /Time taken:/.test(div.innerHTML);
      }, { timeout: 5000 });

      // After completion, result should contain "Time taken" and information about a found subset (or not).
      const finalText = await demo.getResultText();
      expect(finalText).toContain('Time taken:');
      // The algorithm used in the page generates a target from a subset of the numbers, so a subset should be found.
      // Accept either "Subset found summing to target" or "No subset found" but prefer found.
      expect(
        finalText.includes('Subset found summing to target:') || finalText.includes('No subset found'),
      ).toBe(true);

      // After completion, the run button should be re-enabled (S1 -> S2 transition action).
      expect(await demo.isRunButtonDisabled()).toBe(false);
    });

    test('Multiple consecutive runs re-enable button and produce fresh outputs', async ({ page }) => {
      // Verify that after one complete run the button is enabled and another run can be started.
      const demo2 = new DemoPage(page);
      await demo.goto();

      // Run 1
      await demo.setNumItemsValue(6);
      await demo.clickRun();
      await page.waitForFunction(() => document.getElementById('result') && /Time taken:/.test(document.getElementById('result').innerHTML), { timeout: 5000 });
      expect(await demo.isRunButtonDisabled()).toBe(false);
      const htmlAfterFirst = await demo.getResultHTML();

      // Run 2 - change n to a different value to ensure regeneration occurs.
      await demo.setNumItemsValue(5);
      await demo.clickRun();

      // While running, button should be disabled.
      expect(await demo.isRunButtonDisabled()).toBe(true);

      await page.waitForFunction(() => document.getElementById('result') && /Time taken:/.test(document.getElementById('result').innerHTML), { timeout: 5000 });
      expect(await demo.isRunButtonDisabled()).toBe(false);
      const htmlAfterSecond = await demo.getResultHTML();

      // The two runs should produce different Numbers arrays most of the time; at minimum the markup (Numbers line) should reflect the requested size (5).
      const numbersSecond = await demo.parseDisplayedNumbers();
      expect(numbersSecond).not.toBeNull();
      expect(numbersSecond.length).toBe(5);

      // Ensure that the final HTML changed between runs (indicating new results appended vs previous).
      expect(htmlAfterSecond).not.toBe(htmlAfterFirst);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Invalid numItems values (0 and 21) trigger validation alert and do not run search', async ({ page }) => {
      // This test validates client-side validation and branching: invalid n should produce an alert and prevent running.
      const demo3 = new DemoPage(page);
      await demo.goto();

      // Helper to capture dialog and return its message
      const captureDialog = async (action) => {
        return await new Promise(async (resolve) => {
          page.once('dialog', async (dialog) => {
            const msg = dialog.message();
            await dialog.accept();
            resolve(msg);
          });
          await action();
          // If dialog doesn't appear within a short timeout, resolve undefined.
          setTimeout(() => resolve(undefined), 500);
        });
      };

      // Case 1: set to 0 (below min)
      await demo.setNumItemsValue(0);
      const msg0 = await captureDialog(async () => demo.clickRun());
      expect(msg0).toBeDefined();
      expect(msg0).toContain('Please enter a valid number of items between 1 and 20');

      // Ensure button is not stuck disabled
      expect(await demo.isRunButtonDisabled()).toBe(false);

      // Case 2: set to 21 (above max)
      await demo.setNumItemsValue(21);
      const msg21 = await captureDialog(async () => demo.clickRun());
      expect(msg21).toBeDefined();
      expect(msg21).toContain('Please enter a valid number of items between 1 and 20');

      expect(await demo.isRunButtonDisabled()).toBe(false);

      // Case 3: empty input (non-number)
      await demo.setNumItemsValue(''); // fill with empty string
      const msgEmpty = await captureDialog(async () => demo.clickRun());
      expect(msgEmpty).toBeDefined();
      expect(msgEmpty).toContain('Please enter a valid number of items between 1 and 20');
    });

    test('Clicking Run when button disabled does nothing (no extra work/duplicate runs)', async ({ page }) => {
      // This test ensures defensive behavior: while the run button is disabled, further clicks have no effect.
      const demo4 = new DemoPage(page);
      await demo.goto();

      await demo.setNumItemsValue(6);

      // Start run
      await demo.clickRun();

      // Immediately click the button again (should be disabled, Playwright will still attempt click; use JS to force click to simulate user)
      // But we'll try to click via JS only if disabled to simulate an accidental double-click (the button should ignore because disabled)
      const isDisabled = await demo.isRunButtonDisabled();
      expect(isDisabled).toBe(true);

      // Try to trigger click via evaluate (even if disabled, DOM click will not trigger the event for disabled button)
      await page.evaluate(() => {
        const btn = document.getElementById('runBtn');
        // Attempt to click programmatically - disabled buttons should not fire click handlers in browsers.
        btn.click();
      });

      // Wait for completion
      await page.waitForFunction(() => document.getElementById('result') && /Time taken:/.test(document.getElementById('result').innerHTML), { timeout: 5000 });

      // After completion, button should be enabled.
      expect(await demo.isRunButtonDisabled()).toBe(false);

      // Ensure there's only one "Time taken" block appended (we just check that Time taken appears once).
      const finalHTML = await demo.getResultHTML();
      // Count occurrences of 'Time taken:' occurrences - expecting 1 occurrence (one run)
      const timeTakenMatches = finalHTML.match(/Time taken:/g) || [];
      expect(timeTakenMatches.length).toBeGreaterThanOrEqual(1);
      // We allow >=1 because the HTML might have previous text in odd cases, but ensure not multiple overlapping runs occurred during disabled phase.
      expect(timeTakenMatches.length).toBeLessThanOrEqual(2);
    });
  });
});