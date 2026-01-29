import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c99d762-fa78-11f0-857d-d58e82d5de73.html';

test.describe('TCP/IP Stack Visualization - FSM and UI interactions', () => {
  // Collect console messages and page errors for each test to assert on them.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages
    page.on('console', msg => {
      // Collect text and type for assertions and debugging
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // In case any test left the mouse over something, move it out to avoid cross-test influences.
    try {
      await page.mouse.move(0, 0);
    } catch (e) {
      // ignore
    }
  });

  test('Initial render (S0_Idle) - page renders and key elements present', async ({ page }) => {
    // This verifies the entry action of the Idle state: renderPage() (observed as page content)
    // Check heading exists and content
    const heading = page.locator('h1');
    await expect(heading).toHaveText('TCP/IP Stack');

    // Verify the toggle button exists and initial attributes/text (evidence from FSM)
    const toggleBtn = page.locator('#toggleAnimationBtn');
    await expect(toggleBtn).toHaveCount(1);
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Pause or resume packet flow animations');
    await expect(toggleBtn).toHaveText('Pause Animation');

    // Verify packets exist
    const packets = page.locator('.packet');
    await expect(packets).toHaveCount(2);

    // No uncaught page errors immediately after load
    expect(pageErrors.length).toBe(0);

    // Ensure no critical console errors were emitted on load
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Tooltip behavior (S0_Idle -> S1_TooltipVisible -> S0_Idle) - mouseenter, mousemove, mouseleave', async ({ page }) => {
    // This test validates the tooltip lifecycle and repositioning logic.
    const firstLayer = page.locator('.layer').first();
    const tooltip = page.locator('#tooltip');

    // Ensure tooltip is initially hidden (no visible class)
    await expect(tooltip).not.toHaveClass(/visible/);

    // Get bounding box of layer to generate realistic mouse events
    const box = await firstLayer.boundingBox();
    expect(box).not.toBeNull();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Move mouse to the center of the layer to trigger mouseenter and positionTooltip
    await page.mouse.move(centerX, centerY);
    // Small wait to allow event handlers to run and the tooltip to become visible
    await page.waitForTimeout(50);

    // Tooltip should become visible and contain the data-tooltip text
    await expect(tooltip).toHaveClass(/visible/);
    const expectedTooltipText = await firstLayer.getAttribute('data-tooltip');
    await expect(tooltip).toHaveText(expectedTooltipText);

    // Record tooltip position after enter
    const posAfterEnter = await tooltip.evaluate(el => ({ top: el.style.top, left: el.style.left }));

    // Trigger mousemove within the same layer to reposition tooltip
    const moveX = box.x + box.width - 5;
    const moveY = box.y + box.height - 5;
    await page.mouse.move(moveX, moveY);
    // Wait for the positionTooltip handler to run
    await page.waitForTimeout(50);

    const posAfterMove = await tooltip.evaluate(el => ({ top: el.style.top, left: el.style.left }));

    // Expect the tooltip to have been repositioned (top or left should be different)
    const repositioned = (posAfterEnter.top !== posAfterMove.top) || (posAfterEnter.left !== posAfterMove.left);
    expect(repositioned).toBe(true);

    // Move mouse outside to trigger mouseleave
    await page.mouse.move(0, 0);
    // Wait longer than the 200ms hide timeout used in implementation
    await page.waitForTimeout(300);

    // Tooltip should no longer be visible
    await expect(tooltip).not.toHaveClass(/visible/);

    // Ensure no uncaught errors during tooltip interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Animation toggle (S0_Idle -> S2_AnimationPaused -> S3_AnimationRunning etc.) - toggling animations and verifying styles & attributes', async ({ page }) => {
    // This test validates the transitions for TOGGLE_ANIMATION and checks packet animation-play-state changes
    const toggleBtn = page.locator('#toggleAnimationBtn');
    const packets = await page.$$('.packet');

    // Helper to read computed animation-play-state of all packets
    const getAnimationStates = async () => {
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.packet')).map(el => {
          const cs = getComputedStyle(el);
          // Use the js property name on the computed style (camelCase)
          return cs.animationPlayState || cs.getPropertyValue('animation-play-state');
        });
      });
    };

    // Initial state: button indicates Pause Animation and aria-pressed is true
    await expect(toggleBtn).toHaveText('Pause Animation');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

    // Check initial animation states (should be 'running' as per CSS default)
    let states = await getAnimationStates();
    states.forEach(s => expect(s).toBe('running'));

    // Click to pause animations (S0_Idle -> S2_AnimationPaused)
    await toggleBtn.click();
    // allow the click handler to apply styles/attributes
    await page.waitForTimeout(50);

    // Button text and aria attributes should reflect paused state
    await expect(toggleBtn).toHaveText('Resume Animation');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Resume packet flow animations');

    // Packets should have animationPlayState = paused
    states = await getAnimationStates();
    states.forEach(s => expect(s).toBe('paused'));

    // Click again to resume animations (S2_AnimationPaused -> S3_AnimationRunning)
    await toggleBtn.click();
    await page.waitForTimeout(50);

    // Button and aria attributes reflect running state
    await expect(toggleBtn).toHaveText('Pause Animation');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Pause packet flow animations');

    // Packets should be running again
    states = await getAnimationStates();
    states.forEach(s => expect(s).toBe('running'));

    // Edge case: rapid double click (two toggles) should result in a stable final state
    // We'll click twice quickly: should toggle to paused then running -> final 'running'
    await toggleBtn.click();
    await toggleBtn.click();
    // allow handler to settle
    await page.waitForTimeout(100);

    // Final state should be running
    states = await getAnimationStates();
    states.forEach(s => expect(s).toBe('running'));

    // Ensure no uncaught errors during toggling
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Multiple layers tooltip consistency and no errors when interacting with all layers', async ({ page }) => {
    // Validate tooltip works for each layer element and that no page errors occur when iterating through them.
    const layers = page.locator('.layer');
    const count = await layers.count();
    expect(count).toBeGreaterThanOrEqual(5);

    const tooltip = page.locator('#tooltip');

    for (let i = 0; i < count; i++) {
      const layer = layers.nth(i);
      const box = await layer.boundingBox();
      expect(box).not.toBeNull();

      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      await page.mouse.move(cx, cy);
      await page.waitForTimeout(40);

      // Tooltip should appear and text should match data-tooltip
      await expect(tooltip).toHaveClass(/visible/);
      const expected = await layer.getAttribute('data-tooltip');
      await expect(tooltip).toHaveText(expected);

      // Move out and wait for hide
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      await expect(tooltip).not.toHaveClass(/visible/);
    }

    // Confirm still no page-level errors after iterating all layers
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('No runtime ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
    // This test inspects captured page errors to ensure no common runtime errors occurred.
    // If such errors occurred they would be captured in pageErrors by the listener in beforeEach.
    // We assert that none of the pageErrors contain the common error types.
    const problematic = pageErrors.filter(err => {
      const name = err.name || '';
      return name.includes('ReferenceError') || name.includes('SyntaxError') || name.includes('TypeError');
    });

    // Expect zero critical runtime errors of these types
    expect(problematic.length).toBe(0);

    // Additionally ensure there were no console.error messages that might signal issues
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});