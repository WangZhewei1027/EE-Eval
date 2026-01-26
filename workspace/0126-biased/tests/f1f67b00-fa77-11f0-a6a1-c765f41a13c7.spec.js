import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f67b00-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object for the Topological Sort demo
class TopoPage {
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.explain = page.locator('#explain');
    this.resultChips = page.locator('#resultChips');
    this.progress = page.locator('#progress');
    this.nodes = page.locator('#nodes .node');
    this.edgeElems = page.locator('#edges path.edge');
  }

  async goto() {
    await this.page.goto(BASE);
    // Wait for SVG and nodes to be present
    await Promise.all([
      this.page.waitForSelector('#svg', { state: 'attached' }),
      this.page.waitForSelector('#node-A', { state: 'attached' }),
      this.page.waitForSelector('#playBtn', { state: 'visible' })
    ]);
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async pressSpace() {
    await this.page.keyboard.press('Space');
  }

  // Wait until the explain box contains the 'Done —' final text
  async waitForAnimationDone(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('explain');
      return el && el.textContent.includes('Done —');
    }, {}, { timeout });
  }

  async getPlayAriaPressed() {
    return await this.playBtn.getAttribute('aria-pressed');
  }

  async getPlayText() {
    return (await this.playBtn.innerText()).trim();
  }

  async getExplainText() {
    return (await this.explain.innerText()).trim();
  }

  async getChipCount() {
    return await this.page.locator('#resultChips .chip').count();
  }

  async getChipNumbers() {
    const nums = [];
    const loc = this.page.locator('#resultChips .chip .chip-num');
    const count = await loc.count();
    for (let i = 0; i < count; i++) {
      nums.push((await loc.nth(i).innerText()).trim());
    }
    return nums;
  }

  async getProgressWidth() {
    return await this.page.$eval('#progress', el => el.style.width || '');
  }

  async getHighlightedNodes() {
    return await this.page.$$eval('#nodes .node.highlight', els => els.map(e => e.getAttribute('data-id')));
  }

  async getRemovedNodes() {
    return await this.page.$$eval('#nodes .node.removed', els => els.map(e => e.getAttribute('data-id')));
  }
}

