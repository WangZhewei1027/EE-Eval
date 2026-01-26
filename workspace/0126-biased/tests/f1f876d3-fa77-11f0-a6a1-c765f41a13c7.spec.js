import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f876d3-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the Git — Visual Elegance app
class GitVisualPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtn = page.locator('#animateBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.cardMsg = page.locator('#cardMsg');
    this.cardDetails = page.locator('#cardDetails');
    this.cardSha = page.locator('#cardSha');
    this.nodes = [
      'c1','c2','c3','c4','c5','c6','c7','f1','f2','m1'
    ].map(id => page.locator(`#${id}`));
    this.nodeById = (id) => page.locator(`#${id}`);
    this.edges = [
      'edge-1','edge-2','edge-3','edge-4','edge-f1','edge-f2','edge-merge'
    ].map(id => page.locator(`#${id}`));
    this.edgeById = (id) => page.locator(`#${id}`);
  }

  // helper to check visibility class on a node
  async isNodeVisible(id) {
    return await this.page.locator(`#${id}`).evaluate(el => el.classList.contains('visible'));
  }

  // helper to check active class on an edge
  async isEdgeActive(id) {
    return await this.page.locator(`#${id}`).evaluate(el => el.classList.contains('active'));
  }

  // wait until the sequence completed by observing final card message
  async waitForFlowComplete(timeout = 20000) {
    await expect(this.cardMsg).toHaveText('Flow complete', { timeout });
  }

  // wait until repository ready text present
  async waitForRepositoryReady(timeout = 5000) {
    await expect(this.cardMsg).toHaveText('Repository ready', { timeout });
  }
}

