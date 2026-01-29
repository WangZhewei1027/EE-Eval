import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9b8511-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the Runtime Environment Visualizer page
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btnSelector = '#btnToggleAnim';
    this.lineSelector = '.glow-line';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // wait a moment for initial script self-invocation to run
    await this.page.waitForTimeout(50);
  }

  async getButtonText() {
    return (await this.page.locator(this.btnSelector).textContent())?.trim() ?? '';
  }

  async getButtonAriaPressed() {
    return await this.page.getAttribute(this.btnSelector, 'aria-pressed');
  }

  async clickToggle() {
    await this.page.click(this.btnSelector);
    // allow event handlers and style changes to settle
    await this.page.waitForTimeout(20);
  }

  async getLineCount() {
    return await this.page.locator(this.lineSelector).count();
  }

  // Return an array of computed animationPlayState values for each line (e.g., ['running', 'paused'])
  async getLineAnimationStates() {
    return await this.page.$$eval(this.lineSelector, (els) =>
      els.map((el) => {
        // Prefer computed style to capture effective animationPlayState
        const cs = window.getComputedStyle(el);
        return cs.animationPlayState || el.style.animationPlayState || '';
      })
    );
  }

  // Helper to quickly assert that all lines report the expected animation state
  async expectAllLinesState(expected) {
    const states = await this.getLineAnimationStates();
    for (const s of states) {
      if (s !== expected) {
        // include the array in error message for diagnostics
        throw new Error(`Expected all lines to be "${expected}", but found: ${JSON.stringify(states)}`);
      }
    }
  }
}

test.describe('Runtime Environment — Visualized (FSM behavior)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture all console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push({ type, text });
      }
    });

    // Capture uncaught page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  // Test initial entry state: S0_Animating
  test('Initial state is Animating (S0_Animating) — entry actions applied', async ({ page }) => {
    const vp = new VisualizerPage(page);

    // Load the page
    await vp.goto();

    // Ensure no runtime page errors occurred during load
    expect(pageErrors).toEqual([]);

    // Button exists and shows expected initial label and aria state
    const btnText = await vp.getButtonText();
    // The implementation sets textContent to "Pause Animation" at start (trim whitespace)
    expect(btnText).toBe('Pause Animation');

    const ariaPressed = await vp.getButtonAriaPressed();
    // The HTML sets aria-pressed="true" initially and script does not change it until click
    expect(ariaPressed).toBe('true');

    // There should be two visual connector lines present
    const lineCount = await vp.getLineCount();
    expect(lineCount).toBeGreaterThanOrEqual(1); // at least one line
    // In provided HTML there are two .glow-line paths; ensure that expectation
    expect(lineCount).toBe(2);

    // Entry action: lines.forEach(... animationPlayState = 'running')
    // Validate computed style reflects animation running for each line
    await vp.expectAllLinesState('running');

    // Ensure no console.error messages were emitted during initialization
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition S0_Animating -> S1_Paused via ToggleAnimation event (click)
  test('Clicking toggle button pauses animation (Transition: S0_Animating -> S1_Paused)', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Precondition: currently running
    await vp.expectAllLinesState('running');

    // Click the button to toggle animation (should pause)
    await vp.clickToggle();

    // After click: button label should change to "Play Animation"
    const btnTextAfter = await vp.getButtonText();
    expect(btnTextAfter).toBe('Play Animation');

    // aria-pressed should reflect false now
    const ariaPressedAfter = await vp.getButtonAriaPressed();
    expect(ariaPressedAfter).toBe('false');

    // Lines should be paused
    await vp.expectAllLinesState('paused');

    // Check that transitions do not produce uncaught errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition S1_Paused -> S0_Animating via ToggleAnimation event (click)
  test('Clicking toggle button twice resumes animation (Transition: S1_Paused -> S0_Animating)', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Click twice: first to pause, second to resume
    await vp.clickToggle(); // pause
    // Validate paused as intermediate
    await vp.expectAllLinesState('paused');

    await vp.clickToggle(); // resume
    // After second click label should be "Pause Animation" again
    const btnTextFinal = await vp.getButtonText();
    expect(btnTextFinal).toBe('Pause Animation');

    const ariaPressedFinal = await vp.getButtonAriaPressed();
    expect(ariaPressedFinal).toBe('true');

    // Lines should be running again
    await vp.expectAllLinesState('running');

    // Ensure no runtime errors occurred during toggling
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: rapid multiple toggles; check parity-driven final state
  test('Rapid multiple clicks toggle animation state predictably (edge case)', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Number of rapid clicks to perform
    const clicks = 5; // odd -> final should be paused
    for (let i = 0; i < clicks; i++) {
      // Do not insert large waits intentionally to simulate rapid user clicks
      await vp.page.click(vp.btnSelector);
    }

    // Allow any pending handlers to settle
    await page.waitForTimeout(30);

    // Determine expected values after odd number of clicks:
    const expectedText = clicks % 2 === 1 ? 'Play Animation' : 'Pause Animation';
    const expectedAria = clicks % 2 === 1 ? 'false' : 'true';
    const expectedLineState = clicks % 2 === 1 ? 'paused' : 'running';

    const btnText = await vp.getButtonText();
    const ariaPressed = await vp.getButtonAriaPressed();

    expect(btnText).toBe(expectedText);
    expect(ariaPressed).toBe(expectedAria);
    await vp.expectAllLinesState(expectedLineState);

    // Confirm no uncaught page errors when performing many interactions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.length).toBe(0);
  });

  // Accessibility and resilience assertions
  test('Accessibility attributes and DOM resilience checks', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Button should have proper aria-label
    const ariaLabel = await page.getAttribute(vp.btnSelector, 'aria-label');
    expect(ariaLabel).toBe('Toggle line animation');

    // Clicking should update only the expected attributes and content (not remove the button)
    await vp.clickToggle();
    const stillExists = await page.locator(vp.btnSelector).count();
    expect(stillExists).toBe(1);

    // The connectors SVG should remain in the DOM and retain gradient definition
    const svgExists = await page.locator('svg.connectors').count();
    expect(svgExists).toBe(1);

    const gradientExists = await page.locator('svg.connectors defs linearGradient#lineGradient').count();
    expect(gradientExists).toBe(1);

    // No page errors during these checks
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.length).toBe(0);
  });

  // Observability test: capture console output and ensure no unexpected console.error or runtime exceptions
  test('Observability: console and page error telemetry', async ({ page }) => {
    const vp = new VisualizerPage(page);
    await vp.goto();

    // There should be no console.error messages by default
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);

    // There should be no page errors
    expect(pageErrors.length).toBe(0);

    // Document overall console traffic for debug (non-assertive) - ensure at least some console activity array exists
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});