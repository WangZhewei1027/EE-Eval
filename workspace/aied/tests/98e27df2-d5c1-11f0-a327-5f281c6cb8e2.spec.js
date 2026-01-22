import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e27df2-d5c1-11f0-a327-5f281c6cb8e2.html';

/**
 * Page Object for the Fibonacci Explorer app.
 * Encapsulates common interactions used across tests.
 */
class FibPage {
  constructor(page) {
    this.page = page;
    this.countRange = page.locator('#count');
    this.countNumber = page.locator('#countNumber');
    this.iterBtn = page.locator('#iterBtn');
    this.recurBtn = page.locator('#recurBtn');
    this.memoBtn = page.locator('#memoBtn');
    this.binetBtn = page.locator('#binetBtn');
    this.animateCheckbox = page.locator('#animateCheckbox');
    this.speedRange = page.locator('#speed');
    this.sequence = page.locator('#sequence');
    this.timeEl = page.locator('#time');
    this.notesEl = page.locator('#notes');
    this.ratiosEl = page.locator('#ratios');
    this.canvas = page.locator('#canvas');
    this.canvasHint = page.locator('#canvasHint');
    this.animateBars = page.locator('#animateBars');
    this.downloadBtn = page.locator('#downloadBtn');
    this.phiChip = page.locator('#phiChip');
  }

  async goto() {
    await this.page.goto(BASE, { waitUntil: 'load' });
    // Wait for initial iterative computation to complete (app calls showIterative on load)
    await this.page.waitForSelector('#sequence');
    await this.page.waitForFunction(() => {
      const t = document.getElementById('time');
      return t && t.textContent && t.textContent.toLowerCase().includes('iterative');
    }, {}, { timeout: 5000 });
  }

  async setCountNumber(n) {
    await this.countNumber.fill(String(n));
    // ensure change event triggers update of range as app listens to change and input
    await this.countNumber.dispatchEvent('change');
  }

  async setCountRange(n) {
    await this.countRange.fill(String(n));
    // input event
    await this.countRange.dispatchEvent('input');
    // keep number in sync
    await this.countNumber.waitFor({ state: 'attached' });
  }

  async clickIterative() {
    await this.iterBtn.click();
  }

  async clickNaive() {
    await this.recurBtn.click();
  }

  async clickMemo() {
    await this.memoBtn.click();
  }

  async clickBinet() {
    await this.binetBtn.click();
  }

  async toggleAnimate(checked = true) {
    const isChecked = await this.animateCheckbox.isChecked();
    if (isChecked !== checked) {
      await this.animateCheckbox.click();
    }
  }

  async setSpeed(ms) {
    await this.speedRange.fill(String(ms));
    await this.speedRange.dispatchEvent('input');
  }

  async clickAnimateBars() {
    await this.animateBars.click();
  }

  async clickDownload() {
    await this.downloadBtn.click();
  }

  async pressEnterOnCountNumber() {
    await this.countNumber.press('Enter');
  }

  async getSequenceCount() {
    return await this.sequence.locator('.term').count();
  }

  async getTimeText() {
    return (await this.timeEl.textContent()) || '';
  }

  async getNotesText() {
    return (await this.notesEl.textContent()) || '';
  }

  async getPhiText() {
    return (await this.phiChip.textContent()) || '';
  }

  async getCanvasHintText() {
    return (await this.canvasHint.textContent()) || '';
  }

