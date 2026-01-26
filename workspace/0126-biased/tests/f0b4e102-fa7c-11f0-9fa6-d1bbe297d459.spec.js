import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b4e102-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Comprehensive Guide to Linear Regression (Application f0b4e102-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect all console messages with their types and text
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect any unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page exactly as provided
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Test S0_Idle: initial render state
  test('S0_Idle - initial page renders expected static content and interactive components', async ({ page }) => {
    // This test validates the initial (Idle) state S0_Idle:
    // - The main heading exists and matches the FSM evidence
    // - The interactive button (#demoButton) and visual container (#demoPlot) exist
    // - There are no runtime page errors on initial load
    // - The script that attaches the click handler exists in the page source (FSM evidence)

    // Verify heading presence and text
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText('Comprehensive Guide to Linear Regression');

    // Verify the generate button exists and is visible
    const demoButton = page.locator('#demoButton');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Generate Regression Example');

    // Verify the demoPlot container exists and is initially empty (Idle state)
    const demoPlot = page.locator('#demoPlot');
    await expect(demoPlot).toBeVisible();
    const demoPlotContent = (await demoPlot.innerHTML()).trim();
    // The FSM Idle state evidence implies the page is rendered but demoPlot should be empty before interaction
    expect(demoPlotContent === '' || demoPlotContent === '<!-- -->').toBeTruthy();

    // Verify the event listener code exists in page source (FSM evidence)
    const content = await page.content();
    expect(content).toContain("document.getElementById('demoButton').addEventListener('click', function() {");

    // Assert there were no uncaught page errors on load
    expect(pageErrors.length).toBe(0);

    // Assert no console.error messages were emitted on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: GenerateRegressionExample -> S1_RegressionExampleGenerated
  test('GenerateRegressionExample event triggers rendering of SVG (transition to S1_RegressionExampleGenerated)', async ({ page }) => {
    // This test validates the click event and transition:
    // - Clicking the button produces an SVG inside #demoPlot with expected attributes and elements
    // - The SVG includes the expected style attribute shown in FSM evidence
    // - There are no runtime page errors triggered by the click

    const demoButton = page.locator('#demoButton');
    const demoPlot = page.locator('#demoPlot');

    // Click the button to trigger generation
    await demoButton.click();

    // Wait for an SVG to appear in demoPlot
    const svgLocator = demoPlot.locator('svg');
    await expect(svgLocator).toBeVisible();

    // Verify the SVG contains the expected width/height/style per FSM evidence
    const svgHTML = await svgLocator.evaluate((node) => node.outerHTML);
    expect(svgHTML).toContain('<svg');
    expect(svgHTML).toContain('width="500"');
    expect(svgHTML).toContain('height="300"');
    expect(svgHTML).toContain('background-color: white; border: 1px solid #ddd');

    // Verify the number of data point circles is 9 as in the implementation
    const circleCount = await demoPlot.locator('svg circle').count();
    expect(circleCount).toBe(9);

    // Verify the regression line (red) exists within the SVG
    const redLineCount = await demoPlot.locator('svg line[stroke="red"]').count();
    expect(redLineCount).toBeGreaterThanOrEqual(1);

    // Verify axes lines exist (black stroke)
    const axesCount = await demoPlot.locator('svg line[stroke="black"]').count();
    expect(axesCount).toBeGreaterThanOrEqual(2);

    // Verify descriptive paragraphs were added after the SVG
    await expect(demoPlot.locator('p')).toHaveCountGreaterThan(0);
    const firstParagraph = demoPlot.locator('p').first();
    await expect(firstParagraph).toContainText('This simple visualization shows');

    // Assert that generating the example did not produce uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Assert that no console.error messages were emitted during the transition
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test idempotency: clicking multiple times replaces content without duplication
  test('Clicking the Generate button multiple times replaces the visualization (no duplicate SVGs)', async ({ page }) => {
    // This test validates that multiple transitions (repeated event) do not accumulate artifacts:
    // - After multiple clicks, there should be exactly one SVG inside #demoPlot
    // - The SVG should maintain the expected number of elements after subsequent renders

    const demoButton = page.locator('#demoButton');
    const demoPlot = page.locator('#demoPlot');

    // First click
    await demoButton.click();
    await expect(demoPlot.locator('svg')).toBeVisible();
    const svgCountAfterFirst = await demoPlot.locator('svg').count();
    expect(svgCountAfterFirst).toBe(1);

    // Second click (should replace, not append)
    await demoButton.click();
    await expect(demoPlot.locator('svg')).toBeVisible();
    const svgCountAfterSecond = await demoPlot.locator('svg').count();
    expect(svgCountAfterSecond).toBe(1);

    // Ensure circles are still 9 after second render
    const circleCount = await demoPlot.locator('svg circle').count();
    expect(circleCount).toBe(9);

    // No page errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: rapidly clicking the button several times
  test('Rapid clicks do not cause errors and result in a single valid visualization', async ({ page }) => {
    // This test validates robustness against rapid user interactions:
    // - Rapidly clicking multiple times should not throw errors
    // - The final DOM state should contain only one SVG with consistent content

    const demoButton = page.locator('#demoButton');
    const demoPlot = page.locator('#demoPlot');

    // Rapidly click the button 5 times without waiting for renders to settle
    for (let i = 0; i < 5; i++) {
      // Fire and forget; clicks may queue up
      await demoButton.click();
    }

    // Wait for DOM to settle: wait for svg visible and stable
    const svgLocator = demoPlot.locator('svg');
    await expect(svgLocator).toBeVisible();

    // Ensure only one SVG is present
    const svgCount = await demoPlot.locator('svg').count();
    expect(svgCount).toBe(1);

    // Ensure expected elements exist
    const circleCount = await demoPlot.locator('svg circle').count();
    expect(circleCount).toBe(9);
    const redLineCount = await demoPlot.locator('svg line[stroke="red"]').count();
    expect(redLineCount).toBeGreaterThanOrEqual(1);

    // Ensure no uncaught errors occurred during rapid interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate FSM evidence strings exist within the demoPlot innerHTML and page source
  test('FSM evidence: demoPlot innerHTML includes SVG opening tag and script evidence exists', async ({ page }) => {
    // This test cross-checks that the concrete evidence strings mentioned in the FSM appear:
    // - The transition evidence includes a specific SVG opening tag snippet inside demoPlot
    // - The event handler evidence string exists within the page source

    const demoButton = page.locator('#demoButton');
    const demoPlot = page.locator('#demoPlot');

    // Click to generate the visualization
    await demoButton.click();

    // Get demoPlot innerHTML and assert it contains the exact evidence substring (or at least the key parts)
    const plotInner = await demoPlot.innerHTML();
    expect(plotInner).toContain('<svg width="500" height="300"');
    expect(plotInner).toContain('background-color: white; border: 1px solid #ddd;');

    // Check the page source for the exact event handler evidence string from the FSM
    const pageSource = await page.content();
    expect(pageSource).toContain("document.getElementById('demoButton').addEventListener('click', function() {");
  });

  // Observability test: ensure console and page errors are observed and structured as expected
  test('Observability: capture console messages and page errors during user interactions', async ({ page }) => {
    // This test ensures our listeners capture console and page errors:
    // - Perform interactions that should be safe
    // - Assert that the collected structures for console messages and page errors are arrays and contain expected types

    const demoButton = page.locator('#demoButton');

    // Before any interaction, ensure arrays are empty
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    expect(pageErrors.length).toBe(0);

    // Trigger the main interaction
    await demoButton.click();

    // After interaction, still expect arrays to exist; pageErrors should remain empty for this correct implementation
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // There should be no unhandled page errors in normal operation
    expect(pageErrors.length).toBe(0);

    // Console messages may have benign logs (e.g., warnings from browser), ensure none are 'error' produced by our code
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });
});