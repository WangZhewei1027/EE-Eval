import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a5861-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Monitor application
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.monitor = page.locator('#monitor');
    this.input = page.locator('input[type="text"]');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure monitor is present before proceeding
    await expect(this.monitor).toBeVisible();
  }

  // Returns the count of direct child nodes of #monitor
  async monitorChildCount() {
    return await this.page.evaluate(() => {
      const monitor = document.getElementById('monitor');
      return monitor ? monitor.childNodes.length : 0;
    });
  }

  // Returns an array of text contents of direct child nodes (string representation)
  async monitorChildrenTextArray() {
    return await this.page.evaluate(() => {
      const monitor = document.getElementById('monitor');
      if (!monitor) return [];
      return Array.from(monitor.childNodes).map((n) => {
        // For element nodes, return their innerText, for text nodes use nodeValue
        if (n.nodeType === Node.TEXT_NODE) return n.nodeValue;
        return n.innerText ?? n.textContent ?? '';
      });
    });
  }

  // Returns info about the last child node of #monitor (nodeType, nodeName, nodeValue)
  async monitorLastChildInfo() {
    return await this.page.evaluate(() => {
      const monitor = document.getElementById('monitor');
      const last = monitor ? monitor.lastChild : null;
      if (!last) return null;
      return {
        nodeType: last.nodeType,
        nodeName: last.nodeName,
        nodeValue: last.nodeValue ?? null,
        textContent: last.textContent ?? null
      };
    });
  }

  async fillInput(value) {
    await this.input.fill(value);
  }

  // Focus input
  async focusInput() {
    await this.input.focus();
  }

  // Press Enter using keyboard. We call this to trigger document keydown listener.
  async pressEnter() {
    await this.page.keyboard.press('Enter');
  }

  // Click outside input to move focus away (body)
  async clickBody() {
    await this.page.locator('body').click();
  }

  // Get current input value
  async inputValue() {
    return await this.page.evaluate(() => {
      const input = document.querySelector('input[type="text"]');
      return input ? input.value : null;
    });
  }

  // Get placeholder text of input
  async inputPlaceholder() {
    return await this.page.evaluate(() => {
      const input = document.querySelector('input[type="text"]');
      return input ? input.getAttribute('placeholder') : null;
    });
  }

  // Get whether heading text "Monitor" exists
  async hasHeadingText() {
    return await this.page.evaluate(() => {
      const h = document.querySelector('#monitor h1');
      return !!(h && h.innerText.includes('Monitor'));
    });
  }
}

