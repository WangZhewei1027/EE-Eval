import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ced063-fa79-11f0-8075-e54a10595dde.html';

// Page object encapsulating interactions with the Bucket Sort page
class BucketSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.numbersInput = page.locator('#numbers');
    this.bucketCountInput = page.locator('#bucketCount');
    this.prepareBtn = page.locator("button[onclick='prepareSort()']");
    this.sortBtn = page.locator("button[onclick='sort()']");
    this.output = page.locator('#output');
    this.statusList = page.locator('#statusList');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Set the numbers input (comma separated)
  async setNumbers(value) {
    await this.numbersInput.fill(value);
  }

  // Set the bucket count numeric input
  async setBucketCount(value) {
    await this.bucketCountInput.fill(String(value));
  }

  // Click prepare; returns any dialog that appears (if expected, caller should await)
  async clickPrepare() {
    await this.prepareBtn.click();
  }

  // Click sort; returns any dialog that appears (if expected, caller should await)
  async clickSort() {
    await this.sortBtn.click();
  }

  // Get output text content
  async getOutputText() {
    const txt = await this.output.textContent();
    return txt ?? '';
  }

  // Get array of status list item texts
  async getStatusListItems() {
    return (await this.page.$$eval('#statusList li', els => els.map(e => e.innerText))).map(String);
  }

  // Read localStorage item by key
  async getLocalStorageItem(key) {
    return await this.page.evaluate(k => localStorage.getItem(k), key);
  }
}

