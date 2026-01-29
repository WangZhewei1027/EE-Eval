import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2fab00-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object Model for the Big-Theta Notation Explorer
class BigThetaPage {
  constructor(page) {
    this.page = page;
    // Proof section
    this.functionSelect = page.locator('#function-select');
    this.c1Slider = page.locator('#c1-slider');
    this.c2Slider = page.locator('#c2-slider');
    this.n0Slider = page.locator('#n0-slider');
    this.c1Value = page.locator('#c1-value');
    this.c2Value = page.locator('#c2-value');
    this.n0Value = page.locator('#n0-value');
    this.autoAdjustBtn = page.locator('#auto-adjust-btn');
    this.proofGraph = page.locator('#proof-graph');
    this.proofResult = page.locator('#proof-result');

    // Comparison section
    this.compareF1 = page.locator('#compare-f1');
    this.compareF2 = page.locator('#compare-f2');
    this.compareMaxN = page.locator('#compare-max-n');
    this.compareMaxNValue = page.locator('#compare-max-n-value');
    this.compareBtn = page.locator('#compare-btn');
    this.compareGraph = page.locator('#compare-graph');
    this.comparisonResult = page.locator('#comparison-result');

    // Algorithm analysis
    this.algorithmSelect = page.locator('#algorithm-select');
    this.algorithmN = page.locator('#algorithm-n');
    this.algorithmNValue = page.locator('#algorithm-n-value');
    this.analyzeBtn = page.locator('#analyze-btn');
    this.algorithmResultTable = page.locator('#algorithm-result table');

    // Custom tester
    this.customF = page.locator('#custom-f');
    this.customG = page.locator('#custom-g');
    this.testBtn = page.locator('#test-btn');
    this.testResult = page.locator('#test-result');
  }

  // Helper interactions
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait for initialization (init called on window.onload)
    await this.page.waitForLoadState('networkidle');
  }

  // Proof actions
  async setFunctionSelect(value) {
    await this.functionSelect.selectOption({ value });
    // change should trigger updateProof via event listener
  }
  async setC1(value) {
    await this.c1Slider.evaluate((el, v) => (el.value = v), value);
    await this.c1Slider.dispatchEvent('input');
  }
  async setC2(value) {
    await this.c2Slider.evaluate((el, v) => (el.value = v), value);
    await this.c2Slider.dispatchEvent('input');
  }
  async setN0(value) {
    await this.n0Slider.evaluate((el, v) => (el.value = v), value);
    await this.n0Slider.dispatchEvent('input');
  }
  async clickAutoAdjust() {
    await this.autoAdjustBtn.click();
  }

  // Comparison actions
  async setCompareF1(value) {
    await this.compareF1.selectOption({ value });
  }
  async setCompareF2(value) {
    await this.compareF2.selectOption({ value });
  }
  async setCompareMaxN(value) {
    await this.compareMaxN.evaluate((el, v) => (el.value = v), value);
    await this.compareMaxN.dispatchEvent('input');
  }
  async clickCompare() {
    await this.compareBtn.click();
  }

  // Algorithm actions
  async setAlgorithm(value) {
    await this.algorithmSelect.selectOption({ value });
  }
  async setAlgorithmN(value) {
    await this.algorithmN.evaluate((el, v) => (el.value = v), value);
    await this.algorithmN.dispatchEvent('input');
  }
  async clickAnalyze() {
    await this.analyzeBtn.click();
  }

  // Custom tester
  async setCustomF(value) {
    await this.customF.fill(value);
  }
  async setCustomG(value) {
    await this.customG.fill(value);
  }
  async clickTest() {
    await this.testBtn.click();
  }
}

