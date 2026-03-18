import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3714df2-ffc4-11f0-821c-7d25bc609266.html';

// Page Object encapsulating key interactions and queries for the demo page
class KnapsackDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#show-demo');
    this.output = page.locator('#demo-output');
  }

  // Navigate to the application URL and wait for basic elements to be attached
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the button exists and the output container exists in the DOM
    await Promise.all([
      this.button.waitFor({ state: 'attached' }),
      this.output.waitFor({ state: 'attached' })
    ]);
  }

  // Click the Show Demo button (if enabled)
  async clickShowDemo() {
    await this.button.click();
  }

  // Return textContent of the demo output region
  async getOutputText() {
    return this.output.evaluate((el) => el.textContent || '');
  }

  // Return whether the demo output is visible based on computed style
  async isOutputVisible() {
    return this.output.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  // Return whether the show-demo button is disabled
  async isButtonDisabled() {
    return this.button.evaluate((btn) => btn.disabled === true);
  }

  // Return the inline style display value (if set)
  async getOutputInlineDisplay() {
    return this.output.evaluate((el) => el.style.display || '');
  }

  // Return presence and values of accessibility attributes on output
  async getOutputAriaAttributes() {
    return this.output.evaluate((el) => ({
      'aria-live': el.getAttribute('aria-live'),
      role: el.getAttribute('role')
    }));
  }
}

test.describe('Knapsack DP Demo - FSM states and transitions', () => {
  // Arrays to capture console messages and page errors during a test run
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture any console messages for later assertions
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  test.afterEach(async () => {
    // No-op cleanup placeholder; individual tests will assert captured logs/errors
  });

  test('Initial state (S0_Idle): button present and demo output hidden with proper attributes', async ({ page }) => {
    // Arrange: navigate to page
    const demo = new KnapsackDemoPage(page);
    await demo.goto();

    // Assert: button exists and is enabled (idle state)
    await expect(demo.button).toBeVisible();
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(false);

    // Assert: demo output exists and is initially hidden (style display none)
    const inlineDisplay = await demo.getOutputInlineDisplay();
    expect(inlineDisplay).toBe('none'); // inline style set to display:none initially

    const visible = await demo.isOutputVisible();
    expect(visible).toBe(false);

    // Assert: accessibility attributes are present on the visual component
    const aria = await demo.getOutputAriaAttributes();
    expect(aria['aria-live']).toBe('polite');
    expect(aria.role).toBe('region');

    // Assert: there were no console errors or page errors during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // Sanity: Ensure that the DOM contains the expected evidence elements from FSM
    // Evidence: button HTML and pre element should match selectors (already checked).
  });

  test('Transition S0_Idle -> S1_DemoShown on clicking Show Demo: output shows DP steps and button gets disabled', async ({ page }) => {
    // Arrange: navigate to page and attach listeners (set up is in beforeEach)
    const demo = new KnapsackDemoPage(page);
    await demo.goto();

    // Act: click the "Show Demo" button
    await demo.clickShowDemo();

    // Wait for the output to become visible and populated
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && window.getComputedStyle(el).display !== 'none' && (el.textContent || '').length > 0;
    });

    // Assert: output is visible (S1_DemoShown evidence: output.style.display = 'block')
    const visible = await demo.isOutputVisible();
    expect(visible).toBe(true);

    // Check inline style change as evidence of transition
    const inlineDisplay = await demo.getOutputInlineDisplay();
    // The implementation sets output.style.display = 'block'
    expect(inlineDisplay).toBe('block');

    // Assert: output begins with the expected header text
    const text = await demo.getOutputText();
    expect(text.startsWith('Building DP table...')).toBe(true);

    // Assert: DP steps content includes lines for considering items and capacity updates
    expect(text).toContain('Considering item 1: weight = 2, value = 3');
    expect(text).toContain('Considering item 2: weight = 3, value = 4');
    // Check a representative capacity line from the DP steps
    expect(text).toContain('Capacity 0:');
    expect(text).toContain('Capacity 5'); // columns include capacity 5 in messages

    // Assert: final maximum achievable value is reported as expected for these items/capacity
    expect(text).toContain('Maximum achievable value with capacity 5 is 7');

    // Assert: onExit action of the button is applied (button.disabled = true;)
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(true);

    // Assert: no console errors and no uncaught page errors were emitted as part of normal click
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Show Demo twice should not change content after first click (button becomes disabled)', async ({ page }) => {
    // Arrange
    const demo = new KnapsackDemoPage(page);
    await demo.goto();

    // Act: click once to trigger demo
    await demo.clickShowDemo();
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && window.getComputedStyle(el).display !== 'none' && (el.textContent || '').length > 0;
    });

    // Capture output after first click
    const outputAfterFirstClick = await demo.getOutputText();

    // Attempt to click again - button should be disabled and clicking should have no effect
    // Use Playwright's click which will still attempt, but since disabled it shouldn't re-run handler
    // We guard by ensuring the button has disabled attribute so a second click should be ignored by the browser
    const isDisabled = await demo.isButtonDisabled();
    expect(isDisabled).toBe(true);

    // Try clicking anyway (should be a no-op)
    await demo.button.click({ force: true }).catch(() => {
      // If clicking a disabled element throws, ignore; the test's important assertion is content unchanged
    });

    // Give the page a small moment to (not) change
    await page.waitForTimeout(150);

    // Capture output after attempted second click
    const outputAfterSecondClick = await demo.getOutputText();

    // Assert: content hasn't changed between first and second click attempts
    expect(outputAfterSecondClick).toBe(outputAfterFirstClick);

    // Assert: still no console errors or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: verify DP content formatting includes expected computation lines and no thrown exceptions during computation', async ({ page }) => {
    const demo = new KnapsackDemoPage(page);
    await demo.goto();

    // Listen for uncaught exceptions specifically during building content
    const pageErrorsDuring = [];
    page.on('pageerror', (err) => pageErrorsDuring.push(String(err)));

    // Trigger demo build
    await demo.clickShowDemo();

    // Wait until the DP final line appears
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.textContent && el.textContent.includes('Maximum achievable value with capacity 5 is');
    });

    const text = await demo.getOutputText();

    // Structural checks: number of "Considering item" lines should match number of items (2)
    const consideringMatches = (text.match(/Considering item \d+: /g) || []).length;
    expect(consideringMatches).toBe(2);

    // There should be at least one "Capacity" update line for each item
    const capacityMatches = (text.match(/Capacity \d+:/g) || []).length;
    expect(capacityMatches).toBeGreaterThanOrEqual(2);

    // No runtime page errors occurred during building
    expect(pageErrorsDuring.length).toBe(0);

    // Also assert there are no console error messages captured globally
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity check: page-level evidence elements exist and match FSM component selectors', async ({ page }) => {
    const demo = new KnapsackDemoPage(page);
    await demo.goto();

    // Verify the button's innerText matches expected FSM evidence
    const btnText = await demo.button.evaluate((el) => el.textContent && el.textContent.trim());
    expect(btnText).toBe('Show Demo');

    // Verify the output element is a PRE and has id demo-output
    const tagName = await demo.output.evaluate((el) => el.tagName);
    expect(tagName.toLowerCase()).toBe('pre');

    const id = await demo.output.evaluate((el) => el.id);
    expect(id).toBe('demo-output');

    // No errors emitted
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});