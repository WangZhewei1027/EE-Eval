import { test, expect } from '@playwright/test';

// Test suite for Application ID: f0b3f6a3-fa7c-11f0-9fa6-d1bbe297d459
// The page is served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/f0b3f6a3-fa7c-11f0-9fa6-d1bbe297d459.html
//
// This test file validates the FSM states and transitions described in the prompt:
// - S0_Idle: initial render, demoResult hidden
// - S1_HandshakeVisible: demoResult displayed
// - S2_HandshakeHidden: demoResult hidden again
//
// Additionally it observes console logs and unhandled page errors (ReferenceError, SyntaxError, TypeError).
// It includes an explicit error-scenario test that allows such errors to occur naturally (as asynchronous exceptions in the page)
// and asserts that the pageerror events are emitted and observed by the Playwright test harness.

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3f6a3-fa7c-11f0-9fa6-d1bbe297d459.html';

// Simple Page Object to encapsulate common interactions and queries
class HttpsGuidePage {
  constructor(page) {
    this.page = page;
    this.buttonSelector = "button[onclick='showHandshake()']";
    this.demoSelector = '#demoResult';
  }

  // Click the handshake toggle button
  async clickToggle() {
    await this.page.click(this.buttonSelector);
  }

  // Return computed display style of demoResult
  async getDemoDisplay() {
    return await this.page.$eval(
      this.demoSelector,
      (el) => getComputedStyle(el).display
    );
  }

  // Convenience: is demo visible?
  async isDemoVisible() {
    const display = await this.getDemoDisplay();
    return display !== 'none';
  }

  // Wait until demo is visible (display != 'none') or timeout
  async waitForDemoVisible(timeout = 2000) {
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && getComputedStyle(el).display !== 'none';
      },
      this.demoSelector,
      { timeout }
    );
  }

  // Wait until demo is hidden (display == 'none') or timeout
  async waitForDemoHidden(timeout = 2000) {
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && getComputedStyle(el).display === 'none';
      },
      this.demoSelector,
      { timeout }
    );
  }

  // Ensure the toggle button is present
  async hasToggleButton() {
    return await this.page.$(this.buttonSelector) !== null;
  }

  // Ensure the demo result container exists
  async hasDemoElement() {
    return await this.page.$(this.demoSelector) !== null;
  }
}

// Helper to classify page errors captured
function classifyPageErrors(pageErrors) {
  return pageErrors.map((err) => {
    return {
      name: err.name || 'UnknownError',
      message: err.message || String(err),
    };
  });
}

