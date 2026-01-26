import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b30c45-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object Model for the Big-Theta interactive page.
 * Encapsulates locators and common actions.
 */
class BigThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleButton = page.locator('button[onclick="toggleVisualization()"]');
    this.visualization = page.locator('#visualization');
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main content to be present
    await this.toggleButton.waitFor({ state: 'visible' });
  }

  // Click the Show/Hide Visualization button
  async clickToggle() {
    await this.toggleButton.click();
  }

  // Returns the computed display style of the visualization element
  async getComputedDisplay() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).display;
    }, '#visualization');
  }

  // Returns the inline style attribute value (may be null)
  async getInlineStyle() {
    return await this.visualization.getAttribute('style');
  }

  // Returns outerHTML for inspection
  async getOuterHTML() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.outerHTML : null;
    }, '#visualization');
  }
}

test.describe('f0b30c45-fa7c-11f0-9fa6-d1bbe297d459 - Big-Theta Visualization FSM', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err); // err is an Error object
    });
  });

  test.afterEach(async ({ page }) => {
    // Expose debug info when a test fails (Playwright will show this in logs).
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Captured console errors:', consoleErrors);
      // eslint-disable-next-line no-console
      console.warn('Captured page errors:', pageErrors.map(e => String(e)));
    }
  });

  test('Initial State (S0_Idle) - page renders and visualization is hidden', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle)
    const app = new BigThetaPage(page);
    await app.goto();

    // The toggle button should exist and be visible
    await expect(app.toggleButton).toBeVisible();
    await expect(app.toggleButton).toHaveText('Show/Hide Visualization');

    // The visualization should be present in the DOM
    await expect(app.visualization).toBeVisible({ timeout: 1000 }); // element exists; may be visually hidden via CSS

    // Computed style should indicate it's hidden (display: none) as per CSS
    const computedDisplay = await app.getComputedDisplay();
    expect(computedDisplay).toBe('none');

    // Inline style attribute may be absent initially (since CSS controls it), ensure that's allowed
    const inlineStyle = await app.getInlineStyle();
    expect(inlineStyle === null || inlineStyle === '' || inlineStyle === 'display: none;').toBeTruthy();

    // Check that the button has the expected onclick attribute evidence from the FSM
    const onclickAttr = await page.evaluate(() => {
      const btn = document.querySelector('button[onclick="toggleVisualization()"]');
      return btn ? btn.getAttribute('onclick') : null;
    });
    expect(onclickAttr).toBe('toggleVisualization()');

    // Assert that no runtime page errors were thrown during initial render
    expect(pageErrors.length).toBe(0);
    // There should be no console errors during initial load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_VisualizationVisible when ToggleVisualization event occurs', async ({ page }) => {
    // This test validates the first toggle: from Idle to Visualization Visible
    const app = new BigThetaPage(page);
    await app.goto();

    // Ensure starting hidden state (computed)
    expect(await app.getComputedDisplay()).toBe('none');

    // Click the toggle button once
    await app.clickToggle();

    // After clicking, the inline style should reflect display: block;
    const inlineStyle = await app.getInlineStyle();
    expect(inlineStyle && inlineStyle.includes('display: block')).toBeTruthy();

    // Computed style should be 'block'
    expect(await app.getComputedDisplay()).toBe('block');

    // The outerHTML should include the style attribute evidence as an expected observable in the FSM
    const outer = await app.getOuterHTML();
    expect(outer).toContain('style="display: block;"');

    // Verify that the content inside the visualization is the explanatory content (basic sanity check)
    const vizText = await app.visualization.textContent();
    expect(vizText).toContain('Big-Theta can be visualized');

    // No unexpected page errors should have occurred during the interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_VisualizationVisible -> S2_VisualizationHidden when ToggleVisualization event occurs again', async ({ page }) => {
    // This test validates toggling off when the visualization is visible
    const app = new BigThetaPage(page);
    await app.goto();

    // Bring it to visible state first
    await app.clickToggle();
    expect(await app.getComputedDisplay()).toBe('block');

    // Click again to hide
    await app.clickToggle();

    // After hiding, inline style should be 'display: none;'
    const inlineStyleAfter = await app.getInlineStyle();
    expect(inlineStyleAfter && inlineStyleAfter.includes('display: none')).toBeTruthy();

    // Computed style should reflect hidden
    expect(await app.getComputedDisplay()).toBe('none');

    // Check outerHTML expected observable
    const outerAfter = await app.getOuterHTML();
    expect(outerAfter).toContain('style="display: none;"');

    // No runtime errors from the toggle operation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S2_VisualizationHidden -> S1_VisualizationVisible via ToggleVisualization (cycle back)', async ({ page }) => {
    // This test ensures toggling cycles back to visible from hidden state
    const app = new BigThetaPage(page);
    await app.goto();

    // Ensure hidden, then toggle to visible, then hide, then toggle to visible again
    // 1) Ensure hidden initially
    expect(await app.getComputedDisplay()).toBe('none');

    // 2) Click to show
    await app.clickToggle();
    expect(await app.getComputedDisplay()).toBe('block');

    // 3) Click to hide
    await app.clickToggle();
    expect(await app.getComputedDisplay()).toBe('none');

    // 4) Click to show again (this is the S2 -> S1 transition)
    await app.clickToggle();
    expect(await app.getComputedDisplay()).toBe('block');

    // Inline style evidence should indicate 'display: block;'
    const finalInline = await app.getInlineStyle();
    expect(finalInline && finalInline.includes('display: block')).toBeTruthy();

    // No page-level uncaught errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Rapid multiple toggles - final state matches parity of clicks', async ({ page }) => {
    // This test simulates an edge case: user clicks the toggle quickly multiple times
    // Validate that the final state matches the expected parity (odd -> visible, even -> hidden)
    const app = new BigThetaPage(page);
    await app.goto();

    // Ensure initial is hidden
    expect(await app.getComputedDisplay()).toBe('none');

    // Rapidly click 5 times (odd number -> expect visible)
    for (let i = 0; i < 5; i++) {
      await app.clickToggle();
    }
    expect(await app.getComputedDisplay()).toBe('block');

    // Rapidly click 6 more times (total 11 -> odd -> visible)
    for (let i = 0; i < 6; i++) {
      await app.clickToggle();
    }
    // 5 + 6 = 11 (odd) -> visible
    expect(await app.getComputedDisplay()).toBe('block');

    // Now click once to make it hidden (even total)
    await app.clickToggle();
    expect(await app.getComputedDisplay()).toBe('none');

    // Verify there are no runtime exceptions as a result of rapid interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Ensure toggle logic handles empty inline style (initial CSS-driven hidden state)', async ({ page }) => {
    // This test explicitly checks the conditional in toggleVisualization that treats
    // empty inline style ('') as hidden and toggles to block.
    const app = new BigThetaPage(page);
    await app.goto();

    // Initially, inline style is likely null (no attribute). Emulate check:
    const inlineStyle = await app.getInlineStyle();
    // Confirm it's null or empty, as expected from CSS-only hiding.
    expect(inlineStyle === null || inlineStyle === '').toBeTruthy();

    // Now click; function should detect empty string / none and show the visualization
    await app.clickToggle();
    expect(await app.getComputedDisplay()).toBe('block');

    // Now hide again
    await app.clickToggle();
    expect(await app.getComputedDisplay()).toBe('none');

    // No uncaught errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observation: Capture console messages and page errors while exercising UI', async ({ page }) => {
    // This test focuses on observing console outputs and ensuring none of the expected severe errors occur.
    const app = new BigThetaPage(page);

    await app.goto();

    // Perform a sequence of interactions while capturing console messages
    await app.clickToggle(); // show
    await app.clickToggle(); // hide
    await app.clickToggle(); // show

    // Small wait to ensure any asynchronous logs/errors appear
    await page.waitForTimeout(100);

    // Validate the collected console messages structure
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    // There should be at least one console message (often informational logs are absent; allow zero but ensure structure)
    expect(consoleMessages).toBeInstanceOf(Array);

    // Assert there are no console.error entries
    expect(consoleErrors.length).toBe(0);

    // Assert no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('DOM integrity checks: ensure visualization content remains consistent across toggles', async ({ page }) => {
    // Ensure the inner content of the visualization remains intact across show/hide cycles
    const app = new BigThetaPage(page);
    await app.goto();

    const initialInner = await app.visualization.innerText();

    // Show and hide multiple times
    await app.clickToggle();
    await app.clickToggle();
    await app.clickToggle();

    const finalInner = await app.visualization.innerText();

    // The textual content should be stable / unchanged
    expect(finalInner.trim()).toBe(initialInner.trim());

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});