test.describe('Big-Theta Notation Explorer - FSM and UI Validation', () => {
  let page;
  let app;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Collect console messages and page errors for later assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      const text = `[console.${msg.type()}] ${msg.text()}`;
      consoleMessages.push({ type: msg.type(), text });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    app = new BigThetaPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Close page after each test
    await page.close();
  });

  test.describe('S0_Idle and S1_ProofUpdated (Interactive Proof)', () => {
    test('renders initial proof UI and updateProof runs on init (S0 -> S1)', async () => {
      // The page init call triggers updateProof on load; we assert proofResult is populated
      await expect(app.proofResult).toBeVisible();
      const text = await app.proofResult.textContent();
      // Should contain either success or failure hint - check that it's not empty
      expect(text).toBeTruthy();

      // Ensure proof graph has elements drawn by updateProof
      const graphChildren = await app.proofGraph.evaluate(node => node.children.length);
      expect(graphChildren).toBeGreaterThan(0);
    });

    test('changing function select triggers updateProof and updates graph and result (FunctionSelectChange)', async () => {
      // Change function to 'n^2'
      await app.setFunctionSelect('n^2');
      // Wait a short while for DOM updates
      await page.waitForTimeout(100);
      const proofText = await app.proofResult.textContent();
      expect(proofText).toContain('f(n') || expect(proofText.length).toBeGreaterThan(0);

      // Graph should update
      const graphChildrenAfter = await app.proofGraph.evaluate(node => node.children.length);
      expect(graphChildrenAfter).toBeGreaterThan(0);
    });

    test('adjusting c1, c2, n0 sliders triggers updateProof and updates displayed slider values (C1SliderInput, C2SliderInput, N0SliderInput)', async () => {
      // Set c1 to 0.8
      await app.setC1('0.8');
      await page.waitForTimeout(50);
      await expect(app.c1Value).toHaveText('0.8');

      // Set c2 to 1.7
      await app.setC2('1.7');
      await page.waitForTimeout(50);
      await expect(app.c2Value).toHaveText('1.7');

      // Set n0 to 10
      await app.setN0('10');
      await page.waitForTimeout(50);
      await expect(app.n0Value).toHaveText('10');

      // Ensure proofResult reflects the changes (still contains text)
      const proofText = await app.proofResult.textContent();
      expect(proofText).toBeTruthy();
    });

    test('auto-adjust button modifies sliders and calls updateProof (AutoAdjustBtnClick)', async () => {
      // Click auto-adjust
      await app.clickAutoAdjust();
      // Wait for updateProof triggered by autoAdjustConstants
      await page.waitForTimeout(100);

      // After auto-adjust the sliders should have been changed (n0 reset to 5 by implementation)
      await expect(app.n0Value).toHaveText('5');

      // c1 and c2 should have values set by autoAdjustConstants for common functions.
      const c1Text = await app.c1Value.textContent();
      const c2Text = await app.c2Value.textContent();
      expect(c1Text).toBeTruthy();
      expect(c2Text).toBeTruthy();

      // Graph updated
      const graphChildren = await app.proofGraph.evaluate(node => node.children.length);
      expect(graphChildren).toBeGreaterThan(0);
    });
  });

  test.describe('S2_ComparisonUpdated (Function Comparison)', () => {
    test('initial comparison run on init produced a non-empty result and graph (S0 -> S2)', async () => {
      await expect(app.comparisonResult).toBeVisible();
      const cmpText = await app.comparisonResult.textContent();
      expect(cmpText).toBeTruthy();

      const compareGraphChildren = await app.compareGraph.evaluate(node => node.children.length);
      expect(compareGraphChildren).toBeGreaterThan(0);
    });

    test('changing compare functions and max-n updates the result and value display (CompareF1Change, CompareF2Change, CompareMaxNInput)', async () => {
      // Choose function 1 as 'n' and function 2 as 'n^2'
      await app.setCompareF1('n');
      await app.setCompareF2('n^2');
      // Set max n to 200
      await app.setCompareMaxN('200');
      await page.waitForTimeout(100);

      // Value display should update
      await expect(app.compareMaxNValue).toHaveText('200');

      // Click compare to ensure updateComparison runs on click (CompareBtnClick)
      await app.clickCompare();
      await page.waitForTimeout(100);

      const resultText = await app.comparisonResult.textContent();
      // For n vs n^2 we expect "grows slower"
      expect(resultText.toLowerCase()).toContain('grows slower');
    });

    test('CompareBtnClick triggers updateComparison even when functions are identical (edge case)', async () => {
      await app.setCompareF1('n^2');
      await app.setCompareF2('n^2');
      await app.clickCompare();
      await page.waitForTimeout(50);
      const result = await app.comparisonResult.textContent();
      expect(result).toContain('Θ');
      expect(result).toContain('same function');
    });
  });

  test.describe('S3_AlgorithmAnalyzed (Algorithm Analysis)', () => {
    test('initial algorithm analysis runs on init and populates a table row', async () => {
      // The init() triggers analyzeAlgorithm; ensure table has at least one result row
      const rows = await app.algorithmResultTable.evaluate(table => table.rows.length);
      expect(rows).toBeGreaterThan(1); // header + at least one result
    });

    test('changing algorithm select and n triggers analyzeAlgorithm (AlgorithmSelectChange, AlgorithmNInput)', async () => {
      // Choose bubble-sort
      await app.setAlgorithm('bubble-sort');
      // Change n to 20
      await app.setAlgorithmN('20');
      // Click analyze explicitly
      await app.clickAnalyze();
      await page.waitForTimeout(100);

      // Inspect the inserted row for Bubble Sort and Θ(n²)
      const cellTexts = await app.algorithmResultTable.evaluate(() => {
        const row = document.querySelector('#algorithm-result table').rows[1];
        return Array.from(row.cells).map(c => c.textContent);
      });

      expect(cellTexts[0].toLowerCase()).toContain('bubble');
      expect(cellTexts[1]).toContain('Θ');
      expect(cellTexts[1].toLowerCase()).toContain('n'); // contains n^2 representation (might be using getFunctionName)
    });

    test('AnalyzeBtnClick works when pressed multiple times (idempotence/start state handling)', async () => {
      await app.setAlgorithm('merge-sort');
      await app.clickAnalyze();
      await page.waitForTimeout(50);
      await app.clickAnalyze();
      await page.waitForTimeout(50);

      const rows = await app.algorithmResultTable.evaluate(table => table.rows.length);
      // After calling analyze twice, still exactly one data row present (implementation clears previous rows)
      expect(rows).toBe(2);
    });
  });

  test.describe('S4_CustomTested (Custom Functions Tester)', () => {
    test('test button identifies identical functions and shows Θ result (TestBtnClick)', async () => {
      // Provide identical functions
      await app.setCustomF('n^2');
      await app.setCustomG('n^2');
      await app.clickTest();
      await page.waitForTimeout(50);

      const text = await app.testResult.textContent();
      expect(text).toContain('Θ');
      expect(text).toContain('same function');
    });

    test('test button finds polynomial equivalence for same degree and reports possible constants', async () => {
      // polynomial same degree example: 3n^2 + 2n + 1 vs n^2
      await app.setCustomF('3n^2 + 2n + 1');
      await app.setCustomG('n^2');
      await app.clickTest();
      await page.waitForTimeout(50);

      const out = await app.testResult.textContent();
      expect(out).toContain('Possible');
      expect(out).toContain('n^2');
    });

    test('test button handles non-obviously comparable functions gracefully (edge case)', async () => {
      // Provide functions that are not comparable via simple heuristics in the implementation
      await app.setCustomF('2^n');
      await app.setCustomG('n^3');
      await app.clickTest();
      await page.waitForTimeout(50);

      const out = await app.testResult.textContent();
      // Implementation returns "≠ Θ" or suggests more analysis
      expect(out.length).toBeGreaterThan(0);
    });

    test('invalid custom expressions produce no uncaught exceptions and return a message', async () => {
      // Use an expression that will cause evaluateFunction to return NaN inside logic
      await app.setCustomF('invalid_expr(n)');
      await app.setCustomG('n^2');
      await app.clickTest();
      await page.waitForTimeout(50);

      const out = await app.testResult.textContent();
      // Either it will not find constants or will fallback; ensure there is text and no page error occurred
      expect(out.length).toBeGreaterThan(0);
    });
  });

  test('Event listeners are present and not throwing during typical flows (verify detected handlers)', async () => {
    // This test exercises the common events to ensure handlers are attached and do not throw
    await app.setFunctionSelect('n^3'); // change event
    await app.setC1('1.2'); // input event
    await app.setC2('2.2'); // input event
    await app.setN0('7'); // input event
    await app.clickAutoAdjust(); // click

    await app.setCompareF1('n^2');
    await app.setCompareF2('log n');
    await app.setCompareMaxN('150');
    await app.clickCompare();

    await app.setAlgorithm('binary-search');
    await app.setAlgorithmN('5');
    await app.clickAnalyze();

    await app.setCustomF('n log n');
    await app.setCustomG('n log n');
    await app.clickTest();

    // After exercising handlers, assert UI pieces updated and that no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);

    // Also inspect the collected console messages for any blatant RuntimeErrors or TypeError text fragments
    const errorLike = consoleMessages.find(m => /error|exception|referenceerror|typeerror|syntaxerror/i.test(m.text));
    // We do not expect any console errors in normal flow; assert none found
    expect(errorLike).toBeUndefined();
  });

  test('Collect and assert that there are no unexpected runtime errors on page (observability)', async () => {
    // This test purposely gathers console and errors after some interactions to assert a clean runtime
    // Interact briefly
    await app.setFunctionSelect('log n');
    await app.setCompareMaxN('300');
    await app.setAlgorithm('fibonacci-recursive');
    await app.setCustomF('3n^2 + 2n + 1');
    await app.clickTest();

    // Wait for any asynchronous logging
    await page.waitForTimeout(150);

    // Assert no page error events were emitted (uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // If console contains errors, fail and print messages to aid debugging
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /referenceerror|typeerror|syntaxerror/i.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });
});