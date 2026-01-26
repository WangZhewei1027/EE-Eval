import { test, expect } from '@playwright/test';

// Test file for Application ID: 63b25fb0-fa74-11f0-bb9a-db7e6ecdeeaa
// URL under test:
// http://127.0.0.1:5500/workspace/0126-balanced/html/63b25fb0-fa74-11f0-bb9a-db7e6ecdeeaa.html
//
// This suite verifies the FSM S0_Idle state and the InputChange transition.
// It also observes console and page errors (if any) and asserts their presence/absence.
//
// Notes:
// - We intentionally load the page "as-is" and do not modify page globals or source.
// - We capture console messages and page errors and assert expectations against them.
// - We use ES module import syntax per project requirements.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b25fb0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for interacting with the demonstration page
class OmegaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputN');
    this.nValue = page.locator('#nValue');
    this.canvas = page.locator('#graph');
    this.explanation = page.locator('#explanation');
  }

  // Navigate to the app and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for main elements to appear
    await Promise.all([
      this.input.waitFor({ state: 'visible' }),
      this.canvas.waitFor({ state: 'visible' }),
      this.nValue.waitFor({ state: 'visible' }),
    ]);
  }

  // Read the input element's value (string)
  async getInputValue() {
    return await this.input.evaluate((el) => el.value);
  }

  // Read the displayed nValue span text
  async getDisplayedNValue() {
    return (await this.nValue.textContent())?.trim() ?? '';
  }

  // Programmatically set the input value and dispatch 'input' event to trigger UI update
  async setInputValue(value) {
    // Use evaluate to ensure the page's native event listeners execute as in real usage
    await this.input.evaluate((el, v) => {
      el.value = String(v);
      const event = new Event('input', { bubbles: true });
      el.dispatchEvent(event);
    }, value);
    // Give the page a moment to process the drawing and updates
    await this.page.waitForTimeout(150);
  }

  // Get the explanation text content
  async getExplanationText() {
    return (await this.explanation.textContent())?.trim() ?? '';
  }

  // Get canvas data URL (PNG) so we can compare renderings before/after changes
  async getCanvasDataURL() {
    return await this.canvas.evaluate((c) => c.toDataURL());
  }
}

