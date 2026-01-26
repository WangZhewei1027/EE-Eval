import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12153823-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the NP-Completeness Explorer app
class NPExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Main selectors
    this.problemSelect = page.locator('#problemSelect');
    this.loadProblemBtn = page.locator('#loadProblemBtn');
    this.problemInterface = page.locator('#problemInterface');

    this.reductionSource = page.locator('#reductionSource');
    this.reductionTarget = page.locator('#reductionTarget');
    this.reductionInstance = page.locator('#reductionInstance');
    this.performReductionBtn = page.locator('#performReductionBtn');
    this.reductionOutput = page.locator('#reductionOutput');

    this.optProblemSelect = page.locator('#optProblemSelect');
    this.loadOptProblemBtn = page.locator('#loadOptProblemBtn');
    this.optimizationInterface = page.locator('#optimizationInterface');

    this.checkInNPBtn = page.locator('#checkInNPBtn');
    this.checkNPCompleteBtn = page.locator('#checkNPCompleteBtn');
    this.showCookLevinBtn = page.locator('#showCookLevinBtn');
    this.conceptOutput = page.locator('#conceptOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Helpers to select from dropdown by value
  async selectProblem(value) {
    await this.problemSelect.selectOption(value);
  }

  async clickLoadProblem() {
    await this.loadProblemBtn.click();
  }

  async selectReductionSource(value) {
    await this.reductionSource.selectOption(value);
  }

  async selectReductionTarget(value) {
    await this.reductionTarget.selectOption(value);
  }

  async fillReductionInstance(text) {
    await this.reductionInstance.fill(text);
  }

  async clickPerformReduction() {
    await this.performReductionBtn.click();
  }

  async selectOptProblem(value) {
    await this.optProblemSelect.selectOption(value);
  }

  async clickLoadOptProblem() {
    await this.loadOptProblemBtn.click();
  }

  async clickCheckInNP() {
    await this.checkInNPBtn.click();
  }

  async clickCheckNPComplete() {
    await this.checkNPCompleteBtn.click();
  }

  async clickShowCookLevin() {
    await this.showCookLevinBtn.click();
  }
}

