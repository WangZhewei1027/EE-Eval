import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d832ba90-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#demoBtn';
    this.areaSelector = '#demoArea';
    this.logSelector = '#demoLog';
    this.headingSelector = 'h1';
    this.demoSvgSelector = '#demoSvg';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // returns the heading text
  async headingText() {
    return this.page.textContent(this.headingSelector);
  }

  // return attribute value on demo button
  async demoButtonAriaPressed() {
    return this.page.getAttribute(this.buttonSelector, 'aria-pressed');
  }

  // return aria-hidden of demo area
  async demoAreaAriaHidden() {
    return this.page.getAttribute(this.areaSelector, 'aria-hidden');
  }

  // return computed display style of demo area
  async demoAreaDisplay() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue('display');
    }, this.areaSelector);
  }

  // click the demo toggle button
  async toggleDemo() {
    await this.page.click(this.buttonSelector);
  }

  // get demo log text content
  async demoLogText() {
    return this.page.textContent(this.logSelector);
  }

  // check whether demo SVG exists in DOM
  async hasDemoSvg() {
    return this.page.$(this.demoSvgSelector) !== null;
  }

  // raw page HTML
  async pageContent() {
    return this.page.content();
  }
}

test.describe('Circular Linked List demo — FSM state & transitions', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console events
    page._consoleMessages = [];
    page.on('console', (msg) => {
      // Store text and type for analysis in tests
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (ReferenceError, TypeError, SyntaxError, runtime errors)
    page._pageErrors = [];
    page.on('pageerror', (err) => {
      page._pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // If there were page errors, print them into the test output (Playwright will show failures).
    if (page._pageErrors && page._pageErrors.length > 0) {
      // No modification of page runtime; just ensure we surfaced errors in assertion below.
    }
  });

  test('Initial state (S0_Idle then S2_DemoHidden) - verify page render and demo hidden', async ({ page }) => {
    // Purpose: Validate initial rendering (Idle) and that demo area starts hidden (DemoHidden).
    const demo = new DemoPage(page);
    await demo.goto();

    // Verify main title exists and matches FSM evidence for S0_Idle
    const title = await demo.headingText();
    expect(title).toBe('Circular Linked List — Comprehensive Explanation');

    // The FSM indicates the demo area should be hidden initially (S2_DemoHidden)
    const ariaPressed = await demo.demoButtonAriaPressed();
    expect(ariaPressed).toBe('false'); // button should indicate not pressed

    const ariaHidden = await demo.demoAreaAriaHidden();
    expect(ariaHidden).toBe('true'); // demo area should be aria-hidden

    const display = await demo.demoAreaDisplay();
    // CSS sets .demo-area { display: none } initially
    expect(display).toBe('none');

    // The demo log should contain the placeholder text "(demo log hidden)"
    const logText = await demo.demoLogText();
    expect(logText.trim()).toBe('(demo log hidden)');

    // Ensure there are no unexpected console errors during initial load
    expect(page._pageErrors.length, 'expected no page errors during initial load').toBe(0);

    // Check that the inline event handler code evidence is present in the page html
    const content = await demo.pageContent();
    expect(content).toContain("btn.addEventListener('click'");
    expect(content).toContain("btn.setAttribute('aria-pressed'");
  });

  test('Toggle demo visible (S2_DemoHidden -> S1_DemoVisible) and verify DOM changes & demo log', async ({ page }) => {
    // Purpose: Validate clicking the toggle shows the demo area, updates aria attributes, and populates demo log.
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure starting hidden
    expect(await demo.demoAreaAriaHidden()).toBe('true');
    expect(await demo.demoButtonAriaPressed()).toBe('false');

    // Click to show demo (transition S2 -> S1)
    await demo.toggleDemo();

    // After clicking: aria-pressed should be 'true'
    expect(await demo.demoButtonAriaPressed()).toBe('true');

    // demo area aria-hidden should be 'false'
    expect(await demo.demoAreaAriaHidden()).toBe('false');

    // computed display should be 'block' per script (area.style.display = shown ? 'block' : 'none')
    const display = await demo.demoAreaDisplay();
    expect(display).toBe('block');

    // demoLog should now contain the simple demo content (Initial circular list and insertion)
    const logText = await demo.demoLogText();
    expect(logText).toContain('Initial circular list');
    expect(logText).toContain('Insert value 5 at end');
    expect(logText).toContain('New list');

    // The demo SVG should be present in the DOM (static drawing)
    const svgHandle = await page.$('#demoSvg');
    expect(svgHandle).not.toBeNull();

    // Ensure no page errors were emitted as a result of showing the demo
    expect(page._pageErrors.length, 'expected no page errors after showing demo').toBe(0);

    // Also ensure that console messages (if any) do not include 'Error' types
    const errorConsoleMessages = (page._consoleMessages || []).filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Toggle demo hidden again (S1_DemoVisible -> S2_DemoHidden) - verify hide behavior and idempotency', async ({ page }) => {
    // Purpose: Validate toggling the demo off returns to hidden state and attributes are updated.
    const demo = new DemoPage(page);
    await demo.goto();

    // Bring demo visible first
    await demo.toggleDemo();
    expect(await demo.demoButtonAriaPressed()).toBe('true');
    expect(await demo.demoAreaAriaHidden()).toBe('false');

    // Now toggle back to hide (transition S1 -> S2)
    await demo.toggleDemo();

    // Expect button aria-pressed to be 'false' and area aria-hidden to be 'true'
    expect(await demo.demoButtonAriaPressed()).toBe('false');
    expect(await demo.demoAreaAriaHidden()).toBe('true');

    // display should be 'none'
    const display = await demo.demoAreaDisplay();
    expect(display).toBe('none');

    // The demo log text remains populated in the DOM (script does not clear it on hide),
    // but visually it's hidden. Validate that the textual content still contains expected demo lines.
    const logText = await demo.demoLogText();
    expect(logText).toContain('Initial circular list');
    expect(logText).toContain('Insert value 5 at end');

    // Rapid toggling: click multiple times quickly and ensure final state matches parity of clicks
    // Click 3 times (odd) => visible
    await Promise.all([
      demo.page.click(demo.buttonSelector),
      demo.page.click(demo.buttonSelector),
      demo.page.click(demo.buttonSelector),
    ]);
    // After 3 additional toggles from hidden -> visible
    expect(await demo.demoButtonAriaPressed()).toBe('true');
    expect(await demo.demoAreaAriaHidden()).toBe('false');

    // Ensure no runtime page errors occurred during rapid toggling
    expect(page._pageErrors.length, 'no page errors during rapid toggling').toBe(0);
  });

  test('FSM coverage: sequence test covering all transitions S0 -> S2 -> S1 -> S2 and verifying entry/exit effects', async ({ page }) => {
    // Purpose: Execute the canonical FSM sequence and assert side effects described by entry/exit actions.
    // Note: The implementation doesn't expose functions named renderPage/showDemo/hideDemo; we validate the visible effects instead.
    const demo = new DemoPage(page);
    await demo.goto();

    // S0_Idle assumed at initial render: heading is present (evidence)
    expect(await demo.headingText()).toBe('Circular Linked List — Comprehensive Explanation');

    // Transition S0 -> S2: (initially the demo area should be hidden) verify
    expect(await demo.demoAreaAriaHidden()).toBe('true');
    expect(await demo.demoButtonAriaPressed()).toBe('false');

    // Transition S2 -> S1: click once
    await demo.toggleDemo();
    // Entry action showDemo() should reflect by area being visible and log populated
    expect(await demo.demoAreaAriaHidden()).toBe('false');
    expect(await demo.demoAreaDisplay()).toBe('block');
    const logVisibleText = await demo.demoLogText();
    expect(logVisibleText).toMatch(/Initial circular list\s*\(start at head\)/i);

    // Transition S1 -> S2: click again
    await demo.toggleDemo();
    // Exit action hideDemo() should reflect by area hidden
    expect(await demo.demoAreaAriaHidden()).toBe('true');
    expect(await demo.demoAreaDisplay()).toBe('none');

    // Final check: ensure event handler evidence pattern exists in page source
    const content = await demo.pageContent();
    expect(content).toContain("area.style.display = shown ? 'block' : 'none';");

    // Confirm no JS runtime errors (ReferenceError, TypeError, SyntaxError) occurred during the FSM sequence
    expect(page._pageErrors.length, 'expected no runtime page errors during FSM transitions').toBe(0);
  });

  test('Edge cases and robustness: ensure clicking non-button elements does not change demo state and invalid selectors are not present', async ({ page }) => {
    // Purpose: Ensure only the designated button toggles the demo and other elements do not inadvertently mutate state.
    const demo = new DemoPage(page);
    await demo.goto();

    // Click some unrelated element (table cell) - pick a safe element (#definition h2 exists)
    await page.click('#definition h2');

    // State should remain unchanged (still hidden)
    expect(await demo.demoAreaAriaHidden()).toBe('true');
    expect(await demo.demoButtonAriaPressed()).toBe('false');

    // Try to query a non-existent control that might be erroneously referenced in other implementations
    const nonExistent = await page.$('#nonExistentControl');
    expect(nonExistent).toBeNull();

    // Ensure no page errors resulted from clicking unrelated content
    expect(page._pageErrors.length).toBe(0);
  });

  test('Console & error observation: collect and assert console messages and page errors (if any)', async ({ page }) => {
    // Purpose: Demonstrate observation of console and page errors. We assert that there are no page errors,
    // but also surface any console 'error' messages if present.
    const demo = new DemoPage(page);
    await demo.goto();

    // Interact with the page: toggle demo twice
    await demo.toggleDemo();
    await demo.toggleDemo();

    // Inspect captured console messages and page errors
    const consoleMessages = page._consoleMessages || [];
    const pageErrors = page._pageErrors || [];

    // There should be no runtime page errors emitted by this page under normal circumstances
    expect(pageErrors.length, `expected no runtime page errors; got ${pageErrors.length}`).toBe(0);

    // Console messages might be empty; ensure there are no console 'error' messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `expected no console.error messages; got ${consoleErrors.length}`).toBe(0);

    // For visibility in test output: if there are any console messages, at least some benign console types may exist
    // We don't assert on the presence of informational logs, just that error-level logs are absent.
  });
});