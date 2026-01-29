import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e9845-fa73-11f0-a9d0-d7a1991987c6.html';

// Helper page object for the simulation page
class SchedulingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // Capture console messages and page errors for assertions
    this.page.on('console', msg => {
      // store entire message object info
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location ? msg.location() : undefined
      });
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async selectAlgorithm(value) {
    await this.page.selectOption('#schedulingAlgorithm', value);
  }

  async getSelectedAlgorithm() {
    return this.page.$eval('#schedulingAlgorithm', el => el.value);
  }

  async clickRun() {
    await this.page.click("button[onclick='runScheduling()']");
  }

  async waitForResultsVisible() {
    await this.page.waitForSelector('#simulation', { state: 'visible' });
  }

  async isSimulationHidden() {
    return this.page.$eval('#simulation', el => {
      return window.getComputedStyle(el).display === 'none';
    });
  }

  async getProcessTableRows() {
    return this.page.$$eval('#processBody tr', rows => {
      return rows.map(r => {
        const cells = Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim());
        return {
          process: cells[0],
          burstTime: cells[1],
          completionTime: cells[2]
        };
      });
    });
  }

  // Expose captured messages/errors
  getConsoleMessages() {
    return this.consoleMessages;
  }

  getConsoleErrors() {
    return this.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('CPU Scheduling Simulation (FSM) - 324e9845-fa73-11f0-a9d0-d7a1991987c6', () => {
  // Each test gets a fresh page to preserve the initial global state in the HTML file
  test.beforeEach(async ({ page }) => {
    // Nothing here; instantiation will be done in each test to capture fresh listeners
  });

  // Test initial idle state S0_Idle
  test('Initial state S0_Idle: controls rendered and simulation hidden', async ({ page }) => {
    // Setup page object and navigate
    const sim = new SchedulingPage(page);
    await sim.goto();

    // Validate presence of select and button as evidence of Idle state
    const selectVisible = await page.isVisible('#schedulingAlgorithm');
    const buttonVisible = await page.isVisible("button[onclick='runScheduling()']");
    expect(selectVisible).toBe(true);
    expect(buttonVisible).toBe(true);

    // The FSM expects the simulation area to be hidden in Idle
    const hidden = await sim.isSimulationHidden();
    expect(hidden).toBe(true);

    // There should be no runtime page errors at initial render
    expect(sim.getPageErrors().length).toBe(0);

    // Also ensure no console errors were emitted during load
    const consoleErrors = sim.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: RunScheduling from Idle -> Scheduling Running -> Results Shown (FCFS)
  test('RunScheduling (default FCFS) transitions to Results Shown and displays correct FCFS completion times', async ({ page }) => {
    // Each test uses a fresh page object to collect console/page errors for that run
    const sim1 = new SchedulingPage(page);
    await sim.goto();

    // By default select value should be 'fcfs'
    const selected = await sim.getSelectedAlgorithm();
    expect(selected).toBe('fcfs');

    // Click the Run Scheduling button to trigger runScheduling()
    await sim.clickRun();

    // Wait for results area to become visible (transition S1 -> S2)
    await sim.waitForResultsVisible();

    // Collect table rows and validate FCFS ordering and completion times
    const rows = await sim.getProcessTableRows();
    // Expect 5 processes as defined in the HTML's processes array
    expect(rows.length).toBe(5);

    // FCFS completion times (cumulative): P1:5, P2:7, P3:15, P4:18, P5:24
    const expected = [
      { process: 'P1', completionTime: '5' },
      { process: 'P2', completionTime: '7' },
      { process: 'P3', completionTime: '15' },
      { process: 'P4', completionTime: '18' },
      { process: 'P5', completionTime: '24' }
    ];

    for (let i = 0; i < expected.length; i++) {
      expect(rows[i].process).toBe(expected[i].process);
      expect(rows[i].completionTime).toBe(expected[i].completionTime);
    }

    // Confirm the simulation container is visible (evidence of displayResults)
    const visible = await page.$eval('#simulation', el => window.getComputedStyle(el).display === 'block');
    expect(visible).toBe(true);

    // Ensure no page errors occurred during a normal run
    expect(sim.getPageErrors().length).toBe(0);
    expect(sim.getConsoleErrors().length).toBe(0);
  });

  // Test selecting a different algorithm and change event (S0_Idle -> user selects algorithm)
  test('SelectAlgorithm event: selecting SJF updates select value and produces SJF results', async ({ page }) => {
    const sim2 = new SchedulingPage(page);
    await sim.goto();

    // Programmatically select 'sjf' which should trigger the "change" interaction (no console output is expected from page)
    await sim.selectAlgorithm('sjf');
    const selected1 = await sim.getSelectedAlgorithm();
    expect(selected).toBe('sjf');

    // Now run the scheduling to exercise the transition and SJF algorithm
    await sim.clickRun();
    await sim.waitForResultsVisible();

    // Validate that SJF sorted by burst time asc and produced correct completion times:
    // Sorted order by burst time: P2(2), P4(3), P1(5), P5(6), P3(8)
    // Cumulative completion times: 2,5,10,16,24
    const rows1 = await sim.getProcessTableRows();
    const expectedOrder = [
      { process: 'P2', completionTime: '2' },
      { process: 'P4', completionTime: '5' },
      { process: 'P1', completionTime: '10' },
      { process: 'P5', completionTime: '16' },
      { process: 'P3', completionTime: '24' }
    ];

    // Note: The HTML's shortestJobFirst implementation sets completionTime based on sorted list.
    for (let i = 0; i < expectedOrder.length; i++) {
      expect(rows[i].process).toBe(expectedOrder[i].process);
      // completionTime is a string in the table cells
      expect(rows[i].completionTime).toBe(expectedOrder[i].completionTime);
    }

    // Ensure no JS errors for a normal SJF run
    expect(sim.getPageErrors().length).toBe(0);
    expect(sim.getConsoleErrors().length).toBe(0);
  });

  // Test Round Robin algorithm behavior and that displayResults reflects the completion order from RR
  test('RunScheduling with RR (Round Robin) shows RR-specific completion order and times', async ({ page }) => {
    const sim3 = new SchedulingPage(page);
    await sim.goto();

    // Select Round Robin
    await sim.selectAlgorithm('rr');
    expect(await sim.getSelectedAlgorithm()).toBe('rr');

    // Run scheduling
    await sim.clickRun();
    await sim.waitForResultsVisible();

    // Collect rows; Round Robin with quantum=3 as implemented yields completion times:
    // Simulate: P1(5),P2(2),P3(8),P4(3),P5(6)
    // Execution order completion times: P2:5, P4:11, P1:13, P5:19, P3:21 (see reasoning in test plan)
    const rows2 = await sim.getProcessTableRows();

    // There will be 5 rows but their ordering will be completion order as returned by roundRobin
    const expectedOrder1 = [
      { process: 'P2', completionTime: '5' },
      { process: 'P4', completionTime: '11' },
      { process: 'P1', completionTime: '13' },
      { process: 'P5', completionTime: '19' },
      { process: 'P3', completionTime: '21' }
    ];

    expect(rows.length).toBe(5);
    for (let i = 0; i < expectedOrder.length; i++) {
      expect(rows[i].process).toBe(expectedOrder[i].process);
      expect(rows[i].completionTime).toBe(expectedOrder[i].completionTime);
    }

    // Also assert that no unexpected page errors occurred for normal RR run
    expect(sim.getPageErrors().length).toBe(0);
    expect(sim.getConsoleErrors().length).toBe(0);
  });

  // Edge case: Force an invalid algorithm selection (empty string) to trigger an error path
  test('Edge case: missing/invalid algorithm value leads to runtime error (displayResults called with undefined)', async ({ page }) => {
    const sim4 = new SchedulingPage(page);
    await sim.goto();

    // Intentionally set the select to an empty string to create a branch not handled by switch
    await page.evaluate(() => {
      const sel = document.getElementById('schedulingAlgorithm');
      // Force an invalid value not present in the original options
      sel.value = '';
    });

    // Prepare to capture the pageerror event that will result from trying to call displayResults(undefined)
    // The runScheduling flow will call displayResults(result) where result is undefined, then displayResults will attempt to iterate processes.forEach and raise a TypeError.
    // Use waitForEvent to ensure we capture the thrown error for assertion
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      // Trigger the Run Scheduling button click
      sim.clickRun()
    ]);

    // Validate that a runtime error was thrown and it is consistent with a TypeError due to undefined.forEach / cannot read properties
    expect(error).toBeTruthy();
    // Browser error messages differ slightly between engines; check for indicative substrings
    const msg = error.message || String(error);
    const expectedSubstrings = ['forEach', 'Cannot read', 'undefined', 'reading'];
    const containsIndicator = expectedSubstrings.some(substr => msg.includes(substr));
    expect(containsIndicator).toBe(true);

    // Additionally check that we have at least one console error recorded (some browsers report the same error to console)
    const consoleErrs = sim.getConsoleErrors();
    // At minimum one console error or one page error should exist for this edge case
    expect(sim.getPageErrors().length).toBeGreaterThanOrEqual(1);

    // It's acceptable if console errors are zero (some runtimes only fire pageerror). If there are console errors, ensure they mention the problem.
    if (consoleErrs.length > 0) {
      const anyRelevant = consoleErrs.some(e => {
        const t = e.text || '';
        return /TypeError|forEach|Cannot read|undefined/.test(t);
      });
      expect(anyRelevant).toBe(true);
    }
  });

  // Validate that the FSM does not implicitly call undefined entry actions like renderPage() at load
  test('FSM entry action check: renderPage() is not invoked automatically (no ReferenceError on load)', async ({ page }) => {
    const sim5 = new SchedulingPage(page);
    await sim.goto();

    // If the page had attempted to call a missing function renderPage(), a ReferenceError would appear in page errors.
    // Confirm no such ReferenceError occurred during initial load.
    const errors = sim.getPageErrors();
    const hasReferenceError = errors.some(e => {
      const m = e.message || '';
      return /ReferenceError|renderPage/.test(m);
    });
    // We expect renderPage not to be called, therefore there should be no ReferenceError about it.
    expect(hasReferenceError).toBe(false);

    // Also ensure other critical runtime errors did not occur on initial render
    const otherErrs = errors.length;
    expect(otherErrs).toBe(0);
  });
});