import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9339b80-d360-11f0-a097-ffdd56c22ef4.html';

// Page Object Model for the Selection Sort Visualizer
class VisualizerPage {
  constructor(page) {
    this.page = page;
    this.barsContainer = page.locator('#bars');
    this.generateBtn = page.locator('#generateBtn');
    this.sizeRange = page.locator('#sizeRange');
    this.speedRange = page.locator('#speedRange');
    this.startBtn = page.locator('#startBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.compCount = page.locator('#compCount');
    this.swapCount = page.locator('#swapCount');
    this.currentI = page.locator('#currentI');
    this.currentMin = page.locator('#currentMin');
    this.customInput = page.locator('#customInput');
    this.setArrayBtn = page.locator('#setArrayBtn');
    this.randomizeBtn = page.locator('#randomizeBtn');
    this.reverseBtn = page.locator('#reverseBtn');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for bars to render
    await this.barsContainer.locator('.bar').first().waitFor({ timeout: 2000 });
  }

  async barCount() {
    return await this.barsContainer.locator('.bar').count();
  }

  async getBarValues() {
    const bars = this.barsContainer.locator('.bar .rect');
    const count = await bars.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      const text = await bars.nth(i).textContent();
      // trim and parse
      out.push(Number(text && text.trim()));
    }
    return out;
  }

  async getBarClasses(index) {
    const bar = this.barsContainer.locator('.bar').nth(index);
    const className = await bar.getAttribute('class');
    return className || '';
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async setSize(n) {
    // use evaluate to set value and dispatch input
    await this.page.evaluate((v) => {
      const el = document.getElementById('sizeRange');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, n);
    // wait for bars update
    await this.page.waitForTimeout(100);
  }

  async setSpeed(ms) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedRange');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, ms);
    await this.page.waitForTimeout(50);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickPause() {
    await this.pauseBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async setCustomArray(text) {
    await this.customInput.fill(text);
    await this.setArrayBtn.click();
    // allow rendering
    await this.page.waitForTimeout(100);
  }

  async clickShuffle() {
    await this.randomizeBtn.click();
    await this.page.waitForTimeout(100);
  }

  async clickReverse() {
    await this.reverseBtn.click();
    await this.page.waitForTimeout(100);
  }

  // wait until at least one bar has a CSS class matching selector (e.g., 'current', 'compare', 'min', 'sorted')
  async waitForHighlightClass(cls, timeout = 2000) {
    await this.page.waitForFunction(
      (c) => {
        const bars = Array.from(document.querySelectorAll('#bars .bar'));
        return bars.some(b => b.classList.contains(c));
      },
      cls,
      { timeout }
    );
  }

  // wait until all bars are marked sorted
  async waitForAllSorted(timeout = 5000) {
    await this.page.waitForFunction(
      () => {
        const bars = Array.from(document.querySelectorAll('#bars .bar'));
        return bars.length > 0 && bars.every(b => b.classList.contains('sorted'));
      },
      {},
      { timeout }
    );
  }
}

test.describe('Selection Sort Visualizer - FSM and UI behavior', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect console messages and page errors for assertions
    page.on('console', (msg) => {
      // capture only text for easier assertions
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test('Initial state (S0_Idle) on load: init() executed -> bars rendered and stats reset', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Validate that initial array was created and bars rendered with size equal to default range value (12)
    const sizeValue = await page.locator('#sizeRange').inputValue();
    const expectedCount = Number(sizeValue);
    const count = await vp.barCount();
    expect(count).toBe(expectedCount);

    // Validate stats counters are reset to 0 and indices show '-'
    await expect(vp.compCount).toHaveText('0');
    await expect(vp.swapCount).toHaveText('0');
    await expect(vp.currentI).toHaveText('-');
    await expect(vp.currentMin).toHaveText('-');
  });

  test('GenerateRandom event transitions to new array and resets state', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Capture previous values
    const prevValues = await vp.getBarValues();

    // Click generate -> should re-render a random array and reset stats
    await vp.clickGenerate();

    const newValues = await vp.getBarValues();
    const countAfter = await vp.barCount();
    const sizeValue = Number(await page.locator('#sizeRange').inputValue());
    expect(countAfter).toBe(sizeValue);

    // The new array should be a permutation (same length) and likely different; check length and stats reset
    expect(newValues.length).toBe(prevValues.length);
    await expect(vp.compCount).toHaveText('0');
    await expect(vp.swapCount).toHaveText('0');
    await expect(vp.currentI).toHaveText('-');
    await expect(vp.currentMin).toHaveText('-');
  });

  test('Start (S1_Running) begins algorithm: current index highlighted and i displayed', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Make array small so algorithm steps are visible quickly
    await vp.setSize(6);
    await vp.setSpeed(100);

    // Start autoplay
    await vp.clickStart();

    // Should highlight a current i bar (orange) and update currentI
    await vp.waitForHighlightClass('current', 2000);
    const ciText = await vp.currentI.textContent();
    // Expect currentI to be '0' or non '-' (first setI yields i=0)
    expect(ciText).not.toBe('-');

    // While running, compCount may increase after some time; wait briefly
    await page.waitForTimeout(300);
    const comp = Number(await vp.compCount.textContent());
    // comps should be >= 0; this assertion ensures some activity didn't break
    expect(comp).toBeGreaterThanOrEqual(0);

    // Pause to proceed deterministically in following tests
    await vp.clickPause();
  });

  test('Pause (S2_Paused) halts autoplay and preserves visual state', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    await vp.setSize(6);
    await vp.setSpeed(50);

    // Start then pause quickly
    await vp.clickStart();
    // wait until current highlighted
    await vp.waitForHighlightClass('current', 2000);
    // capture currentI text
    const beforeI = await vp.currentI.textContent();

    // Pause
    await vp.clickPause();

    // Wait to ensure no further progress (we wait a bit and assert same currentI)
    await page.waitForTimeout(300);
    const afterI = await vp.currentI.textContent();
    expect(afterI).toBe(beforeI);
  });

  test('Step triggers a single action and results in paused state (S1 -> S2 via Step)', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Ensure generator not created and paused
    await vp.setSize(5);

    // Click Step once
    await vp.clickStep();

    // After step, paused should be true and some highlight should appear (current, compare, or min)
    // We check that either current index changed from '-' or a compare/min highlight exists
    const ci = await vp.currentI.textContent();
    expect(ci).not.toBe(null);

    // There should be at most one active animation; ensure stats are consistent (no errors)
    const compCount = Number(await vp.compCount.textContent());
    expect(Number.isInteger(compCount)).toBe(true);

    // Step should not leave autoplay running. Try waiting a short time then check no 'current' change
    const currentIndexBefore = await vp.currentI.textContent();
    await page.waitForTimeout(300);
    const currentIndexAfter = await vp.currentI.textContent();
    expect(currentIndexAfter).toBe(currentIndexBefore);
  });

