import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab3dd1-fa78-11f0-812d-c9788050701f.html';

// Page Object Model for the Big-Omega Visualizer
class BigOmegaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      graphContainer: '.graph-container',
      functionLines: '.function-line',
      dataPoints: '.data-point',
      pointConnectors: '.point-connector',
      animateBtn: '#animateBtn',
      resetBtn: '#resetBtn',
      functionLabels: '.function-label',
      omegaLabel: '.omega-label',
    };
  }

  async goto() {
    // Navigate and wait until DOMContentLoaded so we can inspect initial state quickly.
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getGraphContainerHasPulse() {
    return this.page.$eval(this.selectors.graphContainer, el => el.classList.contains('pulse'));
  }

  async getGraphContainerTransform() {
    return this.page.$eval(this.selectors.graphContainer, el => el.style.transform || '');
  }

  async getFunctionLinesStyles() {
    return this.page.$$eval(this.selectors.functionLines, els =>
      Array.from(els).map(el => ({ width: el.style.width || '', opacity: el.style.opacity || '' }))
    );
  }

  async getDataPointsOpacities() {
    return this.page.$$eval(this.selectors.dataPoints, els =>
      Array.from(els).map(el => el.style.opacity || '')
    );
  }

  async getPointConnectorsWidths() {
    return this.page.$$eval(this.selectors.pointConnectors, els =>
      Array.from(els).map(el => el.style.width || '')
    );
  }

  async clickAnimate() {
    await this.page.click(this.selectors.animateBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async getFunctionLabelTexts() {
    return this.page.$$eval(this.selectors.functionLabels, els => Array.from(els).map(el => el.textContent.trim()));
  }

  async getOmegaLabelText() {
    return this.page.$eval(this.selectors.omegaLabel, el => el.textContent.trim());
  }
}

test.describe('Big-Omega Notation Visualizer - FSM & UI tests', () => {
  let page;
  let model;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context and page to avoid cross-test state
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and page errors for assertions and debugging
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture all console messages (including errors logged to console)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture unhandled exceptions in the page
      pageErrors.push(err);
    });

    model = new BigOmegaPage(page);

    // Navigate to the app; use domcontentloaded to allow quick inspection of initial state
    await model.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: log the captured console and errors for debugging (they are available via Playwright's output)
    // We do not modify the page or inject any functions.
  });

  test('Initial Idle state (S0_Idle) - DOM rendered and initial visuals are reset', async () => {
    // This validates the Idle state entry: page has rendered and initial styles reflect "reset" visuals.
    // Because the page schedules an automatic animate click after 500ms, we perform these checks immediately.
    // Check that the graph container exists and initially has the 'pulse' class applied (per HTML initial state).
    const hasPulse = await model.getGraphContainerHasPulse();
    expect(hasPulse).toBe(true);

    // The function lines are initially inline-styled with width: 0 and opacity: 0 (per HTML markup and resetAnimations)
    const lines = await model.getFunctionLinesStyles();
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      // Inline styles should indicate they are collapsed before animation
      expect(line.width === '' || line.width === '0' || line.width === '0%').toBeTruthy();
      // opacity either not set (empty) or '0'
      expect(line.opacity === '' || line.opacity === '0').toBeTruthy();
    }

    // Data points should be invisible initially
    const dataOpacities = await model.getDataPointsOpacities();
    for (const op of dataOpacities) {
      expect(op === '' || op === '0').toBeTruthy();
    }

    // Point connectors should have width set inline in HTML to 50% initially; but resetAnimations sets width to '0'.
    // The provided HTML sets width: 50% inline for connectors — since resetAnimations hasn't run yet on first paint,
    // accept both 50% (initial markup) and 0 (if resetAnimations ran). This asserts existence and that some width value exists.
    const connectorWidths = await model.getPointConnectorsWidths();
    expect(connectorWidths.length).toBeGreaterThan(0);

    // Ensure the textual labels exist (sanity check for renderPage-like behavior)
    const functionLabels = await model.getFunctionLabelTexts();
    expect(functionLabels).toContain('f(n) = n log n');
    const omegaLabel = await model.getOmegaLabelText();
    expect(omegaLabel).toBe('Ω(n)');
  });

  test('Animate transition (S0_Idle -> S1_Animating) - Clicking Animate triggers graph animation', async () => {
    // This test validates the AnimateClick event and the Animating state's entry actions.
    // Click animate and verify transform and styling changes on function lines.
    // Ensure we do this before the automatic scheduled click triggers twice; clicking is idempotent for our checks.

    await model.clickAnimate();

    // After clicking animate, the graph container should have had 'pulse' removed and transform applied.
    // Give a small tick for style changes to be applied synchronously.
    await page.waitForTimeout(50);

    const hasPulseAfter = await model.getGraphContainerHasPulse();
    expect(hasPulseAfter).toBe(false);

    const transform = await model.getGraphContainerTransform();
    // animateGraph sets transform to 'translateY(-5px) rotateX(5deg)'
    expect(transform.includes('translateY(-5px)') || transform.includes('rotateX(5deg)')).toBeTruthy();

    // The function lines should have width '80%' and opacity '1' immediately after animate click.
    const linesAfter = await model.getFunctionLinesStyles();
    expect(linesAfter.length).toBeGreaterThan(0);
    for (const line of linesAfter) {
      expect(line.width).toBe('80%');
      expect(line.opacity).toBe('1');
    }

    // Data points and connectors are updated after a 1000ms timeout inside the animate handler.
    // Wait for that update and then check connectors and data points.
    await page.waitForTimeout(1100);

    const dataOpAfter = await model.getDataPointsOpacities();
    for (const op of dataOpAfter) {
      expect(op).toBe('1');
    }

    const connectorWidthsAfter = await model.getPointConnectorsWidths();
    for (const w of connectorWidthsAfter) {
      // connectors set width to '80%' after animation timeout
      expect(w).toBe('80%');
    }
  });

  test('Reset transition (S1_Animating -> S2_Reset) - Clicking Reset stops animation and restores initial visuals', async () => {
    // First animate to reach S1_Animating (some browsers may auto-animate; ensure we are in animated state)
    await model.clickAnimate();
    await page.waitForTimeout(1100); // wait for delayed updates

    // Now click reset
    await model.clickReset();
    await page.waitForTimeout(50);

    // Reset should re-add the 'pulse' class and clear transform
    const hasPulse = await model.getGraphContainerHasPulse();
    expect(hasPulse).toBe(true);

    const transform = await model.getGraphContainerTransform();
    expect(transform).toBe('');

    // resetAnimations sets function lines to width '0' and opacity '0'
    const lines = await model.getFunctionLinesStyles();
    for (const line of lines) {
      expect(line.width === '0' || line.width === '0%' || line.width === '').toBeTruthy();
      expect(line.opacity === '0' || line.opacity === '').toBeTruthy();
    }

    // Data points should be hidden again
    const dataOpacities = await model.getDataPointsOpacities();
    for (const op of dataOpacities) {
      expect(op === '0' || op === '').toBeTruthy();
    }

    // Connectors should be collapsed
    const connectorWidths = await model.getPointConnectorsWidths();
    for (const w of connectorWidths) {
      expect(w === '0' || w === '').toBeTruthy();
    }
  });

  test('Cycle transition (S2_Reset -> S1_Animating) - Animate after Reset starts animation again', async () => {
    // Ensure reset state
    await model.clickReset();
    await page.waitForTimeout(50);

    // Click animate again to trigger animation from Reset state
    await model.clickAnimate();
    await page.waitForTimeout(50);

    // Graph should not have 'pulse' and function lines should begin animation (width '80%')
    const hasPulse = await model.getGraphContainerHasPulse();
    expect(hasPulse).toBe(false);

    const lines = await model.getFunctionLinesStyles();
    for (const line of lines) {
      expect(line.width).toBe('80%');
      expect(line.opacity).toBe('1');
    }

    // Wait for delayed visuals (data points/connectors)
    await page.waitForTimeout(1100);

    const dataOpAfter = await model.getDataPointsOpacities();
    for (const op of dataOpAfter) {
      expect(op).toBe('1');
    }

    const connectorWidthsAfter = await model.getPointConnectorsWidths();
    for (const w of connectorWidthsAfter) {
      expect(w).toBe('80%');
    }
  });

  test('Edge cases: Rapid repeated clicks on Animate and Reset do not throw unhandled exceptions and result in valid styles', async () => {
    // Rapidly click animate multiple times
    await model.clickAnimate();
    await model.clickAnimate();
    await model.clickAnimate();

    // Give short time then reset multiple times
    await page.waitForTimeout(200);
    await model.clickReset();
    await model.clickReset();
    await model.clickReset();

    // After rapid interactions, ensure no unhandled page errors were raised
    // Capture length of pageErrors (we assert none occurred)
    expect(pageErrors.length).toBe(0);

    // Styles should be in a consistent reset state after repeated resets
    const lines = await model.getFunctionLinesStyles();
    for (const line of lines) {
      expect(line.width === '0' || line.width === '' || line.width === '0%').toBeTruthy();
    }

    const hasPulse = await model.getGraphContainerHasPulse();
    expect(hasPulse).toBe(true);
  });

  test('Console and page error observation - ensure no uncaught ReferenceError/SyntaxError/TypeError occurred during runtime', async () => {
    // The test harness collected console messages and pageErrors during page lifecycle.
    // We assert that there are no unhandled page errors (SyntaxError/ReferenceError/TypeError).
    // If any such error occurred it would be present in pageErrors.
    // We allow other benign console output, but explicitly ensure no pageerrors exist.
    expect(pageErrors.length).toBe(0);

    // Additionally, ensure console does not contain fatal JS errors typed as 'error'
    const fatalConsole = consoleMessages.filter(m => m.type === 'error');
    // Assert there are no console error messages
    expect(fatalConsole.length).toBe(0);
  });
});