import { test, expect } from '@playwright/test';

// Test file for Application ID: 12151112-fa7a-11f0-acf9-69409043402d
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/12151112-fa7a-11f0-acf9-69409043402d.html
// Filename requirement: 12151112-fa7a-11f0-acf9-69409043402d.spec.js

// Page Object Model for the Big-Theta Interactive Explorer
class BigThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/12151112-fa7a-11f0-acf9-69409043402d.html';
    // Locators
    this.showFormalBtn = page.locator('#show-formal-def');
    this.formalDiv = page.locator('#formal-definition');

    this.fterms = page.locator('#fterms');
    this.gterms = page.locator('#gterms');
    this.fcoeff = page.locator('#fcoeff');
    this.gcoeff = page.locator('#gcoeff');
    this.nstart = page.locator('#nstart');
    this.nend = page.locator('#nend');

    this.evaluateBtn = page.locator('#evaluate-btn');
    this.evalResultDiv = page.locator('#evaluation-result');

    this.constC1 = page.locator('#const-c1');
    this.constC2 = page.locator('#const-c2');
    this.constN0 = page.locator('#const-n0');
    this.updateBoundsBtn = page.locator('#update-bounds-btn');
    this.boundsCheckDiv = page.locator('#bounds-check-result');

    this.evalNInput = page.locator('#eval-n');
    this.evalBtn = page.locator('#eval-btn');
    this.evalResultDivN = page.locator('#eval-result');
  }

  async goto() {
    await this.page.goto(this.url);
    // Wait for the main title to ensure page loaded
    await expect(this.page.locator('h1')).toHaveText(/Big-Theta Notation Interactive Explorer/);
  }

  // Toggle formal definition button
  async toggleFormal() {
    await this.showFormalBtn.click();
  }

  // Get the display style of formal definition
  async formalDisplay() {
    return await this.page.$eval('#formal-definition', el => el.style.display);
  }

  // Evaluate functions with whatever is currently set in the form
  async clickEvaluateFunctions() {
    await this.evaluateBtn.click();
    // Wait for some result to appear - the script always writes to evaluation-result textContent
    await this.evalResultDiv.waitFor({ state: 'visible' });
  }

  // Update bounds button
  async clickUpdateBounds() {
    await this.updateBoundsBtn.click();
    await this.boundsCheckDiv.waitFor({ state: 'visible' });
  }

  // Evaluate at specific n
  async clickEvalAtN() {
    await this.evalBtn.click();
    await this.evalResultDivN.waitFor({ state: 'visible' });
  }

  // Helper to set coefficients text
  async setFCoeffs(text) {
    await this.fcoeff.fill(text);
  }
  async setGCoeffs(text) {
    await this.gcoeff.fill(text);
  }

  // Helper to set n range
  async setNRange(start, end) {
    await this.nstart.fill(String(start));
    await this.nend.fill(String(end));
  }

  // Helper to set bounds constants
  async setBounds(c1, c2, n0) {
    await this.constC1.fill(String(c1));
    await this.constC2.fill(String(c2));
    await this.constN0.fill(String(n0));
  }

  // Select values in multiple select by values array
  async selectFTerms(values) {
    await this.page.evaluate((vals) => {
      const sel = document.getElementById('fterms');
      for (const o of sel.options) {
        o.selected = vals.includes(o.value);
      }
      sel.dispatchEvent(new Event('change'));
    }, values);
  }
  async selectGTerms(values) {
    await this.page.evaluate((vals) => {
      const sel = document.getElementById('gterms');
      for (const o of sel.options) {
        o.selected = vals.includes(o.value);
      }
      sel.dispatchEvent(new Event('change'));
    }, values);
  }

  // Deselect all options for fterms (used to test validations)
  async deselectAllFTerms() {
    await this.page.evaluate(() => {
      const sel = document.getElementById('fterms');
      for (const o of sel.options) {
        o.selected = false;
      }
      sel.dispatchEvent(new Event('change'));
    });
  }

  // Deselect all options for gterms
  async deselectAllGTerms() {
    await this.page.evaluate(() => {
      const sel = document.getElementById('gterms');
      for (const o of sel.options) {
        o.selected = false;
      }
      sel.dispatchEvent(new Event('change'));
    });
  }

  // Read evaluation result text
  async evalResultText() {
    return (await this.evalResultDiv.textContent())?.trim() ?? '';
  }

  // Read bounds check result text
  async boundsResultText() {
    return (await this.boundsCheckDiv.textContent())?.trim() ?? '';
  }

  // Read evaluate-at-n result text
  async evalAtNResultText() {
    return (await this.evalResultDivN.textContent())?.trim() ?? '';
  }

  // Access window stored objects (fFunc/gFunc/currentBounds)
  async currentBounds() {
    return await this.page.evaluate(() => {
      return window._currentBounds || null;
    });
  }

  async hasFFunc() {
    return await this.page.evaluate(() => !!window._fFunc);
  }
}

