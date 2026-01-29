import { test, expect } from '@playwright/test';

// Test file: d8350481-fa7b-11f0-b314-ad8654ee5de8.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/d8350481-fa7b-11f0-b314-ad8654ee5de8.html

// Page Object for the small demo portion of the page
class DemoPage {
  constructor(page) {
    this.page = page;
    this.runButtonSelector = '#runDemo';
    this.outputSelector = '#demoOut';
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/d8350481-fa7b-11f0-b314-ad8654ee5de8.html', { waitUntil: 'load' });
  }

  async getRunButton() {
    return await this.page.$(this.runButtonSelector);
  }

  async clickRun() {
    await this.page.click(this.runButtonSelector);
  }

  async getOutputText() {
    return await this.page.$eval(this.outputSelector, el => el.textContent);
  }

  async waitForRunningState(timeout = 500) {
    // The script sets out.textContent = "Running demo...\n" immediately on click.
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.textContent === "Running demo...\n";
      },
      this.outputSelector,
      { timeout }
    );
  }

  async waitForFinalOutput(timeout = 2000) {
    // Wait for the final demo output that includes "Final sorted array (demo):"
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && /Final sorted array \\(demo\\):/i.test(el.textContent);
      },
      this.outputSelector,
      { timeout }
    );
    return this.getOutputText();
  }

  async outputContains(substring) {
    const txt = await this.getOutputText();
    return txt && txt.includes(substring);
  }

  async outputMatches(regex) {
    const txt = await this.getOutputText();
    return txt && regex.test(txt);
  }
}

