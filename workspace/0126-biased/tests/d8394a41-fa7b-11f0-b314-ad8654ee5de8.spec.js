import { test, expect } from '@playwright/test';

test.setTimeout(60000); // allow enough time for the ~14s simulated timeline

// Page Object Model for the Socket Simulation demo page
class SocketSimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.simulateBtn = page.locator('#simulateBtn');
    this.log = page.locator('#log');
    this.logChildren = () => page.locator('#log > div');
  }

  async goto(url) {
    await this.page.goto(url);
  }

  async clickSimulate() {
    await this.simulateBtn.click();
  }

  async getLogText() {
    return await this.log.innerText();
  }

  async getLogLines() {
    const count = await this.logChildren().count();
    const lines = [];
    for (let i = 0; i < count; i++) {
      lines.push(await this.logChildren().nth(i).textContent());
    }
    return lines;
  }

  async waitForLogContains(text, timeout = 30000) {
    await this.page.waitForFunction(
      ({ sel, txt }) => {
        const el = document.querySelector(sel);
        return !!el && el.innerText.includes(txt);
      },
      { sel: '#log', txt: text },
      { timeout }
    );
  }

  async waitForLogNotContains(text, timeout = 5000) {
    await this.page.waitForFunction(
      ({ sel, txt }) => {
        const el = document.querySelector(sel);
        return !!el && !el.innerText.includes(txt);
      },
      { sel: '#log', txt: text },
      { timeout }
    );
  }
}

