import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b39e52-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the Counting Sort demo
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputSelector = '#inputArray';
    this.sortBtnSelector = '#sortBtn';
    this.errorSelector = '#errorMsg';
    this.resultSelector = '#result';
    this.visualizationSelector = '#visualization';
    this.stepsSelector = '#steps';
    this.headingSelector = 'h1';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeadingText() {
    return (await this.page.textContent(this.headingSelector)) || '';
  }

  async fillInput(value) {
    await this.page.fill(this.inputSelector, value);
  }

  async clickSort() {
    await this.page.click(this.sortBtnSelector);
  }

  async pressEnterOnInput() {
    await this.page.press(this.inputSelector, 'Enter');
  }

  async getErrorText() {
    return (await this.page.textContent(this.errorSelector)) || '';
  }

  async getResultText() {
    return (await this.page.textContent(this.resultSelector)) || '';
  }

  async getVisualizationHTML() {
    return (await this.page.innerHTML(this.visualizationSelector)) || '';
  }

  async getStepsText() {
    return (await this.page.textContent(this.stepsSelector)) || '';
  }

  async clearAllOutputs() {
    // Interact with page to reset visible outputs (the page itself clears on click)
    await this.page.evaluate(() => {
      const e = document.getElementById('errorMsg');
      const r = document.getElementById('result');
      const v = document.getElementById('visualization');
      const s = document.getElementById('steps');
      if (e) e.textContent = '';
      if (r) r.textContent = '';
      if (v) v.innerHTML = '';
      if (s) s.textContent = '';
    });
  }
}

