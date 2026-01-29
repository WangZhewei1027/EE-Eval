import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2c0e3-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.content = page.locator('#demoContent');
  }

  // Navigate to the application and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the demo button
  async clickDemo() {
    await this.button.click();
  }

  // Returns whether the content is visible according to Playwright's visibility checks
  async isContentVisible() {
    return await this.content.isVisible();
  }

  // Returns the computed display style of the demo content (e.g., 'none' or 'block')
  async getContentComputedDisplay() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoContent');
      return window.getComputedStyle(el).display;
    });
  }

  // Returns the inline style.display property (may be '' if set via CSS)
  async getContentInlineDisplay() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demoContent');
      return el.style.display;
    });
  }

  // Returns the demo button text content
  async getButtonText() {
    return await this.button.innerText();
  }
}

test.describe('FSM: Understanding Version Control - Demo Toggle', () => {
  // Arrays to capture console messages and page errors during each test
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];
  let onConsole;
  let onPageError;

  test.beforeEach(async ({ page }) => {
    // Reset capture arrays
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Register listeners BEFORE navigation so we capture load-time issues
    onConsole = (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    };
    page.on('console', onConsole);

    onPageError = (err) => {
      pageErrors.push(err);
    };
    page.on('pageerror', onPageError);
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leaking between tests
    page.off('console', onConsole);
    page.off('pageerror', onPageError);

    // Assert there were no uncaught runtime errors during the test page lifecycle.
    // This validates that no ReferenceError, SyntaxError, TypeError or similar were thrown.
    // If any such errors were thrown during the test, fail here and include their messages.
    if (pageErrors.length > 0) {
      const messages = pageErrors.map(e => e.message).join('\n---\n');
      // Fail the test with meaningful diagnostics
      throw new Error(`Uncaught page errors were detected:\n${messages}`);
    }

    // Also fail if any console-level 'error' messages were emitted
    if (consoleErrors.length > 0) {
      const msgs = consoleMessages
        .filter(m => m.type === 'error')
        .map(m => m.text)
        .join('\n---\n');
      throw new Error(`Console 'error' messages were emitted:\n${msgs}`);
    }
  });

  test('Initial Idle state (S0_Idle): page renders and demo content is hidden', async ({ page }) => {
    // This test validates the Idle state: renderPage() should have rendered the UI elements,
    // the demo button must exist, and the demo content must be hidden by default.
    const demo = new DemoPage(page);
    await demo.goto();

    // Assertions for S0_Idle
    await expect(demo.button).toBeVisible({ timeout: 2000 }); // Button rendered
    const buttonText = await demo.getButtonText();
    expect(buttonText.trim()).toBe('Show Demo'); // Button text matches the FSM component

    // The demo content should NOT be visible initially (CSS sets display: none).
    const isVisible = await demo.isContentVisible();
    expect(isVisible).toBe(false);

    // Computed style should be 'none' because CSS sets .demo-content { display: none; }
    const computedDisplay = await demo.getContentComputedDisplay();
    expect(computedDisplay).toBe('none');

    // Inline style may be empty string initially; FSM evidence accepts empty or 'none' as hidden.
    const inlineDisplay = await demo.getContentInlineDisplay();
    expect(['', 'none']).toContain(inlineDisplay);
  });

  test('Transition S0_Idle -> S1_DemoVisible on ShowDemo click: content becomes visible', async ({ page }) => {
    // This test validates clicking the demo button when content is hidden should show it
    // and set inline style.display = 'block' as per the implementation.
    const demo = new DemoPage(page);
    await demo.goto();

    // Precondition: hidden
    expect(await demo.isContentVisible()).toBe(false);

    // Perform event: ShowDemo (click)
    await demo.clickDemo();

    // Postcondition: visible
    expect(await demo.isContentVisible()).toBe(true);

    // Computed style should be 'block'
    const computedDisplay = await demo.getContentComputedDisplay();
    expect(computedDisplay).toBe('block');

    // Inline style should be explicitly set to 'block' by the click handler
    const inlineDisplay = await demo.getContentInlineDisplay();
    expect(inlineDisplay).toBe('block');
  });

  test('Transition S1_DemoVisible -> S2_DemoHidden on ShowDemo click: content hides', async ({ page }) => {
    // Validate that clicking the button when demo is visible hides it (toggle behavior).
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure visible first by clicking once
    await demo.clickDemo();
    expect(await demo.isContentVisible()).toBe(true);

    // Now click to hide
    await demo.clickDemo();

    // Content should be hidden
    expect(await demo.isContentVisible()).toBe(false);

    // Computed style should be 'none'
    const computedDisplay = await demo.getContentComputedDisplay();
    expect(computedDisplay).toBe('none');

    // Inline style should be 'none' because click handler sets it so
    const inlineDisplay = await demo.getContentInlineDisplay();
    expect(inlineDisplay).toBe('none');
  });

  test('Transition S2_DemoHidden -> S1_DemoVisible on ShowDemo click: toggles back to visible', async ({ page }) => {
    // Validate toggling when content is hidden will make it visible again.
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure content is hidden (initial state)
    expect(await demo.isContentVisible()).toBe(false);

    // Click to show
    await demo.clickDemo();

    // Visible again
    expect(await demo.isContentVisible()).toBe(true);
    expect(await demo.getContentComputedDisplay()).toBe('block');
    expect(await demo.getContentInlineDisplay()).toBe('block');
  });

  test('Edge case: rapid multiple clicks should consistently toggle state (parity check)', async ({ page }) => {
    // This test simulates a user rapidly clicking the demo button multiple times.
    // The expected final state is based on parity: odd number of clicks => visible, even => hidden.
    const demo = new DemoPage(page);
    await demo.goto();

    // Number of rapid clicks
    const clicks = 7;
    for (let i = 0; i < clicks; i++) {
      // Rapid-fire clicks with very small delay
      await demo.clickDemo();
    }

    const shouldBeVisible = (clicks % 2) === 1;
    expect(await demo.isContentVisible()).toBe(shouldBeVisible);

    // Validate computed style matches expected visibility
    const computed = await demo.getContentComputedDisplay();
    if (shouldBeVisible) {
      expect(computed).toBe('block');
    } else {
      expect(computed).toBe('none');
    }
  });

  test('Validate FSM entry action side-effects: renderPage / showDemoContent / hideDemoContent equivalence', async ({ page }) => {
    // The FSM mentions entry actions: renderPage(), showDemoContent(), hideDemoContent().
    // We validate the observable side-effects that correspond to those functions:
    // - renderPage(): the button exists and content element exists
    // - showDemoContent(): content is visible and inline display === 'block'
    // - hideDemoContent(): content is hidden and inline display === 'none'
    const demo = new DemoPage(page);
    await demo.goto();

    // renderPage() side-effects
    await expect(demo.button).toBeVisible();
    await expect(demo.content).toHaveCount(1); // element exists in DOM

    // showDemoContent(): show by clicking
    await demo.clickDemo();
    expect(await demo.isContentVisible()).toBe(true);
    expect(await demo.getContentInlineDisplay()).toBe('block');

    // hideDemoContent(): hide by clicking again
    await demo.clickDemo();
    expect(await demo.isContentVisible()).toBe(false);
    expect(await demo.getContentInlineDisplay()).toBe('none');
  });

  test('Observe console and page errors during load and interaction', async ({ page }) => {
    // This test explicitly loads the page and performs a few interactions while capturing console
    // messages and page errors. It asserts that there are no uncaught page errors and no console
    // error-level messages. It also inspects for ReferenceError/SyntaxError/TypeError specifically.
    const demo = new DemoPage(page);

    // Navigate (listeners were registered in beforeEach)
    await demo.goto();

    // Interact a bit
    await demo.clickDemo(); // show
    await demo.clickDemo(); // hide

    // Analyze captured runtime issues
    // pageErrors is filled by beforeEach listener; it's checked again here for clearer test semantics.
    expect(pageErrors.length).toBe(0);

    // Filter console messages for error-level
    const consoleErrorTexts = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrorTexts.length).toBe(0);

    // Additionally ensure no console messages indicate ReferenceError/SyntaxError/TypeError
    const problematic = consoleMessages.filter(m =>
      /ReferenceError|SyntaxError|TypeError/.test(m.text)
    );
    expect(problematic.length).toBe(0);
  });

  test('Edge scenario: accessing computed style of a missing element should not modify app behavior', async ({ page }) => {
    // This test tries to read computed style of an element that does exist in this app.
    // It ensures that simply querying styles does not cause unexpected runtime errors.
    const demo = new DemoPage(page);
    await demo.goto();

    // Read computed style multiple times to ensure stability
    for (let i = 0; i < 3; i++) {
      const display = await demo.getContentComputedDisplay();
      expect(['none', 'block']).toContain(display);
    }

    // Confirm no runtime errors were emitted during these queries
    expect(pageErrors.length).toBe(0);
    const consoleErrorTexts = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrorTexts.length).toBe(0);
  });
});