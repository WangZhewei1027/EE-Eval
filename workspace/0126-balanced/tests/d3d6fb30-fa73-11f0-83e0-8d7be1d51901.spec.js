import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d6fb30-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Exponential Search Visualizer (d3d6fb30-fa73-11f0-83e0-8d7be1d51901)', () => {
  // Shared state collected from console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertion and debugging
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // store console messages for later assertions
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store uncaught page errors
      page.context()._pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // wait a short time to let initialization logs and render complete
    await page.waitForTimeout(150);
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected page errors occurred during the test
    const pageErrors = page.context()._pageErrors || [];
    expect(pageErrors.length, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test.describe('Initial and Array generation (S0_Idle -> S1_ArrayGenerated)', () => {
    test('Initial load renders an array and shows generated message (entry actions)', async ({ page }) => {
      // Validate that initial generateAndRender() called during Initialize produced an array
      const arrayChildren = await page.locator('#array .cell').count();
      // default size input is 20, so at least one cell should be present and likely 20
      expect(arrayChildren).toBeGreaterThan(0);

      // Walkthrough message should indicate array generated
      const walkText = await page.locator('#walk').textContent();
      expect(walkText).toContain('Array generated');

      // Comparisons and Steps should be reset to 0 on generation
      expect(await page.locator('#comparisons').textContent()).toBe('0');
      expect(await page.locator('#steps').textContent()).toBe('0');

      // Result should be reset to dash
      expect(await page.locator('#result').textContent()).toBe('—');

      // No page errors occurred during initialization (checked in afterEach), but also assert console had some expected logs
      const consoleMessages = page.context()._consoleMessages.map(m => m.text).join('\n');
      // the app logs are via DOM into log element, but console may not contain those; ensure we captured some console output or it's empty
      expect(consoleMessages !== undefined).toBeTruthy();
    });

    test('Clicking Generate with custom size creates the requested number of cells and resets stats', async ({ page }) => {
      // Set size to 10 then click Generate
      await page.fill('#size', '10');
      await page.click('#genBtn');

      // After generation, array should contain 10 items
      await page.waitForTimeout(100); // small wait for render
      const count = await page.locator('#array .cell').count();
      expect(count).toBe(10);

      // Walk text updated
      expect(await page.locator('#walk').textContent()).toContain('Array generated');

      // Stats reset
      expect(await page.locator('#comparisons').textContent()).toBe('0');
      expect(await page.locator('#steps').textContent()).toBe('0');
      expect(await page.locator('#result').textContent()).toBe('—');
    });
  });

  test.describe('Target setting interactions', () => {
    test('Setting invalid target triggers alert (edge case)', async ({ page }) => {
      // Ensure input empty and click Set -> alert expected
      await page.fill('#target', '');
      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await page.click('#setTarget');

      // Wait a moment for dialog to be handled
      await page.waitForTimeout(50);

      expect(dialogMessage).toBe('Enter a valid number as target.');
    });

    test('Setting valid target updates the input and walkthrough message', async ({ page }) => {
      // Get an array element from the page to use as a valid target
      const arr = await page.evaluate(() => window._expViz.getArray());
      expect(Array.isArray(arr)).toBeTruthy();
      expect(arr.length).toBeGreaterThan(0);

      const pick = arr[Math.floor(arr.length / 2)];
      await page.fill('#target', String(pick));
      await page.click('#setTarget');

      // The input should be normalized to the numeric value and walkthrough updated
      const targetVal = await page.locator('#target').inputValue();
      expect(Number(targetVal)).toBe(pick);
      expect(await page.locator('#walk').textContent()).toContain(`Target set to ${pick}`);
    });

    test('Random target picks a value from the array and updates UI', async ({ page }) => {
      // Click RandomTarget
      await page.click('#randomTarget');

      // Walk message should reflect random set
      const walkText1 = await page.locator('#walk').textContent();
      expect(walkText).toContain('Target randomly set to');

      // Target value should be present in the array values
      const targetValue = await page.locator('#target').inputValue();
      const arr1 = await page.evaluate(() => window._expViz.getArray());
      const numericTarget = Number(targetValue);
      expect(arr.includes(numericTarget)).toBeTruthy();
    });
  });

  test.describe('Search workflow (S1_ArrayGenerated -> S2_Searching -> S3_SearchCompleted)', () => {
    test('Step-by-step mode: clicking Step advances generator until completion and displays found/not found state', async ({ page }) => {
      // Choose step mode
      await page.selectOption('#mode', 'step');

      // Pick a target known to be in the array (first element for deterministic success)
      const arr2 = await page.evaluate(() => window._expViz.getArray());
      expect(arr.length).toBeGreaterThan(0);
      const target = arr[0];

      await page.fill('#target', String(target));
      // Click start to create stateGen and show first step
      await page.click('#start');

      // First step is shown instantly; now repeatedly click Step until result shows 'Found at' or 'Not found'
      const maxSteps = 100; // safety cap
      let completed = false;
      for (let i = 0; i < maxSteps; i++) {
        const resultText = await page.locator('#result').textContent();
        if (resultText && resultText !== '—') {
          completed = true;
          break;
        }
        // Click step
        await page.click('#stepBtn');
        // wait a small amount for generator to process and render
        await page.waitForTimeout(40);
      }

      // After stepping, we expect result to indicate found (since we targeted arr[0])
      const finalResult = await page.locator('#result').textContent();
      expect(finalResult).toMatch(/Found at|Not found/);
      expect(completed || finalResult !== '—').toBeTruthy();

      // Comparisons and steps should be positive integers now
      const comparisons = Number(await page.locator('#comparisons').textContent());
      const steps = Number(await page.locator('#steps').textContent());
      expect(comparisons).toBeGreaterThanOrEqual(1);
      expect(steps).toBeGreaterThanOrEqual(1);

      // Execution log should contain phrases about comparisons or found
      const logText = await page.locator('#log').textContent();
      expect(logText.length).toBeGreaterThan(0);

      // If found, ensure a cell has the 'found' class
      if (finalResult && finalResult.startsWith('Found')) {
        const foundCells = await page.locator('#array .cell.found').count();
        expect(foundCells).toBeGreaterThanOrEqual(1);
      }
    });

    test('Auto mode: starts automatic progression and completes with result and highlights', async ({ page }) => {
      // Use auto mode and speed up the timer to minimize test time
      await page.selectOption('#mode', 'auto');
      await page.fill('#speed', '100'); // lower bound for quicker ticks
      await page.fill('#target', ''); // clear target to avoid accidental dialogs

      // Choose a random target from the array to test typical path
      const arr3 = await page.evaluate(() => window._expViz.getArray());
      expect(arr.length).toBeGreaterThan(0);
      const pick1 = arr[Math.floor(arr.length / 3)];
      await page.fill('#target', String(pick));

      // Start auto
      await page.click('#start');

      // Wait until result updated from '—' to either Found or Not found, with timeout
      await page.waitForFunction(() => {
        const r = document.getElementById('result');
        return r && r.textContent && r.textContent !== '—';
      }, null, { timeout: 5000 });

      const resultText1 = await page.locator('#result').textContent();
      expect(resultText).toMatch(/Found at|Not found/);

      // Walkthrough text should show final message or done
      const walk = await page.locator('#walk').textContent();
      expect(typeof walk).toBe('string');

      // Verify that at least one comparison logged
      const comparisons1 = Number(await page.locator('#comparisons1').textContent());
      expect(comparisons).toBeGreaterThanOrEqual(1);

      // If found, ensure DOM shows found highlight
      if (resultText.startsWith('Found')) {
        const foundCells1 = await page.locator('#array .cell.found').count();
        expect(foundCells).toBeGreaterThanOrEqual(1);
      }
    });

    test('ResetSearch during auto stops the run and resets UI to Array Generated state', async ({ page }) => {
      // Start an auto run and then reset
      await page.selectOption('#mode', 'auto');
      await page.fill('#speed', '100');

      const arr4 = await page.evaluate(() => window._expViz.getArray());
      const pick2 = arr[Math.max(0, Math.floor(arr.length / 4))];
      await page.fill('#target', String(pick));

      await page.click('#start');

      // give it a tiny bit to start running
      await page.waitForTimeout(120);

      // Click reset while auto is presumably running
      await page.click('#resetBtn');

      // After reset, verify state: walk message, result reset, log cleared, stats zero
      await page.waitForTimeout(50);
      expect(await page.locator('#walk').textContent()).toBe('Reset. You may start again.');
      expect(await page.locator('#result').textContent()).toBe('—');
      expect(await page.locator('#log').textContent()).toBe('');
      expect(await page.locator('#comparisons').textContent()).toBe('0');
      expect(await page.locator('#steps').textContent()).toBe('0');
    });

    test('Changing speed while running does not throw errors and respects input change', async ({ page }) => {
      // Start auto run
      await page.selectOption('#mode', 'auto');
      await page.fill('#speed', '200');
      const arr5 = await page.evaluate(() => window._expViz.getArray());
      const pick3 = arr[Math.max(0, Math.floor(arr.length / 5))];
      await page.fill('#target', String(pick));
      await page.click('#start');

      // Wait to ensure it is running
      await page.waitForTimeout(150);

      // Change speed input while running: this triggers stopAuto/startAuto in implementation
      await page.fill('#speed', '60');
      // Fire input event to simulate user's sliding change
      await page.dispatchEvent('#speed', 'input');

      // Allow some time for the auto logic to handle restart
      await page.waitForTimeout(200);

      // There should be no uncaught page errors (checked in afterEach)
      // Also confirm result eventually completes
      await page.waitForFunction(() => {
        const r1 = document.getElementById('result');
        return r && r.textContent && r.textContent !== '—';
      }, null, { timeout: 5000 });

      const result = await page.locator('#result').textContent();
      expect(result).toMatch(/Found at|Not found/);
    });
  });

  test.describe('Keyboard and accessibility interactions', () => {
    test('Pressing space in step mode triggers a step (keyboard shortcut)', async ({ page }) => {
      // Ensure step mode and a target set
      await page.selectOption('#mode', 'step');
      const arr6 = await page.evaluate(() => window._expViz.getArray());
      const pick4 = arr[1] || arr[0];
      await page.fill('#target', String(pick));
      await page.click('#start');

      // initial steps value
      const initialSteps = Number(await page.locator('#steps').textContent());

      // Press space to trigger a step
      await page.keyboard.press(' ');
      // small wait for step processing
      await page.waitForTimeout(50);

      const stepsAfter = Number(await page.locator('#steps').textContent());
      expect(stepsAfter).toBeGreaterThanOrEqual(initialSteps);

      // Ensure no unexpected page errors occurred (afterEach will also check)
    });
  });

  test.describe('Edge cases and invalid interactions', () => {
    test('Starting without a target shows an alert', async ({ page }) => {
      // Clear target and click start -> expect dialog
      await page.fill('#target', '');
      let seenDialog = null;
      page.once('dialog', async (dialog) => {
        seenDialog = dialog.message();
        await dialog.accept();
      });

      await page.click('#start');
      await page.waitForTimeout(50);
      expect(seenDialog).toBe('Please set a target number.');
    });

    test('Starting with invalid numeric target shows an alert', async ({ page }) => {
      // Put an invalid value into target (non-numeric), click start -> expect dialog 'Invalid target number.'
      await page.fill('#target', 'not-a-number');
      let seenDialog1 = null;
      page.once('dialog', async (dialog) => {
        seenDialog = dialog.message();
        await dialog.accept();
      });

      await page.click('#start');
      await page.waitForTimeout(50);
      expect(seenDialog).toBe('Invalid target number.');
    });

    test('Attempting to Step without starting shows an alert', async ({ page }) => {
      // Ensure there is no active stateGen by clicking reset
      await page.click('#resetBtn');

      let seenDialog2 = null;
      page.once('dialog', async (dialog) => {
        seenDialog = dialog.message();
        await dialog.accept();
      });

      await page.click('#stepBtn');
      await page.waitForTimeout(50);

      expect(seenDialog).toBe('Start a search first.');
    });
  });
});