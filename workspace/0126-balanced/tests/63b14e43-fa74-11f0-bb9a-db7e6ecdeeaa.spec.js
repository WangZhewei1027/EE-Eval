import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b14e43-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object model for the Interpolation Search Demo
class InterpolationSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchBtn = page.locator('#searchBtn');
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.stepsDiv = page.locator('#steps');
    this.finalResult = page.locator('#finalResult');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setArray(value) {
    await this.arrayInput.fill(value);
  }

  async setTarget(value) {
    // Playwright's fill for number input requires string
    await this.targetInput.fill(value);
  }

  async clickSearch() {
    await this.searchBtn.click();
  }

  async getFinalResultText() {
    return (await this.finalResult.textContent()) || '';
  }

  async waitForFinalResultContains(substring, options = { timeout: 2000 }) {
    await expect(this.finalResult).toContainText(substring, options);
  }

  async waitForStepsCountAtLeast(n, options = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (sel, count) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.children.length >= count;
      },
      this.stepsDiv.selector,
      n,
      options
    );
  }

  async isArrayDisplayEmpty() {
    const html = await this.arrayDisplay.innerHTML();
    // treat empty or whitespace as empty
    return html.trim() === '';
  }

  async isStepsEmpty() {
    const txt = await this.stepsDiv.textContent();
    return (!txt || txt.trim() === '');
  }
}

