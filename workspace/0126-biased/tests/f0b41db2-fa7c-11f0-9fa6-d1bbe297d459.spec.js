import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b41db2-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator("button[onclick='runDemo()']");
    this.output = page.locator('#demoOutput');
  }

  // Navigate to the page
  async open() {
    await this.page.goto(APP_URL);
  }

  // Click the Run Demo button and wait for the demo header to appear
  async clickRunDemo() {
    await this.runButton.click();
    await this.output.locator('h3:has-text("Congestion Window Simulation")').waitFor({ state: 'visible' });
  }

  // Return the full text content of the demo output
  async getOutputText() {
    return this.output.innerText();
  }

  // Return array of paragraph texts inside demoOutput
  async getParagraphTexts() {
    return this.output.locator('p').allTextContents();
  }

  // Return the number of occurrences of a substring in the demo output text
  async countOccurrences(substring) {
    const txt = await this.getOutputText();
    return (txt.match(new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  // Locate packet loss paragraph (styled in red)
  packetLossLocator() {
    return this.output.locator('p[style*="color:red"]');
  }
}

test.describe('Comprehensive Congestion Control Demo - FSM Validation', () => {
  // Arrays to collect runtime issues observed during tests
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleErrors = [];

    // Listen to page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Capture the error message for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Listen to console events and collect error-level logs
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application page BEFORE each test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no-op teardown; listeners are tied to the page fixture and will be cleaned up automatically
  });

  test('Idle state initial render: button present and demo output hidden', async ({ page }) => {
    // Validate the initial "Idle" state per FSM: the Run Demo button exists, demoOutput is hidden
    const demo = new DemoPage(page);

    // The run button should be visible and enabled
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveText('Run Congestion Control Demo');

    // demoOutput should exist but be hidden (display: none)
    const outputHandle = page.locator('#demoOutput');
    await expect(outputHandle).toBeVisible(); // the element exists; CSS may hide children
    // Check computed style to ensure it's hidden as described in HTML (display: none)
    const display = await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return window.getComputedStyle(el).getPropertyValue('display');
    });
    expect(display).toBe('none');

    // Verify runDemo function exists on the global scope (so the onclick will work)
    const runDemoExists = await page.evaluate(() => typeof window.runDemo === 'function');
    expect(runDemoExists).toBe(true);

    // Expect no runtime page errors or console.error messages upon initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('FSM main flow - Run Demo and validate states/transitions', () => {
    test('Run demo and verify transitions: Slow Start -> Congestion Avoidance -> Fast Recovery -> Congestion Avoidance', async ({ page }) => {
      const demo = new DemoPage(page);

      // Click the button to trigger the simulation
      await demo.clickRunDemo();

      // Once the demo runs, the demoOutput should become visible (display: block)
      const displayAfter = await page.evaluate(() => {
        const el = document.getElementById('demoOutput');
        return window.getComputedStyle(el).getPropertyValue('display');
      });
      expect(displayAfter).toBe('block');

      // Collect all paragraph texts to assert ordered transitions and numeric values
      const paragraphs = await demo.getParagraphTexts();

      // 1) Entry: Starting in Slow Start with cwnd = 1, ssthresh = 16
      expect(paragraphs.some(p => p.includes('Starting in') && p.includes('Slow Start') && p.includes('cwnd = 1') && p.includes('ssthresh = 16'))).toBe(true);

      // 2) Slow Start: cwnd should grow exponentially and include values 2,4,8,16 (stops when >= ssthresh)
      expect(paragraphs.some(p => p.includes('ACK received: cwnd = 2') && p.includes('Slow Start'))).toBe(true);
      expect(paragraphs.some(p => p.includes('ACK received: cwnd = 4') && p.includes('Slow Start'))).toBe(true);
      expect(paragraphs.some(p => p.includes('ACK received: cwnd = 8') && p.includes('Slow Start'))).toBe(true);
      expect(paragraphs.some(p => p.includes('ACK received: cwnd = 16') && p.includes('Slow Start'))).toBe(true);

      // 3) Transition to Congestion Avoidance
      expect(paragraphs.some(p => p.includes('cwnd reached ssthresh') && p.includes('switching to') && p.includes('Congestion Avoidance'))).toBe(true);

      // 4) Congestion Avoidance: cwnd increases linearly by 1 for 3 RTTs -> expected values become 17,18,19
      expect(paragraphs.some(p => p.includes('RTT complete: cwnd = 17') && p.includes('Congestion Avoidance'))).toBe(true);
      expect(paragraphs.some(p => p.includes('RTT complete: cwnd = 18') && p.includes('Congestion Avoidance'))).toBe(true);
      expect(paragraphs.some(p => p.includes('RTT complete: cwnd = 19') && p.includes('Congestion Avoidance'))).toBe(true);

      // 5) Packet loss detection should be reported with red styling and the exact message
      const packetLossLoc = demo.packetLossLocator();
      await expect(packetLossLoc).toHaveCount(1);
      await expect(packetLossLoc).toHaveText('Packet loss detected (3 duplicate ACKs)');

      // 6) After loss: ssthresh = floor(19 / 2) = 9 and cwnd = ssthresh + 3 = 12 and phase = Fast Recovery
      expect(paragraphs.some(p => p.includes('Entering') && p.includes('Fast Recovery') && p.includes('cwnd = 12') && p.includes('ssthresh = 9'))).toBe(true);

      // 7) Fast Recovery: cwnd increments by 1 twice -> 13 and 14
      expect(paragraphs.some(p => p.includes('RTT complete: cwnd = 13') && p.includes('Fast Recovery'))).toBe(true);
      expect(paragraphs.some(p => p.includes('RTT complete: cwnd = 14') && p.includes('Fast Recovery'))).toBe(true);

      // 8) Recovery complete: return to Congestion Avoidance
      expect(paragraphs.some(p => p.includes('Recovery complete') && p.includes('returning to') && p.includes('Congestion Avoidance'))).toBe(true);

      // 9) Final summary: Simulation complete message present
      expect(paragraphs.some(p => p.includes('Simulation complete'))).toBe(true);

      // Ensure no runtime exceptions or console.error messages were emitted during the simulation
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking the Run Demo button twice resets and reruns the simulation (idempotent run)', async ({ page }) => {
      const demo = new DemoPage(page);

      // First run
      await demo.clickRunDemo();
      const firstCount = await demo.countOccurrences('Simulation complete.');
      expect(firstCount).toBe(1);

      // Second run: clicking again should replace the output (innerHTML reset at start of runDemo)
      await demo.clickRunDemo();
      const secondCount = await demo.countOccurrences('Simulation complete.');
      expect(secondCount).toBe(1); // still exactly one "Simulation complete." after the second run

      // Ensure the packet loss paragraph is present after the second run too
      await expect(demo.packetLossLocator()).toHaveCount(1);

      // No page errors after repeated runs
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Rapid multiple clicks do not cause uncaught exceptions and result in a coherent final state', async ({ page }) => {
      const demo = new DemoPage(page);

      // Rapidly click the Run Demo button multiple times
      await Promise.all([
        demo.runButton.click(),
        demo.runButton.click(),
        demo.runButton.click()
      ]);

      // Wait for the expected header from the simulation to ensure at least one run completed
      await demo.output.locator('h3:has-text("Congestion Window Simulation")').waitFor({ state: 'visible' });

      // Final output should still contain the key phases and final simulation complete message
      const outText = await demo.getOutputText();
      expect(outText).toContain('Starting in');
      expect(outText).toContain('Slow Start');
      expect(outText).toContain('Congestion Avoidance');
      expect(outText).toContain('Fast Recovery');
      expect(outText).toContain('Simulation complete.');

      // Ensure no uncaught exceptions observed during the rapid clicks
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('FSM and runtime introspection / edge checks', () => {
    test('Verify runDemo is defined and the page contains expected static content (sanity checks)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Sanity: page title and main heading are present and correct
      const title = await page.title();
      expect(title).toBe('Comprehensive Guide to Congestion Control');

      const heading = page.locator('h1');
      await expect(heading).toHaveText('Comprehensive Guide to Congestion Control');

      // The global runDemo function must exist for the onclick handler to work
      const exists = await page.evaluate(() => typeof window.runDemo === 'function');
      expect(exists).toBe(true);

      // No runtime problems on load (sanity)
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // Also verify that the demoOutput element is present in the DOM even if hidden
      await expect(demo.output).toBeVisible();
      const display = await page.evaluate(() => window.getComputedStyle(document.getElementById('demoOutput')).display);
      expect(display).toBe('none');
    });

    test('Assert that any unexpected runtime errors would be captured (observer test)', async ({ page }) => {
      // This test ensures our listeners capture page errors and console errors if they occur.
      // We assert the current state (no errors). If the implementation had runtime exceptions,
      // these arrays would be non-empty and the assertions below would fail, surfacing the issue.

      // At this point in the lifecycle, listeners have been registered in beforeEach.
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });
});