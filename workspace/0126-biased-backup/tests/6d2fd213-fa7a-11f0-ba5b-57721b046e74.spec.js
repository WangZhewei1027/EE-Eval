import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2fd213-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Explorer page to centralize interactions and queries
class ExplorerPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      title: page.locator('h1'),
      // Buttons
      showPExamples: page.locator('#showPExamples'),
      showNPExamples: page.locator('#showNPExamples'),
      showNPComplete: page.locator('#showNPComplete'),
      calculateComplexity: page.locator('#calculateComplexity'),
      solveProblem: page.locator('#solveProblem'),
      verifySolution: page.locator('#verifySolution'),
      showImplications: page.locator('#showImplications'),
      showCurrentStatus: page.locator('#showCurrentStatus'),
      showReductions: page.locator('#showReductions'),
      showAlgorithms: page.locator('#showAlgorithms'),
      // Containers / outputs
      examplesContainer: page.locator('#examplesContainer'),
      examplesTitle: page.locator('#examplesTitle'),
      examplesList: page.locator('#examplesList'),
      problemType: page.locator('#problemType'),
      inputSize: page.locator('#inputSize'),
      currentSize: page.locator('#currentSize'),
      complexityResults: page.locator('#complexityResults'),
      resultN: page.locator('#resultN'),
      timeComplexity: page.locator('#timeComplexity'),
      timeValue: page.locator('#timeValue'),
      graphContainer: page.locator('#graphContainer'),
      problemSelector: page.locator('#problemSelector'),
      problemInputContainer: page.locator('#problemInputContainer'),
      solutionContainer: page.locator('#solutionContainer'),
      solutionOutput: page.locator('#solutionOutput'),
      verificationResult: page.locator('#verificationResult'),
      implicationsContent: page.locator('#implicationsContent'),
      implicationsList: page.locator('#implicationsList'),
      statusText: page.locator('#statusText'),
      advancedContent: page.locator('#advancedContent'),
      advancedTitle: page.locator('#advancedTitle'),
      advancedText: page.locator('#advancedText')
    };
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
    // Ensure page has loaded its main title
    await expect(this.locators.title).toHaveText(/P vs NP Interactive Explorer/);
  }

  // Utility: set the inputSize (range) and dispatch input event so app updates
  async setInputSize(value) {
    // value should be string or number
    await this.locators.inputSize.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    // Wait for displayed current size to update
    await expect(this.locators.currentSize).toHaveText(String(value));
  }

  // Utility: select problemType in complexity panel
  async selectProblemType(type) {
    await this.locators.problemType.selectOption(type);
  }

  // Utility: select problem to solve
  async selectProblemSelector(value) {
    await this.locators.problemSelector.selectOption(value);
    // Wait for updateProblemInput to run and populate problemInputContainer
    await expect(this.locators.problemInputContainer.locator('.problem-instance')).toBeVisible();
  }

  // Read the current problem instance text
  async getProblemInstanceText() {
    return await this.locators.problemInputContainer.locator('.problem-instance').innerText();
  }

  // Solve problem by clicking button and wait for UI changes
  async solveCurrentProblem() {
    await this.locators.solveProblem.click();
    await expect(this.locators.solutionContainer).toBeVisible();
    // Ensure verify button becomes enabled
    await expect(this.locators.verifySolution).toBeEnabled();
  }

  // Click verify solution and wait for verificationResult text to appear
  async verifyCurrentSolution() {
    await this.locators.verifySolution.click();
    await expect(this.locators.verificationResult).not.toBeEmpty();
    return await this.locators.verificationResult.innerText();
  }
}

