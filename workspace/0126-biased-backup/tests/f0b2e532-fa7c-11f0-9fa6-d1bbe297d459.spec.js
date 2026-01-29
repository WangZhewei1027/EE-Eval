import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b2e532-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Divide and Conquer - Merge Sort Visualization (f0b2e532-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Containers to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages and page errors so tests can assert on them.
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // Defensive: if msg.type() throws, still record raw text
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test and wait for DOM content to be loaded.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test assert that there were no uncaught page errors or console error messages.
    // This validates that the page executed without runtime exceptions like ReferenceError/SyntaxError/TypeError.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // Assert there were no page error events
    expect(pageErrors.length, `Expected no page errors, but got: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    // Assert there were no console.error messages
    expect(consoleErrors.length, `Expected no console.error messages, but got: ${consoleErrors.map(m => m.text).join(' | ')}`).toBe(0);
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('should render the main page and show Visualize Merge Sort button (evidence of S0_Idle)', async ({ page }) => {
      // This test validates the Idle state's evidence: the visualize button is present and visible.
      // It also checks that the main header is present as part of the page render (entry action renderPage()).
      const header = await page.locator('h1', { hasText: 'Divide and Conquer' });
      await expect(header).toBeVisible();

      const visualizeBtn = page.locator('#visualizeBtn');
      await expect(visualizeBtn).toBeVisible();
      await expect(visualizeBtn).toHaveText('Visualize Merge Sort');

      // Verify the visualization output container exists but is initially empty
      const output = page.locator('#visualizationOutput');
      await expect(output).toBeVisible();
      // It should not contain the merge steps before clicking (idle state)
      await expect(output).toHaveText('', { timeout: 500 }).catch(() => {
        // If some whitespace or formatting exists, ensure it does NOT contain key visualization text
        return expect(output).not.toContainText('Merge Sort Steps for Array');
      });
    });

    test('button attributes and styles are as expected in Idle state', async ({ page }) => {
      // Validate DOM attributes present (component extraction evidence)
      const visualizeBtn = page.locator('#visualizeBtn');
      await expect(visualizeBtn).toHaveAttribute('id', 'visualizeBtn');

      // Check accessible role via tag (button element)
      await expect(visualizeBtn).toHaveJSProperty('tagName', 'BUTTON');

      // Check computed background-color is present (basic visual feedback); not asserting exact color to avoid brittle tests
      const bg = await visualizeBtn.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor || '';
      });
      expect(typeof bg).toBe('string');
      expect(bg.length).toBeGreaterThan(0);
    });
  });

  test.describe('Event VisualizeMergeSort and Transition S0 -> S1', () => {
    test('clicking Visualize Merge Sort transitions to Visualizing state and displays expected output', async ({ page }) => {
      // This test validates the transition: clicking #visualizeBtn should populate #visualizationOutput
      const visualizeBtn = page.locator('#visualizeBtn');
      const output = page.locator('#visualizationOutput');

      // Precondition: ensure output is empty / does not contain visualization text
      await expect(output).not.toContainText('Merge Sort Steps for Array');

      // Trigger the event (VisualizeMergeSort)
      await visualizeBtn.click();

      // After click, the Visualizing state's evidence is expected: output.innerHTML contains the visualization
      await expect(output).toContainText('Merge Sort Steps for Array');

      // Validate important parts of the visualization content are present
      await expect(output).toContainText('Initial Array: [38, 27, 43, 3, 9, 82, 10]');
      await expect(output).toContainText('final sorted array: [3, 9, 10, 27, 38, 43, 82]');

      // Ensure the output contains an ordered list with multiple list items describing steps
      const olCount = await output.locator('ol').count();
      expect(olCount).toBeGreaterThanOrEqual(1);

      const liCount = await output.locator('ol > li').count();
      expect(liCount).toBeGreaterThanOrEqual(5); // At least several steps should be present

      // Confirm that the transition replaced the innerHTML (not appended repeatedly on a single click)
      // Snapshot the HTML after first click
      const firstHTML = await output.innerHTML();

      // Wait briefly then click again to simulate user re-clicking the button
      await page.waitForTimeout(50);
      await visualizeBtn.click();
      const secondHTML = await output.innerHTML();

      // The implementation replaces innerHTML on click; assert it's equal on repeated clicks (idempotent)
      expect(secondHTML).toBe(firstHTML);
    });

    test('repeated rapid clicks do not create duplicated lists (idempotency edge case)', async ({ page }) => {
      // This test simulates multiple rapid clicks and ensures the visualization does not accumulate duplicate outputs.
      const visualizeBtn = page.locator('#visualizeBtn');
      const output = page.locator('#visualizationOutput');

      // Rapidly click multiple times
      await visualizeBtn.click();
      await visualizeBtn.click();
      await visualizeBtn.click();

      // There should be exactly one ordered list in the output (the script sets innerHTML, replacing previous content)
      const olCount = await output.locator('ol').count();
      expect(olCount).toBe(1);

      // And final sorted array should appear once
      const finalItems = await output.locator('li', { hasText: 'final sorted array' }).count();
      expect(finalItems).toBeGreaterThanOrEqual(1);
      // Not duplicated multiple times inside the same list item
      expect(finalItems).toBe(1);
    });
  });

  test.describe('State entry/exit action validation and robustness', () => {
    test('S0 entry (renderPage) and S1 entry (displayVisualization) implied behaviors', async ({ page }) => {
      // The FSM mentions entry actions: renderPage() for S0_Idle and displayVisualization() for S1_Visualizing.
      // While these functions are not explicitly exported, we can infer their effects from DOM changes:
      // - renderPage(): page content like header and button present (checked earlier)
      // - displayVisualization(): clicking the button populates visualization output (checked earlier)
      //
      // This test combines both checks and also ensures no runtime exceptions happened during these operations.
      const header = page.locator('h1');
      await expect(header).toContainText('Divide and Conquer');

      const visualizeBtn = page.locator('#visualizeBtn');
      await visualizeBtn.click();

      const output = page.locator('#visualizationOutput');
      await expect(output).toContainText('Merge Sort Steps for Array');

      // Ensure that the visualization content contains both "Divide" and "Conquer" text fragments indicating step explanations
      await expect(output).toContainText('Divide:');
      await expect(output).toContainText('Conquer:');

      // Also assert there are no runtime errors captured (pageErrors and console errors checked in afterEach)
    });

    test('ensures visualization content structure matches expected HTML fragments', async ({ page }) => {
      // Validate that the output includes a heading <h3> then an <ol> with <li> elements
      const visualizeBtn = page.locator('#visualizeBtn');
      const output = page.locator('#visualizationOutput');

      await visualizeBtn.click();

      // Check for presence of heading
      const h3 = output.locator('h3');
      await expect(h3).toBeVisible();
      await expect(h3).toContainText('Merge Sort Steps for Array');

      // Confirm the ordered list exists and first <li> mentions the Initial Array
      const firstLi = output.locator('ol > li').first();
      await expect(firstLi).toContainText('Initial Array');
    });
  });

  test.describe('Negative and error scenario checks', () => {
    test('does not throw ReferenceError/SyntaxError/TypeError during load and interactions', async ({ page }) => {
      // This test explicitly checks collected page errors for the common JS exception types.
      // Interact with the page to potentially surface errors.
      const visualizeBtn = page.locator('#visualizeBtn');

      // Click once to trigger the visualization code path
      await visualizeBtn.click();

      // Allow a small delay for any asynchronous errors to surface
      await page.waitForTimeout(100);

      // Inspect collected pageErrors and ensure none are common exception types.
      const errorMessages = pageErrors.map(e => String(e));
      const hasReferenceError = errorMessages.some(msg => msg.includes('ReferenceError'));
      const hasTypeError = errorMessages.some(msg => msg.includes('TypeError'));
      const hasSyntaxError = errorMessages.some(msg => msg.includes('SyntaxError'));

      expect(hasReferenceError).toBeFalsy();
      expect(hasTypeError).toBeFalsy();
      expect(hasSyntaxError).toBeFalsy();

      // Also ensure console.error wasn't called
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      expect(consoleErrorMessages.length).toBe(0);
    });
  });
});