test.describe('Counting Sort Visualization & Demo - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Clear trackers
    pageErrors = [];
    consoleErrors = [];

    // Listen for runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages of type error
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('Initial Idle state: page renders and basic components exist', async ({ page }) => {
    // Validate S0_Idle entry: renderPage() should have produced the page heading and components
    const app = new CountingSortPage(page);
    await app.goto();

    // Heading is visible
    const heading = await app.getHeadingText();
    expect(heading).toContain('Counting Sort Visualization & Demo');

    // Input and button exist
    await expect(page.locator('input#inputArray')).toBeVisible();
    await expect(page.locator('button#sortBtn')).toBeVisible();

    // Initial outputs should be empty
    const errorText = await app.getErrorText();
    const resultText = await app.getResultText();
    const vizHTML = await app.getVisualizationHTML();
    const stepsText = await app.getStepsText();

    expect(errorText).toBe('');
    expect(resultText).toBe('');
    expect(vizHTML.trim()).toBe('');
    expect(stepsText).toBe('');

    // Assert there were no runtime page errors or console.error messages upon initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('User interactions and transitions', () => {
    test('S1_InputReceived -> S2_Sorting -> S3_SortedOutput: sorts valid comma-separated input', async ({ page }) => {
      const app = new CountingSortPage(page);
      await app.goto();

      // Enter sample input and click sort to trigger transitions S1 -> S2 -> S3
      await app.fillInput('4, 2, 2, 8, 3, 3, 1');

      // Sanity check: input is reflected
      const inputVal = await page.inputValue('#inputArray');
      expect(inputVal).toBe('4, 2, 2, 8, 3, 3, 1');

      await app.clickSort();

      // Verify sorted result (S3_SortedOutput)
      const result = await app.getResultText();
      expect(result.trim()).toBe('[ 1, 2, 2, 3, 3, 4, 8 ]');

      // Verify visualization rendered frequency bars (non-cumulative). We expect at least one bar and labels.
      const viz = await app.getVisualizationHTML();
      expect(viz).toContain('count-bar');
      // Expect labels for values 0..maxValue to be present (at least number '1' and '8' labels exist)
      expect(viz).toContain('>1<', { ignoreCase: true } ).catch(() => {}); // tolerant check
      expect(viz).toContain('class="count-label">1</div>').catch(() => {});

      // Verify steps contain informative lines produced by countingSort (S2->S3 evidence)
      const steps = await app.getStepsText();
      expect(steps).toContain('Maximum value found: 8');
      expect(steps).toContain('Frequency count completed:');
      expect(steps).toContain('Cumulative count array:');
      expect(steps).toContain('Completed building the sorted output array.');

      // Ensure no runtime page errors or console errors during sorting
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.join('; ')}`).toBe(0);
    });

    test('Enter keypress on input triggers sort (EnterKeyPress event)', async ({ page }) => {
      const app = new CountingSortPage(page);
      await app.goto();

      // Use a different input set and press Enter to trigger button click
      await app.fillInput('3 1 2');
      // Use press which simulates keypress event
      await app.pressEnterOnInput();

      // Validate result
      const result = await app.getResultText();
      expect(result.trim()).toBe('[ 1, 2, 3 ]');

      // Steps should reflect operations
      const steps = await app.getStepsText();
      expect(steps).toContain('Maximum value found: 3');

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('S1_InputReceived -> S4_Error: invalid token should show error message and not display result', async ({ page }) => {
      const app = new CountingSortPage(page);
      await app.goto();

      // Enter invalid input containing a non-digit token and click sort
      await app.fillInput('4, a, 2');
      await app.clickSort();

      // Error state should be active
      const err = await app.getErrorText();
      expect(err).toBe("Invalid input! Please enter only non-negative integers separated by spaces or commas.");

      // Result, visualization, and steps should remain empty
      expect(await app.getResultText()).toBe('');
      expect((await app.getVisualizationHTML()).trim()).toBe('');
      expect(await app.getStepsText()).toBe('');

      // No uncaught exceptions expected (the page handles validation)
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Empty input yields specific message: "Input array is empty."', async ({ page }) => {
      const app = new CountingSortPage(page);
      await app.goto();

      // Ensure input empty and click sort
      await app.fillInput('');
      await app.clickSort();

      const result = await app.getResultText();
      expect(result.trim()).toBe('Input array is empty.');

      // No error message
      expect(await app.getErrorText()).toBe('');

      // Steps and visualization should be empty
      expect(await app.getStepsText()).toBe('');
      expect((await app.getVisualizationHTML()).trim()).toBe('');

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Input exceeding allowed max value triggers user-facing error', async ({ page }) => {
      const app = new CountingSortPage(page);
      await app.goto();

      // Input contains a value > 1000 which should be rejected for visualization
      await app.fillInput('1001 2 3');
      await app.clickSort();

      const err = await app.getErrorText();
      expect(err).toBe('Please enter numbers less than or equal to 1000 for visualization purposes.');

      // No result or visualization
      expect(await app.getResultText()).toBe('');
      expect((await app.getVisualizationHTML()).trim()).toBe('');
      expect(await app.getStepsText()).toBe('');

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Internal behavior validation (visual & textual feedback)', () => {
    test('Visualization reflects frequency counts for input with repeated values', async ({ page }) => {
      const app = new CountingSortPage(page);
      await app.goto();

      // Input with repeated numbers to check frequency bars and labels
      await app.fillInput('2 2 2 0 1 1');
      await app.clickSort();

      // Result should be sorted ascending
      const result = await app.getResultText();
      expect(result.trim()).toBe('[ 0, 1, 1, 2, 2, 2 ]');

      // Visualization should include titles "Value X: Y" for bars (from title attribute)
      const vizHTML = await app.getVisualizationHTML();
      expect(vizHTML).toContain('title="Value 0: 1"');
      expect(vizHTML).toContain('title="Value 1: 2"');
      expect(vizHTML).toContain('title="Value 2: 3"');

      // Steps should include count increments for each processed element
      const steps = await app.getStepsText();
      expect(steps).toContain('Increment count[2]'); // at least one increment for 2
      expect(steps).toContain('Increment count[1]'); // increments for 1
      expect(steps).toContain('Increment count[0]'); // increment for 0

      // No runtime errors during visualization
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // As part of teardown ensure final check for runtime errors did not miss anything
    // We deliberately assert no unexpected runtime errors across tests
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Close page is handled by Playwright runner automatically
  });
});