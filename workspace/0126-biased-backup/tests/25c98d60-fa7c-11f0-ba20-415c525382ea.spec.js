import { test, expect } from '@playwright/test';

// Page object encapsulating interactions with the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c98d60-fa7c-11f0-ba20-415c525382ea.html';
    this.demoButton = page.locator('#demoButton');
    this.demoArea = page.locator('#demoArea');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(this.url);
  }

  // Click the Run Demo button
  async clickRunDemo() {
    await this.demoButton.click();
  }

  // Return full demoArea text content
  async getDemoAreaText() {
    return (await this.demoArea.textContent()) ?? '';
  }

  // Wait until demoArea contains a specific substring
  async waitForDemoText(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (selector, substr) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes(substr);
      },
      this.demoArea.selector,
      substring,
      { timeout }
    );
  }

  // Extract popped sequence from demoArea text
  async extractPoppedSequence() {
    const text = await this.getDemoAreaText();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const popped = [];
    for (const line of lines) {
      // Match lines like: Popped element "C" with priority 8. Queue now: [30, 20, 15, 10]
      const m = line.match(/^Popped element\s+"(.+?)"\s+with priority\s+(\d+)/);
      if (m) {
        popped.push({ value: m[1], priority: Number(m[2]), raw: line });
      }
    }
    return popped;
  }
}

