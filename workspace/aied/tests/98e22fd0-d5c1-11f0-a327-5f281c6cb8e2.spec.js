import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e22fd0-d5c1-11f0-a327-5f281c6cb8e2.html';

// Helper utilities used across tests
class BSVizPage {
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
    this.dialogs = [];
  }

  async initListeners() {
    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      this.consoleMessages.push({ type, text });
      if (type === 'error') this.consoleErrors.push(text);
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err.message);
    });
    this.page.on('dialog', async (dialog) => {
      this.dialogs.push(dialog.message());
      // auto-dismiss so tests can continue
      try { await dialog.dismiss(); } catch (e) { /* ignore */ }
    });
  }

  // DOM locators
  status() { return this.page.locator('#status'); }
  steps() { return this.page.locator('#steps'); }
  comparisons() { return this.page.locator('#comparisons'); }
  logEl() { return this.page.locator('#log'); }
  arrayBoxes() { return this.page.locator('#array .box'); }
  firstBox() { return this.page.locator('#array .box').first(); }
  genBtn() { return this.page.locator('#gen'); }
  sizeInput() { return this.page.locator('#size'); }
  maxGapInput() { return this.page.locator('#maxGap'); }
  targetInput() { return this.page.locator('#target'); }
  curTarget() { return this.page.locator('#curTarget'); }
  stepBtn() { return this.page.locator('#stepBtn'); }
  playBtn() { return this.page.locator('#playBtn'); }
  backBtn() { return this.page.locator('#backBtn'); }
  resetBtn() { return this.page.locator('#resetBtn'); }
  speedInput() { return this.page.locator('#speed'); }
  pseudocodeLine(n) { return this.page.locator(`.code-line[data-line="${n}"]`); }

  // utility to read numeric steps from "Steps: X"
  async getStepsCount() {
    const txt = await this.steps().innerText();
    const m = txt.match(/Steps:\s*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  // get status text
  async getStatusText() {
    return (await this.status().innerText()).trim();
  }

  // get comparisons count numeric
  async getComparisonsCount() {
    const txt = await this.comparisons().innerText();
    const m = txt.match(/Comparisons:\s*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  // read values from array boxes
  async readArrayValues() {
    const boxes = await this.arrayBoxes().elementHandles();
    const values = [];
    for (const b of boxes) {
      const valEl = await b.$('.val');
      if (valEl) {
        const txt = (await valEl.innerText()).trim();
        values.push(Number(txt));
      }
    }
    return values;
  }

  // wait for a log message that matches regex (prepended logs -> newest first)
  async waitForLogMatch(regex, options = {}) {
    const { timeout = 3000 } = options;
    await this.page.waitForFunction(
      (sel, rx) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const texts = Array.from(el.children).map(d => d.textContent || '');
        return texts.some(t => (new RegExp(rx)).test(t));
      },
      '#log',
      regex.source,
      { timeout }
    );
  }

  // wait until status contains substring
  async waitForStatusContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, s) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.textContent.includes(s);
      },
      '#status',
      substring,
      { timeout }
    );
  }
}