  async mouseMoveOnCanvas(xOffset = 10, yOffset = 10) {
    // Compute canvas bounding rect and move mouse to an offset inside it.
    const rect = await this.page.evaluate(() => {
      const c = document.getElementById('canvas');
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const x = rect.left + Math.max(1, Math.min(rect.width - 1, xOffset));
    const y = rect.top + Math.max(1, Math.min(rect.height - 1, yOffset));
    await this.page.mouse.move(x, y);
    // ensure event processing
    await this.page.waitForTimeout(50);
  }

  async mouseLeaveCanvas() {
    // Move far away from canvas to trigger mouseleave
    await this.page.mouse.move(0, 0);
    // force dispatch leave as fallback
    await this.canvas.dispatchEvent('mouseleave');
    await this.page.waitForTimeout(50);
  }

  async currentValuesLength() {
    return await this.page.evaluate(() => {
      try {
        return (window.currentValues && window.currentValues.length) || 0;
      } catch (e) {
        return 0;
      }
    });
  }
}

// Collect console errors and page errors for assertion in afterEach
test.describe('Fibonacci Sequence Explorer - FSM states and transitions', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture console.error messages and exceptions logged to console
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore capture errors
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // After each test, assert that no uncaught page errors or console.error occurred.
  test.afterEach(async () => {
    // If there are any errors, include them in a failing assertion to make failures visible.
    expect(pageErrors, `Uncaught page errors: ${pageErrors.map(e => String(e)).join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Console error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Idle state: initial render shows iterative result and phi chip', async ({ page }) => {
    // Validate initial Idle state (S0_Idle) - app calls renderPage()/showIterative() on load
    const app = new FibPage(page);
    await app.goto();

    // Sequence should contain terms (default value 20 -> 21 terms)
    const seqCount = await app.getSequenceCount();
    expect(seqCount).toBeGreaterThanOrEqual(1);

    // Time element should indicate iterative computation
    const timeTxt = await app.getTimeText();
    expect(timeTxt.toLowerCase()).toContain('iterative');

    // Phi chip should display golden ratio
    const phiText = await app.getPhiText();
    expect(phiText).toMatch(/φ ≈\s*1\.6180/);
  });

  test('Iterative computation via button and COUNT_CHANGE transitions', async ({ page }) => {
    // Test transition S0_Idle -> S1_Iterative when count changes and Iterative button clicked
    const app = new FibPage(page);
    await app.goto();

    // Change count to 10 via the number input (COUNT_CHANGE)
    await app.setCountNumber(10);

    // Trigger iterative computation explicitly
    await app.clickIterative();

    // Wait for time text to mention iterative and for sequence to be rendered
    await page.waitForFunction(() => {
      const t = document.getElementById('time');
      return t && /Iterative/.test(t.textContent || '');
    }, {}, { timeout: 3000 });

    const seqCount = await app.getSequenceCount();
    // F0..F10 => 11 terms
    expect(seqCount).toBe(11);

    // Check the sequence DOM contains the last index label "10:"
    const lastTerm = await page.locator('#sequence .term').nth(seqCount - 1).textContent();
    expect(lastTerm).toMatch(/^10:/);
  });

  test('Iterative animation toggle leads to Animating state and back', async ({ page }) => {
    // Validate transition S1_Iterative -> S5_Animating on animate toggle, and that animation runs
    const app = new FibPage(page);
    await app.goto();

    // Use small count to keep animation short
    await app.setCountNumber(5);
    await app.toggleAnimate(true);
    // Make speed minimal to speed up animation
    await app.setSpeed(10);

    // Trigger iterative computation which should animate
    const start = Date.now();
    await app.clickIterative();

    // Wait for time to indicate animated path completed (text set at end of animateIterative)
    await page.waitForFunction(() => {
      const t = document.getElementById('time');
      return t && t.textContent && t.textContent.toLowerCase().includes('iterative (animated)');
    }, {}, { timeout: 5000 });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000); // sanity: animation finished in reasonable time

    // After animation, ensure currentValues length matches count+1
    const currentLen = await app.currentValuesLength();
    expect(currentLen).toBeGreaterThanOrEqual(6); // F0..F5 => 6 terms
  });

  test('Canvas MOUSE_MOVE shows tooltip with full value and MOUSE_LEAVE clears it', async ({ page }) => {
    // Verify MOUSE_MOVE and MOUSE_LEAVE on canvas trigger the expected UI changes
    const app = new FibPage(page);
    await app.goto();

    // Ensure there's a reasonable sequence to hover over
    await app.setCountNumber(8);
    await app.clickIterative();
    await page.waitForFunction(() => {
      const seq = document.getElementById('sequence');
      return seq && seq.children.length >= 9;
    }, {}, { timeout: 3000 });

    // Move mouse over canvas near left (should hit early bars)
    await app.mouseMoveOnCanvas(30, 40);
    // The canvasHint should show an "Index X: " text when hovered
    await page.waitForFunction(() => {
      const hint = document.getElementById('canvasHint');
      return hint && hint.textContent && /Index\s+\d+\:/.test(hint.textContent);
    }, {}, { timeout: 2000 });

    const hintText = await app.getCanvasHintText();
    expect(hintText).toMatch(/Index\s+\d+\:\s*\d+/);

    // Trigger mouseleave and verify hint cleared
    await app.mouseLeaveCanvas();
    await page.waitForFunction(() => {
      const hint = document.getElementById('canvasHint');
      return hint && hint.textContent === '';
    }, {}, { timeout: 2000 });

    const hintAfter = await app.getCanvasHintText();
    expect(hintAfter).toBe('');
  });

  test('Naive recursion displays warning for large n (edge case)', async ({ page }) => {
    // Test transition S0_Idle -> S2_Naive and edge-case where n > 45 triggers warning
    const app = new FibPage(page);
    await app.goto();

    // Set count above threshold and click Naive Recursion
    await app.setCountNumber(46);
    await app.clickNaive();

    // Notes element should contain warning text and .warning element
    await page.waitForSelector('#notes .warning', { timeout: 2000 });
    const notesHtml = await app.getNotesText();
    expect(notesHtml.toLowerCase()).toContain('naive recursion is exponential');

    // Also ensure that no page error thrown during this validation
  });

  test('Memoized recursion computes sequence correctly (S3_Memo)', async ({ page }) => {
    // Transition S0_Idle -> S3_Memo
    const app = new FibPage(page);
    await app.goto();

    await app.setCountNumber(12);
    await app.clickMemo();

    // Wait until timeEl indicates memoized computation finished
    await page.waitForFunction(() => {
      const t = document.getElementById('time');
      return t && /Memoized recursion/.test(t.textContent || '');
    }, {}, { timeout: 3000 });

    const seqCount = await app.getSequenceCount();
    expect(seqCount).toBe(13); // F0..F12
    // Validate a known Fibonacci value in DOM e.g., F5 = 5
    const term5 = await page.locator('#sequence .term').nth(5).textContent();
    expect(term5).toMatch(/^5:\s*5$/i);
  });

  test('Binet computation and precision-warning edge (S4_Binet)', async ({ page }) => {
    // Transition S0_Idle -> S4_Binet
    const app = new FibPage(page);
    await app.goto();

    // First test a normal small n
    await app.setCountNumber(10);
    await app.clickBinet();
    await page.waitForFunction(() => {
      const t = document.getElementById('time');
      return t && /Binet/.test(t.textContent || '');
    }, {}, { timeout: 3000 });
    const seqCount = await app.getSequenceCount();
    expect(seqCount).toBe(11);

    // Now test edge: large n triggers a warning about precision
    await app.setCountNumber(75);
    await app.clickBinet();
    await page.waitForSelector('#notes .warning', { timeout: 3000 });
    const notes = await app.getNotesText();
    expect(notes.toLowerCase()).toContain('binet uses floating-point arithmetic');
  });

  test('Animate Bars button triggers stepwise drawing (visual animation path)', async ({ page }) => {
    // Ensure animateBars runs without errors and renders intermediate steps
    const app = new FibPage(page);
    await app.goto();

    // Use small count to keep animation short
    await app.setCountNumber(4);
    await app.clickIterative();
    await page.waitForFunction(() => {
      const seq = document.getElementById('sequence');
      return seq && seq.children.length >= 5;
    }, {}, { timeout: 2000 });

    // Click Animate Bars and wait for it to complete by waiting for final draw (currentValues length)
    const finalCount = await app.currentValuesLength();
    // Trigger animation
    await app.clickAnimateBars();
    // Wait until the canvas drawing includes final count via currentValues (no direct signal, poll)
    await page.waitForFunction((expected) => {
      return window.currentValues && window.currentValues.length === expected;
    }, finalCount, { timeout: 5000 });

    const afterLen = await app.currentValuesLength();
    expect(afterLen).toBeGreaterThanOrEqual(5);
  });

  test('Download button triggers a download event or completes without throwing', async ({ page }) => {
    // This will attempt to trigger a download of the canvas data URL.
    const app = new FibPage(page);
    await app.goto();

    // Ensure there are drawn values to download
    await app.setCountNumber(6);
    await app.clickIterative();
    await page.waitForFunction(() => {
      const seq = document.getElementById('sequence');
      return seq && seq.children.length >= 7;
    }, {}, { timeout: 2000 });

    // Some environments produce a Download event, others don't for data URLs.
    // We'll attempt to capture a download event. If not fired, ensure click completed without page errors.
    let downloadFired = false;
    const downloadPromise = page.waitForEvent('download', { timeout: 3000 }).then(() => { downloadFired = true; }).catch(() => { /* ignore timeout */ });

    await app.clickDownload();
    await downloadPromise;

    // If a download fired, assert its suggested filename; otherwise just ensure no errors occurred earlier (afterEach will assert).
    if (downloadFired) {
      const dl = await page.waitForEvent('download');
      const suggested = dl.suggestedFilename();
      expect(suggested).toMatch(/fibonacci_visualization\.png/i);
    } else {
      // No download event detected - ensure click didn't crash the page (checked in afterEach).
      expect(true).toBeTruthy();
    }
  });

  test('ENTER_KEY on number input triggers iterative computation (keyboard interaction)', async ({ page }) => {
    // Validate ENTER_KEY event triggers S1_Iterative from S0_Idle
    const app = new FibPage(page);
    await app.goto();

    await app.setCountNumber(7);
    // Press Enter in the number input
    await app.pressEnterOnCountNumber();

    await page.waitForFunction(() => {
      const t = document.getElementById('time');
      return t && /Iterative/.test(t.textContent || '');
    }, {}, { timeout: 3000 });

    const seqCount = await app.getSequenceCount();
    expect(seqCount).toBe(8); // F0..F7
  });

  test('Window RESIZE triggers redraw without errors', async ({ page }) => {
    // Validate RESIZE event handling (S0_Idle -> S0_Idle self transition)
    const app = new FibPage(page);
    await app.goto();

    // Change viewport to trigger resize listener
    const original = page.viewportSize();
    await page.setViewportSize({ width: (original?.width || 800) - 100, height: (original?.height || 600) - 50 });
    // Wait briefly for the debounce timeout (100ms in app)
    await page.waitForTimeout(250);

    // Restore viewport
    if (original) {
      await page.setViewportSize(original);
      await page.waitForTimeout(250);
    }

    // Ensure currentValues still accessible and no page errors (afterEach will assert)
    const len = await app.currentValuesLength();
    expect(len).toBeGreaterThanOrEqual(0);
  });
});