test.describe('Big-Omega (Ω) Notation Demo - FSM & UI tests', () => {
  // We'll capture console and page errors per test so we can assert on them
  test('Initial state (S0_Idle) should draw and initialize UI correctly', async ({ page }) => {
    // Arrays to capture console error messages and page errors
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages of severity 'error'
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions on the page
      pageErrors.push(err);
    });

    const app = new OmegaPage(page);
    // Load the page as-is
    await app.goto();

    // Validate DOM initial values per FSM "entry_actions: draw()"
    // - nValue should reflect the input default value "10"
    const displayedN = await app.getDisplayedNValue();
    expect(displayedN).toBe('10'); // span shows initial value

    // The input element value should be "10"
    const inputVal = await app.getInputValue();
    expect(inputVal).toBe('10');

    // Explanation should have been populated by the initial draw() call
    const explanation = await app.getExplanationText();
    // Expected to mention the chosen c and the threshold n₀; we assert it contains expected fragments
    expect(explanation).toContain('c = 1.5');
    expect(explanation).toContain('n₀ = 1');
    // Because initial n is 10 which is >= n0, the message should indicate the inequality holds
    expect(/holds at n = 10|holds at n=10/i.test(explanation)).toBeTruthy();

    // Canvas should contain a drawing; ensure we can get a data URL
    const initialCanvasData = await app.getCanvasDataURL();
    expect(initialCanvasData).toMatch(/^data:image\/png;base64,/);

    // Assert that there were no console errors or page uncaught exceptions during load/draw
    // We assert zero severe errors so test fails if there are runtime errors
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('InputChange event updates displayed value, explanation, and canvas rendering', async ({ page }) => {
    // Capture console and page errors for this test
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new OmegaPage(page);
    await app.goto();

    // Capture initial canvas rendering for comparison
    const beforeDataURL = await app.getCanvasDataURL();

    // Move slider to several values and assert UI updates each time
    const testValues = [1, 2, 50, 100]; // include edge values and middle
    const seenCanvasData = new Set([beforeDataURL]);

    for (const val of testValues) {
      // Set input value (fires input event)
      await app.setInputValue(val);

      // The displayed span should update to reflect the input value
      const displayed = await app.getDisplayedNValue();
      expect(displayed).toBe(String(val));

      // Explanation must mention the current n and describe inequality status
      const explanation = await app.getExplanationText();
      expect(explanation).toContain(`n = ${val}`); // should mention the current n in context

      // The canvas rendering should exist and ideally change when n changes (vertical indicator & points)
      const canvasData = await app.getCanvasDataURL();
      expect(canvasData).toMatch(/^data:image\/png;base64,/);
      seenCanvasData.add(canvasData);
    }

    // We expect at least one canvas rendering to differ from the initial (vertical line and points move)
    expect(seenCanvasData.size).toBeGreaterThan(1);

    // Assert UI invariants: computeN0 is stable and explanation references n₀ = 1
    const explanationFinal = await app.getExplanationText();
    expect(explanationFinal).toContain('n₀ = 1');

    // Assert no console or page errors happened during interactive changes
    expect(consoleErrors.length, `Console errors during interaction: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors during interaction: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('Edge cases: setting input outside declared min/max and rapid changes', async ({ page }) => {
    // This test deliberately tries values outside the defined range to observe behavior
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new OmegaPage(page);
    await app.goto();

    // Attempt to set to 0 (below min) and 150 (above max). The page logic reads +inputN.value which may accept the value.
    const outOfRangeValues = [0, 150];
    const canvasDataBefore = await app.getCanvasDataURL();

    const resultingCanvasData = [];
    for (const v of outOfRangeValues) {
      // We use evaluate on the input to set the value even if out of bounds; do not alter page functions
      await app.setInputValue(v);
      const displayed = await app.getDisplayedNValue();
      // The UI will reflect whatever the input.value was set to (string), even if out of range
      expect(displayed).toBe(String(v));

      // Explanation text should include the current n value in message
      const explanation = await app.getExplanationText();
      expect(explanation).toContain(`n = ${v}`);

      resultingCanvasData.push(await app.getCanvasDataURL());
    }

    // Ensure at least the canvas still returns a valid image after out-of-range settings
    for (const data of resultingCanvasData) {
      expect(data).toMatch(/^data:image\/png;base64,/);
    }

    // Rapid slider movement should not cause uncaught errors. Simulate fast changes.
    for (let v = 1; v <= 20; v += 2) {
      await app.setInputValue(v);
    }

    // No console or page errors are expected during these edge interactions
    expect(consoleErrors.length, `Console errors during edge interactions: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors during edge interactions: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);

    // As a sanity check, the canvas data after edge interactions should still be a PNG and (likely) different from initial
    const canvasAfter = await app.getCanvasDataURL();
    expect(canvasAfter).toMatch(/^data:image\/png;base64,/);
    // It may or may not differ depending on last rapid change; but ensure it is a valid rendering.
    expect(canvasAfter.length).toBeGreaterThan(canvasDataBefore.length / 2);
  });

  test('Observability: capture any console or runtime errors during load and interaction', async ({ page }) => {
    // This test focuses on observing console logs and page errors and asserting their absence.
    // This aligns with the requirement to observe console logs and let any runtime errors happen naturally.
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new OmegaPage(page);
    await app.goto();

    // Trigger a few interactions
    await app.setInputValue(25);
    await app.setInputValue(75);

    // Wait a short moment for any asynchronous errors to surface
    await page.waitForTimeout(200);

    // We assert there are no uncaught page errors
    expect(pageErrors.length, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);

    // If there are console errors, attach them into the failure message; otherwise assert none exist
    expect(consoleErrors.length, `Unexpected console errors: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);

    // Additionally, ensure the console had some informational messages or at least was exercised
    // (Not required; this is merely observational. We do not fail if there are zero non-error logs.)
    // Validate final UI state sanity
    const finalN = await app.getDisplayedNValue();
    expect(finalN).toBe('75');
    const explanation = await app.getExplanationText();
    expect(explanation).toContain('n = 75');
  });
});