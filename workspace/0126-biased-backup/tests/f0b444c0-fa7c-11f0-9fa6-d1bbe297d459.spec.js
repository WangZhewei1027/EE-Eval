import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b444c0-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.output = page.locator('#demoOutput');
  }

  // Open the application page
  async open() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the Run Socket Simulation button
  async clickRun() {
    await this.button.click();
  }

  // Returns true if the output element has inline style display: block
  async isOutputInlineDisplayBlock() {
    return await this.page.evaluate(() => {
      const output = document.getElementById('demoOutput');
      return output && output.style && output.style.display === 'block';
    });
  }

  // Returns whether the output element is visible (computed style)
  async isOutputVisible() {
    return await this.page.evaluate(() => {
      const output = document.getElementById('demoOutput');
      if (!output) return false;
      const cs = window.getComputedStyle(output);
      return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    });
  }

  // Get the raw innerHTML of the output element
  async getOutputInnerHTML() {
    return await this.page.evaluate(() => {
      const output = document.getElementById('demoOutput');
      return output ? output.innerHTML : null;
    });
  }

  // Get the innerText (rendered) of the output element
  async getOutputInnerText() {
    return await this.page.evaluate(() => {
      const output = document.getElementById('demoOutput');
      return output ? output.innerText : null;
    });
  }

  // Count occurrences of a substring in the output innerHTML
  async countOutputOccurrences(substr) {
    return await this.page.evaluate((s) => {
      const output = document.getElementById('demoOutput');
      if (!output) return 0;
      const html = output.innerHTML;
      if (!s) return 0;
      let count = 0;
      let idx = 0;
      while ((idx = html.indexOf(s, idx)) !== -1) {
        count++;
        idx += s.length;
      }
      return count;
    }, substr);
  }
}

