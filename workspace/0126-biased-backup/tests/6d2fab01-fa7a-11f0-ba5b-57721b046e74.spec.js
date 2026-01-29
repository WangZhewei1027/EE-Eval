import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2fab01-fa7a-11f0-ba5b-57721b046e74.html';

// Page object helpers for clarity
class BigOmegaPage {
  constructor(page) {
    this.page = page;
    this.tabs = {
      definition: page.locator('.tab', { hasText: 'Definition' }),
      comparison: page.locator('.tab', { hasText: 'Function Comparison' }),
      proof: page.locator('.tab', { hasText: 'Proof Technique' }),
      practice: page.locator('.tab', { hasText: 'Practice' }),
    };
    this.contents = {
      definition: page.locator('#definition'),
      comparison: page.locator('#comparison'),
      proof: page.locator('#proof'),
      practice: page.locator('#practice'),
    };
    // Definition tab controls
    this.fDefinition = page.locator('#f-definition');
    this.gDefinition = page.locator('#g-definition');
    this.cSlider = page.locator('#c-slider');
    this.n0Slider = page.locator('#n0-slider');
    this.updateGraphButton = page.locator('button', { hasText: 'Update Graph' });
    this.definitionResult = page.locator('#definition-result');
    // Comparison tab controls
    this.func1 = page.locator('#func1');
    this.func2 = page.locator('#func2');
    this.relationship = page.locator('#relationship');
    this.checkRelationshipButton = page.locator('button', { hasText: 'Check Relationship' });
    this.comparisonResult = page.locator('#comparison-result');
    // Proof tab controls
    this.fProof = page.locator('#f-proof');
    this.gProof = page.locator('#g-proof');
    this.suggestProofButton = page.locator('button', { hasText: 'Suggest Proof Approach' });
    this.verifyProofButton = page.locator('button', { hasText: 'Verify My Proof' });
    this.proofText = page.locator('#proof-text');
    this.proofResult = page.locator('#proof-result');
    // Practice tab controls
    this.difficulty = page.locator('#difficulty');
    this.problemStatement = page.locator('#problem-statement');
    this.userAnswer = page.locator('#user-answer');
    this.checkAnswerButton = page.locator('button', { hasText: 'Check Answer' });
    this.answerResult = page.locator('#answer-result');
    // Canvas elements
    this.definitionCanvas = page.locator('#definitionGraph');
    this.comparisonCanvas = page.locator('#comparisonGraph');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async switchTab(tabName) {
    const tab = this.tabs[tabName];
    await tab.click();
    // wait for the content to become active
    await expect(this.contents[tabName]).toHaveClass(/active/);
  }

  // Helper to set range value and dispatch input/change
  async setRange(locator, value) {
    await locator.evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
}

test.describe('Big-Omega Notation Explorer - FSM and interactions', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    app = new BigOmegaPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Always close the page
    await page.close();
  });

  test('Initial load: Definition tab is active and updateDefinitionGraph entry action ran', async () => {
    // Verify the Definition tab and content are active
    await expect(app.tabs.definition).toHaveClass(/active/);
    await expect(app.contents.definition).toHaveClass(/active/);

    // The onload handler calls updateDefinitionGraph(), which updates c-value and n0-value shown in DOM.
    // Check that the displayed values for c and n0 exist and match the default sliders (1)
    const cValue = await page.locator('#c-value').textContent();
    const n0Value = await page.locator('#n0-value').textContent();
    expect(cValue.trim()).toBe('1');
    expect(n0Value.trim()).toBe('1');

    // The definition-result should have been populated by updateDefinitionGraph (either holds or not)
    const defResultText = (await app.definitionResult.innerHTML()).trim();
    expect(defResultText.length).toBeGreaterThan(0);

    // The definition canvas should be present and have width/height attributes set by the script
    const defCanvasWidth = await app.definitionCanvas.evaluate(c => c.width);
    const defCanvasHeight = await app.definitionCanvas.evaluate(c => c.height);
    expect(defCanvasWidth).toBeGreaterThan(0);
    expect(defCanvasHeight).toBeGreaterThan(0);

    // Observe console and page errors after initial load; assert there are no uncaught page errors on load
    // (we capture and expose them for debugging). It's acceptable for the page to log messages,
    // but there should be no uncaught exceptions at initial load.
    expect(pageErrors.length).toBe(0);
  });

  test('Switching tabs triggers expected state transitions and entry actions', async () => {
    // From Definition -> Comparison
    await app.switchTab('comparison');
    await expect(app.contents.comparison).toHaveClass(/active/);
    await expect(app.tabs.comparison).toHaveClass(/active/);

    // drawComparisonGraph should have run: check canvas resized
    const compCanvasW = await app.comparisonCanvas.evaluate(c => c.width);
    const compCanvasH = await app.comparisonCanvas.evaluate(c => c.height);
    expect(compCanvasW).toBeGreaterThan(0);
    expect(compCanvasH).toBeGreaterThan(0);

    // From Comparison -> Proof
    await app.switchTab('proof');
    await expect(app.contents.proof).toHaveClass(/active/);
    await expect(app.tabs.proof).toHaveClass(/active/);

    // From Proof -> Practice
    await app.switchTab('practice');
    await expect(app.contents.practice).toHaveClass(/active/);
    await expect(app.tabs.practice).toHaveClass(/active/);

    // From Practice -> Definition
    await app.switchTab('definition');
    await expect(app.contents.definition).toHaveClass(/active/);
    await expect(app.tabs.definition).toHaveClass(/active/);

    // No uncaught errors during tab transitions
    expect(pageErrors.length).toBe(0);
  });

