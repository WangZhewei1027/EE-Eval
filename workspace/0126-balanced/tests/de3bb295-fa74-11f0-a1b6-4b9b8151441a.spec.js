import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bb295-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Binary Search Demo
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      arrayInput: '#arrayInput',
      targetInput: '#targetInput',
      searchButton: "button[onclick='runBinarySearch()']",
      visualization: '#visualization',
      result: '#result'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getArrayValue() {
    return this.page.$eval(this.selectors.arrayInput, el => el.value);
  }

  async setArrayValue(value) {
    await this.page.fill(this.selectors.arrayInput, value);
  }

  async getTargetValue() {
    return this.page.$eval(this.selectors.targetInput, el => el.value);
  }

  async setTargetValue(value) {
    // targetInput is type=number - fill accepts strings
    await this.page.fill(this.selectors.targetInput, String(value));
  }

  async clickSearch() {
    await this.page.click(this.selectors.searchButton);
  }

  async getResultText() {
    return this.page.$eval(this.selectors.result, el => el.textContent.trim());
  }

  async getVisualizationHTML() {
    return this.page.$eval(this.selectors.visualization, el => el.innerHTML);
  }

  async countVisualizationSteps() {
    return this.page.$$eval(`${this.selectors.visualization} > div`, nodes => nodes.length);
  }

  async hasFoundSpan() {
    return this.page.$(`${this.selectors.visualization} .found`) !== null;
  }

  async buttonHasOnclickAttr() {
    return this.page.$eval(this.selectors.searchButton, el => el.getAttribute('onclick'));
  }
}

