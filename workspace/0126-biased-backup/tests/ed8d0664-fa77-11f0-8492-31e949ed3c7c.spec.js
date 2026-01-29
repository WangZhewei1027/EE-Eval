import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d0664-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Heap app
class HeapPage {
  constructor(page) {
    this.page = page;
    this.animateButton = page.locator('#animateButton');
    this.nodes = page.locator('.node');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the basic DOM is present
    await expect(this.animateButton).toBeVisible();
    await expect(this.nodes).toHaveCount(6);
  }

  // Click the animate button
  async clickAnimate() {
    await this.animateButton.click();
  }

  // Return an array of inline style.transform values for all nodes
  async getInlineTransforms() {
    return this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.node')).map(n => n.style.transform || '');
    });
  }

  // Return true when at least one node has transform equal to translateY(-20px)
  async waitForAnyNodeToLift(timeout = 1000) {
    await this.page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      return nodes.some(n => n.style.transform.includes('translateY(-20px)'));
    }, { timeout });
  }

  // Wait for all nodes to have returned to translateY(0) (end of animation)
  // The app sets transform back to 'translateY(0)' inline
  async waitForAnimationEnd(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      return nodes.every(n => n.style.transform.includes('translateY(0)'));
    }, { timeout });
  }
}

test.describe('Min Heap Visualization - FSM and UI behavior', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const heap = new HeapPage(page);
    await heap.goto();
  });

  test.afterEach(async ({ page }) => {
    // Small sanity: expose console and page errors in test output if present
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Console messages captured:', consoleMessages);
    }
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.log('Page errors captured:', pageErrors);
    }
  });

  test('Initial Idle state: nodes present and no inline transforms', async ({ page }) => {
    // This test verifies the Idle state (S0_Idle) on initial load:
    // - isAnimating should be false (inferred via no inline transforms)
    // - Nodes are present and button exists
    const heap = new HeapPage(page);

    // Assert six nodes exist
    await expect(heap.nodes).toHaveCount(6);

    // Inline transforms should be empty strings initially
    const transforms = await heap.getInlineTransforms();
    for (const t of transforms) {
      expect(t).toBe('', 'Expected no inline transform on nodes in Idle state');
    }

    // No runtime page errors should have happened on load
    expect(pageErrors.length).toBe(0);
    // No console errors on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition Idle -> Animating on click: nodes lift and return (S0 -> S1)', async ({ page }) => {
    // This test validates the transition from Idle to Animating:
    // - Clicking the Animate button should make nodes animate (translateY(-20px))
    // - After the full duration, nodes should return to translateY(0)
    const heap = new HeapPage(page);

    // Click to start animation
    const startTime = Date.now();
    await heap.clickAnimate();

    // Within a short interval, at least one node should lift
    await heap.waitForAnyNodeToLift(1000);

    // Verify at least one node has inline transform '-20px' at lift moment
    const transformsDuring = await heap.getInlineTransforms();
    const anyLifted = transformsDuring.some(t => t.includes('-20px'));
    expect(anyLifted).toBe(true);

    // Wait for the animation to complete (based on JS: nodes.length*300 + 500)
    // For 6 nodes: 6*300 + 500 = 2300ms -> give buffer
    await heap.waitForAnimationEnd(4000);

    const endTime = Date.now();
    const elapsed = endTime - startTime;

    // Final inline transforms should reflect translateY(0) per implementation
    const transformsAfter = await heap.getInlineTransforms();
    for (const t of transformsAfter) {
      expect(t).toContain('translateY(0)', 'Expected node to have returned to translateY(0) after animation');
    }

    // Ensure the total elapsed time is within reasonable bounds (not immediate)
    expect(elapsed).toBeGreaterThanOrEqual(1000);

    // No page errors during animation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Guard behavior: clicking while animating does not restart animation (S1 guard)', async ({ page }) => {
    // This test validates the guard that prevents re-triggering animation while already animating.
    // Approach:
    // - Click once to start animation
    // - Immediately click again (should be ignored)
    // - Ensure the animation still ends at approximately the original expected time (no restart)
    const heap = new HeapPage(page);

    // Start first animation
    const startTime = Date.now();
    await heap.clickAnimate();

    // Wait a short moment to ensure first click began (but still animating)
    await heap.page.waitForTimeout(150);

    // Click again immediately while animation is in progress
    await heap.clickAnimate();

    // Wait for animation end (should be around initial duration, not extended)
    await heap.waitForAnimationEnd(4000);

    const endTime = Date.now();
    const elapsed = endTime - startTime;

    // Expected single-run duration is ~2300ms for 6 nodes; allow some buffer
    expect(elapsed).toBeLessThan(4500);

    // After animation, nodes should be at translateY(0)
    const transformsAfter = await heap.getInlineTransforms();
    for (const t of transformsAfter) {
      expect(t).toContain('translateY(0)');
    }

    // Confirm no page errors were thrown
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('After animation completes, clicking again re-triggers animation (S0 -> S1 again)', async ({ page }) => {
    // This test validates that once animation completes (S1 -> S0),
    // clicking the button again starts a fresh animation sequence.
    const heap = new HeapPage(page);

    // Trigger first animation and wait for end
    await heap.clickAnimate();
    await heap.waitForAnimationEnd(4000);

    // Record transforms after first animation ended
    const transformsAfterFirst = await heap.getInlineTransforms();

    // Click again after completion
    await heap.clickAnimate();

    // Now wait for a lift to happen again (fresh animation)
    await heap.waitForAnyNodeToLift(1000);

    // Verify that nodes have been set to lift again (translateY(-20px))
    const transformsDuringSecond = await heap.getInlineTransforms();
    const anyLifted = transformsDuringSecond.some(t => t.includes('-20px'));
    expect(anyLifted).toBe(true);

    // Wait for this second animation to finish
    await heap.waitForAnimationEnd(4000);

    // Final check: nodes returned to translateY(0)
    const transformsAfterSecond = await heap.getInlineTransforms();
    for (const t of transformsAfterSecond) {
      expect(t).toContain('translateY(0)');
    }

    // Ensure no page errors were reported across the sequence
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: ensure no unexpected runtime errors (ReferenceError/SyntaxError/TypeError) in console or page', async ({ page }) => {
    // This test inspects captured console messages and page errors to ensure
    // that no ReferenceError, SyntaxError, or TypeError occurred during interactions.
    // We perform a full interaction cycle to exercise the code paths.

    const heap = new HeapPage(page);

    // perform one full animation cycle
    await heap.clickAnimate();
    await heap.waitForAnimationEnd(4000);

    // perform another cycle
    await heap.clickAnimate();
    await heap.waitForAnimationEnd(4000);

    // Inspect pageErrors for common JS error types
    const errorTypesSeen = pageErrors.map(e => String(e && e.name ? e.name : e)).join('; ');
    // If any page error exists, fail with the details
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, but found: ${errorTypesSeen}`);

    // Inspect console errors and ensure none mention ReferenceError/SyntaxError/TypeError
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      const errorTexts = consoleErrors.map(e => e.text).join('\n---\n');
      // Fail the test showing console error contents
      expect(consoleErrors.length).toBe(0, `Console errors detected: ${errorTexts}`);
    }

    // Also verify that general console output does not include JS error keywords
    const joinedConsole = consoleMessages.map(m => m.text).join(' ').toLowerCase();
    expect(joinedConsole).not.toContain('referenceerror');
    expect(joinedConsole).not.toContain('syntaxerror');
    expect(joinedConsole).not.toContain('typeerror');
  });
});