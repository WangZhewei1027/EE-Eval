import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b0e960-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Dynamic Array demo
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-button');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickAdd(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.button.click();
      // Wait for the output to be updated after each click
      // Wait for "Added element" text to appear for operations beyond the initial state
      await this.page.waitForTimeout(50); // small pause to let JS update DOM
    }
  }

  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  locatorForParagraphContaining(text) {
    return this.output.locator(`p:has-text("${text}")`);
  }
}

test.describe('Dynamic Arrays Demo - FSM validations (f0b0e960-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught errors on the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  // Test the initial Idle state (S0_Idle)
  test('Initial state S0_Idle: renders button and initial array output', async ({ page }) => {
    const demo = new DemoPage(page);
    // Navigate to the page
    await demo.goto();

    // Validate the Add Element button exists and is visible
    await expect(demo.button).toBeVisible();
    await expect(demo.button).toHaveText('Add Element');

    // Validate the initial demo output shows empty array and capacity 0
    const output = await demo.getOutputText();
    expect(output).toContain('Array: [] (capacity: 0)');

    // FSM Evidence: S0_Idle expected to show the button
    // Also verify that the page source contains the initial variable declarations (evidence for S2_Array_Growing)
    const content = await page.content();
    expect(content).toContain('let capacity = 0;');
    expect(content).toContain('let size = 0;');
    expect(content).toContain('let array = [];');

    // Ensure there are no runtime console errors or page errors on initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test transition: S0_Idle -> S2_Array_Growing by adding first element
  test('Transition S0_Idle -> S2_Array_Growing: click once adds element 1', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click once to add element 1
    await demo.clickAdd(1);

    // Verify the output includes "Added element 1" and the array and capacity reflect the change
    const output = await demo.getOutputText();
    expect(output).toContain('Added element 1');
    expect(output).toContain('Array: [1] (capacity: 1)');

    // Because after the first add size == capacity, the "Array is full! Next add will trigger resize." message should appear
    expect(output).toContain('Array is full! Next add will trigger resize.');

    // No runtime errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test transition: S2_Array_Growing -> S1_Array_Full by clicking while growing
  test('Transition S2_Array_Growing -> S1_Array_Full: clicking produces full condition at certain sizes', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click two times to produce elements 1 and 2 (capacity will be 2 and full after the second add)
    await demo.clickAdd(2);

    // Validate the most recent update shows element 2 added and capacity 2
    const output = await demo.getOutputText();
    expect(output).toContain('Added element 2');
    expect(output).toContain('Array: [1, 2] (capacity: 2)');

    // Full message should be present since size === capacity after second add
    expect(output).toContain('Array is full! Next add will trigger resize.');

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test transition S1_Array_Full -> S2_Array_Growing: ensure resizing doubles capacity from full state
  test('Transition S1_Array_Full -> S2_Array_Growing: adding when full triggers resize (example to 8 capacity)', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // We want to reach a state where capacity becomes 4 and is full, then add once to cause doubling to 8 and produce element 5.
    // Sequence reasoning:
    // - Click 1: capacity 1, size 1 (full)
    // - Click 2: capacity 2, size 2 (full)
    // - Click 3: capacity 4, size 3 (not full)
    // - Click 4: capacity 4, size 4 (full)
    // - Click 5: triggers capacity *= 2 -> 8, size 5 -> we should see Added element 5 and capacity 8
    await demo.clickAdd(5);

    const output = await demo.getOutputText();

    // The final output should include the 5th addition and the new capacity of 8
    expect(output).toContain('Added element 5');
    expect(output).toContain('Array: [1, 2, 3, 4, 5] (capacity: 8)');

    // Also verify that the evidence of resizing behavior exists in the source code (capacity doubling and new Array allocation)
    const content = await page.content();
    expect(content).toContain('capacity *= 2;');
    expect(content).toContain('array = new Array(capacity);');

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case tests and additional validations
  test('Edge case: Clicking a non-button area should not change the demo output', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Capture initial output
    const before = await demo.getOutputText();

    // Click on the body (not the demo button)
    await page.click('body', { position: { x: 10, y: 10 } });
    // Small wait to ensure any unexpected handlers would run
    await page.waitForTimeout(50);

    const after = await demo.getOutputText();

    // Output should be unchanged
    expect(after).toBe(before);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid successive clicks produce expected incremental additions and maintain correct capacity semantics', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Rapidly click 6 times to observe multiple resizes (1,2,4,8 capacities)
    await demo.clickAdd(6);

    // After 6 adds, capacity progression:
    // 1 -> 2 -> 4 -> 4 -> 8 -> 8  (final size 6, capacity 8)
    const output = await demo.getOutputText();
    expect(output).toContain('Added element 6');
    expect(output).toContain('Array: [1, 2, 3, 4, 5, 6] (capacity: 8)');

    // Also check that when the array becomes exactly full (e.g., after 4th add) the "Array is full!" message appears at least once during the sequence.
    // We verify that one of the intermediate outputs contained the phrase by simulating clicks and inspecting after specific clicks as well.
    // (We already executed clicks, so we will re-create scenario to assert presence at intermediate step)
    await demo.goto();
    // do 4 clicks and assert that after 4th click the full message appears
    await demo.clickAdd(4);
    const midOutput = await demo.getOutputText();
    expect(midOutput).toContain('Array is full! Next add will trigger resize.');

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Verify that the page does not contain unexpected runtime errors in console or pageerror streams
  test('No unexpected runtime errors or uncaught exceptions during interactions', async ({ page }) => {
    const demo = new DemoPage(page);

    await demo.goto();

    // Perform a sequence of interactions
    await demo.clickAdd(3);
    await demo.clickAdd(2);

    // Final assertions about errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});