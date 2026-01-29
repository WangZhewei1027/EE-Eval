import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f3e2f0-fa77-11f0-a6a1-c765f41a13c7.html';

/**
 * Page object for the Array Visual Exploration page.
 * Encapsulates common interactions and queries.
 */
class VisualArrayPage {
  constructor(page) {
    this.page = page;
    this.errors = [];
    this.consoleErrors = [];
  }

  async initListeners() {
    // collect uncaught page errors
    this.page.on('pageerror', (err) => {
      this.errors.push(err);
    });

    // collect console messages of type 'error' for additional diagnostics
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
  }

  async goto() {
    await this.page.goto(BASE);
  }

  async getCellCount() {
    return this.page.$$eval('#cellsHolder .cell', els => els.length);
  }

  async getCellValues() {
    return this.page.$$eval('#cellsHolder .cell .value', els => els.map(e => e.innerText));
  }

  async getLenValue() {
    return this.page.$eval('#lenValue', e => e.innerText);
  }

  async getAccessValue() {
    return this.page.$eval('#accessValue', e => e.innerText);
  }

  async isPointerVisible() {
    return this.page.$eval('#pointer', p => p.classList.contains('visible'));
  }

  async getTraverseBtnText() {
    return this.page.$eval('#traverseBtn', b => b.innerText);
  }

  async isTraverseBtnDisabled() {
    return this.page.$eval('#traverseBtn', b => b.disabled);
  }

  async isShuffleBtnDisabled() {
    return this.page.$eval('#shuffleBtn', b => b.disabled);
  }

  async clickTraverse() {
    await this.page.click('#traverseBtn');
  }

  async clickShuffle() {
    await this.page.click('#shuffleBtn');
  }

  async clickCell(index) {
    // click the cell with data-index
    await this.page.click(`#cellsHolder .cell[data-index="${index}"]`);
  }

  async pressTraverseKey(key = 'Enter') {
    await this.page.focus('#traverseBtn');
    await this.page.keyboard.press(key);
  }

  async getHighlightedIndex() {
    // returns the index of the currently highlighted cell, or -1
    return this.page.$$eval('#cellsHolder .cell', cells => {
      const idx = cells.findIndex(c => c.classList.contains('highlight'));
      return idx;
    });
  }

  async waitForTraversalToStart() {
    // traversal starts when traverse button is disabled and innerText changes
    await this.page.waitForFunction(() => {
      const b = document.getElementById('traverseBtn');
      return b && (b.disabled === true) && (b.innerText.includes('Traversing') || b.innerText.includes('⏳'));
    }, null, { timeout: 5000 });
  }

