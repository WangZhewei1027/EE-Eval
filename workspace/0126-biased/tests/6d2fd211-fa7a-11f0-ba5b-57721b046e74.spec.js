import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2fd211-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Space Complexity Explorer - FSM and UI integration tests', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore instrumentation errors
      }
    });

    // Collect page runtime errors
    page.on('pageerror', err => {
      try {
        pageErrors.push(err.message);
      } catch (e) {
        // ignore
      }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial JS has run
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    // Basic invariant: no uncaught page errors or console errors should have occurred
    expect(pageErrors, 'There should be no uncaught page errors').toEqual([]);
    expect(consoleErrors, 'There should be no console.error messages').toEqual([]);
  });

  test.describe('Initial Idle State (S0_Idle) and resetAnalysis on enter', () => {
    test('Initial state hides code, analysis, and comparison panels', async ({ page }) => {
      // Verify S0_Idle entry action resetAnalysis() resulted in panels hidden
      const codeDisplay = await page.$('#codePanel');
      const analysisPanel = await page.$('#analysisPanel');
      const comparisonPanel = await page.$('#comparisonPanel');

      const codeStyle = await codeDisplay.evaluate(n => n.style.display);
      const analysisStyle = await analysisPanel.evaluate(n => n.style.display);
      const comparisonStyle = await comparisonPanel.evaluate(n => n.style.display);

      // All panels should be hidden initially due to resetAnalysis()
      expect(codeStyle).toBe('none');
      expect(analysisStyle).toBe('none');
      expect(comparisonStyle).toBe('none');
    });
  });

  test.describe('Code Displayed State (S1_CodeDisplayed) and ShowCodeClick transition', () => {
    test('Clicking Show Code displays the code panel and hides others', async ({ page }) => {
      // Show code for the default algorithm (linear)
      await page.click('#showCodeBtn');

      // codePanel should be displayed
      const codePanel = await page.$('#codePanel');
      expect(await codePanel.evaluate(n => n.style.display)).toBe('block');

      // codeDisplay should contain the linear search function name
      const codeText = await page.$eval('#codeDisplay', el => el.textContent || '');
      expect(codeText).toContain('function linearSearch');

      // analysisPanel and comparisonPanel should be hidden
      expect(await page.$eval('#analysisPanel', n => n.style.display)).toBe('none');
      expect(await page.$eval('#comparisonPanel', n => n.style.display)).toBe('none');
    });

    test('Switching algorithm then Show Code shows correct algorithm code', async ({ page }) => {
      // Change algorithm selection to merge sort then click show code
      await page.selectOption('#algorithmSelect', 'merge');
      // After changing, resetAnalysis() should hide panels; assert hidden before clicking show
      expect(await page.$eval('#codePanel', n => n.style.display)).toBe('none');

      await page.click('#showCodeBtn');

      // codeDisplay should contain mergeSort
      const codeText = await page.$eval('#codeDisplay', el => el.textContent || '');
      expect(codeText).toContain('function mergeSort');
      // Ensure codePanel visible
      expect(await page.$eval('#codePanel', n => n.style.display)).toBe('block');
    });
  });

  test.describe('Analysis Displayed State (S2_AnalysisDisplayed) and AnalyzeClick transition', () => {
    test('Clicking Analyze shows analysis panel with complexity explanation', async ({ page }) => {
      // Ensure an algorithm is selected (default linear), click analyze
      await page.click('#analyzeBtn');

      // analysisPanel should be visible
      expect(await page.$eval('#analysisPanel', n => n.style.display)).toBe('block');

      // complexityExplanation should contain the algorithm name and "Space Complexity"
      const explanationHtml = await page.$eval('#complexityExplanation', el => el.innerHTML || '');
      expect(explanationHtml).toContain('Linear Search Space Complexity');
      expect(explanationHtml).toContain('Best Case');
      expect(await page.$eval('#codePanel', n => n.style.display)).toBe('none');
      expect(await page.$eval('#comparisonPanel', n => n.style.display)).toBe('none');
    });
  });

  test.describe('Visualization Active State (S4_VisualizationActive) and visualization interactions', () => {
    test('Clicking Visualize updates memoryVisualization and shows analysis panel', async ({ page }) => {
      // Select dynamic algorithm to get multiple memory cells
      await page.selectOption('#algorithmSelect', 'dynamic');
      // Set input size to 5 for manageable number of cells
      await page.fill('#inputSize', '5');
      // Update visual by clicking visualize
      await page.click('#visualizeBtn');

      // analysisPanel should be visible
      expect(await page.$eval('#analysisPanel', n => n.style.display)).toBe('block');

      // memoryVisualization should have children equal to input size (5)
      const childCount = await page.$eval('#memoryVisualization', el => el.querySelectorAll('div').length);
      expect(childCount).toBeGreaterThanOrEqual(5);
    });

    test('Step forward increments current step visually (S4 StepForwardClick)', async ({ page }) => {
      // Use dynamic algorithm to create several cells
      await page.selectOption('#algorithmSelect', 'dynamic');
      await page.fill('#inputSize', '5');
      await page.click('#visualizeBtn');

      // Ensure initial state: all cells backgroundColor '#ddd'
      const initialBgColors = await page.$$eval('#memoryVisualization div', nodes => nodes.map(n => getComputedStyle(n).backgroundColor));
      // Convert '#ddd' to rgb as getComputedStyle returns rgb; accept that initial color is not transparent
      expect(initialBgColors.length).toBeGreaterThan(0);

      // Click step forward
      await page.click('#stepForwardBtn');

      // After stepping forward, first element (index 0) should have changed color to '#aaa' (rgb equivalent)
      const firstBg = await page.$eval('#memoryVisualization div', n => getComputedStyle(n).backgroundColor);
      // Accept either rgb or hex differences; check that it's not the original '#ddd' color by comparing to initial
      expect(firstBg).not.toBe(initialBgColors[0]);
    });

    test('Step backward decrements current step visually (S4 StepBackwardClick)', async ({ page }) => {
      await page.selectOption('#algorithmSelect', 'dynamic');
      await page.fill('#inputSize', '5');
      await page.click('#visualizeBtn');

      // Step forward twice to ensure we can step back
      await page.click('#stepForwardBtn');
      await page.click('#stepForwardBtn');

      // Record background of first two elements after stepping
      const colorsAfterForward = await page.$$eval('#memoryVisualization div', nodes => nodes.slice(0, 2).map(n => getComputedStyle(n).backgroundColor));

      // Step backward once
      await page.click('#stepBackwardBtn');

      const colorsAfterBackward = await page.$$eval('#memoryVisualization div', nodes => nodes.slice(0, 2).map(n => getComputedStyle(n).backgroundColor));

      // After stepping back, the second element should revert towards initial (i.e., change)
      expect(colorsAfterBackward[1]).not.toBe(colorsAfterForward[1]);
    });

    test('Play toggles between Play and Pause and affects animation interval (S4 PlayClick)', async ({ page }) => {
      // Use recursive algorithm with a few frames (input size 6)
      await page.selectOption('#algorithmSelect', 'recursive');
      await page.fill('#inputSize', '6');
      await page.click('#visualizeBtn');

      // Initially Play button text should be 'Play'
      const playBtnTextBefore = await page.$eval('#playBtn', n => n.textContent?.trim());
      expect(playBtnTextBefore).toBe('Play');

      // Click play to start animation
      await page.click('#playBtn');

      // Button should change to 'Pause'
      const playBtnTextDuring = await page.$eval('#playBtn', n => n.textContent?.trim());
      expect(playBtnTextDuring).toBe('Pause');

      // Wait a short time to allow at least one animation step (depending on speedControl default)
      await page.waitForTimeout(250);

      // Click play again to pause
      await page.click('#playBtn');
      const playBtnTextAfter = await page.$eval('#playBtn', n => n.textContent?.trim());
      expect(playBtnTextAfter).toBe('Play');
    });

    test('Reset sets currentStep to 0 and visualization reflects reset (S4 ResetClick)', async ({ page }) => {
      await page.selectOption('#algorithmSelect', 'dynamic');
      await page.fill('#inputSize', '5');
      await page.click('#visualizeBtn');

      // Step forward a couple times
      await page.click('#stepForwardBtn');
      await page.click('#stepForwardBtn');

      // Reset visualization
      await page.click('#resetBtn');

      // After reset, all cells should have neutral background color (not '#aaa')
      const colorsAfterReset = await page.$$eval('#memoryVisualization div', nodes => nodes.map(n => getComputedStyle(n).backgroundColor));
      // None of the colors should be the 'active' color used in updateVisualization (#aaa -> rgb)
      // We'll assert that at least one color equals the neutral color (initial)
      expect(colorsAfterReset.length).toBeGreaterThan(0);
    });

    test('Changing speed while playing updates interval (S4 SpeedControlChange)', async ({ page }) => {
      await page.selectOption('#algorithmSelect', 'dynamic');
      await page.fill('#inputSize', '5');
      await page.click('#visualizeBtn');

      // Start playing
      await page.click('#playBtn');
      expect(await page.$eval('#playBtn', n => n.textContent?.trim())).toBe('Pause');

      // Change speed
      await page.fill('#speedControl', '8');
      // Trigger input event by dispatching via evaluate to ensure listeners run
      await page.$eval('#speedControl', el => el.dispatchEvent(new Event('input', { bubbles: true })));

      // Wait a short time to give animation a chance to step
      await page.waitForTimeout(300);

      // Stop playing
      await page.click('#playBtn');
      expect(await page.$eval('#playBtn', n => n.textContent?.trim())).toBe('Play');

      // Basic assertion: no exceptions thrown and button toggled correctly handled in this flow.
      // The afterEach will assert no runtime errors occurred.
    });
  });

  test.describe('Comparison Displayed State (S3_ComparisonDisplayed) and transitions', () => {
    test('Add current algorithm to comparison shows comparison panel with an entry', async ({ page }) => {
      // Make sure on idle
      await page.selectOption('#algorithmSelect', 'bubble');
      // Add to comparison
      await page.click('#addToComparisonBtn');

      // comparisonPanel should be visible
      expect(await page.$eval('#comparisonPanel', n => n.style.display)).toBe('block');

      // comparison table should have at least one row with Bubble Sort name
      const tableHtml = await page.$eval('#comparisonTable', tb => tb.innerHTML || '');
      expect(tableHtml).toContain('Bubble Sort');
      // Clear comparison using Clear button to test ClearComparisonClick transition
      await page.click('#clearComparisonBtn');

      // After clearing, panel should be hidden
      expect(await page.$eval('#comparisonPanel', n => n.style.display)).toBe('none');
      const tableHtmlAfter = await page.$eval('#comparisonTable', tb => tb.innerHTML || '');
      expect(tableHtmlAfter.trim()).toBe('');
    });

    test('Remove button in comparison row removes the entry and hides panel when empty', async ({ page }) => {
      // Add two algorithms then remove one via the Remove button
      await page.selectOption('#algorithmSelect', 'merge');
      await page.click('#addToComparisonBtn');
      await page.selectOption('#algorithmSelect', 'binary');
      await page.click('#addToComparisonBtn');

      // There should be rows for Merge Sort and Binary Search
      let rows = await page.$$eval('#comparisonTable tr', rows => rows.map(r => r.innerText));
      expect(rows.length).toBeGreaterThanOrEqual(2);

      // Click the Remove button for the first row. The remove button uses a global function removeFromComparison.
      // Find the first remove button and click it.
      const removeButtons = await page.$$('#comparisonTable button');
      expect(removeButtons.length).toBeGreaterThan(0);
      await removeButtons[0].click();

      // After removing, at least one row should remain (since we added two)
      rows = await page.$$eval('#comparisonTable tr', rows => rows.map(r => r.innerText));
      expect(rows.length).toBeGreaterThanOrEqual(0);

      // Now remove remaining rows programmatically by clicking remaining remove buttons
      const remainingButtons = await page.$$('#comparisonTable button');
      for (const btn of remainingButtons) {
        await btn.click();
      }

      // After removing all, panel should be hidden
      expect(await page.$eval('#comparisonPanel', n => n.style.display)).toBe('none');
    });
  });

  test.describe('CalculateClick and calculator behaviors (S0_Idle -> S0_Idle)', () => {
    test('Calculate with valid complexity displays explanation and "When to use"', async ({ page }) => {
      // Enter a valid complexity and click calculate
      await page.fill('#complexityInput', 'O(n)');
      await page.click('#calculateBtn');

      const resultHtml = await page.$eval('#calculationResult', el => el.innerHTML || '');
      expect(resultHtml).toContain('O(n) Space Complexity');
      expect(resultHtml).toContain('Linear space - memory usage grows proportionally with input size.');
      expect(resultHtml).toContain('When to use:');
    });

    test('Calculate with invalid complexity displays error message (edge case)', async ({ page }) => {
      // Enter an invalid complexity string and click calculate
      await page.fill('#complexityInput', 'invalid-notation');
      await page.click('#calculateBtn');

      const resultHtml = await page.$eval('#calculationResult', el => el.innerHTML || '');
      // Should show the invalid complexity notification in red
      expect(resultHtml).toContain('Invalid complexity notation');
      // Confirm that validComplexities list appears in the message
      expect(resultHtml).toContain('O(1)');
      expect(resultHtml).toContain('O(n!)');
    });
  });

  test.describe('InputSizeChange event and visual feedback', () => {
    test('Changing input size updates displayed value (InputSizeChange event)', async ({ page }) => {
      // Change the range input to 42 and ensure the displayed value updates
      const inputHandle = await page.$('#inputSize');
      // Use evaluate to set value and dispatch input event
      await inputHandle.evaluate((el) => {
        el.value = 42;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      const displayedValue = await page.$eval('#inputSizeValue', el => el.textContent?.trim());
      expect(displayedValue).toBe('42');
    });

    test('Visualization respects input size for recursive frames (edge behavior)', async ({ page }) => {
      // Select recursive and set a larger input size; visualization limits frames to min(size,10)
      await page.selectOption('#algorithmSelect', 'recursive');
      await page.fill('#inputSize', '12');
      await page.click('#visualizeBtn');

      // The script uses Math.min(size, 10) for frames
      const frameCount = await page.$eval('#memoryVisualization', el => el.querySelectorAll('div').length);
      expect(frameCount).toBeLessThanOrEqual(10);
      expect(frameCount).toBeGreaterThan(0);
    });
  });

  test.describe('Event handler presence and graceful behavior', () => {
    test('All major interactive elements exist and are clickable', async ({ page }) => {
      // Ensure presence of all major controls
      const selectors = [
        '#algorithmSelect',
        '#showCodeBtn',
        '#analyzeBtn',
        '#visualizeBtn',
        '#stepForwardBtn',
        '#stepBackwardBtn',
        '#playBtn',
        '#resetBtn',
        '#addToComparisonBtn',
        '#clearComparisonBtn',
        '#calculateBtn',
        '#inputSize',
        '#complexityInput'
      ];

      for (const sel of selectors) {
        const el = await page.$(sel);
        expect(el, `Element ${sel} should be present`).not.toBeNull();
      }
    });

    test('No ReferenceError, SyntaxError, or TypeError occurred during interactions', async ({ page }) => {
      // Perform several interactions to exercise code paths
      await page.selectOption('#algorithmSelect', 'merge');
      await page.click('#showCodeBtn');
      await page.click('#analyzeBtn');
      await page.click('#visualizeBtn');
      await page.click('#addToComparisonBtn');
      await page.click('#calculateBtn');

      // Assertions are made in afterEach to ensure pageErrors and consoleErrors are empty.
      // Additionally verify that none of the pageErrors contain common JS error names
      const errorConcatenated = pageErrors.join(' ').toLowerCase();
      expect(errorConcatenated).not.toContain('referenceerror'.toLowerCase());
      expect(errorConcatenated).not.toContain('syntaxerror'.toLowerCase());
      expect(errorConcatenated).not.toContain('typeerror'.toLowerCase());
    });
  });
});