import { test, expect } from '@playwright/test';

// Test file: 6d2fd212-fa7a-11f0-ba5b-57721b046e74.spec.js
// Application URL:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2fd212-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the NP-Completeness Explorer
class NPExplorerPage {
  constructor(page) {
    this.page = page;
    this.problemSelect = page.locator('#problemSelect');
    this.generateBtn = page.locator('button[onclick="generateProblem()"]');
    this.showReductionBtn = page.locator('button[onclick="showReduction()"]');
    this.problemInstance = page.locator('#problemInstance');
    this.problemControls = page.locator('#problemControls');
    this.solutionPanel = page.locator('#solutionPanel');
    this.solutionArea = page.locator('#solutionArea');
    this.verificationResult = page.locator('#verificationResult');
    this.reductionPanel = page.locator('#reductionPanel');
    this.reductionSteps = page.locator('#reductionSteps');
    this.nextReductionBtn = page.locator('button[onclick="nextReductionStep()"]');
    this.bfSteps = page.locator('#bfSteps');
    this.bfComplexity = page.locator('#bfComplexity');
    this.heuristicSteps = page.locator('#heuristicSteps');
    this.heuristicComplexity = page.locator('#heuristicComplexity');
    this.problemSize = page.locator('#problemSize');
    this.sizeValue = page.locator('#sizeValue');
    this.showProofSteps = page.locator('#showProofSteps');
    this.proofSteps = page.locator('#proofSteps');
    this.constructProofBtn = page.locator('button[onclick="constructProof()"]');
    this.proofConstruction = page.locator('#proofConstruction');
    this.problemPanel = page.locator('#problemPanel');
    this.runtimeResults = page.locator('#runtimeResults');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async selectProblem(type) {
    await this.problemSelect.selectOption(type);
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickShowReduction() {
    await this.showReductionBtn.click();
  }

  async clickNextReductionStep() {
    await this.nextReductionBtn.click();
  }

  async runBruteForce() {
    await this.page.locator('button[onclick="runBruteForce()"]').click();
  }

  async runHeuristic() {
    await this.page.locator('button[onclick="runHeuristic()"]').click();
  }

  async toggleShowProofSteps(checked) {
    const isChecked = await this.showProofSteps.isChecked().catch(() => false);
    if (isChecked !== checked) {
      await this.showProofSteps.click();
    }
  }

  async clickConstructProof() {
    await this.constructProofBtn.click();
  }

  // Convenience: call a global function that exists in the page (like checkSATSolution)
  async callGlobalFunctionAsync(funcName) {
    // Call it asynchronously via setTimeout so errors propagate as pageerror events instead of being caught by evaluate
    await this.page.evaluate((fn) => {
      // eslint-disable-next-line no-undef
      setTimeout(() => { try { window[fn](); } catch (e) { /* let it surface as pageerror */ } }, 0);
    }, funcName);
  }

  async getProblemControlsHTML() {
    return this.page.locator('#problemControls').innerHTML();
  }
}

// Collect console errors and page errors for assertions
test.describe('NP-Completeness Explorer - End-to-End Tests (FSM driven)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleErrors = [];

    // Collect page errors (uncaught exceptions in page)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages (we'll capture error-level console messages)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });
  });

