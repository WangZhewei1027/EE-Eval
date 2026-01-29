import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b55630-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the perceptron demo page
class PerceptronDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input1 = page.locator('#input1');
    this.input2 = page.locator('#input2');
    this.computeButton = page.locator("button[onclick='runPerceptronDemo()']");
    this.demoOutput = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getDefaultInputValues() {
    const v1 = await this.input1.inputValue();
    const v2 = await this.input2.inputValue();
    return { v1, v2 };
  }

  async setInputs(x1, x2) {
    // Use fill to allow empty and non-numeric edge cases
    await this.input1.fill(String(x1));
    await this.input2.fill(String(x2));
  }

  async clickCompute() {
    await this.computeButton.click();
  }

  async getOutputText() {
    return (await this.demoOutput.innerHTML()).trim();
  }

  async getFinalOutputNumericFromDOM() {
    // Extract the "Final Output: X.XX" portion and parse numeric
    const html = await this.getOutputText();
    const match = html.match(/Final Output:\s*([^\s<]+)/i);
    if (!match) return null;
    const val = match[1].replace(/<\/?[^>]+(>|$)/g, ''); // strip tags if any
    const num = Number(val);
    return Number.isNaN(num) ? val : num;
  }
}

test.describe('Perceptron Demo - FSM states and transitions', () => {
  // Group-level timeout slightly increased for robustness
  test.setTimeout(30_000);

  // Test S0: Idle state rendering and entry action check
  test('Idle state: page renders inputs, button and demo output container (S0_Idle)', async ({ page }) => {
    // Capture console errors and page errors for observation
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new PerceptronDemoPage(page);
    await demo.goto();

    // Validate presence of UI elements described in the FSM (inputs, button, output container)
    await expect(demo.input1).toBeVisible();
    await expect(demo.input2).toBeVisible();
    await expect(demo.computeButton).toBeVisible();
    await expect(demo.demoOutput).toBeVisible();

    // Validate default input values match the HTML implementation
    const defaults = await demo.getDefaultInputValues();
    expect(defaults.v1).toBe('1');    // input1 default value
    expect(defaults.v2).toBe('0.5');  // input2 default value

    // The FSM lists an entry action "renderPage()". Verify that the page does not define renderPage,
    // and calling it from the page context naturally produces a ReferenceError (without patching the page).
    // We evaluate in page context and capture the thrown error name.
    const errorNameFromCallingRenderPage = await page.evaluate(() => {
      try {
        // Intentionally call the function that the FSM claims exists but is not present in the HTML.
        // This should throw a ReferenceError in the page environment if it's undefined.
        renderPage();
        return 'NO_ERROR';
      } catch (e) {
        // Return the error name to the test environment for assertion
        return e && e.name ? e.name : 'UNKNOWN_ERROR_SHAPE';
      }
    });

    // We expect the function to be missing and that a ReferenceError occurs when attempted to call.
    expect(errorNameFromCallingRenderPage).toBe('ReferenceError');

    // Ensure there were no unexpected runtime page errors emitted during load
    expect(pageErrors).toHaveLength(0);
    // Allow console messages but assert that there were no console.error entries
    expect(consoleErrors).toHaveLength(0);
  });

  // Test transition S0 -> S1 via ComputeOutput event
  test('Compute Output transition: clicking button shows calculation steps and final output (S0_Idle -> S1_OutputDisplayed)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new PerceptronDemoPage(page);
    await demo.goto();

    // Click the compute button using the event trigger selector described in FSM
    await demo.clickCompute();

    // After clicking, the demoOutput should contain the calculation steps and final output
    await expect(demo.demoOutput).toContainText('Calculation Steps');
    await expect(demo.demoOutput).toContainText('Weighted sum');
    await expect(demo.demoOutput).toContainText('Apply ReLU activation');

    // With the default inputs (x1=1, x2=0.5) and fixed weights and bias (w1=0.5, w2=-0.3, b=0.1)
    // Weighted sum = (1 * 0.5) + (0.5 * -0.3) + 0.1 = 0.45 -> Final Output = max(0, 0.45) = 0.45
    const finalOutput = await demo.getFinalOutputNumericFromDOM();
    // finalOutput expected numeric 0.45 (floating point)
    expect(typeof finalOutput).toBe('number');
    // Allow small rounding tolerance but since code uses toFixed(2) expect 0.45 exactly
    expect(finalOutput).toBeCloseTo(0.45, 5);

    // Confirm the inner HTML shows the weighted sum to two decimal places (0.45)
    const outputHtml = await demo.getOutputText();
    expect(outputHtml).toMatch(/= 0.45/);
    expect(outputHtml).toMatch(/Final Output: 0.45/);

    // FSM expected that the demo sets demoOutput.innerHTML; verify innerHTML is non-empty
    expect(outputHtml.length).toBeGreaterThan(20);

    // Assert that clicking the button did not cause any unhandled page errors
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  // Edge case: large negative contribution causing ReLU to clamp to 0
  test('Edge case: large negative weighted sum results in ReLU zero output', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new PerceptronDemoPage(page);
    await demo.goto();

    // Set inputs to produce a strongly negative weighted sum: x1=0, x2=10 => weightedSum = 0 + (-3) + 0.1 = -2.9 -> ReLU => 0
    await demo.setInputs(0, 10);
    await demo.clickCompute();

    // Wait for DOM update and assert final output is 0.00
    const finalVal = await demo.getFinalOutputNumericFromDOM();
    // The code uses toFixed(2) so we expect numeric 0.00 -> parsed to 0
    expect(typeof finalVal).toBe('number');
    expect(finalVal).toBeCloseTo(0.0, 5);

    // Confirm the output text contains "Final Output: 0.00"
    const outHtml = await demo.getOutputText();
    expect(outHtml).toMatch(/Final Output: 0.00/);

    // Ensure no uncaught errors happened
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  // Edge case: empty or non-numeric input values (user clears inputs) -> check NaN behavior
  test('Edge case: non-numeric/empty inputs produce NaN in calculation but do not crash the page', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      // record any console error messages
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new PerceptronDemoPage(page);
    await demo.goto();

    // Clear inputs to create empty strings (type=number inputs accept empty values)
    await demo.setInputs('', '');
    await demo.clickCompute();

    // The code computes weightedSum using parseFloat('') => NaN, then uses toFixed(2) on NaN which renders 'NaN'
    const outputHtml = await demo.getOutputText();

    // Expect the output to contain 'NaN' as a visible artifact of invalid numeric operations
    expect(outputHtml).toMatch(/NaN/);

    // When NaN is used with Math.max(0, NaN) => NaN, and toFixed will still produce 'NaN', but no exceptions should be thrown.
    // Confirm that no unhandled page errors were emitted during this edge case
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  // Verify that the button has the onclick handler as described by the FSM and that invoking it is the supported transition
  test('FSM event wiring: ComputeOutput button has onclick runPerceptronDemo() attribute', async ({ page }) => {
    const demo = new PerceptronDemoPage(page);
    await demo.goto();

    // Get the raw onclick attribute from the page element
    const onclickAttr = await page.locator("button[onclick='runPerceptronDemo()']").getAttribute('onclick');
    expect(onclickAttr).toBe('runPerceptronDemo()');

    // Verify that clicking the button triggers the observable expected by FSM: output rendered in #demo-output
    await demo.clickCompute();
    await expect(demo.demoOutput).toContainText('Final Output:');
  });

  // Observability test: monitor console and pageerror across interactions to ensure no unexpected SyntaxError/TypeError.
  test('Observability: no SyntaxError/TypeError/ReferenceError emitted during typical interactions', async ({ page }) => {
    const consoleErrorTypes = [];
    const pageErrorNames = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrorTypes.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      // record the error name for assertion
      pageErrorNames.push(err.name || String(err));
    });

    const demo = new PerceptronDemoPage(page);
    await demo.goto();

    // Perform a set of interactions: compute default, compute after changing inputs, compute with extreme values
    await demo.clickCompute();
    await demo.setInputs(2.5, -1.2);
    await demo.clickCompute();
    await demo.setInputs(-100, 100);
    await demo.clickCompute();

    // After interactions, assert no SyntaxError/TypeError/ReferenceError surfaced unexpectedly.
    // If any of those errors did surface, fail so that runtime issues are visible.
    const problematicErrors = pageErrorNames.filter(name => ['SyntaxError', 'TypeError', 'ReferenceError'].includes(name));
    expect(problematicErrors.length).toBe(0);

    // Also ensure no console.error messages were emitted
    expect(consoleErrorTypes.length).toBe(0);
  });
});