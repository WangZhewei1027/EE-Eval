import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb1401-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class BacktrackingDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButtonSelector = '#run-demo';
    this.outputSelector = '#demo-container';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial UI is ready
    await this.page.waitForSelector(this.runButtonSelector, { state: 'visible' });
    await this.page.waitForSelector(this.outputSelector, { state: 'attached' });
  }

  async clickRun() {
    await this.page.click(this.runButtonSelector);
  }

  async getOutputText() {
    return await this.page.$eval(this.outputSelector, (el) => el.textContent || '');
  }

  async getOutputLines() {
    const txt = await this.getOutputText();
    // split preserving possible trailing empty lines
    return txt.split('\n');
  }

  async hasAriaAttributes() {
    return await this.page.$eval(this.outputSelector, (el) => {
      return {
        'aria-live': el.getAttribute('aria-live'),
        'aria-label': el.getAttribute('aria-label'),
      };
    });
  }

  async runButtonText() {
    return await this.page.$eval(this.runButtonSelector, (el) => el.textContent || '');
  }
}

test.describe('Backtracking demo - FSM states and transitions', () => {
  // Collect console errors and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and record error-level messages
    page.on('console', (msg) => {
      try {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') {
          consoleErrors.push(text);
        }
      } catch (e) {
        // capture unexpected issues while reading console
        consoleErrors.push(`(unreadable console message) ${String(e)}`);
      }
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });
  });

  test.afterEach(async () => {
    // nothing specific to teardown beyond Playwright fixtures
  });

  test('Initial Idle state (S0_Idle) - UI elements present and accessible', async ({ page }) => {
    // This test validates the S0_Idle entry state:
    // - The Run button is rendered with the expected text.
    // - The demo container is present and has the required aria attributes.
    // - No runtime errors or console errors occurred during initial load.
    const demo = new BacktrackingDemoPage(page);
    await demo.goto();

    // Validate Run button exists and has expected label (evidence in FSM)
    const btnText = await demo.runButtonText();
    expect(btnText).toBe('Generate Binary Strings (Length 3)');

    // Validate demo container aria attributes (accessibility evidence)
    const aria = await demo.hasAriaAttributes();
    expect(aria['aria-live']).toBe('polite');
    expect(aria['aria-label']).toBe('Backtracking demonstration output');

    // Validate initially the output zone is empty (Idle state) or at least not containing generated strings
    const initialOutput = await demo.getOutputText();
    // It may be empty string; ensure it does not already start with the generation header
    expect(initialOutput.startsWith('Generating all binary strings of length 3:')).toBe(false);

    // Assert no uncaught page errors or console.error messages happened during load
    expect(consoleErrors.length, 'No console.error messages during initial load').toBe(0);
    expect(pageErrors.length, 'No page errors during initial load').toBe(0);
  });

  test('Transition ButtonClick: from Idle to Generating (S0 -> S1) and outputs correct binary strings', async ({ page }) => {
    // This test validates the ButtonClick event and the transition to S1_Generating:
    // - Clicking the button sets the outputDiv text to the header and generates all binary strings of length 3.
    // - The output content ordering and exact formatting (newlines) is verified.
    // - Verify repeated clicks reset and regenerate the same output.
    const demo = new BacktrackingDemoPage(page);
    await demo.goto();

    // Prepare expected output exactly as the page's script generates it:
    const header = 'Generating all binary strings of length 3:\n\n';
    const strings = ['000', '001', '010', '011', '100', '101', '110', '111'];
    const expectedBody = strings.map((s) => s + '\n').join('');
    const expectedFull = header + expectedBody;

    // Click to generate
    await demo.clickRun();

    // Wait briefly for synchronous generation (script is synchronous recursion)
    // Use an assertion with retry: getOutputText until it equals expectedFull
    await test.step('wait for generation to populate the output', async () => {
      await expect.poll(async () => {
        return await demo.getOutputText();
      }, {
        timeout: 2000,
      }).toBe(expectedFull);
    });

    // Confirm exact content
    const actual = await demo.getOutputText();
    expect(actual).toBe(expectedFull);

    // Also verify lines count: header + blank line + 8 lines + possible trailing empty line from split
    const lines = actual.split('\n'); // last element will be '' due to trailing newline
    // Expected split: ['Generating all binary strings of length 3:', '', '000', '001', ..., '111', '']
    expect(lines[0]).toBe('Generating all binary strings of length 3:');
    expect(lines[1]).toBe('');
    expect(lines.slice(2, 10)).toEqual(strings);
    // last element should be empty because the final newline produces an extra trailing empty string
    expect(lines[10]).toBe('');

    // Validate no runtime errors were thrown during generation
    expect(consoleErrors.length, 'No console.error messages during generation').toBe(0);
    expect(pageErrors.length, 'No page errors during generation').toBe(0);

    // Click again to validate the exit->enter actions for S1 and re-generation behavior:
    await demo.clickRun();
    const afterSecondClick = await demo.getOutputText();
    expect(afterSecondClick).toBe(expectedFull);
  });

  test('Edge cases: multiple rapid clicks and idempotent generation behavior', async ({ page }) => {
    // This test validates robustness:
    // - Multiple rapid clicks should result in the same final output (script resets textContent at start of handler).
    // - There should be no duplicated headers or partial outputs.
    const demo = new BacktrackingDemoPage(page);
    await demo.goto();

    // Rapidly click the button multiple times
    await Promise.all([
      demo.page.click('#run-demo'),
      demo.page.click('#run-demo'),
      demo.page.click('#run-demo'),
    ]).catch(() => {
      // Some of these may race but the page script is synchronous and idempotent; swallow click Promise rejections if any
    });

    // Expected output prepared again
    const header = 'Generating all binary strings of length 3:\n\n';
    const strings = ['000', '001', '010', '011', '100', '101', '110', '111'];
    const expectedBody = strings.map((s) => s + '\n').join('');
    const expectedFull = header + expectedBody;

    // Wait until stable output equals expectedFull
    await expect.poll(async () => {
      return await demo.getOutputText();
    }, { timeout: 2000 }).toBe(expectedFull);

    // Ensure output is exactly as expected (no duplicate headers)
    const txt = await demo.getOutputText();
    // Count occurrences of the header string - should be exactly 1
    const headerCount = (txt.match(/Generating all binary strings of length 3:/g) || []).length;
    expect(headerCount).toBe(1);

    // Ensure all expected binary strings are present exactly once each (simple check)
    for (const s of strings) {
      const occurrences = (txt.match(new RegExp(`\\b${s}\\b`, 'g')) || []).length;
      expect(occurrences).toBe(1);
    }

    // Confirm no page errors or console errors occurred as a result of rapid clicks
    expect(consoleErrors.length, 'No console.error messages after rapid clicks').toBe(0);
    expect(pageErrors.length, 'No page errors after rapid clicks').toBe(0);
  });

  test('Accessibility & DOM correctness: button and container attributes remain stable after generation', async ({ page }) => {
    // This test verifies that the DOM elements remain valid and accessible after a state transition.
    // It ensures the button remains present and the container keeps its aria attributes after generating output.
    const demo = new BacktrackingDemoPage(page);
    await demo.goto();

    // Generate once
    await demo.clickRun();

    // Validate button still exists and is enabled (clickable)
    const button = await page.$('#run-demo');
    expect(button).not.toBeNull();
    const isDisabled = await button.getAttribute('disabled');
    // The example does not disable the button; attribute should be null
    expect(isDisabled).toBeNull();

    // Validate aria attributes persisted
    const aria = await demo.hasAriaAttributes();
    expect(aria['aria-live']).toBe('polite');
    expect(aria['aria-label']).toBe('Backtracking demonstration output');

    // Validate that the demo container still has monospace/pre-wrap style properties set via CSS
    // (We cannot assert computed style reliably in all environments, but we can assert the element exists and has the expected ID/class)
    const container = await page.$('#demo-container');
    expect(container).not.toBeNull();

    // Confirm no runtime errors happened during the checks
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture any console or runtime errors on page load and during interactions', async ({ page }) => {
    // This test explicitly checks console and runtime error observation channels work.
    // It performs a navigation and an interaction and asserts that the test harness captured zero errors.
    const demo = new BacktrackingDemoPage(page);
    await demo.goto();

    // Trigger generation to exercise the recursive function
    await demo.clickRun();

    // Allow a small delay to capture any async page errors (even though generation is synchronous)
    await page.waitForTimeout(200);

    // Assert monitoring arrays are accessible and empty
    // If there were errors, the test will fail and report their contents
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Console error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });
});