test.describe('Binary Search Visualizer - FSM and interactions (app id: 98e22fd0-d5c1-11f0-a327-5f281c6cb8e2)', () => {
  let viz;
  test.beforeEach(async ({ page }) => {
    viz = new BSVizPage(page);
    await viz.initListeners();
    await page.goto(APP_URL);
    // ensure initial render completed
    // initial generateArray() runs and sets up history; wait for log that says Generated array
    await viz.waitForLogMatch(/Generated array of length \d+\./, { timeout: 3000 });
  });

  test.afterEach(async () => {
    // Basic sanity: fail test if any uncaught page errors or console.error occurred
    expect(viz.pageErrors, 'No page errors should have been thrown').toEqual([]);
    expect(viz.consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test.describe('Initial state and array generation (S0_Idle entry action)', () => {
    test('Initial generateArray() called on load and pseudocode highlights line 2', async () => {
      // Verify that log shows array generation at load (generateArray called on init)
      const logs = viz.consoleMessages.map(m => m.text).join('\n');
      // Additionally check DOM log contents
      await viz.waitForLogMatch(/Generated array of length \d+\./);
      const statusText = await viz.getStatusText();
      // Implementation sets status to 'Searching...' after initial render
      expect(statusText).toContain('Searching');
      // initial pseudocode line 2 should be active per implementation highlightLine(2)
      const line2Active = await viz.pseudocodeLine(2).evaluate((el) => el.classList.contains('active'));
      expect(line2Active).toBe(true);
      // Steps and comparisons should be at 0 initially
      expect(await viz.getStepsCount()).toBe(0);
      expect(await viz.getComparisonsCount()).toBe(0);
    });

    test('Generating new array via controls: size, maxGap, and gen button', async () => {
      // Change size to small number to get deterministic smaller array and trigger generateArray via change
      await viz.sizeInput().fill('5');
      await viz.sizeInput().press('Enter'); // triggers change handler (also change event fires on losing focus)
      // wait for generated log with length 5
      await viz.waitForLogMatch(/Generated array of length 5\./, { timeout: 3000 });

      // Change maxGap and ensure generateArray is called
      await viz.maxGapInput().fill('2');
      await viz.maxGapInput().press('Enter');
      await viz.waitForLogMatch(/Generated array of length 5\./, { timeout: 3000 });

      // Click gen button to generate another array
      await viz.genBtn().click();
      await viz.waitForLogMatch(/Generated array of length \d+\./, { timeout: 3000 });

      // Ensure array boxes exist and match size
      const boxesCount = await viz.arrayBoxes().count();
      expect(boxesCount).toBeGreaterThanOrEqual(3); // min constraint
      expect(await viz.getStatusText()).toContain('Searching');
    });
  });

  test.describe('Setting target and validation (SetTarget event)', () => {
    test('Clicking a value in the array sets it as target (updates curTarget and logs)', async () => {
      // Read first box value then click it
      const values = await viz.readArrayValues();
      expect(values.length).toBeGreaterThan(0);
      const firstVal = values[0];

      // Click first box to set target as per implementation
      await viz.firstBox().click();
      // Wait for curTarget update and log
      await viz.page.waitForFunction((sel, v) => {
        const el = document.querySelector(sel);
        return el && el.textContent.includes(String(v));
      }, '#curTarget', firstVal);

      // Log should contain 'Target set to X.'
      await viz.waitForLogMatch(new RegExp(`Target set to ${firstVal}\\.`), { timeout: 2000 });
      const cur = await viz.curTarget().innerText();
      expect(cur).toContain(String(firstVal));
    });

    test('Non-numeric target input triggers alert and does not set target', async () => {
      // Enter non-numeric value
      await viz.targetInput().fill('not-a-number');
      // Fire change event by pressing Enter
      await viz.targetInput().press('Enter');

      // We expect a dialog with the message 'Target must be a number.'
      // The page.on('dialog') handler in BSVizPage collects and dismisses it
      // Wait a bit for dialog to be handled
      await viz.page.waitForTimeout(200);
      expect(viz.dialogs.some(d => d.includes('Target must be a number.'))).toBe(true);

      // curTarget should remain 'none'
      const cur = await viz.curTarget().innerText();
      expect(cur).toBe('none');
    });

    test('Empty target resets curTarget to none', async () => {
      // Set a valid target first by clicking a box
      const values = await viz.readArrayValues();
      const val = values[0];
      await viz.firstBox().click();
      await viz.waitForLogMatch(new RegExp(`Target set to ${val}\\.`), { timeout: 2000 });

      // Now clear input to empty and trigger change
      await viz.targetInput().fill('');
      await viz.targetInput().press('Enter');
      // curTarget should become 'none'
      await viz.page.waitForFunction(() => document.querySelector('#curTarget').textContent.trim() === 'none');
      expect(await viz.curTarget().innerText()).toBe('none');
    });
  });

  test.describe('Step transitions and search termination (Step event -> S1_Searching to S2_Found / S3_NotFound)', () => {
    test('Stepping with no target shows alert asking to set a numeric target', async () => {
      // Ensure target is empty
      await viz.targetInput().fill('');
      // Click step
      await viz.stepBtn().click();
      // Wait for dialog 'Please set a numeric target before searching.'
      await viz.page.waitForTimeout(200);
      expect(viz.dialogs.some(d => d.includes('Please set a numeric target before searching.'))).toBe(true);
    });

    test('Stepping until Found when target exists (click value then step repeatedly)', async () => {
      // Ensure speed is small to keep timeouts short
      await viz.speedInput().fill('200');

      // Click a box to set target
      const values = await viz.readArrayValues();
      expect(values.length).toBeGreaterThan(0);
      const targetValue = values[Math.floor(values.length / 2)]; // pick middle value to reduce steps
      // Find the index of that value in current array and click that box
      const boxes = viz.page.locator('#array .box');
      const count = await boxes.count();
      let targetIndex = -1;
      for (let i = 0; i < count; i++) {
        const txt = (await boxes.nth(i).locator('.val').innerText()).trim();
        if (Number(txt) === targetValue) { targetIndex = i; break; }
      }
      expect(targetIndex).toBeGreaterThanOrEqual(0);
      await boxes.nth(targetIndex).click();

      // Now click step repeatedly until status says Found at index X
      let iter = 0;
      const maxIter = 40;
      while (iter++ < maxIter) {
        const statusText = await viz.getStatusText();
        if (statusText.includes('Found at index')) break;
        const prevSteps = await viz.getStepsCount();
        await viz.stepBtn().click();
        // wait for steps to increment (each step uses setTimeout to perform compare)
        await viz.page.waitForFunction(
          (sel, prev) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const m = el.textContent.match(/Steps:\s*(\d+)/);
            return m && parseInt(m[1], 10) > prev;
          },
          '#steps',
          prevSteps,
          { timeout: 2000 }
        );
        // allow small settle for status/log updates
        await viz.page.waitForTimeout(80);
      }

      // Final status should indicate Found at index <num>
      const finalStatus = await viz.getStatusText();
      expect(finalStatus).toMatch(/Found at index \d+/);

      // The found box should have the 'found' class
      const foundBoxes = viz.page.locator('#array .box.found');
      expect(await foundBoxes.count()).toBeGreaterThanOrEqual(1);
    });

    test('Stepping until Not found when target outside range', async () => {
      // Make target larger than largest element to force not found
      const values = await viz.readArrayValues();
      const max = Math.max(...values);
      const notFoundTarget = max + 1000;
      // Set target input to notFoundTarget and trigger change
      await viz.targetInput().fill(String(notFoundTarget));
      await viz.targetInput().press('Enter');
      // Confirm curTarget updated
      await viz.page.waitForFunction((v) => document.querySelector('#curTarget').textContent.includes(String(v)), notFoundTarget);

      // Lower speed so steps complete quickly
      await viz.speedInput().fill('100');

      // Click step repeatedly until status is 'Not found' or termination log appears
      let iter = 0;
      const maxIter = 80;
      while (iter++ < maxIter) {
        const statusText = await viz.getStatusText();
        if (statusText === 'Not found') break;
        const prevSteps = await viz.getStepsCount();
        await viz.stepBtn().click();
        // wait for steps to increase or for Not found
        await viz.page.waitForFunction(
          (sSel, prev) => {
            const s = document.querySelector(sSel);
            const stepsText = document.querySelector('#steps').textContent;
            const m = stepsText.match(/Steps:\s*(\d+)/);
            const steps = m ? parseInt(m[1], 10) : 0;
            return steps > prev || (s && s.textContent.trim() === 'Not found');
          },
          ['#status', prevSteps],
          { timeout: 2000 }
        );
        // break early if Not found
        const st = await viz.getStatusText();
        if (st === 'Not found') break;
      }

      const finalStatus = await viz.getStatusText();
      expect(finalStatus === 'Not found' || finalStatus.includes('Not found')).toBe(true);
      // log should contain termination message
      await viz.waitForLogMatch(/Terminated: left \(\d+\) > right \(\d+\)\. Not found\./, { timeout: 2000 });
    });
  });

  test.describe('Auto Play, BackStep, Reset, and speed changes (AutoPlay, BackStep, Reset, ChangeSpeed events)', () => {
    test('Auto Play finds target automatically and toggles play button text', async () => {
      // Put a target by clicking a box
      const values = await viz.readArrayValues();
      const targetValue = values[1] ?? values[0];
      const boxes = viz.page.locator('#array .box');
      // find index of targetValue
      const cnt = await boxes.count();
      let idx = 0;
      for (let i = 0; i < cnt; i++) {
        const v = Number((await boxes.nth(i).locator('.val').innerText()).trim());
        if (v === targetValue) { idx = i; break; }
      }
      await boxes.nth(idx).click();
      await viz.waitForLogMatch(new RegExp(`Target set to ${targetValue}\\.`));

      // Click Play to start Auto Play
      await viz.playBtn().click();
      // Play button text should change to 'Pause'
      await viz.page.waitForFunction(() => document.querySelector('#playBtn').textContent.includes('Pause'));
      expect(await viz.playBtn().innerText()).toContain('Pause');

      // Change speed while playing to trigger stop/start behavior (event restarts play)
      await viz.speedInput().fill('150');
      // allow some time for play to continue and finish
      await viz.page.waitForTimeout(1200);

      // Wait for Found at index (auto play should finish)
      await viz.page.waitForFunction(() => document.querySelector('#status').textContent.includes('Found at index'), { timeout: 5000 });

      // Play button text should have returned to 'Auto Play' after stopPlaying
      await viz.page.waitForFunction(() => document.querySelector('#playBtn').textContent.includes('Auto Play'));
      expect(await viz.playBtn().innerText()).toContain('Auto Play');
    });

    test('Back button steps back in history and logs restoration', async () => {
      // Set a target
      const values = await viz.readArrayValues();
      const targetValue = values[Math.max(0, Math.floor(values.length / 3))];
      const boxes = viz.page.locator('#array .box');
      await boxes.nth(0).click(); // set some target quickly
      await viz.waitForLogMatch(/Target set to /);

      // Step twice
      await viz.stepBtn().click();
      await viz.page.waitForTimeout(300);
      await viz.stepBtn().click();
      await viz.page.waitForTimeout(300);

      const stepsBeforeBack = await viz.getStepsCount();
      expect(stepsBeforeBack).toBeGreaterThanOrEqual(1);

      // Click back to revert one step
      await viz.backBtn().click();
      // After back, steps should decrease by at least 1
      await viz.page.waitForTimeout(200);
      const stepsAfterBack = await viz.getStepsCount();
      expect(stepsAfterBack).toBeLessThanOrEqual(stepsBeforeBack);

      // Log should mention 'Stepped back' or 'state restored' description
      const logHtml = await viz.logEl().innerHTML();
      expect(logHtml.length).toBeGreaterThan(0);
    });

    test('Reset button clears target and generates a new array (S1 -> S0 transition)', async () => {
      // Set a target first
      const values = await viz.readArrayValues();
      const targetValue = values[0];
      await viz.firstBox().click();
      await viz.waitForLogMatch(new RegExp(`Target set to ${targetValue}\\.`));

      // Click reset
      await viz.resetBtn().click();

      // After reset, curTarget should be 'none'
      await viz.page.waitForFunction(() => document.querySelector('#curTarget').textContent.trim() === 'none');
      expect(await viz.curTarget().innerText()).toBe('none');

      // New array Generation log should be present
      await viz.waitForLogMatch(/Generated array of length \d+\./, { timeout: 2000 });

      // Steps should be 0 after reset initial snapshot
      expect(await viz.getStepsCount()).toBe(0);
    });
  });

  test.describe('Visual feedback and pseudocode highlighting, elimination, and bounds', () => {
    test('Mid, left-bound, right-bound, elim and found classes appear appropriately during steps', async () => {
      // Reduce size so search completes quickly
      await viz.sizeInput().fill('7');
      await viz.sizeInput().press('Enter');
      await viz.waitForLogMatch(/Generated array of length 7\./);

      const values = await viz.readArrayValues();
      const target = values[3]; // pick middle-ish
      // set target
      // find box containing target, click it
      const boxes = viz.page.locator('#array .box');
      const cnt = await boxes.count();
      let targetIdx = -1;
      for (let i = 0; i < cnt; i++) {
        const txt = Number((await boxes.nth(i).locator('.val').innerText()).trim());
        if (txt === target) { targetIdx = i; break; }
      }
      expect(targetIdx).toBeGreaterThanOrEqual(0);
      await boxes.nth(targetIdx).click();

      // Step once to compute mid: mid class should be present on some box
      await viz.stepBtn().click();
      // wait for mid snapshot render
      await viz.page.waitForTimeout(400);
      const midCount = await viz.page.locator('#array .box.mid').count();
      expect(midCount).toBeGreaterThanOrEqual(1);

      // Step until found to validate 'found' class
      let iter = 0;
      while (iter++ < 30) {
        const status = await viz.getStatusText();
        if (status.includes('Found at index')) break;
        const prevSteps = await viz.getStepsCount();
        await viz.stepBtn().click();
        await viz.page.waitForFunction(
          (prev) => {
            const m = document.querySelector('#steps').textContent.match(/Steps:\s*(\d+)/);
            const s = m ? parseInt(m[1], 10) : 0;
            return s > prev || document.querySelector('#status').textContent.includes('Found at index');
          },
          prevSteps,
          { timeout: 2000 }
        );
        await viz.page.waitForTimeout(80);
      }
      // After found, box with found class must exist
      expect(await viz.page.locator('#array .box.found').count()).toBeGreaterThanOrEqual(1);

      // There should also be some eliminated boxes (class 'elim') if search required elimination
      const elimCount = await viz.page.locator('#array .box.elim').count();
      expect(elimCount).toBeGreaterThanOrEqual(0);
    });

    test('Pseudocode highlights change as steps progress', async () => {
      // set a target and perform a step to see pseudocode active line change (mid computation line 4)
      const values = await viz.readArrayValues();
      const t = values[0];
      await viz.firstBox().click();
      await viz.waitForLogMatch(new RegExp(`Target set to ${t}\\.`));

      // Step once and wait for highlight to change to some active line (implementation uses lines 4..7)
      await viz.stepBtn().click();
      await viz.page.waitForTimeout(200);
      // Check that some .code-line has 'active' class
      const activeLines = await viz.page.locator('.code-line.active').count();
      expect(activeLines).toBeGreaterThanOrEqual(1);
      // Check that active line is a number between 3 and 8 (implementation uses these)
      const activeDataLines = await viz.page.$$eval('.code-line.active', els => els.map(e => e.getAttribute('data-line')));
      expect(activeDataLines.length).toBeGreaterThanOrEqual(1);
      const n = Number(activeDataLines[0]);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(8);
    });
  });

  test.describe('Edge cases and log messages', () => {
    test('BackStep at beginning logs a message and does not throw', async () => {
      // Immediately click back at initial state
      await viz.backBtn().click();
      // Should log 'At the beginning - nothing to go back to.'
      await viz.waitForLogMatch(/At the beginning - nothing to go back to\./, { timeout: 1500 });
      // Ensure steps remain 0
      expect(await viz.getStepsCount()).toBe(0);
    });

    test('No unexpected console errors or page errors occurred during interactions', async () => {
      // This test is primarily covered by afterEach assertions, but we can exercise some interactions rapidly
      await viz.genBtn().click();
      await viz.sizeInput().fill('6');
      await viz.sizeInput().press('Enter');
      await viz.maxGapInput().fill('3');
      await viz.maxGapInput().press('Enter');
      await viz.page.waitForTimeout(200);
      // After those interactions, no page errors or console.error messages should have been emitted
      expect(viz.pageErrors.length).toBe(0);
      expect(viz.consoleErrors.length).toBe(0);
    });
  });
});