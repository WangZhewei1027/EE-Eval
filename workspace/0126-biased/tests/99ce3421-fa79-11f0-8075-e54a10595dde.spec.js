import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce3421-fa79-11f0-8075-e54a10595dde.html';

// Page object for the Interactive Set Demonstration
class SetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.setInput = page.locator('#setInput');
    this.addButton = page.locator("button[onclick='addValue()']");
    this.clearButton = page.locator("button[onclick='clearSet()']");
    this.unionButton = page.locator("button[onclick='performUnion()']");
    this.intersectionButton = page.locator("button[onclick='performIntersection()']");
    this.differenceButton = page.locator("button[onclick='performDifference()']");
    this.showValuesButton = page.locator("button[onclick='showValues()']");
    this.checkButton = page.locator("button[onclick='checkValue()']");
    this.checkInput = page.locator('#checkInput');
    this.removeInput = page.locator('#removeInput');
    this.removeButton = page.locator("button[onclick='removeValue()']");
    this.outputSet = page.locator('#outputSet');
    this.outputResult = page.locator('#outputResult');
  }

  // Add a value using the UI
  async addValue(value) {
    await this.setInput.fill(value);
    await this.addButton.click();
  }

  // Clear the set
  async clearSet() {
    await this.clearButton.click();
  }

  // Perform a union with a provided comma-separated string of values
  async performUnion(newSetString) {
    // Playwright handles prompt dialogs via page.once('dialog')
    this.page.once('dialog', async (dialog) => {
      // dialog.type() would be 'prompt' for prompt() calls
      await dialog.accept(newSetString);
    });
    await this.unionButton.click();
  }

  // Perform an intersection with a provided comma-separated string of values
  async performIntersection(newSetString) {
    this.page.once('dialog', async (dialog) => {
      await dialog.accept(newSetString);
    });
    await this.intersectionButton.click();
  }

  // Perform difference with a provided comma-separated string of values
  async performDifference(newSetString) {
    this.page.once('dialog', async (dialog) => {
      await dialog.accept(newSetString);
    });
    await this.differenceButton.click();
  }

  // Show values (writes to outputResult)
  async showValues() {
    await this.showValuesButton.click();
  }

  // Check existence of value
  async checkValue(value) {
    await this.checkInput.fill(value);
    await this.checkButton.click();
  }

  // Remove a value
  async removeValue(value) {
    await this.removeInput.fill(value);
    await this.removeButton.click();
  }

  // Helper to get outputSet as array of strings (empty if "Set is empty")
  async getOutputSetArray() {
    const text = (await this.outputSet.innerText()).trim();
    if (!text || text === 'Set is empty') return [];
    return text.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Helper to get outputResult as array (if it contains comma-separated values)
  async getOutputResultArray() {
    const text = (await this.outputResult.innerText()).trim();
    if (!text || text === 'Result set is empty' || text === 'Set is empty') return [];
    return text.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Read raw outputResult text
  async getOutputResultText() {
    return (await this.outputResult.innerText()).trim();
  }
}

test.describe('Interactive Set Demonstration (App ID: 99ce3421-fa79-11f0-8075-e54a10595dde)', () => {
  // Capture console errors and page errors for each test and assert none occurred.
  test.beforeEach(async ({ page }) => {
    // Nothing here; per-test handlers are set inside each test to collect logs
  });

  // Test initial Idle state and entry action updateOutput()
  test('Idle state: page loads and initial output is correct (onEnter updateOutput)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);

    const setPage = new SetPage(page);

    // On initial load, updateOutput() should have run: outputSet should display 'Set is empty' and outputResult should be empty
    await expect(setPage.outputSet).toHaveText('Set is empty');
    // outputResult is cleared by updateOutput -> expect empty string
    await expect(setPage.outputResult).toHaveText('');

    // No console errors or page errors should have occurred
    expect(consoleErrors, 'No console error messages should be emitted during load').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors should occur during load').toHaveLength(0);
  });

  test('AddValue: adding values updates current set and updateOutput is called', async ({ page }) => {
    // Validate transition triggered by AddValue -> S0_Idle (self-loop), updateOutput observable
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    const setPage = new SetPage(page);

    // Add two values and assert they appear in outputSet
    await setPage.addValue('apple');
    await setPage.addValue('banana');

    const setArray = await setPage.getOutputSetArray();
    // Order is insertion order for Set; expect both entries are present
    expect(setArray.sort(), 'Both added values should be present in the set').toEqual(['apple', 'banana'].sort());

    // showValues should write them to outputResult
    await setPage.showValues();
    const resultArray = await setPage.getOutputResultArray();
    expect(resultArray.sort(), 'Show Values should display both values').toEqual(['apple', 'banana'].sort());

    // No console or page errors
    expect(consoleErrors, 'No console errors during AddValue interactions').toHaveLength(0);
    expect(pageErrors, 'No page errors during AddValue interactions').toHaveLength(0);
  });

  test('ClearSet: clears the set and updates UI appropriately', async ({ page }) => {
    // Validate ClearSet transition, currentSet.clear() evidence via UI
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    const setPage = new SetPage(page);

    // Add values then clear
    await setPage.addValue('one');
    await setPage.addValue('two');
    // ensure they are present
    expect((await setPage.getOutputSetArray()).length).toBeGreaterThanOrEqual(2);

    // Clear
    await setPage.clearSet();

    // After clearing, outputSet should indicate empty and outputResult should be empty
    await expect(setPage.outputSet).toHaveText('Set is empty');
    await expect(setPage.outputResult).toHaveText('');

    // No errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('PerformUnion / PerformIntersection / PerformDifference: set operations with prompts', async ({ page }) => {
    // Validate PerformUnion, PerformIntersection, PerformDifference transitions and displayResult calls
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    const setPage = new SetPage(page);

    // Prepare initial set: a, b
    await setPage.addValue('a');
    await setPage.addValue('b');

    // 1) Union with "b,c" -> expect a,b,c (order not strictly guaranteed)
    await setPage.performUnion('b,c');
    // Wait for UI update
    await page.waitForTimeout(50);
    const unionResult = await setPage.getOutputResultArray();
    expect(new Set(unionResult), 'Union result should include a, b, c').toEqual(new Set(['a', 'b', 'c']));

    // 2) Intersection with "b,c" -> expect intersection is 'b'
    // Note: currentSet still contains a,b (performUnion displayed result but did not mutate currentSet)
    await setPage.performIntersection('b,c');
    await page.waitForTimeout(50);
    const intersectionResult = await setPage.getOutputResultArray();
    expect(new Set(intersectionResult), 'Intersection result should be b').toEqual(new Set(['b']));

    // 3) Difference with "b" -> expect difference is 'a'
    await setPage.performDifference('b');
    await page.waitForTimeout(50);
    const differenceResult = await setPage.getOutputResultArray();
    expect(new Set(differenceResult), 'Difference result should be a').toEqual(new Set(['a']));

    // No errors expected
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('ShowValues: displays "Set is empty" when empty and list when non-empty', async ({ page }) => {
    // Validate showValues transition and output text for empty and non-empty sets
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    const setPage = new SetPage(page);

    // Ensure empty state
    await setPage.clearSet();
    await setPage.showValues();
    // When empty, outputResult should say 'Set is empty'
    await expect(setPage.outputResult).toHaveText('Set is empty');

    // Add values and show again
    await setPage.addValue('x');
    await setPage.addValue('y');
    await setPage.showValues();
    const arr = await setPage.getOutputResultArray();
    expect(new Set(arr)).toEqual(new Set(['x', 'y']));

    // No errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('CheckValue: correctly reports existence and non-existence of values', async ({ page }) => {
    // Validate checkValue transition and output messaging
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    const setPage = new SetPage(page);

    // Add a value to check
    await setPage.addValue('present');

    // Check existing value
    await setPage.checkValue('present');
    const msg1 = await setPage.getOutputResultText();
    expect(msg1).toContain('The value "present" exists in the set.');

    // Check non-existing value
    await setPage.checkValue('absent');
    const msg2 = await setPage.getOutputResultText();
    expect(msg2).toContain('The value "absent" does not exist in the set.');

    // No errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('RemoveValue: removes existing value and reports when value not found', async ({ page }) => {
    // Validate removeValue transition and both success and failure branches
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    const setPage = new SetPage(page);

    // Add value and remove it
    await setPage.addValue('toRemove');
    // Ensure present
    expect((await setPage.getOutputSetArray()).includes('toRemove')).toBeTruthy();

    // Remove it
    await setPage.removeValue('toRemove');
    // After removal, outputSet should not include it
    const afterRemove = await setPage.getOutputSetArray();
    expect(afterRemove.includes('toRemove')).toBeFalsy();

    // Try removing non-existing value - should display a not-found message
    await setPage.removeValue('noSuchValue');
    const msg = await setPage.getOutputResultText();
    expect(msg).toContain('Value "noSuchValue" not found in the set.');

    // No errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Edge cases: adding empty value does not modify set; canceling prompt does nothing', async ({ page }) => {
    // Tests edge cases per requirements
    const consoleErrors = [];
    const pageErrors = [];
    const otherConsoleMessages = [];

    page.on('console', msg => {
      // capture any console messages for debugging, but only treat 'error' as failure
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      otherConsoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    const setPage = new SetPage(page);

    // Ensure clean slate
    await setPage.clearSet();

    // Attempt to add empty string - should not change the set
    await setPage.addValue('');
    expect(await setPage.getOutputSetArray()).toEqual([]);

    // For set operations, dismiss prompt (simulate user cancelling) -> nothing should be displayed/changed
    // Union dismissed:
    page.once('dialog', async dialog => {
      await dialog.dismiss();
    });
    await setPage.unionButton.click();
    // give a small pause for any handler
    await page.waitForTimeout(50);
    // outputResult should remain empty because prompt was cancelled and displayResult not called
    const unionText = await setPage.getOutputResultText();
    // Union prompt cancel likely results in unchanged outputResult (empty)
    expect(unionText === '' || unionText === 'Result set is empty' || unionText === 'Set is empty').toBeTruthy();

    // Intersection dismissed:
    page.once('dialog', async dialog => { await dialog.dismiss(); });
    await setPage.intersectionButton.click();
    await page.waitForTimeout(50);
    const intersectionText = await setPage.getOutputResultText();
    expect(intersectionText === '' || intersectionText === 'Result set is empty' || intersectionText === 'Set is empty').toBeTruthy();

    // Difference dismissed:
    page.once('dialog', async dialog => { await dialog.dismiss(); });
    await setPage.differenceButton.click();
    await page.waitForTimeout(50);
    const differenceText = await setPage.getOutputResultText();
    expect(differenceText === '' || differenceText === 'Result set is empty' || differenceText === 'Set is empty').toBeTruthy();

    // No console errors or page errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Final sanity test: listen for any unexpected runtime exceptions during a sequence of actions
  test('No unexpected runtime errors during typical usage sequence', async ({ page }) => {
    // This test explicitly captures runtime errors and asserts none occurred while exercising the app
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL);
    const setPage = new SetPage(page);

    // Sequence of typical actions
    await setPage.addValue('alpha');
    await setPage.addValue('beta');
    await setPage.showValues();

    // Accept a prompt for union
    await setPage.performUnion('gamma,delta');

    // Check and remove
    await setPage.checkValue('alpha');
    await setPage.removeValue('alpha');

    // Clear set
    await setPage.clearSet();
    await setPage.showValues();

    // After sequence, assert there were no console error messages or page errors
    expect(consoleErrors, `Expected no console.error logs during typical usage, but found: ${consoleErrors.join('; ')}`).toHaveLength(0);
    expect(pageErrors, `Expected no uncaught page errors during typical usage, but found: ${pageErrors.join('; ')}`).toHaveLength(0);
  });
});