import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d838d511-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page object model for the minimal interactive demonstration.
 * Encapsulates selectors and common operations for clarity and reuse.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoBtn');
    this.demo = page.locator('#demo');
    this.consoleMessages = [];
    this.pageErrors = [];
    this._consoleHandler = (msg) => {
      // store console entries for later assertions
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    };
    this._pageErrorHandler = (err) => {
      // store uncaught exceptions / page errors
      this.pageErrors.push(err);
    };
  }

  // Attach listeners prior to navigation to catch any load-time errors
  attachListeners() {
    this.page.on('console', this._consoleHandler);
    this.page.on('pageerror', this._pageErrorHandler);
  }

  // Remove listeners for clean teardown
  detachListeners() {
    this.page.off('console', this._consoleHandler);
    this.page.off('pageerror', this._pageErrorHandler);
  }

  // Navigate to the application and wait for stable load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Return visible state of demo (computed style)
  async isDemoVisible() {
    // Use getComputedStyle to reflect actual rendered display value
    return await this.demo.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  // Return inline style attribute value for demo
  async demoStyleAttribute() {
    return await this.demo.getAttribute('style');
  }

  // Return button text content trimmed
  async buttonText() {
    const text = await this.button.textContent();
    return text ? text.trim() : '';
  }

  // Click the toggle button
  async clickButton() {
    await this.button.click();
  }

  // Convenience to wait a short time for UI updates (used when simulating rapid interactions)
  async smallDelay(ms = 50) {
    await this.page.waitForTimeout(ms);
  }

  // Helpers to expose captured logs/errors for assertions
  getConsoleErrors() {
    return this.consoleMessages.filter((m) => m.type === 'error');
  }
  getConsoleWarnings() {
    return this.consoleMessages.filter((m) => m.type === 'warning');
  }
  getAllConsoleMessages() {
    return this.consoleMessages;
  }
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('FSM: HTTP simulated GET/response toggle (d838d511-fa7b-11f0-b314-ad8654ee5de8)', () => {
  let demoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    // Attach listeners before navigation to capture load/runtime issues
    demoPage.attachListeners();
    await demoPage.goto();
    // We expect the initial UI to be rendered synchronously; ensure DOM present
    await demoPage.button.waitFor({ state: 'visible' });
  });

  test.afterEach(async ({ page }) => {
    // Always detach listeners to avoid cross-test bleed
    demoPage.detachListeners();

    // Observe any console errors or uncaught page errors and assert none occurred.
    // The application is simple and should not produce runtime errors; these assertions
    // ensure regressions (like ReferenceError, SyntaxError, TypeError) will be caught.
    const pageErrors = demoPage.getPageErrors();
    const consoleErrors = demoPage.getConsoleErrors();

    // If there are page errors or console errors, emit them in the assertion message to aid debugging.
    expect(pageErrors.length, `Expected no uncaught page errors, found: ${pageErrors.length}. Errors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, found: ${consoleErrors.length}. Messages: ${consoleErrors.map(m => m.text).join(' | ')}`).toBe(0);

    // Additionally assert there are no severe console warnings (optional but useful)
    const consoleWarnings = demoPage.getConsoleWarnings();
    expect(consoleWarnings.length, `Expected no console.warn messages, found: ${consoleWarnings.length}. Warnings: ${consoleWarnings.map(m => m.text).join(' | ')}`).toBe(0);
  });

  test('Initial Idle state: button rendered and demo hidden (S0_Idle)', async () => {
    // Validate initial FSM Idle state evidence:
    // - The button exists, has correct id/class and initial text.
    // - The demo area exists and is hidden (display:none inline style).
    // - No runtime errors occurred during initial render (checked in afterEach).

    // Button presence and attributes
    await expect(demoPage.button).toBeVisible();
    const btnText = await demoPage.buttonText();
    expect(btnText).toBe('Show simulated GET/response');

    // Check class attribute includes 'btn'
    const btnClass = await demoPage.button.getAttribute('class');
    expect(btnClass).toContain('btn');

    // Demo area should exist but be hidden
    await expect(demoPage.demo).toBeVisible(); // locator exists in DOM; toBeVisible respects CSS; we will check computed style next
    const isVisible = await demoPage.isDemoVisible();
    expect(isVisible).toBe(false);

    // Check inline style attribute contains 'display:none'
    const styleAttr = await demoPage.demoStyleAttribute();
    expect(styleAttr).toContain('display:none');
  });

  test('Transition S0 -> S1: clicking button shows simulated response and updates button text', async () => {
    // Clicking the demo button toggles the demo display to 'block' and button text to 'Hide ...'
    await demoPage.clickButton();
    // Wait a tick for UI update
    await demoPage.smallDelay();

    // After click, demo should be visible (computed style)
    const visible = await demoPage.isDemoVisible();
    expect(visible, 'Demo area should be visible after click').toBe(true);

    // Button text should update to hide label
    const btnTextAfter = await demoPage.buttonText();
    expect(btnTextAfter).toBe('Hide simulated GET/response');

    // Validate content inside demo area to ensure entry action shows expected content
    const demoText = await demoPage.demo.textContent();
    expect(demoText).toContain('GET /articles/42');
    expect(demoText).toContain('HTTP/1.1 200 OK');
    expect(demoText).toContain('ETag: "article42-v1"');
  });

  test('Transition S1 -> S0: clicking button again hides simulated response and restores button text', async () => {
    // Ensure initial click to show
    await demoPage.clickButton();
    await demoPage.smallDelay();
    // Click again to hide
    await demoPage.clickButton();
    await demoPage.smallDelay();

    // Demo should be hidden again
    const visibleAfter = await demoPage.isDemoVisible();
    expect(visibleAfter, 'Demo area should be hidden after second click').toBe(false);

    // Button text should be restored to show label
    const btnTextRestored = await demoPage.buttonText();
    expect(btnTextRestored).toBe('Show simulated GET/response');
  });

  test('Multiple toggles maintain consistent state (idempotency across transitions)', async () => {
    // Repeatedly toggle and validate state alternates correctly.
    const cycles = 4;
    for (let i = 0; i < cycles; i++) {
      await demoPage.clickButton();
      await demoPage.smallDelay(30);
      const visible = await demoPage.isDemoVisible();
      const expectedVisible = (i % 2) === 0; // first click -> visible
      expect(visible, `After click ${i + 1}, expected visible=${expectedVisible}`).toBe(expectedVisible);

      const text = await demoPage.buttonText();
      if (expectedVisible) {
        expect(text).toBe('Hide simulated GET/response');
      } else {
        expect(text).toBe('Show simulated GET/response');
      }
    }

    // Final state should match parity of cycles
    const finalVisible = await demoPage.isDemoVisible();
    const expectedFinalVisible = (cycles % 2) === 1;
    expect(finalVisible).toBe(expectedFinalVisible);
  });

  test('Rapid user interaction (double-click) should result in a coherent final state', async () => {
    // Simulate a rapid double-click; UI should resolve to either visible or hidden consistently.
    // We don't assert which one specifically (this depends on event ordering), but verify DOM integrity and button text correspond.
    await demoPage.button.dblclick();
    // small wait to allow handlers to run
    await demoPage.smallDelay(100);

    // After rapid interaction, ensure demo exists and button text matches demo visibility
    const visible = await demoPage.isDemoVisible();
    const btnText = await demoPage.buttonText();
    if (visible) {
      expect(btnText).toBe('Hide simulated GET/response');
    } else {
      expect(btnText).toBe('Show simulated GET/response');
    }
  });

  test('DOM integrity: toggling does not remove elements or alter non-target attributes', async () => {
    // Capture references to nodes and attributes before toggles
    const originalBtnClass = await demoPage.button.getAttribute('class');
    const originalDemoClass = await demoPage.demo.getAttribute('class');

    // Toggle visible
    await demoPage.clickButton();
    await demoPage.smallDelay();

    // Toggle hidden
    await demoPage.clickButton();
    await demoPage.smallDelay();

    // Ensure elements still present and classes unchanged (aside from textContent/style)
    await expect(demoPage.button).toBeVisible();
    await expect(demoPage.demo).toBeVisible(); // locator exists; computed may be hidden
    const btnClassNow = await demoPage.button.getAttribute('class');
    const demoClassNow = await demoPage.demo.getAttribute('class');

    expect(btnClassNow).toBe(originalBtnClass);
    expect(demoClassNow).toBe(originalDemoClass);

    // Ensure no attributes other than inline style/textContent were mutated unexpectedly
    const demoStyleNow = await demoPage.demo.getAttribute('style');
    // style may change between display:none and display:block; ensure there is a style attribute and it does not remove the element
    expect(demoStyleNow).not.toBeNull();
  });

  test('Edge case: clicking when inline style is manipulated externally (simulate unexpected state)', async ({ page }) => {
    // We must not patch application code, but we can mutate the DOM as an external actor to simulate edge case conditions.
    // Note: This does not modify application logic; it simulates a user/extension changing inline styles before a click.
    // Set the demo inline style to an unexpected value and then trigger the button to see how the app behaves.
    await page.evaluate(() => {
      const demo = document.getElementById('demo');
      if (demo) {
        demo.setAttribute('style', 'display:inline-block');
      }
    });

    // Now click the toggle button - app's logic checks for demo.style.display === 'none', so this should be treated as visible state and result in hiding the demo.
    await demoPage.clickButton();
    await demoPage.smallDelay();

    const visible = await demoPage.isDemoVisible();
    const btnText = await demoPage.buttonText();

    // Because prior style is not 'none', the code should take the else branch and hide the demo.
    expect(visible).toBe(false);
    expect(btnText).toBe('Show simulated GET/response');
  });

  test('Accessibility & content checks: labels and simulated content present when visible', async () => {
    // Ensure the demo content contains the educational strings described in FSM evidence.
    await demoPage.clickButton();
    await demoPage.smallDelay();

    const demoText = await demoPage.demo.textContent();
    // Check multiple expected pieces of content
    expect(demoText).toContain('Simulated client request');
    expect(demoText).toContain('Simulated server response');
    expect(demoText).toContain('GET /articles/42');
    expect(demoText).toContain('HTTP/1.1 200 OK');
    // also check the tip is present
    expect(demoText).toContain('Tip: Compare this with real responses using curl -v or browser devtools.');
  });
});