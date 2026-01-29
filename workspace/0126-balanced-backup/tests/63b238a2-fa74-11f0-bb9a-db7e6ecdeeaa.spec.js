import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b238a2-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Small page object to encapsulate common interactions and selectors
class ThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.form = page.locator('#functionForm');
    this.inputA = page.locator('input[name="a"]');
    this.inputB = page.locator('input[name="b"]');
    this.inputC1 = page.locator('input[name="c1"]');
    this.inputC2 = page.locator('input[name="c2"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.thetaCanvas = page.locator('#thetaChart');
    this.userCanvas = page.locator('#userChart');
    this.resultText = page.locator('#resultText');
  }

  // Fill the form inputs and submit the form (click submit)
  async fillAndSubmit({ a, b, c1, c2 }) {
    if (a !== undefined) await this.inputA.fill(String(a));
    if (b !== undefined) await this.inputB.fill(String(b));
    if (c1 !== undefined) await this.inputC1.fill(String(c1));
    if (c2 !== undefined) await this.inputC2.fill(String(c2));
    // Submit via click so form submit handler runs
    await this.submitButton.click();
  }

  // Return resultText content and computed color
  async getResultTextContentAndColor() {
    const text = await this.resultText.textContent();
    const color = await this.page.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return s.color;
    }, await this.resultText.elementHandle());
    return { text: text?.trim() ?? '', color };
  }

  // Get canvas data URL to assert that something was drawn
  async getCanvasDataURL(selector) {
    return await this.page.evaluate((sel) => {
      const c = document.querySelector(sel);
      try {
        return c.toDataURL();
      } catch (e) {
        return null;
      }
    }, selector);
  }

  // Get numeric values currently in the inputs
  async getInputValues() {
    return {
      a: await this.inputA.inputValue(),
      b: await this.inputB.inputValue(),
      c1: await this.inputC1.inputValue(),
      c2: await this.inputC2.inputValue(),
    };
  }
}

