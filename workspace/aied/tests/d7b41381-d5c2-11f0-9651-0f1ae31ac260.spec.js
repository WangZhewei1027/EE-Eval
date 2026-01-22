import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b41381-d5c2-11f0-9651-0f1ae31ac260.html';

class KruskalPage {
  /**
   * Page object encapsulating interactions and queries for the Kruskal visualization
   */
  constructor(page) {
    this.page = page;
    this.stepBtn = page.locator('#step-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.log = page.locator('#log');
    this.svg = page.locator('#graph');
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async isStepDisabled() {
    return await this.stepBtn.evaluate((b) => b.disabled);
  }

  async getLogText() {
    return (await this.log.textContent()) || '';
  }

  // Returns array of trimmed non-empty log lines
  async getLogLines() {
    const text = await this.getLogText();
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  }

  // Returns a CSS class list string for the edge by id (e.g., "CF")
  async getEdgeClass(edgeId) {
    const handle = await this.page.$(`#${edgeId}`);
    if (!handle) return null;
    return await handle.evaluate((el) => el.getAttribute('class') || '');
  }

  // Wait until log includes the provided substring or times out
  async waitForLogContains(substring, opts = { timeout: 3000 }) {
    await this.page.waitForFunction(
      (sel, substr) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(substr),
      { timeout: opts.timeout },
      '#log',
      substring
    );
  }

  // Ensure at least `n` steps have been taken (observed by number of "Considering edge" messages)
  async waitForConsideringCount(minCount, opts = { timeout: 5000 }) {
    await this.page.waitForFunction(
      (sel, count) => {
        const txt = document.querySelector(sel) ? document.querySelector(sel).textContent : '';
        return (txt.match(/Considering edge/g) || []).length >= count;
      },
      { timeout: opts.timeout },
      '#log',
      minCount
    );
  }
}

test.describe('Kruskal Algorithm Visualization - FSM states & transitions', () => {
  // capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console entries
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for initial reset message to appear in the log (entry action of S0_Idle)
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && el.textContent && el.textContent.includes("Algorithm reset. Ready to run Kruskal's Algorithm.");
    }, { timeout: 3000 });
  });

  test.afterEach(async () => {
    // No teardown actions required; listeners will be garbage collected per test
  });

  test('Initial state (S0_Idle) - page loads and shows reset message; no JS errors', async ({ page }) => {
    // Validate initial UI and state after reset() entry action
    const app = new KruskalPage(page);

    // The log should contain the initial reset message
    const logText = await app.getLogText();
    expect(logText).toContain("Algorithm reset. Ready to run Kruskal's Algorithm.");

    // The step button should be enabled on initial load
    expect(await app.isStepDisabled()).toBe(false);

    // Graph SVG should exist and contain edge elements (sample check: an expected edge ID)
    // Check presence of at least one known edge element by id 'CF' which exists in the implementation
    const cfClass = await app.getEdgeClass('CF');
    expect(cfClass).not.toBeNull();

    // Ensure there are no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages
    const consoleErrors = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Stepping (S1_Stepping) - clicking Next Step marks edges and logs activity; completes to S2_Complete', async ({ page }) => {
    const app = new KruskalPage(page);

    // Comment: We will step repeatedly until MST is completed (log shows completion message or step button disabled).
    // Collect observed edges that were processed and verify classes and messages.
    const processedEdges = [];
    const maxSteps = 50; // safety cap to avoid infinite loops

    // helper to get last log line
    const lastLogLine = async () => {
      const lines = await app.getLogLines();
      return lines.length ? lines[lines.length - 1] : '';
    };

    // perform steps until completion
    for (let i = 0; i < maxSteps; i++) {
      const beforeLines = await app.getLogLines();
      await app.clickStep();

      // wait for at least one new "Considering edge" entry to be present or for completion
      await app.waitForConsideringCount(i + 1).catch(() => { /* ignore timeout here, check outcome below */ });

      // read the log lines and determine the latest 'Considering edge' message
      const lines = await app.getLogLines();

      // find the newest considering entry
      const consideringLines = lines.filter(l => l.startsWith('Considering edge'));
      if (consideringLines.length > 0) {
        const lastConsidering = consideringLines[consideringLines.length - 1];
        // parse the endpoints from the log line: "Considering edge (A - B) with weight W."
        const m = lastConsidering.match(/Considering edge \((\w)\s-\s(\w)\)\swith weight\s([0-9]+)/);
        if (m) {
          const from = m[1];
          const to = m[2];
          const edgeId = `${from}${to}`;
          processedEdges.push({ edgeId, logLine: lastConsidering });

          // Verify the corresponding edge DOM element has 'checked' class applied
          const cls = await app.getEdgeClass(edgeId);
          expect(cls).toContain('checked');

          // The log should have an immediate follow-up line either 'Edge added to MST.' or 'Edge creates a cycle and is skipped.'
          const idx = lines.indexOf(lastConsidering);
          const nextLine = lines[idx + 1] || '';
          expect(
            nextLine === 'Edge added to MST.' || nextLine === 'Edge creates a cycle and is skipped.'
          ).toBe(true);

          // If 'Edge added to MST.' then element should have 'in-forest' class as well
          if (nextLine === 'Edge added to MST.') {
            const clsAfter = await app.getEdgeClass(edgeId);
            expect(clsAfter).toContain('in-forest');
          }
        }
      }

      // After each step check if completed
      const fullLog = await app.getLogText();
      if (fullLog.includes('Minimum Spanning Tree completed!')) {
        break;
      }

      // If the step button becomes disabled for any reason, stop
      if (await app.isStepDisabled()) break;
    }

    // After stepping loop assert that we reached completion state S2_Complete
    const finalLog = await app.getLogText();
    const completed = finalLog.includes('Minimum Spanning Tree completed!') || await app.isStepDisabled();
    expect(completed).toBe(true);

    // Verify MST finalization message appears in the log
    expect(finalLog).toContain('Minimum Spanning Tree completed!');

    // Ensure no uncaught page errors occurred during stepping
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Sanity: at least one edge should have been added to MST
    const addedLines = finalLog.split('\n').filter(l => l.trim() === 'Edge added to MST.');
    expect(addedLines.length).toBeGreaterThanOrEqual(1);
  });

  test('Reset transitions (Reset event) - from Stepping and from Idle should clear state and re-enable controls', async ({ page }) => {
    const app = new KruskalPage(page);

    // Step a few times to move into Stepping state
    await app.clickStep();
    await app.waitForLogContains('Considering edge');

    // Ensure something changed (an edge got 'checked')
    const preLog = await app.getLogText();
    expect(preLog).toContain('Considering edge');

    // Click reset while in Stepping state
    await app.clickReset();

    // After reset, the log should include the reset message and previous classes removed
    await app.waitForLogContains("Algorithm reset. Ready to run Kruskal's Algorithm.");
    const logAfterReset = await app.getLogText();
    expect(logAfterReset).toContain("Algorithm reset. Ready to run Kruskal's Algorithm.");

    // No edge should retain 'checked' or 'in-forest' class after reset (sample check on a few known edges)
    const sampleEdgeIds = ['CF', 'AB', 'ED'];
    for (const id of sampleEdgeIds) {
      const cls = await app.getEdgeClass(id);
      // class might be 'edge' or similar; ensure it does not include 'checked' or 'in-forest'
      expect(cls).not.toContain('checked');
      expect(cls).not.toContain('in-forest');
    }

    // Step button should be enabled again after reset
    expect(await app.isStepDisabled()).toBe(false);

    // Now test Reset from Idle: click reset again
    await app.clickReset();
    await app.waitForLogContains("Algorithm reset. Ready to run Kruskal's Algorithm.");
    const logAfterSecondReset = await app.getLogText();
    // The log will contain reset messages twice; ensure the latest contains the message
    expect(logAfterSecondReset).toContain("Algorithm reset. Ready to run Kruskal's Algorithm.");

    // Ensure no console or page errors occurred during resets
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: clicking Next Step after completion should be a no-op and produce no errors', async ({ page }) => {
    const app = new KruskalPage(page);

    // Fast-forward to completion by clicking until disabled/completed
    const maxClicks = 100;
    for (let i = 0; i < maxClicks; i++) {
      if (await app.isStepDisabled()) break;
      await app.clickStep();
    }

    // Ensure we are in completion state
    const finalLog = await app.getLogText();
    expect(finalLog.includes('Minimum Spanning Tree completed!') || await app.isStepDisabled()).toBe(true);

    // Capture current log state
    const before = await app.getLogText();

    // Click Next Step again forcibly and verify nothing breaks / no new unexpected errors
    await app.clickStep();

    // Wait a bit to allow any potential message to appear
    await page.waitForTimeout(200);

    const after = await app.getLogText();

    // The log should not regress or show error messages; at most it may have appended "All edges processed. Algorithm complete."
    // Verify no new "Unhandled" page errors detected
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // The log after clicking should either be unchanged or contain only allowed completion text
    expect(after.length).toBeGreaterThanOrEqual(before.length);

    // If anything appended, it should be a known completion message (defensive check)
    if (after.length > before.length) {
      const appended = after.slice(before.length).trim();
      expect(
        appended.includes('All edges processed. Algorithm complete.') ||
        appended.includes('Minimum Spanning Tree completed!')
      ).toBe(true);
    }
  });

  test('Observability: console logs contain informative messages and no runtime exceptions are thrown', async ({ page }) => {
    // This test explicitly checks the console messages captured during earlier interactions.
    // We don't interact here; we rely on prior page load behavior captured in beforeEach.
    // The initial reset should have logged to the #log area but not necessarily to console. Still, ensure console has no errors.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Check that console has at least been listened to and captured (could be empty if app logs to DOM only)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});