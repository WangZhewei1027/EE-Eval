import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213d891-fa7a-11f0-acf9-69409043402d.html';

// Page Object to encapsulate common interactions with the demo page
class CountingSortPage {
  constructor(page) {
    this.page = page;
    // Element shortcuts
    this.inputArray = page.locator('#inputArray');
    this.btnLoadArray = page.locator('#btnLoadArray');
    this.btnRandomArray = page.locator('#btnRandomArray');
    this.minValue = page.locator('#minValue');
    this.maxValue = page.locator('#maxValue');
    this.arraySize = page.locator('#arraySize');

    this.btnStartSort = page.locator('#btnStartSort');
    this.btnStepForward = page.locator('#btnStepForward');
    this.btnStepBackward = page.locator('#btnStepBackward');
    this.btnRunToEnd = page.locator('#btnRunToEnd');
    this.btnReset = page.locator('#btnReset');

    this.speedRange = page.locator('#speedRange');
    this.speedDisplay = page.locator('#speedDisplay');
    this.btnToggleAuto = page.locator('#btnToggleAuto');

    this.stepDesc = page.locator('#stepDesc');
    this.inputArrayDisplay = page.locator('#inputArrayDisplay');
    this.countArrayDisplay = page.locator('#countArrayDisplay');
    this.outputArrayDisplay = page.locator('#outputArrayDisplay');

    this.btnViewInput = page.locator('#btnViewInput');
    this.btnViewCount = page.locator('#btnViewCount');
    this.btnViewOutput = page.locator('#btnViewOutput');

    this.viewIndexInput = page.locator('#viewIndexInput');
    this.btnHighlightIndex = page.locator('#btnHighlightIndex');
    this.btnClearHighlight = page.locator('#btnClearHighlight');

    this.log = page.locator('#log');
  }

  // Navigate to the page and ensure initial load
  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  }

  // Helpers to count displayed array items in a container
  async countArrayItems(containerLocator) {
    return await containerLocator.locator('.array-item').count();
  }

  async getArrayItemsText(containerLocator) {
    const items = containerLocator.locator('.array-item');
    const n = await items.count();
    const values = [];
    for (let i = 0; i < n; i++) {
      values.push(await items.nth(i).textContent());
    }
    return values;
  }

  // Fill input array text
  async setInputArrayText(text) {
    await this.inputArray.fill('');
    await this.inputArray.type(text);
  }

  // Click helpers
  async clickLoadArray() { await this.btnLoadArray.click(); }
  async clickRandomArray() { await this.btnRandomArray.click(); }
  async clickStartSort() { await this.btnStartSort.click(); }
  async clickStepForward() { await this.btnStepForward.click(); }
  async clickStepBackward() { await this.btnStepBackward.click(); }
  async clickRunToEnd() { await this.btnRunToEnd.click(); }
  async clickReset() { await this.btnReset.click(); }
  async clickViewInput() { await this.btnViewInput.click(); }
  async clickViewCount() { await this.btnViewCount.click(); }
  async clickViewOutput() { await this.btnViewOutput.click(); }
  async clickHighlight() { await this.btnHighlightIndex.click(); }
  async clickClearHighlight() { await this.btnClearHighlight.click(); }

  // Read stepDesc text
  async getStepDescText() {
    return (await this.stepDesc.textContent())?.trim();
  }

  // Read log area text
  async getLogText() {
    return (await this.log.textContent()) || '';
  }
}

