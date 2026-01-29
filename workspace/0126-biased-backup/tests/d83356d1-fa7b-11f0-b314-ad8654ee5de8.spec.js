import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83356d1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the Minimal Demonstration area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoBtn');
    this.result = page.locator('#demoResult');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async getButtonAriaControls() {
    return this.button.getAttribute('aria-controls');
  }

  async isResultVisible() {
    // Use computed style to determine actual visibility (block/none)
    return await this.result.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async getResultInlineStyle() {
    return this.result.getAttribute('style');
  }

  async getResultText() {
    return this.result.textContent();
  }

  async clickDemo() {
    await this.button.click();
  }

  // Click quickly multiple times
  async clickDemoMultiple(times, delayMs = 50) {
    for (let i = 0; i < times; i++) {
      await this.button.click();
      if (delayMs) await this.page.waitForTimeout(delayMs);
    }
  }
}

test.describe('Multiset demonstration FSM - d83356d1-fa7b-11f0-b314-ad8654ee5de8', () => {
  let demo;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console messages and runtime errors for each test
    consoleMessages = [];
    pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // No teardown actions needed beyond Playwright's automatic cleanup,
    // but we keep this hook to make the test structure clear.
  });

  test.describe('Initial (S0_Idle) state validations', () => {
    test('Initial DOM elements exist and have expected attributes and inline state', async () => {
      // Validate the demo button exists and links to the demo result via aria-controls
      await expect(demo.button).toBeVisible();
      const btnText = await demo.getButtonText();
      expect(btnText.trim()).toBe('Show demonstration'); // evidence: initial button label

      const aria = await demo.getButtonAriaControls();
      expect(aria).toBe('demoResult'); // evidence: aria-controls attribute

      // The result area should exist and be hidden initially (style attribute present with display:none)
      await expect(demo.result).toBeVisible(); // it's in DOM even if visually hidden
      const inlineStyle = await demo.getResultInlineStyle();
      expect(inlineStyle).toBeTruthy();
      expect(inlineStyle.replace(/\s+/g, '')).toContain('display:none');

      // Using computed style to confirm visibility is none
      const visible = await demo.isResultVisible();
      expect(visible).toBe(false);
    });
  });

  test.describe('Toggle behavior and FSM transitions (ShowDemo event)', () => {
    test('Clicking the demo button transitions Idle -> DemoVisible (S0 -> S1)', async () => {
      // Click once: should show result and change button text
      await demo.clickDemo();

      // Check button text changed to "Hide demonstration"
      const btnTextAfter = await demo.getButtonText();
      expect(btnTextAfter.trim()).toBe('Hide demonstration');

      // Check result becomes visible via computed style
      const visible = await demo.isResultVisible();
      expect(visible).toBe(true);

      // The result content should include expected multiset information
      const text = await demo.getResultText();
      expect(text).toBeTruthy();
      // Validate some key substrings that demonstrate the example ran
      expect(text).toContain('Multiset A (from list):'); // indicates the demo rendered
      expect(text).toContain('"a":2'); // multiplicity evidence for A
      expect(text).toContain('"c":3'); // multiplicity evidence for A
      expect(text).toContain('"d":1'); // multiplicity evidence for B (B contains d)
      expect(text).toContain('Union (max multiplicities)'); // union computed
      expect(text).toContain('Intersection (min multiplicities)'); // intersection computed
      expect(text).toContain('Difference A \\'); // the code outputs "Difference A \ B"
      // Cardinalities summary at the end
      expect(text).toContain('|A|=6');
      expect(text).toContain('|B|=5');
    });

    test('Clicking again transitions DemoVisible -> DemoHidden (S1 -> S2)', async () => {
      // Show first
      await demo.clickDemo();
      expect(await demo.isResultVisible()).toBe(true);

      // Now hide by clicking again
      await demo.clickDemo();

      // Button text returns to "Show demonstration"
      const btnTextAfterHide = await demo.getButtonText();
      expect(btnTextAfterHide.trim()).toBe('Show demonstration');

      // Result should be hidden again
      expect(await demo.isResultVisible()).toBe(false);

      // The inline style should reflect display:none after hiding
      const inlineStyle = await demo.getResultInlineStyle();
      expect(inlineStyle.replace(/\s+/g, '')).toContain('display:none');
    });

    test('Repeated toggling returns to expected states (S2 -> S1 -> S2 ...)', async () => {
      // Start: hidden
      expect(await demo.isResultVisible()).toBe(false);

      // Click odd number -> visible
      await demo.clickDemoMultiple(1, 20);
      expect(await demo.isResultVisible()).toBe(true);

      // Click one more -> hidden
      await demo.clickDemoMultiple(1, 20);
      expect(await demo.isResultVisible()).toBe(false);

      // Click three times -> visible (odd)
      await demo.clickDemoMultiple(3, 20);
      expect(await demo.isResultVisible()).toBe(true);

      // Click two times -> hidden (odd + 2 = odd? actually visible -> after 2 clicks becomes hidden)
      await demo.clickDemoMultiple(2, 20);
      expect(await demo.isResultVisible()).toBe(false);

      // Final assertion: button label matches hidden state
      const finalBtn = await demo.getButtonText();
      expect(finalBtn.trim()).toBe('Show demonstration');
    });
  });

  test.describe('Edge cases and content stability', () => {
    test('Rapid clicks do not produce runtime errors and leave deterministic final state', async () => {
      // Rapidly click 7 times; odd -> visible expected
      await demo.clickDemoMultiple(7, 0); // no delay

      // Expect visible (7 is odd)
      expect(await demo.isResultVisible()).toBe(true);
      const btnText = await demo.getButtonText();
      expect(btnText.trim()).toBe('Hide demonstration');

      // Ensure the output text is well-formed and still contains required sections
      const text = await demo.getResultText();
      expect(text).toContain('Multiset A (from list):');
      expect(text).toContain('Union (max multiplicities)');
    });

    test('Output formatting: toList conversion and JSON strings present and consistent', async () => {
      await demo.clickDemo();
      const text = await demo.getResultText();

      // toList outputs something like "{a, a, b, c, c, c}" for list representations
      expect(text).toMatch(/\{.*a.*b.*c.*\}/); // crude check that lists are printed

      // JSON string for multiplicities should contain expected exact mappings
      expect(text).toContain('{"a":2,"b":1,"c":3}');
      expect(text).toContain('{"a":1,"b":2,"c":1,"d":1}');
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No console errors or page runtime errors should be emitted during normal usage', async ({ page }) => {
      // Interact with the demo to trigger its code paths
      const p = new DemoPage(page);
      await p.clickDemo();
      await p.clickDemo(); // show then hide
      await p.clickDemo(); // show again

      // Allow microtasks and any asynchronous logs to flush
      await page.waitForTimeout(50);

      // Inspect collected console messages for any error-level messages
      const errorConsole = consoleMessages.filter((m) => m.type === 'error');
      if (errorConsole.length > 0) {
        // Attach context to expectation failure for debugging
        const texts = errorConsole.map((m) => m.text).join('\n---\n');
        throw new Error('Console error messages were emitted:\n' + texts);
      }

      // Assert no captured page errors (unhandled exceptions)
      if (pageErrors.length > 0) {
        // Fail with the error messages to make test diagnostics clear
        const msgs = pageErrors.map((e) => (e && e.stack) ? e.stack : String(e)).join('\n---\n');
        throw new Error('Page errors were captured:\n' + msgs);
      }

      // If none, assert explicitly that we saw zero errors
      expect(errorConsole.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('If any runtime errors occur they are reported (test will fail and include stack traces)', async ({ page }) => {
      // This test purposefully checks that our capturing mechanism reports runtime errors if they happen.
      // We do not inject or modify the page; we only assert that the captured arrays reflect reality.
      // Interact a bit to ensure code paths run.
      const p = new DemoPage(page);
      await p.clickDemo();
      await page.waitForTimeout(20);

      // The test asserts that the arrays exist and are arrays (sanity)
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // If there are runtime errors, fail with diagnostic information so they can be investigated.
      if (pageErrors.length > 0) {
        const msgs = pageErrors.map((e) => (e && e.stack) ? e.stack : String(e)).join('\n---\n');
        throw new Error('Detected runtime page errors during execution:\n' + msgs);
      }

      // Also check that there are no console .error() messages
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      if (consoleErrs.length > 0) {
        const texts = consoleErrs.map(m => m.text).join('\n---\n');
        throw new Error('Detected console.error messages during execution:\n' + texts);
      }

      // If none found, pass the test (explicitly)
      expect(pageErrors.length).toBe(0);
      expect(consoleErrs.length).toBe(0);
    });
  });
});