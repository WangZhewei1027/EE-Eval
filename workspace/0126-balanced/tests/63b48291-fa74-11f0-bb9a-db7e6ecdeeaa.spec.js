import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b48291-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Helper to get absolute canvas coordinates for a neuron given layer x,y in page coordinates
async function getCanvasCoordinates(page, canvasSelector, offsetX, offsetY) {
  const rect = await page.locator(canvasSelector).evaluate((c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  return { x: rect.x + offsetX, y: rect.y + offsetY };
}

test.describe('Neural Networks Interactive Demo - FSM and UI tests', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console error messages and page errors to assert later
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept any dialogs (e.g., alert) so they don't block tests.
    // We still record that a dialog appeared by listening.
    page.on('dialog', async (dialog) => {
      // Log dialog to console for debugging; accept to continue tests.
      // Do not modify the page's logic; simply accept native dialog.
      // This keeps test flow uninterrupted if alert() fires.
      await dialog.accept();
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // After each test we assert no unexpected runtime errors were emitted
    // These assertions are done per individual test as needed, but keep a final safety check here if desired.
  });

  test('S0_Idle: Initial state renders and shows initial activations', async ({ page }) => {
    // Verify the sliders exist and initial labels are 0.50 as per entry action updateActivations([0.5,0.5])
    const input0 = page.locator('#input0');
    const input1 = page.locator('#input1');
    const input0Val = page.locator('#input0Val');
    const input1Val = page.locator('#input1Val');
    const outputValue = page.locator('#outputValue');
    const canvas = page.locator('#networkCanvas');

    // Elements should be visible
    await expect(input0).toBeVisible();
    await expect(input1).toBeVisible();
    await expect(page.locator('#trainBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(canvas).toBeVisible();

    // Check initial slider values and displayed labels are 0.50
    await expect(input0).toHaveValue('0.5');
    await expect(input1).toHaveValue('0.5');
    await expect(input0Val).toHaveText('0.50');
    await expect(input1Val).toHaveText('0.50');

    // Output value should be a numeric string with three decimals (updated via updateActivations on load)
    const outText = await outputValue.textContent();
    expect(outText).not.toBe('-'); // initial dash should have been replaced
    // Validate it looks like a number with 3 decimals
    expect(/^\d+\.\d{3}$/.test(outText)).toBeTruthy();

    // Ensure no console.error or page errors happened during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('InputChange event updates displayed input labels and output (Idle->Idle transition)', async ({ page }) => {
    // This test validates changing sliders triggers updateActivations and updates DOM accordingly.
    const input0 = page.locator('#input0');
    const input1 = page.locator('#input1');
    const input0Val = page.locator('#input0Val');
    const input1Val = page.locator('#input1Val');
    const outputValue = page.locator('#outputValue');

    // Move input0 to 1.0 and verify label and output update
    await input0.fill('1'); // set value to "1"
    // Trigger input event by dispatching an input; filling triggers it in most browsers
    await input0.dispatchEvent('input');

    // Verify the textual display updates for input0
    await expect(input0Val).toHaveText('1.00');

    // Now set input1 to 0 and verify label changes
    await input1.fill('0');
    await input1.dispatchEvent('input');
    await expect(input1Val).toHaveText('0.00');

    // The output should be updated accordingly (numeric string)
    const outText = await outputValue.textContent();
    expect(outText).not.toBe('-');
    expect(/^\d+\.\d{3}$/.test(outText)).toBeTruthy();

    // Edge case: set both sliders to non-default decimal and check displayed precision
    await input0.fill('0.33');
    await input0.dispatchEvent('input');
    await expect(input0Val).toHaveText('0.33');

    // Ensure no console.error or page errors during slider interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1_Training: Clicking Train Network starts training sequence (TrainNetwork event)', async ({ page }) => {
    // Validate clicking the Train button enters training mode:
    // - trainBtn.disabled = true
    // - resetBtn.disabled = true
    // - sliders start changing (trainingStep updates s.value)
    const trainBtn = page.locator('#trainBtn');
    const resetBtn = page.locator('#resetBtn');
    const input0 = page.locator('#input0');
    const input1 = page.locator('#input1');
    const input0Val = page.locator('#input0Val');
    const input1Val = page.locator('#input1Val');

    // Ensure trainBtn is enabled initially
    await expect(trainBtn).toBeEnabled();
    await expect(resetBtn).toBeEnabled();

    // Click train button to start training
    await trainBtn.click();

    // Immediately after click, trainBtn and resetBtn should be disabled
    await expect(trainBtn).toBeDisabled();
    await expect(resetBtn).toBeDisabled();

    // Wait up to a reasonable timeout for the sliders to change from the default 0.5
    // TrainingStep cycles through trainingData and will set sliders to [0,0],[0,1],[1,0],[1,1]
    // We assert that within a short time at least one slider value differs from 0.5
    let changed = false;
    for (let i = 0; i < 20; i++) {
      const v0 = await input0.inputValue();
      const v1 = await input1.inputValue();
      if (v0 !== '0.5' || v1 !== '0.5') {
        changed = true;
        break;
      }
      await page.waitForTimeout(50);
    }
    expect(changed).toBeTruthy();

    // Also the textual displays should reflect the slider values
    const label0 = await input0Val.textContent();
    const label1 = await input1Val.textContent();
    expect(label0).not.toBe('0.50' || null);
    expect(label1).not.toBe('0.50' || null);

    // We do not wait for training completion (it may take many frames). Ensure no runtime errors so far.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Train button is idempotent while training (edge case)', async ({ page }) => {
    // Clicking train button again while training should not throw or change disabled state unexpectedly.
    const trainBtn = page.locator('#trainBtn');
    const resetBtn = page.locator('#resetBtn');

    await expect(trainBtn).toBeEnabled();
    await trainBtn.click();

    // Already disabled
    await expect(trainBtn).toBeDisabled();
    await expect(resetBtn).toBeDisabled();

    // Try clicking second time (should be no-op because disabled)
    // Use evaluate to attempt a click even if the button is disabled in DOM (simulate misguided script)
    await page.evaluate(() => {
      const btn = document.getElementById('trainBtn');
      try {
        btn.click();
      } catch (e) {
        // swallow; we only observe that this does not crash page
      }
    });

    // Assert state remains disabled
    await expect(trainBtn).toBeDisabled();
    await expect(resetBtn).toBeDisabled();

    // No console errors or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S2_Reset: Reset Network returns inputs to default and updates activations (ResetNetwork event)', async ({ page }) => {
    const input0 = page.locator('#input0');
    const input1 = page.locator('#input1');
    const input0Val = page.locator('#input0Val');
    const input1Val = page.locator('#input1Val');
    const resetBtn = page.locator('#resetBtn');
    const outputValue = page.locator('#outputValue');

    // Change sliders to non-default values
    await input0.fill('1');
    await input0.dispatchEvent('input');
    await input1.fill('0');
    await input1.dispatchEvent('input');

    await expect(input0Val).toHaveText('1.00');
    await expect(input1Val).toHaveText('0.00');

    // Click reset and validate they go back to 0.5 and labels "0.50"
    await resetBtn.click();

    await expect(input0).toHaveValue('0.5');
    await expect(input1).toHaveValue('0.5');
    await expect(input0Val).toHaveText('0.50');
    await expect(input1Val).toHaveText('0.50');

    // Output should also reflect reset activations (numeric with 3 decimals)
    const out = await outputValue.textContent();
    expect(/^\d+\.\d{3}$/.test(out)).toBeTruthy();

    // Ensure no console/page errors during reset
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('MouseMove and MouseLeave events show and hide tooltip with activations', async ({ page }) => {
    // The canvas draws neurons at known coordinates; hovering should show tooltipDiv appended to body.
    const canvasSelector = '#networkCanvas';
    // Coordinates based on HTML script: layerX.input = 100, layerYPositions.input[0] = 120
    // We'll compute page coordinates for canvas and target offset to hover Input 0 neuron.
    const coords = await getCanvasCoordinates(page, canvasSelector, 100, 120);
    // Move mouse over the input neuron
    await page.mouse.move(coords.x, coords.y);
    // Allow some time for tooltip to appear
    await page.waitForTimeout(200);

    // The tooltipDiv is created and appended to body with display 'block' when hovering
    const tooltip = page.locator('body').locator('div').filter({ hasText: 'Activation' });
    // Find a tooltip-like element by matching content pattern
    // Check that at least one div contains 'Activation:' text
    const tooltipCount = await page.locator('div', { hasText: 'Activation:' }).count();
    expect(tooltipCount).toBeGreaterThan(0);

    // Validate tooltip text includes "Input 0" or "Hidden" / "Output" depending on precise hover
    // At least ensure the tooltip contains the substring 'Activation:' and a numeric value with 3 decimals.
    const tooltipText = await page.locator('div', { hasText: 'Activation:' }).first().textContent();
    expect(tooltipText).toMatch(/Activation:\s*\d+\.\d{3}/);

    // Now move the mouse outside the canvas to trigger mouseleave
    const canvasBox = await page.locator(canvasSelector).boundingBox();
    // Move to top-left outside canvas
    await page.mouse.move(canvasBox.x - 10, canvasBox.y - 10);
    await page.waitForTimeout(100);

    // Tooltip should be hidden (display: none). Check that no visible tooltipDiv with 'Activation' exists
    // We check that any div containing 'Activation' is not visible
    const activationDivs = page.locator('div', { hasText: 'Activation:' });
    const count = await activationDivs.count();
    if (count > 0) {
      // If present, ensure style display is 'none'
      const visibilities = [];
      for (let i = 0; i < count; i++) {
        const el = activationDivs.nth(i);
        const disp = await el.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return { display: style.display, visible: (style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null) };
        });
        visibilities.push(disp);
      }
      // None should be visible
      const anyVisible = visibilities.some(v => v.visible);
      expect(anyVisible).toBeFalsy();
    } else {
      // If no activation divs present, that's acceptable (tooltip removed from DOM)
      expect(count).toBe(0);
    }

    // Ensure no console/page errors throughout hover interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: No uncaught exceptions or ReferenceError/SyntaxError/TypeError during typical usage', async ({ page }) => {
    // Perform a series of typical interactions and assert no page errors or console errors collected.
    const input0 = page.locator('#input0');
    const input1 = page.locator('#input1');
    const trainBtn = page.locator('#trainBtn');
    const resetBtn = page.locator('#resetBtn');

    // Change inputs
    await input0.fill('0.75');
    await input0.dispatchEvent('input');
    await input1.fill('0.25');
    await input1.dispatchEvent('input');

    // Click reset to ensure network reinitializes
    await resetBtn.click();

    // Click train briefly to kick off training (we won't wait for completion)
    await trainBtn.click();

    // Allow some time for scripts to run
    await page.waitForTimeout(300);

    // No page errors or console errors should have been emitted during these actions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});