test.describe('Binary Search Demonstration - FSM and UI tests', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });
  });

  test.afterEach(async () => {
    // Nothing special to teardown beyond Playwright fixtures,
    // but tests will assert consoleMessages and pageErrors where appropriate.
  });

  test('Idle state: on load runBinarySearch() should produce initial visualization and result (S0_Idle entry action)', async ({ page }) => {
    // This test validates the S0_Idle state's entry action: window.onload = runBinarySearch;
    // On load the app should run runBinarySearch and display an initial result using default inputs.

    const app = new BinarySearchPage(page);
    await app.goto();

    // Ensure the search button exists and has the expected onclick evidence
    const onclickAttr = await app.buttonHasOnclickAttr();
    expect(onclickAttr).toBe('runBinarySearch()');

    // The default inputs should be set as in the FSM/components
    const arrayVal = await app.getArrayValue();
    expect(arrayVal).toContain('1, 3, 5'); // basic sanity
    const targetVal = await app.getTargetValue();
    expect(Number(targetVal)).toBe(13);

    // After window.onload, runBinarySearch should have executed and populated result
    const resultText = await app.getResultText();
    // Expect the default target (13) to be found at index 6 as per the default array
    expect(resultText).toContain('Found 13 at index 6');

    // Visualization should contain at least one step and include the final "found" highlight
    const vizHTML = await app.getVisualizationHTML();
    expect(vizHTML.length).toBeGreaterThan(0);
    const foundElement = await page.$('#visualization .found');
    expect(foundElement).not.toBeNull();

    // No uncaught page errors should have occurred during load
    expect(pageErrors.length).toBe(0);

    // No console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition Idle -> Searching -> ResultFound: clicking Search searches and finds existing target (S1_Searching -> S2_ResultFound)', async ({ page }) => {
    // This test validates clicking the Search button triggers searching and yields ResultFound
    const app = new BinarySearchPage(page);
    await app.goto();

    // Change target to 7 (exists in array at index 3)
    await app.setTargetValue(7);

    // Capture visualization before click to assert that clicking updates/refreshes visualization
    const vizBefore = await app.getVisualizationHTML();

    // Click Search to trigger runBinarySearch (SearchButtonClick event)
    await app.clickSearch();

    // After clicking, result should reflect the new target's found index
    const resultText = await app.getResultText();
    expect(resultText).toContain('Found 7 at index 3');

    // Visualization should be updated (should differ from before) and include a found span
    const vizAfter = await app.getVisualizationHTML();
    expect(vizAfter).not.toBe(vizBefore);
    const foundElem = await page.$('#visualization .found');
    expect(foundElem).not.toBeNull();

    // Count of steps should be > 0
    const steps = await app.countVisualizationSteps();
    expect(steps).toBeGreaterThan(0);

    // Validate there were no runtime errors or console errors during the search
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition Searching -> ResultNotFound: searching for a non-existent value displays not found (S1_Searching -> S3_ResultNotFound)', async ({ page }) => {
    // This test validates searching an absent target leads to the ResultNotFound final state
    const app = new BinarySearchPage(page);
    await app.goto();

    // Choose a target not present in the default array
    await app.setTargetValue(14);

    // Click Search
    await app.clickSearch();

    // Result should indicate not found
    const resultText = await app.getResultText();
    expect(resultText).toContain('14 not found in the array');

    // Visualization should include a message indicating not found (there will be a step.message)
    const vizHTML = await app.getVisualizationHTML();
    expect(vizHTML.toLowerCase()).toContain('not found');

    // Confirm no page errors or console errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition Searching -> InvalidInput: empty array input triggers invalid input alert (S1_Searching -> S4_InvalidInput)', async ({ page }) => {
    // This test validates that entering an empty array triggers the "Please enter a valid array of numbers" alert
    const app = new BinarySearchPage(page);
    await app.goto();

    // Set up one-time dialog handler to capture and accept the alert
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Set array input to empty to provoke invalid input
    await app.setArrayValue('');

    // Click Search - this should trigger an alert and early return
    await app.clickSearch();

    // Ensure the alert was shown with expected message
    expect(dialogMessage).toBe('Please enter a valid array of numbers');

    // Because the search returns early, result should remain empty or unchanged from before.
    // We check that result does not contain a "Found" message
    const resultText = await app.getResultText();
    // It might be empty string or previous content; assert it does not claim a successful find for empty input
    expect(resultText.toLowerCase()).not.toContain('found');

    // No page errors or console errors from this flow
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition Searching -> InvalidInput: unsorted array input triggers unsorted array alert (S1_Searching -> S4_InvalidInput)', async ({ page }) => {
    // This test validates that entering an unsorted array triggers the "Array must be sorted..." alert
    const app = new BinarySearchPage(page);
    await app.goto();

    // Prepare to capture the alert dialog
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Provide an unsorted array
    await app.setArrayValue('5, 3, 4, 1');

    // Click Search which should detect unsorted array and alert
    await app.clickSearch();

    // Assert the alert message matches expectation
    expect(dialogMessage).toBe('Array must be sorted in ascending order for binary search');

    // Assert result does not show a successful find
    const resultText = await app.getResultText();
    expect(resultText.toLowerCase()).not.toContain('found');

    // No page errors or console errors produced by this flow
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: non-numeric entries are filtered out and handled (should prompt invalid input if array becomes empty)', async ({ page }) => {
    // This test checks the parsing/filtering of non-numeric entries in the input array.
    // If all entries are non-numeric the array becomes empty and should produce the empty-array alert.

    const app = new BinarySearchPage(page);
    await app.goto();

    // Capture dialog
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Enter array with only non-numeric values
    await app.setArrayValue('a, b, c');

    // Click Search, expecting an alert about valid array
    await app.clickSearch();

    expect(dialogMessage).toBe('Please enter a valid array of numbers');

    // Ensure no unhandled JS errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Visual confirmation of binary search steps: ensure mid/low/high classes appear during visualization', async ({ page }) => {
    // This test inspects visualization step HTML to ensure the algorithm marks low/high/mid indices,
    // validating the visualization logic executed during searching.

    const app = new BinarySearchPage(page);
    await app.goto();

    // Set a target that will require multiple steps so we can see mid/low/high markers
    await app.setTargetValue(19); // last element -> many steps to narrow
    await app.clickSearch();

    const vizHTML = await app.getVisualizationHTML();

    // Expect at least one of the class markers to be present
    const hasLow = vizHTML.includes('class="low"');
    const hasHigh = vizHTML.includes('class="high"');
    const hasMid = vizHTML.includes('class="mid"');

    expect(hasLow || hasHigh || hasMid).toBeTruthy();

    // Also confirm final found element for target 19 exists in visualization
    const foundElem = await page.$('#visualization .found');
    expect(foundElem).not.toBeNull();

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});