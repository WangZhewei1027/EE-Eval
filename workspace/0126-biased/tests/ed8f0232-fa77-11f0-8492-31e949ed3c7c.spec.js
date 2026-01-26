import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f0232-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('B-Tree Index Visualization (FSM) - ed8f0232-fa77-11f0-8492-31e949ed3c7c', () => {
  // Shared arrays to capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages of type 'error' and for uncaught page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Clear handlers implicitly by ending the test; arrays will be checked inside tests
  });

  test('Initial Idle state renders correctly (S0_Idle)', async ({ page }) => {
    // Validate the initial Idle state UI: presence of title, animate button, and nodes
    const title = page.locator('h1', { hasText: 'B-Tree Index Visualization' });
    await expect(title).toHaveCount(1);

    const animateButton = page.locator('#animateButton');
    await expect(animateButton).toHaveCount(1);
    await expect(animateButton).toHaveText('Animate');

    const nodes = page.locator('.node');
    await expect(nodes).toHaveCount(6);

    // Verify nodes have their initial inline transform style empty (no animation yet)
    const initialTransforms = await Promise.all(
      (await nodes.elementHandles()).map(async handle => (await handle.getProperty('style')).getPropertyValue('transform'))
    );
    // All should be empty string initially
    for (const t of initialTransforms) {
      expect(t === '' || t === 'none').toBeTruthy();
    }

    // Assert no console errors or page errors occurred during load/render
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Animating on animate button click (staggered animation)', async ({ page }) => {
    // This test validates that clicking the animate button triggers the staggered translateY(-20px)
    const animateButton = page.locator('#animateButton');
    const nodes = page.locator('.node');

    // Click to start animation (this represents the AnimateButtonClick event)
    await animateButton.click();

    // Immediately after click the first node (index 0) should be set to translateY(-20px) quickly
    // The script calls setTimeout(..., index * 500) => index 0 => 0ms, so expect near-immediate inline style change.
    await page.waitForTimeout(50);
    const firstNodeStyle = await page.locator('.node').nth(0).evaluate(node => node.style.transform);
    expect(firstNodeStyle).toBe('translateY(-20px)');

    // The second node (index 1) should be up after ~500ms (give margin)
    await page.waitForTimeout(550);
    const secondNodeStyle = await page.locator('.node').nth(1).evaluate(node => node.style.transform);
    expect(secondNodeStyle).toBe('translateY(-20px)');

    // A mid node (index 3) should become translated after ~1500ms
    await page.waitForTimeout(1000); // cumulative ~1600ms
    const midNodeStyle = await page.locator('.node').nth(3).evaluate(node => node.style.transform);
    expect(midNodeStyle).toBe('translateY(-20px)');

    // Wait until all nodes have completed their up-and-down animation.
    // Last node index 5: up at 5*500 = 2500ms, down at 2500+300 = 2800ms.
    // Allow a buffer and wait total 3500ms from initial click to ensure completion.
    await page.waitForTimeout(2000); // we already waited ~1650ms, so additional wait ~2000ms -> total ~3650ms

    // After completion all nodes' inline style should be 'translateY(0)' (per implementation)
    const finalTransforms = await Promise.all(
      (await nodes.elementHandles()).map(async handle => (await handle.getProperty('style')).getPropertyValue('transform'))
    );
    for (const t of finalTransforms) {
      expect(t).toBe('translateY(0)');
    }

    // Ensure no runtime console errors or page errors occurred during the animation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_Animating -> S0_Idle when animation completes and on re-click (restart animation)', async ({ page }) => {
    const animateButton = page.locator('#animateButton');
    const nodes = page.locator('.node');

    // Start first animation and let it complete
    await animateButton.click();
    await page.waitForTimeout(3600); // wait until first run done

    // Confirm nodes are at translateY(0) after completion
    const postRunTransforms = await Promise.all(
      (await nodes.elementHandles()).map(async handle => (await handle.getProperty('style')).getPropertyValue('transform'))
    );
    for (const t of postRunTransforms) {
      expect(t).toBe('translateY(0)');
    }

    // Click again to restart animation (S0_Idle -> S1_Animating again)
    await animateButton.click();

    // First node should go up again quickly
    await page.waitForTimeout(80);
    const firstNodeAfterSecondClick = await page.locator('.node').nth(0).evaluate(node => node.style.transform);
    expect(firstNodeAfterSecondClick).toBe('translateY(-20px)');

    // Wait until second run completes (give buffer)
    await page.waitForTimeout(3600);

    // Final state should again be translateY(0) for all nodes
    const finalTransformsSecondRun = await Promise.all(
      (await nodes.elementHandles()).map(async handle => (await handle.getProperty('style')).getPropertyValue('transform'))
    );
    for (const t of finalTransformsSecondRun) {
      expect(t).toBe('translateY(0)');
    }

    // Ensure no runtime console errors or page errors occurred during restarts
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks do not throw errors and final state is stable', async ({ page }) => {
    const animateButton = page.locator('#animateButton');
    const nodes = page.locator('.node');

    // Rapidly click the animate button multiple times (simulate user spamming)
    await animateButton.click();
    await page.waitForTimeout(100);
    await animateButton.click();
    await page.waitForTimeout(100);
    await animateButton.click();
    await page.waitForTimeout(100);
    await animateButton.click();

    // Wait a safe duration for all scheduled timeouts from multiple clicks to settle.
    // Worst-case: last scheduled up occurs at ~2500ms after the last click, plus 300ms to go down.
    await page.waitForTimeout(4000);

    // At the end, nodes should be at translateY(0) (stable idle state)
    const finalTransforms = await Promise.all(
      (await nodes.elementHandles()).map(async handle => (await handle.getProperty('style')).getPropertyValue('transform'))
    );
    for (const t of finalTransforms) {
      // If multiple overlapping animations occurred, final inline style still should be 'translateY(0)'
      expect(t).toBe('translateY(0)');
    }

    // Confirm no console or page errors were emitted even under rapid interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: page logs and errors monitoring (capture console and page errors)', async ({ page }) => {
    // This test explicitly validates that we are observing console and page errors.
    // No errors are expected for the provided implementation; test will fail if any errors occurred.
    // Trigger standard interaction
    await page.locator('#animateButton').click();
    await page.waitForTimeout(3600);

    // Validate that our error collectors are available and have recorded any errors (expected zero)
    // We assert that zero page errors and console errors exist which indicates the implementation ran cleanly.
    expect(Array.isArray(consoleErrors)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // Assert no console errors
    expect(consoleErrors.length).toBe(0);

    // Assert no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});