test.describe('Interactive Counting Sort Demo - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let dialogs = [];
  let page;
  let app;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleMessages = [];
    dialogs = [];

    // Create a fresh context to isolate dialogs and console events
    const context = await browser.newContext();
    page = await context.newPage();

    // Listen for page errors and console events
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('dialog', async (dialog) => {
      // Capture dialogs (alerts) and accept them to not block test execution
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    app = new CountingSortPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Basic assertion: there should be no uncaught page errors (ReferenceError, TypeError, SyntaxError)
    // This validates that loading and interactions did not produce fatal runtime errors.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join('; ')}`).toHaveLength(0);
  });

  test('Initial state S0_Idle is correctly set on load', async () => {
    // Validate initial UI state matches S0_Idle FSM evidence
    // stepDesc should be 'Not started'
    await expect(app.stepDesc).toHaveText('Not started');

    // Start button should be disabled initially
    expect(await app.btnStartSort.isDisabled()).toBeTruthy();

    // Log should be empty
    expect((await app.getLogText()).trim()).toBe('');

    // No array items displayed
    expect(await app.countArrayItems(app.inputArrayDisplay)).toBe(0);
    expect(await app.countArrayItems(app.countArrayDisplay)).toBe(0);
    expect(await app.countArrayItems(app.outputArrayDisplay)).toBe(0);
  });

  test.describe('Loading and Generating Arrays (S0 -> S1 transitions)', () => {
    test('Load Array transition updates UI and enables Start', async () => {
      // Enter a valid input array and click Load Array
      const sample = '4,3,2,8,3';
      await app.setInputArrayText(sample);

      await app.clickLoadArray();

      // After loading, stepDesc should indicate readiness to start
      await expect(app.stepDesc).toHaveText('Array loaded. Ready to start Counting Sort.');

      // Start button should be enabled
      expect(await app.btnStartSort.isDisabled()).toBeFalsy();

      // Input array should be displayed with correct number of items and values
      const items = await app.getArrayItemsText(app.inputArrayDisplay);
      expect(items).toEqual(['4','3','2','8','3']);

      // Log should contain a 'Loaded input array' entry
      const log = await app.getLogText();
      expect(log).toContain('Loaded input array: 4, 3, 2, 8, 3');
    });

    test('Generate Random Array transition populates input and enables Start', async () => {
      // Ensure min/max/size are valid (defaults are valid)
      // Click Generate Random Array
      await app.clickRandomArray();

      // After generation, stepDesc should reflect random array loaded
      await expect(app.stepDesc).toHaveText('Random array loaded. Ready to start Counting Sort.');

      // Start button should be enabled
      expect(await app.btnStartSort.isDisabled()).toBeFalsy();

      // Input text field should have been populated with numbers
      const inputVal = await app.inputArray.inputValue();
      // Should parse into at least one number
      const parsed = inputVal.split(/[\s,]+/).filter(p => p.length>0);
      expect(parsed.length).toBeGreaterThan(0);
      for (const p of parsed) {
        // Each part should be an integer string
        expect(/^[+-]?\d+$/.test(p)).toBeTruthy();
      }
    });
  });

  test.describe('Sorting Execution and Step Controls (S1 -> S2 -> S3)', () => {
    // Use a small deterministic array for predictable number of steps
    const smallArray = '2,1,2';

    test('Start Sort generates step history and updates UI (S1 -> S2)', async () => {
      // Load the small array
      await app.setInputArrayText(smallArray);
      await app.clickLoadArray();
      // Start sort
      await app.clickStartSort();

      // Log should include 'Counting Sort started.'
      const log = await app.getLogText();
      expect(log).toContain('Counting Sort started.');

      // Step description should begin with [1 / X]
      const desc = await app.getStepDescText();
      expect(desc).toMatch(/^\[1 \/ \d+\]/);

      // Start button should now be disabled after starting
      expect(await app.btnStartSort.isDisabled()).toBeTruthy();

      // Reset should be enabled after sorting started (per implementation)
      expect(await app.btnReset.isDisabled()).toBeFalsy();
    });

    test('StepForward advances through steps and RunToEnd finishes sorting', async () => {
      // Load and start
      await app.setInputArrayText(smallArray);
      await app.clickLoadArray();
      await app.clickStartSort();

      // Capture initial step index in description
      let desc = await app.getStepDescText();
      expect(desc).toMatch(/^\[1 \/ \d+\]/);

      // Step forward once
      await app.clickStepForward();
      desc = await app.getStepDescText();
      expect(desc).toMatch(/^\[2 \/ \d+\]/);

      // Run to end should take us to finished state
      await app.clickRunToEnd();
      desc = await app.getStepDescText();
      // The finished state detail contains 'Counting sort completed successfully. Output array is sorted.'
      expect(desc).toContain('Counting sort completed successfully. Output array is sorted.');

      // When finished, output array container should display the sorted output
      // Switch to output view and validate items
      await app.clickViewOutput();
      // Wait for rendering of output array items
      const outCount = await app.countArrayItems(app.outputArrayDisplay);
      expect(outCount).toBeGreaterThan(0);

      const outTexts = await app.getArrayItemsText(app.outputArrayDisplay);
      // Verify sorted order for our deterministic input [2,1,2] -> [1,2,2]
      // Some steps may show partial output depending on stepIndex; but RunToEnd should show final output
      // Ensure that the output values when filtered to numbers are sorted non-decreasing
      const numeric = outTexts.map(t => Number(t));
      for (let i = 1; i < numeric.length; i++) {
        expect(numeric[i]).toBeGreaterThanOrEqual(numeric[i-1]);
      }
    });

    test('Reset returns to Idle state (Sx -> S0_Idle)', async () => {
      // Start with load and start
      await app.setInputArrayText(smallArray);
      await app.clickLoadArray();
      await app.clickStartSort();

      // Run to end
      await app.clickRunToEnd();

      // Click Reset
      await app.clickReset();

      // After reset, stepDesc should be 'Reset done. Load or generate array.'
      await expect(app.stepDesc).toHaveText('Reset done. Load or generate array.');

      // Start button should be disabled again
      expect(await app.btnStartSort.isDisabled()).toBeTruthy();

      // Input field should be cleared by reset (per implementation)
      expect(await app.inputArray.inputValue()).toBe('');
    });
  });

  test.describe('Viewing modes and highlighting', () => {
    test('View input/count/output modes show only the respective array', async () => {
      // Use a small array for clarity
      await app.setInputArrayText('0,1,2');
      await app.clickLoadArray();
      await app.clickStartSort();

      // Initially current view mode is 'input' after start
      await app.clickViewInput();
      expect(await app.countArrayItems(app.inputArrayDisplay)).toBeGreaterThan(0);
      expect(await app.countArrayItems(app.countArrayDisplay)).toBe(0);
      expect(await app.countArrayItems(app.outputArrayDisplay)).toBe(0);

      // Switch to count view
      await app.clickViewCount();
      expect(await app.countArrayItems(app.countArrayDisplay)).toBeGreaterThanOrEqual(0);
      // Only one container should be non-empty at a time (others empty string or have items 0)
      // We assert that input array container is empty when count view is active
      expect(await app.countArrayItems(app.inputArrayDisplay)).toBe(0);

      // Switch to output view
      await app.clickViewOutput();
      // Output may have items depending on step index; confirm other containers are empty
      expect(await app.countArrayItems(app.inputArrayDisplay)).toBe(0);
      expect(await app.countArrayItems(app.countArrayDisplay)).toBe(0);
    });

    test('Highlighting an index adds highlight class and can be cleared', async () => {
      // Use a small array
      await app.setInputArrayText('5,6,7,8');
      await app.clickLoadArray();
      await app.clickStartSort();

      // Ensure we are viewing input
      await app.clickViewInput();

      // Highlight index 2
      await app.viewIndexInput.fill('2');
      await app.clickHighlight();

      // There should be exactly one highlighted element in the input display
      const highlighted = app.inputArrayDisplay.locator('.array-item.highlight');
      await expect(highlighted).toHaveCount(1);
      const text = (await highlighted.nth(0).textContent()).trim();
      expect(text).toBe('7');

      // Clear highlight
      await app.clickClearHighlight();
      await expect(app.inputArrayDisplay.locator('.array-item.highlight')).toHaveCount(0);
    });

    test('Highlight out-of-bounds triggers alert dialog (edge case)', async () => {
      // Use a small array and start so that history exists
      await app.setInputArrayText('1,2');
      await app.clickLoadArray();
      await app.clickStartSort();

      // Make sure view is input
      await app.clickViewInput();

      // Try to highlight index 10 which is out-of-bounds
      await app.viewIndexInput.fill('10');
      await app.clickHighlight();

      // Dialog should have been shown and accepted in beforeEach listener
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.message).toMatch(/Highlight index out of bounds|out of bounds|No sorting state loaded/i);
    });
  });

  test.describe('Validation and edge cases', () => {
    test('Invalid array input triggers an alert and does not start', async () => {
      // Enter invalid array text
      await app.setInputArrayText('a, b, c');
      await app.clickLoadArray();

      // An alert should have been shown (captured)
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const last = dialogs[dialogs.length - 1];
      expect(last.message).toMatch(/Invalid array input/i);

      // Start should remain disabled
      expect(await app.btnStartSort.isDisabled()).toBeTruthy();
    });

    test('Invalid min/max (min>max) prevents random generation', async () => {
      // Set min greater than max
      await app.minValue.fill('10');
      await app.maxValue.fill('1');
      await app.clickRandomArray();

      // Alert should have appeared about invalid inputs
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const last = dialogs[dialogs.length - 1];
      expect(last.message).toMatch(/Invalid inputs for min, max, or array size/i);
    });

    test('Speed range updates speed display and does not crash auto-run adjustment', async () => {
      // Change speed and verify displayed value updates
      await app.speedRange.fill('1200');
      // Trigger input event by dispatching via JS to ensure handler runs
      await app.page.evaluate(() => {
        const el = document.getElementById('speedRange');
        el.value = '1200';
        el.dispatchEvent(new Event('input'));
      });
      // speedDisplay should show 1200
      await expect(app.speedDisplay).toHaveText('1200');
    });
  });

  test.describe('Console and runtime observation', () => {
    test('No fatal runtime errors appear in console during typical interactions', async () => {
      // Perform routine interactions
      await app.setInputArrayText('3,1,4');
      await app.clickLoadArray();
      await app.clickStartSort();
      await app.clickStepForward();
      await app.clickRunToEnd();
      await app.clickReset();

      // Inspect collected console messages for 'error' types
      const errorConsoles = consoleMessages.filter(m => m.type === 'error');
      // We expect no console.error messages to indicate uncaught runtime issues
      expect(errorConsoles.map(e => e.text)).toEqual([]);

      // Also pageErrors are asserted in afterEach hook to be empty
    });
  });
});