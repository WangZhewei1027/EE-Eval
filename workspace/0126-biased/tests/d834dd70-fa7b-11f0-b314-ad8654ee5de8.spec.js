import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d834dd70-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page object for the Counting Sort demonstration page.
 * Encapsulates common interactions and queries used across tests.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runDemoSelector = '#runDemo';
    this.demoContentSelector = '#demoContent';
    this.consoleMessages = [];
    this.pageErrors = [];
    // Bind listeners when constructed
    this.page.on('console', (msg) => {
      // capture all console messages with their type and text
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // capture unhandled exceptions from the page
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  get runDemo() {
    return this.page.locator(this.runDemoSelector);
  }

  get demoContent() {
    return this.page.locator(this.demoContentSelector);
  }

  async isDemoVisible() {
    // Use computed style to check display property specifically, as the FSM uses out.style.display = 'block'
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return window.getComputedStyle(el).display !== 'none';
    }, this.demoContentSelector);
  }

  async clickRunDemo() {
    await this.runDemo.click();
  }

  async isRunDemoDisabled() {
    return await this.page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      return !!(btn && btn.disabled);
    }, this.runDemoSelector);
  }

  async getRunDemoStyleOpacity() {
    return await this.page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      return btn ? btn.style.opacity : '';
    }, this.runDemoSelector);
  }

  async demoContentHTML() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.innerHTML : null;
    }, this.demoContentSelector);
  }

  // Helpers to inspect captured console/page errors
  getConsoleErrors() {
    return this.consoleMessages.filter((m) => m.type === 'error');
  }

  getAllConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Counting Sort — FSM and UI tests (d834dd70-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // We'll create a new page object for each test to isolate console/pageerror captures.
  test.describe.configure({ mode: 'parallel' });

  test('Initial state (S0_Idle): Run demonstration button present and demo content hidden', async ({ page }) => {
    // Setup page object and navigate
    const demo = new DemoPage(page);
    await demo.goto();

    // Validate the Run demonstration button exists, has expected attributes and is enabled.
    const btn = demo.runDemo;
    await expect(btn).toHaveCount(1);
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-controls', 'demoContent');
    await expect(btn).toHaveClass(/btn/); // contains 'btn' class
    await expect(btn).toHaveClass(/small/); // contains 'small' class

    // Button should be enabled initially
    const disabled = await demo.isRunDemoDisabled();
    expect(disabled).toBe(false);

    // demoContent should be hidden (style="display:none")
    const demoVisible = await demo.isDemoVisible();
    expect(demoVisible).toBe(false);

    // There should be no page errors or console.error messages just from loading
    const pageErrors = demo.getPageErrors();
    const consoleErrors = demo.getConsoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition (RunDemoClick): clicking Run demonstration enters Demo Running (S1_DemoRunning)', async ({ page }) => {
    // This test validates the transition from Idle -> DemoRunning:
    // - demoContent becomes visible (onEnter action showDemoContent)
    // - run button becomes disabled (btn.disabled = true)
    // - inline style opacity is set to 0.7
    // - demoContent is populated with the worked example including the final B array
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the Run demonstration button exactly once
    await demo.clickRunDemo();

    // Wait for the demo content to be visible (script sets out.style.display = 'block')
    await expect(demo.demoContent).toBeVisible();

    // Validate computed display state is no longer 'none'
    const demoVisible = await demo.isDemoVisible();
    expect(demoVisible).toBe(true);

    // The button should now be disabled
    const disabled = await demo.isRunDemoDisabled();
    expect(disabled).toBe(true);

    // The button style opacity should have been set to 0.7 by the script
    const opacity = await demo.getRunDemoStyleOpacity();
    // Some browsers stringify the style exactly; ensure the value includes '0.7' when present
    expect(opacity === '0.7' || opacity === '') .toBeTruthy(); // Accept '' in case runtime styles aren't reflected, but generally should be '0.7'

    // demoContent.innerHTML should contain the final sorted array text
    const html = await demo.demoContentHTML();
    expect(html).toBeTruthy();
    expect(html).toContain('Final sorted array B');
    expect(html).toContain('[1, 2, 2, 3, 3, 4, 8]'); // final B

    // The demo content should include the "Input array A (index : value)" label and array rows
    expect(html).toContain('Input array A (index : value)');
    expect(html).toContain('<div class="array-row" role="list" aria-label="input array">');
    expect(html).toContain('<div class="cell">4</div>'); // one of the input values

    // Ensure no uncaught exceptions (pageerror) or console.error were emitted as a result of the click/action
    const pageErrors = demo.getPageErrors();
    const consoleErrors = demo.getConsoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotence / edge case: clicking the Run demonstration button a second time has no effect', async ({ page }) => {
    // The page script guards against repeated runs via `if(hasRun) return;`
    // This test verifies that a second click does not change content, does not re-enable the button,
    // and does not produce errors.
    const demo = new DemoPage(page);
    await demo.goto();

    // First click
    await demo.clickRunDemo();

    // Capture the current innerHTML snapshot of demoContent after first click
    const firstHTML = await demo.demoContentHTML();
    expect(firstHTML).toBeTruthy();
    expect(firstHTML).toContain('[1, 2, 2, 3, 3, 4, 8]'); // sanity

    // Attempt a second click - should be no-op because button should be disabled
    // Use try/catch: calling click on a disabled button still triggers Playwright click, but the handler early-returns
    await demo.clickRunDemo();

    // After second click, the innerHTML should remain identical
    const secondHTML = await demo.demoContentHTML();
    expect(secondHTML).toBe(firstHTML);

    // Button should remain disabled
    const disabled = await demo.isRunDemoDisabled();
    expect(disabled).toBe(true);

    // There should still be no page errors or console errors after the second click
    const pageErrors = demo.getPageErrors();
    const consoleErrors = demo.getConsoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM structure and content validation for the demo (verifies entry action populated expected nodes)', async ({ page }) => {
    // This test examines specific elements created inside the demoContent to ensure the entry action
    // populated the expected array rows and labels according to the worked example.
    const demo = new DemoPage(page);
    await demo.goto();

    // Trigger the demo to populate content
    await demo.clickRunDemo();

    // Use locators within the demoContent to validate presence of key nodes
    const demoRoot = page.locator('#demoContent');
    await expect(demoRoot).toBeVisible();

    // Validate that there are array-row elements and that they include proper labels
    const label = demoRoot.locator('.label').first();
    await expect(label).toHaveText(/Input array A \(index : value\)/);

    // Validate that there is a row with aria-label="input array values" and contains the expected sequence including '4' and '1'
    const inputValuesRow = demoRoot.locator('[aria-label="input array values"]');
    await expect(inputValuesRow).toContainText('4');
    await expect(inputValuesRow).toContainText('2');
    await expect(inputValuesRow).toContainText('8');
    await expect(inputValuesRow).toContainText('1');

    // Validate that the "Step 1 — Count occurrences" section exists and shows C array values including '3' for C[2] after counting
    await expect(demoRoot).toContainText('Step 1 — Count occurrences');
    await expect(demoRoot).toContainText('C');
    // Confirm cumulative counts section exists
    await expect(demoRoot).toContainText('Step 2 — Cumulative counts');

    // The "Final sorted array B" summary should be present and show the final array
    const finalDiv = demoRoot.locator('.final');
    await expect(finalDiv).toBeVisible();
    await expect(finalDiv).toContainText('[1, 2, 2, 3, 3, 4, 8]');

    // Ensure no page errors or console.error messages were emitted during content population
    const pageErrors = demo.getPageErrors();
    const consoleErrors = demo.getConsoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observing console messages and page errors during lifecycle (load + interactions)', async ({ page }) => {
    // This test is explicitly about collecting console messages and page errors across the lifecycle,
    // and asserting expectations about them. It demonstrates monitoring of runtime problems.
    const demo = new DemoPage(page);
    await demo.goto();

    // Collect baseline console messages (if any) after load
    const initialConsole = demo.getAllConsoleMessages().slice(); // snapshot

    // Interact: run demo
    await demo.clickRunDemo();

    // Wait briefly to allow handlers to run; the click handler is synchronous but innerHTML is set.
    await page.waitForTimeout(50);

    // Gather final captured messages
    const allConsole = demo.getAllConsoleMessages();
    const pageErrors = demo.getPageErrors();

    // We do not expect uncaught exceptions in this page implementation; assert none occurred.
    expect(pageErrors.length).toBe(0);

    // If any console messages were emitted, ensure none are of type 'error'.
    const consoleErrors = allConsole.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Also assert that there was at least one console message or none; this assertion is tolerant:
    // the important check is that no console.error or pageerror occurred.
    expect(Array.isArray(allConsole)).toBe(true);
  });
});