// Suite-level constants
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12151112-fa7a-11f0-acf9-69409043402d.html';

test.describe('Big-Theta Notation Interactive Explorer - FSM & DOM tests', () => {
  // We capture console errors and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events and capture them for assertion
    page.on('console', msg => {
      // push stringified form for later inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL);
    // Ensure the app header is loaded
    await expect(page.locator('h1')).toHaveText(/Big-Theta Notation Interactive Explorer/);
  });

  test.afterEach(async () => {
    // Teardown assertions: ensure no uncaught page errors were emitted during each test
    // The application JS is expected to run without uncaught exceptions for the flows we test.
    expect(pageErrors, 'No uncaught page errors should have occurred').toHaveLength(0);
    // Also check console for severity "error"
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles, 'No console.error messages should be emitted').toHaveLength(0);
  });

  test.describe('S0_Idle and S1_FormalDefinitionShown (Show/Hide formal definition)', () => {
    test('should display and hide the formal definition and update button text', async ({ page }) => {
      const pg = new BigThetaPage(page);

      // Initially formal definition hidden and button text is "Show Formal Definition"
      expect(await pg.formalDisplay()).toBe('none');
      await expect(pg.showFormalBtn).toHaveText('Show Formal Definition');

      // Click to show formal definition (transition S0 -> S1)
      await pg.toggleFormal();

      // After clicking, formal definition should be visible and have expected content
      const displayAfter = await pg.formalDisplay();
      expect(displayAfter === 'block' || displayAfter === '').toBeTruthy(); // style may be 'block' or empty if not inline
      await expect(pg.showFormalBtn).toHaveText('Hide Formal Definition');
      const formalText = await pg.formalDiv.textContent();
      expect(formalText).toContain('Big-Theta notation: Θ(g(n))');

      // Click again to hide (transition S1 -> S0)
      await pg.toggleFormal();
      const displayHidden = await pg.formalDisplay();
      expect(displayHidden).toBe('none');
      await expect(pg.showFormalBtn).toHaveText('Show Formal Definition');
    });
  });

  test.describe('S2_FunctionsEvaluated (Evaluate f vs Θ(g))', () => {
    test('should evaluate the default quadratic functions and expose bounds', async ({ page }) => {
      const pg = new BigThetaPage(page);

      // By default, page presets coefficients and selects quadratic term for f and g.
      // Ensure default coeffs are present
      await expect(pg.fcoeff).toHaveValue(/0,0,0,0,3,0/);
      await expect(pg.gcoeff).toHaveValue(/0,0,0,0,1,0/);

      // Click evaluate - should perform analysis and render evaluation-result
      await pg.clickEvaluateFunctions();

      const resultText = await pg.evalResultText();
      // Expect that result mentions Bounds found or Interpretation or Selected n0
      expect(resultText).toMatch(/Bounds found:|Selected n0:|Interpretation:/);

      // The app stores _currentBounds, assert that it exists and has numeric fields
      const bounds = await pg.currentBounds();
      expect(bounds).not.toBeNull();
      expect(typeof bounds.c1).toBe('number');
      expect(typeof bounds.c2).toBe('number');
      expect(typeof bounds.n0).toBe('number');

      // The evalResultDiv should contain "f(n) appears to be" or similar interpretation line (approx)
      expect(resultText).toMatch(/f\(n\) appears to be|Could not confirm/);
    });

    test('should show validation when no terms selected for f(n)', async ({ page }) => {
      const pg = new BigThetaPage(page);

      // Deselect all f terms to trigger validation
      await pg.deselectAllFTerms();
      // Ensure g terms are still selected (preset)
      // Click evaluate and expect a clear validation message
      await pg.clickEvaluateFunctions();
      const text = await pg.evalResultText();
      expect(text).toContain('Please select at least one term for f(n).');
    });

    test('should show validation when coefficients are invalid', async ({ page }) => {
      const pg = new BigThetaPage(page);

      // Restore selection for f and g to valid state
      await pg.selectFTerms(['n2']);
      await pg.selectGTerms(['n2']);

      // Provide invalid coefficients (non-numeric)
      await pg.setFCoeffs('a,b,c');
      await pg.setGCoeffs('1,2,3');

      await pg.clickEvaluateFunctions();
      const text = await pg.evalResultText();
      expect(text).toMatch(/Invalid coefficients for f\(n\)/);
    });

    test('should validate n range input and show error', async ({ page }) => {
      const pg = new BigThetaPage(page);

      // Set invalid n range: start > end
      await pg.setNRange(50, 10);
      await pg.clickEvaluateFunctions();
      const text = await pg.evalResultText();
      expect(text).toContain('Please enter valid n range (start ≥1 and end ≥ start).');
    });
  });

  test.describe('S3_BoundsUpdated (Update bounds based on chosen constants)', () => {
    test('should require evaluation first then allow bounds checks and report violations', async ({ page }) => {
      const pg = new BigThetaPage(page);

      // First, reload to a fresh state and click update bounds without evaluating (edge case)
      // This simulates transition from Idle -> UpdateBounds with missing preconditions
      // Reload page to isolate
      await page.goto(APP_URL);
      await expect(page.locator('h1')).toHaveText(/Big-Theta Notation Interactive Explorer/);

      // Click update bounds immediately
      await pg.clickUpdateBounds();
      let boundsText = await pg.boundsResultText();
      // Expect the explicit error prompting user to evaluate section 2 first
      expect(boundsText).toContain('Error: Please evaluate f(n) vs Θ(g(n)) in section 2 first.');

      // Now perform a valid evaluation (use default quadratic setup)
      await pg.clickEvaluateFunctions();

      // Now set bounds to default values (0.5, 2, n0=10) which should cause violations for f/g = 3
      await pg.setBounds(0.5, 2, 10);
      await pg.clickUpdateBounds();
      boundsText = await pg.boundsResultText();
      // Expect the output to report violations or a conclusion that constants do NOT bound f(n)
      expect(boundsText).toMatch(/Found \d+ violations|Conclusion: Constants c1 and c2 do NOT bound/);
    });
  });

  test.describe('S4_FunctionsEvaluatedAtN (Evaluate functions at specific n)', () => {
    test('should compute numeric values for f(n) and g(n) and ratio at a chosen n', async ({ page }) => {
      const pg = new BigThetaPage(page);

      // Ensure functions are evaluated first so window._fFunc/_gFunc exist
      await pg.clickEvaluateFunctions();

      // Evaluate at default n = 20
      await pg.clickEvalAtN();

      const atNText = await pg.evalAtNResultText();
      expect(atNText).toContain('At n = 20:');

      // For the default presets, f(n) = 3*n^2 and g(n) = 1*n^2
      // At n=20 => f=3*400=1200, g=400, ratio=3.000000
      expect(atNText).toContain('f(n) = 1200.000000');
      expect(atNText).toContain('g(n) = 400.000000');
      expect(atNText).toMatch(/f\(n\)\/g\(n\) = 3\.000000/);
    });

    test('should handle invalid n inputs on evaluation at n', async ({ page }) => {
      const pg = new BigThetaPage(page);

      // Ensure functions are evaluated first
      await pg.clickEvaluateFunctions();

      // Put an invalid n value (e.g., 0) and click evaluate at n
      await pg.evalNInput.fill('0');
      await pg.clickEvalAtN();
      const text = await pg.evalAtNResultText();
      expect(text).toContain('Please enter valid n (≥ 1).');
    });
  });

  test.describe('Additional edge cases and robustness checks', () => {
    test('should detect when g(n) becomes non-positive and report analysis cannot proceed', async ({ page }) => {
      const pg = new BigThetaPage(page);

      // Select terms such that g(n) might be zero or negative for the tested range.
      // For example, set g coefficients all zero so g(n) == 0 for all n -> evaluation should report no valid data points.
      await pg.selectFTerms(['n2']); // keep f as quadratic
      await pg.selectGTerms(['n2']);
      await pg.setFCoeffs('0,0,0,0,3,0'); // f = 3*n^2
      await pg.setGCoeffs('0,0,0,0,0,0'); // g = 0

      await pg.setNRange(1, 10);
      await pg.clickEvaluateFunctions();

      const text = await pg.evalResultText();
      expect(text).toContain('No valid data points for analysis (g(n) non-positive or undefined).');
    });
  });
});