test.describe.serial('Interpolation Search Visualization - FSM tests', () => {
  // Collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert there were no unexpected runtime errors on the page.
    // This validates that loading and interactions did not produce uncaught exceptions.
    // If there are page errors or console errors, this assertion will fail and report them.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Build descriptive message for test failure
      const pageErrMessages = pageErrors.map((e) => e.message ? e.message : String(e)).join('\n---\n');
      const consoleErrMessages = consoleErrors.map((c) => c.text).join('\n---\n');
      throw new Error(
        `Runtime errors were detected during the test.\nPage errors:\n${pageErrMessages || '<none>'}\n\nConsole errors:\n${consoleErrMessages || '<none>'}`
      );
    }
  });

  test('S0_Idle: initial render shows title and inputs (Idle state)', async ({ page }) => {
    // Validate initial page render (S0_Idle)
    const p = new InterpolationSearchPage(page);
    await p.goto();

    // Confirm heading is present and correct
    await expect(p.heading).toBeVisible();
    await expect(p.heading).toHaveText('Interpolation Search Visualization');

    // Confirm inputs have default values as per the HTML implementation
    await expect(p.arrayInput).toHaveValue(/10\s*,\s*20/);
    await expect(p.targetInput).toHaveValue('70');

    // Confirm result areas are initially empty (reflecting Idle state)
    expect(await p.isArrayDisplayEmpty()).toBe(true);
    expect(await p.isStepsEmpty()).toBe(true);
    expect(await p.getFinalResultText()).toBe('');

    // No runtime errors occurred during page load (checked in afterEach)
  });

  test('S0 -> S1 -> S2 -> S3: search for existing element transitions to Result Found', async ({ page }) => {
    // This test covers:
    // - Clicking the Search button when valid inputs are present (SearchClick event)
    // - clearDisplay() being invoked (S1_InputReceived entry)
    // - interpolationSearch being executed and stepCallback being called (S2_Searching)
    // - Final result indicating the element is found (S3_ResultFound)
    const p1 = new InterpolationSearchPage(page);
    await p.goto();

    // Verify starting state
    await expect(p.finalResult).toHaveText('', { timeout: 1000 });

    // Click search with default array and target=70
    const clickPromise = (async () => {
      // Click and immediately observe intermediate state (clearDisplay should clear displays)
      await p.clickSearch();
    })();

    // Immediately after click, the page's clearDisplay should have emptied arrayDisplay and steps
    // We assert this without waiting for the asynchronous search to finish.
    await p.page.waitForTimeout(5); // tiny wait to let event handler run clearDisplay synchronously
    expect(await p.isArrayDisplayEmpty()).toBe(true);
    expect(await p.isStepsEmpty()).toBe(true);

    // Now wait for steps to start being appended (Searching state). There should be at least one step appended.
    await p.waitForStepsCountAtLeast(1, { timeout: 2000 });

    // Verify that steps contain messages indicating interpolation positions / comparisons
    const stepsText = await p.stepsDiv.innerText();
    expect(stepsText.length).toBeGreaterThan(0);
    expect(/Calculated position|Found key|Key is greater|Key is less|not found/i.test(stepsText)).toBeTruthy();

    // Wait for final result to indicate found; for the default data target 70, expected index is 6 (0-based).
    await p.waitForFinalResultContains('found at index', { timeout: 2000 });
    const finalText = await p.getFinalResultText();
    expect(finalText).toContain('Result: Element 70 found at index 6.');

    // Verify arrayDisplay now shows the array with highlights (contains 'Array:' and the value '70' somewhere)
    const arrayHtml = await p.arrayDisplay.innerHTML();
    expect(arrayHtml).toContain('Array:');
    expect(arrayHtml).toContain('70');

    // Ensure steps include a "Found key" message as evidence of reaching S3_ResultFound
    expect(stepsText).toMatch(/Found key 70 at position \d+\.|Found key 70|Found key/);

    // No runtime errors occurred (checked in afterEach)
  });

  test('S2 -> S4: search for a non-existent element transitions to Result Not Found', async ({ page }) => {
    // This test validates the path where interpolationSearch returns -1 and S4_ResultNotFound is shown.
    const p2 = new InterpolationSearchPage(page);
    await p.goto();

    // Use a target not in the array
    await p.setTarget('999');
    await p.clickSearch();

    // Wait for steps to appear (search started)
    await p.waitForStepsCountAtLeast(1, { timeout: 2000 });

    // Wait for final result to indicate NOT found
    await p.waitForFinalResultContains('NOT found', { timeout: 2000 });
    const finalText1 = await p.getFinalResultText();
    expect(finalText).toContain('Result: Element 999 NOT found in the array.');
  });

  test('Transition actions: clearDisplay is invoked on SearchClick (arrayDisplay and steps cleared)', async ({ page }) => {
    // Explicitly verify clearDisplay behavior on transition from Idle to InputReceived.
    const p3 = new InterpolationSearchPage(page);
    await p.goto();

    // Pre-populate displays to non-empty states to ensure clearDisplay clears them
    // We cannot call internal functions, but we can append text to the DOM to simulate previous state.
    await p.page.evaluate(() => {
      document.getElementById('arrayDisplay').textContent = 'PREVIOUS';
      document.getElementById('steps').textContent = 'PREVIOUS STEPS';
      document.getElementById('finalResult').textContent = 'PREVIOUS RESULT';
    });

    // Click search (clearDisplay should clear the previous content synchronously)
    await p.clickSearch();

    // Small wait for the click handler to run clearDisplay
    await p.page.waitForTimeout(5);

    expect(await p.isArrayDisplayEmpty()).toBe(true);
    expect(await p.isStepsEmpty()).toBe(true);
    expect(await p.getFinalResultText()).toBe('');
  });

  test('Edge case: invalid (unsorted) array shows validation message', async ({ page }) => {
    // This test validates the invalid array scenario -> S1/InputReceived then immediate final message
    const p4 = new InterpolationSearchPage(page);
    await p.goto();

    // Provide an unsorted array
    await p.setArray('30, 20, 10');
    await p.setTarget('20');
    await p.clickSearch();

    // Since parseArray returns null for unsorted arrays, finalResult should be set immediately
    await p.waitForFinalResultContains('Array invalid or not sorted ascending!', { timeout: 1000 });
    const finalText2 = await p.getFinalResultText();
    expect(finalText).toContain('Array invalid or not sorted ascending! Please check your input.');
  });

  test('Edge case: empty array shows "Array is empty."', async ({ page }) => {
    // This test validates behavior when the user provides an empty array input
    const p5 = new InterpolationSearchPage(page);
    await p.goto();

    await p.setArray(''); // empty
    await p.setTarget('10');
    await p.clickSearch();

    await p.waitForFinalResultContains('Array is empty.', { timeout: 1000 });
    const finalText3 = await p.getFinalResultText();
    expect(finalText).toContain('Array is empty.');
  });

  test('Edge case: invalid target value shows "Target value is not a valid number."', async ({ page }) => {
    // This test validates behavior when the target input is not a valid number
    const p6 = new InterpolationSearchPage(page);
    await p.goto();

    await p.setArray('10,20,30');
    await p.setTarget(''); // empty target
    await p.clickSearch();

    await p.waitForFinalResultContains('Target value is not a valid number.', { timeout: 1000 });
    const finalText4 = await p.getFinalResultText();
    expect(finalText).toContain('Target value is not a valid number.');
  });

  test('Visual feedback: array highlighting and step messages appear during search', async ({ page }) => {
    // Validate that during the Searching state visual highlights (via inline styles) are applied
    // and that step messages are appended to the steps container.
    const p7 = new InterpolationSearchPage(page);
    await p.goto();

    await p.setArray('10,20,30,40,50');
    await p.setTarget('30');
    await p.clickSearch();

    // Wait until steps start
    await p.waitForStepsCountAtLeast(1, { timeout: 2000 });

    // Check that the arrayDisplay innerHTML contains inline style attributes that represent highlighting
    const arrayHtml1 = await p.arrayDisplay.innerHTML();
    expect(arrayHtml).toMatch(/<span style=".*">/);

    // Steps should include messages with 'Step' or 'Calculated position' or final messages
    const stepsText1 = await p.stepsDiv.innerText();
    expect(/Calculated position|Step \d+:|Found key|not found/i.test(stepsText)).toBeTruthy();

    // Wait for final result (found)
    await p.waitForFinalResultContains('found at index', { timeout: 2000 });
  });
});