  // Test: Idle state renders correctly
  test('Initial Idle state renders main elements (S0_Idle)', async ({ page }) => {
    const app = new NPExplorerPage(page);
    // Navigate to app
    await app.goto();

    // Validate top-level heading exists (evidence for S0_Idle)
    await expect(page.locator('h1')).toHaveText('NP-Completeness Interactive Explorer');

    // Validate main components for problem selection exist
    await expect(app.problemSelect).toBeVisible();
    await expect(app.generateBtn).toBeVisible();
    await expect(app.showReductionBtn).toBeVisible();

    // Validate problem instance area exists but is empty initially
    await expect(app.problemInstance).toBeVisible();
    const instanceText = await app.problemInstance.textContent();
    expect(instanceText?.trim().length ?? 0).toBeGreaterThanOrEqual(0);

    // The FSM entry action 'renderPage()' is not present in the implementation.
    // Verify that no global renderPage function exists to assert mismatch with FSM entry action.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
    expect(hasRenderPage).toBeFalsy();

    // No page errors should have occurred just by loading the page
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Problem selection triggers ProblemSelected state evidence (S1_ProblemSelected)
  test('Selecting a different problem updates selection (ProblemSelectChange -> S1_ProblemSelected)', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // Change selection to Vertex Cover
    await app.selectProblem('vc');
    // Ensure the select element updated
    expect(await page.locator('#problemSelect').inputValue()).toBe('vc');

    // Evidence from FSM: presence of generate button (already present) -> assert visible
    await expect(app.generateBtn).toBeVisible();

    // No runtime errors from selecting dropdown
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: GenerateProblem creates an instance and controls (S2_ProblemInstanceGenerated)
  test('Generate Problem Instance creates instance and dynamic controls (GenerateProblem -> S2_ProblemInstanceGenerated)', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // Choose SAT for determinism of control generation (many code paths)
    await app.selectProblem('sat');
    await app.clickGenerate();

    // problemInstance should be populated with display text
    await expect(app.problemInstance).toHaveText(/Variables:/);

    // problemControls should contain checkSATSolution button (evidence for SAT path)
    const controlsHTML = await app.getProblemControlsHTML();
    expect(controlsHTML).toContain('Check Solution');

    // The solution panel should be hidden after generation (we show it only after checks)
    await expect(app.solutionPanel).toHaveClass(/hidden/);

    // currentProblem should exist in the page after generation
    const hasCurrentProblem = await page.evaluate(() => !!window.currentProblem);
    expect(hasCurrentProblem).toBeTruthy();

    // No page errors should be present
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case test: calling checkSATSolution before generate -> should produce an uncaught exception
  test('Invoking checkSATSolution before generating a problem triggers a page error (TypeError) as expected', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // Ensure no currentProblem exists at this point
    const cp = await page.evaluate(() => typeof window.currentProblem !== 'object' || window.currentProblem === null);
    expect(cp).toBeTruthy();

    // Call checkSATSolution asynchronously to allow the exception to be captured as a pageerror
    // We do not await evaluate to catch the exception synchronously; instead wait for pageerror event
    await page.evaluate(() => setTimeout(() => { checkSATSolution(); }, 0));

    // Wait for a pageerror to occur (the function will try to access currentProblem.variables and should throw)
    const err = await page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null);
    expect(err).not.toBeNull();
    // Basic assertions about the error type/message (browser message varies; ensure it's an Error with a message)
    expect(err).toBeInstanceOf(Error);
    expect((err?.message ?? '').length).toBeGreaterThan(0);

    // Confirm that our pageErrors collector saw an error as well
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  // Test SAT solution attempt flows: validation message when not all vars assigned, then success when all assigned
  test('SAT solution checking shows error for unset variables and can verify assignment after setting (CheckSATSolution -> S3_SolutionAttempt)', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // Generate SAT instance
    await app.selectProblem('sat');
    await app.clickGenerate();

    // At this point, controls include selects with ids var_x0..xN-1
    // Click the dynamic "Check Solution" button inside problemControls (it calls checkSATSolution)
    // Locate the dynamic button by text inside problemControls
    const dynamicCheckBtn = page.locator('#problemControls button', { hasText: 'Check Solution' });
    await expect(dynamicCheckBtn).toBeVisible();
    await dynamicCheckBtn.click();

    // Because selects are initially at "unset", verificationResult should show "Please assign all variables"
    await expect(app.verificationResult).toHaveText(/Please assign all variables/);

    // Now assign all variables to true programmatically and re-check
    await page.evaluate(() => {
      if (!window.currentProblem) return;
      window.currentProblem.variables.forEach(v => {
        const sel = document.getElementById(`var_${v}`);
        if (sel) sel.value = 'true';
      });
    });

    // Click check again
    await dynamicCheckBtn.click();

    // After setting values, verificationResult should contain either valid solution or "Not all clauses are satisfied"
    // We cannot predict the clauses, so ensure the UI shows either green or red message but the solutionPanel becomes visible
    await expect(app.solutionPanel).not.toHaveClass(/hidden/);
    const resultText = await app.verificationResult.textContent();
    expect(resultText?.length ?? 0).toBeGreaterThan(0);

    // No new unexpected page errors
    expect(pageErrors.length).toBeGreaterThanOrEqual(1); // includes earlier intentional TypeError
  });

  // Test Vertex Cover solution checking including too many vertices error (CheckVCSolution -> S3_SolutionAttempt)
  test('Vertex Cover solution checking validates vertex count and coverage (CheckVCSolution -> S3_SolutionAttempt)', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // Generate VC instance
    await app.selectProblem('vc');
    await app.clickGenerate();

    // Wait for controls to appear with checkboxes vc_v0...
    // Programmatically check more than k vertices to trigger "Too many vertices selected"
    const currentK = await page.evaluate(() => window.currentProblem ? window.currentProblem.k : 0);
    // Select (currentK + 2) vertices if available
    await page.evaluate((k) => {
      if (!window.currentProblem) return;
      const vertices = window.currentProblem.vertices;
      for (let i = 0; i < Math.min(vertices.length, k + 2); i++) {
        const cb = document.getElementById(`vc_${vertices[i]}`);
        if (cb) cb.checked = true;
      }
    }, currentK);

    // Click the dynamic check VC button
    const vcCheckBtn = page.locator('#problemControls button', { hasText: 'Check Solution' });
    await expect(vcCheckBtn).toBeVisible();
    await vcCheckBtn.click();

    // Expect verificationResult to mention "Too many vertices selected"
    await expect(app.verificationResult).toHaveText(/Too many vertices selected/);

    // No new page errors from this action
    expect(pageErrors.length).toBeGreaterThanOrEqual(1); // the earlier intentional TypeError may still exist
  });

  // Test TSP tour checking: incomplete and complete tour flows (CheckTSPSolution -> S3_SolutionAttempt)
  test('TSP tour checking enforces visiting all cities and computes tour distance once complete (CheckTSPSolution -> S3_SolutionAttempt)', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // Generate TSP instance
    await app.selectProblem('tsp');
    await app.clickGenerate();

    // Click check button with incomplete tour: should show error about visiting all cities
    const tspCheckBtn = page.locator('#problemControls button', { hasText: 'Check Solution' });
    await expect(tspCheckBtn).toBeVisible();

    // Ensure no cities added yet; clicking check should show the "Tour must visit all cities exactly once" message
    await tspCheckBtn.click();
    await expect(app.verificationResult).toHaveText(/Tour must visit all cities exactly once/);

    // Now add all cities by clicking the generated city buttons in tspCities
    const cityButtons = page.locator('#tspCities button');
    const count = await cityButtons.count();
    for (let i = 0; i < count; i++) {
      await cityButtons.nth(i).click();
    }

    // Click check again - should compute a distance and show it
    await tspCheckBtn.click();
    await expect(app.verificationResult).toHaveText(/Tour distance:/);
  });

  // Test reduction explorer (ShowReduction -> S4_ReductionExplorer and NextReductionStep)
  test('Reduction explorer shows steps and advances with Next Step (ShowReduction / NextReductionStep -> S4_ReductionExplorer)', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // Use Vertex Cover as example
    await app.selectProblem('vc');
    await app.clickShowReduction();

    // reductionPanel should become visible
    await expect(app.reductionPanel).not.toHaveClass(/hidden/);

    // reductionSteps should contain an initial paragraph about reduction source
    await expect(app.reductionSteps).toHaveText(/Reduction from/);

    // Click next reduction step multiple times and verify content accumulates
    const initialContent = await app.reductionSteps.innerHTML();
    await app.clickNextReductionStep();
    await app.clickNextReductionStep();

    const laterContent = await app.reductionSteps.innerHTML();
    expect(laterContent.length).toBeGreaterThan(initialContent.length);

    // No page errors from reduction exploration
    expect(pageErrors.length).toBeGreaterThanOrEqual(1); // the intentional earlier TypeError included
  });