test.describe('FSM: Socket Programming Simulation (d8394a41-fa7b-11f0-b314-ad8654ee5de8)', () => {
  const url =
    'http://127.0.0.1:5500/workspace/0126-biased/html/d8394a41-fa7b-11f0-b314-ad8654ee5de8.html';

  // Collect console messages and page errors per test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, ensure we observed and recorded console/page errors (if any).
    // Tests below will assert expectations regarding these arrays as needed.
  });

  test('Initial state S0_Idle: page renders with simulate button and initial log content', async ({
    page
  }) => {
    // This test validates the initial Idle state (S0_Idle):
    // - The simulate button exists with the expected text and attributes
    // - The log area exists with the informational starter text
    const p = new SocketSimPage(page);
    await p.goto(url);

    // Verify button presence and attributes
    await expect(p.simulateBtn).toBeVisible();
    await expect(p.simulateBtn).toHaveAttribute('class', 'primary');
    await expect(p.simulateBtn).toHaveAttribute('aria-controls', 'log');
    await expect(p.simulateBtn).toHaveText('Simulate TCP Handshake & Exchange');

    // Verify log is present and contains the initial explanatory sentence
    await expect(p.log).toBeVisible();
    const initialText = await p.getLogText();
    expect(initialText).toContain(
      'Click "Simulate TCP Handshake & Exchange" to see a textual, timed simulation'
    );

    // Ensure no uncaught page errors occurred while loading the idle state
    expect(pageErrors.length).toBe(0);
    // No console error messages expected on initial render
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_SimulationRunning: clicking simulate starts simulation and clears log', async ({
    page
  }) => {
    // This test validates starting the simulation:
    // - Clicking the button invokes startSimulation()
    // - The log is cleared immediately (log.innerHTML = '')
    // - The first appended lines are present
    // - Re-clicking while running is ignored (if (running) return;)
    const p = new SocketSimPage(page);
    await p.goto(url);

    // Sanity: initial log contains helper text
    const before = await p.getLogText();
    expect(before).toContain('Click "Simulate TCP Handshake & Exchange"');

    // Click the simulate button to start the simulation
    await p.clickSimulate();

    // Immediately after clicking, the implementation sets log.innerHTML = ''
    // Wait for the default helper text to be removed
    await p.waitForLogNotContains('Click "Simulate TCP Handshake & Exchange"');

    // The first appended line should be the simulation header
    // It may take a tick for the appendLine calls; wait briefly for header to appear
    await p.waitForLogContains('--- Simulated TCP Connection Trace (conceptual) ---', 3000);

    const linesAfterStart = await p.getLogLines();
    expect(linesAfterStart.length).toBeGreaterThanOrEqual(2);
    expect(linesAfterStart[0]).toBe('--- Simulated TCP Connection Trace (conceptual) ---');
    expect(linesAfterStart[1]).toBe('Note: This is a local, educational simulation only.');

    // Rapid second click should be ignored due to `if (running) return;`
    // Click again immediately
    await p.clickSimulate();

    // Give a small delay to allow any incorrect second-run behavior to surface
    await page.waitForTimeout(500);

    // Ensure there is still only one header line at the top (no duplicated header)
    const linesAfterSecondClick = await p.getLogLines();
    // Count occurrences of the header line
    const headerCount = linesAfterSecondClick.filter(
      (t) => t === '--- Simulated TCP Connection Trace (conceptual) ---'
    ).length;
    expect(headerCount).toBe(1);

    // Ensure no page errors or console error messages were produced when starting the simulation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_SimulationRunning -> S0_Idle: simulation completes, final log message present, and can restart', async ({
    page
  }) => {
    // This test validates the full simulation lifecycle:
    // - After clicking simulate, the simulation emits many timed events
    // - The final step includes '--- Connection closed gracefully ---'
    // - After completion, the implementation appends a 'Tips:' line indicating completion and running=false
    // - Once complete, clicking the button again should restart (log cleared and header reappears)
    const p = new SocketSimPage(page);
    await p.goto(url);

    // Start simulation
    await p.clickSimulate();

    // Wait for the critical final text that marks close
    await p.waitForLogContains('--- Connection closed gracefully ---', 30000);

    // After the '--- Connection closed gracefully ---' step, the script also appends a summary/tips line.
    await p.waitForLogContains('Tips: In real implementations, you must handle retransmissions', 5000);

    const finalLines = await p.getLogLines();
    // Ensure the final connection-closed line exists somewhere in the log
    const hasClosedLine = finalLines.some((l) => l === '--- Connection closed gracefully ---');
    expect(hasClosedLine).toBe(true);

    // Ensure the Tips line appears after the end (it is appended after simulation is marked running=false)
    const hasTips = finalLines.some((l) =>
      l.startsWith('Tips: In real implementations, you must handle retransmissions')
    );
    expect(hasTips).toBe(true);

    // Now, click simulate again after completion to ensure transition back to Idle and re-entry to Simulation Running occurs
    await p.clickSimulate();

    // After clicking again, log should be cleared (no longer contain previous final lines)
    await p.waitForLogNotContains('--- Connection closed gracefully ---', 3000);

    // Header should reappear indicating a fresh run
    await p.waitForLogContains('--- Simulated TCP Connection Trace (conceptual) ---', 3000);

    // Final sanity: ensure no uncaught page errors occurred during the full lifecycle
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge Case: rapid repeated clicks do not spawn concurrent simulations', async ({ page }) => {
    // This test stresses the guard clause `if (running) return;` by attempting many rapid clicks.
    // Expectation: only one simulation run should be active and header appended only once.
    const p = new SocketSimPage(page);
    await p.goto(url);

    // Perform many rapid clicks
    const clickCount = 6;
    for (let i = 0; i < clickCount; i++) {
      // don't await clicks in series to simulate rapid user spamming; but still small delay to avoid choking
      await p.simulateBtn.click();
    }

    // Wait a short time for the first click to have cleared and written initial lines
    await p.waitForLogContains('--- Simulated TCP Connection Trace (conceptual) ---', 3000);

    // Ensure there is exactly one header line
    const lines = await p.getLogLines();
    const headerOccurrences = lines.filter(
      (t) => t === '--- Simulated TCP Connection Trace (conceptual) ---'
    ).length;
    expect(headerOccurrences).toBe(1);

    // No console errors or page errors should have occurred due to repeated clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM and Accessibility attributes are present for components (components verification)', async ({
    page
  }) => {
    // Validate the components listed in the FSM extraction summary:
    // - Button #simulateBtn exists, has expected text and attributes
    // - Div #log exists, has class "log" and aria attributes
    const p = new SocketSimPage(page);
    await p.goto(url);

    await expect(p.simulateBtn).toBeVisible();
    await expect(p.simulateBtn).toHaveAttribute('id', 'simulateBtn');
    await expect(p.simulateBtn).toHaveAttribute('aria-controls', 'log');

    await expect(p.log).toBeVisible();
    await expect(p.log).toHaveAttribute('class', 'log');
    await expect(p.log).toHaveAttribute('aria-live', 'polite');
    await expect(p.log).toHaveAttribute('aria-atomic', 'false');
    await expect(p.log).toHaveAttribute('tabindex', '0');

    // No console errors or page errors on simple attribute checks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});