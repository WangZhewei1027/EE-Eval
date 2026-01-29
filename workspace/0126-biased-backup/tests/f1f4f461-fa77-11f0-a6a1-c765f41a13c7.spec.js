import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f4f461-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object encapsulating common interactions and queries for the BST demo.
class BSTPage {
  constructor(page) {
    this.page = page;
    this.btnAnimate = page.locator('#btnAnimate');
    this.btnReset = page.locator('#btnReset');
    this.nodes = page.locator('#nodesLayer g.node');
    this.edges = page.locator('#edgesLayer path');
    this.chips = page.locator('#sequenceList .chip');
    this.seqList = page.locator('#sequenceList');
    // arrays to collect console and page errors for assertions
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Navigate and wire up listeners to capture console errors and page errors
  async goto() {
    // collect console errors and page errors
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(String(err));
    });

    await this.page.goto(APP_URL);
    // wait for controls rendered
    await expect(this.btnAnimate).toBeVisible({ timeout: 5000 });
    await expect(this.btnReset).toBeVisible({ timeout: 5000 });
  }

  // Counts
  async nodeCount() {
    return await this.nodes.count();
  }
  async edgeCount() {
    return await this.edges.count();
  }
  async chipCount() {
    return await this.chips.count();
  }

  // Start animation via click
  async clickAnimate() {
    await this.btnAnimate.click();
  }

  // Click reset
  async clickReset() {
    await this.btnReset.click();
  }

  // Press a key while focusing animate button (to exercise keyup handler on the button)
  async pressKeyOnAnimate(key) {
    await this.btnAnimate.focus();
    // Emulate a key press (keyup handler on the button triggers click in the page code)
    await this.page.keyboard.press(key);
  }

  // Press a key while focusing reset button
  async pressKeyOnReset(key) {
    await this.btnReset.focus();
    await this.page.keyboard.press(key);
  }

  // Wait until animation completes by waiting for the Animate button to be enabled (the page code re-enables it)
  async waitForAnimationComplete(timeout = 45000) {
    await expect(this.btnAnimate).toBeEnabled({ timeout });
    // once animation completes reset should be enabled as well
    await expect(this.btnReset).toBeEnabled({ timeout: 1000 });
  }

  // Wait until at least n nodes are present
  async waitForAtLeastNodes(n, timeout = 15000) {
    await expect(this.nodes).toHaveCount(n, { timeout });
  }

  // Wait until nodesLayer is empty
  async waitForNoNodes(timeout = 5000) {
    await expect(this.nodes).toHaveCount(0, { timeout });
  }

  // Utility: clear stored errors
  clearCapturedErrors() {
    this.consoleErrors = [];
    this.pageErrors = [];
  }
}