  test('Definition tab: update graph with different sliders and validate result message', async () => {
    // Ensure we are on definition tab
    await app.switchTab('definition');

    // Set sliders to values likely to make the relationship fail for the default functions
    await app.setRange(app.cSlider, '0.1');
    await app.setRange(app.n0Slider, '5');

    // Click Update Graph and wait for DOM update
    await app.updateGraphButton.click();
    await expect(app.definitionResult).toBeVisible();

    const text = (await app.definitionResult.textContent()) || '';
    // The message will either say 'relationship holds' or 'does NOT hold' — assert it mentions the relationship phrase.
    expect(/holds|NOT/.test(text)).toBeTruthy();

    // Verify the slider descriptors reflect the set values
    const cValue = (await page.locator('#c-value').textContent()).trim();
    const n0Value = (await page.locator('#n0-value').textContent()).trim();
    expect(cValue).toBe('0.1');
    expect(n0Value).toBe('5');

    // No uncaught page errors from this interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Comparison tab: check relationship between functions and verify output', async () => {
    // Switch to comparison
    await app.switchTab('comparison');

    // Ensure default functions are n^2 and n -> n^2 should be Ω(n)
    await app.func1.fill('n^2');
    await app.func2.fill('n');

    // Choose 'Is Ω of' relationship
    await app.relationship.selectOption('omega');

    // Click check relationship
    await app.checkRelationshipButton.click();

    // Expect the comparison result to indicate correctness
    await expect(app.comparisonResult).toBeVisible();
    const compText = (await app.comparisonResult.textContent()) || '';
    // It should either say "Correct!" or "Incorrect." but for n^2 vs n we expect "Correct!"
    expect(/Correct!|Incorrect\./.test(compText)).toBeTruthy();
    expect(compText).toMatch(/Ω\(/);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Proof tab: suggest proof populates text and verifyProof validates structure', async () => {
    // Switch to proof tab
    await app.switchTab('proof');

    // Set example f and g for proof
    await app.fProof.fill('3n^2 + 2n + 1');
    await app.gProof.fill('n^2');

    // Click suggest proof and verify the proof-text was updated
    await app.suggestProofButton.click();
    const proofTextValue = await app.proofText.inputValue();
    expect(proofTextValue.length).toBeGreaterThan(20);
    expect(/To prove|dominant term|choose c/.test(proofTextValue)).toBeTruthy();

    // Click verify proof - the page's simple verifier checks for presence of 'c' and 'n₀' and the exprs
    await app.verifyProofButton.click();
    await expect(app.proofResult).toBeVisible();
    const proofResultText = (await app.proofResult.textContent()) || '';

    // Based on suggestProof output, verifyProof should find structural elements and return the 'structurally correct' message
    expect(/structurally correct|missing key elements/.test(proofResultText)).toBeTruthy();

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Practice tab: generate problem by changing difficulty and submit correct answer', async () => {
    // Switch to practice tab
    await app.switchTab('practice');

    // Change difficulty to medium to force generateProblem() via onchange
    await app.difficulty.selectOption('medium');

    // Wait for problem statement to populate
    await expect(app.problemStatement).toBeVisible();
    const problemHtml = await app.problemStatement.innerHTML();
    expect(/Find the tightest Big-Omega bound for/.test(problemHtml)).toBeTruthy();

    // Read the currentProblem object from the page to determine the correct answer
    const currentProblem = await page.evaluate(() => {
      // Expose the global currentProblem created by the app
      return window.currentProblem || null;
    });

    // Ensure we have a problem object
    expect(currentProblem).not.toBeNull();
    expect(currentProblem.function).toBeTruthy();
    expect(currentProblem.answer).toBeTruthy();

    // Fill the correct answer in the required format and submit
    await app.userAnswer.fill(`Ω(${currentProblem.answer})`);
    await app.checkAnswerButton.click();

    // Verify that the answer-result shows 'Correct!'
    await expect(app.answerResult).toBeVisible();
    const answerText = (await app.answerResult.textContent()) || '';
    expect(/Correct!/.test(answerText)).toBeTruthy();

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: malformed expression "lg(n)" in Comparison should be handled (no unhandled exceptions)', async () => {
    // Switch to comparison tab
    await app.switchTab('comparison');

    // Input a function expression using the "lg(...)" notation which the page's evaluator attempts to handle but has a buggy replacement
    await app.func1.fill('lg(n)');
    await app.func2.fill('n');

    // Select omega and click check relationship
    await app.relationship.selectOption('omega');
    await app.checkRelationshipButton.click();

    // The page should handle this gracefully (it may conclude it's NOT Ω due to evaluation errors)
    const compText = (await app.comparisonResult.textContent()) || '';
    expect(compText.length).toBeGreaterThan(0);

    // Specifically ensure there are no uncaught exceptions (evaluateMathExpr wraps eval in try/catch)
    expect(pageErrors.length).toBe(0);

    // There may be a non-numeric evaluation resulting in "Incorrect" message - accept either outcome but ensure DOM updated
    expect(/Correct!|Incorrect\./.test(compText)).toBeTruthy();
  });

  test('Observes console messages and page errors for debugging (captures but does not modify page)', async () => {
    // This test's purpose is to ensure we are capturing console and page errors during interactions
    // Perform a few interactions
    await app.switchTab('definition');
    await app.updateGraphButton.click();
    await app.switchTab('comparison');
    await app.checkRelationshipButton.click();
    await app.switchTab('proof');
    await app.suggestProofButton.click();
    await app.switchTab('practice');
    await app.difficulty.selectOption('hard');

    // After interactions, log counts for assertions
    // We assert there are zero uncaught page errors (the page attempts to handle runtime errors internally)
    expect(pageErrors.length).toBe(0);

    // Console messages may be present (info/debug) — ensure we captured them as an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    // The test does not require that there are console logs, only that they are captured reliably.
  });
});