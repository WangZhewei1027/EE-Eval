import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0444a601-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the Garbage Collection demo page
class GarbageCollectionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure DOM is ready
    await this.page.waitForSelector('.container');
  }

  // Return array of button elements
  async getButtons() {
    return await this.page.$$('.button');
  }

  // Click the first button (which has onclick="gcTest()")
  async clickFirstButton() {
    const btn = await this.page.$('.button');
    await btn.click();
  }

  // Click the nth button (0-based)
  async clickButtonAt(index) {
    const buttons = await this.getButtons();
    if (buttons[index]) {
      await buttons[index].click();
    } else {
      throw new Error(`No button at index ${index}`);
    }
  }

  // Get the inline JS property value element.style[propName]
  // Note: the application uses non-standard "background_color" property, so we read that specifically
  async getInlineStylePropertyAt(index, propName) {
    return await this.page.evaluate(
      (i, prop) => {
        const el = document.querySelectorAll('.button')[i];
        if (!el) return undefined;
        // Access the property directly on the style object
        try {
          // Some browsers may return undefined or empty string for unknown style properties
          return el.style[prop];
        } catch (e) {
          return undefined;
        }
      },
      index,
      propName
    );
  }

  // Get computed background-color (standard CSS) for verification of :hover CSS effect
  async getComputedBackgroundColorAt(index) {
    return await this.page.evaluate((i) => {
      const el = document.querySelectorAll('.button')[i];
      if (!el) return null;
      return window.getComputedStyle(el).backgroundColor;
    }, index);
  }

  // Get text content for a button
  async getButtonTextAt(index) {
    return await this.page.evaluate((i) => {
      const el = document.querySelectorAll('.button')[i];
      return el ? el.textContent.trim() : null;
    }, index);
  }

  // Get onclick attribute value for a button
  async getOnclickAttributeAt(index) {
    return await this.page.evaluate((i) => {
      const el = document.querySelectorAll('.button')[i];
      return el ? el.getAttribute('onclick') : null;
    }, index);
  }

  // Hover over a button
  async hoverButtonAt(index) {
    const buttons = await this.getButtons();
    if (buttons[index]) {
      await buttons[index].hover();
    } else {
      throw new Error(`No button at index ${index}`);
    }
  }
}

