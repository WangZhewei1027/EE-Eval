import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d0663-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the B+ Tree page
class BPlusTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateButton = page.locator("button[onclick='animateTree()']");
    this.resetButton = page.locator("button[onclick='resetTree()']");
    this.nodes = page.locator('.node');
    this.container = page.locator('.bptree');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickAnimate() {
    await this.animateButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  // Returns inline style transform values for all nodes as an array of strings
  async getInlineTransforms() {
    const count = await this.nodes.count();
    const results = [];
    for (let i = 0; i < count; i++) {
      const transform = await this.nodes.nth(i).evaluate((el) => el.style.transform);
      results.push(transform);
    }
    return results;
  }

  // Returns computed transform values for all nodes (useful for verifying rendered transforms)
  async getComputedTransforms() {
    const count = await this.nodes.count();
    const results = [];
    for (let i = 0; i < count; i++) {
      const transform = await this.nodes.nth(i).evaluate((el) => {
        return window.getComputedStyle(el).transform;
      });
      results.push(transform);
    }
    return results;
  }

  async getNodeCount() {
    return await this.nodes.count();
  }

  async getButtonOnclickAttr(buttonLocator) {
    return await buttonLocator.evaluate((el) => el.getAttribute('onclick'));
  }
}

test.describe('B+ Tree Visualization (FSM: Idle, Animating, Reset)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages for analysis
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      // store the full Error object message for assertions
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // no-op teardown, listeners are tied to page and will be cleaned automatically
  });

  test('Idle state: page renders and initial node transforms are unset (S0_Idle)', async ({ page }) => {
    // Validates the Idle state rendering and evidence elements
    const bptree = new BPlusTreePage(page);
    await bptree.goto();

    // Verify page title and main elements
    await expect(page).toHaveTitle(/B\+ Tree Visualization/i);
    await expect(bptree.animateButton).toBeVisible();
    await expect(bptree.resetButton).toBeVisible();
    await expect(bptree.container).toBeVisible();

    // Verify inline onclick evidence attributes exist (FSM evidence)
    const animateOnclick = await bptree.getButtonOnclickAttr(bptree.animateButton);
    const resetOnclick = await bptree.getButtonOnclickAttr(bptree.resetButton);
    expect(animateOnclick).toBe('animateTree()');
    expect(resetOnclick).toBe('resetTree()');

    // Verify nodes exist and initial inline transform is empty (no animation yet)
    const nodeCount = await bptree.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    const inlineTransforms = await bptree.getInlineTransforms();
    // All inline transforms should be empty string initially (no inline transform set)
    for (const t of inlineTransforms) {
      expect(t === '' || t === 'translateY(0px)' || t === 'translateY(0)').toBeTruthy();
    }

    // Ensure no uncaught page errors occurred on initial load
    expect(pageErrors.length).toBe(0);
    // Ensure console produced no error level messages
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('AnimateTree event transitions page into Animating (S1_Animating) and nodes move up then stagger back down', async ({ page }) => {
    // Validates the AnimateTree event and S1_Animating behavior
    const bptree = new BPlusTreePage(page);
    await bptree.goto();

    // Click animate to trigger animation
    await bptree.clickAnimate();

    // Immediately after clicking, the script sets node.style.transform = 'translateY(-10px)' for all nodes
    // We assert the inline style reflects that for nodes that haven't been reverted by timeouts.
    const inlineTransformsAfterClick = await bptree.getInlineTransforms();
    // At least one node (preferably the last one) should have '-10px' inline transform since reversion is staggered
    const hasNegative10 = inlineTransformsAfterClick.some((t) => t.includes('-10'));
    expect(hasNegative10).toBeTruthy();

    // Specifically assert inline style for the last node (highest index) to be '-10px'
    const nodeCount = await bptree.getNodeCount();
    const lastIndex = nodeCount - 1;
    const lastTransform = inlineTransformsAfterClick[lastIndex];
    expect(lastTransform === 'translateY(-10px)' || lastTransform.includes('-10')).toBeTruthy();

    // Wait sufficiently long for all staggered timeouts to complete:
    // timeout is index * 300 ms; last index <= 10 typically. Wait for (nodeCount * 300) + buffer
    const waitMs = nodeCount * 300 + 300;
    await page.waitForTimeout(waitMs);

    // After timeouts, inline transform should be set back to 'translateY(0)' by the script (or empty)
    const inlineTransformsAfterRevert = await bptree.getInlineTransforms();
    for (const t of inlineTransformsAfterRevert) {
      // script sets 'translateY(0)' inline, so accept either empty or translateY(0)
      const ok = t === '' || t === 'translateY(0)' || t === 'translateY(0px)';
      expect(ok).toBeTruthy();
    }

    // Verify computed style for a node is not showing the "up" transform anymore
    const computedTransforms = await bptree.getComputedTransforms();
    // computed transform should be either 'none' or a matrix that corresponds to translateY(0)
    const anyStillUp = computedTransforms.some((ct) => typeof ct === 'string' && ct.includes('-10'));
    expect(anyStillUp).toBeFalsy();

    // Ensure no uncaught page errors during animation
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Reset event from Idle resets nodes to original position (S2_Reset)', async ({ page }) => {
    // Validates Reset from Idle state
    const bptree = new BPlusTreePage(page);
    await bptree.goto();

    // Precondition: inline transforms empty
    const beforeTransforms = await bptree.getInlineTransforms();
    for (const t of beforeTransforms) {
      expect(t === '' || t === 'translateY(0)' || t === 'translateY(0px)').toBeTruthy();
    }

    // Click reset and verify inline style becomes translateY(0)
    await bptree.clickReset();

    const afterTransforms = await bptree.getInlineTransforms();
    for (const t of afterTransforms) {
      // The reset function sets style.transform = 'translateY(0)', so expect that value
      expect(t === 'translateY(0)' || t === 'translateY(0px)' || t === '').toBeTruthy();
    }

    // Ensure no errors occurred
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Reset event during Animating transitions back to Idle and cancels staggered animation (S1_Animating -> S0_Idle)', async ({ page }) => {
    // Validates transition from Animating to Idle by invoking Reset while animation is ongoing
    const bptree = new BPlusTreePage(page);
    await bptree.goto();

    // Start animation
    await bptree.clickAnimate();

    // Immediately click reset to interrupt the staggered reversion logic
    // This should set all node.style.transform = 'translateY(0)' synchronously
    await bptree.clickReset();

    // After reset, inline transforms should be translateY(0)
    const transformsAfterReset = await bptree.getInlineTransforms();
    for (const t of transformsAfterReset) {
      expect(t === 'translateY(0)' || t === 'translateY(0px)' || t === '').toBeTruthy();
    }

    // Wait a short time to ensure no later timeouts re-apply transforms upwards
    await page.waitForTimeout(600);

    // Re-check: no node should have '-10px' inline transform
    const transformsFinal = await bptree.getInlineTransforms();
    const anyUp = transformsFinal.some((t) => t.includes('-10'));
    expect(anyUp).toBeFalsy();

    // Validate no page errors produced during interrupt
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Edge case: Rapid multiple Animate clicks and multiple Reset clicks do not throw errors and result in stable state', async ({ page }) => {
    // Ensures repeated interactions are stable and do not produce uncaught exceptions
    const bptree = new BPlusTreePage(page);
    await bptree.goto();

    // Rapidly click animate multiple times
    for (let i = 0; i < 3; i++) {
      await bptree.clickAnimate();
    }

    // Immediately click reset multiple times
    for (let i = 0; i < 3; i++) {
      await bptree.clickReset();
    }

    // Wait for any pending timeouts to complete
    const nodeCount = await bptree.getNodeCount();
    await page.waitForTimeout(nodeCount * 300 + 300);

    // Final transforms should be 'translateY(0)' or empty
    const finalTransforms = await bptree.getInlineTransforms();
    for (const t of finalTransforms) {
      expect(t === 'translateY(0)' || t === 'translateY(0px)' || t === '').toBeTruthy();
    }

    // No uncaught page errors or console error messages
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Observability: capture console logs and page errors during interactions', async ({ page }) => {
    // This test intentionally verifies that we observe console and page errors (if any)
    const bptree = new BPlusTreePage(page);
    await bptree.goto();

    // Interact with the page to potentially trigger messages
    await bptree.clickAnimate();
    await page.waitForTimeout(100);
    await bptree.clickReset();

    // We do not force errors; instead we assert that no unexpected unhandled exceptions occurred
    // If there were ReferenceError/SyntaxError/TypeError they would be present in pageErrors
    // Assert that there are no page errors (this indicates the script ran without uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // Also assert that console does not contain messages with type 'error'
    const consoleError = consoleMessages.find((m) => m.type === 'error');
    expect(consoleError).toBeUndefined();

    // Add an assertion to record that console messages were observed (non-empty or empty acceptable)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});