import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c75e4-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for interacting with the Big-Omega app
class BigOmegaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      algorithm: '#algorithm',
      bound: '#bound',
      visualizeButton: 'button[onclick="updatePlot()"]',
      plot: '#plot',
      fInput: '#f-input',
      gInput: '#g-input',
      verifyButton: 'button[onclick="verifyOmega()"]',
      verificationResult: '#verification-result'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Interaction helpers
  async selectAlgorithm(value) {
    await this.page.selectOption(this.selectors.algorithm, { value });
  }

  async selectBound(value) {
    await this.page.selectOption(this.selectors.bound, { value });
  }

  async clickVisualize() {
    await this.page.click(this.selectors.visualizeButton);
  }

  async enterFunctions(fExpr, gExpr) {
    await this.page.fill(this.selectors.fInput, fExpr);
    await this.page.fill(this.selectors.gInput, gExpr);
  }

  async clickVerify() {
    await this.page.click(this.selectors.verifyButton);
  }

  // Getters / assertions
  async getPlotText() {
    return this.page.locator(this.selectors.plot).innerText();
  }

  async getPlotHtml() {
    return this.page.locator(this.selectors.plot).innerHTML();
  }

  async getVerificationText() {
    return this.page.locator(this.selectors.verificationResult).innerText();
  }

  async getVerificationColor() {
    // Return the inline style color if present (the app sets resultDiv.style.color)
    return this.page.locator(this.selectors.verificationResult).evaluate((el) => el.style.color);
  }

  async countPlotLines() {
    return this.page.locator(`${this.selectors.plot} .line`).count();
  }
}

