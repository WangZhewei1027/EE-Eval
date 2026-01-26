import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac4f41-fa78-11f0-812d-c9788050701f.html';

test.describe('OSI Model | Visual Exploration - FSM validation (72ac4f41-fa78-11f0-812d-c9788050701f)', () => {
  // Containers for console and page errors collected per test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic assertions about runtime errors collected during the test.
    // The test should surface any console.error or uncaught exceptions.
    // If errors exist, fail the test with a descriptive message listing the errors.
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Throwing here ensures Playwright surfaces the errors in test output.
      throw new Error(
        `Runtime errors detected.\nConsole errors: ${JSON.stringify(consoleErrors, null, 2)}\nPage errors: ${JSON.stringify(pageErrors, null, 2)}`
      );
    }
  });

  test('Initial render - S0_Idle: controls present, layers rendered, data flow hidden', async ({ page }) => {
    // Validate the page rendered and initial Idle state (S0_Idle)
    // - Buttons exist
    // - No layer has "active" class
    // - data-flow container is not visible (no .active class)
    // - Flow arrows/text are at initial styles (opacity 0, transform off-screen/scale)
    const showFlowBtn = page.locator('#showFlow');
    const resetBtn = page.locator('#resetView');
    await expect(showFlowBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();

    // Ensure header text is correct (sanity check for renderPage entry action)
    await expect(page.locator('h1')).toHaveText('OSI Model');

    // Layers present: there should be 7 .layer elements
    const layers = page.locator('.layer');
    await expect(layers).toHaveCount(7);

    // No layer should have the "active" class initially
    const activeLayers = page.locator('.layer.active');
    await expect(activeLayers).toHaveCount(0);

    // data-flow should exist and not have 'active' initially
    const dataFlow = page.locator('.data-flow');
    await expect(dataFlow).toBeVisible(); // container exists in DOM
    await expect(dataFlow).not.toHaveClass(/active/);

    // Flow arrows and texts should be at initial hidden state (opacity 0)
    const firstArrow = page.locator('.flow-arrow').first();
    const firstText = page.locator('.flow-text').first();

    // Assert inline style or computed style indicates hidden initial state.
    // The implementation sets initial opacity via CSS to 0 and transform translateY(20px)/scale(0.8).
    const arrowOpacity = await firstArrow.evaluate(el => getComputedStyle(el).opacity);
    const textOpacity = await firstText.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(arrowOpacity)).toBeCloseTo(0, 3);
    expect(parseFloat(textOpacity)).toBeCloseTo(0, 3);

    // Also confirm no runtime console errors or page errors happened during load (collected in afterEach)
  });

  test('Layer click activates a layer (S0_Idle -> S1_LayerActive) and highlights corresponding flow element', async ({ page }) => {
    // This test validates:
    // - Clicking a layer removes .active from others and sets it on clicked layer
    // - The layer's description <p> becomes visible (via max-height/opacity)
    // - The corresponding flow-text item is highlighted (background set to var(--highlight))

    // Choose a middle layer to click (Transport, data-layer="4")
    const targetLayer = page.locator('.layer[data-layer="4"]');
    await expect(targetLayer).toBeVisible();

    // Click the target layer
    await targetLayer.click();

    // After clicking, exactly one layer should have .active and it's the one we clicked
    const activeLayers = page.locator('.layer.active');
    await expect(activeLayers).toHaveCount(1);
    await expect(targetLayer).toHaveClass(/active/);

    // The paragraph inside the active layer should be visible (opacity ~1 and max-height > 0)
    const para = targetLayer.locator('p');
    const paraOpacity = await para.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(paraOpacity)).toBeGreaterThan(0.8);

    // Verify highlight: The JS computes index = 8 - layerNum (reverse order).
    // For layerNum 4, index = 4. The flow-text at index 4 (0-based) should be highlighted.
    const highlightIndex = 8 - 4; // 4
    const flowTexts = page.locator('.flow-text');
    // Ensure there are at least highlightIndex+1 items
    const totalFlowTexts = await flowTexts.count();
    expect(totalFlowTexts).toBeGreaterThanOrEqual(highlightIndex + 1);

    const highlighted = flowTexts.nth(highlightIndex);
    // The script sets highlighted.style.backgroundColor = 'var(--highlight)' and color = 'white'.
    // Computed background color should resolve to the hex #ff5252 => rgb(255, 82, 82)
    const bgColor = await highlighted.evaluate(el => getComputedStyle(el).backgroundColor);
    const fgColor = await highlighted.evaluate(el => getComputedStyle(el).color);

    // Accept either the resolved rgb or the literal 'var(--highlight)' in inline style; check resolved RGB is the highlight
    expect(bgColor.replace(/\s+/g, '')).toBe('rgb(255,82,82)'.replace(/\s+/g, ''));
    // Foreground text should be white
    expect(fgColor.replace(/\s+/g, '')).toBe('rgb(255,255,255)'.replace(/\s+/g, ''));

    // Also assert that no extra layers are active
    const otherActiveCount = await page.locator('.layer.active').count();
    expect(otherActiveCount).toBe(1);
  });

  test('Show Data Flow click displays flow (S1_LayerActive -> S2_DataFlowVisible) and animates arrows/texts', async ({ page }) => {
    // This test validates:
    // - Clicking "Show Data Flow" adds .active to .data-flow
    // - Flow arrows and texts animate to visible state (opacity 1 / transform resets)
    // First, click a layer to be in S1_LayerActive (optional but follows FSM)
    await page.locator('.layer[data-layer="2"]').click();

    // Click the show flow button
    await page.locator('#showFlow').click();

    // data-flow should now have .active class
    const dataFlow = page.locator('.data-flow');
    await expect(dataFlow).toHaveClass(/active/);

    // Wait until at least the last animation delay would have elapsed.
    // There are 8 arrows/texts, each arrow delayed by index * 200 ms, text delayed by index*200+100.
    // Wait for the final text to become visible (index 7 => delay 7*200+100 = 1500ms)
    await page.waitForTimeout(1600);

    // Confirm that arrows and texts have transitioned to visible state (opacity ~1)
    const arrows = page.locator('.flow-arrow');
    const texts = page.locator('.flow-text');

    // Check a couple of representative items: first, middle, last
    const indicesToCheck = [0, Math.max(0, (await arrows.count()) - 1)];
    for (const idx of indicesToCheck) {
      const arrow = arrows.nth(idx);
      const text = texts.nth(idx);

      const arrowOpacity = await arrow.evaluate(el => getComputedStyle(el).opacity);
      const textOpacity = await text.evaluate(el => getComputedStyle(el).opacity);

      expect(parseFloat(arrowOpacity)).toBeGreaterThan(0.8);
      expect(parseFloat(textOpacity)).toBeGreaterThan(0.8);
    }

    // Confirm that inline styles for transform were reset for arrows (they should not remain translated by 20px)
    const arrowTransform = await arrows.nth(0).evaluate(el => getComputedStyle(el).transform);
    // The transform should not be a pure translateY(20px) (matrix values will differ). Just assert it's not 'none' or matches identity when animated.
    expect(arrowTransform).not.toBe('none'); // it's acceptable to be transformed due to rotation/resolution; main thing is visible opacity.

    // Ensure no runtime errors occurred while animating (checked in afterEach)
  });

  test('Reset view from DataFlowVisible returns to Idle (S2_DataFlowVisible -> S0_Idle)', async ({ page }) => {
    // This test validates:
    // - Reset removes .active from layers and data-flow
    // - Flow arrows and texts are returned to hidden styles (opacity 0, transform reset)
    // Setup: activate a layer and show data flow
    await page.locator('.layer[data-layer="5"]').click();
    await page.locator('#showFlow').click();
    // Allow animations to run
    await page.waitForTimeout(1200);

    // Sanity: ensure data-flow is active and a layer is active
    await expect(page.locator('.data-flow')).toHaveClass(/active/);
    await expect(page.locator('.layer.active')).toHaveCount(1);

    // Click reset
    await page.locator('#resetView').click();

    // After reset: no layers active and data-flow not active
    await expect(page.locator('.layer.active')).toHaveCount(0);
    await expect(page.locator('.data-flow')).not.toHaveClass(/active/);

    // Flow arrows and texts should revert to hidden states (opacity near 0 and transforms as set in reset)
    // The reset handler sets arrow.style.opacity = '0' and arrow.style.transform = 'translateY(20px)'
    // Check a couple of items
    const firstArrowOpacity = await page.locator('.flow-arrow').first().evaluate(el => getComputedStyle(el).opacity);
    const firstArrowTransform = await page.locator('.flow-arrow').first().evaluate(el => getComputedStyle(el).transform);
    const firstTextOpacity = await page.locator('.flow-text').first().evaluate(el => getComputedStyle(el).opacity);

    expect(parseFloat(firstArrowOpacity)).toBeLessThan(0.1);
    // transform might be returned as a matrix corresponding to translateY(20px). To be robust, assert the computed style string contains 'matrix' or 'translate' but not an identity that suggests visible
    expect(firstArrowTransform).toMatch(/matrix|translate/);
    expect(parseFloat(firstTextOpacity)).toBeLessThan(0.1);

    // Also verify that highlighted flow-texts return to white background and secondary text color
    const flowTextCount = await page.locator('.flow-text').count();
    for (let i = 0; i < Math.min(flowTextCount, 3); i++) {
      const txt = page.locator('.flow-text').nth(i);
      const bgColor = await txt.evaluate(el => getComputedStyle(el).backgroundColor);
      // Reset sets background to 'white' in highlightFlowElement reset; expect white
      expect(bgColor.replace(/\s+/g, '')).toBe('rgb(255,255,255)'.replace(/\s+/g, ''));
    }
  });

  test('Edge cases: clicking Reset before ShowFlow and rapid clicking of ShowFlow', async ({ page }) => {
    // This test validates edge conditions:
    // - Clicking Reset when already Idle should not throw errors and should keep the page in Idle
    // - Rapidly clicking Show Data Flow multiple times does not cause uncaught exceptions and eventually shows the flow

    // Ensure Idle
    await expect(page.locator('.layer.active')).toHaveCount(0);
    await expect(page.locator('.data-flow')).not.toHaveClass(/active/);

    // Click reset right away (edge case)
    await page.locator('#resetView').click();
    // No change expected: remain idle
    await expect(page.locator('.layer.active')).toHaveCount(0);
    await expect(page.locator('.data-flow')).not.toHaveClass(/active/);

    // Rapidly click Show Data Flow several times
    const showBtn = page.locator('#showFlow');
    await showBtn.click();
    await showBtn.click();
    await showBtn.click();

    // Wait for animations to stabilize (max expected ~1600ms from earlier)
    await page.waitForTimeout(1700);

    // Expect data-flow active and arrows/texts visible
    await expect(page.locator('.data-flow')).toHaveClass(/active/);
    const arrowOpacity = await page.locator('.flow-arrow').first().evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(arrowOpacity)).toBeGreaterThan(0.8);

    // No errors should have been emitted (checked in afterEach)
  });

  test('Sanity: ensure clicking different layers switches active state exclusive behavior', async ({ page }) => {
    // Validate that clicking a second layer removes active from the first (exclusive activation)
    const layer3 = page.locator('.layer[data-layer="3"]');
    const layer6 = page.locator('.layer[data-layer="6"]');

    await layer3.click();
    await expect(layer3).toHaveClass(/active/);
    await expect(layer6).not.toHaveClass(/active/);

    await layer6.click();
    await expect(layer6).toHaveClass(/active/);
    // Now layer3 should have been deactivated
    await expect(layer3).not.toHaveClass(/active/);
  });
});