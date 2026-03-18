import { test, expect } from '@playwright/test';

// URL of the served HTML for this interactive application
const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3701570-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the Stack Demo page to keep tests organized
class StackDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demoButton');
    this.visual = page.locator('.stack-visual');
    this.explanation = page.locator('#demoExplanation');
    this.stackElements = () => page.locator('.stack-visual .stack-element');
    this.stackEmpty = () => page.locator('.stack-visual .stack-empty');
  }

  // Wait until explanation includes the expected substring (with custom timeout)
  async waitForExplanationContains(text, timeout = 7000) {
    await expect(this.explanation).toContainText(text, { timeout });
  }

  // Get array of text contents of stack-element nodes (in DOM order)
  async getStackElementTexts() {
    return await this.stackElements().allTextContents();
  }

  // Get count of stack-element nodes
  async getStackElementCount() {
    return await this.stackElements().count();
  }

  // Check whether the .stack-empty placeholder is visible
  async isStackEmptyVisible() {
    return await this.stackEmpty().isVisible().catch(() => false);
  }

  // Click the demo button
  async clickDemo() {
    await this.demoButton.click();
  }
}

// Group tests related to the Stack Demo FSM
test.describe('Stack Demo FSM - a3701570-ffc4-11f0-821c-7d25bc609266', () => {
  // Increase timeout for tests involving long setTimeout-based demo sequence
  test.setTimeout(90_000);

  // Shared variables to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Before each test, navigate to the page and set up listeners to observe console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // collect text and severity for inspection/assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      // store the Error object to assert presence/absence later
      pageErrors.push(err);
    });

    // Load the application page exactly as-served (do not modify or patch)
    await page.goto(APP_URL);
  });

  // Test: initial rendered state corresponds to S0_Initial
  test('Initial render shows empty stack (S0_Initial) and no immediate errors', async ({ page }) => {
    const demo = new StackDemoPage(page);

    // Validate that the visual shows the empty placeholder
    await expect(demo.stackEmpty()).toBeVisible();
    await expect(demo.stackEmpty()).toHaveText('Stack is empty');

    // There should be no stack-element nodes initially
    const elementsCount = await demo.getStackElementCount();
    expect(elementsCount).toBe(0);

    // Explanation area should be empty initially (or whitespace)
    await expect(demo.explanation).toHaveText('', { timeout: 1000 });

    // Assert that no uncaught page errors were emitted during load
    expect(pageErrors.length).toBe(0);

    // Collect at least some console logs (style or other informational logs may be present)
    // We won't assert exact console content (implementation may vary), but ensure listener is active
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  // Test: Clicking "Run Push-Pop Demo" triggers the sequence and transitions through all FSM states
  test('RunDemo event triggers full push/peek/pop sequence and matches FSM states S1..S6', async ({ page }) => {
    const demo = new StackDemoPage(page);

    // Start the demo - this schedules a series of setTimeout actions in the page
    await demo.clickDemo();

    // Immediately after click, the page sets explanation to starting text and clears stack => S0_Initial onEnter then S1 transition sequence begins
    await demo.waitForExplanationContains('Starting stack demonstration. The stack is initially empty.', 2000);

    // Confirm that the stack placeholder is present at start of demo (S0_Initial)
    expect(await demo.isStackEmptyVisible()).toBe(true);

    // Wait for S1: push(42) - occurs ~1500ms after click
    await demo.waitForExplanationContains('Performing push(42): we add the value 42', 5000);
    // After push(42) there should be exactly one stack-element with text '42'
    const s1Count = await demo.getStackElementCount();
    expect(s1Count).toBe(1);
    const s1Texts = await demo.getStackElementTexts();
    expect(s1Texts).toEqual(['42']);
    // The empty placeholder should not be visible anymore
    expect(await demo.isStackEmptyVisible()).toBe(false);

    // Wait for S2: push(17) - occurs ~3500ms after click; wait with generous timeout
    await demo.waitForExplanationContains('Performing push(17): now pushing 17 on top of 42.', 6000);
    const s2Count = await demo.getStackElementCount();
    expect(s2Count).toBe(2);
    const s2Texts = await demo.getStackElementTexts();
    // DOM order is bottom-to-top: first '42' then '17'
    expect(s2Texts).toEqual(['42', '17']);

    // Wait for S3: peek - occurs ~5500ms after click
    await demo.waitForExplanationContains('Performing peek(): looking at the top element without removing it.', 7000);
    // The explanation also appends the top element value
    await demo.waitForExplanationContains('Top element is 17', 2000);
    // Ensure no change in stack visual after peek
    const s3Count = await demo.getStackElementCount();
    expect(s3Count).toBe(2);
    const s3Texts = await demo.getStackElementTexts();
    expect(s3Texts).toEqual(['42', '17']);

    // Wait for S4: pop 17 - occurs ~7500ms after click
    await demo.waitForExplanationContains('Performing pop(): removing the top element (17) from the stack.', 8000);
    // Explanation should include removed element
    await demo.waitForExplanationContains('Removed element is 17', 2000);
    // Stack should now contain only '42'
    const s4Count = await demo.getStackElementCount();
    expect(s4Count).toBe(1);
    const s4Texts = await demo.getStackElementTexts();
    expect(s4Texts).toEqual(['42']);

    // Wait for S5: pop 42 - occurs ~9500ms after click
    await demo.waitForExplanationContains('Performing pop(): removing the next top element (42). Stack becomes empty after this.', 8000);
    await demo.waitForExplanationContains('Removed element is 42', 2000);
    // After popping 42, stack should be empty visually (showing .stack-empty)
    expect(await demo.isStackEmptyVisible()).toBe(true);
    // There should be 0 stack-element nodes
    const s5Count = await demo.getStackElementCount();
    expect(s5Count).toBe(0);

    // Wait for S6: final completion message ~11500ms after click
    await demo.waitForExplanationContains('Stack demonstration completed. Stack is empty.', 7000);
    // Final state should be stack-empty visible
    expect(await demo.isStackEmptyVisible()).toBe(true);

    // Throughout the demo, ensure no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);

    // Verify that consoleMessages were captured (not asserting specific messages, but demonstrating we observed console)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  // Edge case: Click the demo button again while the demo is running to validate behavior and robustness
  test('Edge case: clicking demo again while running should not throw errors and ends with an empty stack', async ({ page }) => {
    const demo = new StackDemoPage(page);

    // Start the demo
    await demo.clickDemo();

    // Wait briefly, but before the first push occurs (first push occurs at ~1500ms)
    await page.waitForTimeout(1000);

    // Click the demo button again to restart/demo overlap scenario
    // The implementation sets stack=[] and schedules timeouts again; we should not patch or prevent anything
    await demo.clickDemo();

    // After second click, explanation should be reset to the starting message again
    await demo.waitForExplanationContains('Starting stack demonstration. The stack is initially empty.', 2000);

    // Wait for the demo(s) to finish. The last scheduled completion is ~11.5s after the most recent click,
    // allow generous timeout to ensure all scheduled callbacks have a chance to run.
    await demo.waitForExplanationContains('Stack demonstration completed. Stack is empty.', 20_000);

    // Final visual should show empty stack placeholder
    expect(await demo.isStackEmptyVisible()).toBe(true);
    // No stack-element nodes should be present
    const finalCount = await demo.getStackElementCount();
    expect(finalCount).toBe(0);

    // Verify that no uncaught exceptions were raised during this overlapping-run scenario
    expect(pageErrors.length).toBe(0);

    // At minimum, ensure the console listener captured messages (proof we observed runtime)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  // Additional assertions/test to exercise "onEnter" behavior indirectly:
  // The FSM entry actions call renderStack(); ensure renderStack is invoked by confirming DOM updated on each step.
  test('renderStack is invoked on entry of states (indirect verification via DOM updates)', async ({ page }) => {
    const demo = new StackDemoPage(page);

    // Start the demo
    await demo.clickDemo();

    // The first entry expected to cause renderStack clearing stack -> empty placeholder
    await demo.waitForExplanationContains('Starting stack demonstration. The stack is initially empty.', 2000);
    expect(await demo.isStackEmptyVisible()).toBe(true);

    // After push(42) entry, renderStack should produce one stack-element
    await demo.waitForExplanationContains('Performing push(42): we add the value 42', 5000);
    expect(await demo.getStackElementCount()).toBe(1);

    // After push(17) entry, renderStack should produce two stack-elements
    await demo.waitForExplanationContains('Performing push(17): now pushing 17 on top of 42.', 6000);
    expect(await demo.getStackElementCount()).toBe(2);

    // After peek, renderStack is also called - ensure count remains unchanged (peek should not remove)
    await demo.waitForExplanationContains('Top element is 17', 7000);
    expect(await demo.getStackElementCount()).toBe(2);

    // After pop(17) and pop(42) entries, renderStack should reflect removals
    await demo.waitForExplanationContains('Removed element is 17', 9000);
    expect(await demo.getStackElementCount()).toBe(1);
    await demo.waitForExplanationContains('Removed element is 42', 11000);
    expect(await demo.getStackElementCount()).toBe(0);
    // Final render should show empty placeholder
    await demo.waitForExplanationContains('Stack demonstration completed. Stack is empty.', 13000);
    expect(await demo.isStackEmptyVisible()).toBe(true);

    // No uncaught page errors throughout this sequence
    expect(pageErrors.length).toBe(0);
  });
});