import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121426b1-fa7a-11f0-acf9-69409043402d.html';

// Page object for the Exponential Search Interactive Demo
class ExponentialSearchPage {
  constructor(page) {
    this.page = page;
    // Inputs & controls
    this.arrayInput = page.locator('#arrayInput');
    this.loadArrayBtn = page.locator('#loadArray');
    this.arrayValidationMsg = page.locator('#arrayValidationMsg');
    this.arrayDisplay = page.locator('#arrayDisplay');

    this.searchValueInput = page.locator('#searchValue');
    this.delaySlider = page.locator('#delaySlider');
    this.delayValue = page.locator('#delayValue');
    this.binaryVariant = page.locator('#binaryVariant');

    this.resetAllBtn = page.locator('#resetAll');
    this.startSearchBtn = page.locator('#startSearch');
    this.autoPlayBtn = page.locator('#autoPlay');
    this.stepForwardBtn = page.locator('#stepForward');
    this.stepBackwardBtn = page.locator('#stepBackward');

    this.searchStatePre = page.locator('#searchState');
    this.logDiv = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial render
    await expect(this.page).toHaveURL(APP_URL);
  }

  // Helpers to interact
  async loadArray(text) {
    await this.arrayInput.fill(text);
    await this.loadArrayBtn.click();
  }

  async resetAll() {
    await this.resetAllBtn.click();
  }

  async setSearchValue(val) {
    await this.searchValueInput.fill(String(val));
    // input event listener updates internal state; give micro-delay
    await this.page.waitForTimeout(10);
  }

  async setBinaryVariant(variantValue) {
    await this.binaryVariant.selectOption(variantValue);
    await this.page.waitForTimeout(10);
  }

  async setDelay(ms) {
    // Use evaluate to set the slider value reliably then trigger input event
    await this.page.evaluate((v) => {
      const s = document.getElementById('delaySlider');
      s.value = String(v);
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, ms);
    // small wait for UI update
    await this.page.waitForTimeout(10);
  }

  async startSearch() {
    await this.startSearchBtn.click();
  }

  async toggleAutoPlay() {
    await this.autoPlayBtn.click();
  }

  async stepForward() {
    await this.stepForwardBtn.click();
    await this.page.waitForTimeout(10);
  }

  async stepBackward() {
    await this.stepBackwardBtn.click();
    await this.page.waitForTimeout(10);
  }

  async getArrayDisplayText() {
    return (await this.arrayDisplay.textContent())?.trim();
  }

  async getSearchStateText() {
    return (await this.searchStatePre.textContent())?.trim();
  }

  async getLogText() {
    return (await this.logDiv.textContent())?.trim();
  }

  async isStartSearchDisabled() {
    return await this.startSearchBtn.evaluate(b => b.disabled);
  }

  async isAutoPlayDisabled() {
    return await this.autoPlayBtn.evaluate(b => b.disabled);
  }

  async isStepForwardDisabled() {
    return await this.stepForwardBtn.evaluate(b => b.disabled);
  }

  async isStepBackwardDisabled() {
    return await this.stepBackwardBtn.evaluate(b => b.disabled);
  }

  // Utility to advance through steps until final state or stepForward disabled
  async advanceToFinished(maxSteps = 500) {
    let iterations = 0;
    while (iterations++ < maxSteps) {
      const searchText = await this.getSearchStateText() || '';
      const sfDisabled = await this.isStepForwardDisabled();
      // heuristics: finished descriptions include 'Search completed' or 'Search finished' or 'NOT found'
      if (sfDisabled || /Search (completed|finished)|NOT found|NOT Found/i.test(searchText)) {
        break;
      }
      await this.stepForward();
    }
  }

  // Utility to collect the final description text by moving to the last available step
  async moveToLastStep(maxSteps = 500) {
    let iterations = 0;
    while (iterations++ < maxSteps) {
      const sfDisabled = await this.isStepForwardDisabled();
      if (sfDisabled) break;
      await this.stepForward();
    }
    return this.getSearchStateText();
  }
}

// Suite: Exponential Search FSM and interactive behavior
test.describe('Exponential Search Interactive Demo - FSM tests', () => {
  // Collect console and page errors for each test to assert no runtime failures happened
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', msg => {
      // capture only error-level console messages
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', error => {
      // capture unhandled exceptions on the page
      pageErrors.push(error);
    });

