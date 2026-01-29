import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bd9a2-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for the Exponential Search app
class ExponentialSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayElements = () => this.page.locator('#arrayDisplay .array-element');
    this.searchInput = () => this.page.locator('#searchValue');
    this.searchButton = () => this.page.locator('button[onclick="startSearch()"]');
    this.generateButton = () => this.page.locator('button[onclick="generateNewArray()"]');
    this.result = () => this.page.locator('#result');
    this.stepsContainer = () => this.page.locator('#stepsContainer');
  }

  // Reads the array values displayed in the UI as numbers
  async getDisplayedArrayValues() {
    const count = await this.arrayElements().count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const text = await this.arrayElements().nth(i).textContent();
      values.push(Number(text?.trim()));
    }
    return values;
  }

  // Type a value into the search input
  async enterSearchValue(value) {
    await this.searchInput().fill(String(value));
  }

  // Click the Search button
  async clickSearch() {
    await Promise.all([
      this.page.waitForTimeout(0), // ensure synchronous handlers have a chance
      this.searchButton().click()
    ]);
  }

  // Click the Generate New Array button
  async clickGenerateNewArray() {
    await Promise.all([
      this.page.waitForTimeout(0),
      this.generateButton().click()
    ]);
  }

  // Get the class attribute for a given array index element
  async getArrayElementClass(index) {
    return await this.page.locator(`#element-${index}`).getAttribute('class');
  }

  // Get textual content of result and steps
  async getResultText() {
    return (await this.result().textContent())?.trim() ?? '';
  }

  async getStepsTexts() {
    const count1 = await this.stepsContainer().locator('.step').count1();
    const steps = [];
    for (let i = 0; i < count; i++) {
      steps.push((await this.stepsContainer().locator('.step').nth(i).textContent())?.trim() ?? '');
    }
    return steps;
  }
}