test.describe('Monitor - FSM: Idle -> TextDisplayed', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions on the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Test the Idle state initial render
  test('S0_Idle: initial render shows monitor, paragraph and input (entry action renderPage())', async ({ page }) => {
    const app = new MonitorPage(page);
    // Navigate to the page and allow scripts to run
    await app.goto();

    // Validate the monitor heading is present (visual/content evidence)
    expect(await app.hasHeadingText()).toBe(true);

    // Validate that the initial descriptive paragraph exists inside #monitor
    const children = await app.monitorChildrenTextArray();
    // We expect to see the heading text, paragraph text and an input element (input won't contribute textual label)
    // At least ensure one of the children contains the descriptive paragraph text
    const containsDescription = children.some((t) =>
      typeof t === 'string' && t.includes('This is a simple monitor application.')
    );
    expect(containsDescription).toBeTruthy();

    // Validate input exists with expected placeholder
    const placeholder = await app.inputPlaceholder();
    expect(placeholder).toBe('Enter text to display on the monitor');

    // As part of Idle state's entry action evidence, ensure that the DOM nodes expected are present
    const childCount = await app.monitorChildCount();
    // Expect at least 3 children: h1, p, input (the implementation actually appends another p then input, but we assert minimum)
    expect(childCount).toBeGreaterThanOrEqual(3);

    // Assert there were no runtime page errors or console errors during initial render
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Test the EnterPressed event & transition from Idle -> TextDisplayed
  test('EnterPressed: typing text and pressing Enter appends text node to monitor and clears input', async ({ page }) => {
    const app = new MonitorPage(page);
    await app.goto();

    // baseline child count
    const beforeCount = await app.monitorChildCount();

    // Type text into input and press Enter while input is focused
    const sampleText = 'Hello Monitor';
    await app.focusInput();
    await app.fillInput(sampleText);
    await app.pressEnter();

    // After pressing Enter, the implementation appends a text node (not an element) to #monitor
    const afterCount = await app.monitorChildCount();
    expect(afterCount).toBeGreaterThan(beforeCount);

    // Inspect lastChild details to ensure it's a Text node containing our text
    const last = await app.monitorLastChildInfo();
    expect(last).not.toBeNull();
    // Node type 3 is a Text node
    expect(last.nodeType).toBe(3);
    // The node value (text node) should include our sampleText
    expect(last.nodeValue).toBe(sampleText);

    // The input should be cleared after successful append
    const inputVal = await app.inputValue();
    expect(inputVal).toBe('');

    // Ensure no page console errors or uncaught exceptions occurred
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Edge case: pressing Enter when input contains only whitespace should not append text
  test('Edge case: Enter with whitespace-only input does not append text', async ({ page }) => {
    const app = new MonitorPage(page);
    await app.goto();

    // baseline child count
    const beforeCount = await app.monitorChildCount();

    // Enter whitespace in input and press Enter
    await app.focusInput();
    await app.fillInput('    ');
    await app.pressEnter();

    // No new text node should have been appended
    const afterCount = await app.monitorChildCount();
    expect(afterCount).toBe(beforeCount);

    // Input should be unchanged (implementation trims and only clears when non-empty; it doesn't clear on whitespace-only)
    // But the implementation only clears input when a non-empty text is appended; so input should still contain whitespace since no append occurred.
    const val = await app.inputValue();
    // It might still contain whitespace or remain as-is; assert that after trimming it's empty to reflect whitespace-only input
    expect(val.trim()).toBe('');

    // Ensure no runtime errors occurred
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Edge case: pressing Enter when focus is not on the input (listener is on document) should still read input value and append if non-empty
  test('EnterPressed when focus is not on input still triggers document listener and appends text', async ({ page }) => {
    const app = new MonitorPage(page);
    await app.goto();

    // baseline child count
    const beforeCount = await app.monitorChildCount();

    // Fill input but click body to move focus elsewhere
    const sampleText = 'FocusLostText';
    await app.fillInput(sampleText);
    // click body to blur input
    await app.clickBody();

    // Press Enter (listener is on document)
    await app.pressEnter();

    // Should have appended text node even though input lost focus
    const afterCount = await app.monitorChildCount();
    expect(afterCount).toBeGreaterThan(beforeCount);

    const last = await app.monitorLastChildInfo();
    expect(last).not.toBeNull();
    expect(last.nodeType).toBe(3);
    expect(last.nodeValue).toBe(sampleText);

    // Input should be cleared after append
    const inputVal = await app.inputValue();
    expect(inputVal).toBe('');

    // Ensure no runtime errors occurred
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // Negative scenario: pressing Enter with no input element present (simulate by removing input via page.evaluate)
  // NOTE: Requirement: Do NOT modify or patch broken code in the app. However, tests are allowed to exercise edge behavior.
  // We'll simulate removal to test how the document listener behaves when input is missing (should not throw).
  test('Error scenario: pressing Enter when input is missing should not throw (listener reads input safely)', async ({ page }) => {
    const app = new MonitorPage(page);
    await app.goto();

    // Remove the input element from the DOM to simulate a missing component
    await page.evaluate(() => {
      const input = document.querySelector('input[type="text"]');
      if (input && input.parentNode) input.parentNode.removeChild(input);
    });

    // Ensure input is indeed absent
    const inputExists = await page.$('input[type="text"]');
    expect(inputExists).toBeNull();

    // Press Enter and ensure no uncaught exceptions bubble up
    await page.keyboard.press('Enter');

    // Allow a microtask turn for any error to surface
    await page.waitForTimeout(50);

    // There should be no pageErrors or consoleErrors raised by removing the input and pressing Enter
    // If the application code attempted to access properties of a null input without checks, errors might appear here — we assert none occurred
    expect(pageErrors.length, `Unexpected page errors after pressing Enter with missing input: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors after pressing Enter with missing input: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Close the page (Playwright will usually handle this automatically)
    try {
      await page.close();
    } catch (e) {
      // ignore errors on close
    }
  });
});