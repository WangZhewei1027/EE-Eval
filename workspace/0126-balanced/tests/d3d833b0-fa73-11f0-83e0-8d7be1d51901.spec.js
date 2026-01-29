import { test, expect } from '@playwright/test';

// Test suite for Sliding Window Visualizer
// Application URL:
// http://127.0.0.1:5500/workspace/0126-balanced/html/d3d833b0-fa73-11f0-83e0-8d7be1d51901.html

test.describe('Sliding Window Visualizer - End-to-end', () => {
  // Collect console messages and page errors for each test to assert there are no unexpected runtime errors.
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Listen for console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen for uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts) and store their messages and auto-accept them to not block tests
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Load the application exactly as-is
    await page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/d3d833b0-fa73-11f0-83e0-8d7be1d51901.html', { waitUntil: 'load' });

    // Ensure initial render is settled
    await page.waitForTimeout(100); // short pause to let initial scripts run
  });

  test.afterEach(async () => {
    // Ensure that no unexpected uncaught exceptions were thrown during the test.
    // If there are page errors, we include them in the test output by failing.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    // Also ensure no console error-level logs were emitted
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length, `Console errors detected: ${errorConsole.map(e=>e.text).join('; ')}`).toBe(0);
  });

  // Helper functions (page-object-like) scoped inside describe block
  const selectors = {
    fixedTab: '.tab[data-mode="fixed"]',
    variableTab: '.tab[data-mode="variable"]',
    fixedControls: '#fixedControls',
    variableControls: '#variableControls',
    arrayInput: '#arrayInput',
    applyArr: '#applyArr',
    randArr: '#randArr',
    kRange: '#kRange',
    kVal: '#kVal',
    nVal: '#nVal',
    arrayViz: '#arrayViz',
    curSum: '#curSum',
    maxSum: '#maxSum',
    maxIdx: '#maxIdx',
    stepBtn: '#stepBtn',
    playBtn: '#playBtn',
    resetBtn: '#resetBtn',
    fastForwardBtn: '#fastForwardBtn',
    fixedResult: '#fixedResult',
    codeFixed: '#codeFixed',
    strInput: '#strInput',
    applyStr: '#applyStr',
    randStr: '#randStr',
    strViz: '#strViz',
    stepBtnVar: '#stepBtnVar',
    playBtnVar: '#playBtnVar',
    resetBtnVar: '#resetBtnVar',
    fastForwardBtnVar: '#fastForwardBtnVar',
    curSub: '#curSub',
    bestLen: '#bestLen',
    bestSub: '#bestSub',
    varResult: '#varResult',
    codeVar: '#codeVar',
    stepInfo: '#stepInfo'
  };

  test.describe('Mode switching and UI states', () => {
    test('Initial mode should be fixed and variable controls hidden', async ({ page }) => {
      // Validate initial active tab is fixed
      const fixedActive = await page.locator(selectors.fixedTab).getAttribute('class');
      expect(fixedActive).toContain('active');

      // Fixed controls visible, variable controls hidden
      await expect(page.locator(selectors.fixedControls)).toBeVisible();
      await expect(page.locator(selectors.variableControls)).toBeHidden();

      // Step info should describe fixed-size demo
      const info = await page.locator(selectors.stepInfo).textContent();
      expect(info).toMatch(/Fixed-size max-sum-of-k demo/i);
    });

    test('Clicking variable tab switches to variable mode and updates UI', async ({ page }) => {
      // Click the variable tab
      await page.locator(selectors.variableTab).click();
      // Variable controls visible, fixed hidden
      await expect(page.locator(selectors.variableControls)).toBeVisible();
      await expect(page.locator(selectors.fixedControls)).toBeHidden();

      // Active class moved to variable tab
      const varClass = await page.locator(selectors.variableTab).getAttribute('class');
      expect(varClass).toContain('active');

      // Step info updated for variable demo
      const info1 = await page.locator(selectors.stepInfo).textContent();
      expect(info).toMatch(/Variable-size longest-unique-substring demo/i);

      // Switching back should restore fixed UI
      await page.locator(selectors.fixedTab).click();
      await expect(page.locator(selectors.fixedControls)).toBeVisible();
      await expect(page.locator(selectors.variableControls)).toBeHidden();
      const fixedInfo = await page.locator(selectors.stepInfo).textContent();
      expect(fixedInfo).toMatch(/Fixed-size max-sum-of-k demo/i);
    });
  });

  test.describe('Fixed-size demo interactions and transitions', () => {
    test('Initial array visualization and status reflect the default array and k', async ({ page }) => {
      // Default array is [2,1,5,1,3,2] => 6 cells
      const cellCount = await page.locator(`${selectors.arrayViz} .cell`).count();
      expect(cellCount).toBe(6);

      // nVal should be 6
      const nValText = await page.locator(selectors.nVal).textContent();
      expect(nValText.trim()).toBe('6');

      // kVal default is 3
      const kValText = await page.locator(selectors.kVal).textContent();
      expect(kValText.trim()).toBe('3');

      // curSum reflects initial window sum (first k elements => 2+1+5=8)
      const curSumText = await page.locator(selectors.curSum).textContent();
      expect(curSumText.trim()).toBe('8');

      // maxSum initially equals window sum (init)
      const maxSumText = await page.locator(selectors.maxSum).textContent();
      expect(maxSumText.trim()).toBe('8');

      // maxIdx likely [0,2]
      const maxIdxText = await page.locator(selectors.maxIdx).textContent();
      expect(maxIdxText.trim()).toBe('[0,2]');
    });

    test('Step transitions through fixed steps and updates visualization and status', async ({ page }) => {
      // Reset to ensure starting from beginning
      await page.locator(selectors.resetBtn).click();

      // Step 1: move to next (i=3), windowSum should be 7 and maxSum remains 8
      await page.locator(selectors.stepBtn).click();
      await page.waitForTimeout(50);
      let curSumText1 = await page.locator(selectors.curSum).textContent();
      let maxSumText1 = await page.locator(selectors.maxSum).textContent();
      expect(curSumText.trim()).toBe('7');
      expect(maxSumText.trim()).toBe('8');

      // Step 2: move to next (i=4) which should update max to 9 and maxIdx [2,4]
      await page.locator(selectors.stepBtn).click();
      await page.waitForTimeout(50);
      curSumText = await page.locator(selectors.curSum).textContent();
      maxSumText = await page.locator(selectors.maxSum).textContent();
      const maxIdxText1 = await page.locator(selectors.maxIdx).textContent();
      expect(curSumText.trim()).toBe('9');
      expect(maxSumText.trim()).toBe('9');
      expect(maxIdxText.trim()).toBe('[2,4]');

      // Code highlighting should include at least one .highlight span when in a move/update state
      const codeInner = await page.locator(selectors.codeFixed).innerHTML();
      expect(codeInner.includes('highlight') || codeInner.includes('span')).toBeTruthy();
    });

    test('Applying a new valid array updates visualization and k range max appropriately', async ({ page }) => {
      // Input a shorter array and apply
      await page.locator(selectors.arrayInput).fill('1,2,3');
      await page.locator(selectors.applyArr).click();

      // arrayViz should have 3 cells
      const cellCount1 = await page.locator(`${selectors.arrayViz} .cell`).count();
      expect(cellCount).toBe(3);

      // nVal should be 3
      const nValText1 = await page.locator(selectors.nVal).textContent();
      expect(nValText.trim()).toBe('3');

      // kRange.max should have adapted; reading kRange.max via evaluate
      const kMax = await page.locator(selectors.kRange).evaluate((el) => el.max);
      expect(Number(kMax)).toBeGreaterThanOrEqual(1);
      // curSum and maxSum should reflect initial window of new array (1+2+3 with k clamped)
      const kValText1 = await page.locator(selectors.kVal).textContent();
      const kValNum = Number(kValText.trim());
      const curSumText2 = await page.locator(selectors.curSum).textContent();
      // For array length 3 and k likely 3 => sum 6
      if (kValNum === 3) expect(curSumText.trim()).toBe('6');
    });

    test('Applying an invalid array triggers an alert and preserves previous array (edge case)', async ({ page }) => {
      // Fill invalid input
      await page.locator(selectors.arrayInput).fill('a,b,c');
      // Clear dialog messages array
      dialogMessages = [];
      // Click apply - code calls alert on NaN and returns arr (preserves previous)
      await page.locator(selectors.applyArr).click();
      // Wait a short while for dialog event to be emitted and handled
      await page.waitForTimeout(50);
      // Assert alert dialog was shown with the expected message
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const matched = dialogMessages.some(msg => /Array must contain numbers/i.test(msg));
      expect(matched).toBeTruthy();

      // Check that arrayViz still contains the previous array length (which might be 3 from previous test)
      const cellCount2 = await page.locator(`${selectors.arrayViz} .cell`).count();
      expect(cellCount).toBeGreaterThan(0);
    });

    test('Random array generation updates input and visualization; fast-forward shows final result', async ({ page }) => {
      // Click random array
      await page.locator(selectors.randArr).click();
      // Wait for UI updates
      await page.waitForTimeout(50);
      // Array input should now contain comma-separated numbers
      const inputVal = await page.locator(selectors.arrayInput).inputValue();
      expect(inputVal.split(',').length).toBeGreaterThanOrEqual(1);
      // arrayViz should have same number of cells as input values
      const cellCount3 = await page.locator(`${selectors.arrayViz} .cell`).count();
      expect(cellCount).toBe(inputVal.split(',').length);

      // Fast-forward to final step
      await page.locator(selectors.fastForwardBtn).click();
      await page.waitForTimeout(50);
      // fixedResult should be visible and include "Best sum" prefix
      await expect(page.locator(selectors.fixedResult)).toBeVisible();
      const fixedResultText = await page.locator(selectors.fixedResult).textContent();
      expect(fixedResultText).toMatch(/Best sum/i);
    });

    test('Play button toggles between Play and Pause and respects speed changes', async ({ page }) => {
      // Ensure reset
      await page.locator(selectors.resetBtn).click();

      // Click play to start playing
      await page.locator(selectors.playBtn).click();
      // Button text should change to Pause
      const playText = await page.locator(selectors.playBtn).textContent();
      expect(playText.trim()).toBe('Pause');

      // Change speed to a small value to ensure intervals tick faster (this will stop and start internally)
      await page.locator('#speedRange').fill('100');
      await page.locator('#speedRange').dispatchEvent('input');

      // Let it run briefly, then pause/play again
      await page.waitForTimeout(150);
      // Click play (which should pause)
      await page.locator(selectors.playBtn).click();
      const playTextAfter = await page.locator(selectors.playBtn).textContent();
      expect(playTextAfter.trim()).toBe('Play');
    });
  });

  test.describe('Variable-size demo interactions and transitions', () => {
    test('Switch to variable mode and validate initial rendering', async ({ page }) => {
      // Click variable tab to switch
      await page.locator(selectors.variableTab).click();

      // variable controls visible
      await expect(page.locator(selectors.variableControls)).toBeVisible();

      // strViz should render cells for default string 'abcabcbb' length 8
      const cellCount4 = await page.locator(`${selectors.strViz} .cell`).count();
      // Note: renderStrViz appends .cell elements but uses s variable; count should equal length of string
      const strVal = await page.locator(selectors.strInput).inputValue();
      expect(cellCount).toBe(strVal.length);

      // Initial bestLen should be at least '-' or numeric; default algorithm will have been run at resetVar
      const bestLenText = await page.locator(selectors.bestLen).textContent();
      // Expect bestLen to be a number or '-'
      expect(bestLenText.trim().length).toBeGreaterThanOrEqual(1);
    });

    test('Stepping through variable demo updates status and code highlighting', async ({ page }) => {
      // Ensure variable mode active
      await page.locator(selectors.variableTab).click();
      // Reset variable demo
      await page.locator(selectors.resetBtnVar).click();

      // Step forward a few times
      await page.locator(selectors.stepBtnVar).click();
      await page.waitForTimeout(30);
      // After step, stepInfo should update and curSub reflect some substring or '-'
      const stepInfo1 = await page.locator(selectors.stepInfo).textContent();
      expect(stepInfo1.trim().length).toBeGreaterThan(0);

      // Step forward more to trigger updateMax behavior in the sequence
      await page.locator(selectors.stepBtnVar).click();
      await page.waitForTimeout(30);
      // Code highlighting in variable code should include a highlight span when in an active state
      const codeVarInner = await page.locator(selectors.codeVar).innerHTML();
      expect(codeVarInner.includes('highlight') || codeVarInner.includes('span')).toBeTruthy();
    });

    test('Fast-forward variable demo shows final result for default string', async ({ page }) => {
      // Switch to variable tab
      await page.locator(selectors.variableTab).click();
      // Fast-forward to final
      await page.locator(selectors.fastForwardBtnVar).click();
      await page.waitForTimeout(50);
      // varResult should be visible and contain best substring info
      await expect(page.locator(selectors.varResult)).toBeVisible();
      const varResultText = await page.locator(selectors.varResult).textContent();
      // For 'abcabcbb' the best substring is 'abc' length 3
      expect(varResultText).toMatch(/Best length = 3/i);
      expect(varResultText).toMatch(/'abc'/i);
    });

    test('Apply an empty string results in empty state (edge-case)', async ({ page }) => {
      // Switch to variable tab and clear input
      await page.locator(selectors.variableTab).click();
      await page.locator(selectors.strInput).fill('');
      // Click apply
      await page.locator(selectors.applyStr).click();
      await page.waitForTimeout(20);
      // curSub, bestLen, bestSub should show '-' or equivalent empty indicators
      const curSubText = await page.locator(selectors.curSub).textContent();
      const bestLenText1 = await page.locator(selectors.bestLen).textContent();
      const bestSubText = await page.locator(selectors.bestSub).textContent();
      expect(curSubText.trim()).toBe('-');
      expect(bestLenText.trim()).toBe('-');
      expect(bestSubText.trim()).toBe('-');
    });

    test('Generating a random string updates input and visualization', async ({ page }) => {
      // Switch to variable and click random
      await page.locator(selectors.variableTab).click();
      await page.locator(selectors.randStr).click();
      await page.waitForTimeout(30);
      const newStr = await page.locator(selectors.strInput).inputValue();
      expect(newStr.length).toBeGreaterThanOrEqual(1);
      const cellCount5 = await page.locator(`${selectors.strViz} .cell`).count();
      expect(cellCount).toBe(newStr.length);
    });

    test('Play/Pause behavior for variable demo toggles button text', async ({ page }) => {
      // Switch to variable
      await page.locator(selectors.variableTab).click();
      // Click play
      await page.locator(selectors.playBtnVar).click();
      const playText1 = await page.locator(selectors.playBtnVar).textContent();
      expect(playText.trim()).toBe('Pause');

      // Click again to pause
      await page.locator(selectors.playBtnVar).click();
      const playTextAfter1 = await page.locator(selectors.playBtnVar).textContent();
      expect(playTextAfter.trim()).toBe('Play');
    });
  });
});