test.describe('Big-Omega (Ω) Notation Interactive App - FSM tests', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('S0 Idle: Page initializes and initPlot() is called on load (entry action)', async ({ page }) => {
    // This test validates initial state S0_Idle and its entry action initPlot()
    const app = new BigOmegaPage(page);
    await app.goto();

    // The initPlot is expected to create axis lines and labels inside #plot
    const plotHtml = await app.getPlotHtml();
    expect(plotHtml).toBeTruthy();

    // Check that x-axis and y-axis elements exist (they have class 'line')
    const lineCount = await app.countPlotLines();
    expect(lineCount).toBeGreaterThanOrEqual(2); // at least x and y axis

    // Check that labels were added by initPlot
    const plotText = await app.getPlotText();
    expect(plotText).toContain('n (input size)');
    expect(plotText).toContain('Time Complexity');

    // No uncaught page errors expected during initialization
    expect(pageErrors.length).toBe(0);
    // No console errors logged
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1 PlotUpdated: Selecting algorithm and bound then clicking Visualize updates the plot and legend', async ({ page }) => {
    // Validate transition from Idle -> PlotUpdated via SelectAlgorithm/SelectBound + ClickVisualize
    const app = new BigOmegaPage(page);
    await app.goto();

    // Choose a different algorithm and bound, then visualize
    await app.selectAlgorithm('n^3');   // Cubic
    await app.selectBound('n^2');      // Quadratic bound
    await app.clickVisualize();         // ClickVisualize event

    // After updatePlot runs, legend should reflect the choices
    const plotText = await app.getPlotText();
    expect(plotText).toContain('Algorithm: n^3'); // legend contains algorithm
    expect(plotText).toContain('Ω Bound: n^2');   // legend contains bound

    // The visualization should include some plotted lines for both algorithm and bound
    // There should be at least some .algorithm-line or .bound-line elements; check overall line count
    const totalLines = await app.countPlotLines();
    expect(totalLines).toBeGreaterThanOrEqual(5); // axes + several plot segments + legend/buffer

    // Clicking visualize again should keep the app in S1 PlotUpdated (idempotent)
    await app.clickVisualize();
    const plotTextAfter = await app.getPlotText();
    expect(plotTextAfter).toContain('Algorithm: n^3');
    expect(plotTextAfter).toContain('Ω Bound: n^2');

    // Ensure no uncaught errors during plot updates
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S2 Omega Verified: Verify Ω returns TRUE for f(n)=3*n^2+2*n+5 and g(n)=n^2', async ({ page }) => {
    // This validates the transition PlotUpdated -> OmegaVerified on ClickVerify (true path)
    const app = new BigOmegaPage(page);
    await app.goto();

    // Ensure we start with safe, JS-friendly expressions to avoid eval pitfalls:
    // Use explicit multiplication operators and allow ^ replacement for exponent
    await app.enterFunctions('3*n^2 + 2*n + 5', 'n^2');

    // Click verify and wait a short time for UI update
    await app.clickVerify();
    await page.waitForTimeout(100); // minimal wait so DOM updates

    const resultText = await app.getVerificationText();

    // The expected evidence contains the phrase 'is TRUE' and includes c and n₀ in the string
    expect(resultText).toContain('is TRUE');
    expect(resultText).toMatch(/c\s*=/);
    expect(resultText).toMatch(/n₀/);

    // The UI sets the result color to green on success (inline style)
    const color = await app.getVerificationColor();
    // It sets resultDiv.style.color = 'green'; assert inline style was applied
    expect(color).toBe('green');

    // Assert no uncaught page errors or console errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S3 Omega Not Verified: Verify Ω returns FALSE for f(n)=n and g(n)=n^2', async ({ page }) => {
    // This validates the transition PlotUpdated -> OmegaNotVerified on ClickVerify (false path)
    const app = new BigOmegaPage(page);
    await app.goto();

    // Enter a function pair where f grows slower than g
    await app.enterFunctions('n', 'n^2');

    await app.clickVerify();
    await page.waitForTimeout(100); // wait for DOM update

    const resultText = await app.getVerificationText();

    // Expect the false message per evidence
    expect(resultText).toContain('is FALSE');
    expect(resultText).toContain('no suitable c and n₀ found');

    // The UI sets the result color to red on failure
    const color = await app.getVerificationColor();
    expect(color).toBe('red');

    // Ensure no uncaught runtime errors during verification
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: malformed function triggers evaluation error message (syntax/runtime in eval handled)', async ({ page }) => {
    // Validate behavior when the user provides an expression that cannot be evaluated (e.g., undefined function call)
    const app = new BigOmegaPage(page);
    await app.goto();

    // Provide an expression that will cause eval to throw (but evaluateFunction catches it and returns NaN)
    await app.enterFunctions('foo(n)', 'n^2');

    await app.clickVerify();
    // The app returns early with an error message when isNaN encountered inside verifyOmega
    await page.waitForTimeout(100);

    const resultText = await app.getVerificationText();
    expect(resultText).toMatch(/Error evaluating functions at n=\d+/); // e.g., Error evaluating functions at n=1. Check substring

    // This flow should not produce uncaught page errors because evaluateFunction handles exceptions
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Multiple interactions: sequence of selects, visualize, and verify do not cause uncaught exceptions', async ({ page }) => {
    // This test runs through many interactions to validate FSM transitions stability
    const app = new BigOmegaPage(page);
    await app.goto();

    // Sequence: change algorithm, bound, visualize, change functions, verify true, change functions, verify false
    await app.selectAlgorithm('2^n');
    await app.selectBound('1'); // constant
    await app.clickVisualize();
    await page.waitForTimeout(50);

    // Check legend reflects exponential and constant
    const plotText1 = await app.getPlotText();
    expect(plotText1).toContain('Algorithm: 2^n');
    expect(plotText1).toContain('Ω Bound: 1');

    // Now check a verify that is likely true: f=2^n, g=1 (exponential dominates constant)
    await app.enterFunctions('2^n', '1');
    await app.clickVerify();
    await page.waitForTimeout(100);
    const resultTrue = await app.getVerificationText();
    expect(resultTrue).toContain('is TRUE');
    expect(pageErrors.length).toBe(0);

    // Now check a verify that is false: f=log n, g=n (log grows slower)
    await app.enterFunctions('Math.log(n+1)', 'n');
    await app.clickVerify();
    await page.waitForTimeout(100);
    const resultFalse = await app.getVerificationText();
    expect(resultFalse).toContain('is FALSE');

    // Still no uncaught errors should have occurred during these interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});