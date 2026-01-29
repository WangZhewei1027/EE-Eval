import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad39a0-fa78-11f0-812d-c9788050701f.html';

// Page object to encapsulate common operations and queries
class TypeSystemPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Returns number of .type-visual elements
  async countVisualizations() {
    return this.page.$$eval('.type-visual', nodes => nodes.length);
  }

  // Returns an array of booleans whether each .type-visual has the 'active' class
  async visualsActiveStates() {
    return this.page.$$eval('.type-visual', nodes => nodes.map(n => n.classList.contains('active')));
  }

  // Returns true if every .type-visual has the 'active' class
  async areAllVisualsActive() {
    const states = await this.visualsActiveStates();
    return states.length > 0 && states.every(Boolean);
  }

  // Returns true if no .type-visual has the 'active' class
  async areAllVisualsInactive() {
    const states = await this.visualsActiveStates();
    return states.length > 0 && states.every(s => !s);
  }

  // Click the toggle button
  async clickToggle() {
    await this.page.click('#animate-btn');
  }

  // Get the innerHTML of the animate button (used to verify which SVG/text is present)
  async getToggleInnerHTML() {
    return this.page.$eval('#animate-btn', btn => btn.innerHTML);
  }

  // Returns whether there exists at least one .type-node with an inline animation style
  async anyTypeNodeHasInlineAnimation() {
    return this.page.$$eval('.type-node', nodes => nodes.some(n => {
      // inline style property 'animation' should be present and non-empty
      return typeof n.style.animation === 'string' && n.style.animation.trim().length > 0;
    }));
  }

  // Return array of inline animation values for inspection
  async getTypeNodeInlineAnimations() {
    return this.page.$$eval('.type-node', nodes => nodes.map(n => n.style.animation || ''));
  }
}

test.describe('Type System Visual Exploration - FSM and UI tests', () => {
  // Collect console messages and page errors during test execution so we can assert on them.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Observe uncaught page errors (these surface as 'pageerror')
    page.on('pageerror', error => {
      // capture error name and message for assertions
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught runtime errors
    // This verifies the page executed without ReferenceError/SyntaxError/TypeError bubbling up.
    // If any such errors occurred naturally they would have been captured in pageErrors and cause the assertion to fail.
    expect(pageErrors.length, `Expected no uncaught page errors, but found: ${JSON.stringify(pageErrors, null, 2)}\nConsole messages: ${JSON.stringify(consoleMessages, null, 2)}`).toBe(0);
  });

  test('Initial State (S0_Initial): visualizations are active and floating effect is applied', async ({ page }) => {
    // Arrange: navigate and set up the page object
    const ts = new TypeSystemPage(page);
    await ts.goto();

    // Validate: there are exactly 3 visualizations (one per card)
    const vizCount = await ts.countVisualizations();
    expect(vizCount).toBe(3);

    // Validate: initial entry action sets animations -> all .type-visual elements should have 'active' class
    const allActive = await ts.areAllVisualsActive();
    expect(allActive).toBe(true);

    // Validate: the toggle button exists and contains the label "Toggle Animations"
    const btnInner = await ts.getToggleInnerHTML();
    expect(btnInner).toContain('Toggle Animations');

    // Validate: createFloatingEffect() ran on DOMContentLoaded -> at least some .type-node elements must have inline animation style set
    const anyNodeAnimated = await ts.anyTypeNodeHasInlineAnimation();
    expect(anyNodeAnimated).toBe(true);

    // Validate: each type-node has a non-empty inline animation string (spot-check)
    const nodeAnimations = await ts.getTypeNodeInlineAnimations();
    const nonEmptyAnimations = nodeAnimations.filter(a => a && a.trim().length > 0);
    expect(nonEmptyAnimations.length).toBeGreaterThanOrEqual(1);
  });

  test('Transition S0_Initial -> S2_AnimationsInactive on first ToggleAnimations click', async ({ page }) => {
    // This test validates the toggle behavior: first click should remove "active" from visuals -> animations inactive
    const ts = new TypeSystemPage(page);
    await ts.goto();

    // Precondition: visuals are active
    expect(await ts.areAllVisualsActive()).toBe(true);

    // Act: click the toggle button (first transition)
    await ts.clickToggle();

    // Assert: all visualizations should now be inactive (active class removed)
    const allInactive = await ts.areAllVisualsInactive();
    expect(allInactive).toBe(true);

    // Button innerHTML should have switched to the "inactive" SVG variant (implementation sets a different path when inactive)
    const btnInner = await ts.getToggleInnerHTML();
    expect(btnInner).toContain('M12,20A8,8'); // substring unique to the inactive SVG path

    // Also ensure no unexpected runtime errors occurred during the click (captured in afterEach)
  });

  test('Transition S2_AnimationsInactive -> S1_AnimationsActive on second ToggleAnimations click', async ({ page }) => {
    // This test validates toggling back to active state on the second click
    const ts = new TypeSystemPage(page);
    await ts.goto();

    // Click once to deactivate
    await ts.clickToggle();
    expect(await ts.areAllVisualsInactive()).toBe(true);

    // Act: click again to reactivate
    await ts.clickToggle();

    // Assert: all visualizations should now be active again
    expect(await ts.areAllVisualsActive()).toBe(true);

    // Button innerHTML should have switched back to the "active" SVG variant (implementation sets first SVG when active)
    const btnInner = await ts.getToggleInnerHTML();
    expect(btnInner).toContain('M12,16A2,2'); // substring unique to the active SVG path
  });

  test('Rapid toggling behaves like repeated toggles (parity test and DOM consistency)', async ({ page }) => {
    // Edge case: simulate multiple quick toggles and ensure class toggling works deterministically (parity)
    const ts = new TypeSystemPage(page);
    await ts.goto();

    // Precondition: active on load
    expect(await ts.areAllVisualsActive()).toBe(true);

    // Perform 5 rapid clicks
    for (let i = 0; i < 5; i++) {
      // Use click with short delays removed to emulate rapid user clicks
      await ts.clickToggle();
    }

    // After 5 toggles (odd), the state should be opposite of the start -> inactive
    expect(await ts.areAllVisualsInactive()).toBe(true);

    // Now click one more time to make it even (6 total) -> back to active
    await ts.clickToggle();
    expect(await ts.areAllVisualsActive()).toBe(true);
  });

  test('Console observation: no error-level console messages during normal usage', async ({ page }) => {
    // This test explicitly checks console message stream for any error-level logs produced by the page.
    const ts = new TypeSystemPage(page);

    await ts.goto();

    // Interact a bit: toggle twice
    await ts.clickToggle();
    await ts.clickToggle();

    // Give the page a brief moment to emit any asynchronous console messages (e.g., errors)
    await page.waitForTimeout(200);

    // Examine collected console messages
    // We expect no messages of type 'error' — if any are present they will cause the assertion to fail.
    // (Note: page errors (uncaught exceptions) are asserted in afterEach via pageErrors.)
    const errorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorMessages.length, `Found console.error messages: ${JSON.stringify(errorMessages, null, 2)}`).toBe(0);
  });
});