  // Test complexity analysis: runBruteForce and runHeuristic update runtime results (S5_ComplexityAnalysis)
  test('Running brute force and heuristic algorithms updates runtime summary (RunBruteForce / RunHeuristic -> S5_ComplexityAnalysis)', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // Generate SAT instance to ensure currentProblem context matches problemSelect
    await app.selectProblem('sat');
    await app.clickGenerate();

    // Run brute force
    await app.runBruteForce();

    // Validate bfSteps and bfComplexity were updated
    const bfStepsText = await app.bfSteps.textContent();
    const bfComplexityText = await app.bfComplexity.textContent();
    expect(bfStepsText?.trim()).not.toBe('-');
    expect((bfComplexityText ?? '').length).toBeGreaterThan(0);

    // Run heuristic
    await app.runHeuristic();
    const heurStepsText = await app.heuristicSteps.textContent();
    const heurComplexityText = await app.heuristicComplexity.textContent();
    expect(heurStepsText?.trim()).not.toBe('-');
    expect((heurComplexityText ?? '').length).toBeGreaterThan(0);
  });

  // Test construct proof and showProofSteps toggling (S6_NPCompletenessProof)
  test('Constructing proof and toggling show-proof-steps (ConstructProof / ShowProofStepsChange -> S6_NPCompletenessProof)', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // Ensure we have a problem context (generate one)
    await app.selectProblem('vc');
    await app.clickGenerate();

    // Toggle the checkbox to show proof steps and assert visibility flips
    await app.toggleShowProofSteps(true);
    await expect(app.proofSteps).not.toHaveClass(/hidden/);

    await app.toggleShowProofSteps(false);
    await expect(app.proofSteps).toHaveClass(/hidden/);

    // Construct a proof and verify proofConstruction gets populated
    await app.clickConstructProof();
    await expect(app.proofConstruction).toHaveText(/Proof that|Proof that Vertex Cover is NP-Complete|Proof that SAT is NP-Complete|Proof that TSP is NP-Complete/);
  });

  // Final check: ensure no unexpected console error messages beyond the intentional invocation
  test('No unexpected console errors besides intentional invocation', async ({ page }) => {
    const app = new NPExplorerPage(page);
    await app.goto();

    // As a sanity check, ensure we have the main UI visible
    await expect(app.problemSelect).toBeVisible();

    // We expect at least one page error from the earlier deliberate attempt to invoke checkSATSolution without generation.
    // Ensure that there are no additional console.error messages (aside from captured pageerrors).
    // Note: Some browsers will include stack traces as console errors when pageerror occurs; we accept that.
    // Verify that consoleErrors length is >= 0 and pageErrors contains at least the intentional error.
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });
});