test.describe('Interactive NP-Completeness Explorer - FSM and UI tests', () => {
  // Capture console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture only error-level console messages for scrutiny
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally here; individual tests assert errors as appropriate.
  });

  test.describe('S0_Idle: Initial page / Idle state validations', () => {
    test('Initial state: Load Problem button is disabled and problem select exists', async ({ page }) => {
      const app = new NPExplorerPage(page);
      // Load page
      await app.goto();

      // Verify problemSelect exists and contains expected default option
      await expect(app.problemSelect).toBeVisible();
      await expect(app.problemSelect).toHaveValue('');

      // According to FSM S0_Idle: loadProblemBtn should be disabled on entry
      await expect(app.loadProblemBtn).toBeDisabled();

      // problemInterface should initially be empty (no child elements)
      const piContent = await app.problemInterface.innerHTML();
      // Allow whitespace but expect it to be an empty string or very small
      expect(piContent.trim().length).toBeLessThan(20);

      // Capture that there are no uncaught page errors during initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_ProblemLoaded: selecting and loading a problem', () => {
    test('Selecting an entry enables Load Problem button; clicking loads SAT interface and enables concept buttons', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Select SAT problem
      await app.selectProblem('sat');

      // After change, loadProblemBtn should become enabled per event handler
      await expect(app.loadProblemBtn).toBeEnabled();

      // Click to load
      await app.clickLoadProblem();

      // After loading, the problemInterface should contain a textarea and a SAT run button
      const satTextarea = app.problemInterface.locator('textarea');
      const satButton = app.problemInterface.locator('button', { hasText: 'Run Simple SAT Check' });
      await expect(satTextarea).toBeVisible();
      await expect(satButton).toBeVisible();

      // Concept buttons should be enabled after loading a supported problem
      await expect(app.checkInNPBtn).toBeEnabled();
      await expect(app.checkNPCompleteBtn).toBeEnabled();
      await expect(app.showCookLevinBtn).toBeEnabled();

      // No uncaught page errors expected when loading a supported interface
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: clicking Load Problem with no selection does nothing (button remains disabled)', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Ensure default (no selection)
      await expect(app.problemSelect).toHaveValue('');
      await expect(app.loadProblemBtn).toBeDisabled();

      // Attempt to click (should be a no-op; Playwright will throw if clicking disabled, so assert disabled)
      let errorThrown = false;
      try {
        await app.loadProblemBtn.click({ timeout: 1000 });
      } catch (e) {
        errorThrown = true;
      }
      expect(errorThrown).toBeTruthy();

      // No page errors should have been recorded
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S2_ReductionInput: reductions UI and actions', () => {
    test('Reduction button enabling logic: enable only when source, target differ and instance non-empty', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Initially performReductionBtn disabled
      await expect(app.performReductionBtn).toBeDisabled();

      // Fill in source and target equal -> still disabled even if instance filled
      await app.selectReductionSource('sat');
      await app.selectReductionTarget('sat');
      await app.fillReductionInstance('dummy instance');
      // performReductionBtn should be disabled because source === target
      await expect(app.performReductionBtn).toBeDisabled();

      // Now make target different
      await app.selectReductionTarget('clique');
      // Now all conditions true -> button enabled
      await expect(app.performReductionBtn).toBeEnabled();

      // Clear instance -> should become disabled
      await app.fillReductionInstance('');
      await expect(app.performReductionBtn).toBeDisabled();

      // Refill instance and ensure it enables
      await app.fillReductionInstance('some instance text');
      await expect(app.performReductionBtn).toBeEnabled();

      // Check no page errors produced by manipulating reduction inputs
      expect(pageErrors.length).toBe(0);
    });

    test('Perform supported reduction: 3-SAT -> Vertex Cover produces reduction output with vertex count and k', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Prepare valid 3-SAT instance (two clauses)
      const threeSat = `(x1 | ~x2 | x3)
(x2 | x3 | x1)`;

      await app.selectReductionSource('3sat');
      await app.selectReductionTarget('vertex_cover');
      await app.fillReductionInstance(threeSat);

      // Button should be enabled
      await expect(app.performReductionBtn).toBeEnabled();

      // Click perform reduction
      await app.clickPerformReduction();

      // Reduction output should mention 'Reduction output for vertex_cover' and include numeric content
      await expect(app.reductionOutput).toContainText('Reduction output for vertex_cover');

      // The result should be formatted as lines starting with total vertices and then k
      const outText = (await app.reductionOutput.innerText()).trim();
      const lines = outText.split('\n').map(l => l.trim()).filter(Boolean);
      // First non 'Performing reduction...' line may be 'Reduction output...' so check subsequent lines include a number and k
      expect(outText.includes('Reduction output for vertex_cover')).toBeTruthy();
      // There should be at least one numeric line for total vertices and a line for k
      const numericLineMatch = outText.match(/^\d+/m);
      expect(numericLineMatch).not.toBeNull();

      // No page errors expected during reduction
      expect(pageErrors.length).toBe(0);
    });

    test('Perform unsupported reduction returns "Reduction not supported for this pair."', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Choose a pair not implemented by performClassicReduction: sat -> clique is not explicitly implemented
      await app.selectReductionSource('sat');
      await app.selectReductionTarget('clique');
      await app.fillReductionInstance('(x1 | x2)');

      await expect(app.performReductionBtn).toBeEnabled();

      await app.clickPerformReduction();

      // The code sets reductionOutput.innerText = 'Reduction not supported for this pair.' when null
      await expect(app.reductionOutput).toContainText('Reduction not supported for this pair.');

      // No uncaught page errors should be present
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: reduction with same source and target leaves Perform Reduction disabled', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      await app.selectReductionSource('vertex_cover');
      await app.selectReductionTarget('vertex_cover');
      await app.fillReductionInstance('5\n2\n1 2');

      // Button must be disabled because source === target
      await expect(app.performReductionBtn).toBeDisabled();

      // Clicking will fail; assert disabled prevents clicking
      let thrown = false;
      try {
        await app.performReductionBtn.click({ timeout: 1000 });
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toBeTruthy();
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S3_ConceptExploration: concept buttons and outputs', () => {
    test('Check "In NP" and NP-Completeness outline show expected explanations for loaded problem', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Load SAT to enable concept buttons
      await app.selectProblem('sat');
      await app.clickLoadProblem();

      // Click Check In NP
      await app.clickCheckInNP();
      await expect(app.conceptOutput).toContainText('SAT and 3-SAT are in NP');

      // Click NP-Completeness proof outline
      await app.clickCheckNPComplete();
      await expect(app.conceptOutput).toContainText('SAT was the first problem shown NP-Complete');

      // Click Cook-Levin - shows theorem summary
      await app.clickShowCookLevin();
      await expect(app.conceptOutput).toContainText('Cook-Levin Theorem (1971)');

      // No page errors during concept exploration
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: concept buttons disabled prior to loading any problem', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Ensure concept buttons are disabled on initial page load
      await expect(app.checkInNPBtn).toBeDisabled();
      await expect(app.checkNPCompleteBtn).toBeDisabled();
      await expect(app.showCookLevinBtn).toBeDisabled();

      // Attempt to click a disabled concept button should throw
      let thrown = false;
      try {
        await app.checkInNPBtn.click({ timeout: 1000 });
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toBeTruthy();

      // No page errors produced
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Optimization interfaces and behaviors', () => {
    test('Optimization loader enables and loads Vertex Cover optimization and returns a result for small graph', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Select Vertex Cover for optimization
      await app.selectOptProblem('vertex_cover');

      // loadOptProblemBtn should be enabled after selection
      await expect(app.loadOptProblemBtn).toBeEnabled();

      // Click to load optimization interface
      await app.clickLoadOptProblem();

      // The optimizationInterface should now contain a textarea and a solve button for minimum vertex cover
      const solveBtn = app.optimizationInterface.locator('button', { hasText: 'Find Minimum Vertex Cover' });
      const optTextarea = app.optimizationInterface.locator('textarea');
      await expect(solveBtn).toBeVisible();
      await expect(optTextarea).toBeVisible();

      // Fill a simple graph and run solver
      const graphInput = `5
1 2
1 3
2 4
3 5`;
      await optTextarea.fill(graphInput);
      await solveBtn.click();

      // Expect the optimization result to mention 'Minimum vertex cover size'
      await expect(app.optimizationInterface).toContainText('Minimum vertex cover size');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });

    test('Optimization edge case: loading optimization with no selection keeps button disabled', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      await expect(app.loadOptProblemBtn).toBeDisabled();

      // Attempt click fails
      let thrown = false;
      try {
        await app.loadOptProblemBtn.click({ timeout: 1000 });
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Robustness: parsing and solver edge cases', () => {
    test('SAT interface: parse error is surfaced to user for invalid variable names', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Load SAT interface
      await app.selectProblem('sat');
      await app.clickLoadProblem();

      // Find the textarea and the run button inside problemInterface
      const satTextarea = app.problemInterface.locator('textarea');
      const satBtn = app.problemInterface.locator('button', { hasText: 'Run Simple SAT Check' });
      const resultPre = app.problemInterface.locator('pre');

      await satTextarea.fill(`(y1 | x2)`);
      await satBtn.click();

      // The parser expects variables like x1; y1 is invalid and should produce a parse error message
      await expect(resultPre).toContainText('Parse error');

      // No page errors recorded (parse errors are handled and displayed in UI)
      expect(pageErrors.length).toBe(0);
    });

    test('Subset Sum dynamic programming: returns YES for solvable instance and NO for unsolvable', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Load subset sum interface
      await app.selectProblem('subset_sum');
      await app.clickLoadProblem();

      const arrInput = app.problemInterface.locator('input[type="text"]');
      const targetInput = app.problemInterface.locator('input[type="number"]');
      const checkBtn = app.problemInterface.locator('button', { hasText: 'Check Subset Sum' });
      const resultPre = app.problemInterface.locator('pre');

      // Test solvable
      await arrInput.fill('3 34 4 12 5 2');
      await targetInput.fill('9');
      await checkBtn.click();
      await expect(resultPre).toContainText('YES, subset sums to target');

      // Test unsolvable by changing target
      await targetInput.fill('1000');
      await checkBtn.click();
      await expect(resultPre).toContainText('NO subset sums to target');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and page error observations', () => {
    test('No uncaught runtime errors or severe console errors should appear during typical interactions', async ({ page }) => {
      const app = new NPExplorerPage(page);
      await app.goto();

      // Run a sequence of typical interactions
      await app.selectProblem('3sat');
      await app.clickLoadProblem();
      await app.selectReductionSource('3sat');
      await app.selectReductionTarget('vertex_cover');
      await app.fillReductionInstance(`(x1 | x2 | x3)
(x1 | ~x2 | x3)`);
      await app.clickPerformReduction();

      await app.selectOptProblem('knapsack');
      await app.clickLoadOptProblem();

      // Allow some time for any async console errors to surface
      await page.waitForTimeout(300);

      // Inspect captured console messages for error types
      const severeConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      // Assert that there were no pageerror events (uncaught exceptions)
      expect(pageErrors.length).toBe(0);

      // If severe console messages exist, fail the test and print them
      if (severeConsoleMessages.length > 0) {
        // Fail with details
        const texts = severeConsoleMessages.map(s => `${s.type}: ${s.text}`).join('\n');
        throw new Error('Severe console messages were logged:\n' + texts);
      }
    });
  });
});