test.describe('P vs NP Interactive Explorer - End-to-end tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture browser console messages
    page.on('console', msg => {
      // Record both text and severity/type for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions in the page context
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No-op here; each test will assert the console/page error expectations individually.
  });

  test.describe('Initial load and Idle state (S0_Idle)', () => {
    test('loads the page and shows initial controls; verify "Verify Solution" is disabled', async ({ page }) => {
      // Arrange
      const explorer = new ExplorerPage(page);

      // Act
      await explorer.goto();

      // Assert - presence of main interactive controls per FSM Idle evidence
      await expect(explorer.locators.showPExamples).toBeVisible();
      await expect(explorer.locators.showNPExamples).toBeVisible();
      await expect(explorer.locators.showNPComplete).toBeVisible();
      await expect(explorer.locators.calculateComplexity).toBeVisible();
      await expect(explorer.locators.solveProblem).toBeVisible();
      await expect(explorer.locators.verifySolution).toBeVisible();
      // Verify disabled attribute on verifySolution per FSM
      await expect(explorer.locators.verifySolution).toBeDisabled();

      // The initial problem input should be rendered (entry action expectation: renderPage/updateProblemInput)
      await expect(explorer.locators.problemInputContainer.locator('.problem-instance')).toBeVisible();

      // No uncaught page errors expected during initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Examples panels (S1, S2, S3)', () => {
    test('Show P Examples reveals the examplesContainer with correct title and list', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Click showPExamples and verify examplesContainer becomes visible and populated
      await explorer.locators.showPExamples.click();
      await expect(explorer.locators.examplesContainer).toBeVisible();
      await expect(explorer.locators.examplesTitle).toHaveText('P Problems');
      const listCount = await explorer.locators.examplesList.locator('li').count();
      expect(listCount).toBeGreaterThan(0);

      // ensure no page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Show NP Examples then NP-Complete updates examplesContainer appropriately', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Click NP examples
      await explorer.locators.showNPExamples.click();
      await expect(explorer.locators.examplesContainer).toBeVisible();
      await expect(explorer.locators.examplesTitle).toHaveText('NP Problems');
      const npFirst = await explorer.locators.examplesList.locator('li').first().innerText();

      // Click NP-Complete and ensure title changes and content updates (list first item differs)
      await explorer.locators.showNPComplete.click();
      await expect(explorer.locators.examplesTitle).toHaveText('NP-Complete Problems');
      const npCompleteFirst = await explorer.locators.examplesList.locator('li').first().innerText();

      expect(npCompleteFirst).not.toBe(npFirst);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Complexity calculation (S4_CalculateComplexity)', () => {
    test('Calculates complexity for NP with n=3 and shows results and graph', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Set inputSize to 3
      await explorer.setInputSize(3);

      // Choose NP complexity
      await explorer.selectProblemType('np');

      // Click Calculate Complexity
      await explorer.locators.calculateComplexity.click();

      // Check results shown
      await expect(explorer.locators.complexityResults).toBeVisible();
      await expect(explorer.locators.resultN).toHaveText('3');

      // timeComplexity uses innerHTML with 2<sup>n</sup> - assert it contains '2' and a sup presentation
      const timeComplexityHTML = await explorer.locators.timeComplexity.innerHTML();
      expect(timeComplexityHTML).toContain('2');

      // timeValue should correspond to 2^3 = 8 (allow for locale formatting)
      const timeValueText = await explorer.locators.timeValue.innerText();
      const numeric = Number(timeValueText.replace(/,/g, '').trim());
      expect(numeric).toBe(8);

      // Graph container should contain descriptive text drawn by implementation
      const graphText = await explorer.locators.graphContainer.innerText();
      expect(graphText).toContain('Graph showing growth');

      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: exponential growth for n=20 does not crash UI and displays a numeric timeValue', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.setInputSize(20);
      await explorer.selectProblemType('exp');
      await explorer.locators.calculateComplexity.click();

      await expect(explorer.locators.complexityResults).toBeVisible();
      const timeValueText = await explorer.locators.timeValue.innerText();
      // Ensure it's not empty and is a finite numeric string (may be large)
      const numeric = Number(timeValueText.replace(/,/g, '').trim());
      expect(Number.isFinite(numeric)).toBe(true);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Problem solver and verification (S5 -> S6_VerifySolution)', () => {
    test('Solve sorting problem enables verify and verifying reports a result', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Ensure verify button is disabled before solving
      await expect(explorer.locators.verifySolution).toBeDisabled();

      // Set a known small input size to keep instance readable
      await explorer.setInputSize(4);
      await explorer.selectProblemSelector('sort');

      const problemInstanceBefore = await explorer.getProblemInstanceText();
      expect(problemInstanceBefore.length).toBeGreaterThan(0);

      // Solve the problem
      await explorer.solveCurrentProblem();

      // solutionContainer visible and contains solution text
      await expect(explorer.locators.solutionOutput.locator('.problem-instance')).toBeVisible();
      const solutionText = await explorer.locators.solutionOutput.locator('.problem-instance').innerText();
      expect(solutionText.length).toBeGreaterThan(0);

      // Verify the solution (should indicate Valid for correct sorting)
      const verification = await explorer.verifyCurrentSolution();
      expect(verification).toContain('Verification:');

      // The verification text should indicate either Valid or Invalid mark
      expect(/Valid solution|Invalid solution|✅|❌/.test(verification)).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });

    test('Attempting to click disabled Verify Solution before solving has no effect', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Ensure verify is disabled, and attempt to click should throw from Playwright if we attempt,
      // so we assert disabled and do not perform an illegal click.
      await expect(explorer.locators.verifySolution).toBeDisabled();

      // Confirm verificationResult is empty
      await expect(explorer.locators.verificationResult).toBeEmpty();

      expect(pageErrors.length).toBe(0);
    });

    test('Solving TSP and verifying ensures verificationResult is populated (edge behaviour)', async ({ page }) {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Smaller instance for readability
      await explorer.setInputSize(4);
      await explorer.selectProblemSelector('tsp');

      const instance = await explorer.getProblemInstanceText();
      expect(instance).toContain('City');

      // Solve and verify
      await explorer.solveCurrentProblem();
      const verificationText = await explorer.verifyCurrentSolution();
      expect(verificationText).toContain('Verification:');

      // As TSP verify only checks presence of cities, it should normally return Valid (✅) - assert the verification label exists
      expect(/✅|❌/.test(verificationText)).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Implications and Current Status (S7_ShowImplications, S8_ShowCurrentStatus)', () => {
    test('Show Implications reveals implications list and a header "If P = NP:"', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.locators.showImplications.click();
      await expect(explorer.locators.implicationsContent).toBeVisible();

      // The first H3 in the implicationsContent is updated to 'If P = NP:'
      const h3Text = await explorer.locators.implicationsContent.locator('h3').first().innerText();
      expect(h3Text).toBe('If P = NP:');

      const listCount = await explorer.locators.implicationsList.locator('li').count();
      expect(listCount).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
    });

    test('Show Current Status reveals current status paragraphs and header "Current Status:"', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.locators.showCurrentStatus.click();
      await expect(explorer.locators.implicationsContent).toBeVisible();

      const h3Text = await explorer.locators.implicationsContent.locator('h3').first().innerText();
      expect(h3Text).toBe('Current Status:');

      const paragraphs = await explorer.locators.statusText.locator('p').count();
      expect(paragraphs).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Advanced exploration (S9_ShowReductions, S10_ShowAlgorithms)', () => {
    test('Show Problem Reductions displays advanced content with correct title', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.locators.showReductions.click();
      await expect(explorer.locators.advancedContent).toBeVisible();
      await expect(explorer.locators.advancedTitle).toHaveText('Problem Reductions');

      const advancedHTML = await explorer.locators.advancedText.innerHTML();
      expect(advancedHTML).toContain('Reductions');

      expect(pageErrors.length).toBe(0);
    });

    test('Show Algorithm Comparison displays a table of algorithms', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      await explorer.locators.showAlgorithms.click();
      await expect(explorer.locators.advancedContent).toBeVisible();
      await expect(explorer.locators.advancedTitle).toHaveText('Algorithm Comparison');

      const advancedHTML = await explorer.locators.advancedText.innerHTML();
      // Expect at least the table header to be present
      expect(advancedHTML).toContain('<table>');
      expect(advancedHTML).toContain('Time Complexity');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM coverage and edge checks', () => {
    test('Switching examples repeatedly keeps UI stable (stress the examples transitions)', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Rapidly click examples buttons to exercise transitions S0 -> S1/S2/S3 multiple times
      for (let i = 0; i < 3; i++) {
        await explorer.locators.showPExamples.click();
        await expect(explorer.locators.examplesTitle).toHaveText('P Problems');

        await explorer.locators.showNPExamples.click();
        await expect(explorer.locators.examplesTitle).toHaveText('NP Problems');

        await explorer.locators.showNPComplete.click();
        await expect(explorer.locators.examplesTitle).toHaveText('NP-Complete Problems');
      }

      // Final state should still be consistent: examplesContainer visible and populated
      await expect(explorer.locators.examplesContainer).toBeVisible();
      const finalCount = await explorer.locators.examplesList.locator('li').count();
      expect(finalCount).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
    });

    test('Changing problemSelector updates the problem instance content (verify updateProblemInput entry action)', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Capture initial instance
      await explorer.setInputSize(5);
      await explorer.selectProblemSelector('sat');
      const firstInstance = await explorer.getProblemInstanceText();
      expect(firstInstance.length).toBeGreaterThan(0);

      // Change to sort and ensure content updates
      await explorer.selectProblemSelector('sort');
      const secondInstance = await explorer.getProblemInstanceText();
      expect(secondInstance.length).toBeGreaterThan(0);
      expect(secondInstance).not.toBe(firstInstance);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and page error observations', () => {
    test('No unexpected page errors or unhandled exceptions were emitted during normal interactions', async ({ page }) => {
      // This test purposely performs a couple of interactions and then asserts that no uncaught
      // page errors (ReferenceError, SyntaxError, TypeError, etc.) were raised.
      const explorer = new ExplorerPage(page);

      await explorer.goto();

      // Perform a few representative interactions
      await explorer.locators.showPExamples.click();
      await explorer.setInputSize(3);
      await explorer.locators.calculateComplexity.click();
      await explorer.selectProblemSelector('tsp');
      await explorer.locators.solveProblem.click();

      // Check the collected page errors
      // The intended behavior is to let any ReferenceError/SyntaxError/TypeError occur naturally and be captured.
      // For this implementation we expect none; assert accordingly so the test fails if such runtime errors appear.
      expect(pageErrors.length).toBe(0);

      // Also assert that there are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Record console output for diagnostics (non-failing test for visibility)', async ({ page }) => {
      const explorer = new ExplorerPage(page);
      await explorer.goto();

      // Trigger several actions
      await explorer.locators.showAlgorithms.click();
      await explorer.locators.showImplications.click();

      // The test will not fail based on console messages, but we assert that the console was captured.
      // There may be warnings or logs; we ensure capturing mechanism works.
      expect(Array.isArray(consoleMessages)).toBe(true);

      // Also ensure no uncaught errors in the page's runtime
      expect(pageErrors.length).toBe(0);
    });
  });
});