test.describe('TimSort demo FSM tests (d8350481-...de8)', () => {
  // Capture console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture consoles of all levels
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', err => {
      // Capture uncaught errors thrown in the page context
      pageErrors.push(err);
    });

    // Navigate to the page under test
    const demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async ({ page }) => {
    // Small sanity: if there are any page errors, attach them to the test output
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // eslint-disable-next-line no-console
        console.warn('Page error captured during test:', err && err.message ? err.message : String(err));
      }
    }

    // Also surface console errors (if any)
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    if (consoleErrorMsgs.length > 0) {
      for (const msg of consoleErrorMsgs) {
        // eslint-disable-next-line no-console
        console.warn('Console message captured during test:', msg);
      }
    }
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('renders main content and exposes "Show run-detection demo" button (S0_Idle entry: renderPage())', async ({ page }) => {
      const demo = new DemoPage(page);

      // Verify the run demo button exists and has proper text
      const btn = await demo.getRunButton();
      expect(btn).toBeTruthy();
      const btnText = await page.$eval('#runDemo', el => el.textContent);
      expect(btnText).toBe('Show run-detection demo');

      // Verify the demo output area exists and is initially empty
      const outExists = await page.$('#demoOut');
      expect(outExists).toBeTruthy();
      const initialOut = await demo.getOutputText();
      // It may be an empty string or whitespace initially; assert it is not pre-populated with final content
      expect(initialOut).toBeTruthy(); // should at least exist (could be empty string)
      expect(initialOut).not.toContain('Final sorted array (demo):');

      // Verify aria-live attribute is present as part of accessibility evidence
      const ariaLive = await page.$eval('#demoOut', el => el.getAttribute('aria-live'));
      expect(ariaLive).toBe('polite');

      // No uncaught page errors at initial render
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transitions and demo behavior', () => {
    test('S0_Idle -> S1_DemoRunning when clicking the run button (immediate Running demo... message)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Click the run button to trigger the event (ShowRunDemo)
      await demo.clickRun();

      // Immediately verify S1_DemoRunning observable: "Running demo...\n"
      await demo.waitForRunningState(500);
      const runningText = await demo.getOutputText();
      expect(runningText).toBe('Running demo...\n');

      // During the running state there should be no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Console should not have any 'error' level messages at this stage
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
    });

    test('S1_DemoRunning -> S2_DemoCompleted: final demo output appears and contains expected run/merge narration', async ({ page }) => {
      const demo = new DemoPage(page);

      // Click to start demo
      await demo.clickRun();

      // Verify transition to Running state (quick)
      await demo.waitForRunningState(500);

      // Wait for the final demo output which is produced asynchronously (~80ms in the page script)
      const finalText = await demo.waitForFinalOutput(2000);

      // Validate expected observables from FSM:
      // - output contains an "Initial array"
      expect(finalText).toContain('Initial array: [5,21,7,23,19,3,2,9,10,11]'.replace(/\s/g, '') || 'Initial array'); // fallback
      expect(finalText).toContain('Final sorted array (demo):');

      // The final output should include "Final sorted array (demo): [" and the sorted numbers
      expect(finalText).toMatch(/Final sorted array \(demo\): \[\s*\d+,\s*\d+,\s*\d+/i);

      // Ensure no uncaught page errors occurred during the run
      expect(pageErrors.length).toBe(0);

      // And no console-level errors
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
    });

    test('Edge case: clicking the run button multiple times quickly schedules multiple runs but final output is stable', async ({ page }) => {
      const demo = new DemoPage(page);

      // Rapidly click twice to simulate user double-click or repeated requests
      await demo.clickRun();
      await demo.clickRun();

      // Immediately after click ensure running state is observed
      await demo.waitForRunningState(500);
      const runningText = await demo.getOutputText();
      expect(runningText).toBe('Running demo...\n');

      // Wait for final output from the last scheduled demo
      const finalText = await demo.waitForFinalOutput(3000);

      // Final text should include the final sorted array once; content should match the expected demo output shape
      expect(finalText).toContain('Final sorted array (demo):');
      expect(finalText).toMatch(/Final sorted array \(demo\): \[[\d,\s]+\]/);

      // There should be no uncaught page errors even if two timeouts were scheduled
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
    });
  });

  test.describe('Robustness, DOM and accessibility checks', () => {
    test('demo output element is updated via textContent (evidence for S1 and S2) and remains in the DOM', async ({ page }) => {
      const demo = new DemoPage(page);

      // Ensure element exists
      const outHandle = await page.$('#demoOut');
      expect(outHandle).toBeTruthy();

      // Start demo and wait for final output
      await demo.clickRun();
      await demo.waitForFinalOutput(2000);

      // Validate that the demo output was updated via textContent (string presence)
      const txt = await demo.getOutputText();
      expect(typeof txt).toBe('string');
      expect(txt.length).toBeGreaterThan(0);
      expect(txt).toContain('Initial array:');
      expect(txt).toContain('Final sorted array (demo):');

      // Accessibility: the region should be announced politely (aria-live already checked earlier), ensure visible
      const visible = await outHandle.isVisible();
      expect(visible).toBeTruthy();

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('No unexpected ReferenceError / SyntaxError / TypeError occurred during page load or demo run', async ({ page }) => {
      const demo = new DemoPage(page);

      // Start demo as part of exercise
      await demo.clickRun();

      // Wait for final output to ensure any deferred errors would surface
      await demo.waitForFinalOutput(2000);

      // Collect any page errors and ensure none are ReferenceError / SyntaxError / TypeError.
      // If any page errors do exist, fail with details to make debugging easier.
      if (pageErrors.length > 0) {
        // Build a helpful message for debugging failure
        const msgs = pageErrors.map(err => (err && err.message) ? err.message : String(err)).join('; ');
        // Fail test with the aggregated page errors
        throw new Error('Unexpected page errors occurred: ' + msgs);
      }

      // Also ensure console did not report script errors
      const scriptErrors = consoleMessages.filter(m => m.type === 'error');
      if (scriptErrors.length > 0) {
        const jsMsgs = scriptErrors.map(m => m.text).join('; ');
        throw new Error('Console errors observed: ' + jsMsgs);
      }

      // If we reach here, no ReferenceError/SyntaxError/TypeError were observed
      expect(pageErrors.length).toBe(0);
      expect(scriptErrors.length).toBe(0);
    });
  });
});