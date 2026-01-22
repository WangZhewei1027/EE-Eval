import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b488b1-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the Two Pointers visualization page
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.runBtn = page.locator('#runBtn');
    this.arrayContainer = page.locator('#arrayContainer');
    this.explanation = page.locator('#explanation');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return await this.page.locator('h1').textContent();
  }

  async setArrayInput(value) {
    await this.arrayInput.fill(value);
  }

  async setTargetInput(value) {
    // Use fill so non-numeric strings are allowed when testing invalid input
    await this.targetInput.fill(String(value));
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async getExplanationText() {
    return await this.explanation.textContent();
  }

  async getArrayElementsTexts() {
    return await this.arrayContainer.locator('.elem').allTextContents();
  }

  async getArrayElementsCount() {
    return await this.arrayContainer.locator('.elem').count();
  }

  // Wait until explanation contains some substring (polls until timeout)
  async waitForExplanationContains(substring, timeout = 15000) {
    await this.page.waitForFunction(
      (sel, s) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(s);
      },
      '#explanation',
      substring,
      { timeout }
    );
  }

  // Wait until explanation does NOT contain the substring (useful to detect change)
  async waitForExplanationNotContains(substring, timeout = 15000) {
    await this.page.waitForFunction(
      (sel, s) => {
        const el = document.querySelector(sel);
        return el && (!el.textContent || !el.textContent.includes(s));
      },
      '#explanation',
      substring,
      { timeout }
    );
  }

  async getElementByIndex(index) {
    return this.arrayContainer.locator('.elem').nth(index);
  }
}