test.describe('Interactive Bucket Sort - FSM tests (Application ID: 99ced063-fa79-11f0-8075-e54a10595dde)', () => {
  // Containers to collect console messages and page errors observed during each test
  let consoleMessages;
  let pageErrors;

  // Reusable page object
  let bucketPage;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      // store text and type for diagnostics assertions
      consoleMessages.push({ text: msg.text(), type: msg.type() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Create page object and navigate
    bucketPage = new BucketSortPage(page);
    await bucketPage.goto();
  });

  test.afterEach(async () => {
    // After each test, assert that no uncaught page errors occurred.
    // The FSM testing requirements asked us to observe console logs and page errors.
    // We assert that the page did not produce uncaught exceptions during normal flow.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
  });

  test('S0_Idle: Initial Idle state renders expected elements and initial values', async () => {
    // Validate presence of main interactive elements as evidence for the Idle state entry (renderPage())
    await expect(bucketPage.numbersInput).toBeVisible();
    await expect(bucketPage.bucketCountInput).toBeVisible();
    await expect(bucketPage.prepareBtn).toBeVisible();
    await expect(bucketPage.sortBtn).toBeVisible();
    await expect(bucketPage.output).toBeVisible();
    await expect(bucketPage.statusList).toBeVisible();

    // The bucketCount input should have default value 5 (per HTML)
    const bucketCountValue = await bucketPage.bucketCountInput.inputValue();
    expect(bucketCountValue).toBe('5');

    // Output should be empty initially
    const out = await bucketPage.getOutputText();
    expect(out.trim()).toBe('');

    // localStorage should not yet contain inputNumbers or bucketCount
    const inputNumbersLS = await bucketPage.getLocalStorageItem('inputNumbers');
    const bucketCountLS = await bucketPage.getLocalStorageItem('bucketCount');
    expect(inputNumbersLS).toBeNull();
    expect(bucketCountLS).toBeNull();
  });

  test('Transition S0_Idle -> S1_Prepared: Prepare for Sort sets localStorage and updates output', async ({ page }) => {
    // Prepare input values and click Prepare for Sort
    await bucketPage.setNumbers('3,1,4,2');
    await bucketPage.setBucketCount(3);

    // Click prepare and wait briefly for DOM updates
    await bucketPage.clickPrepare();

    // Verify output includes Input Numbers and Buckets as described in FSM evidence
    const outputText = await bucketPage.getOutputText();
    expect(outputText).toContain('Input Numbers: [3,1,4,2]');
    expect(outputText).toContain('Buckets: 3');

    // Status list should be cleared after prepare
    const items = await bucketPage.getStatusListItems();
    expect(items.length).toBe(0);

    // Verify localStorage values were set as in S1_Prepared evidence
    const lsNumbers = await bucketPage.getLocalStorageItem('inputNumbers');
    const lsBucketCount = await bucketPage.getLocalStorageItem('bucketCount');
    expect(lsNumbers).not.toBeNull();
    expect(JSON.parse(lsNumbers)).toEqual([3,1,4,2]);
    // bucketCount is stored in localStorage as a primitive (string or number converted to string)
    expect(String(lsBucketCount)).toBe('3');
  });

  test('Transition S1_Prepared -> S2_Sorted: Sort with Buckets sorts and updates output and status list', async () => {
    // Prepare the numbers first (transition to S1_Prepared)
    await bucketPage.setNumbers('3,1,4,2');
    await bucketPage.setBucketCount(2);
    await bucketPage.clickPrepare();

    // Now click Sort with Buckets (transition to S2_Sorted)
    await bucketPage.clickSort();

    // Output should now include Sorted Numbers
    const outputText = await bucketPage.getOutputText();
    expect(outputText).toContain('Sorted Numbers:');

    // Extract the sorted array text from output (basic parse)
    // e.g. "... | Sorted Numbers: [1,2,3,4]"
    const match = outputText.match(/Sorted Numbers:\s*\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    const sortedStr = match ? match[1].trim() : '';
    const sortedArray = sortedStr === '' ? [] : sortedStr.split(',').map(s => Number(s.trim()));
    // Expect the sorted array to be correctly sorted ascending
    expect(sortedArray).toEqual([1,2,3,4]);

    // Status list should have bucketCount entries (some may be "empty.")
    const statusItems = await bucketPage.getStatusListItems();
    // bucketCount was set to 2, so expect 2 list items
    expect(statusItems.length).toBe(2);
    // Ensure at least one bucket reports sorted content (non-empty) and format matches expected evidence
    const hasBucketSorted = statusItems.some(text => /Bucket \d+:\s*\[.*\]\s*sorted\./.test(text));
    expect(hasBucketSorted).toBe(true);
  });

  test('Edge case: Clicking Sort before Prepare shows an alert and does not crash', async ({ page }) => {
    // Ensure localStorage is empty
    await page.evaluate(() => { localStorage.removeItem('inputNumbers'); localStorage.removeItem('bucketCount'); });

    // Listen for dialog that should be shown: "Please prepare numbers before sorting!"
    const dialogPromise = page.waitForEvent('dialog');

    // Click sort without preparing
    await bucketPage.clickSort();

    // Verify the dialog appears with expected message
    const dialog = await dialogPromise;
    try {
      expect(dialog.message()).toContain('Please prepare numbers before sorting!');
    } finally {
      await dialog.dismiss();
    }

    // Ensure no uncaught page errors occurred
    // (afterEach will also assert this; we can additionally assert here)
    // pageErrors length is validated in afterEach
  });

  test('Edge case: Prepare with invalid numbers shows alert and does not set localStorage', async ({ page }) => {
    // Enter invalid numbers and click prepare
    await bucketPage.setNumbers('a,b,c');
    await bucketPage.setBucketCount(3);

    const dialogPromise = page.waitForEvent('dialog');
    await bucketPage.clickPrepare();
    const dialog = await dialogPromise;
    try {
      expect(dialog.message()).toContain('Please enter valid numbers.');
    } finally {
      await dialog.dismiss();
    }

    // localStorage should remain unset for inputNumbers after invalid prepare
    const lsNumbers = await bucketPage.getLocalStorageItem('inputNumbers');
    expect(lsNumbers).toBeNull();
  });

  test('Edge case: Identical numbers (bucketSize 0) does not crash and produces correct sorted output', async () => {
    // Prepare with identical numbers which may lead to bucketSize == 0
    await bucketPage.setNumbers('5,5,5');
    await bucketPage.setBucketCount(3);
    await bucketPage.clickPrepare();

    // Perform sort
    await bucketPage.clickSort();

    // Sorted array should be [5,5,5]
    const outputText = await bucketPage.getOutputText();
    const match = outputText.match(/Sorted Numbers:\s*\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    const sortedStr = match ? match[1].trim() : '';
    const sortedArray = sortedStr === '' ? [] : sortedStr.split(',').map(s => Number(s.trim()));
    expect(sortedArray).toEqual([5,5,5]);

    // Status list must have entries for the configured number of buckets (3)
    const statusItems = await bucketPage.getStatusListItems();
    expect(statusItems.length).toBe(3);
    // Ensure that buckets are present and at least one bucket shows sorted bucket content or empty
    const validFormat = statusItems.every(text => /^Bucket \d+:/.test(text));
    expect(validFormat).toBe(true);
  });

  test('Smoke: Observe console messages (no unexpected console errors emitted)', async () => {
    // This test simply exercises the app a bit and collects console messages for inspection.
    await bucketPage.setNumbers('7,2,9');
    await bucketPage.setBucketCount(2);
    await bucketPage.clickPrepare();
    await bucketPage.clickSort();

    // We expect some console messages might exist (e.g., from Playwright or third-party), but there should be no console.error or uncaught exceptions.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, `console.error should be empty, found: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
  });
});