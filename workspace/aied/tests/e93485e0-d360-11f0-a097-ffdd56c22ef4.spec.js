import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93485e0-d360-11f0-a097-ffdd56c22ef4.html';

// Page object encapsulating commonly used selectors and actions
class FibPage {
  constructor(page) {
    this.page = page;
    this.computeBtn = page.locator('#computeBtn');
    this.stopBtn = page.locator('#stopBtn');
    this.nInput = page.locator('#nInput');
    this.methodSelect = page.locator('#methodSelect');
    this.modeSelect = page.locator('#modeSelect');
    this.resultArea = page.locator('#resultArea');
    this.logArea = page.locator('#logArea');
    this.copyBtn = page.locator('#copyBtn');
    this.downloadBtn = page.locator('#downloadBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.drawBtn = page.locator('#drawBtn');
    this.chartStart = page.locator('#chartStart');
    this.chartEnd = page.locator('#chartEnd');
    this.warnBox = page.locator('#warn');
    this.canvas = page.locator('#chart');
    this.quickButtons = page.locator('[data-n]');
    this.timeStat = page.locator('#timeStat');
    this.callsStat = page.locator('#callsStat');
    this.digitsStat = page.locator('#digitsStat');
    this.ratioStat = page.locator('#ratioStat');
  }

  async goto() {
    await this.page.goto(BASE, { waitUntil: 'load' });
    // wait a moment for the initial chart draw to complete (init draws sample)
    await this.page.waitForTimeout(200);
  }

  async setN(n) {
    await this.nInput.fill(String(n));
  }

  async setMethod(methodValue) {
    await this.methodSelect.selectOption({ value: methodValue });
  }

  async setMode(modeValue) {
    await this.modeSelect.selectOption({ value: modeValue });
  }

  async clickCompute() {
    await this.computeBtn.click();
  }

  async clickStop() {
    await this.stopBtn.click();
  }

  async clickCopy() {
    await this.copyBtn.click();
  }

  async clickDownload() {
    await this.downloadBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickDraw() {
    await this.drawBtn.click();
  }

  async clickQuickExample(index = 0) {
    const btn = this.quickButtons.nth(index);
    await btn.click();
  }

  async resultText() {
    return (await this.resultArea.inputValue()).trim();
  }

  async logText() {
    return (await this.logArea.inputValue()).trim();
  }
}

// Capture console and page errors in each test
test.describe('Fibonacci Sequence Explorer - FSM and UI tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('State: Idle (S0_Idle)', () => {
    test('Initial UI is Idle: compute enabled, stop disabled, initial chart drawn', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      // Validate Idle state evidence: compute button present and enabled, stop disabled
      await expect(p.computeBtn).toBeVisible();
      await expect(p.computeBtn).toBeEnabled();
      await expect(p.stopBtn).toBeDisabled();

      // The initial sample draw runs at init(); it logs nothing (drawChart doesn't log),
      // but the init draws the sample. Verify canvas present and has non-zero size.
      const box = await p.canvas.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);

      // No uncaught page errors on load
      expect(pageErrors.length).toBe(0);

      // Some console messages may exist; record them for debugging if needed
      // But ensure there's at least the normal execution (no severe console error)
      const severe = consoleMessages.filter(m => m.type === 'error');
      expect(severe.length).toBe(0);
    });
  });

  test.describe('Transitions from Idle -> Computing -> ResultDisplayed / SequenceGenerated / ChartDrawn', () => {

    test('Compute F(n) (nth mode) shows result and stats (S0_Idle -> S1_Computing -> S3_ResultDisplayed)', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      // Set n to a small value and compute (fast doubling, nth)
      await p.setN(10);
      await p.setMethod('fast');
      await p.setMode('nth');

      // Click compute and wait for the result area to be populated with F(10)
      await p.clickCompute();

      // Wait for the resultArea to include the expected header and value "F(10) =" and "55"
      await page.waitForFunction(() => {
        const el = document.getElementById('resultArea');
        return el && el.value.includes('F(10) =') && el.value.includes('55');
      }, null, { timeout: 3000 });

      const result = await p.resultText();
      expect(result.startsWith('F(10) =')).toBeTruthy();
      expect(result).toContain('55');

      // Validate stats updated
      await expect(p.digitsStat).toContainText('Digits');
      await expect(p.timeStat).toContainText('Time:');
      // Ratio should be present for n>=1
      await expect(p.ratioStat).toContainText('Ratio');

      // After compute finished, computeBtn enabled and stopBtn disabled (exit to Idle)
      await expect(p.computeBtn).toBeEnabled();
      await expect(p.stopBtn).toBeDisabled();

      // The log should indicate computation
      const logs = await p.logText();
      expect(logs).toContain('Computed F(10)');
    });

    test('Generate full sequence (seq) displays lines and draws chart first 200 (S4_SequenceGenerated)', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      await p.setN(12);
      await p.setMethod('fast');
      await p.setMode('seq');

      await p.clickCompute();

      // Wait for result to include sequence index "12:" line
      await page.waitForFunction(() => {
        const el = document.getElementById('resultArea');
        return el && el.value.includes('12:');
      }, null, { timeout: 5000 });

      const result = await p.resultText();
      // Should contain lines like "0: 0", "1: 1", up to "12:"
      expect(result).toContain('0: 0');
      expect(result).toContain('12:');

      // The compute path calls drawChart for first up to 200 items; ensure a log entry about generation exists
      const logs = await p.logText();
      expect(logs).toContain('Generated sequence up to 12');

      // Ensure the digits stat updated for F(12)
      await expect(p.digitsStat).toContainText('F(12)');
    });

    test('Draw chart (Draw button) with small range draws and logs (S5_ChartDrawn)', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      // Set chart range small and click Draw
      await p.chartStart.fill('0');
      await p.chartEnd.fill('10');

      // Prepare to accept any dialog if it shows (shouldn't for small range)
      page.once('dialog', async dialog => {
        await dialog.accept();
      });

      await p.clickDraw();

      // Wait for log to include the draw message
      await page.waitForFunction(() => {
        const log = document.getElementById('logArea');
        return log && /Drew chart digits for k=0\.\.10/.test(log.value);
      }, null, { timeout: 3000 });

      const logs = await p.logText();
      expect(logs).toContain('Drew chart digits for k=0..10');
    });

    test('Animate mode can be stopped by user (S1_Computing -> S2_Stopped)', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      // Use animate with a moderately large n to ensure the async loop gives us time to stop.
      await p.setN(1000);
      await p.setMethod('fast');
      await p.setMode('animate');

      // Start compute
      await p.clickCompute();

      // Wait until stop button becomes enabled (meaning compute running)
      await expect(p.stopBtn).toBeEnabled({ timeout: 3000 });

      // Click stop to request cancellation
      await p.clickStop();

      // After stopping, the compute code appends "[Stopped by user]" into resultArea
      await page.waitForFunction(() => {
        const ra = document.getElementById('resultArea');
        return ra && ra.value.includes('[Stopped by user]');
      }, null, { timeout: 5000 });

      // Check that the log reports operation stopped by user
      const logs = await p.logText();
      expect(logs).toContain('Operation stopped by user');

      // Ensure stop button became disabled after click
      await expect(p.stopBtn).toBeDisabled();

      // Ensure compute button returned to enabled (idle)
      await expect(p.computeBtn).toBeEnabled();
    });
  });

  test.describe('Actions available from ResultDisplayed state', () => {
    test('Copy, Download and Clear operations work and log appropriately (S3_ResultDisplayed -> S0_Idle)', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      // Produce a small result via quick compute n=5
      await p.setN(5);
      await p.setMethod('fast');
      await p.setMode('nth');
      await p.clickCompute();

      // Wait for result to be present
      await page.waitForFunction(() => {
        const el = document.getElementById('resultArea');
        return el && el.value.includes('F(5)');
      }, null, { timeout: 3000 });

      const before = await p.resultText();
      expect(before).toContain('F(5)');

      // Attempt to copy. Browser clipboard availability may vary; the app logs success or failure.
      await p.clickCopy();
      // Wait a little for the async clipboard attempt to resolve
      await page.waitForTimeout(200);

      const logsAfterCopy = await p.logText();
      // Either success or failure is acceptable, but we assert that an attempt was logged
      const copyAttempted = logsAfterCopy.includes('Copied result to clipboard') || logsAfterCopy.includes('Copy failed');
      expect(copyAttempted).toBeTruthy();

      // Download: intercept the download event and verify filename and content
      const [ download ] = await Promise.all([
        page.waitForEvent('download'),
        p.clickDownload()
      ]);

      // Filename should be fibonacci.txt as created in the code
      expect(download.suggestedFilename()).toBe('fibonacci.txt');

      const downloadedText = await download.text();
      // The downloaded content should match the resultArea value at the time of download
      expect(downloadedText.trim()).toBe(before);

      // Clear the result and confirm the textarea is empty and a log entry exists
      await p.clickClear();

      await page.waitForFunction(() => {
        const el = document.getElementById('resultArea');
        return el && el.value === '';
      }, null, { timeout: 2000 });

      const logsAfterClear = await p.logText();
      expect(logsAfterClear).toContain('Cleared result');
    });
  });

  test.describe('Quick examples and edge cases', () => {
    test('Quick example button triggers compute for preset n (QuickExampleClick -> S3_ResultDisplayed)', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      // Click the quick example for F(10) (the fourth quick button in the markup)
      // Find the button with data-n="10"
      const btn = page.locator('button[data-n="10"]');
      await btn.click();

      // The page code will set nInput, set method to fast and mode nth and then click compute
      // Wait for result to appear
      await page.waitForFunction(() => {
        const ra = document.getElementById('resultArea');
        return ra && ra.value.includes('F(10)');
      }, null, { timeout: 5000 });

      const result = await p.resultText();
      expect(result).toContain('F(10)');
      expect(result).toContain('55');

      // Verify log mentions computed F(10)
      const logs = await p.logText();
      expect(logs).toContain('Computed F(10)');
    });

    test('Large n input > 10000 triggers warning box and caps n at 10000', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      // Set n to a value > 10000 to trigger the warn box
      await p.setN(12000);
      // Ensure fast method and nth mode to avoid confirmation dialogs
      await p.setMethod('fast');
      await p.setMode('nth');

      // Click compute. It will display the warnBox and cap n to 10000.
      // Because computing F(10000) may be expensive but fast doubling is relatively quick,
      // we allow a longer timeout.
      await p.clickCompute();

      // The warn box should be visible at some point during compute (it is set before computing)
      await expect(p.warnBox).toBeVisible();

      // Wait for the compute to finish and the result area to be populated with "F(10000) ="
      // If runtime takes long, increase timeout.
      await page.waitForFunction(() => {
        const ra = document.getElementById('resultArea');
        // allow either full result or partial log; just check the compute completed and time stat updated
        return ra && (ra.value.includes('F(10000) =') || document.getElementById('timeStat').textContent.includes('Time:'));
      }, null, { timeout: 20000 });

      // Verify warn text includes 'n capped'
      const warnText = await p.warnBox.textContent();
      expect(warnText).toContain('n capped at 10000');

      // Ensure time stat has value after compute
      await expect(p.timeStat).toContainText('Time:');
    });

    test('Draw with excessive range prompts confirm and can be dismissed without performing heavy work', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      // Set a large range > maxRange (5000) to trigger confirmation
      await p.chartStart.fill('0');
      await p.chartEnd.fill('6000');

      // When the confirm appears, dismiss it to avoid heavy computation.
      page.once('dialog', async dialog => {
        // Confirm message should mention Drawing more than
        expect(dialog.type()).toBe('confirm');
        await dialog.dismiss();
      });

      await p.clickDraw();

      // Since we dismissed, there should be no "Drew chart digits" log for that range.
      // Wait briefly then assert log does not contain that 'Drew chart digits for k=0..6000' entry.
      await page.waitForTimeout(400);
      const logs = await p.logText();
      expect(logs).not.toContain('Drew chart digits for k=0..6000');
    });
  });

  test.describe('Error observation and invariants', () => {
    test('No uncaught page errors during typical user flows (compute, draw, download)', async ({ page }) => {
      const p = new FibPage(page);
      await p.goto();

      // Perform a few typical interactions
      await p.setN(8);
      await p.setMethod('fast');
      await p.setMode('nth');
      await p.clickCompute();

      // Wait for compute to finish for n=8
      await page.waitForFunction(() => {
        return document.getElementById('resultArea').value.includes('F(8)');
      }, null, { timeout: 3000 });

      // Draw small chart range
      await p.chartStart.fill('0');
      await p.chartEnd.fill('8');
      await p.clickDraw();

      // Download result
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        p.clickDownload()
      ]);
      const text = await download.text();
      expect(text).toContain('F(8)');

      // After these interactions, assert there were no uncaught page errors.
      expect(pageErrors.length).toBe(0);

      // Also ensure no severe console 'error' messages occurred
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors.length).toBe(0);
    });
  });
});