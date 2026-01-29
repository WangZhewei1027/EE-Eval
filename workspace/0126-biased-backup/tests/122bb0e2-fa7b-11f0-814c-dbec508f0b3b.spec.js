import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bb0e2-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Linear Search interactive app - FSM validation (Application ID: 122bb0e2-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Shared variables to capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors to observe runtime behavior
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', err => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic assertions about runtime errors: record them in test output if present
    // We assert that no unexpected runtime errors (pageerror) or console error messages occurred during the test.
    // The page is allowed to run naturally; we do not modify the page or patch anything.
    expect(pageErrors, 'No page errors should be emitted during the test').toEqual([]);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, 'No console.error messages should be logged by the page').toEqual([]);
  });

  test.describe('S0_Idle - Initial state validations', () => {
    test('Initial page renders input and search button (Idle state evidence)', async ({ page }) => {
      // Verify presence of input#search-input and button#search-button as FSM evidence for S0_Idle
      const inputVisible = await page.isVisible('#search-input');
      const buttonVisible = await page.isVisible('#search-button');

      expect(inputVisible).toBeTruthy();
      expect(buttonVisible).toBeTruthy();

      // Verify placeholder text on input (evidence)
      const placeholder = await page.getAttribute('#search-input', 'placeholder');
      expect(placeholder).toBe('Enter a number');

      // search-results should be empty on initial load (no results rendered)
      const initialResultButtons = await page.$$eval('#search-results button', nodes => nodes.length);
      expect(initialResultButtons).toBe(0);
    });

    test('Idle state has correct HTML structure and no runtime errors on load', async ({ page }) => {
      // Validate existence of search-results container
      const containerExists = await page.$('#search-results') !== null;
      expect(containerExists).toBeTruthy();

      // Confirm that no page errors fired during initial load (collected in afterEach, but include here for explicitness)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_Searching - Search behavior and transitions', () => {
    // Helper to get button counts and attributes
    const getResultsSummary = async (page) => {
      return page.$$eval('#search-results button', buttons => {
        return buttons.map(btn => ({
          text: btn.textContent,
          valueAttr: btn.getAttribute('value'),
        }));
      });
    };

    test('Clicking Search with a valid integer (e.g., 42) transitions to Searching and renders 100 buttons with exact match having value attribute', async ({ page }) => {
      // Enter value 42 and click Search to trigger transition S0_Idle -> S1_Searching
      await page.fill('#search-input', '42');
      await page.click('#search-button');

      // After search, expect exactly 100 buttons to be rendered as evidence of the search loop
      const buttonCount = await page.$$eval('#search-results button', nodes => nodes.length);
      expect(buttonCount).toBe(100);

      // Extract results summary and locate the button with value attribute equal to "42"
      const summary = await getResultsSummary(page);
      const matches = summary.filter(s => s.valueAttr === '42');

      // Exactly one button should carry the value attribute for the matched number
      expect(matches.length).toBe(1);
      expect(matches[0].text.trim()).toBe('42');

      // Verify that other buttons exist and are labeled from 1..100 in order
      // Confirm first few and last few texts to ensure correct rendering
      expect(summary[0].text.trim()).toBe('1');
      expect(summary[99].text.trim()).toBe('100');
    });

    test('Empty input or non-matching input yields 100 buttons with no value attributes (no match)', async ({ page }) => {
      // Case 1: empty input
      await page.fill('#search-input', '');
      await page.click('#search-button');

      let summary = await getResultsSummary(page);
      expect(summary.length).toBe(100);
      // No button should have a value attribute when input is empty (parseInt(empty) => NaN)
      const anyWithValue = summary.some(s => s.valueAttr !== null);
      expect(anyWithValue).toBe(false);

      // Case 2: input outside range (e.g., 200)
      await page.fill('#search-input', '200');
      await page.click('#search-button');

      summary = await getResultsSummary(page);
      expect(summary.length).toBe(100);
      const anyWithValue2 = summary.some(s => s.valueAttr !== null);
      expect(anyWithValue2).toBe(false);
    });

    test('Input as floating point (e.g., 3.14) uses parseInt behavior (matches integer part)', async ({ page }) => {
      // parseInt("3.14") => 3, so the button with 3 should have the value attribute
      await page.fill('#search-input', '3.14');
      await page.click('#search-button');

      const summary = await getResultsSummary(page);
      const matches = summary.filter(s => s.valueAttr === '3');
      expect(matches.length).toBe(1);
      expect(matches[0].text.trim()).toBe('3');
    });

    test('Edge cases: negative numbers and zero should produce no match among 1..100', async ({ page }) => {
      // Zero
      await page.fill('#search-input', '0');
      await page.click('#search-button');
      let summary = await getResultsSummary(page);
      let anyMatch = summary.some(s => s.valueAttr !== null);
      expect(anyMatch).toBe(false);

      // Negative
      await page.fill('#search-input', '-5');
      await page.click('#search-button');
      summary = await getResultsSummary(page);
      anyMatch = summary.some(s => s.valueAttr !== null);
      expect(anyMatch).toBe(false);
    });

    test('Repeated searches clear previous results and re-render 100 buttons (searchResults.innerHTML reset behavior)', async ({ page }) => {
      // First search with 10
      await page.fill('#search-input', '10');
      await page.click('#search-button');

      let summary = await getResultsSummary(page);
      expect(summary.length).toBe(100);
      let matches = summary.filter(s => s.valueAttr === '10');
      expect(matches.length).toBe(1);

      // Perform a second search with 20 and ensure there is not accumulation beyond 100
      await page.fill('#search-input', '20');
      await page.click('#search-button');

      summary = await getResultsSummary(page);
      // Must still be exactly 100 (indicates innerHTML was cleared then re-populated)
      expect(summary.length).toBe(100);
      matches = summary.filter(s => s.valueAttr === '20');
      expect(matches.length).toBe(1);

      // Ensure the previous value "10" no longer has a value attribute applied
      const oldMatches = summary.filter(s => s.valueAttr === '10');
      expect(oldMatches.length).toBe(0);
    });
  });

  test.describe('FSM evidence and event handler verification', () => {
    test('Click event is wired: clicking #search-button triggers population of #search-results (event handler evidence)', async ({ page }) => {
      // Ensure event listener is present by performing a search and observing DOM changes
      await page.fill('#search-input', '7');
      // Before click, results empty
      let beforeCount = await page.$$eval('#search-results button', nodes => nodes.length);
      expect(beforeCount).toBe(0);

      await page.click('#search-button');

      // After click, results should be populated (evidence of event handler execution)
      const afterCount = await page.$$eval('#search-results button', nodes => nodes.length);
      expect(afterCount).toBe(100);
    });

    test('Verify that the button elements are interactive and have expected attributes/text (component checks)', async ({ page }) => {
      await page.fill('#search-input', '1');
      await page.click('#search-button');

      // The first button should represent "1" and have value attribute because input was 1
      const firstButtonText = await page.$eval('#search-results button:nth-child(1)', btn => btn.textContent.trim());
      const firstButtonValue = await page.$eval('#search-results button:nth-child(1)', btn => btn.getAttribute('value'));
      expect(firstButtonText).toBe('1');
      expect(firstButtonValue).toBe('1');

      // A button in the middle, e.g., 50, should exist and have text '50'
      const midButtonText = await page.$eval('#search-results button:nth-child(50)', btn => btn.textContent.trim());
      expect(midButtonText).toBe('50');
    });
  });
});