test.describe('Topological Sort — Visual Demonstration (FSM tests)', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // Nothing global to tear down here; listener lifetimes are bound to page and test.
  });

  test('Initial state S0_Idle: UI is reset and play button is not pressed', async ({ page }) => {
    // Validate Idle state entry actions & observable UI
    const topo = new TopoPage(page);
    await topo.goto();

    // Assert no runtime page errors or console.error on initial load
    expect(pageErrors.length, `page errors on load: ${pageErrors.join('\n')}`).toBe(0);
    expect(consoleErrors.length, `console.errors on load: ${consoleErrors.join('\n')}`).toBe(0);

    // Play button should exist and be aria-pressed="false"
    const aria = await topo.getPlayAriaPressed();
    expect(aria).toBe('false');

    // Explain text should reference clicking animate (resetVisual entry action set this)
    const explain = await topo.getExplainText();
    expect(explain).toContain('Click "Animate"');

    // Progress bar should be at 0%
    const width = await topo.getProgressWidth();
    expect(width).toBe('0%');

    // No result chips should be present at idle
    const chipCount = await topo.getChipCount();
    expect(chipCount).toBe(0);
  });

  test('Transition S0 -> S1 via PlayClicked: clicking play starts animation and completes', async ({ page }) => {
    // This test validates:
    // - clicking #playBtn triggers the animation (runAnimation)
    // - play button becomes aria-pressed true and label changes
    // - nodes get highlighted/removed and result chips are shown
    // - final explain text indicates completion (transition back to Idle)
    // - no unexpected console or page errors occur during the run

    test.setTimeout(30000); // allow time for long-running animation

    const topo = new TopoPage(page);
    await topo.goto();

    // Start observing console/page errors after navigation
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    // Click play to start animation
    await topo.clickPlay();

    // Immediately, runAnimation sets aria-pressed=true and updates button text
    await expect.poll(async () => await topo.getPlayAriaPressed(), {
      timeout: 2000
    }).toBe('true');

    const playText = await topo.getPlayText();
    // The label is changed to '⟳ Replay' in runAnimation; check it contains 'Replay' or the replay symbol
    expect(playText).toMatch(/Replay|⟳/);

    // During the animation, nodes should get highlighted (one or multiple). Wait briefly and assert at least one highlighted node appears.
    await page.waitForTimeout(600); // give time for the first highlight to show
    const highlighted = await topo.getHighlightedNodes();
    expect(Array.isArray(highlighted)).toBe(true);
    expect(highlighted.length).toBeGreaterThanOrEqual(1);

    // Wait for animation to finish by watching the explain text become the final "Done — ..." string
    await topo.waitForAnimationDone(20000);

    // After completion, ensure result chips show a complete ordering (one chip per node)
    const finalChipCount = await topo.getChipCount();
    expect(finalChipCount).toBe(8); // all 8 nodes should be output as chips

    // chip numbers should be 1..8 in order (no duplicates); ensure chips are numbered sequentially
    const chipNums = await topo.getChipNumbers();
    expect(chipNums).toEqual(['1','2','3','4','5','6','7','8']);

    // Progress bar should have reached 100%
    const progress = await topo.getProgressWidth();
    expect(progress).toMatch(/100%/);

    // Final explain text should indicate completion
    const finalExplain = await topo.getExplainText();
    expect(finalExplain).toContain('Done — a valid topological order has been revealed.');

    // Ensure no uncaught page errors or console.error messages occurred during the animation
    expect(pageErrors.length, `page errors during animation: ${pageErrors.join('\n')}`).toBe(0);
    expect(consoleErrors.length, `console.errors during animation: ${consoleErrors.join('\n')}`).toBe(0);
  });

  test('Transition S0 -> S1 via SpacePressed: pressing space starts animation', async ({ page }) => {
    // This test validates that the keyboard shortcut (Space) triggers the same animation flow.

    test.setTimeout(30000);
    const topo = new TopoPage(page);
    await topo.goto();

    // Trigger via keyboard space
    await topo.pressSpace();

    // Play button should be set to pressed when animation begins
    await expect.poll(async () => await topo.getPlayAriaPressed(), { timeout: 2000 }).toBe('true');

    // Wait until animation finishes
    await topo.waitForAnimationDone(20000);

    // Validate completion: chips created and explain text final
    const chipCount = await topo.getChipCount();
    expect(chipCount).toBe(8);
    const finalExplain = await topo.getExplainText();
    expect(finalExplain).toContain('Done — a valid topological order has been revealed.');

    // Ensure no console/page errors occurred
    expect(pageErrors.length, `page errors during space-triggered run: ${pageErrors.join('\n')}`).toBe(0);
    expect(consoleErrors.length, `console.errors during space-triggered run: ${consoleErrors.join('\n')}`).toBe(0);
  });

  test('Edge case: clicking play while animating is ignored (no duplicate runs)', async ({ page }) => {
    // Validate guard clause at playBtn event listener: if(animating) return;
    // We click play, then quickly click again, and ensure only a single full run occurs (no duplicate chips)

    test.setTimeout(30000);
    const topo = new TopoPage(page);
    await topo.goto();

    // Start animation
    await topo.clickPlay();

    // Immediately click again (should be ignored)
    await topo.clickPlay();

    // Also send Space while animating (should be ignored)
    await topo.pressSpace();

    // Wait until animation completes
    await topo.waitForAnimationDone(20000);

    // Confirm exactly 8 chips (one run)
    const chipCount = await topo.getChipCount();
    expect(chipCount).toBe(8);

    // Confirm chip numbering is sequential 1..8 (no duplicated numbering sequences from multiple runs)
    const chipNums = await topo.getChipNumbers();
    expect(chipNums).toEqual(['1','2','3','4','5','6','7','8']);

    // Ensure no uncaught errors
    expect(pageErrors.length, `page errors during concurrent-click edge case: ${pageErrors.join('\n')}`).toBe(0);
    expect(consoleErrors.length, `console.errors during concurrent-click edge case: ${consoleErrors.join('\n')}`).toBe(0);
  });

  test('State transitions produce expected DOM class changes (highlight -> removed) per step', async ({ page }) => {
    // Validate that nodes go from highlighted to removed classes during animation
    test.setTimeout(30000);
    const topo = new TopoPage(page);
    await topo.goto();

    // Start animation
    await topo.clickPlay();

    // Wait for the first highlight to appear (should be within about 1s)
    await page.waitForFunction(() => {
      const h = document.querySelectorAll('#nodes .node.highlight');
      return h && h.length >= 1;
    }, {}, { timeout: 2000 });

    // Grab currently highlighted nodes (non-empty)
    const highlightedBefore = await topo.getHighlightedNodes();
    expect(highlightedBefore.length).toBeGreaterThan(0);

    // Wait until animation finishes
    await topo.waitForAnimationDone(20000);

    // After completion, every node should be in 'removed' state (or at least not highlighted)
    const removed = await topo.getRemovedNodes();
    // All nodes that were eventually removed should be marked removed (order may vary due to CSS timing)
    // We expect at least all 8 nodes to have class 'removed' at the end of the animation
    expect(removed.length).toBe(8);

    // Ensure no console/page errors occurred
    expect(pageErrors.length, `page errors during DOM class transition test: ${pageErrors.join('\n')}`).toBe(0);
    expect(consoleErrors.length, `console.errors during DOM class transition test: ${consoleErrors.join('\n')}`).toBe(0);
  });

  test('Edge case & error observation: ensure no runtime ReferenceError/SyntaxError/TypeError occurred on load and during interactions', async ({ page }) => {
    // This test explicitly focuses on observing console and page errors across interactions.
    test.setTimeout(20000);
    const topo = new TopoPage(page);
    await topo.goto();

    // Perform a typical interaction: play and wait for completion
    await topo.clickPlay();
    await topo.waitForAnimationDone(20000);

    // Now assert that there were no uncaught exceptions or console.error messages
    // If any ReferenceError, SyntaxError, or TypeError occurred, they'd appear in pageErrors or consoleErrors
    const foundPageErrors = pageErrors.filter(e => /ReferenceError|SyntaxError|TypeError|Exception/i.test(e));
    const foundConsoleErrors = consoleErrors.filter(e => /ReferenceError|SyntaxError|TypeError|Exception/i.test(e));

    // Expect zero such critical errors
    expect(foundPageErrors.length, `Found page errors (Reference/Syntax/Type): ${foundPageErrors.join('\n')}`).toBe(0);
    expect(foundConsoleErrors.length, `Found console errors (Reference/Syntax/Type): ${foundConsoleErrors.join('\n')}`).toBe(0);

    // Also assert general arrays are empty (no other errors)
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join('\n')}`).toBe(0);
  });
});