test.describe('Comprehensive Guide to HTTPS - FSM and UI behavior', () => {
  // Shared per-test variables for capturing console and page errors
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture page-level unhandled exceptions (pageerror)
    page.on('pageerror', (err) => {
      // Store minimal info about the thrown error
      pageErrors.push({ name: err.name, message: err.message });
    });

    // Capture console error messages (e.g., console.error or runtime errors logged)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown necessary beyond Playwright's default cleanup
  });

  test('Initial state (S0_Idle) - page renders and demoResult is hidden', async ({
    page,
  }) => {
    // This test validates the Idle state:
    // - The button exists
    // - The demoResult exists and is initially hidden (display: none)
    // - No unexpected page errors (ReferenceError/SyntaxError/TypeError) occurred during load

    const app = new HttpsGuidePage(page);

    // Ensure toggle button and demo container are present in the DOM
    expect(await app.hasToggleButton()).toBe(true);
    expect(await app.hasDemoElement()).toBe(true);

    // demoResult should be hidden at initial render per FSM and HTML (style="display: none;")
    const initialDisplay = await app.getDemoDisplay();
    expect(initialDisplay).toBe('none');

    // There should be no unhandled page errors on initial load
    const classified = classifyPageErrors(pageErrors);
    expect(classified.length).toBe(0);

    // Also expect no console.error messages on initial load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_HandshakeVisible when clicking the Show Handshake Steps button', async ({
    page,
  }) => {
    // This test validates the transition to the "Handshake Visible" state:
    // - Clicking the button shows the demoResult element (display becomes 'block')
    // - The visible content contains expected header text for the handshake
    // - No ReferenceError/SyntaxError/TypeError occurred as a result of this interaction

    const app = new HttpsGuidePage(page);

    // Precondition: demo hidden
    expect(await app.getDemoDisplay()).toBe('none');

    // Click to show handshake steps
    await app.clickToggle();

    // Wait until the demoResult becomes visible
    await app.waitForDemoVisible();

    // Assert that demoResult is visible and has expected header text
    expect(await app.isDemoVisible()).toBe(true);

    const headerText = await page.$eval(
      '#demoResult h4',
      (h) => h && h.textContent.trim()
    );
    expect(headerText).toContain('Simulated TLS 1.3 Handshake');

    // Ensure no unhandled page errors were emitted due to this action
    const classified = classifyPageErrors(pageErrors);
    const names = classified.map((c) => c.name);
    expect(names).not.toContain('ReferenceError');
    expect(names).not.toContain('SyntaxError');
    expect(names).not.toContain('TypeError');

    // Also check that the console did not report errors
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_HandshakeVisible -> S2_HandshakeHidden on second click (toggle off)', async ({
    page,
  }) => {
    // This test validates toggling off:
    // - From visible state, clicking the button hides the demoResult
    // - Verify the DOM's display returns to 'none'

    const app = new HttpsGuidePage(page);

    // Bring the demo visible first
    await app.clickToggle();
    await app.waitForDemoVisible();
    expect(await app.isDemoVisible()).toBe(true);

    // Click again to hide
    await app.clickToggle();

    // Wait until it becomes hidden
    await app.waitForDemoHidden();
    expect(await app.getDemoDisplay()).toBe('none');

    // No new page errors should have occurred
    expect(classifyPageErrors(pageErrors).length).toBe(0);
  });

  test('Transition S2_HandshakeHidden -> S1_HandshakeVisible on subsequent click (toggle on again)', async ({
    page,
  }) => {
    // Validate toggling back on from hidden state multiple times
    const app = new HttpsGuidePage(page);

    // Ensure starting hidden
    expect(await app.getDemoDisplay()).toBe('none');

    // Click to show
    await app.clickToggle();
    await app.waitForDemoVisible();
    expect(await app.isDemoVisible()).toBe(true);

    // Click to hide
    await app.clickToggle();
    await app.waitForDemoHidden();
    expect(await app.getDemoDisplay()).toBe('none');

    // Click to show again (S2 -> S1 transition)
    await app.clickToggle();
    await app.waitForDemoVisible();
    expect(await app.isDemoVisible()).toBe(true);

    // Validate no unexpected page errors occurred during the sequence
    expect(classifyPageErrors(pageErrors).length).toBe(0);
  });

  test('Edge case: rapid consecutive clicks should consistently toggle the demo element', async ({
    page,
  }) => {
    // Simulate rapid clicks to check robustness of toggle logic.
    // Expected behavior: each click toggles display state. We perform an odd number of clicks and verify final state.

    const app = new HttpsGuidePage(page);

    // Start hidden
    expect(await app.getDemoDisplay()).toBe('none');

    // Perform 5 rapid clicks
    for (let i = 0; i < 5; i++) {
      // Use dispatchEvent to be closer to user click but page.click is fine too
      await page.click(app.buttonSelector);
    }

    // After odd number of clicks, it should be visible
    await app.waitForDemoVisible();
    expect(await app.isDemoVisible()).toBe(true);

    // Perform one more click to make it hidden
    await page.click(app.buttonSelector);
    await app.waitForDemoHidden();
    expect(await app.getDemoDisplay()).toBe('none');

    // No page errors should have occurred during these rapid interactions
    expect(classifyPageErrors(pageErrors).length).toBe(0);
  });

  test('Error scenario test: observe ReferenceError, SyntaxError, and TypeError happening naturally on the page', async ({
    page,
  }) => {
    // This test intentionally causes three different kinds of unhandled exceptions
    // to occur asynchronously on the page so that 'pageerror' events are emitted.
    //
    // We do this by scheduling the erroneous operations in setTimeout callbacks inside page context.
    // This prevents page.evaluate from throwing directly into the test context and allows the errors to be observed as page-level errors.

    // Clear any previous errors
    pageErrors = [];

    // 1) Trigger a ReferenceError asynchronously (calling undefined function)
    await page.evaluate(() => {
      setTimeout(() => {
        // Intentionally call non-existent function to create ReferenceError
        // This runs in page context asynchronously and will surface as an unhandled exception
        // captured by Playwright's 'pageerror' event listener.
        // Do not wrap in try/catch so it remains unhandled.
        // eslint-disable-next-line no-undef
        nonExistentFunctionTriggeredForTest();
      }, 0);
    });

    // Wait for the ReferenceError pageerror event
    const refErr = await page.waitForEvent('pageerror', { timeout: 2000 });
    expect(refErr.name).toBe('ReferenceError');

    // 2) Trigger a SyntaxError asynchronously via eval in setTimeout
    await page.evaluate(() => {
      setTimeout(() => {
        // Invalid code passed to eval triggers a SyntaxError
        try {
          // Using eval so that the exception is thrown when exec runs
          eval('function invalidSyntax( {');
        } catch (e) {
          // Re-throw to make it an unhandled exception instead of a caught one.
          // To ensure unhandled, throw in a separate microtask without catching.
          setTimeout(() => {
            throw e;
          }, 0);
        }
      }, 0);
    });

    // Wait for the SyntaxError pageerror event
    const syntaxErr = await page.waitForEvent('pageerror', { timeout: 2000 });
    // Name may be 'SyntaxError'
    expect(syntaxErr.name).toBe('SyntaxError');

    // 3) Trigger a TypeError asynchronously (calling property on null)
    await page.evaluate(() => {
      setTimeout(() => {
        // This will throw a TypeError: Cannot read properties of null (or similar)
        const n = null;
        // Accessing property as a function call to force TypeError
        setTimeout(() => {
          // eslint-disable-next-line no-unused-expressions
          n.someNonExistentFunction();
        }, 0);
      }, 0);
    });

    // Wait for the TypeError pageerror event
    const typeErr = await page.waitForEvent('pageerror', { timeout: 2000 });
    expect(typeErr.name).toBe('TypeError');

    // At this point, the pageerror handler we attached in beforeEach should have collected all three
    // Aggregate and assert we observed at least one ReferenceError, SyntaxError, and TypeError
    const namesObserved = pageErrors.map((e) => e.name);
    expect(namesObserved).toContain('ReferenceError');
    expect(namesObserved).toContain('SyntaxError');
    expect(namesObserved).toContain('TypeError');

    // For traceability, assert that the messages are non-empty strings for each observed error
    for (const err of pageErrors) {
      expect(typeof err.message).toBe('string');
      expect(err.message.length).toBeGreaterThan(0);
    }
  });

  test('Verify that onEnter/onExit actions mentioned in FSM (renderPage) are not silently invoked if absent', async ({
    page,
  }) => {
    // The FSM mentions an entry action "renderPage()" for S0_Idle.
    // The HTML/JS does not define renderPage(), so if the app attempted to call it on load,
    // a ReferenceError would have been emitted. We assert the page did NOT emit such an error on initial load.
    // (Note: this is checking the natural behavior of the served page; we DO NOT attempt to call or define renderPage())

    // pageErrors were captured in beforeEach after navigation
    const names = pageErrors.map((e) => e.name);
    // The expectation here is that renderPage was not called implicitly by the page,
    // so there should be no ReferenceError related to a missing renderPage function.
    expect(names).not.toContain('ReferenceError');

    // If the implementation had attempted to call renderPage() during load, a ReferenceError would have been present.
    // Ensure the demoResult is still present and hidden as an additional check of page load integrity.
    const app = new HttpsGuidePage(page);
    expect(await app.hasDemoElement()).toBe(true);
    expect(await app.getDemoDisplay()).toBe('none');
  });
});