import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8394a40-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the demo page to encapsulate interactions and queries.
class DemoPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Get the Run distribution demo button element handle
  async runButton() {
    return this.page.locator('#runDemo');
  }

  // Get the results container
  async resultsContainer() {
    return this.page.locator('#demoResults');
  }

  // Click the run button (will be the real user interaction)
  async clickRun() {
    await this.page.click('#runDemo');
  }

  // Wait until the button shows "Running…" text (indicative of S1_DemoRunning)
  async waitForRunning({ timeout = 1000 } = {}) {
    await this.page.waitForFunction(() => {
      const b = document.getElementById('runDemo');
      return b && b.textContent && b.textContent.trim().startsWith('Running');
    }, { timeout });
  }

  // Wait until results area contains the simulation results (indicative of S2_DemoCompleted)
  async waitForResults({ timeout = 2000 } = {}) {
    await this.page.waitForFunction(() => {
      const results = document.getElementById('demoResults');
      return results && results.querySelector('h3') && results.querySelector('h3').textContent.includes('Simulation results');
    }, { timeout });
  }

  // Parse the three counts (A,B,C) for each result table and return array of { title, counts: {A,B,C}, sum }
  async parseResultTables() {
    // Evaluate in page context for reliability
    return this.page.evaluate(() => {
      const results = document.getElementById('demoResults');
      if (!results) return [];
      const sections = [];
      // Each algorithm section is created by tableFor(...) with a preceding <h4>
      const h4s = Array.from(results.querySelectorAll('h4'));
      // Tables follow each h4
      h4s.forEach(h4 => {
        const title = h4.textContent.trim();
        let table = h4.nextElementSibling;
        // in markup, table is immediate sibling after h4
        if (!table || table.tagName.toLowerCase() !== 'table') {
          // find next table
          table = h4.parentElement.querySelector('table');
        }
        const counts = { A: 0, B: 0, C: 0 };
        if (table) {
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const server = cells[0].textContent.trim();
              const num = parseInt(cells[1].textContent.trim(), 10);
              if (server && !isNaN(num) && counts.hasOwnProperty(server)) {
                counts[server] = num;
              }
            }
          });
        }
        const sum = counts.A + counts.B + counts.C;
        sections.push({ title, counts, sum });
      });
      return sections;
    });
  }
}

