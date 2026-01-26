import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d6ad11-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Linear Search — Interactive Demo (d3d6ad11-fa73-11f0-83e0-8d7be1d51901)', () => {
  // Collect console messages and page errors for each test to validate runtime health.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Go to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial script has had a chance to run
    await page.waitForTimeout(50);
  });

  test.afterEach(async ({ page }) => {
    // Attach console and page error info to the test output if something unexpected occurred.
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Page errors captured:', pageErrors);
    }
    if (consoleMessages.some(m => m.type === 'error')) {
      // eslint-disable-next-line no-console
      console.error('Console errors captured:', consoleMessages.filter(m => m.type === 'error'));
    }
  });

  test.describe('Initialization and Idle state (S0_Idle)', () => {
    test('should initialize the array on load and show initial stats (Idle)', async ({ page }) => {
      // Validate the createArray(Number(sizeRange.value)) entry action happened on load:
      // - Array element count equals size input value (default 10)
      const sizeValue = await page.locator('#size').evaluate(el => el.value);
      const cells = page.locator('#array .cell');
      await expect(cells).toHaveCount(Number(sizeValue));

      // Stats should show comparisons 0 and index checked as '—'
      await expect(page.locator('#comparisons')).toHaveText('0');
      await expect(page.locator('#indexChecked')).toHaveText('—');

      // Console initialization message should be present (info)
      const infoMsgs = consoleMessages.filter(m => m.type === 'info' && m.text.includes('Linear Search Demo initialized'));
      expect(infoMsgs.length).toBeGreaterThanOrEqual(1);

      // There should be no uncaught page errors on init
      expect(pageErrors.length).toBe(0);
      // No console.error should be emitted on init
      expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
    });

    test('changing array size (input #size) updates the control title and generate creates new array', async ({ page }) => {
      // Change the size range value to 5 programmatically and dispatch input event
      await page.locator('#size').evaluate((el) => {
        el.value = '5';
        const ev = new Event('input', { bubbles: true });
        el.dispatchEvent(ev);
      });

      // The title attribute should be updated (sizeRange.title = val)
      const title = await page.locator('#size').evaluate(el => el.title);
      expect(title).toBe('5');

      // Click Generate to create a new array of length 5
      await page.locator('#gen').click();
      await page.waitForTimeout(50);
      await expect(page.locator('#array .cell')).toHaveCount(5);
    });
  });

  test.describe('GenerateArray event', () => {
    test('clicking Generate produces a new array and stops any running activity', async ({ page }) => {
      // Capture initial first cell value
      const firstValBefore = await page.locator('#array .cell .val').first().textContent();

      // Start playing to ensure generate stops running activity (set a very slow speed to allow it to start)
      await page.locator('#speed').evaluate(el => { el.value = '500'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      // Ensure there is a target to avoid alert on play: set target to '0' (may or may not be present)
      await page.locator('#target').fill('0');

      // Click Play: it will start playing; then clicking Generate should stop all
      await page.locator('#play').click();
      // wait a little for play to begin
      await page.waitForTimeout(80);

      // Click Generate: the page's genBtn event handler should call stopAll then createArray
      await page.locator('#gen').click();
      await page.waitForTimeout(50);

      const firstValAfter = await page.locator('#array .cell .val').first().textContent();
      // The array should have been re-rendered and likely the first value has changed (random)
      // It's possible by chance it's the same; at minimum the array length should equal size input
      const sizeValue = Number(await page.locator('#size').evaluate(el => el.value));
      await expect(page.locator('#array .cell')).toHaveCount(sizeValue);

      // Ensure the 'playing' UI was reset: play button text should be 'Play'
      await expect(page.locator('#play')).toHaveText('Play');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Editing cells (EditCell event)', () => {
    test('clicking a cell opens prompt and updates its value (and keyboard Enter triggers edit)', async ({ page }) => {
      // Intercept the dialog and accept with value '42' for the first cell
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('42');
      });

      // Click first cell to trigger prompt
      await page.locator('#array .cell').first().click();
      await page.waitForTimeout(50);

      // Verify the first cell's displayed value is '42'
      const firstText = (await page.locator('#array .cell .val').first().textContent()).trim();
      expect(firstText).toBe('42');

      // Now test keyboard Enter triggers the same prompt on second cell
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('hello');
      });

      // Focus second cell and press Enter
      const secondCell = page.locator('#array .cell').nth(1);
      await secondCell.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(50);

      const secondText = (await page.locator('#array .cell .val').nth(1).textContent()).trim();
      expect(secondText).toBe('hello');

      // No page errors occurred from using prompt/edit
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Input target and error cases (InputTarget)', () => {
    test('Starting or stepping with empty target triggers alert', async ({ page }) => {
      // Ensure target is empty
      await page.locator('#target').fill('');

      // Listen for alert on Start
      let alertMessage = null;
      page.once('dialog', async dialog => {
        alertMessage = dialog.message();
        expect(dialog.type()).toBe('alert');
        await dialog.accept();
      });

      await page.locator('#start').click();
      // wait a bit for alert handling
      await page.waitForTimeout(50);

      expect(alertMessage).toContain('Please enter a valid target');

      // Similarly stepping with empty target shows alert
      alertMessage = null;
      page.once('dialog', async dialog => {
        alertMessage = dialog.message();
        expect(dialog.type()).toBe('alert');
        await dialog.accept();
      });

      await page.locator('#step').click();
      await page.waitForTimeout(50);
      expect(alertMessage).toContain('Please enter a valid target');
    });
  });

  test.describe('StartSearch and Searching state (S1_Searching)', () => {
    test('Start should run to completion and mark found element (startSearch -> S1 -> S4)', async ({ page }) => {
      // Edit first cell to a known numeric value 7
      page.once('dialog', async dialog => dialog.accept('7'));
      await page.locator('#array .cell').first().click();
      await page.waitForTimeout(50);

      // Set target to '7'
      await page.locator('#target').fill('7');

      // Make speed very fast to finish quickly
      await page.locator('#speed').evaluate(el => { el.value = '50'; el.dispatchEvent(new Event('input', { bubbles: true })); });

      // Click Start: this will call startSearch() and runLoop -> scheduleNext
      await page.locator('#start').click();

      // Wait for the demo to mark the found cell and finalize
      await page.waitForFunction(() => {
        const res = document.querySelector('#result');
        return res && res.textContent && res.textContent.trim() !== '—';
      }, null, { timeout: 2000 });

      // Verify result reflects index 0
      const result = (await page.locator('#result').textContent()).trim();
      expect(result.includes('0')).toBeTruthy();

      // The first cell should have class 'match'
      const firstClass = await page.locator('#array .cell').first().getAttribute('class');
      expect(firstClass).toContain('match');

      // After finalize, playing should be false and play button text should be 'Play'
      await expect(page.locator('#play')).toHaveText('Play');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Stepping behavior (S2_Stepping)', () => {
    test('Step repeatedly will traverse array and finish with Not found when target absent', async ({ page }) => {
      // Ensure target is a unique unlikely value '___NOT_PRESENT___'
      await page.locator('#target').fill('___NOT_PRESENT___');

      // Reset any running state
      await page.locator('#reset').click();
      await page.waitForTimeout(50);

      // Count cells
      const count = await page.locator('#array .cell').count();

      // Click Step repeatedly until completion: we expect result to become 'Not found'
      for (let i = 0; i < count + 1; i++) {
        await page.locator('#step').click();
        // small delay to let UI update
        await page.waitForTimeout(20);
      }

      // After stepping through all indices, result should be 'Not found'
      const resText = (await page.locator('#result').textContent()).trim();
      expect(resText === 'Not found').toBeTruthy();

      // All cells should have either match or nomatch class; because target absent, expect nomatch on all
      const classes = await page.locator('#array .cell').evaluateAll(nodes => nodes.map(n => n.className));
      expect(classes.every(c => c.includes('nomatch'))).toBeTruthy();

      // Comparisons should be equal to number of cells
      const comparisons = Number((await page.locator('#comparisons').textContent()).trim());
      expect(comparisons).toBeGreaterThanOrEqual(count);

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Play behavior (S3_Playing) and mode ALL', () => {
    test('Play automatically steps and respects "all" mode to find multiple matches', async ({ page }) => {
      // Reset state
      await page.locator('#reset').click();
      await page.waitForTimeout(50);

      // Set mode to 'all'
      await page.selectOption('#mode', 'all');

      // Make two cells have the same value '999'
      page.once('dialog', async d => d.accept('999'));
      await page.locator('#array .cell').nth(0).click();
      await page.waitForTimeout(20);
      page.once('dialog', async d => d.accept('999'));
      await page.locator('#array .cell').nth(2).click();
      await page.waitForTimeout(20);

      // Set the target to 999
      await page.locator('#target').fill('999');

      // Speed up play to 30ms
      await page.locator('#speed').evaluate(el => { el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.waitForTimeout(10);

      // Click Play to start
      await page.locator('#play').click();

      // Wait until result contains two indices (0 and 2) or timeout
      await page.waitForFunction(() => {
        const r = document.querySelector('#result');
        return r && /0/.test(r.textContent || '') && /2/.test(r.textContent || '');
      }, null, { timeout: 3000 });

      const resultText = (await page.locator('#result').textContent()).trim();
      expect(resultText.includes('0')).toBeTruthy();
      expect(resultText.includes('2')).toBeTruthy();

      // Ensure play button text toggled to 'Pause' while playing and then back to 'Play' after finalize
      // After finding all matches it should finalize. Confirm final state is not playing
      await page.waitForTimeout(50);
      await expect(page.locator('#play')).toHaveText('Play');

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('ResetSearch (transition to S0_Idle)', () => {
    test('Reset should stop activity and clear highlights/stats', async ({ page }) => {
      // Ensure a target is present and start search to create state
      page.once('dialog', async d => d.accept('7'));
      await page.locator('#array .cell').first().click();
      await page.locator('#target').fill('7');
      await page.locator('#start').click();

      // Wait a short moment and then reset
      await page.waitForTimeout(80);
      await page.locator('#reset').click();

      // After reset: comparisons = 0, indexChecked = '—', result = '—'
      await expect(page.locator('#comparisons')).toHaveText('0');
      await expect(page.locator('#indexChecked')).toHaveText('—');
      await expect(page.locator('#result')).toHaveText('—');

      // No cell should contain highlight/match/nomatch (classes cleared)
      const classes = await page.locator('#array .cell').evaluateAll(nodes => nodes.map(n => n.className));
      // They may still have base 'cell' class only
      expect(classes.every(c => c.trim().startsWith('cell'))).toBeTruthy();

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Other controls and UI feedback', () => {
    test('Speed range input updates label text', async ({ page }) => {
      // Change speed value and dispatch input
      await page.locator('#speed').evaluate(el => {
        el.value = '123';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // speedLabel should update to '123ms'
      await expect(page.locator('#speedLabel')).toHaveText('123ms');
    });

    test('Changing search mode select updates internal control (UI reflects selection)', async ({ page }) {
      await page.selectOption('#mode', 'all');
      // The selected option should be 'all'
      const modeValue = await page.locator('#mode').evaluate(el => el.value);
      expect(modeValue).toBe('all');

      // No errors occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Sanity check: no runtime errors or uncaught exceptions', () => {
    test('should have no console.error messages or uncaught page errors during interactions', async ({ page }) => {
      // Perform a sequence of common interactions to exercise the app
      await page.locator('#size').evaluate(el => { el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.locator('#gen').click();
      await page.waitForTimeout(30);
      // Edit a cell
      page.once('dialog', async d => d.accept('5'));
      await page.locator('#array .cell').first().click();
      await page.locator('#target').fill('5');
      // Step once
      await page.locator('#step').click();
      await page.waitForTimeout(50);

      // Collect any console errors
      const errorMsgs = consoleMessages.filter(m => m.type === 'error');
      // Expect there are no console.error logs
      expect(errorMsgs.length).toBe(0);
      // Expect there are no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

});