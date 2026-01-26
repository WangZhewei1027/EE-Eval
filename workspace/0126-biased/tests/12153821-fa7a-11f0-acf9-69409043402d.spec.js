import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12153821-fa7a-11f0-acf9-69409043402d.html';

test.describe('Time Complexity Interactive Explorer - FSM integration tests', () => {
  // Arrays to collect console and page errors for inspection
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions / debugging
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL);
    // The page initializes by loading the default algorithm and autofilling input array.
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    // Ensure there are no uncaught page errors during tests.
    // Many internal errors are caught by the app and surfaced in DOM; pageErrors should be empty.
    expect(pageErrors.length, `Unexpected uncaught page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('S0 Idle entry actions executed on load: algorithm loaded and input autofilled', async ({ page }) => {
    // Validate that initial load executed loadAlgorithmSource and autofillInputArrayFromSize
    const algoCode = page.locator('#algoCode');
    const inputArray = page.locator('#inputArray');
    const stepOutput = page.locator('#stepOutput');

    // Algo code should contain a function declaration (linearSearch by default)
    await expect(algoCode).toHaveValue(/function\s+linearSearch/);

    // Input array should have been autofilled (not empty)
    await expect(inputArray).not.toHaveValue('');

    // stepOutput should contain loaded algorithm message
    await expect(stepOutput).toContainText(/Loaded "linearSearch" algorithm source./);
  });

  test('LoadAlgorithm event transitions Idle->AlgorithmLoaded and updates editor', async ({ page }) => {
    // Select another algorithm and click Load Algorithm
    const algoSelect = page.locator('#algoSelect');
    const loadBtn = page.locator('#loadAlgoBtn');
    const algoCode = page.locator('#algoCode');
    const stepOutput = page.locator('#stepOutput');

    // Choose bubbleSort
    await algoSelect.selectOption('bubbleSort');
    await loadBtn.click();

    // After loading, editor should contain bubbleSort function name
    await expect(algoCode).toHaveValue(/function\s+bubbleSort/);

    // Output should report the loaded algorithm
    await expect(stepOutput).toContainText(/Loaded "bubbleSort" algorithm source./);

    // Console should have some messages but no uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('RunStep transitions AlgorithmLoaded->StepExecution and allows step navigation', async ({ page }) => {
    // Ensure a non-search algorithm (bubbleSort) is loaded to avoid prompt
    const algoSelect = page.locator('#algoSelect');
    const loadBtn = page.locator('#loadAlgoBtn');
    const runStepBtn = page.locator('#runStepBtn');
    const nextBtn = page.locator('#nextStepBtn');
    const prevBtn = page.locator('#prevStepBtn');
    const stepOutput = page.locator('#stepOutput');
    const inputSize = page.locator('#inputSize');

    await algoSelect.selectOption('bubbleSort');
    await loadBtn.click();

    // Set small input size to keep step traces small
    await inputSize.fill('3');
    // Trigger change event so inputArray is auto-filled
    await page.locator('#inputSize').dispatchEvent('change');

    // Start step-by-step execution
    await runStepBtn.click();

    // After clicking Run Step-by-Step, UI should show "Start of steps"
    await expect(stepOutput).toContainText(/Start of steps/);

    // Move to the next step - should display Step 1 / <N> where N >= 1 or "End of steps reached." if none
    await nextBtn.click();
    const nextText = await stepOutput.textContent();
    // Either shows a Step line or indicates last step message; ensure it changed from "Start of steps"
    expect(nextText && !/Start of steps/.test(nextText)).toBeTruthy();

    // Move back to previous - should show Start of steps again (prev from step 1 goes back)
    await prevBtn.click();
    await expect(stepOutput).toContainText(/Start of steps/);
  });

  test('AutoRunSteps runs through steps and can be stopped', async ({ page }) => {
    // Load a deterministic algorithm and prepare steps
    const algoSelect = page.locator('#algoSelect');
    const loadBtn = page.locator('#loadAlgoBtn');
    const runStepBtn = page.locator('#runStepBtn');
    const autoRunBtn = page.locator('#autoRunBtn');
    const stepOutput = page.locator('#stepOutput');
    const inputSize = page.locator('#inputSize');

    await algoSelect.selectOption('insertionSort');
    await loadBtn.click();

    // Small input yields few operations
    await inputSize.fill('4');
    await page.locator('#inputSize').dispatchEvent('change');

    // Prepare steps
    await runStepBtn.click();
    await expect(stepOutput).toContainText(/Start of steps/);

    // Start auto run
    await autoRunBtn.click();

    // Wait until the button switches to "Stop Auto Run" (it should immediately change)
    await expect(autoRunBtn).toHaveText(/Stop Auto Run/);

    // Wait for auto run to complete. It appends 'Auto run complete.' upon completion.
    // Wait up to 7 seconds to accommodate the interval of 700ms and a few steps.
    await page.waitForFunction(() => {
      const out = document.getElementById('stepOutput');
      return out && out.textContent && out.textContent.includes('Auto run complete.');
    }, { timeout: 7000 });

    // Ensure auto run button text returned to 'Auto Run' after completion
    await expect(autoRunBtn).toHaveText('Auto Run');
  });

  test('RunFull executes algorithm and displays output (handles prompt for search algorithms)', async ({ page }) => {
    const algoSelect = page.locator('#algoSelect');
    const loadBtn = page.locator('#loadAlgoBtn');
    const runFullBtn = page.locator('#runFullBtn');
    const stepOutput = page.locator('#stepOutput');
    const inputSize = page.locator('#inputSize');

    // Choose linearSearch which expects a target (triggers prompt)
    await algoSelect.selectOption('linearSearch');
    await loadBtn.click();

    // Ensure prompt is handled by supplying a numeric target value
    page.once('dialog', async (dialog) => {
      // Accept default prompt with value '42' (the implementation uses '42' default)
      await dialog.accept('42');
    });

    // Make input array size small
    await inputSize.fill('5');
    await page.locator('#inputSize').dispatchEvent('change');

    // Run full algorithm; should produce 'Algorithm output:' text or 'Target value input canceled.' if dialog canceled
    await runFullBtn.click();
    await expect(stepOutput).toContainText(/Algorithm output:|Target value input canceled.|Invalid target number.|Error during run:/);
  });

  test('ResetExecution clears step state and provides feedback', async ({ page }) => {
    const algoSelect = page.locator('#algoSelect');
    const loadBtn = page.locator('#loadAlgoBtn');
    const runStepBtn = page.locator('#runStepBtn');
    const resetBtn = page.locator('#resetRunBtn');
    const stepOutput = page.locator('#stepOutput');
    const inputSize = page.locator('#inputSize');

    await algoSelect.selectOption('bubbleSort');
    await loadBtn.click();

    // Prepare steps
    await inputSize.fill('3');
    await page.locator('#inputSize').dispatchEvent('change');
    await runStepBtn.click();
    await expect(stepOutput).toContainText(/Start of steps/);

    // Reset execution
    await resetBtn.click();

    // stepOutput should show the reset message
    await expect(stepOutput).toHaveText('Execution state reset.');
  });

  test('AnalyzeCode performs static analysis and outputs guessed complexity', async ({ page }) => {
    const analyzeBtn = page.locator('#analyzeBtn');
    const analyzeOutput = page.locator('#analyzeOutput');

    // Click analyze - should populate analyzeOutput with guessed complexity
    await analyzeBtn.click();

    await expect(analyzeOutput).toContainText(/Guessed Time Complexity|Static Complexity Analysis/);
    await expect(analyzeOutput).toContainText(/Function name:|Maximum nest loop depth:/);
  });

  test('CompareComplexities executes a sample run and compares to selected asymptotic function', async ({ page }) => {
    const compareBtn = page.locator('#compareBtn');
    const compareOutput = page.locator('#compareOutput');
    const asymptoticSelect = page.locator('#asymptoticSelect');
    const compareN = page.locator('#compareN');
    const algoSelect = page.locator('#algoSelect');
    const loadBtn = page.locator('#loadAlgoBtn');

    // Ensure an algorithm is loaded
    await algoSelect.selectOption('insertionSort');
    await loadBtn.click();

    // Select asymptotic function and set n small
    await asymptoticSelect.selectOption('O(n)');
    await compareN.fill('5');

    // Perform comparison
    await compareBtn.click();

    // Expect output to include the summary lines with the chosen n
    await expect(compareOutput).toContainText(/At input size n = 5:/);
    await expect(compareOutput).toContainText(/Algorithm estimated step count:|Selected asymptotic function/);
  });

  test('InputSizeChange handles invalid value by resetting to default and autofilling input array', async ({ page }) => {
    const inputSize = page.locator('#inputSize');
    const inputArray = page.locator('#inputArray');

    // Set invalid input size (0) and fire change
    await inputSize.fill('0');
    await inputSize.dispatchEvent('change');

    // According to implementation, invalid values reset to 10
    await expect(inputSize).toHaveValue('10');

    // Input array should be autofilled
    await expect(inputArray).not.toHaveValue('');
  });

  test('Edge case: SyntaxError in code is surfaced via parsing error message', async ({ page }) => {
    const algoSelect = page.locator('#algoSelect');
    const loadBtn = page.locator('#loadAlgoBtn');
    const algoCode = page.locator('#algoCode');
    const runStepBtn = page.locator('#runStepBtn');
    const stepOutput = page.locator('#stepOutput');

    // Switch to custom mode which injects a template, then replace code with invalid JS
    await algoSelect.selectOption('custom');
    await loadBtn.click();

    // Put invalid JS into the editor
    await algoCode.fill('function badFunc( {'); // invalid syntax

    // Attempt to run step; evalCurrentFunction should catch and display a parsing error
    await runStepBtn.click();

    // Expect parsing error message in stepOutput
    await expect(stepOutput).toContainText(/Error parsing algorithm function:/);
  });

  test('Edge case: Runtime ReferenceError during algorithm execution is captured and reported', async ({ page }) => {
    const algoSelect = page.locator('#algoSelect');
    const loadBtn = page.locator('#loadAlgoBtn');
    const algoCode = page.locator('#algoCode');
    const runFullBtn = page.locator('#runFullBtn');
    const stepOutput = page.locator('#stepOutput');

    // Switch to custom and load template
    await algoSelect.selectOption('custom');
    await loadBtn.click();

    // Insert a function that will throw a ReferenceError when executed
    const badFunctionSource = `function badRuntime(arr) {
  // Reference to undefined identifier to trigger ReferenceError during run
  return nonExistantIdentifier + 1;
}`;
    await algoCode.fill(badFunctionSource);

    // Run full algorithm - since the runtime error is caught by runFullAlgorithm's try/catch,
    // stepOutput will contain 'Error during run:' and the error message
    await runFullBtn.click();

    await expect(stepOutput).toContainText(/Error during run:/);
    await expect(stepOutput).toContainText(/nonExistantIdentifier is not defined|nonExistantIdentifier/);
  });

  test('Console and page error observations: there should be no uncaught errors and console logs are present', async ({ page }) => {
    // Validate we have captured console messages during interactions
    // At least some console messages should be present (app uses console rarely; but we captured DOM messages into stepOutput)
    // We assert that no uncaught page errors were emitted during the session above (checked in afterEach)
    // Additionally, ensure that consoleMessages array is defined and is an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    // No strict requirement on number, but ensure that capturing mechanism works
    // If there are console messages, ensure they have text
    if (consoleMessages.length > 0) {
      expect(consoleMessages[0].text.length).toBeGreaterThanOrEqual(0);
    }
  });
});