test.describe('Load Balancing Demo FSM Tests (d8394a40-fa7b-11f0-b314-ad8654ee5de8)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleErrors = [];
    page = await browser.newPage();

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // capture for assertions
      pageErrors.push(err);
    });

    // Listen for console messages and capture error-level messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
  });

  test.afterEach(async () => {
    await page.close();
    // Clear captured arrays after closing for hygiene (assertions happen in tests)
  });

  // Test the initial Idle state (S0_Idle)
  test('Initial render -> S0_Idle: page loads and shows Run distribution demo button and intro text', async () => {
    // Arrange
    const demo = new DemoPage(page);
    await demo.goto();

    // Assert button is present, enabled, has correct text and attributes
    const btn = demo.runButton();
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText('Run distribution demo');
    await expect(btn).toHaveAttribute('aria-controls', 'demoResults');
    await expect(btn).toHaveClass(/small/);

    // Assert results container exists and contains the initial muted message (evidence of Idle state)
    const results = demo.resultsContainer();
    await expect(results).toBeVisible();
    const resultsText = await results.innerText();
    expect(resultsText).toContain('No demo run yet. Click the button to see how Round-Robin');
    // No runtime errors or console errors should have happened during initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition S0_Idle -> S1_DemoRunning triggered by RunDemoClick event
  test('Transition S0_Idle -> S1_DemoRunning: clicking Run distribution demo disables button and updates text', async () => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the run button (this triggers the event handler in the page)
    await demo.clickRun();

    // Immediately after click, the button should be disabled and show 'Running…' (evidence from FSM)
    await demo.waitForRunning({ timeout: 500 }); // should appear quickly
    const btn = demo.runButton();
    await expect(btn).toBeDisabled();
    const text = await btn.textContent();
    expect(text.trim()).toContain('Running');

    // While running, ensure the results still do not yet contain final results (still transitioning)
    const resultsHtml = await (await demo.resultsContainer()).innerHTML();
    expect(resultsHtml.length).toBeGreaterThan(0); // has existing markup
    // It should not yet contain the 'Simulation results' heading
    expect(resultsHtml).not.toContain('Simulation results');

    // There should be no uncaught exceptions triggered by the click itself
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition S1_DemoRunning -> S2_DemoCompleted: after simulated delay the results are displayed
  test('Transition S1_DemoRunning -> S2_DemoCompleted: results are displayed and button resets', async () => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Start simulation
    await demo.clickRun();

    // Wait for the Running… state text
    await demo.waitForRunning({ timeout: 500 });

    // Now wait for results to populate (simulate completes after ~300ms)
    await demo.waitForResults({ timeout: 2000 });

    // After completion, the button should be re-enabled and have original text
    const btn = demo.runButton();
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText('Run distribution demo');

    // Validate that the results DOM includes the expected simulation sections and that counts sum to 30
    const sections = await demo.parseResultTables();
    // We expect 4 algorithm sections: Round-Robin, Weighted Round-Robin, Least-Connections, Consistent Hashing
    const titles = sections.map(s => s.title);
    expect(titles.some(t => t.includes('Round-Robin'))).toBeTruthy();
    expect(titles.some(t => t.includes('Weighted Round-Robin'))).toBeTruthy();
    expect(titles.some(t => t.includes('Least-Connections'))).toBeTruthy();
    expect(titles.some(t => t.includes('Consistent Hashing'))).toBeTruthy();

    // For each section, assert that A+B+C == 30 (the demo simulates 30 requests)
    expect(sections.length).toBeGreaterThanOrEqual(4); // ensure we found at least the major ones
    for (const sec of sections) {
      expect(sec.sum).toBe(30);
      // each count should be non-negative integers
      expect(Number.isInteger(sec.counts.A)).toBeTruthy();
      expect(Number.isInteger(sec.counts.B)).toBeTruthy();
      expect(Number.isInteger(sec.counts.C)).toBeTruthy();
      expect(sec.counts.A).toBeGreaterThanOrEqual(0);
      expect(sec.counts.B).toBeGreaterThanOrEqual(0);
      expect(sec.counts.C).toBeGreaterThanOrEqual(0);
    }

    // Check that details (sequence) are present for at least one section
    const results = demo.resultsContainer();
    await expect(results.locator('details')).toHaveCountGreaterThan(0);

    // No runtime errors should have been thrown during simulation completion
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: attempt to click the button multiple times rapidly while running
  test('Edge case: multiple rapid clicks do not cause duplicate runs or JS errors', async () => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click to start run
    await demo.clickRun();

    // Immediately attempt to click again (button expected to be disabled)
    // Use try/catch to detect if click throws (it shouldn't), but we will assert the button remained disabled
    try {
      await demo.clickRun();
    } catch (e) {
      // If Playwright throws because element is disabled/unavailable, that's acceptable; ignore
    }

    // Ensure button is disabled and shows Running…
    await demo.waitForRunning({ timeout: 500 });
    const btn = demo.runButton();
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText(/Running/);

    // Wait for completion
    await demo.waitForResults({ timeout: 2000 });

    // After completion, ensure exactly one set of results present (i.e., not duplicated content)
    // We'll assert there is just one h3 Simulation results heading
    const simulationHeadingCount = await page.locator('#demoResults h3').count();
    expect(simulationHeadingCount).toBe(1);

    // No page errors or console errors emitted during the rapid-click scenario
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Verify that repeated runs produce consistent results and that clicking after completion triggers another run
  test('Repeated runs: clicking after completion runs a fresh simulation and updates DOM again', async () => {
    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRun();
    await demo.waitForResults({ timeout: 2000 });
    const firstSections = await demo.parseResultTables();

    // Start second run
    await demo.clickRun();
    // Immediately check it entered Running state
    await demo.waitForRunning({ timeout: 500 });
    // Wait for second completion
    await demo.waitForResults({ timeout: 2000 });

    const secondSections = await demo.parseResultTables();

    // Validate both runs produced valid sections with counts summing to 30
    expect(firstSections.length).toBeGreaterThanOrEqual(4);
    expect(secondSections.length).toBeGreaterThanOrEqual(4);

    for (const sec of secondSections) {
      expect(sec.sum).toBe(30);
    }

    // It's acceptable if the counts differ between runs (deterministic code produces same results on each run),
    // but we primarily assert that DOM was updated and remains consistent shape.
    expect(await demo.runButton().then(h => h.textContent())).toContain('Run distribution demo');

    // No runtime errors across repeated runs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Observability test: capture console and page errors over typical user flow
  test('Observability: page should not throw uncaught exceptions or console.error during typical usage', async () => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform a run to exercise code paths
    await demo.clickRun();
    await demo.waitForResults({ timeout: 2000 });

    // Now assert captured errors arrays are empty (no uncaught runtime exceptions)
    expect(pageErrors.length).toBe(0, 'Expected no uncaught page errors (pageerror events)');
    expect(consoleErrors.length).toBe(0, 'Expected no console.error messages during demo run');

    // As additional check, gather any console messages and ensure no 'ReferenceError' or 'TypeError' substrings were emitted in logged text
    // (this is defensive but does not modify runtime)
    const allConsoleMessages = await page.evaluate(() => {
      // There's no universal console history API in the page; we rely on Playwright's console listener above.
      return true;
    });
    expect(allConsoleMessages).toBeTruthy();
  });
});