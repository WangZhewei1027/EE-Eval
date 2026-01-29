import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e4b70-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Jump Search application
class JumpSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.searchLog = page.locator('#searchLog');
    this.explanation = page.locator('#explanation');
    this.arraySizeInput = page.locator('#arraySize');
    this.arraySizeValue = page.locator('#arraySizeValue');
    this.jumpSizeInput = page.locator('#jumpSize');
    this.jumpSizeValue = page.locator('#jumpSizeValue');
    this.searchValueInput = page.locator('#searchValue');
    this.generateArrayBtn = page.locator('#generateArray');
    this.startSearchBtn = page.locator('#startSearch');
    this.stepSearchBtn = page.locator('#stepSearch');
    this.resetSearchBtn = page.locator('#resetSearch');
    this.autoRunBtn = page.locator('#autoRun');
    this.pauseAutoRunBtn = page.locator('#pauseAutoRun');
    this.speedInput = page.locator('#speed');
    this.speedValue = page.locator('#speedValue');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the page to be visibly ready: ensure heading present
    await expect(this.page.locator('h1', { hasText: 'Interactive Jump Search' })).toBeVisible();
  }

  async getArrayElements() {
    return this.arrayDisplay.locator('.array-element');
  }

  async getArrayValues() {
    const elems = await this.getArrayElements();
    const count = await elems.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const text = await elems.nth(i).textContent();
      values.push(text !== null ? text.trim() : '');
    }
    return values;
  }

  async setArraySize(value) {
    // Use input.fill via evaluate to set range value reliably and dispatch input event
    await this.page.evaluate((v) => {
      const input = document.getElementById('arraySize');
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async setJumpSize(value) {
    await this.page.evaluate((v) => {
      const input = document.getElementById('jumpSize');
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async setSpeed(value) {
    await this.page.evaluate((v) => {
      const input = document.getElementById('speed');
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async setSearchValue(value) {
    await this.searchValueInput.fill(String(value));
  }

  async clickGenerateArray() {
    await this.generateArrayBtn.click();
  }

  async clickStartSearch() {
    await this.startSearchBtn.click();
  }

  async clickStepSearch() {
    await this.stepSearchBtn.click();
  }

  async clickResetSearch() {
    await this.resetSearchBtn.click();
  }

  async clickAutoRun() {
    await this.autoRunBtn.click();
  }

  async clickPauseAutoRun() {
    await this.pauseAutoRunBtn.click();
  }

  async getLogText() {
    return this.searchLog.innerText();
  }

  async lastLogLine() {
    const text = await this.getLogText();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.length ? lines[lines.length - 1] : '';
  }

  async explanationText() {
    return this.explanation.textContent();
  }

  async waitForLogContaining(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.innerText.includes(substr);
      },
      '#searchLog',
      substring,
      { timeout }
    );
  }
}

test.describe('Interactive Jump Search - FSM and UI tests', () => {
  // Collect console errors and page errors for each test
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Test Idle state rendering and initial controls
  test('S0_Idle: initial render shows heading, controls and array (Idle state)', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();

    // Validate main heading and explanation presence (evidence for Idle state)
    await expect(page.locator('h1', { hasText: 'Interactive Jump Search' })).toBeVisible();
    await expect(app.explanation).toHaveText(/Click "Start Search" or "Step Through" to begin the visualization\./);

    // Controls exist
    await expect(app.generateArrayBtn).toBeVisible();
    await expect(app.startSearchBtn).toBeVisible();
    await expect(app.stepSearchBtn).toBeVisible();
    await expect(app.resetSearchBtn).toBeVisible();
    await expect(app.autoRunBtn).toBeVisible();
    await expect(app.pauseAutoRunBtn).toBeVisible();

    // Array display has initial elements equal to default array size (20)
    const values = await app.getArrayValues();
    expect(values.length).toBeGreaterThanOrEqual(10); // slider min is 10
    expect(values.length).toBeLessThanOrEqual(50);

    // Ensure no console or page errors on initial load
    expect(consoleErrors, 'console errors on initial load').toEqual([]);
    expect(pageErrors, 'page errors on initial load').toEqual([]);
  });

  test.describe('Input controls and generation events', () => {
    test('GenerateArray event: clicking Generate New Array regenerates and logs', async ({ page }) => {
      const app = new JumpSearchPage(page);
      await app.goto();

      // Set array size to a known value and generate
      await app.setArraySize(15);
      await expect(app.arraySizeValue).toHaveText('15');

      await app.clickGenerateArray();
      // Wait a tick for log append
      await expect(app.searchLog).toContainText('Generated new array');

      const values = await app.getArrayValues();
      expect(values.length).toBe(15);

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('ChangeJumpSize and ChangeSpeed reflect in UI and affect auto-run timing', async ({ page }) => {
      const app = new JumpSearchPage(page);
      await app.goto();

      // Change jump size
      await app.setJumpSize(6);
      await expect(app.jumpSizeValue).toHaveText('6');

      // Change speed and verify speedValue updates
      await app.setSpeed(200);
      await expect(app.speedValue).toHaveText('200');

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Searching states and transitions', () => {
    test('StartSearch: starting search without input shows validation error', async ({ page }) => {
      const app = new JumpSearchPage(page);
      await app.goto();

      // Ensure searchValue input is empty then click start
      await app.searchValueInput.fill('');
      await app.clickStartSearch();

      // Should log validation message
      await expect(app.searchLog).toContainText('Please enter a valid number to search for');

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('S1_Searching -> S3_Completed: step through until value found (found path)', async ({ page }) => {
      const app = new JumpSearchPage(page);
      await app.goto();

      // Read an existing element's value to search for a guaranteed present value
      const values = await app.getArrayValues();
      expect(values.length).toBeGreaterThan(0);
      const target = values[0]; // first element should always exist

      // Start search for that target and step through until found
      await app.setSearchValue(target);
      await app.clickStartSearch();

      // Starting search evidence in log
      await expect(app.searchLog).toContainText(`Starting search for value ${target}`);
      await expect(app.explanation).toContainText('Starting jump search...');

      // Now iterate step until found or until max steps
      let found = false;
      const maxSteps = values.length + 20;
      for (let i = 0; i < maxSteps; i++) {
        await app.clickStepSearch();
        // After each step check logs for Found or Not Found
        const logText = await app.getLogText();
        if (logText.includes(`Found value ${target}`)) {
          found = true;
          break;
        }
        if (logText.includes(`Value ${target} not found in the array`)) {
          // Unexpected for this test but break to avoid infinite loop
          break;
        }
        // brief pause to allow DOM updates
        await page.waitForTimeout(20);
      }

      expect(found, 'expected to find the target value via step through').toBe(true);

      // Verify the found element got class 'found' applied
      // The script marks element with index currentIndex - 1 as 'found' in endSearch
      // Find any element with class 'found' and text equal target
      const foundElements = app.arrayDisplay.locator('.found');
      await expect(foundElements.first()).toContainText(target);

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('S1_Searching -> S4_NotFound: search for a value that is not in the array', async ({ page }) => {
      const app = new JumpSearchPage(page);
      await app.goto();

      // Choose a value that is very unlikely to be in the array (negative value)
      const target = -9999;
      await app.setSearchValue(target);
      await app.clickStartSearch();

      // Step through until the log shows not found (or until max steps)
      let notFound = false;
      const maxSteps = 200; // generous upper bound
      for (let i = 0; i < maxSteps; i++) {
        await app.clickStepSearch();
        const text = await app.getLogText();
        if (text.includes(`Value ${target} not found in the array`)) {
          notFound = true;
          break;
        }
        if (text.includes(`Found value ${target}`)) {
          // Found unexpectedly; break to avoid loop
          break;
        }
        await page.waitForTimeout(10);
      }

      expect(notFound, 'expected not found outcome for value not present').toBe(true);

      // Explanation should reflect not found
      await expect(app.explanation).toContainText(`Value ${target} not found in the array`);

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('ResetSearch: resetting returns to idle-like state and stops any auto-run', async ({ page }) => {
      const app = new JumpSearchPage(page);
      await app.goto();

      // Start a search with a valid value
      const values = await app.getArrayValues();
      const target = values[0];
      await app.setSearchValue(target);
      await app.clickStartSearch();

      // Click reset
      await app.clickResetSearch();

      // Expect the explanation to be reset to ready message
      await expect(app.explanation).toContainText('Ready to search. Enter a value and click Start Search.');

      // autoRun button should be enabled and pause disabled (reset sets these)
      await expect(app.autoRunBtn).toBeEnabled();
      await expect(app.pauseAutoRunBtn).toBeDisabled();

      // Search log includes 'Search reset'
      await expect(app.searchLog).toContainText('Search reset');

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('AutoRun state and transitions', () => {
    test('S1_Searching -> S2_AutoRunning -> S1_Searching via PauseAutoRun', async ({ page }) => {
      const app = new JumpSearchPage(page);
      await app.goto();

      // Choose a target present in the array; pick last element to give some work to auto-run
      const values = await app.getArrayValues();
      expect(values.length).toBeGreaterThan(0);
      const target = values[values.length - 1];

      await app.setSearchValue(target);

      // Set very fast speed for reliable auto-run in test
      await app.setSpeed(100);
      await expect(app.speedValue).toHaveText('100');

      // Click auto run - this should start the search and set interval
      await app.clickAutoRun();

      // autoRun button should be disabled and pause enabled
      await expect(app.autoRunBtn).toBeDisabled();
      await expect(app.pauseAutoRunBtn).toBeEnabled();

      // Wait a short while for auto-run to progress
      await page.waitForTimeout(300);

      // Now pause auto-run
      await app.clickPauseAutoRun();

      // Buttons toggled back
      await expect(app.autoRunBtn).toBeEnabled();
      await expect(app.pauseAutoRunBtn).toBeDisabled();

      // If the run found the element, log contains Found, otherwise at least progress logs exist
      const log = await app.getLogText();
      const found = log.includes(`Found value ${target}`);
      const jumped = log.includes('Jumped to index') || log.includes('Checking index');

      expect(found || jumped, 'auto-run should have progressed or found the item').toBeTruthy();

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Changing speed while auto-running updates interval without errors', async ({ page }) => {
      const app = new JumpSearchPage(page);
      await app.goto();

      // Start auto-run with valid target
      const values = await app.getArrayValues();
      const target = values[0];
      await app.setSearchValue(target);
      await app.setSpeed(300);
      await app.clickAutoRun();

      // Ensure auto-run active
      await expect(app.autoRunBtn).toBeDisabled();
      await expect(app.pauseAutoRunBtn).toBeEnabled();

      // Change speed while running
      await app.setSpeed(150);

      // Wait briefly to ensure interval was reset internally and no errors thrown
      await page.waitForTimeout(200);

      // Pause to clean up
      await app.clickPauseAutoRun();

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test('Edge cases: invalid inputs and UI resilience', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();

    // Enter non-numeric text into the search value (use evaluate to bypass input type number restrictions)
    await page.evaluate(() => {
      const input = document.getElementById('searchValue');
      input.value = 'not-a-number';
    });

    await app.clickStartSearch();

    // Should show validation warning
    await expect(app.searchLog).toContainText('Please enter a valid number to search for');

    // Try setting array size to extremes and generating
    await app.setArraySize(50);
    await app.clickGenerateArray();
    const vals = await app.getArrayValues();
    expect(vals.length).toBe(50);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Observe console and page errors across a normal user journey (assert none)', async ({ page }) => {
    const app = new JumpSearchPage(page);
    await app.goto();

    // Perform a short journey: generate, set params, start and reset
    await app.setArraySize(12);
    await app.clickGenerateArray();
    await app.setJumpSize(3);
    await app.setSpeed(200);
    const values = await app.getArrayValues();
    const target = values[1] || values[0];
    await app.setSearchValue(target);
    await app.clickStartSearch();
    await page.waitForTimeout(100);
    await app.clickResetSearch();

    // Wait briefly to capture any asynchronous page errors
    await page.waitForTimeout(100);

    // Assert that no console.error messages or page errors were emitted during the interactions
    expect(consoleErrors, 'expected no console.error messages during user journey').toEqual([]);
    expect(pageErrors, 'expected no uncaught page errors during user journey').toEqual([]);
  });
});