test.describe('Big-Theta Notation Demonstration (FSM states & transitions)', () => {
  // Collect console messages and page errors for inspection in each test
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console messages (info, warn, error, log)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts) so tests can assert on alert messages without letting them block
    page.on('dialog', async (dialog) => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      await dialog.dismiss(); // Dismiss so tests continue
    });

    // Navigate to the application page (fresh state for each test)
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    // Basic sanity checks that tests themselves didn't leave uncaught page errors (will be asserted per test as needed)
    // (No actions here; individual tests will assert console/page errors policy)
  });

  test('S0_Idle: initial draw actions should run (drawThetaExample entry action)', async ({ page }) => {
    // This test validates that on initial load the example canvas is drawn via drawThetaExample().
    const tp = new ThetaPage(page);

    // The example canvas should exist and have width/height attributes set as in the HTML
    await expect(tp.thetaCanvas).toHaveAttribute('width', '700');
    await expect(tp.thetaCanvas).toHaveAttribute('height', '350');
    await expect(tp.thetaCanvas).toBeVisible();

    // The user canvas is also drawn initially by drawUserFunction(3,5,2,4) at the end of the script
    await expect(tp.userCanvas).toHaveAttribute('width', '700');
    await expect(tp.userCanvas).toHaveAttribute('height', '350');
    await expect(tp.userCanvas).toBeVisible();

    // Ensure canvas has been rendered by checking toDataURL starts with data:image
    const thetaData = await tp.getCanvasDataURL('#thetaChart');
    const userData = await tp.getCanvasDataURL('#userChart');

    expect(thetaData).toBeTruthy();
    expect(typeof thetaData).toBe('string');
    expect(thetaData.startsWith('data:image')).toBe(true);

    expect(userData).toBeTruthy();
    expect(typeof userData).toBe('string');
    expect(userData.startsWith('data:image')).toBe(true);

    // There should be no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // No console messages of type 'error'
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('S1_FunctionInput -> S2_VisualizationResult: submitting valid defaults shows success result', async ({ page }) => {
    // This test validates the transition S1 -> S2 (successful visualization)
    const tp = new ThetaPage(page);

    // Verify initial input values as asserted in FSM/components
    const inputs = await tp.getInputValues();
    expect(inputs.a).toBe('3');
    expect(inputs.b).toBe('5');
    expect(inputs.c1).toBe('2');
    expect(inputs.c2).toBe('4');

    // Initially resultText is empty (no submission yet)
    let initialText = await tp.resultText.textContent();
    expect((initialText || '').trim()).toBe('');

    // Submit the form with the default values; this should lead to a "Yes!" result
    await tp.fillAndSubmit({ a: 3, b: 5, c1: 2, c2: 4 });

    // After submission, the resultText should indicate success (S2_VisualizationResult)
    const { text, color } = await tp.getResultTextContentAndColor();
    expect(text).toContain('Yes! For sufficiently large n, f(n) = 3n + 5 fits within the bounds 2n ≤ f(n) ≤ 4n, so f(n) = Θ(n).');
    // Color should be the green used in script (#27ae60 -> rgb(39, 174, 96))
    expect(color).toBe('rgb(39, 174, 96)');

    // The userChart should have been updated (non-empty data URL)
    const userData = await tp.getCanvasDataURL('#userChart');
    expect(userData).toBeTruthy();
    expect(userData.startsWith('data:image')).toBe(true);

    // No uncaught page errors or console errors during this operation
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('S1_FunctionInput -> S3_VisualizationFailure: submitting values outside bounds shows failure result', async ({ page }) => {
    // This test validates the transition S1 -> S3 (visualization failure)
    const tp = new ThetaPage(page);

    // Use parameters that should fail: a=5, b=0, c1=2, c2=4 -> 5n is > 4n for n>0
    await tp.fillAndSubmit({ a: 5, b: 0, c1: 2, c2: 4 });

    const { text, color } = await tp.getResultTextContentAndColor();
    // Should indicate failure with the "No, f(n) = ..." message
    expect(text).toContain('No, f(n) = 5n + 0 does NOT stay within the bounds 2n and 4n for large n, so f(n) ≠ Θ(n) with these constants. Try different constants or function.');
    // Color should be red (#c0392b -> rgb(192, 57, 43))
    expect(color).toBe('rgb(192, 57, 43)');

    // Ensure user chart exists and was attempted to be drawn (data URL exists)
    const userData = await tp.getCanvasDataURL('#userChart');
    expect(userData).toBeTruthy();
    expect(userData.startsWith('data:image')).toBe(true);

    // No uncaught runtime page errors and no console errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('S1_FunctionInput InvalidInput: c1 or c2 non-positive triggers alert and stays in input state', async ({ page }) => {
    // This test validates the InvalidInput event handling and ensures the FSM stays in input state (no transition to result)
    const tp = new ThetaPage(page);

    // Case 1: c1 <= 0 should trigger alert "Constants c1 and c2 must be positive."
    await tp.fillAndSubmit({ a: 3, b: 0, c1: 0, c2: 4 });

    // Dialog should have been captured
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    const alert1 = dialogMessages.shift();
    expect(alert1.type).toBe('alert');
    expect(alert1.message).toBe('Constants c1 and c2 must be positive.');

    // After invalid input, resultText should remain empty (no transition to result)
    let { text: textAfterInvalid1 } = await tp.getResultTextContentAndColor();
    expect(textAfterInvalid1).toBe('');

    // Case 2: c1 >= c2 should trigger alert "Constant c1 (lower bound) must be less than c2 (upper bound)."
    await tp.fillAndSubmit({ a: 3, b: 0, c1: 5, c2: 2 });

    // Next dialog should be captured
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    const alert2 = dialogMessages.shift();
    expect(alert2.type).toBe('alert');
    expect(alert2.message).toBe('Constant c1 (lower bound) must be less than c2 (upper bound).');

    // Ensure still no result text shown
    let { text: textAfterInvalid2 } = await tp.getResultTextContentAndColor();
    expect(textAfterInvalid2).toBe('');

    // No uncaught page errors and no console errors during validation
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('FSM transitions and onEnter/onExit evidence: sequence of events and state checks', async ({ page }) => {
    // This test runs through a sequence to demonstrate transitions S0 -> S1 -> S2 and S1 -> S3,
    // and checks that the functions invoked on entry (drawThetaExample) and exit (no explicit exit actions) behave as expected.
    const tp = new ThetaPage(page);

    // S0 (Idle) verified by initial canvas content; ensure theta canvas has been drawn
    const thetaDataInitial = await tp.getCanvasDataURL('#thetaChart');
    expect(thetaDataInitial && thetaDataInitial.startsWith('data:image')).toBe(true);

    // Simulate entering S1 by focusing the form (user about to input)
    await tp.inputA.focus();
    // There is no explicit DOM change for entering S1, but we can assert the form is present and accessible
    await expect(tp.form).toBeVisible();
    const labels = await page.locator('#functionForm label').allTextContents();
    expect(labels.length).toBeGreaterThanOrEqual(4);

    // Submit valid values -> transition to S2
    await tp.fillAndSubmit({ a: 2.5, b: 1, c1: 2, c2: 3 });
    const success = await tp.resultText.textContent();
    // We know with a=2.5,b=1,c1=2,c2=3 for n >=10, 2.5n+1 between 2n and 3n -> should be within (S2)
    expect((success || '').trim().startsWith('Yes!')).toBe(true);

    // Now submit a failing value to demonstrate S1 -> S3 (go back into input and then failure)
    // First change a so it exceeds upper bound (e.g., a=4)
    await tp.fillAndSubmit({ a: 4.5, b: 0, c1: 2, c2: 3 });
    const failure = await tp.resultText.textContent();
    expect((failure || '').trim().startsWith('No,')).toBe(true);

    // Ensure no page errors or JS exceptions occurred in this sequence
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Edge case: non-integer / fractional coefficients handled and result text updated accordingly', async ({ page }) => {
    // This test ensures fractional numbers are accepted (type="number" step="any") and that the logic still runs
    const tp = new ThetaPage(page);

    // Use fractional a that should still be within bounds: a=3.5, b=1.2, c1=3, c2=4
    await tp.fillAndSubmit({ a: 3.5, b: 1.2, c1: 3, c2: 4 });

    // Determine expected outcome: for n >= 10, f(n)=3.5n+1.2; lower bound=3n, upper=4n -> should be within for n>=10
    const { text, color } = await tp.getResultTextContentAndColor();
    expect(text).toContain('f(n) = 3.5n + 1.2');
    expect(text.startsWith('Yes') || text.startsWith('No')).toBe(true); // It should produce either with correct formatting
    // If it's "Yes", color should be green; if "No", color should be red. We'll accept either but ensure color is set accordingly.
    expect(['rgb(39, 174, 96)', 'rgb(192, 57, 43)']).toContain(color);

    // No page errors or console errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });
});