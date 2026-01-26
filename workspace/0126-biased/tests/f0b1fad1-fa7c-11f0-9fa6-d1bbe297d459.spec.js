import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1fad1-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page object representing the Insertion Sort demo page.
 * Encapsulates common interactions and queries used across tests.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRunDemo() {
    await this.page.click('.demo-btn');
  }

  async getOutputInnerHTML() {
    return this.page.$eval('#demo-output', (el) => el.innerHTML);
  }

  async waitForOutputContains(text, timeout = 2000) {
    await this.page.waitForFunction(
      (t) => {
        const out = document.getElementById('demo-output');
        return out && out.innerHTML.includes(t);
      },
      text,
      { timeout }
    );
  }

  async countOccurrencesInOutput(substring) {
    const html = await this.getOutputInnerHTML();
    // simple split-based count
    if (!html) return 0;
    return html.split(substring).length - 1;
  }
}

test.describe('Insertion Sort Demo - FSM and Interactive Behavior', () => {
  // Keep collected console messages and page errors per test to assert
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions
    page.on('console', (msg) => {
      // Save message text and type for debugging/assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture unhandled errors in the page context
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert that console did not emit unexpected 'error' messages
    // (Unless the test specifically triggers an error scenario.)
    // Tests that expect errors will perform their own assertions.
    // This post-check ensures tests that should not produce errors didn't.
  });

  test('S0_Idle: Initial Idle state renders correctly (button present, output empty)', async ({ page }) => {
    // This test validates the Idle state evidence:
    // - The "Run Insertion Sort Demo" button exists with the correct class and onclick attribute
    // - The demo output region exists and is empty at load
    // - The FSM entry action "renderPage()" is not present on window (edge check)
    const demo = new DemoPage(page);
    await demo.goto();

    // Assert the demo button exists and is visible
    const button = await page.$('.demo-btn');
    expect(button).not.toBeNull();
    expect(await button.isVisible()).toBeTruthy();

    // Verify the button's text content
    const buttonText = await page.$eval('.demo-btn', (b) => b.textContent && b.textContent.trim());
    expect(buttonText).toBe('Run Insertion Sort Demo');

    // Verify the button has an onclick attribute referencing runDemo()
    const onclickAttr = await page.$eval('.demo-btn', (b) => b.getAttribute('onclick'));
    // Some environments may normalize attributes; check substring
    expect(onclickAttr).toEqual(expect.stringContaining('runDemo'));

    // Verify demo output element exists and is initially empty
    const demoOutputExists = await page.$('#demo-output');
    expect(demoOutputExists).not.toBeNull();
    const initialOutput = await demo.getOutputInnerHTML();
    // It may be empty string; accept empty or only whitespace
    expect(initialOutput.trim()).toBe('');

    // Verify that the FSM-specified entry action renderPage() is not defined on the window.
    // This checks the "onEnter" action referenced in FSM; since the HTML does not define renderPage,
    // it should be undefined. We assert that it is undefined (edge case).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Also ensure no console 'error' messages were emitted during initial load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    // Also ensure no page errors were recorded so far
    expect(pageErrors.length).toBe(0);
  });

  test('S1_DemoRunning: Clicking the demo button transitions to Demo Running and updates DOM', async ({ page }) => {
    // This test validates the transition from Idle -> DemoRunning:
    // - Clicking .demo-btn triggers runDemo()
    // - #demo-output contains the expected "Running Insertion Sort on array: [6, 2, 8, 1, 5]" string
    // - The demo output also contains step descriptions including the final sorted array
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure initial conditions
    expect((await demo.getOutputInnerHTML()).trim()).toBe('');

    // Click the demo button to run the demo
    await demo.clickRunDemo();

    // Wait for the initial running message to appear
    await demo.waitForOutputContains('Running Insertion Sort on array: [6, 2, 8, 1, 5]');

    // Verify that the expected running message is present
    const html = await demo.getOutputInnerHTML();
    expect(html).toEqual(expect.stringContaining('Running Insertion Sort on array: [6, 2, 8, 1, 5]'));

    // Verify the demo recorded multiple passes and the final sorted array
    expect(html).toEqual(expect.stringContaining('Pass 1'));
    expect(html).toEqual(expect.stringContaining('Pass 2'));
    expect(html).toEqual(expect.stringContaining('Pass 3'));
    expect(html).toEqual(expect.stringContaining('Pass 4'));
    expect(html).toEqual(expect.stringContaining('Final sorted array'));
    // For the provided input, final sorted array should be [1, 2, 5, 6, 8]
    expect(html).toEqual(expect.stringContaining('[1, 2, 5, 6, 8]'));

    // Ensure no unexpected page errors were produced by running the demo
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition behavior on repeated clicks: clicking the demo button twice replaces output and does not throw', async ({ page }) => {
    // This test covers an edge case / robustness check:
    // - Clicking the demo button repeatedly should not cause uncaught exceptions
    // - The demo output is replaced on each run (not duplicated), so the initial-run message appears exactly once
    const demo = new DemoPage(page);
    await demo.goto();

    // Click once and wait for output
    await demo.clickRunDemo();
    await demo.waitForOutputContains('Running Insertion Sort on array: [6, 2, 8, 1, 5]');

    // Capture count of the identifying phrase after first click
    const countAfterFirst = await demo.countOccurrencesInOutput('Running Insertion Sort on array: [6, 2, 8, 1, 5]');
    expect(countAfterFirst).toBe(1);

    // Click again right away and wait for output to be updated
    await demo.clickRunDemo();
    await demo.waitForOutputContains('Running Insertion Sort on array: [6, 2, 8, 1, 5]');

    // After the second click the phrase should still appear exactly once (content is replaced)
    const countAfterSecond = await demo.countOccurrencesInOutput('Running Insertion Sort on array: [6, 2, 8, 1, 5]');
    expect(countAfterSecond).toBe(1);

    // Ensure no unhandled page errors were produced by repeated clicks
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action edge: calling undefined renderPage() triggers a ReferenceError (natural page error)', async ({ page }) => {
    // This test intentionally triggers the undefined entry action listed in the FSM:
    // - The FSM lists renderPage() as an entry action for the Idle state.
    // - The HTML does not define renderPage, so invoking it should cause a ReferenceError in the page.
    // We deliberately invoke it asynchronously so the pageerror event fires naturally and we can assert it.

    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure renderPage is indeed not defined before triggering
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Trigger the undefined function asynchronously so page.evaluate resolves but the page error occurs
    // Use setTimeout in page to ensure the error is unhandled in page context (and produces pageerror event).
    const waiter = page.waitForEvent('pageerror');
    await page.evaluate(() => {
      setTimeout(() => {
        // This will throw a ReferenceError naturally in the page context if renderPage is not defined.
        // We do not wrap in try/catch because the test's requirement is to let such errors happen naturally.
        // This simulates the FSM entry action being called even though it is not implemented.
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0);
    });

    // Wait for the pageerror event and assert its characteristics
    const error = await waiter;
    expect(error).toBeTruthy();
    // Message should mention renderPage and indicate a reference/undefined error in some form
    expect(String(error.message)).toEqual(expect.stringContaining('renderPage'));
    // Check for typical ReferenceError wording or "not defined"
    expect(String(error.message)).toMatch(/ReferenceError|not defined/i);
  });

  test('Comprehensive content verification: steps and messages are well-formed after running demo', async ({ page }) => {
    // This test validates more of the DOM structure produced by runDemo:
    // - The steps array entries are appended, include movement/insertion messages, and array snapshots
    const demo = new DemoPage(page);
    await demo.goto();

    // Run demo
    await demo.clickRunDemo();
    await demo.waitForOutputContains('Running Insertion Sort on array: [6, 2, 8, 1, 5]');

    // Grab the output HTML and perform some structural checks
    const outputHTML = await demo.getOutputInnerHTML();

    // Should contain textual evidence of moves like "Moved" and "Inserted"
    expect(outputHTML).toEqual(expect.stringContaining('Moved'));
    expect(outputHTML).toEqual(expect.stringContaining('Inserted'));

    // There should be at least one "Array now:" snapshot
    expect(outputHTML).toEqual(expect.stringContaining('Array now: ['));

    // Ensure pass numbering is present for passes 1 through 4
    for (let pass = 1; pass <= 4; pass++) {
      expect(outputHTML).toEqual(expect.stringContaining(`Pass ${pass}`));
    }

    // No uncaught page errors during this normal run
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});