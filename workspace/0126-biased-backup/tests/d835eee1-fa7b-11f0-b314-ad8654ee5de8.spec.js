import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d835eee1-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page object for the Prim's Algorithm demo page.
 * Encapsulates common interactions and queries used across tests.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showDemo = page.locator('#showDemo');
    this.demoDiv = page.locator('#demo');
    this.demoText = page.locator('#demoText');
    this.container = page.locator('main.container');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure main content loaded
    await expect(this.container).toBeVisible();
    // Wait for controls to be available
    await expect(this.showDemo).toBeVisible();
  }

  async isDemoHidden() {
    const classAttr = await this.demoDiv.getAttribute('class');
    return classAttr && classAttr.split(/\s+/).includes('hidden');
  }

  async clickShowDemo() {
    await this.showDemo.click();
  }

  async getDemoTextContent() {
    return (await this.demoText.textContent()) || '';
  }

  async getDemoStyleAttribute() {
    return (await this.demoDiv.getAttribute('style')) || '';
  }

  async getButtonText() {
    return (await this.showDemo.textContent()) || '';
  }

  async isButtonDisabled() {
    return await this.showDemo.isDisabled();
  }
}

test.describe("Prim's Algorithm demo - FSM behavior and UI validation", () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console events
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Sanity: attach debug info if a test fails later (Playwright shows console events automatically).
    // No teardown required beyond Playwright's fixtures.
  });

  test('S0_Idle: Initial Idle state - button present, demo hidden, no runtime errors', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) described in the FSM:
    // - Entry action is to render the page; we validate the DOM elements exist.
    // - The "Show demonstration" button should be present and enabled.
    // - The demo div should be hidden initially (class "hidden" applied).
    // - No uncaught page errors or console.error messages should have occurred during load.

    const demo = new DemoPage(page);
    await demo.goto();

    // Verify the show demo button is visible and has the expected initial text
    await expect(demo.showDemo).toBeVisible();
    await expect(demo.showDemo).toHaveText('Show demonstration');
    expect(await demo.isButtonDisabled()).toBe(false);

    // Verify demo div is hidden via class
    const hidden = await demo.isDemoHidden();
    expect(hidden).toBe(true);

    // The demoText should be empty initially
    const demoTextContent = await demo.getDemoTextContent();
    expect(demoTextContent.trim()).toBe('');

    // Verify that the demo div has the expected style attribute present in the HTML (evidence in FSM)
    const styleAttr = await demo.getDemoStyleAttribute();
    expect(styleAttr).toContain('margin-top:12px');

    // No uncaught exceptions or console.error messages should have occurred on initial render.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ShowDemo event: clicking button transitions to Demo Visible (S1_DemoVisible)', async ({ page }) => {
    // This test exercises the ShowDemo event/transition:
    // - Clicking the button removes the "hidden" class from #demo
    // - #demoText is populated with the precomputed demonstration content
    // - The button becomes disabled and its text changes to "Demonstration shown"
    // - Validate expected DOM changes and that no runtime errors occurred during the transition.

    const demo = new DemoPage(page);
    await demo.goto();

    // Before click: ensure hidden
    expect(await demo.isDemoHidden()).toBe(true);

    // Click the button to reveal the demo
    await demo.clickShowDemo();

    // After click: demo should no longer have 'hidden' class and should be visible
    await expect(demo.demoDiv).toBeVisible(); // waits for element to be visible
    expect(await demo.isDemoHidden()).toBe(false);

    // The demoText should be populated with the precomputed content.
    const text = await demo.getDemoTextContent();
    expect(text.length).toBeGreaterThan(50); // sanity: text should not be empty
    // Check for some expected fragments from the provided demo content (evidence of successful population)
    expect(text).toContain('Graph (undirected, weighted). Vertices: A, B, C, D, E');
    expect(text).toContain('We will run Prim starting at vertex A.');
    expect(text).toContain('Total MST weight = 13'); // exact phrase from the provided content

    // The button should now be disabled and its text changed (transition actions)
    expect(await demo.isButtonDisabled()).toBe(true);
    await expect(demo.showDemo).toHaveText('Demonstration shown');

    // The demo div style attribute should still include margin-top:12px (expected observable)
    const styleAttr = await demo.getDemoStyleAttribute();
    expect(styleAttr).toContain('margin-top:12px');

    // Ensure the page script included the event listener snippet (evidence)
    const pageSource = await page.content();
    expect(pageSource).toContain("demoBtn.addEventListener('click'");

    // No uncaught exceptions or console.error messages during click/transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition is one-time and idempotent: subsequent clicks do not re-show or modify content', async ({ page }) => {
    // This test ensures the click handler was registered with {once:true} and that
    // after the demo is revealed the button remains disabled and nothing changes on further click attempts.
    const demo = new DemoPage(page);
    await demo.goto();

    // Reveal first time
    await demo.clickShowDemo();
    await expect(demo.demoDiv).toBeVisible();
    const initialText = await demo.getDemoTextContent();
    expect(initialText).toContain('Graph (undirected, weighted). Vertices: A, B, C, D, E');
    expect(await demo.isButtonDisabled()).toBe(true);

    // Try to click again - button is disabled so this should not change the state.
    // Playwright's click on a disabled button is allowed programmatically, but the app's listener was registered with {once:true}
    // and the button is disabled; therefore no further mutation should happen.
    // We attempt the click and then check that content and attributes remain the same.
    try {
      await demo.clickShowDemo();
    } catch (err) {
      // If Playwright refuses to click a disabled element, that's fine; treat as no-op.
    }

    // Re-validate the state is unchanged
    expect(await demo.isButtonDisabled()).toBe(true);
    await expect(demo.showDemo).toHaveText('Demonstration shown');

    const afterText = await demo.getDemoTextContent();
    expect(afterText).toBe(initialText); // content should be identical

    // Confirm no runtime errors occurred during the repeated interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases & robustness: page-level invariants and expected static content remain intact', async ({ page }) => {
    // This test checks a few additional invariants:
    // - The main container and title are present (renderPage equivalent)
    // - The demo area exists and contains the demo button and tag
    // - The textual explanations in the main article exist (sample check for a unique phrase)
    // - No unexpected runtime errors.

    const demo = new DemoPage(page);
    await demo.goto();

    // Main title present and correct
    const title = await page.locator('#title').textContent();
    expect(title).toContain("Prim's Algorithm");

    // Demo area contains the tag and the button
    await expect(page.locator('.demo-area .tag')).toBeVisible();
    await expect(demo.showDemo).toBeVisible();

    // A unique fragment from the long textual content should be present
    const someParagraph = await page.locator('text=Priority queue implementation matters for performance.').first();
    await expect(someParagraph).toBeVisible();

    // There should be no page errors from loading static content
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console and page errors if any (test will fail if unexpected runtime errors occur)', async ({ page }) => {
    // This test intentionally inspects the collected console and page errors.
    // It asserts that there are no runtime exceptions; if the page did produce errors
    // (ReferenceError, TypeError, SyntaxError, etc.), they will be observed and the test will fail,
    // fulfilling the requirement to let errors happen naturally and to assert about them.

    const demo = new DemoPage(page);
    await demo.goto();

    // Trigger primary interaction to exercise client-side code paths
    await demo.clickShowDemo();

    // Inspect collected diagnostics
    // If any pageErrors or consoleErrors were captured, fail with diagnostics to aid debugging.
    if (pageErrors.length > 0) {
      // Provide details in test failure
      throw new Error('Uncaught page errors detected: ' + JSON.stringify(pageErrors, null, 2));
    }
    if (consoleErrors.length > 0) {
      throw new Error('Console.error messages detected: ' + JSON.stringify(consoleErrors, null, 2));
    }

    // As additional verification, ensure there are console messages captured (may be zero),
    // but the important invariant is no errors.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});