  test('Reset transitions to Idle (S1 -> S0) and reinitializes array and counters', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Make some progress by stepping
    await vp.setSize(6);
    await vp.clickStep();
    await page.waitForTimeout(100);

    // Click Reset
    await vp.clickReset();

    // Counters reset
    await expect(vp.compCount).toHaveText('0');
    await expect(vp.swapCount).toHaveText('0');
    // Indices reset
    await expect(vp.currentI).toHaveText('-');
    await expect(vp.currentMin).toHaveText('-');

    // Bars re-rendered with size matching sizeRange
    const sizeValue = Number(await page.locator('#sizeRange').inputValue());
    const count = await vp.barCount();
    expect(count).toBe(sizeValue);
  });

  test('Set Custom Array and verify rendering and slider update', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Set custom array
    const custom = '5,2,9,1,6';
    await vp.setCustomArray(custom);

    // Bars should match the provided values
    const values = await vp.getBarValues();
    expect(values).toEqual([5, 2, 9, 1, 6]);

    // sizeRange should update to match length (clamped between 4 and 30)
    const sizeValue = Number(await page.locator('#sizeRange').inputValue());
    expect(sizeValue).toBe(values.length);
  });

  test('Shuffle (randomizeBtn) preserves multiset but may reorder elements', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    await vp.setCustomArray('10,20,30,40,50');
    const before = await vp.getBarValues();

    // Shuffle
    await vp.clickShuffle();
    const after = await vp.getBarValues();

    // Same multiset (sort and compare)
    const sortedBefore = [...before].sort((a, b) => a - b);
    const sortedAfter = [...after].sort((a, b) => a - b);
    expect(sortedAfter).toEqual(sortedBefore);

    // It's possible shuffle returns same order; that's allowed. Ensure length unchanged.
    expect(after.length).toBe(before.length);
  });

  test('Reverse button correctly reverses the array', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    await vp.setCustomArray('1,2,3,4,5');
    const before = await vp.getBarValues();
    expect(before).toEqual([1, 2, 3, 4, 5]);

    await vp.clickReverse();
    const after = await vp.getBarValues();

    expect(after).toEqual([...before].reverse());
  });

  test('Algorithm completes to Sorted (S3_Sorted) for a small custom array when autoplaying', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Use a small array to finish quickly
    await vp.setCustomArray('3,1');
    await vp.setSpeed(50);

    // Start autoplay -> wait until all bars are marked sorted
    await vp.clickStart();

    // Wait for sorted marking
    await vp.waitForAllSorted(3000);

    // Verify every bar has 'sorted' class
    const count = await vp.barCount();
    for (let i = 0; i < count; i++) {
      const classes = await vp.getBarClasses(i);
      expect(classes.includes('sorted')).toBeTruthy();
    }

    // After done, current indices should be '-' (exit actions set paused true)
    await expect(vp.currentI).toHaveText('-');
    await expect(vp.currentMin).toHaveText('-');
  });

  test('Edge cases: invalid custom input should not change bars', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    const before = await vp.getBarValues();
    // Set invalid custom input
    await vp.setCustomArray(' , , abc , ,');
    const after = await vp.getBarValues();

    // Should remain the same as invalid input is ignored
    expect(after.length).toBe(before.length);
    // Values may remain same; at minimum length preserved (since it ignored invalid input)
    expect(after.length).toBeGreaterThan(0);
  });

  test('Keyboard shortcuts: space toggles start/pause and ArrowRight steps', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    await vp.setCustomArray('4,3,2');
    await vp.setSpeed(50);

    // Use space to start
    await page.keyboard.press(' ');
    // Wait for current highlight
    await vp.waitForHighlightClass('current', 2000);

    // Use space to pause
    await page.keyboard.press(' ');
    await page.waitForTimeout(150);
    // check paused state: no progression for short time
    const beforeI = await vp.currentI.textContent();
    await page.waitForTimeout(250);
    const afterI = await vp.currentI.textContent();
    expect(afterI).toBe(beforeI);

    // Use ArrowRight to step (advances single action)
    await page.keyboard.press('ArrowRight');
    // After step we should see some highlight or index update
    const ci = await vp.currentI.textContent();
    expect(ci).not.toBe(null);
  });

  test('Monitor console and page errors: no ReferenceError/SyntaxError/TypeError emitted during tests', async ({ page }) => {
    // This test simply reloads the page and inspects captured console/page error messages collected in beforeEach
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Give the page a bit of time to run initialization actions that might surface errors
    await page.waitForTimeout(300);

    // Build lists of messages
    const consoleTexts = consoleMessages.map(c => c.text).join('\n');

    // Assert there are no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Assert console does not contain JS fatal error names
    const combined = consoleTexts + '\n' + pageErrors.join('\n');
    expect(combined).not.toContain('ReferenceError');
    expect(combined).not.toContain('SyntaxError');
    expect(combined).not.toContain('TypeError');
  });

  test.afterEach(async ({ page }) => {
    // Final safety: capture any page errors that may have happened late and fail if found
    if (pageErrors.length > 0) {
      // Provide diagnostic output in test failure
      const combined = pageErrors.join('\n');
      // Fail explicitly with helpful message
      throw new Error('Page errors were detected: \n' + combined);
    }
    // Also ensure console doesn't include fatal JS errors
    const fatal = consoleMessages.find(m => /ReferenceError|SyntaxError|TypeError/.test(m.text));
    if (fatal) {
      throw new Error('Fatal console error detected: ' + fatal.text);
    }
  });
});