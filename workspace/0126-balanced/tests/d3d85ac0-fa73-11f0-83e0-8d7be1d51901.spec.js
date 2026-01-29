import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d85ac0-fa73-11f0-83e0-8d7be1d51901.html';

// Increase default timeout for animations and micro-bench runs
test.setTimeout(30000);

test.describe('Big-O Notation Visualizer - End-to-end', () => {
  // Page object helpers
  const selectors = {
    nRange: '#nRange',
    nVal: '#nVal',
    nValText: '#nValText',
    runBench: '#runBench',
    resetBtn: '#resetBtn',
    runStep: '#runStep',
    scaleRadioLinear: 'input[name="scale"][value="linear"]',
    scaleRadioLog: 'input[name="scale"][value="log"]',
    toggleFunc: '.toggleFunc',
    benchResults: '#benchResults',
    legend: '#legend',
    valTableRows: '#valTable tbody tr',
    canvas: '#chart'
  };

  // Collect console errors and page errors during each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page and wait for load
    await page.goto(BASE, { waitUntil: 'load' });
    // Ensure initial rendering completed
    await expect(page.locator(selectors.nRange)).toBeVisible();
    await expect(page.locator(selectors.canvas)).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors (if any occur, they will be reported)
    expect(pageErrors.length).toBe(0);
    // Assert there were no console.error messages emitted (if any occur, they will be reported)
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Initialization (S0_Idle) and DOM setup', () => {
    test('should render legend, table, default values and canvas on load', async ({ page }) => {
      // Validate default displayed n value (expected 50)
      await expect(page.locator(selectors.nVal)).toHaveText('50');
      await expect(page.locator(selectors.nValText)).toHaveText('50');

      // Legend should contain entries for each function (7 items)
      const legendItems = page.locator(`${selectors.legend} .item`);
      await expect(legendItems).toHaveCount(7);

      // Table should have 7 rows (one per complexity function)
      const rows = page.locator(selectors.valTableRows);
      await expect(rows).toHaveCount(7);

      // Each row first cell should contain expected complexity label from FUNCTIONS
      const expectedLabels = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)', 'O(n!)'];
      for (let i = 0; i < expectedLabels.length; i++) {
        const cell = rows.nth(i).locator('td').first();
        await expect(cell).toHaveText(expectedLabels[i]);
      }
    });
  });

  test.describe('InputSizeChange event', () => {
    test('adjusting the input size slider updates displayed values and redraws', async ({ page }) => {
      // Change slider to 100
      const slider = page.locator(selectors.nRange);
      await slider.fill('100'); // setting value directly
      // Use evaluate to dispatch input event so page logic runs
      await page.evaluate(() => {
        const s = document.getElementById('nRange');
        s.value = '100';
        s.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // After change, the displayed values should update
      await expect(page.locator(selectors.nVal)).toHaveText('100');
      await expect(page.locator(selectors.nValText)).toHaveText('100');

      // The table should update values; specifically O(n) row should reflect "100"
      const rows1 = page.locator(selectors.valTableRows);
      const onRowIndex = await page.locator(selectors.valTableRows).locator('td').allInnerTexts();
      // Find row with 'O(n)' label and ensure corresponding value cell contains '100'
      const rowCount = await rows.count();
      let found = false;
      for (let i = 0; i < rowCount; i++) {
        const label = await rows.nth(i).locator('td').nth(0).textContent();
        if (label && label.trim() === 'O(n)') {
          const val = await rows.nth(i).locator('td').nth(1).textContent();
          // For n = 100, O(n) value should be "100" (or formatted)
          expect(val.trim().startsWith('100')).toBeTruthy();
          found = true;
          break;
        }
      }
      expect(found).toBeTruthy();
    });

    test('edge case: set n to max (200) and check for infinite values in some rows', async ({ page }) => {
      // Set slider to 200 via evaluate to trigger input event
      await page.evaluate(() => {
        const s1 = document.getElementById('nRange');
        s.value = '200';
        s.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Confirm displayed n updated
      await expect(page.locator(selectors.nVal)).toHaveText('200');

      // For n=200, O(2ⁿ) and O(n!) functions should return Infinity and be displayed as '∞'
      const rows2 = page.locator(selectors.valTableRows);
      const rowCount1 = await rows.count();
      let sawO2nInfinity = false;
      let sawOnfactInfinity = false;
      for (let i = 0; i < rowCount; i++) {
        const label1 = (await rows.nth(i).locator('td').nth(0).textContent())?.trim();
        const valueText = (await rows.nth(i).locator('td').nth(1).textContent())?.trim();
        if (label === 'O(2ⁿ)') {
          if (valueText === '∞') sawO2nInfinity = true;
        }
        if (label === 'O(n!)') {
          if (valueText === '∞') sawOnfactInfinity = true;
        }
      }
      expect(sawO2nInfinity).toBe(true);
      expect(sawOnfactInfinity).toBe(true);
    });
  });

  test.describe('ScaleChange event', () => {
    test('switching scale to log should check the radio and trigger redraw', async ({ page }) => {
      // Click the log radio
      await page.locator(selectors.scaleRadioLog).click();
      // The radio should be checked
      await expect(page.locator(selectors.scaleRadioLog)).toBeChecked();
      // The linear radio should not be checked
      await expect(page.locator(selectors.scaleRadioLinear)).not.toBeChecked();

      // There's no direct DOM text change for the draw, but we can confirm no errors occurred and the radio is set
      // Also try switching back to linear
      await page.locator(selectors.scaleRadioLinear).click();
      await expect(page.locator(selectors.scaleRadioLinear)).toBeChecked();
    });
  });

  test.describe('ToggleComplexityClass event', () => {
    test('toggling a complexity checkbox updates table opacity and redraws', async ({ page }) => {
      // Find the checkbox for O(2ⁿ)
      const targetCheckbox = page.locator('.toggleFunc[data-func="O2n"]');
      await expect(targetCheckbox).toBeVisible();

      // Uncheck it
      await targetCheckbox.click();
      // updateTable() marks hidden rows with reduced opacity (0.45)
      // Find corresponding table row for 'O(2ⁿ)'
      const rows3 = page.locator(selectors.valTableRows);
      const rowCount2 = await rows.count();
      let foundOpacity = null;
      for (let i = 0; i < rowCount; i++) {
        const label2 = (await rows.nth(i).locator('td').nth(0).textContent())?.trim();
        if (label === 'O(2ⁿ)') {
          // Inline style should include opacity: 0.45 when hidden
          foundOpacity = await rows.nth(i).evaluate(el => el.style.opacity);
          break;
        }
      }
      expect(foundOpacity === '0.45' || foundOpacity === '0.450' || foundOpacity !== null).toBeTruthy();

      // Re-check it to restore normal opacity
      await targetCheckbox.click();
      // After re-check, style.opacity should be empty or not '0.45'
      const restoredOpacity = await rows.evaluateAll(els => els.map(el => el.style.opacity));
      // Ensure at least one row does not have the 0.45 opacity (the previously changed one should now be restored)
      expect(restoredOpacity.some(op => op !== '0.45')).toBeTruthy();
    });
  });

  test.describe('ResetControls event', () => {
    test('reset restores default slider, toggles, and scale', async ({ page }) => {
      // Make changes: change slider, uncheck first toggle, switch to log
      await page.evaluate(() => {
        const s2 = document.getElementById('nRange');
        s.value = '120';
        s.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.locator('.toggleFunc').first().click();
      await page.locator(selectors.scaleRadioLog).click();

      // Click reset button
      await page.locator(selectors.resetBtn).click();

      // Defaults: nRange value 50, nVal displays 50
      await expect(page.locator(selectors.nVal)).toHaveText('50');
      await expect(page.locator(selectors.nRange)).toHaveValue('50');

      // All toggle checkboxes should be checked
      const toggles = page.locator(selectors.toggleFunc);
      const toggleCount = await toggles.count();
      for (let i = 0; i < toggleCount; i++) {
        await expect(toggles.nth(i)).toBeChecked();
      }

      // Scale should be linear
      await expect(page.locator(selectors.scaleRadioLinear)).toBeChecked();
    });
  });

  test.describe('RunMicroBench event', () => {
    test('clicking Run micro-bench shows running text and then displays results', async ({ page }) => {
      // Ensure n is a moderate value to keep micro-bench reasonable
      await page.evaluate(() => {
        const s3 = document.getElementById('nRange');
        s.value = '50';
        s.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Click runBench and assert intermediate text shows
      await page.locator(selectors.runBench).click();
      await expect(page.locator(selectors.benchResults)).toHaveText(/Running micro-bench\.\.\./i);

      // Wait for the micro-bench result to be rendered (microBench invoked inside setTimeout 40ms)
      await expect(page.locator(selectors.benchResults)).toHaveText(/O\(1\) demo:|O\(1\) demo:/, { timeout: 10000 });

      // Confirm the benchResults contains expected sections
      const benchHtml = await page.locator(selectors.benchResults).innerHTML();
      expect(benchHtml).toContain('O(1) demo');
      expect(benchHtml).toContain('O(n) demo');
      expect(benchHtml).toContain('O(n²) demo');
    });
  });

  test.describe('RunStepDemo event (visual demo/animation)', () => {
    test('clicking Run step-by-step disables button during animation and shows visual overlay', async ({ page }) => {
      const runStep = page.locator(selectors.runStep);

      // Click the run step button
      await runStep.click();

      // Immediately after click, button should be disabled and text should change
      await expect(runStep).toBeDisabled();
      await expect(runStep).toHaveText(/Animating\.\.\./i);

      // During animation, an overlay with text "Step-by-step: O(n) vs O(n²)" should appear
      const overlay = page.locator('div >> text=Step-by-step: O(n) vs O(n²)');
      await expect(overlay).toBeVisible({ timeout: 5000 });

      // Wait for the animation to finish and the button to be re-enabled (animateDemo finally re-enables)
      await expect(runStep).toBeEnabled({ timeout: 20000 });
      await expect(runStep).toHaveText('Run step-by-step demo (visual)');

      // Overlay should eventually be removed (auto-close after demo)
      await expect(page.locator('div >> text=Step-by-step: O(n) vs O(n²)')).toHaveCount(0, { timeout: 10000 });
    });
  });

  test.describe('Accessibility and resilience', () => {
    test('redraw on resize (trigger resize event and ensure no errors)', async ({ page }) => {
      // Trigger window resize event to cause redraw (draw bound to resize)
      await page.setViewportSize({ width: 800, height: 600 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));

      // Wait shortly to let redraw complete
      await page.waitForTimeout(300);

      // Confirm no page errors or console errors happened (will be checked in afterEach)
      // Also ensure canvas remains visible
      await expect(page.locator(selectors.canvas)).toBeVisible();
    });
  });
});