test.describe('Socket Simulation FSM (Comprehensive)', () => {
  // Captured console error messages and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize arrays to collect console errors and page errors
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and page errors but do NOT modify page behavior
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // If any unexpected error in listener, still allow test to proceed
      }
    });

    page.on('pageerror', err => {
      // Capture runtime exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown on the page itself; the Playwright runner handles cleanup.
    // We keep this hook to satisfy the requirement for setup/teardown structure.
  });

  test('Idle state initial UI - button present and output hidden', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle)
    // - The demo button must exist with correct text
    // - The demo output must be present in DOM but hidden (display: none)
    const demo = new DemoPage(page);
    await demo.open();

    // Button exists and has expected text
    await expect(demo.button).toHaveCount(1);
    await expect(demo.button).toHaveText('Run Socket Simulation');

    // Output exists but is hidden by default
    await expect(demo.output).toHaveCount(1);
    // Ensure computed visibility indicates hidden
    const visible = await demo.isOutputVisible();
    expect(visible).toBe(false);

    // Inline style should be empty initially
    const inlineDisplay = await page.evaluate(() => {
      const o = document.getElementById('demoOutput');
      return o ? o.style.display : undefined;
    });
    expect(inlineDisplay === '' || inlineDisplay === undefined).toBe(true);

    // No console errors or page errors should have occurred just by loading
    expect(consoleErrors.length, 'console error messages on page load').toBe(0);
    expect(pageErrors.length, 'page runtime errors on page load').toBe(0);
  });

  test('Transition: ButtonClick -> SimulationRunning executes entry actions and shows expected output lines in order', async ({ page }) => {
    // This test validates:
    // - Clicking the demoButton triggers the transition to SimulationRunning (S1_SimulationRunning)
    // - Entry actions set inline display:block and initial innerHTML
    // - All expected evidence lines are present and appear in the expected order
    const demo = new DemoPage(page);
    await demo.open();

    // Click the button to trigger simulation
    await demo.clickRun();

    // Verify inline style set by entry action
    const inlineDisplayBlock = await demo.isOutputInlineDisplayBlock();
    expect(inlineDisplayBlock).toBe(true);

    // Verify computed visibility is visible
    const visible = await demo.isOutputVisible();
    expect(visible).toBe(true);

    // Verify initial prefix produced by entry action exists
    const html = await demo.getOutputInnerHTML();
    expect(html).toBeTruthy();
    expect(html.startsWith('<strong>Simulation Output:</strong><br><br>')).toBe(true);

    // Evidence lines that must appear in the output (in order)
    const expectedLines = [
      'Server: Socket created<br>',
      'Server: Bound to port 8080<br>',
      'Server: Listening for connections...<br><br>',
      'Client: Socket created<br>',
      'Client: Connecting to server at 127.0.0.1:8080<br>',
      'Server: Accepted connection from client<br><br>',
      'Client: Sending message "Hello Server!"<br>',
      'Server: Received message: "Hello Server!"<br>',
      'Server: Sending response "Hello Client!"<br>',
      'Client: Received response: "Hello Client!"<br><br>',
      'Client: Closing connection<br>',
      'Server: Connection closed<br>'
    ];

    // Validate each expected substring exists and that order is preserved
    let lastIndex = -1;
    for (const line of expectedLines) {
      const idx = html.indexOf(line);
      expect(idx, `expected line "${line}" to be present`).toBeGreaterThanOrEqual(0);
      // Ensure ordering
      expect(idx).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = idx;
    }

    // Also verify the rendered text contains key phrases (sanity check for innerText)
    const text = await demo.getOutputInnerText();
    expect(text).toContain('Simulation Output:');
    expect(text).toContain('Server: Socket created');
    expect(text).toContain('Client: Sending message "Hello Server!"');

    // Confirm no console errors nor runtime page errors occurred during the click/transition
    expect(consoleErrors.length, 'no console errors during simulation run').toBe(0);
    expect(pageErrors.length, 'no runtime errors during simulation run').toBe(0);
  });

  test('Edge case: Re-clicking the button resets the simulation output (idempotent behavior)', async ({ page }) => {
    // This test checks what happens when the user clicks the Run button multiple times.
    // The current implementation resets output.innerHTML at the start of click handler,
    // so the output should reflect a fresh simulation after each click (not accumulate).
    const demo = new DemoPage(page);
    await demo.open();

    // First click
    await demo.clickRun();
    const htmlAfterFirst = await demo.getOutputInnerHTML();
    expect(htmlAfterFirst).toBeTruthy();

    // Capture counts of a few distinctive substrings after first click
    const countSendingFirst = await demo.countOutputOccurrences('Client: Sending message "Hello Server!"<br>');
    expect(countSendingFirst).toBe(1);

    // Second click: should reset and produce one set of lines again (not append)
    await demo.clickRun();
    const htmlAfterSecond = await demo.getOutputInnerHTML();
    expect(htmlAfterSecond).toBeTruthy();

    // Ensure the HTML after the second click is equal to or reflective of a fresh simulation (not doubled)
    const countSendingSecond = await demo.countOutputOccurrences('Client: Sending message "Hello Server!"<br>');
    expect(countSendingSecond).toBe(1);

    // Confirm the HTML after the second click includes the initial strong prefix again
    expect(htmlAfterSecond.startsWith('<strong>Simulation Output:</strong><br><br>')).toBe(true);

    // Optionally, ensure that the content after second click is identical to after first click
    // (implementation resets and then appends identical lines each time)
    expect(htmlAfterSecond).toBe(htmlAfterFirst);

    // No console errors or runtime errors produced by repeated activation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Accessibility & interactive sanity: button is enabled/focusable and output area updates reflect DOM changes', async ({ page }) => {
    // This test ensures the interactive controls are usable and DOM updates are observable to assistive tech
    const demo = new DemoPage(page);
    await demo.open();

    // Button should be enabled and focusable
    await demo.button.focus();
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.id === 'demoButton');
    expect(focused).toBe(true);

    // Click and assert DOM mutation is observable via MutationObserver (sanity check)
    // We will install a small MutationObserver in the page context that reports whether innerHTML changed
    const changed = await page.evaluate(() => {
      return new Promise(resolve => {
        const output = document.getElementById('demoOutput');
        if (!output) return resolve(false);
        const mo = new MutationObserver(() => {
          mo.disconnect();
          resolve(true);
        });
        mo.observe(output, { childList: true, subtree: true, characterData: true });
        // Trigger the existing click handler
        const btn = document.getElementById('demoButton');
        if (!btn) {
          mo.disconnect();
          resolve(false);
        } else {
          btn.click();
        }
        // Fallback timeout in case something goes wrong
        setTimeout(() => {
          try { mo.disconnect(); } catch (e) {}
          resolve(false);
        }, 1000);
      });
    });
    expect(changed).toBe(true);

    // No errors caused by this interactivity
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Negative scenario: validate that no unexpected runtime exceptions (ReferenceError/TypeError/SyntaxError) occurred during full interaction flow', async ({ page }) => {
    // This test intentionally aggregates the flow and asserts that no page-level exceptions were triggered.
    const demo = new DemoPage(page);
    await demo.open();

    // Simulate the full user journey: click, then click again, then read output
    await demo.clickRun();
    await demo.clickRun(); // second click should be handled gracefully by the app

    // After interactions, ensure no page runtime errors captured
    // (This allows ReferenceError, TypeError, SyntaxError to surface naturally if present;
    //  our assertion verifies that none were produced in this case.)
    expect(pageErrors.length, 'no runtime exceptions (ReferenceError/TypeError/SyntaxError)').toBe(0);

    // Additionally assert no console error messages
    expect(consoleErrors.length, 'no console.error messages during interactions').toBe(0);
  });
});