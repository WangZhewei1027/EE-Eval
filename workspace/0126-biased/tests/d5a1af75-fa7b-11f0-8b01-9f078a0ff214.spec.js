import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1af75-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('d5a1af75-fa7b-11f0-8b01-9f078a0ff214 - Understanding Big-O Notation (FSM validation)', () => {
  // Capture page errors and console error messages for assertions across tests
  test.beforeEach(async ({ page }) => {
    // Attach listeners for each test to gather runtime errors and console error messages
    page.context().setDefaultNavigationTimeout(30000);
  });

  // Helper to attach collectors for errors and console messages
  const withErrorCollection = async (page, run) => {
    const pageErrors = [];
    const consoleErrors = [];

    const onPageError = (err) => pageErrors.push(err);
    const onConsole = (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    };

    page.on('pageerror', onPageError);
    page.on('console', onConsole);

    try {
      await run({ page, pageErrors, consoleErrors });
    } finally {
      page.removeListener('pageerror', onPageError);
      page.removeListener('console', onConsole);
    }
  };

  test('Initial Idle state: page rendered and #demo is hidden, button exists with onclick attribute', async ({ page }) => {
    // This test validates the S0_Idle state: page renders and the demo is initially hidden.
    await withErrorCollection(page, async ({ page, pageErrors, consoleErrors }) => {
      // Load the application exactly as-is
      await page.goto(APP_URL);

      // Verify main heading rendered - evidence of renderPage() entry action in FSM (rendered content)
      const h1 = page.locator('h1');
      await expect(h1).toHaveText('Understanding Big-O Notation');

      // Verify button presence and attributes (component evidence)
      const button = page.locator('.button[onclick="showDemo()"]');
      await expect(button).toHaveCount(1);
      await expect(button).toBeVisible();
      const onclickAttr = await button.getAttribute('onclick');
      expect(onclickAttr).toBe('showDemo()');

      // Verify demo element exists and is initially hidden via inline style (style.display === 'none')
      const demo = page.locator('#demo');
      await expect(demo).toHaveCount(1);

      // Use getComputedStyle to assert display is none at initial load
      const display = await page.evaluate(() => {
        const demoEl = document.getElementById('demo');
        return window.getComputedStyle(demoEl).display;
      });
      expect(display).toBe('none');

      // Confirm no page errors or console errors occurred during initial load
      expect(pageErrors.length).toBe(0);
      const errorTexts = consoleErrors.map(m => m.text());
      for (const txt of errorTexts) {
        expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
    });
  });

  test('Transition S0_Idle -> S1_DemoVisible on click: clicking button shows demo (style.display = "block")', async ({ page }) => {
    // This test simulates the ClickForExampleAnalysis event and verifies the state transition to Demo Visible.
    await withErrorCollection(page, async ({ page, pageErrors, consoleErrors }) => {
      await page.goto(APP_URL);

      const button = page.locator('.button[onclick="showDemo()"]');
      const demo = page.locator('#demo');

      // Click the button to trigger showDemo()
      await button.click();

      // Verify demo becomes visible (display: block)
      const displayAfterClick = await page.evaluate(() => {
        const demoEl = document.getElementById('demo');
        return demoEl.style.display; // inline style set by showDemo()
      });
      expect(displayAfterClick).toBe('block');

      // Also check computed style is block (visual feedback)
      const computedDisplay = await page.evaluate(() => {
        const demoEl = document.getElementById('demo');
        return window.getComputedStyle(demoEl).display;
      });
      expect(computedDisplay).toBe('block');

      // Verify content of demo contains expected explanatory text (partial match)
      await expect(demo).toContainText('Example Analysis:');

      // Confirm no runtime page errors or critical console errors during the interaction
      expect(pageErrors.length).toBe(0);
      const errorTexts = consoleErrors.map(m => m.text());
      for (const txt of errorTexts) {
        expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
    });
  });

  test('Transition S1_DemoVisible -> S0_Idle on second click: clicking again hides demo (style.display = "none")', async ({ page }) => {
    // This test ensures the toggle back to Idle state works by performing two clicks.
    await withErrorCollection(page, async ({ page, pageErrors, consoleErrors }) => {
      await page.goto(APP_URL);

      const button = page.locator('.button[onclick="showDemo()"]');
      const demo = page.locator('#demo');

      // Click once to show
      await button.click();
      await expect(page.locator('#demo')).toBeVisible();

      // Click again to hide
      await button.click();

      // Inline style should be 'none' again
      const displayAfterSecondClick = await page.evaluate(() => {
        const demoEl = document.getElementById('demo');
        return demoEl.style.display;
      });
      expect(displayAfterSecondClick).toBe('none');

      // Computed style should reflect hidden state
      const computedDisplay = await page.evaluate(() => {
        const demoEl = document.getElementById('demo');
        return window.getComputedStyle(demoEl).display;
      });
      expect(computedDisplay).toBe('none');

      // Confirm no runtime page errors or critical console errors during toggling
      expect(pageErrors.length).toBe(0);
      const errorTexts = consoleErrors.map(m => m.text());
      for (const txt of errorTexts) {
        expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
    });
  });

  test('Edge case: keyboard activation (Enter) triggers same toggle behavior and remains error-free', async ({ page }) => {
    // Validate accessibility/keyboard interaction: focusing and pressing Enter should trigger the click handler
    await withErrorCollection(page, async ({ page, pageErrors, consoleErrors }) => {
      await page.goto(APP_URL);

      const button = page.locator('.button[onclick="showDemo()"]');
      const demo = page.locator('#demo');

      // Focus the button and press Enter to trigger click
      await button.focus();
      await page.keyboard.press('Enter');

      // Demo should now be visible
      await expect(demo).toBeVisible();
      let computedDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('demo')).display);
      expect(computedDisplay).toBe('block');

      // Press Enter again to hide
      await button.focus();
      await page.keyboard.press('Enter');

      await expect(demo).not.toBeVisible();
      computedDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('demo')).display);
      expect(computedDisplay).toBe('none');

      // Confirm no runtime page errors or critical console errors during keyboard interactions
      expect(pageErrors.length).toBe(0);
      const errorTexts = consoleErrors.map(m => m.text());
      for (const txt of errorTexts) {
        expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
    });
  });

  test('Robustness: multiple rapid clicks maintain toggle correctness and produce no JS errors', async ({ page }) => {
    // Stress-test the toggle by rapidly clicking and verify the demo ends up in a deterministic state after an even/odd number of clicks.
    await withErrorCollection(page, async ({ page, pageErrors, consoleErrors }) => {
      await page.goto(APP_URL);

      const button = page.locator('.button[onclick="showDemo()"]');

      // Rapidly click 5 times (odd) -> final state should be visible
      for (let i = 0; i < 5; i++) {
        await button.click();
      }
      let computedDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('demo')).display);
      expect(computedDisplay).toBe('block');

      // Rapidly click 2 more times (total 7 -> still odd) -> visible
      await button.click();
      await button.click();
      computedDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('demo')).display);
      // Two additional clicks change odd->odd? Actually 7 is odd -> still visible
      expect(computedDisplay).toBe('block');

      // Click one more time to make even total (8) -> hidden
      await button.click();
      computedDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('demo')).display);
      expect(computedDisplay).toBe('none');

      // Confirm no runtime page errors or critical console errors during rapid clicking
      expect(pageErrors.length).toBe(0);
      const errorTexts = consoleErrors.map(m => m.text());
      for (const txt of errorTexts) {
        expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
    });
  });

  test('showDemo function exists and can be invoked from page context; toggles #demo style', async ({ page }) => {
    // Validate that the global function showDemo exists and behaves as expected when invoked from JS context.
    await withErrorCollection(page, async ({ page, pageErrors, consoleErrors }) => {
      await page.goto(APP_URL);

      // Ensure showDemo exists and is a function
      const isFunction = await page.evaluate(() => typeof window.showDemo === 'function');
      expect(isFunction).toBe(true);

      // Call the function directly to toggle
      await page.evaluate(() => {
        // initial state should be none; calling should set to block
        window.showDemo();
      });
      let computedDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('demo')).display);
      expect(computedDisplay).toBe('block');

      // Call again to hide
      await page.evaluate(() => window.showDemo());
      computedDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('demo')).display);
      expect(computedDisplay).toBe('none');

      // Confirm no runtime page errors or critical console errors when invoking showDemo directly
      expect(pageErrors.length).toBe(0);
      const errorTexts = consoleErrors.map(m => m.text());
      for (const txt of errorTexts) {
        expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
    });
  });

  test('No unexpected ReferenceError, SyntaxError, or TypeError observed during all interactions', async ({ page }) => {
    // This test runs through the main interaction flow and finally asserts that no critical runtime errors occurred.
    await withErrorCollection(page, async ({ page, pageErrors, consoleErrors }) => {
      await page.goto(APP_URL);

      const button = page.locator('.button[onclick="showDemo()"]');

      // Perform typical interactions
      await button.click(); // show
      await button.click(); // hide
      await button.click(); // show

      // Aggregate observed page errors and console errors
      // pageErrors contains Error objects emitted via window.onerror etc.
      expect(pageErrors.length).toBe(0);

      // consoleErrors are ConsoleMessage objects; ensure none indicate ReferenceError, SyntaxError, TypeError
      const errorTexts = consoleErrors.map(m => m.text());
      for (const txt of errorTexts) {
        // If any critical JS error types appear, fail the test
        expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
    });
  });
});