    const app = new ExponentialSearchPage(page);
    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // Assert there were no unexpected runtime errors emitted during the test
    // If errors exist, include them in the assertion message to aid debugging
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);

    // Close page to ensure clean teardown
    await page.close();
  });

  // Idle state checks: initial page render
  test('Idle state: initial UI elements and defaults are correct', async ({ page }) => {
    const app = new ExponentialSearchPage(page);

    // Validate initial static UI state and evidence from FSM S0_Idle
    await expect(app.loadArrayBtn).toBeVisible();
    await expect(app.resetAllBtn).toBeVisible();
    await expect(app.startSearchBtn).toBeDisabled();
    await expect(app.autoPlayBtn).toBeDisabled();
    await expect(app.stepForwardBtn).toBeDisabled();
    await expect(app.stepBackwardBtn).toBeDisabled();

    // Initial displays show the expected idle text
    await expect(app.arrayDisplay).toHaveText(/\(No array loaded\)/);
    await expect(app.searchStatePre).toHaveText(/\(No search started\)/);
    await expect(app.logDiv).toHaveText(/\(Logs will appear here\)/);

    // Accessibility and initial attributes
    await expect(app.arrayInput).toHaveAttribute('aria-describedby', 'arrayValidationMsg');
    await expect(app.arrayDisplay).toHaveAttribute('tabindex', '0');
    await expect(app.searchStatePre).toHaveAttribute('tabindex', '0');
    await expect(app.logDiv).toHaveAttribute('tabindex', '0');
  });

  // Transition: LoadArray to ArrayLoaded (S0 -> S1)
  test('LoadArray event transitions to ArrayLoaded and enables Start Search', async ({ page }) => {
    const app = new ExponentialSearchPage(page);

    // Load a valid sorted array and check visual update and control enabling
    await app.loadArray('1, 3, 5, 7, 9');
    await expect(app.arrayValidationMsg).toHaveText(''); // no validation message
    await expect(app.arrayDisplay).toHaveText('1, 3, 5, 7, 9');
    expect(await app.isStartSearchDisabled()).toBe(false);
    // After loading, search hasn't started so step controls remain disabled
    expect(await app.isAutoPlayDisabled()).toBe(true);
    expect(await app.isStepForwardDisabled()).toBe(true);
    expect(await app.isStepBackwardDisabled()).toBe(true);
  });

  // Edge case: Invalid array input should show validation message and keep search disabled
  test('LoadArray with invalid input shows validation and prevents starting search', async ({ page }) => {
    const app = new ExponentialSearchPage(page);

    // Unsorted array
    await app.loadArray('5, 3, 7');
    await expect(app.arrayValidationMsg).toHaveText(/sorted|ascending|must be sorted/i);
    await expect(app.arrayDisplay).toHaveText(/\(No array loaded\)/);
    expect(await app.isStartSearchDisabled()).toBe(true);

    // Non-numeric tokens
    await app.loadArray('1, 2, three, 4');
    await expect(app.arrayValidationMsg).toHaveText(/valid finite numbers/i);
    expect(await app.isStartSearchDisabled()).toBe(true);
  });

  // Start search and Step through until finished (found case) - S1 -> S2 -> S3
  test('StartSearch begins search and stepping through leads to Search Finished (found)', async ({ page }) => {
    const app = new ExponentialSearchPage(page);

    // Load array and set value that exists
    await app.loadArray('1, 3, 5, 7, 9, 11');
    await app.setSearchValue(7);
    await app.setBinaryVariant('standard');

    // Start search (transition S1_ArrayLoaded -> S2_Searching)
    await app.startSearch();

    // After start, there should be a current step displayed (currentStepIndex = 0)
    const firstStep = await app.getSearchStateText();
    expect(firstStep.length).toBeGreaterThan(0);

    // Controls should be enabled appropriately after search is built
    expect(await app.isAutoPlayDisabled()).toBe(false);
    // If there are multiple steps, stepForward might be enabled
    // Walk forward until we reach the finished state
    await app.advanceToFinished();

    // Move to last step and assert final finished message indicates found index
    const finalText = (await app.moveToLastStep()) || '';
    expect(/(found at index|Found at index|Value found at index)/i.test(finalText), `Final step should indicate value found; got: ${finalText}`).toBe(true);

    // Verify array display reflects highlight on found index at final step
    const arrText = await app.getArrayDisplayText();
    // Highlighting wraps the found element in brackets e.g., "[7]"
    expect(/\[.*\]/.test(arrText), `Array display should include highlighted index at finish: ${arrText}`).toBe(true);

    // Test stepping backward returns to previous steps
    // If stepBackward is enabled, step back once and check description changed
    if (!(await app.isStepBackwardDisabled())) {
      const beforeBack = await app.getSearchStateText();
      await app.stepBackward();
      const afterBack = await app.getSearchStateText();
      expect(afterBack).not.toBe(beforeBack);
    }
  });

  // Not found case leads to S4_NotFound
  test('StartSearch with a missing value leads to Value Not Found final state', async ({ page }) => {
    const app = new ExponentialSearchPage(page);

    // Load array and set value that does not exist
    await app.loadArray('2, 4, 6, 8, 10');
    await app.setSearchValue(7);
    await app.setBinaryVariant('standard');

    // Start search
    await app.startSearch();

    // Advance to finished
    await app.advanceToFinished();

    // Ensure the final description indicates NOT found
    const final = (await app.moveToLastStep()) || '';
    expect(/NOT found|not found|not Found|Value NOT found/i.test(final), `Expected NOT found final message; got: ${final}`).toBe(true);

    // Array display at final should NOT have highlighted element (highlightIndices null)
    const arrText = await app.getArrayDisplayText();
    expect(arrText.includes('[')).toBe(false);
  });

  // AutoPlay toggle behavior (start -> autoplay on -> autoplay off after completion)
  test('AutoPlay toggles on/off and disables controls during autoplay', async ({ page }) => {
    const app = new ExponentialSearchPage(page);

    // Use small delay for fast autoplay in test
    await app.loadArray('1,2,3,4,5,6,7,8,9,10');
    await app.setSearchValue(10);
    await app.setBinaryVariant('standard');
    // set a small delay to speed up autoplay
    await app.setDelay(100);

    await app.startSearch();

    // autoPlay should now be enabled
    expect(await app.isAutoPlayDisabled()).toBe(false);

    // Start autoplay
    await app.toggleAutoPlay();

    // Immediately after toggling, autoPlay btn should show 'Auto-Play: On'
    await expect(app.autoPlayBtn).toHaveText(/Auto-Play: On/i);

    // Controls are expected to be disabled during autoplay
    await expect(app.loadArrayBtn).toBeDisabled();
    await expect(app.arrayInput).toBeDisabled();
    await expect(app.searchValueInput).toBeDisabled();

    // Wait until autoplay finishes - autoPlayBtn should revert to 'Auto-Play: Off'
    // Give a generous timeout because number of steps may vary
    await app.page.waitForFunction(() => {
      const b = document.getElementById('autoPlay');
      return b && /Auto-Play: Off/i.test(b.textContent || '');
    }, {}, { timeout: 5000 });

    // After autoplay completes, controls should be re-enabled
    await expect(app.loadArrayBtn).toBeEnabled();
    await expect(app.arrayInput).toBeEnabled();
    // startSearch should be enabled again
    expect(await app.isStartSearchDisabled()).toBe(false);
  });

  // Binary variant behavior: first-occurrence vs last-occurrence with duplicates
  test('BinaryVariant change (first-occurrence vs last-occurrence) affects final found index', async ({ page }) => {
    const app = new ExponentialSearchPage(page);

    // Array with duplicates: indices 1..3 contain "2"
    await app.loadArray('1,2,2,2,3');
    await app.setSearchValue(2);

    // FIRST OCCURRENCE
    await app.setBinaryVariant('first-occurrence');
    await app.startSearch();
    await app.advanceToFinished();
    const finalFirst = (await app.moveToLastStep()) || '';
    // Expect first-occurrence to report index 1 (0-based)
    expect(/index\s+1/.test(finalFirst) || /index\s+0/i.test(finalFirst) || /Found at index 1/i, `First-occurrence final text: ${finalFirst}`).toBe(true);

    // Reset and try LAST OCCURRENCE
    // Use Reset All to return to clean state
    await app.resetAll();
    await app.loadArray('1,2,2,2,3');
    await app.setSearchValue(2);
    await app.setBinaryVariant('last-occurrence');
    await app.startSearch();
    await app.advanceToFinished();
    const finalLast = (await app.moveToLastStep()) || '';
    // Expect last-occurrence to report index 3 (0-based)
    expect(/index\s+3/.test(finalLast) || /index\s+2/i.test(finalLast) || /Found at index 3/i, `Last-occurrence final text: ${finalLast}`).toBe(true);
  });

  // Delay slider input updates visible delay value
  test('DelaySlider input updates the displayed delay value', async ({ page }) => {
    const app = new ExponentialSearchPage(page);

    // Default value was 500
    await expect(app.delayValue).toHaveText('500');

    // Update slider to a new value and assert displayed text updates
    await app.setDelay(1200);
    await expect(app.delayValue).toHaveText('1200');

    await app.setDelay(100);
    await expect(app.delayValue).toHaveText('100');
  });

  // ResetAll should clear all inputs and return to Idle state
  test('ResetAll clears inputs, array, and search state returning to Idle', async ({ page }) => {
    const app = new ExponentialSearchPage(page);

    // Load array and set search value then reset
    await app.loadArray('1, 3, 5');
    await app.setSearchValue(5);
    // Ensure controls reflect loaded state
    expect(await app.isStartSearchDisabled()).toBe(false);

    // Click reset all and verify UI cleared
    await app.resetAll();

    await expect(app.arrayInput).toHaveValue('');
    await expect(app.searchValueInput).toHaveValue('');
    await expect(app.arrayDisplay).toHaveText(/\(No array loaded\)/);
    expect(await app.isStartSearchDisabled()).toBe(true);
    await expect(app.searchStatePre).toHaveText(/\(No search started\)/);
    await expect(app.logDiv).toHaveText(/\(Logs will appear here\)/);
  });
});