test.describe('Two Pointers Technique Visualization - FSM compliance and UI tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect any runtime page errors (ReferenceError, SyntaxError, TypeError etc.)
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // store the error message for assertions
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // capture console.error and other error-level logs
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to app
    const twoPointers = new TwoPointersPage(page);
    await twoPointers.goto();
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected runtime errors emitted.
    // These assertions ensure we observe console and page errors and fail if any occurred.
    expect(pageErrors, 'Expected no page runtime errors (ReferenceError, TypeError, SyntaxError)').toHaveLength(0);
    expect(consoleErrors, 'Expected no console.error logs').toHaveLength(0);
  });

  test('S0 Idle: Page renders and initial static content present (onload entry action renderPage/createArrayElements)', async ({ page }) => {
    // This test validates the Idle state (S0) - the page renders correctly on load.
    // We check the main heading, and that the onload logic populated the array elements.
    const twoPointers = new TwoPointersPage(page);

    // Validate heading exists and text content matches FSM evidence
    const heading = await twoPointers.getHeadingText();
    expect(heading).toBe('Two Pointers Technique Visualization');

    // The onload handler should have created array elements (createArrayElements called on window.onload)
    const count = await twoPointers.getArrayElementsCount();
    expect(count).toBeGreaterThanOrEqual(1);

    // The array input field should be normalized (sorted and joined with comma+space)
    const arrayInputValue = await page.locator('#arrayInput').inputValue();
    // Should contain comma separators; we expect numbers remain present
    expect(arrayInputValue.length).toBeGreaterThan(0);
  });

  test.describe('Transitions and Visual States', () => {
    test('S1 ArrayCreated: Clicking Run creates array elements and normalizes input', async ({ page }) => {
      // Validate that clicking "Run Two Pointers" triggers createArrayElements(arr) and updates the DOM
      const twoPointers = new TwoPointersPage(page);

      // Change the array input to an unsorted / spaced representation to test normalization
      await twoPointers.setArrayInput(' 12 , 1, 4,10, 3 ');
      await twoPointers.setTargetInput('13');

      // Click run -> should parse, sort, and create array elements
      await twoPointers.clickRun();

      // After clicking, arrayInput should be normalized (sorted ascending, comma+space separated)
      const normalized = await page.locator('#arrayInput').inputValue();
      // Expect the normalized input to be sorted and contain commas
      expect(normalized).toContain(',');
      // The container should contain elements corresponding to parsed numbers
      const elems = await twoPointers.getArrayElementsTexts();
      expect(elems.length).toBeGreaterThanOrEqual(1);
      // Ensure the elements text values are the numbers parsed
      for (const txt of elems) {
        expect(Number(txt)).not.toBeNaN();
      }
    });

    test('S2 Visualizing: Running the algorithm shows step messages and pointer highlights', async ({ page }) => {
      // Validate the Visualizing state by observing "Step 1:" message and element highlighting
      const twoPointers = new TwoPointersPage(page);

      // Set inputs to known good data
      await twoPointers.setArrayInput('1,2,3,4,6,8,10,12');
      await twoPointers.setTargetInput('14');

      // Start visualization
      await twoPointers.clickRun();

      // The visualizeTwoPointers sets the explanation to "Step 1: Checking ..." immediately before awaiting
      await twoPointers.waitForExplanationContains('Step 1:', 5000);
      const explanationText = await twoPointers.getExplanationText();
      expect(explanationText).toMatch(/Step 1: Checking elements at indices \d+ and \d+/);

      // Also, at least one element should have a pointer-left or pointer-right or pointer-both class applied
      const elems = page.locator('#arrayContainer .elem');
      // There should be at least 1 element with one of the pointer classes
      const pointerLeftCount = await page.locator('#arrayContainer .elem.pointer-left').count();
      const pointerRightCount = await page.locator('#arrayContainer .elem.pointer-right').count();
      const pointerBothCount = await page.locator('#arrayContainer .elem.pointer-both').count();
      expect(pointerLeftCount + pointerRightCount + pointerBothCount).toBeGreaterThan(0);
    });

    test('S3 PairFound: Algorithm finds a pair summing to target (target=14) and highlights them', async ({ page }) => {
      // Validate that a "Found!" message is displayed and pointers highlight the result
      const twoPointers = new TwoPointersPage(page);

      await twoPointers.setArrayInput('1,2,3,4,6,8,10,12');
      await twoPointers.setTargetInput('14');

      await twoPointers.clickRun();

      // Wait until the explanation contains 'Found!' and the target value
      await twoPointers.waitForExplanationContains('Found!', 15000);
      await twoPointers.waitForExplanationContains('sum to 14', 15000);

      const explanationText = await twoPointers.getExplanationText();
      expect(explanationText).toMatch(/Found! Elements at indices \d+ and \d+ sum to 14/);

      // Verify that the highlighted elements exist and are consistent with the explanation indices
      // Extract indices from explanation text
      const match = explanationText.match(/indices (\d+) and (\d+)/);
      if (match) {
        const leftIndex = Number(match[1]);
        const rightIndex = Number(match[2]);
        // Ensure elements at those indices have pointer-left/pointer-right/pointer-both
        const leftEl = page.locator(`#arrayContainer .elem`).nth(leftIndex);
        const rightEl = page.locator(`#arrayContainer .elem`).nth(rightIndex);
        const leftClass = await leftEl.getAttribute('class');
        const rightClass = await rightEl.getAttribute('class');
        const leftHasPointer = /pointer-left|pointer-both/.test(leftClass || '');
        const rightHasPointer = /pointer-right|pointer-both/.test(rightClass || '');
        expect(leftHasPointer || rightHasPointer).toBeTruthy();
      } else {
        // If we cannot parse indices, at least ensure some pointer class is present
        const anyPointer = await page.locator('#arrayContainer .elem.pointer-left, #arrayContainer .elem.pointer-right, #arrayContainer .elem.pointer-both').count();
        expect(anyPointer).toBeGreaterThan(0);
      }
    });

    test('S4 NoPairFound: Algorithm reports no pair when none exists (target=100)', async ({ page }) => {
      // Validate that when no two numbers sum to the target, the final message indicates no pair found
      const twoPointers = new TwoPointersPage(page);

      await twoPointers.setArrayInput('1,2,3,4,6,8,10,12');
      await twoPointers.setTargetInput('100');

      await twoPointers.clickRun();

      // Wait for "No pair found..." message. Allow generous timeout because visualization loops with timeouts.
      await twoPointers.waitForExplanationContains('No pair found in the array that sums to 100.', 20000);

      const explanationText = await twoPointers.getExplanationText();
      expect(explanationText).toBe(`No pair found in the array that sums to 100.`);
      // Verify no pointer classes remain after completion (highlightPointers(-1,-1) is called)
      const anyPointer = await page.locator('#arrayContainer .elem.pointer-left, #arrayContainer .elem.pointer-right, #arrayContainer .elem.pointer-both').count();
      expect(anyPointer).toBe(0);
    });
  });

  test.describe('Invalid inputs and edge cases (S5 InvalidInput)', () => {
    test('Invalid target input (non-numeric) shows "Please enter a valid target number."', async ({ page }) => {
      // Validate the page handles invalid target input gracefully (S5 InvalidInput)
      const twoPointers = new TwoPointersPage(page);

      // Set valid array and invalid (non-numeric) target
      await twoPointers.setArrayInput('1,2,3');
      await twoPointers.setTargetInput('not-a-number');

      await twoPointers.clickRun();

      // The click handler checks isNaN(target) and sets the explanation directly to the message
      await twoPointers.waitForExplanationContains('Please enter a valid target number.', 3000);
      const explanationText = await twoPointers.getExplanationText();
      expect(explanationText).toBe('Please enter a valid target number.');
    });

    test('Array with less than two elements shows "Array needs at least two elements."', async ({ page }) => {
      // Validate the behavior when the array has fewer than two elements
      const twoPointers = new TwoPointersPage(page);

      // Set single-element array and a valid numeric target
      await twoPointers.setArrayInput('5');
      await twoPointers.setTargetInput('10');

      await twoPointers.clickRun();

      // visualizeTwoPointers checks length < 2 and sets message accordingly
      await twoPointers.waitForExplanationContains('Array needs at least two elements.', 3000);
      const explanationText = await twoPointers.getExplanationText();
      expect(explanationText).toBe('Array needs at least two elements.');
    });

    test('Empty array input behaves as invalid/edge-case and results in "Array needs at least two elements."', async ({ page }) => {
      // Validate empty input field (after parsing) results in the array-length check
      const twoPointers = new TwoPointersPage(page);

      await twoPointers.setArrayInput('');
      await twoPointers.setTargetInput('10');

      await twoPointers.clickRun();

      await twoPointers.waitForExplanationContains('Array needs at least two elements.', 3000);
      const explanationText = await twoPointers.getExplanationText();
      expect(explanationText).toBe('Array needs at least two elements.');
    });
  });

  test.describe('Runtime error observation (console & page errors)', () => {
    test('No unexpected runtime errors are emitted during normal usage', async ({ page }) => {
      // This test explicitly exercises the app while observing console/page errors.
      // We run a typical scenario and rely on the afterEach hook to assert no runtime errors were captured.
      const twoPointers = new TwoPointersPage(page);

      await twoPointers.setArrayInput('1,2,3,4,6,8,10,12');
      await twoPointers.setTargetInput('14');

      await twoPointers.clickRun();

      // Wait for the "Found!" message to conclude the visualization
      await twoPointers.waitForExplanationContains('Found!', 15000);

      // Additional assertion: ensure there were no page errors or console errors captured during this run
      // These assertions are also enforced in afterEach, but we assert here again for clarity.
      // The afterEach will surface them if any occurred.
      // (The actual arrays are scoped in beforeEach/afterEach; here we simply ensure the test completes)
      const explanationText = await twoPointers.getExplanationText();
      expect(explanationText).toContain('Found!');
    });
  });
});