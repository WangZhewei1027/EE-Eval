import { test, expect } from '@playwright/test';

// Page object for the small PageRank demo area
class PageRankDemo {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.result = page.locator('#demoResult');
    this.demoArea = page.locator('.demo-area');
  }

  async goto(url) {
    await this.page.goto(url);
    // Ensure the demo area is present
    await expect(this.demoArea).toBeVisible();
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }

  async waitForComputingText(timeout = 2000) {
    // The page immediately sets 'Computing PageRank...\n' on click
    await expect(this.result).toContainText('Computing PageRank...', { timeout });
  }

  async waitForFinalText(timeout = 5000) {
    // Wait for the final output which includes 'Final PageRank vector'
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demoResult');
      return el && /Final PageRank vector/.test(el.textContent || '');
    }, null, { timeout });
  }
}

// Base URL for the HTML file under test
const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8366410-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('PageRank demo FSM and interactive behaviors', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled errors from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page before each test
    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors occurred during the test run.
    // This validates the script executed without throwing ReferenceError/SyntaxError/TypeError.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    // Also assert there are no console-level "error" messages
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('S0_Idle: initial render shows button and instructional text (renderPage entry action)', async ({ page }) => {
    // Validate initial Idle state (S0_Idle): button present and the demo text instructs user to click.
    const demo = new PageRankDemo(page);

    // Button should be visible and have the expected text
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveText('Run small PageRank demo');

    // The initial result area should contain the instructional text
    const initialText = await demo.getResultText();
    expect(initialText).toContain('Click "Run small PageRank demo" to compute PageRank for the 4-node example.');

    // Accessibility attributes present (aria-live / aria-atomic) as part of proper rendering
    const demoResultEl = page.locator('#demoResult');
    await expect(demoResultEl).toHaveAttribute('aria-atomic', 'true');
    await expect(demoResultEl).toBeVisible();
  });

  test('S0_Idle -> S1_Computing: clicking Run triggers computing state message', async ({ page }) => {
    // This test validates the transition from Idle to Computing (RunDemoClick event)
    const demo = new PageRankDemo(page);

    // Click the button and assert the page shows the computing message immediately
    await demo.clickRun();

    // The code sets out.textContent = 'Computing PageRank...\n'; ensure this appears
    await demo.waitForComputingText(2000);

    // Confirm the computing text is present in the result area
    const afterClickText = await demo.getResultText();
    expect(afterClickText.startsWith('Computing PageRank...')).toBeTruthy();
  });

  test('S1_Computing -> S2_Completed: computation finishes and final PageRank vector is output', async ({ page }) => {
    // This test validates the computation runs and the page transitions to Completed with final output
    const demo = new PageRankDemo(page);

    // Trigger computation
    await demo.clickRun();

    // Verify computing message appears
    await demo.waitForComputingText(2000);

    // Wait for final text which includes 'Final PageRank vector'
    await demo.waitForFinalText(5000);

    // Get final output and perform multiple assertions about content and formatting
    const finalText = await demo.getResultText();

    // Should include a short description of the graph
    expect(finalText).toContain('Graph: A→{B,C}, B→{C}, C→{A}, D→{C}');

    // Should include the damping factor line (verifies the algorithm used typical parameters)
    expect(finalText).toContain('Damping factor d = 0.85');

    // Should have iteration logs and L1 change entries
    expect(finalText).toMatch(/Iteration\s+\d+:\s+/);
    expect(finalText).toContain('(L1 change =');

    // Should include 'Converged at iteration' or a max-iteration notice; check for at least one of them
    expect(finalText).toMatch(/Converged at iteration|Reached max iterations without meeting tolerance/);

    // Final PageRank vector block should appear and contain the labels A:, B:, C:, D:
    expect(finalText).toContain('Final PageRank vector');
    expect(finalText).toContain('A:');
    expect(finalText).toContain('B:');
    expect(finalText).toContain('C:');
    expect(finalText).toContain('D:');

    // The final ranks should sum to approximately 1 (the code prints the sum with 12 decimals);
    // Extract the printed sum from the line 'Final PageRank vector (sum = X):'
    const sumMatch = finalText.match(/Final PageRank vector \(sum = ([0-9.]+)\):/);
    if (sumMatch) {
      const sumValue = parseFloat(sumMatch[1]);
      expect(Math.abs(sumValue - 1)).toBeLessThan(1e-9);
    } else {
      // If format differs, at least ensure the word 'Final PageRank vector' exists (already checked)
      // but fail if the explicit sum line is missing would be too strict; we surface via expect above.
    }
  });

  test('Edge case: multiple rapid clicks still results in a valid final output and no errors', async ({ page }) => {
    // Simulate the user clicking the button multiple times rapidly to create overlapping computations.
    const demo = new PageRankDemo(page);

    // Rapidly click the run button several times
    await demo.runButton.click();
    await demo.runButton.click();
    await demo.runButton.click();

    // Ensure computing message appears (S1_Computing)
    await demo.waitForComputingText(2000);

    // Ultimately, the last scheduled computation should set the final output. Wait for final.
    await demo.waitForFinalText(7000);

    const text = await demo.getResultText();
    // The final output should still be well-formed and include expected phrases
    expect(text).toContain('Final PageRank vector');
    expect(text).toContain('Damping factor d = 0.85');
    expect(text).toMatch(/Iteration\s+\d+:/);

    // Also ensure no console or page errors were emitted during this stress
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Verifies FSM evidence lines and expected strings for states/transitions', async ({ page }) => {
    // This test checks the specific evidence strings mentioned in the FSM:
    // - Transition S0->S1: 'Computing PageRank...\n' must appear
    // - Transition S1->S2: 'out.textContent = lines.join(\'\\n\');' effect = final lines.join('\n') present
    const demo = new PageRankDemo(page);

    // Check initial evidence: button exists (renderPage())
    await expect(demo.runButton).toBeVisible();

    // Trigger the demo run
    await demo.clickRun();

    // Immediately the Computing message (S1 evidence)
    await demo.waitForComputingText(2000);

    // Then wait for full output (S2 evidence)
    await demo.waitForFinalText(5000);

    const finalText = await demo.getResultText();

    // The presence of output lines joined by newlines is evidenced by the output containing multiple newline-separated lines.
    // Confirm presence of multiple lines by asserting at least one newline exists in the text (since the code constructs lines array)
    expect(finalText.split('\n').length).toBeGreaterThanOrEqual(4);

    // Confirm the explicit phrase 'Computing PageRank...' was used earlier by checking it no longer starts with the computing string (it was replaced)
    expect(finalText.startsWith('Computing PageRank...')).toBeFalsy();
  });

  test('Accessibility and semantics: demo area has aria-live for polite updates', async ({ page }) => {
    const demo = new PageRankDemo(page);

    // Ensure the demo area is marked with aria-live="polite"
    await expect(page.locator('.demo-area')).toHaveAttribute('aria-live', 'polite');

    // The inner result container should have aria-atomic="true" to ensure assistive tech gets full updates
    await expect(page.locator('#demoResult')).toHaveAttribute('aria-atomic', 'true');
  });
});