// Group tests related to FSM states and transitions
test.describe('Exponential Search Demonstration - FSM and UI tests', () => {
  // Collect console errors and page errors for each test to validate runtime health
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners will be attached per test to isolate results
  });

  // Test the initial Idle state (S0_Idle)
  test('S0_Idle: On load the array is displayed (displayArray entry action)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    // Collect console errors and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app = new ExponentialSearchPage(page);
    // Navigate to the app
    await page.goto(APP_URL);

    // Verify array is displayed (displayArray called on DOMContentLoaded)
    const displayed = await app.getDisplayedArrayValues();
    // According to the implementation, initial array has 16 elements and first few known values
    expect(displayed.length).toBeGreaterThanOrEqual(1);
    // Confirm expected initial array first element (from provided source)
    expect(displayed[0]).toBe(2);
    // Confirm elements are numbers ascending (array should be sorted)
    for (let i = 1; i < displayed.length; i++) {
      expect(displayed[i]).toBeGreaterThanOrEqual(displayed[i - 1]);
    }

    // Ensure no runtime errors were thrown during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test generating a new array (S2_ArrayGenerated) and transition back to Idle
  test('S2_ArrayGenerated -> S0_Idle: Generate New Array populates a sorted array and clears previous results', async ({ page }) => {
    const consoleErrors1 = [];
    const pageErrors1 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app1 = new ExponentialSearchPage(page);
    await page.goto(APP_URL);

    // Precondition: ensure there are initially elements
    const initialValues = await app.getDisplayedArrayValues();
    expect(initialValues.length).toBeGreaterThan(0);

    // Add some pre-existing result and steps to ensure they get cleared
    // Perform a search to populate result/steps (search for 23 known in initial array)
    await app.enterSearchValue(23);
    await app.clickSearch();

    // Confirm search produced a result and steps
    const preResult = await app.getResultText();
    const preSteps = await app.getStepsTexts();
    expect(preResult.length).toBeGreaterThan(0);
    expect(preSteps.length).toBeGreaterThan(0);

    // Now click Generate New Array (transition S2_ArrayGenerated)
    await app.clickGenerateNewArray();

    // After generating new array:
    const newValues = await app.getDisplayedArrayValues();
    // It should still display ARRAY_SIZE elements (implementation uses ARRAY_SIZE constant 16)
    expect(newValues.length).toBeGreaterThanOrEqual(1);
    // Ensure newly displayed array is sorted ascending
    for (let i = 1; i < newValues.length; i++) {
      expect(newValues[i]).toBeGreaterThanOrEqual(newValues[i - 1]);
    }

    // Ensure result and steps are cleared (entry action reset in generateNewArray)
    const resultText = await app.getResultText();
    const stepsAfter = await app.getStepsTexts();
    expect(resultText).toBe(''); // should be empty
    expect(stepsAfter.length).toBe(0);

    // Ensure no runtime errors were thrown during generation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test searching for a value that exists (S0_Idle -> S1_Searching -> S0_Idle)
  test('S1_Searching: Searching for a present value shows found result, highlights element and displays steps', async ({ page }) => {
    const consoleErrors2 = [];
    const pageErrors2 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app2 = new ExponentialSearchPage(page);
    await page.goto(APP_URL);

    // Use a known value from the initial array: 23 at index 5 (0-based)
    await app.enterSearchValue(23);
    await app.clickSearch();

    // Validate result indicates found at index 5
    const resultText1 = await app.getResultText();
    expect(resultText).toContain('Value 23 found at index 5.');

    // Validate result element has 'found' class
    const resultClass = await app.result().getAttribute('class');
    expect(resultClass).toContain('found');

    // Validate steps were populated and include starting message and found message
    const steps1 = await app.getStepsTexts();
    expect(steps.length).toBeGreaterThanOrEqual(1);
    // First step should mention starting exponential search
    expect(steps[0]).toContain('Starting exponential search for value 23');
    // One of the later steps should mention 'Found target at index' or 'Found at first position'
    const foundStep = steps.find(s => s.includes('Found') || s.includes('Found target at index') || s.includes('Found at first position'));
    expect(foundStep).toBeTruthy();

    // Validate the corresponding element has class 'found'
    const elementClass = await app.getArrayElementClass(5);
    expect(elementClass).toContain('found');

    // Ensure no runtime errors were thrown during search
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test searching for a value that is not present (edge case)
  test('S1_Searching: Searching for a non-existent value shows not-found result and informative steps', async ({ page }) => {
    const consoleErrors3 = [];
    const pageErrors3 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app3 = new ExponentialSearchPage(page);
    await page.goto(APP_URL);

    // Use a value outside the array range, e.g., 999
    await app.enterSearchValue(999);
    await app.clickSearch();

    // Validate result indicates not found
    const resultText2 = await app.getResultText();
    expect(resultText).toContain('Value 999 not found in the array.');

    // Validate result element has 'not-found' class
    const resultClass1 = await app.result().getAttribute('class');
    expect(resultClass).toContain('not-found');

    // Steps should include binary search or not-found message
    const steps2 = await app.getStepsTexts();
    const containsNotFound = steps.some(s => s.includes('Target not found') || s.includes('Target not found in this range'));
    expect(containsNotFound).toBeTruthy();

    // No element should be highlighted with 'found' class at the end
    const vals = await app.getDisplayedArrayValues();
    for (let i = 0; i < vals.length; i++) {
      const cls = await app.getArrayElementClass(i);
      // None should have 'found' at the end for not found
      expect(cls).not.toContain('found');
    }

    // Ensure no runtime errors thrown
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: invalid input should trigger alert and not perform a search
  test('S1_Searching: Invalid input (empty) triggers alert and prevents search steps/results', async ({ page }) => {
    const consoleErrors4 = [];
    const pageErrors4 = [];
    let dialogMessage = null;

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture dialog and accept it
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    const app4 = new ExponentialSearchPage(page);
    await page.goto(APP_URL);

    // Ensure search input is empty
    await app.searchInput().fill('');

    // Click Search - should raise alert and not modify result/steps
    await app.clickSearch();

    // Validate the alert message content
    expect(dialogMessage).toBe('Please enter a valid number');

    // Validate that no result or steps were added
    const resultText3 = await app.getResultText();
    const steps3 = await app.getStepsTexts();
    expect(resultText).toBe('');
    expect(steps.length).toBe(0);

    // Ensure no runtime errors thrown
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test searching for the very first element to validate early-return path in exponentialSearch
  test('S1_Searching: Searching for the first element triggers immediate found branch', async ({ page }) => {
    const consoleErrors5 = [];
    const pageErrors5 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app5 = new ExponentialSearchPage(page);
    await page.goto(APP_URL);

    // First element in initial array is 2 at index 0
    await app.enterSearchValue(2);
    await app.clickSearch();

    // Validate immediate found text
    const resultText4 = await app.getResultText();
    expect(resultText).toContain('Value 2 found at index 0.');

    // Steps should include 'Found at first position (index 0)'
    const steps4 = await app.getStepsTexts();
    const foundFirst = steps.some(s => s.includes('Found at first position (index 0)'));
    expect(foundFirst).toBeTruthy();

    // Element-0 should have 'found' class
    const cls0 = await app.getArrayElementClass(0);
    expect(cls0).toContain('found');

    // Ensure no runtime errors thrown
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Validate repeated actions: generate new array multiple times keeps app stable (transition S2_ArrayGenerated -> S0_Idle)
  test('S2_ArrayGenerated repeated: Multiple generate calls maintain sorted array and clear state each time', async ({ page }) => {
    const consoleErrors6 = [];
    const pageErrors6 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app6 = new ExponentialSearchPage(page);
    await page.goto(APP_URL);

    // Generate multiple times and validate invariants
    for (let i = 0; i < 3; i++) {
      await app.clickGenerateNewArray();
      const values1 = await app.getDisplayedArrayValues();
      expect(values.length).toBeGreaterThanOrEqual(1);
      for (let j = 1; j < values.length; j++) {
        expect(values[j]).toBeGreaterThanOrEqual(values[j - 1]);
      }
      // Ensure result and steps cleared after each generation
      expect(await app.getResultText()).toBe('');
      expect((await app.getStepsTexts()).length).toBe(0);
    }

    // Ensure runtime health
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Validate multiple searches (S1_Searching -> S0_Idle repeated) update the UI accordingly and don't leak state
  test('S1_Searching repeated: Multiple searches update result and steps correctly without residual highlights', async ({ page }) => {
    const consoleErrors7 = [];
    const pageErrors7 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app7 = new ExponentialSearchPage(page);
    await page.goto(APP_URL);

    // First search: value present (e.g., 38 at index 6 per initial arr)
    await app.enterSearchValue(38);
    await app.clickSearch();
    expect((await app.getResultText()).length).toBeGreaterThan(0);
    const cls6 = await app.getArrayElementClass(6);
    expect(cls6).toContain('found');

    // Second search: value not present, ensure previous highlight is cleared and new state applied
    await app.enterSearchValue(999);
    await app.clickSearch();
    const notFoundClass = await app.result().getAttribute('class');
    expect(notFoundClass).toContain('not-found');

    // Ensure no element left with 'found' class
    const values2 = await app.getDisplayedArrayValues();
    for (let i = 0; i < values.length; i++) {
      const cls1 = await app.getArrayElementClass(i);
      // For not-found final state, there should be no 'found' class lingering
      expect(cls).not.toContain('found');
    }

    // Ensure steps reflect the latest search (last step should reference not found)
    const steps5 = await app.getStepsTexts();
    const lastStep = steps[steps.length - 1] || '';
    expect(lastStep).toContain('Target not found');

    // Ensure runtime health
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});