// Group related tests for FSM and interactions
test.describe('f1f4f461-fa77-11f0-a6a1-c765f41a13c7 — Binary Search Tree interactive (FSM validation)', () => {
  let bst;

  test.beforeEach(async ({ page }) => {
    bst = new BSTPage(page);
    await bst.goto();
  });

  test.afterEach(async () => {
    // For every test we assert there were no unexpected console or page errors.
    // These assertions make sure the app runs without runtime exceptions when exercised.
    expect(bst.pageErrors, 'No uncaught page errors').toEqual([]);
    expect(bst.consoleErrors, 'No console.error logs').toEqual([]);
  });

  test.describe('FSM State: S0_Idle (initial state) validation', () => {
    test('Initial Idle state: DOM cleared and Reset disabled', async () => {
      // This test validates the Idle state's entry actions and evidence:
      // - clearScene() should result in no nodes/edges rendered
      // - btnReset.disabled should be true initially
      // - Animate button should be available
      await expect(bst.nodes).toHaveCount(0);
      await expect(bst.edges).toHaveCount(0);
      await expect(bst.btnReset).toBeDisabled();
      await expect(bst.btnAnimate).toBeEnabled();

      // The insertion sequence should be shown as chips and match expected count (11 from source)
      const chipCount = await bst.chipCount();
      expect(chipCount).toBeGreaterThanOrEqual(11); // allow >= in case styling adds extras
    });

    test('Clicking disabled Reset in Idle should be a no-op and not produce errors', async () => {
      // Clicking a disabled reset should not change anything nor produce errors.
      // We attempt to click and then assert Idle invariants remain.
      try {
        await bst.clickReset();
      } catch (err) {
        // Some drivers may throw when clicking disabled; we swallow and proceed to assertions.
      }
      await expect(bst.nodes).toHaveCount(0);
      await expect(bst.edges).toHaveCount(0);
      await expect(bst.btnReset).toBeDisabled();
    });
  });

  test.describe('FSM Transition: AnimateStart (S0_Idle -> S1_Animating) and S1_Animating behavior', () => {
    test('Click Animate: enters Animating state, buttons disabled, nodes render progressively, completes back to Idle', async () => {
      // Comments:
      // - This test validates that clicking #btnAnimate triggers animateSequence().
      // - During animation both buttons should be disabled.
      // - Nodes appear in the scene as the animation proceeds.
      // - After completion the app should re-enable controls (transition back to Idle expected evidence).
      await bst.clickAnimate();

      // Immediately after clicking, the page code disables both buttons.
      await expect(bst.btnAnimate).toBeDisabled();
      await expect(bst.btnReset).toBeDisabled();

      // Wait for at least the first root node to be added to the DOM.
      // This verifies that the animation has started and elements are being created.
      await bst.waitForAtLeastNodes(1, 10000);

      // Allow the animation to run to completion and then assert final state.
      // animateSequence is fairly long; provide a generous timeout.
      await bst.waitForAnimationComplete(45000);

      // After completion nodes should be present for the whole sequence (expect at least 11)
      const finalNodeCount = await bst.nodeCount();
      expect(finalNodeCount).toBeGreaterThanOrEqual(11);

      // Edges should have been created; for 11 nodes expect at least 10 edges (tree)
      const finalEdgeCount = await bst.edgeCount();
      expect(finalEdgeCount).toBeGreaterThanOrEqual(10);

      // Both controls should be enabled by the end (per implementation)
      await expect(bst.btnAnimate).toBeEnabled();
      await expect(bst.btnReset).toBeEnabled();

      // Now click Reset to verify transition back to Idle explicitly.
      await bst.clickReset();

      // After reset, clearScene() should remove nodes/edges and btnReset should be disabled.
      await bst.waitForNoNodes(5000);
      await expect(bst.edges).toHaveCount(0);
      await expect(bst.btnReset).toBeDisabled();
      await expect(bst.btnAnimate).toBeEnabled();
    }, 60000); // extended timeout for the full animation run

    test('Start Animate then Reset mid-animation should clear scene and re-enable Animate', async () => {
      // This test validates the Reset transition while in S1_Animating.
      // It ensures reset clears the animation and returns the UI to Idle.
      await bst.clearCapturedErrors();
      await bst.clickAnimate();

      // ensure animation started
      await expect(bst.btnAnimate).toBeDisabled();
      await expect(bst.btnReset).toBeDisabled();

      // wait until at least one node is inserted
      await bst.waitForAtLeastNodes(1, 10000);

      // Now click Reset while animation is still (probably) running
      await bst.clickReset();

      // After reset we expect:
      // - nodes cleared
      // - edges cleared
      // - btnReset disabled (Idle evidence)
      // - btnAnimate enabled
      await bst.waitForNoNodes(5000);
      await expect(bst.edges).toHaveCount(0);
      await expect(bst.btnReset).toBeDisabled();
      await expect(bst.btnAnimate).toBeEnabled();
    }, 30000);
  });

  test.describe('Keyboard accessibility events (AnimateKeyPress & ResetKeyPress)', () => {
    test('Press Enter/Space on Animate triggers animation via keyup handler', async () => {
      // This test validates the keyup event on #btnAnimate triggers a click.
      // Use Enter first, then interrupt with Reset to avoid long waits.
      await bst.clearCapturedErrors();

      // Trigger using Enter
      await bst.pressKeyOnAnimate('Enter');

      // After keyup, the code triggers btnAnimate.click() which should enter animating
      await expect(bst.btnAnimate).toBeDisabled();

      // Wait for some animation progress (at least one node) then invoke Reset via keyboard
      await bst.waitForAtLeastNodes(1, 10000);

      // Now press Space on Reset (focus & keyboard press) to trigger reset via keyup handler
      // But Reset is likely disabled until the animation sets it; to ensure we exercise the handler,
      // we will click Reset button programmatically to ensure UI returns to Idle.
      // Then we focus and press space to validate Reset key handler when enabled.
      // First, stop the current animation by clicking Reset
      try {
        await bst.clickReset();
      } catch (err) {
        // swallow any transient click error
      }

      // Ensure Idle state
      await bst.waitForNoNodes(5000);
      await expect(bst.btnReset).toBeDisabled();

      // Start a new animation and wait until complete to test key-based reset when enabled
      await bst.clickAnimate();
      await bst.waitForAnimationComplete(45000);

      // Now Reset should be enabled; test pressing Space triggers reset via keyup handler
      await bst.pressKeyOnReset('Space');

      // After the keyup-triggered click we expect the scene cleared and Reset disabled.
      await bst.waitForNoNodes(5000);
      await expect(bst.btnReset).toBeDisabled();
      await expect(bst.btnAnimate).toBeEnabled();
    }, 60000);
  });

  test.describe('Edge cases & robustness', () => {
    test('Rapid repeated Animate clicks are ignored while running', async () => {
      // This test asserts that once the animation starts, additional triggers are ignored
      // (the implementation disables the button and guards against reentrancy).
      await bst.clearCapturedErrors();

      // Click animate to start
      await bst.clickAnimate();
      await expect(bst.btnAnimate).toBeDisabled();

      // Attempt to click multiple times rapidly - should have no adverse effect (no crashes)
      for (let i = 0; i < 6; i++) {
        try {
          await bst.clickAnimate();
        } catch (err) {
          // If Playwright throws on clicking a disabled button, ignore it
        }
      }

      // Wait for some progress
      await bst.waitForAtLeastNodes(1, 10000);

      // Then cancel to avoid long test
      await bst.clickReset();
      await bst.waitForNoNodes(5000);
      await expect(bst.btnAnimate).toBeEnabled();
      // Confirm no console or page errors were captured
      expect(bst.pageErrors).toEqual([]);
      expect(bst.consoleErrors).toEqual([]);
    });

    test('DOM invariants: sequence chips match expected content format', async () => {
      // Verify that sequence chips are numeric textual chips and visible.
      const chipCount = await bst.chipCount();
      expect(chipCount).toBeGreaterThanOrEqual(11);
      const chips = await bst.page.$$eval('#sequenceList .chip', els => els.map(e => e.textContent.trim()));
      // Every chip should parse to an integer
      for (const txt of chips) {
        expect(!isNaN(Number(txt))).toBeTruthy();
      }
    });
  });
});