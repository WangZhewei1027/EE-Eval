import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83a34a2-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the demo area to keep tests readable and DRY
class DemoPage {
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoBtn');
    this.trace = page.locator('#trace');
  }

  // Click the toggle button
  async clickToggle() {
    await this.button.click();
  }

  // Return computed display style of the trace element
  async getTraceDisplay() {
    return await this.trace.evaluate((el) => getComputedStyle(el).display);
  }

  // Return the textContent of the trace element
  async getTraceText() {
    return await this.trace.evaluate((el) => el.textContent || '');
  }

  // Return the button visible text
  async getButtonText() {
    return await this.button.evaluate((el) => el.textContent || '');
  }

  // Return the aria-expanded attribute value
  async getAriaExpanded() {
    return await this.button.getAttribute('aria-expanded');
  }

  // Return the aria-controls attribute value
  async getAriaControls() {
    return await this.button.getAttribute('aria-controls');
  }
}

test.describe('Type Systems — Demo FSM (d83a34a2-fa7b...)', () => {
  // Arrays to collect runtime diagnostics for each test
  let consoleEvents = [];
  let pageErrors = [];

  // Attach listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    consoleEvents = [];
    pageErrors = [];

    // Capture console messages (esp. errors)
    page.on('console', (msg) => {
      // store type and text for assertions / debugging
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Navigate to the provided HTML page (exact URL from requirements)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the main content root is present (basic sanity check before the rest of assertions)
    await expect(page.locator('main.wrap[role="main"]')).toBeVisible();
  });

  // Teardown: After each test make sure we observed no unexpected page-level errors
  test.afterEach(async () => {
    // Assert that there were no uncaught runtime errors (ReferenceError, SyntaxError, TypeError, etc.)
    // We fail the test if any pageErrors were captured. This validates the page runs without uncaught exceptions.
    expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);

    // Also assert there were no console.error messages emitted by the page script
    const consoleErrorCount = consoleEvents.filter((c) => c.type === 'error').length;
    expect(consoleErrorCount, 'No console.error messages should be emitted').toBe(0);
  });

  test.describe('Initial Idle state (S0_Idle) - renderPage entry verification', () => {
    test('renders the toggle button and hidden trace with initial attributes', async ({ page }) => {
      // Arrange: create page object
      const demo = new DemoPage(page);

      // Validate the button exists and has the expected initial text and accessibility attributes:
      // - aria-controls should point to "trace"
      // - aria-expanded should be "false"
      // - button text should be "Show type-inference trace"
      await expect(demo.button).toBeVisible();
      expect(await demo.getButtonText()).toBe('Show type-inference trace');
      expect(await demo.getAriaControls()).toBe('trace');
      expect(await demo.getAriaExpanded()).toBe('false');

      // The trace region should exist in the DOM but be hidden (display:none)
      await expect(demo.trace).toBeVisible(); // element is present; visibility here means "exists"
      const display = await demo.getTraceDisplay();
      expect(display).toBe('none');

      // Trace content should be empty prior to showing (script populates on show)
      const traceText = (await demo.getTraceText()).trim();
      expect(traceText).toBe('');
    });
  });

  test.describe('Transitions and events (ShowTrace / HideTrace)', () => {
    test('ShowTrace transition: clicking button reveals trace and updates button (S0_Idle -> S1_TraceVisible)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Click to show the trace
      await demo.clickToggle();

      // After clicking, the trace should be visible via style.display === 'block'
      const displayAfterShow = await demo.getTraceDisplay();
      expect(displayAfterShow).toBe('block');

      // The button aria-expanded should be set to true and button text updated to "Hide type-inference trace"
      expect(await demo.getAriaExpanded()).toBe('true');
      expect(await demo.getButtonText()).toBe('Hide type-inference trace');

      // The trace should contain the precomputed trace lines with at least the expected key phrases
      const traceText = await demo.getTraceText();
      expect(traceText).toContain('Expression: let id = λx. x in (id 3, id true)');
      expect(traceText).toContain('Final result:');
      expect(traceText).toContain('pair has type (int, bool)'.toLowerCase()); // allow case-insensitive presence by lowercasing comparison

      // Also ensure that aria-live region is present and has the expected attributes per FSM components
      const traceEl = page.locator('#trace');
      expect(await traceEl.getAttribute('role')).toBe('region');
      expect(await traceEl.getAttribute('aria-live')).toBe('polite');
    });

    test('HideTrace transition: clicking button again hides trace and restores button (S1_TraceVisible -> S0_Idle)', async ({ page }) => {
      const demo = new DemoPage(page);

      // First click to show
      await demo.clickToggle();
      // Sanity check: now visible
      expect(await demo.getTraceDisplay()).toBe('block');

      // Click again to hide
      await demo.clickToggle();

      // After hiding, the trace should be display: none
      const displayAfterHide = await demo.getTraceDisplay();
      expect(displayAfterHide).toBe('none');

      // aria-expanded should be false and button text restored
      expect(await demo.getAriaExpanded()).toBe('false');
      expect(await demo.getButtonText()).toBe('Show type-inference trace');

      // Trace text remains in DOM but hidden; depending on implementation it may still hold text content.
      // The FSM expected hide action sets display to 'none' and resets button attributes only.
      // Ensure hidden trace either has empty text or still contains the trace text (both acceptable),
      // but we assert the visual hidden state which matters for the FSM.
      expect(['none', '']).toContain(await demo.getTraceDisplay());
    });

    test('Repeated toggles maintain deterministic state and aria attributes (idempotency and parity)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Click an odd number of times (3) and expect visible state
      await demo.clickToggle(); // 1 -> visible
      await demo.clickToggle(); // 2 -> hidden
      await demo.clickToggle(); // 3 -> visible

      expect(await demo.getTraceDisplay()).toBe('block');
      expect(await demo.getAriaExpanded()).toBe('true');
      expect(await demo.getButtonText()).toBe('Hide type-inference trace');

      // Click a fourth time -> hidden
      await demo.clickToggle(); // 4 -> hidden
      expect(await demo.getTraceDisplay()).toBe('none');
      expect(await demo.getAriaExpanded()).toBe('false');
      expect(await demo.getButtonText()).toBe('Show type-inference trace');
    });

    test('Rapid clicking stress test: no uncaught exceptions and final parity respected', async ({ page }) => {
      const demo = new DemoPage(page);

      // Rapidly click the button 7 times in quick succession
      for (let i = 0; i < 7; i++) {
        // using Promise.all ensures these clicks are awaited sequentially but without extra delays
        await demo.button.click();
      }

      // After 7 clicks (odd), trace should be visible
      const display = await demo.getTraceDisplay();
      expect(display).toBe('block');

      // No page errors should have been recorded (this is asserted in afterEach),
      // but we also assert here that console didn't emit any error-level logs during the rapid clicks
      const errorConsoleEntries = consoleEvents.filter((c) => c.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
    });
  });

  test.describe('Edge cases and DOM invariants', () => {
    test('Button has correct attributes even if trace already contains content before showing', async ({ page }) => {
      const demo = new DemoPage(page);

      // As an edge check: programmatically check trace element exists and has expected attributes prior to any clicks
      const traceEl = page.locator('#trace');
      expect(await traceEl.getAttribute('role')).toBe('region');
      expect(await traceEl.getAttribute('aria-live')).toBe('polite');

      // Confirm that clicking updates only the expected pieces (no unexpected attribute mutation)
      await demo.clickToggle();
      // The button's aria-controls should remain 'trace'
      expect(await demo.getAriaControls()).toBe('trace');

      // Hide again
      await demo.clickToggle();
      expect(await demo.getAriaControls()).toBe('trace');
    });

    test('Trace content matches the script-provided lines after show (sanity of textual trace)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Show the trace
      await demo.clickToggle();

      const traceText = await demo.getTraceText();

      // verify several expected sentences and lines appear intact
      const expectedFragments = [
        'Initial environment Γ = { }',
        'Step 1: Infer type of λx.x',
        'Step 2: Generalize at let-binding',
        'Instantiate ∀α. α → α with fresh β',
        'Final result: ⊢ let id = λx.x in (id 3, id true) : (int, bool)',
        'Because id was generalized at its definition'
      ];

      for (const fragment of expectedFragments) {
        // use case-insensitive containment checks for robustness
        expect(traceText.toLowerCase()).toContain(fragment.toLowerCase());
      }
    });
  });

  test.describe('Runtime diagnostics observation', () => {
    test('No ReferenceError / SyntaxError / TypeError should be thrown during normal interactions', async ({ page }) => {
      const demo = new DemoPage(page);

      // Interact in a variety of ways to exercise the client script
      await demo.clickToggle(); // show
      await demo.clickToggle(); // hide
      await demo.clickToggle(); // show

      // At this point listeners in beforeEach captured page errors. We assert none of them are ReferenceError/SyntaxError/TypeError.
      // This is a stricter check than the afterEach generic check.
      const problematic = pageErrors.filter((e) => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name));
      expect(problematic.length, 'No ReferenceError/SyntaxError/TypeError should be present').toBe(0);

      // Also ensure there are no console.error messages mentioning those error names
      const consoleErrorMsgs = consoleEvents
        .filter((c) => c.type === 'error')
        .map((c) => c.text.toLowerCase());
      const foundErrorName = consoleErrorMsgs.find((t) =>
        t.includes('referenceerror') || t.includes('syntaxerror') || t.includes('typeerror')
      );
      expect(foundErrorName, 'No console.error messages mentioning ReferenceError/SyntaxError/TypeError').toBeUndefined();
    });
  });
});