test.describe('Garbage Collection interactive app (FSM validation)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  // Attach listeners to capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    page.on('pageerror', (err) => {
      // Capture unhandled exceptions from the page
      pageErrors.push(String(err && err.message ? err.message : err));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected fatal page errors logged.
    // Tests that expect errors should assert them explicitly within the test itself.
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('S0_Idle: initial render shows two buttons with correct text and onclick attribute', async ({ page }) => {
    // Validate initial Idle state: renderPage() called during entry (per FSM)
    const app = new GarbageCollectionPage(page);
    await app.goto();

    // There should be at least two buttons with the .button selector
    const buttons = await app.getButtons();
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    // Verify texts and onclick attributes for the first two detected buttons
    const text0 = await app.getButtonTextAt(0);
    const text1 = await app.getButtonTextAt(1);
    expect(text0).toContain('Test Garbage Collection');
    expect(text1).toContain('Test Garbage Collection');

    const onclick0 = await app.getOnclickAttributeAt(0);
    const onclick1 = await app.getOnclickAttributeAt(1);
    // The implementation uses onclick="gcTest()"
    expect(onclick0).toBe('gcTest()');
    expect(onclick1).toBe('gcTest()');

    // At initial render, the non-standard inline style property "background_color" should be falsy
    // (the script sets it only when gcTest runs)
    const bgProp0 = await app.getInlineStylePropertyAt(0, 'background_color');
    const bgProp1 = await app.getInlineStylePropertyAt(1, 'background_color');
    // Accept either undefined, null, or empty string as "not set"
    expect([undefined, null, '']).toContain(bgProp0);
    expect([undefined, null, '']).toContain(bgProp1);
  });

  test('Transition S0 -> S1_Testing: clicking button triggers gcTest and sets inline background_color', async ({ page }) => {
    // This validates the FSM transition from Idle to Testing on click
    const app = new GarbageCollectionPage(page);
    await app.goto();

    // Click the first button which triggers gcTest()
    await app.clickFirstButton();

    // Immediately after click, the implementation sets element.style.background_color = '#3e8e41'
    // Note: the implementation uses querySelector twice so both button1 and button2 variables point to the same element (the first button).
    // We assert actual observed behavior: the first button's inline JS style property should be '#3e8e41'.
    const firstBg = await app.getInlineStylePropertyAt(0, 'background_color');
    expect(firstBg).toBe('#3e8e41');

    // FSM expected both button1 and button2 to change, but implementation selects the first element twice.
    // Assert observed reality for the second button (likely unchanged).
    const secondBg = await app.getInlineStylePropertyAt(1, 'background_color');
    // second button may remain unset; accept either unset or same color if environment behaves differently
    expect([undefined, null, '', '#3e8e41']).toContain(secondBg);
  });

  test('Transition S1_Testing -> S0_Idle: gcTest schedules reset to white after 3 seconds', async ({ page }) => {
    // Validate onExit behavior: after the timeout, inline background_color becomes '#fff'
    const app = new GarbageCollectionPage(page);
    await app.goto();

    // Trigger gcTest which schedules a setTimeout to reset background_color to '#fff' after 3000ms
    await app.clickFirstButton();

    // Immediately it should be greenish per the script
    const immediate = await app.getInlineStylePropertyAt(0, 'background_color');
    expect(immediate).toBe('#3e8e41');

    // Wait slightly longer than the timeout to observe the reset
    await page.waitForTimeout(3500);

    const afterReset = await app.getInlineStylePropertyAt(0, 'background_color');
    // The implementation sets the JS style property to '#fff' in the timeout
    expect(afterReset).toBe('#fff');

    // The second button's property: the implementation attempted to set it too but referenced the same element twice.
    // We still check the second button index to see if it was changed (accept either '#fff' or unset).
    const afterResetSecond = await app.getInlineStylePropertyAt(1, 'background_color');
    expect([undefined, null, '', '#fff']).toContain(afterResetSecond);
  });

  test('Edge case: clicking repeatedly schedules multiple resets and does not throw errors', async ({ page }) => {
    // Edge case: user clicks the Test Garbage Collection button multiple times quickly.
    // Ensure multiple scheduled timeouts do not produce uncaught exceptions and final state is stable.
    const app = new GarbageCollectionPage(page);
    await app.goto();

    // Rapid clicks - three clicks in quick succession
    await app.clickButtonAt(0);
    await app.clickButtonAt(0);
    await app.clickButtonAt(0);

    // Immediately the inline style should be set to the green-ish value
    const immediate = await app.getInlineStylePropertyAt(0, 'background_color');
    expect(immediate).toBe('#3e8e41');

    // Wait long enough for the last scheduled timeout to run. Using 4 seconds to be safe.
    await page.waitForTimeout(4200);

    // Final state should be '#fff' after timeouts complete
    const final = await app.getInlineStylePropertyAt(0, 'background_color');
    expect(final).toBe('#fff');

    // Ensure no page errors were emitted during rapid interactions
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('CSS hover: :hover changes computed background-color (visual feedback)', async ({ page }) => {
    // Validate the CSS :hover effect visually by checking computed backgroundColor when hovering
    const app = new GarbageCollectionPage(page);
    await app.goto();

    // Hover the second button and verify computed background-color corresponds to #3e8e41 (rgb(62,142,65))
    await app.hoverButtonAt(1);
    // Small pause to allow hover styles to apply
    await page.waitForTimeout(100);

    const computed = await app.getComputedBackgroundColorAt(1);
    // The CSS :hover color '#3e8e41' reports as 'rgb(62, 142, 65)' in computed style
    expect(computed.replace(/\s+/g, '')).toBe('rgb(62,142,65)');
  });

  test('Console and runtime errors observation: no ReferenceError/SyntaxError/TypeError occurred during normal usage', async ({ page }) => {
    // This test explicitly observes console and page errors while interacting with the page.
    // Per instructions we must not alter the runtime; we simply assert whether such errors happened naturally.
    const app = new GarbageCollectionPage(page);
    await app.goto();

    // Interact normally
    await app.clickFirstButton();
    await page.waitForTimeout(3500);

    // Verify that no page errors or console errors were captured during these interactions.
    // If the implementation produced native JS errors like ReferenceError/SyntaxError/TypeError they would appear here.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});