test.describe('Git — Visual Elegance (FSM validation)', () => {
  // arrays to collect runtime console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // capture console messages
    page.on('console', msg => {
      // collect console errors for inspection/assertions
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test we assert that there were no fatal runtime errors in the page
    // This ensures the page executed as shipped without throwing ReferenceError/SyntaxError/TypeError
    // If there were errors they will be surfaced here via expectations.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Initial state S0_Idle', () => {
    test('S0_Idle: page loads and resetScene() effect is applied (nodes hidden, card initial)', async ({ page }) => {
      // This test validates that on page load the initial entry action resetScene()
      // has been called (as declared in the FSM) by verifying DOM initial state.
      const app = new GitVisualPage(page);

      // Card should indicate repository ready as resetScene sets it
      await expect(app.cardMsg).toHaveText('Repository ready');
      await expect(app.cardDetails).toHaveText('Press Animate to see commits appear in an elegant flow.');
      await expect(app.cardSha).toHaveText('—');

      // No commit nodes should be visible initially (resetScene hides them)
      for (const id of ['c1','c2','c3','c4','c5','c6','c7','f1','f2','m1']) {
        const visible = await app.isNodeVisible(id);
        expect(visible).toBeFalsy();
      }

      // Edges should be prepared to be drawn (strokeDashoffset is set)
      // We can't rely on exact numbers (getTotalLength might differ), but we can check that
      // the strokeDashoffset style exists on at least one edge element (initialization applied).
      const edgeHasStrokeDash = await page.locator('#edge-1').evaluate(el => !!el.style.strokeDashoffset);
      expect(edgeHasStrokeDash).toBeTruthy();

      // Controls should be enabled and present
      await expect(app.animateBtn).toBeEnabled();
      await expect(app.resetBtn).toBeEnabled();
    });
  });

  test.describe('Transition S0_Idle -> S1_Animating (AnimateClick)', () => {
    test('AnimateClick triggers playSequence(): buttons disabled during animation and commits/edges revealed', async ({ page }) => {
      // This test validates the AnimateClick event described by the FSM.
      // It ensures playSequence() runs: buttons are disabled at start, nodes reveal over time,
      // edges animate, and the final card shows "Flow complete".
      const app = new GitVisualPage(page);

      // Start animation
      await expect(app.animateBtn).toBeEnabled();
      await app.animateBtn.click();

      // Immediately after clicking, playSequence should have disabled the controls
      await expect(app.animateBtn).toBeDisabled();
      await expect(app.resetBtn).toBeDisabled();

      // Wait for sequence to complete by waiting for final card message.
      // The sequence is time-based; allow generous timeout.
      await app.waitForFlowComplete(25000);

      // After completion, controls should be re-enabled
      await expect(app.animateBtn).toBeEnabled();
      await expect(app.resetBtn).toBeEnabled();

      // Verify all expected nodes have become visible (commits appear)
      for (const id of ['c1','c2','c3','c4','f1','f2','m1','c5','c6','c7']) {
        const visible = await app.isNodeVisible(id);
        expect(visible, `expected node ${id} to be visible after animation`).toBeTruthy();
      }

      // Verify some edges have the active class (were animated)
      for (const id of ['edge-1','edge-2','edge-3','edge-f1','edge-f2','edge-merge','edge-4']) {
        const active = await app.isEdgeActive(id);
        expect(active, `expected edge ${id} to have 'active' class after animation`).toBeTruthy();
      }

      // Verify the commit card final state per implementation
      await expect(app.cardMsg).toHaveText('Flow complete');
      await expect(app.cardDetails).toHaveText('Branches merged; history preserved with clarity.');
      await expect(app.cardSha).toHaveText('—');
    }, 30000); // extended timeout for animation-rich test
  });

  test.describe('Transition S1_Animating -> S0_Idle (ResetClick) and edge cases', () => {
    test('ResetClick pressed during S1_Animating is not possible because reset button is disabled; ensure disabled behavior', async ({ page }) => {
      // This test validates an important edge case:
      // The FSM declares a ResetClick transition from Animating -> Idle, but the implementation
      // disables the reset button during playSequence. We assert that the button is disabled
      // during animation and therefore ResetClick cannot be triggered while animating.
      const app = new GitVisualPage(page);

      // Start animation
      await app.animateBtn.click();

      // Immediately ensure both controls disabled
      await expect(app.animateBtn).toBeDisabled();
      await expect(app.resetBtn).toBeDisabled();

      // Attempting to click the disabled reset button should not be possible.
      // Playwright will throw if we attempt to click a disabled element, so assert that behavior.
      let clickThrew = false;
      try {
        await app.resetBtn.click({ timeout: 1000 });
      } catch (err) {
        clickThrew = true;
        // confirm the thrown error is due to element being disabled/not actionable
        expect(String(err)).toMatch(/Element is not visible|not enabled|not attached|element is disabled/i);
      }
      expect(clickThrew).toBeTruthy();

      // Let the animation finish cleanly so subsequent tests run against a stable state
      await app.waitForFlowComplete(20000);
    }, 30000);

    test('ResetClick after S1_Animating returns to S0_Idle: resetScene hides nodes and resets card', async ({ page }) => {
      // This test validates the FSM transition S1 -> S0 triggered by ResetClick in the idle phase:
      // after animation completes, clicking Reset should hide nodes and restore the initial card text.
      const app = new GitVisualPage(page);

      // Play full sequence
      await app.animateBtn.click();
      await app.waitForFlowComplete(20000);

      // Ensure nodes are visible pre-reset (sanity)
      const preVisible = await app.isNodeVisible('c1');
      expect(preVisible).toBeTruthy();

      // Click reset and observe resetScene() effects
      await expect(app.resetBtn).toBeEnabled();
      await app.resetBtn.click();

      // After reset, nodes should no longer be visible and card should be back to initial state
      for (const id of ['c1','c2','c3','c4','f1','f2','m1','c5','c6','c7']) {
        const visible = await app.isNodeVisible(id);
        expect(visible, `expected node ${id} to be hidden after reset`).toBeFalsy();
      }

      // Card should show initial repository ready text again
      await expect(app.cardMsg).toHaveText('Repository ready');
      await expect(app.cardDetails).toHaveText('Press Animate to see commits appear in an elegant flow.');
      await expect(app.cardSha).toHaveText('—');
    }, 30000);

    test('Rapid repeated ResetClick after idle is idempotent (no errors and consistent DOM)', async ({ page }) => {
      // This test checks that multiple reset clicks in the idle state are safe / idempotent.
      const app = new GitVisualPage(page);

      // Ensure in idle
      await app.waitForRepositoryReady();

      // Click reset multiple times rapidly
      await app.resetBtn.click();
      await app.resetBtn.click();
      await app.resetBtn.click();

      // No nodes should be visible and card remains the same
      for (const id of ['c1','c2','c3']) {
        const visible = await app.isNodeVisible(id);
        expect(visible).toBeFalsy();
      }
      await expect(app.cardMsg).toHaveText('Repository ready');
    });
  });

  test.describe('Robustness and Console / Error Observability', () => {
    test('No runtime ReferenceError / SyntaxError / TypeError emitted during normal interactions', async ({ page }) => {
      // This test validates that the page does not emit uncaught runtime errors during use.
      // We interact (animate -> wait -> reset) and then assert that pageErrors and consoleErrors are empty.
      const app = new GitVisualPage(page);

      // Interact: animate and wait a bit (not necessarily full completion)
      await app.animateBtn.click();

      // Wait until first commit appears (c1 visible) to ensure sequence started
      await page.waitForFunction(() => {
        const el = document.getElementById('c1');
        return el && el.classList.contains('visible');
      }, { timeout: 8000 });

      // Now wait for completion for thoroughness
      await app.waitForFlowComplete(20000);

      // Click reset to ensure reset path also exercised
      await app.resetBtn.click();

      // Now assert there were no page errors captured in the beforeEach/afterEach arrays.
      // The afterEach hook will assert arrays are empty; we duplicate an explicit assertion here for clarity.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    }, 35000);
  });
});