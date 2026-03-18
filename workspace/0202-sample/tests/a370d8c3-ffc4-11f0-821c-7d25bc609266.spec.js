import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370d8c3-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the Heap Sort demo page
class HeapSortDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btn = page.locator('#demoBtn');
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.stepDesc = page.locator('#stepDesc');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickDemo() {
    await this.btn.click();
  }

  async getButtonText() {
    return (await this.btn.textContent())?.trim() ?? '';
  }

  async getArrayText() {
    return (await this.arrayDisplay.textContent())?.trim() ?? '';
  }

  async getStepDescText() {
    return (await this.stepDesc.textContent())?.trim() ?? '';
  }

  // Wait until array display contains some numeric content (used after initialization)
  async waitForArrayNonEmpty(timeout = 2000) {
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.trim().length > 0;
      },
      '#arrayDisplay',
      { timeout }
    );
  }

  // Wait until step description contains expected substring
  async waitForStepDescContains(substr, timeout = 2000) {
    await this.page.waitForFunction(
      (selector, s) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes(s);
      },
      '#stepDesc',
      substr,
      { timeout }
    );
  }
}

test.describe('Heap Sort Demo - FSM and UI validation (a370d8c3-ffc4-11f0-821c-7d25bc609266)', () => {
  // Collect console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console 'error' messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined
        });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the app
    const demo = new HeapSortDemoPage(page);
    await demo.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // Always assert there were no fatal runtime exceptions surfaced on the page
    // These assertions will fail if there were uncaught errors in the page.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e && e.message).join(' || ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join(' || ')}`).toHaveLength(0);
  });

  test('Initial state S0_Idle: button and displays are present and empty', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) per FSM:
    // - The "Run Heap Sort Demo" button exists and has correct initial text.
    // - The array display and step description are initially empty.
    const demo = new HeapSortDemoPage(page);

    // Button should be visible and have text 'Run Heap Sort Demo'
    await expect(demo.btn).toBeVisible();
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Run Heap Sort Demo');

    // Array display should exist and be empty initially (only whitespace allowed)
    const arrayText = await demo.getArrayText();
    expect(arrayText).toBe('', 'Expected array display to be empty in Idle state');

    // Step description should be empty initially
    const stepDescText = await demo.getStepDescText();
    expect(stepDescText).toBe('', 'Expected step description to be empty in Idle state');
  });

  test('Transition S0 -> S1 and S1 -> S2: clicking Run Demo initializes demo and shows first step', async ({ page }) => {
    // This test validates:
    // - Clicking the Run Demo button from Idle initializes the demo (initDemo is invoked)
    // - The button text changes to 'Next Step'
    // - The first step is displayed (array content and a descriptive step text)
    const demo = new HeapSortDemoPage(page);

    // Click to initialize demo (S0 -> S1 and then display first step S2)
    await demo.clickDemo();

    // After first click, button should have changed to 'Next Step'
    await expect(demo.btn).toBeVisible();
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Next Step');

    // The array display should now contain numbers separated by commas (non-empty)
    await demo.waitForArrayNonEmpty();
    const arrayText = await demo.getArrayText();
    expect(arrayText.length).toBeGreaterThan(0);
    // Quick sanity: expect at least one comma or a number present
    expect(/[0-9]/.test(arrayText)).toBeTruthy();

    // The step description should contain heapify/swap related messaging produced by initDemo
    const stepDescText = await demo.getStepDescText();
    expect(stepDescText.length).toBeGreaterThan(0);
    // The demo's descriptions include phrases like 'Heapify' or 'Swapping' or 'Swap max element'
    const containsHeapRelated = /Heapify|Swapping|Swap max element|Swap/.test(stepDescText);
    expect(containsHeapRelated).toBeTruthy();
  });

  test('S2 looping and S3 final: step repeatedly through all steps to completion and verify final state', async ({ page }) => {
    // This test validates the Step Displayed (S2) looping transitions and the final Demo Completed (S3):
    // - Step through all steps by clicking the button repeatedly
    // - Verify the final displayed array is sorted ascending and the final step description matches FSM evidence
    const demo = new HeapSortDemoPage(page);

    // First click starts the demo showing steps[0]
    await demo.clickDemo();

    // As computed from the demo code, total steps should be:
    // buildMaxHeap: Math.floor(n/2) steps where n=6 => 3 steps
    // extraction steps: for each i from 5 to 1 => 5 iterations, each producing 2 steps => 10
    // total steps = 13. The final completion display happens on the (total steps + 1)th click = 14th click.
    const TOTAL_STEPS = 13;
    const CLICKS_TO_FINAL = TOTAL_STEPS + 1; // 14

    // We already did 1 click; click remaining (CLICKS_TO_FINAL - 1)
    for (let i = 1; i < CLICKS_TO_FINAL; i++) {
      await demo.clickDemo();
      // small micro-wait to let UI update between clicks
      await page.waitForTimeout(10);
    }

    // After finishing, the array display should show the fully sorted array [1,3,4,6,7,9]
    const finalArrayText = await demo.getArrayText();
    // Normalize whitespace
    const normalized = finalArrayText.replace(/\s+/g, '');
    expect(normalized).toBe('1,3,4,6,7,9');

    // Step description should explicitly state completion as per FSM evidence
    const finalStepDesc = await demo.getStepDescText();
    expect(finalStepDesc).toBe('Heap sort completed. Final sorted array shown.');

    // Button text should have changed to 'Restart Demo'
    const finalBtnText = await demo.getButtonText();
    expect(finalBtnText).toBe('Restart Demo');

    // Verify that clicking Restart Demo starts a new initialization cycle (S3 -> S1 -> S2)
    await demo.clickDemo(); // This should restart because internal stepIndex resets to 0 and initDemo runs
    const postRestartBtnText = await demo.getButtonText();
    expect(postRestartBtnText).toBe('Next Step');
    const postRestartArrayText = await demo.getArrayText();
    expect(postRestartArrayText.length).toBeGreaterThan(0);
  });

  test('Edge case: rapid and repeated clicks do not produce runtime errors and FSM stays consistent', async ({ page }) => {
    // This test validates robustness and error scenarios:
    // - Click the demo button many times rapidly (more than necessary)
    // - Ensure no uncaught exceptions or console.error messages appear
    // - Ensure after many clicks the UI shows a valid textual state (either a step array or the sorted array)
    const demo = new HeapSortDemoPage(page);

    // Rapidly click the button a number of times (cover multiple demo cycles)
    const RAPID_CLICKS = 30;
    for (let i = 0; i < RAPID_CLICKS; i++) {
      await demo.clickDemo();
      // small jitter to mimic real user rapid clicks but not synchronous hammering
      await page.waitForTimeout(5);
    }

    // After many clicks, the UI must still be in a valid textual state:
    const arrayText = await demo.getArrayText();
    expect(arrayText).toBeDefined();
    // Must contain digits or be the sorted array
    expect(/[0-9]/.test(arrayText) || arrayText === '1,3,4,6,7,9').toBeTruthy();

    const descText = await demo.getStepDescText();
    // Description may be empty only if between cycles; otherwise should be a known phrase
    expect(typeof descText).toBe('string');

    // Additionally verify the button retains one of the expected labels
    const btnText = await demo.getButtonText();
    expect(['Run Heap Sort Demo', 'Next Step', 'Restart Demo']).toContain(btnText);
  });

  test('Validation of entry actions evidence: renderPage() equivalent - DOM structure exists and elements are present', async ({ page }) => {
    // This test checks the "renderPage()" entry action evidence by asserting the presence of expected components described in FSM:
    // - #demoBtn exists
    // - #arrayDisplay exists
    // - #stepDesc exists
    const demo = new HeapSortDemoPage(page);

    await expect(demo.btn).toBeVisible();
    await expect(demo.arrayDisplay).toBeVisible();
    await expect(demo.stepDesc).toBeVisible();

    // Verify semantic content: the button has accessible name and displays the label
    const label = await demo.getButtonText();
    expect(label).toBe('Run Heap Sort Demo');
  });
});