// Group tests about FSM states and transitions
test.describe('Priority Queue Demo - FSM states and transitions', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup: runs before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (logs, warnings, errors)
    page.on('console', msg => {
      const text = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push(text);
    });

    // Collect uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });
  });

  // Test the initial Idle state S0_Idle
  test('S0_Idle: initial render - button present and demo area is empty', async ({ page }) => {
    const demo = new DemoPage(page);
    // Navigate to the page (this represents renderPage() entry action)
    await demo.goto();

    // Validate that the Run Demo button exists and is visible
    await expect(demo.demoButton).toBeVisible();
    await expect(demo.demoButton).toHaveText('Run Demo');

    // Validate demoArea exists, has aria-live attribute, and is empty initially (Idle state)
    await expect(demo.demoArea).toBeVisible();
    const ariaLive = await demo.demoArea.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');

    const initialText = (await demo.getDemoAreaText()).trim();
    // In Idle state the demo area should be empty (no logs)
    expect(initialText).toBe('', 'Expected demo area to be empty in Idle state (S0_Idle)');

    // Ensure no unexpected console errors were emitted during initial render
    expect(pageErrors).toHaveLength(0);
    // It's acceptable to have console info/debug, but there should be no uncaught page errors
  });

  // Test the transition S0_Idle -> S1_DemoRunning via RunDemo click
  test('S0_Idle -> S1_DemoRunning: clicking Run Demo starts demo and shows insertion logs', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Sanity: demo area empty before click (resetOutput() expected on entry to DemoRunning)
    const beforeClick = (await demo.getDemoAreaText()).trim();
    expect(beforeClick).toBe('', 'Expected demo area cleared before running demo');

    // Click the Run Demo button to trigger the demo (RunDemo event)
    await demo.clickRunDemo();

    // Wait until demo writes the starting line indicating the demo run began
    await demo.waitForDemoText('Starting Priority Queue Demo', 2000);

    // Validate that insertion logs appear for each input element
    const text = await demo.getDemoAreaText();
    expect(text).toContain('Starting Priority Queue Demo (Max-Heap):');
    // There should be inserted logs for elements A, B, C, D, E
    expect(text).toContain('Inserted element "A" with priority 5');
    expect(text).toContain('Inserted element "B" with priority 3');
    expect(text).toContain('Inserted element "C" with priority 8');
    expect(text).toContain('Inserted element "D" with priority 1');
    expect(text).toContain('Inserted element "E" with priority 7');

    // Verify that the demoArea shows current queue states after inserts (displayHeap output)
    expect(text).toMatch(/\[.*A\(p=5\).*\]/); // basic sanity: displayHeap uses value(p=priority) pattern somewhere

    // Ensure no uncaught page errors happened during demo running
    expect(pageErrors).toHaveLength(0);

    // Record console messages are captured (we don't assert specific console output, but ensure listener worked)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  // Test the transition S1_DemoRunning -> S2_DemoCompleted and validate final results
  test('S1_DemoRunning -> S2_DemoCompleted: demo completes and final popped order is correct', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Start demo
    await demo.clickRunDemo();

    // Wait for final popped element line (the last expected pop is D with priority 1)
    await demo.waitForDemoText('Popped element "D" with priority 1', 2000);

    // Extract popped sequence and validate ordering (max-heap expected: C, E, A, B, D)
    const popped = await demo.extractPoppedSequence();
    const poppedValues = popped.map(p => p.value);
    const poppedPriorities = popped.map(p => p.priority);

    expect(poppedValues).toEqual(['C', 'E', 'A', 'B', 'D']);
    expect(poppedPriorities).toEqual([8, 7, 5, 3, 1]);

    // Validate the final demoArea contains the full joined log (entry action displayResults() expected)
    const finalText = await demo.getDemoAreaText();
    expect(finalText.length).toBeGreaterThan(50);
    expect(finalText).toContain('Now popping elements by priority:');

    // The final queue state after all pops should be empty (displayed as [])
    expect(finalText).toMatch(/Queue now:\s*\[\s*\]/);

    // Again ensure no uncaught page errors (S2 is final)
    expect(pageErrors).toHaveLength(0);
  });

  // Edge case: clicking the Run Demo button multiple times should reset output and re-run cleanly
  test('Edge case: multiple clicks reset output and re-run demo without leaking state', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRunDemo();
    await demo.waitForDemoText('Popped element "D" with priority 1', 2000);
    const firstRunText = await demo.getDemoAreaText();

    // Click again to run demo a second time - expected behavior: output resets and a new run logs appear
    await demo.clickRunDemo();

    // Because the code resets demoArea.textContent = '' at the start of the click listener,
    // after a short moment the "Starting Priority Queue Demo" marker should reappear.
    await demo.waitForDemoText('Starting Priority Queue Demo', 2000);

    const secondRunText = await demo.getDemoAreaText();

    // Ensure second run's output is present and not just appended to the first (should start fresh)
    expect(secondRunText).toContain('Starting Priority Queue Demo (Max-Heap):');
    // The content from the first run should not be present verbatim at the beginning of the second run.
    // We assert that the two outputs are not identical strings (indicates a fresh reset and run)
    expect(secondRunText).not.toBe(firstRunText);

    // Extract popped values from second run as well and ensure ordering is still correct
    const poppedSecond = await demo.extractPoppedSequence();
    const poppedValuesSecond = poppedSecond.map(p => p.value);
    expect(poppedValuesSecond).toEqual(['C', 'E', 'A', 'B', 'D']);

    // Ensure no errors were thrown across runs
    expect(pageErrors).toHaveLength(0);
  });

  // Observability test: ensure accessibility attributes and visual feedback exist as part of UI expectations
  test('Visual feedback and accessibility: demo area styling and aria-live present', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // The demo area should have the expected class and styling is applied in CSS.
    const className = await demo.demoArea.getAttribute('class');
    expect(className).toContain('demo-area');

    // Ensure aria-live attribute is present to announce updates to assistive technologies
    const aria = await demo.demoArea.getAttribute('aria-live');
    expect(aria).toBe('polite');

    // Start demo and confirm demoArea receives multiline content (visual feedback)
    await demo.clickRunDemo();
    await demo.waitForDemoText('Inserted element "E" with priority 7', 2000);
    const text = await demo.getDemoAreaText();
    // Validate that there are multiple lines showing progression/inserts and pops
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(8); // several insert lines + pops

    // No uncaught page errors should have occurred
    expect(pageErrors).toHaveLength(0);
  });

  // Teardown: after each test verify no unexpected uncaught exceptions were emitted to the page
  test.afterEach(async () => {
    // This final check will ensure the page did not emit any uncaught exceptions during the test.
    // If pageErrors is non-empty the test will fail here as required by the assertions above.
    expect(pageErrors).toHaveLength(0);
    // We do not assert a particular number of console messages because informational logs are expected.
  });
});