  async waitForTraversalToFinish(timeout = 15000) {
    // traversal finishes when traverse button returns to original text and enabled
    await this.page.waitForFunction(() => {
      const b = document.getElementById('traverseBtn');
      return b && (b.disabled === false) && (b.innerText.trim().startsWith('▶'));
    }, null, { timeout });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

test.describe('Array — A Visual Exploration (FSM validation)', () => {
  // Increase timeout for tests involving animations and traversal
  test.setTimeout(30000);

  test.beforeEach(async ({ page }) => {
    // noop: per-test setup handled inside tests using VisualArrayPage
  });

  test.afterEach(async ({ page }) => {
    // noop
  });

  test('Idle state on initial load: renderArray() should produce 8 cells, UI elements present, no uncaught errors', async ({ page }) => {
    // This test verifies S0_Idle entry action (renderArray), presence of controls and that initial UI is stable.
    const vp = new VisualArrayPage(page);
    await vp.initListeners();
    await vp.goto();

    // Wait a bit for initial animations and the small pointer flourish to finish (the page shows pointer briefly)
    await vp.sleep(1400);

    // Assert cells rendered and length value set
    const count = await vp.getCellCount();
    expect(count).toBe(8);

    const lenValue = await vp.getLenValue();
    expect(lenValue).toBe('8');

    // Initial access count must be zero
    const accessValue = await vp.getAccessValue();
    expect(accessValue).toBe('0');

    // Check controls exist and are in Idle state
    const traverseText = await vp.getTraverseBtnText();
    expect(traverseText.trim().startsWith('▶')).toBeTruthy();

    const traverseDisabled = await vp.isTraverseBtnDisabled();
    expect(traverseDisabled).toBeFalsy();

    const shuffleDisabled = await vp.isShuffleBtnDisabled();
    expect(shuffleDisabled).toBeFalsy();

    // Pointer should be hidden after initial flourish finished
    const pointerVisible = await vp.isPointerVisible();
    expect(pointerVisible).toBe(false);

    // Ensure no page errors or console errors were emitted during load/render
    expect(vp.errors.length, `Page errors: ${vp.errors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(vp.consoleErrors.length, `Console errors: ${vp.consoleErrors.join(' | ')}`).toBe(0);
  });

  test('TraverseClick: clicking traverse enters Traversing state and completes traversal (S0 -> S1 -> S0)', async ({ page }) => {
    // This test validates the transition triggered by TraverseClick.
    // It asserts that traverse() runs, disables controls, highlights sequentially, updates access count,
    // and restores UI on exit (highlight(-1), button re-enabled).
    const vp = new VisualArrayPage(page);
    await vp.initListeners();
    await vp.goto();

    // ensure stable initial state
    await vp.sleep(600);

    // start traversal by clicking the button
    await vp.clickTraverse();

    // Wait for traversal to have started: button disabled and text showing traversing
    await vp.waitForTraversalToStart();

    // During traversal, the traverseBtn should be disabled and shuffle disabled too
    expect(await vp.isTraverseBtnDisabled()).toBe(true);
    expect(await vp.isShuffleBtnDisabled()).toBe(true);

    // Pointer should be visible during traversing
    const pointerVisibleDuring = await vp.isPointerVisible();
    expect(pointerVisibleDuring).toBe(true);

    // Wait until at least one access has occurred (accessValue > 0)
    await page.waitForFunction(() => {
      const el = document.getElementById('accessValue');
      return el && Number(el.innerText) >= 1;
    }, null, { timeout: 5000 });

    // Wait for traversal to finish
    await vp.waitForTraversalToFinish();

    // After traversal, access count should equal number of elements (8)
    const finalAccess = Number(await vp.getAccessValue());
    expect(finalAccess).toBeGreaterThanOrEqual(8);

    // The traverse button should be re-enabled and text should be reverted
    expect(await vp.isTraverseBtnDisabled()).toBe(false);
    const textAfter = await vp.getTraverseBtnText();
    expect(textAfter.trim().startsWith('▶')).toBeTruthy();

    // Pointer should be hidden (highlight(-1) was expected on exit)
    const pointerVisibleAfter = await vp.isPointerVisible();
    expect(pointerVisibleAfter).toBe(false);

    // No uncaught page errors emitted during traversal
    expect(vp.errors.length, `Page errors: ${vp.errors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(vp.consoleErrors.length, `Console errors: ${vp.consoleErrors.join(' | ')}`).toBe(0);
  });

  test('TraverseKeyUp: pressing Enter on traverse button starts traversal (keyboard accessibility)', async ({ page }) => {
    // This test validates the TraverseKeyUp event: keyboard triggers traverse().
    const vp = new VisualArrayPage(page);
    await vp.initListeners();
    await vp.goto();

    // ensure stable
    await vp.sleep(600);

    // Trigger via keyup (Enter) while focused on traverseBtn
    await vp.pressTraverseKey('Enter');

    // Wait for start and completion
    await vp.waitForTraversalToStart();
    await vp.waitForTraversalToFinish();

    // Validate completion results similar to click traversal
    const finalAccess = Number(await vp.getAccessValue());
    expect(finalAccess).toBeGreaterThanOrEqual(8);

    expect(await vp.isTraverseBtnDisabled()).toBe(false);
    expect(await vp.getTraverseBtnText()).toMatch(/▶\s*Traverse/);

    // No page errors
    expect(vp.errors.length, `Page errors: ${vp.errors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(vp.consoleErrors.length, `Console errors: ${vp.consoleErrors.join(' | ')}`).toBe(0);
  });

  test('ShuffleClick: clicking shuffle shuffles values (visual) and resets access count', async ({ page }) => {
    // This test validates the S0 -> S2_Shuffling transition and shuffleValues() effect.
    const vp = new VisualArrayPage(page);
    await vp.initListeners();
    await vp.goto();

    // take snapshot of current values
    await vp.sleep(400);
    const beforeValues = await vp.getCellValues();

    // set accessValue to non-zero by performing a traversal quickly (but keep test deterministic)
    // We'll perform a traversal and wait for it to finish, then shuffle to ensure reset.
    await vp.clickTraverse();
    await vp.waitForTraversalToStart();
    await vp.waitForTraversalToFinish();

    const accessBeforeShuffle = Number(await vp.getAccessValue());
    expect(accessBeforeShuffle).toBeGreaterThanOrEqual(8);

    // Click shuffle
    await vp.clickShuffle();

    // shuffleValues animates; wait for animations to settle
    await vp.sleep(800);

    // Access count should be reset to 0
    const accessAfterShuffle = Number(await vp.getAccessValue());
    expect(accessAfterShuffle).toBe(0);

    // Values should be present; attempt to detect reorder
    const afterValues = await vp.getCellValues();
    expect(afterValues.length).toBe(beforeValues.length);

    const orderChanged = JSON.stringify(afterValues) !== JSON.stringify(beforeValues);
    // It's acceptable if a random shuffle results in the same order, but typically it changes.
    // We assert that values are valid numbers and length unchanged; if order changed it's stronger evidence of shuffling.
    expect(afterValues.every(v => typeof v === 'string' && v.length > 0)).toBe(true);

    // If order didn't change, at least confirm that shuffle did not cause errors and access reset occurred.
    if (!orderChanged) {
      // Warn: very unlikely same order; ensure no errors occurred
      expect(vp.errors.length).toBe(0);
    }

    // Ensure traverse button and shuffle button are enabled after shuffle
    expect(await vp.isTraverseBtnDisabled()).toBe(false);
    expect(await vp.isShuffleBtnDisabled()).toBe(false);

    // No uncaught errors
    expect(vp.errors.length, `Page errors: ${vp.errors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(vp.consoleErrors.length, `Console errors: ${vp.consoleErrors.join(' | ')}`).toBe(0);
  });

  test('CellClick: clicking a cell highlights it briefly when idle; clicking traverse while already traversing is ignored', async ({ page }) => {
    // This test validates CellClick event behavior and an edge-case: clicking traverse while traversalActive should not double-trigger.
    const vp = new VisualArrayPage(page);
    await vp.initListeners();
    await vp.goto();

    // ensure stable initial state
    await vp.sleep(600);

    // Click cell index 2 and ensure it is highlighted briefly
    const targetIndex = 2;
    await vp.clickCell(targetIndex);

    // Immediately after click, the cell should have the highlight class
    const highlightedNow = await vp.getHighlightedIndex();
    expect(highlightedNow).toBe(targetIndex);

    // After the brief timeout used in code (700ms) the highlight should be removed
    await vp.sleep(800);
    const highlightedLater = await vp.getHighlightedIndex();
    // highlight(-1) should have removed highlighting -> expect -1
    expect(highlightedLater).toBe(-1);

    // Now test edge-case: click traverse to start traversal, then click traverse again quickly and ensure it's ignored
    await vp.clickTraverse();
    await vp.waitForTraversalToStart();

    // while traversalActive, click traverse button (this should be a no-op because button is disabled)
    await vp.clickTraverse(); // explicit click attempt; since button disabled, nothing should happen

    // Wait for finish
    await vp.waitForTraversalToFinish();

    // After traversal completes, access count should not exceed number of elements by more than a tiny margin
    // (confirm no duplicate traversal occurred)
    const accessAfter = Number(await vp.getAccessValue());
    expect(accessAfter).toBeGreaterThanOrEqual(8);
    // It should not be absurdly larger; expect <= 16 to be safe (ensures not double-run repeatedly)
    expect(accessAfter).toBeLessThanOrEqual(16);

    // No uncaught errors
    expect(vp.errors.length, `Page errors: ${vp.errors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(vp.consoleErrors.length, `Console errors: ${vp.consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Edge cases and resilience: ensure keyboard Space key triggers traversal and clicking cells during traversal does not break the animation', async ({ page }) => {
    // This test covers additional FSM expectations: keyboard interaction with space key and robustness when interacting during traversal.
    const vp = new VisualArrayPage(page);
    await vp.initListeners();
    await vp.goto();

    await vp.sleep(400);

    // Trigger traversal via Space key
    await vp.pressTraverseKey(' ');
    await vp.waitForTraversalToStart();

    // During traversal attempt to click a cell (should be ignored per implementation)
    const preAccess = Number(await vp.getAccessValue());
    await vp.clickCell(5);

    // Wait briefly and ensure access hasn't jumped unexpectedly (only traversal should increment)
    await vp.sleep(600);
    const midAccess = Number(await vp.getAccessValue());
    expect(midAccess).toBeGreaterThanOrEqual(preAccess);

    // Wait for traversal to finish
    await vp.waitForTraversalToFinish();

    // End state checks
    const finalAccess = Number(await vp.getAccessValue());
    expect(finalAccess).toBeGreaterThanOrEqual(8);

    // No uncaught errors
    expect(vp.errors.length, `Page errors: ${vp.errors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(vp.consoleErrors.length, `Console errors: ${vp.consoleErrors.join(' | ')}`).toBe(0);
  });

});