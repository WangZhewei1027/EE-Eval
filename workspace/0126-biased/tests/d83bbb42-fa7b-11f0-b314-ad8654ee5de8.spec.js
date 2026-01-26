import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83bbb42-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure main elements are present
    await this.page.waitForSelector('#runDemo');
    await this.page.waitForSelector('#demoOutput');
  }

  async runDemoButton() {
    return this.page.locator('#runDemo');
  }

  async demoOutput() {
    return this.page.locator('#demoOutput');
  }

  async clickRunDemo() {
    await (await this.runDemoButton()).click();
  }

  async outputText() {
    return (await this.demoOutput()).innerText();
  }

  async isOutputVisible() {
    // Check computed style so we reflect actual visibility (style.display or CSS)
    return await this.page.evaluate(() => {
      const out = document.getElementById('demoOutput');
      if (!out) return false;
      const cs = getComputedStyle(out);
      return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && out.offsetHeight > 0;
    });
  }

  async inlineDisplayValue() {
    return this.page.evaluate(() => {
      const out = document.getElementById('demoOutput');
      return out ? out.style.display : null;
    });
  }

  async pageContent() {
    return this.page.content();
  }
}

// Collect console errors and page errors for each test
test.describe('Digital Signatures toy demo — FSM validation and behaviors', () => {
  test.describe.configure({ mode: 'parallel' });

  // Shared arrays to collect runtime errors and console error messages for each test
  test.beforeEach(async ({ page }, testInfo) => {
    // Track console.error messages
    page.context()._consoleErrors = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // Collect only error-level console messages
      if (msg.type() === 'error') {
        page.context()._consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(err);
    });

    // No navigation here; each test will navigate via DemoPage.goto()
  });

  // ---- FSM State: S0_Idle tests ----
  test.describe('State S0_Idle — initial render checks', () => {
    test('S0_Idle: initial page renders runDemo button and hidden demo output', async ({ page }) => {
      // This test validates the initial "Idle" state described in the FSM:
      // - The Run toy RSA signature demo button exists and is visible.
      // - The demo output element exists but is initially hidden (display:none).
      const demo = new DemoPage(page);
      await demo.goto();

      const runBtn = await demo.runDemoButton();
      await expect(runBtn).toBeVisible();
      await expect(runBtn).toHaveAttribute('id', 'runDemo');
      await expect(runBtn).toHaveText('Run toy RSA signature demo');

      // demoOutput exists in DOM
      const out = await demo.demoOutput();
      await expect(out).toBeTruthy();

      // Inline style initially sets display:none; computed style should be not visible
      const inlineDisplay = await demo.inlineDisplayValue();
      expect(inlineDisplay === 'none' || inlineDisplay === '').toBeTruthy(); // either explicit or empty string (but content hidden by CSS)
      const visible = await demo.isOutputVisible();
      expect(visible).toBeFalsy();

      // Check attribute aria-hidden exists and matches the declared value in markup
      const ariaHidden = await page.getAttribute('#demoOutput', 'aria-hidden');
      // The HTML marked aria-hidden="false" but style hides it - assert the attribute exists and equals "false"
      expect(ariaHidden).toBe('false');
    });

    test('S0_Idle: page source contains evidence of event handler hookup (btn.addEventListener)', async ({ page }) => {
      // Validate FSM evidence: the script includes "btn.addEventListener('click'"
      const demo = new DemoPage(page);
      await demo.goto();

      const content = await demo.pageContent();
      expect(content).toContain("btn.addEventListener('click'");
    });

    test('S0_Idle: No global renderPage entry action exists (onEnter check)', async ({ page }) => {
      // FSM entry action listed "renderPage()" — ensure we load the page as-is and assert whether renderPage exists.
      const demo = new DemoPage(page);
      await demo.goto();

      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      // According to the provided implementation, there is no global renderPage function.
      expect(hasRenderPage).toBeFalsy();
    });
  });

  // ---- Transition / Event: RunDemoClick -> S1_DemoRunning tests ----
  test.describe('Transition: RunDemoClick -> S1_DemoRunning (click #runDemo)', () => {
    test('Clicking #runDemo transitions to Demo Running and shows expected textual output with verification success', async ({ page }) => {
      // This test validates the FSM transition:
      // - Clicking the Run button makes #demoOutput visible
      // - The output contains the step-by-step explanation and shows verification success
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure no runtime errors were captured so far
      expect(page.context()._consoleErrors.length).toBe(0);
      expect(page.context()._pageErrors.length).toBe(0);

      await demo.clickRunDemo();

      // Wait for the output to be visible (script sets style.display = "block")
      await page.waitForFunction(() => {
        const out = document.getElementById('demoOutput');
        if (!out) return false;
        const cs = getComputedStyle(out);
        return cs && cs.display !== 'none';
      }, { timeout: 2000 });

      // Verify inline style was changed to "block"
      const inlineDisplay = await demo.inlineDisplayValue();
      expect(inlineDisplay === 'block' || inlineDisplay === 'block;').toBeTruthy();

      // Verify computed visibility
      const visible = await demo.isOutputVisible();
      expect(visible).toBeTruthy();

      // Check that output text contains expected pieces of the explanation
      const text = await demo.outputText();

      // Ensure the demo referenced the example message "Hello"
      expect(text).toContain('Message: "Hello"');

      // The toy simpleDigest result for "Hello" should be 500 (72+101+108+108+111 = 500)
      expect(text).toContain('digest = 500');

      // Verify the demonstration computed a signature and verification, and that verification succeeded
      expect(text).toContain('Step 2 — Compute signature');
      expect(text).toContain('Step 3 — Verify');
      // Final result line should indicate verification success (this is the expected correct RSA math for these params)
      expect(text).toMatch(/Result: verification SUCCESS/);
    });

    test('Clicking the demo button multiple times is idempotent (re-runs demo and leaves output visible)', async ({ page }) => {
      // This edge-case tests behavior when the user clicks multiple times rapidly.
      const demo = new DemoPage(page);
      await demo.goto();

      // First click
      await demo.clickRunDemo();
      await page.waitForFunction(() => {
        const out = document.getElementById('demoOutput');
        if (!out) return false;
        return getComputedStyle(out).display !== 'none';
      });

      const firstText = await demo.outputText();
      expect(firstText).toContain('digest = 500');

      // Click again to re-run demo
      await demo.clickRunDemo();

      // Wait a small time to allow re-render
      await page.waitForTimeout(100);

      const secondText = await demo.outputText();
      // Output should still contain the same digest and verification success
      expect(secondText).toContain('digest = 500');
      expect(secondText).toMatch(/Result: verification SUCCESS/);

      // Output should remain visible
      const visible = await demo.isOutputVisible();
      expect(visible).toBeTruthy();
    });

    test('S1_DemoRunning: runDemo() entry action presence check (implementation uses inline handler instead)', async ({ page }) => {
      // FSM claims entry action runDemo(), but the actual implementation registers a click handler on btn.
      // Validate whether a global runDemo function exists (it should not in the provided implementation).
      const demo = new DemoPage(page);
      await demo.goto();

      const hasRunDemo = await page.evaluate(() => typeof window.runDemo !== 'undefined');
      expect(hasRunDemo).toBeFalsy();
    });
  });

  // ---- Runtime observation & error handling tests ----
  test.describe('Runtime: console and uncaught errors observation', () => {
    test('No console.error or uncaught page errors during load and demo interaction', async ({ page }) => {
      // This test observes console and page errors and asserts none happened during normal usage.
      const demo = new DemoPage(page);
      await demo.goto();

      // Interact with the demo to surface possible runtime issues
      await demo.clickRunDemo();
      await page.waitForFunction(() => {
        const out = document.getElementById('demoOutput');
        if (!out) return false;
        return getComputedStyle(out).display !== 'none';
      }, { timeout: 2000 });

      // Allow asynchronous errors to surface
      await page.waitForTimeout(100);

      const consoleErrors = page.context()._consoleErrors || [];
      const pageErrors = page.context()._pageErrors || [];

      // Surface any captured console error messages in the test output if present (for debugging)
      if (consoleErrors.length > 0) {
        console.error('Captured console.error messages:', consoleErrors);
      }
      if (pageErrors.length > 0) {
        console.error('Captured page errors:', pageErrors);
      }

      // Assert no errors were captured
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('If runtime errors do occur, they are observed (this test will fail if errors are present)', async ({ page }) => {
      // This test intentionally validates the test harness observation:
      // If there are page errors (ReferenceError / TypeError / SyntaxError) they should be captured.
      // We navigate and interact, then assert that the errors array is an Array (we don't assume contents).
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.clickRunDemo();
      await page.waitForTimeout(100);

      // Ensure our error tracking structures exist and are arrays
      expect(Array.isArray(page.context()._consoleErrors)).toBeTruthy();
      expect(Array.isArray(page.context()._pageErrors)).toBeTruthy();

      // Additionally assert that, for this implementation, there are no runtime errors.
      // (If there were, this assertion would fail and surface those errors.)
      expect(page.context()._consoleErrors.length).toBe(0);
      expect(page.context()._pageErrors.length).toBe(0);
    });
  });

  // ---- Additional verification tests (evidence & content integrity) ----
  test.describe('Content integrity and educational text checks', () => {
    test('Demo output includes toy RSA parameters and pedagogical notes', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.clickRunDemo();
      await page.waitForFunction(() => {
        const out = document.getElementById('demoOutput');
        if (!out) return false;
        return getComputedStyle(out).display !== 'none';
      });

      const text = await demo.outputText();
      // Check presence of known parameters from the HTML/JS: p,q,n,e,d
      expect(text).toContain('p = 61');
      expect(text).toContain('q = 53');
      expect(text).toContain('n = p * q = 3233');
      expect(text).toContain('public exponent e = 17');
      expect(text).toContain('private exponent d = 2753');
      // Pedagogical notes appended at the end
      expect(text).toContain('Important pedagogical notes:');
      expect(text).toContain('This demo uses a toy hash and tiny parameters which are insecure.');
    });
  });
});