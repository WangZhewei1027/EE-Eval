import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2add0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Helper Page Object encapsulating common selectors and operations
class CpuSchedulingPage {
  constructor(page) {
    this.page = page;
    this.algorithm = page.locator('#algorithm');
    this.quantum = page.locator('#quantum');
    this.quantumLabel = page.locator('#quantumLabel');
    this.processInput = page.locator('#processInput');
    this.runBtn = page.locator('#runBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.resultsDiv = page.locator('#results');
    this.resultTableBody = page.locator('#resultTable tbody');
    this.avgWaitingTime = page.locator('#avgWaitingTime');
    this.avgTurnaroundTime = page.locator('#avgTurnaroundTime');
    this.ganttChart = page.locator('#ganttChart');
    this.timeline = page.locator('#timeline');
    this.priorityCols = page.locator('.priorityCol');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async selectAlgorithm(value) {
    await this.algorithm.selectOption(value);
  }

  async setQuantum(val) {
    await this.quantum.fill(String(val));
  }

  async setProcesses(text) {
    await this.processInput.fill(text);
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }
}

test.describe('CPU Scheduling Demonstration - FSM and UI tests', () => {
  // Collect console and page errors to assert absence of runtime Reference/Type/Syntax errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // collect console messages with text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // collect page errors (uncaught exceptions)
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally; individual tests handle state
  });

  test.describe('Initial Idle State (S0_Idle) and page render', () => {
    test('should render the main heading and have results hidden on load', async ({ page }) => {
      // This test validates S0_Idle entry: renderPage() equivalent - initial DOM correctness
      const app = new CpuSchedulingPage(page);
      await app.goto();

      // Check heading exists
      await expect(page.locator('h1')).toHaveText('CPU Scheduling Algorithms Demonstration');

      // Results should be hidden initially
      await expect(app.resultsDiv).toHaveCSS('display', 'none');

      // Quantum input and label hidden initially
      await expect(app.quantum).toHaveJSProperty('style');
      const quantumStyle = await page.evaluate(() => document.getElementById('quantum').style.display);
      const quantumLabelStyle = await page.evaluate(() => document.getElementById('quantumLabel').style.display);
      expect(quantumStyle === 'none' || quantumStyle === '').toBeTruthy(); // style may be '' or 'none' depending
      expect(quantumLabelStyle === 'none' || quantumLabelStyle === '').toBeTruthy();

      // Ensure no runtime ReferenceError / TypeError / SyntaxError were logged
      // (capture console/pageerror events and assert absence)
      const errorMsgs = consoleMessages.concat(pageErrors.map(e => ({ type: 'pageerror', text: String(e) })));
      const problematic = errorMsgs.filter(m =>
        /ReferenceError|TypeError|SyntaxError/.test(m.text)
      );
      expect(problematic.length).toBe(0);
    });
  });

  test.describe('Algorithm change events and UI effects (AlgorithmChange)', () => {
    test('selecting Round Robin shows quantum input; selecting Priority shows priority column', async ({ page }) => {
      const app = new CpuSchedulingPage(page);
      await app.goto();

      // Initially priority column hidden
      await expect(app.priorityCols.first()).toHaveCSS('display', 'none');

      // Select Round Robin and verify quantum input and label become visible
      await app.selectAlgorithm('rr');
      // The implementation listens to change event and toggles styles synchronously
      await expect(app.quantum).toHaveJSProperty('style');
      const quantumStyleAfter = await page.evaluate(() => document.getElementById('quantum').style.display);
      const quantumLabelStyleAfter = await page.evaluate(() => document.getElementById('quantumLabel').style.display);
      expect(quantumStyleAfter === 'inline-block').toBeTruthy();
      expect(quantumLabelStyleAfter === 'inline-block').toBeTruthy();

      // Select non-priority algorithm -> priority column hidden
      await app.selectAlgorithm('fcfs');
      const priorityDisplayFcfs = await page.evaluate(() => {
        const el = document.querySelector('.priorityCol');
        return el ? el.style.display : null;
      });
      expect(priorityDisplayFcfs === 'none').toBeTruthy();

      // Select priority algorithm and ensure priority column is shown
      await app.selectAlgorithm('priority');
      const priorityDisplay = await page.evaluate(() => {
        const el = document.querySelector('.priorityCol');
        return el ? el.style.display : null;
      });
      expect(priorityDisplay !== 'none').toBeTruthy();

      // Check for runtime console/page errors during algorithm changes
      const errorMsgs = consoleMessages.concat(pageErrors.map(e => ({ type: 'pageerror', text: String(e) })));
      const problematic = errorMsgs.filter(m =>
        /ReferenceError|TypeError|SyntaxError/.test(m.text)
      );
      expect(problematic.length).toBe(0);
    });
  });

  test.describe('Run Simulation and Results (Transitions S0->S1->S2)', () => {
    test('FCFS simulation: runs, displays results table, gantt chart and averages', async ({ page }) => {
      // This test follows the transition: Idle -> SimulationRunning -> ResultsDisplayed
      const app = new CpuSchedulingPage(page);
      await app.goto();

      // Provide a simple process list for FCFS
      const processes = `P1 0 5
P2 1 3
P3 2 2`;
      await app.setProcesses(processes);

      // Ensure FCFS is selected
      await app.selectAlgorithm('fcfs');

      // Click run simulation
      await app.clickRun();

      // Results div should be visible (expected_observables)
      await expect(app.resultsDiv).toHaveCSS('display', 'block');

      // Table must have 3 rows in tbody
      await expect(app.resultTableBody.locator('tr')).toHaveCount(3);

      // Validate that process ids appear in table cells
      await expect(app.resultTableBody).toContainText('P1');
      await expect(app.resultTableBody).toContainText('P2');
      await expect(app.resultTableBody).toContainText('P3');

      // Average waiting/turnaround times should be populated
      const avgWait = (await app.avgWaitingTime.textContent()).trim();
      const avgTurn = (await app.avgTurnaroundTime.textContent()).trim();
      expect(avgWait.length).toBeGreaterThan(0);
      expect(avgTurn.length).toBeGreaterThan(0);
      // They should be numeric strings
      expect(/^[0-9]+(\.[0-9]{1,2})?$/.test(avgWait)).toBeTruthy();
      expect(/^[0-9]+(\.[0-9]{1,2})?$/.test(avgTurn)).toBeTruthy();

      // Gantt chart should have child blocks equal or greater than processes (non-preemptive: equal)
      const ganttChildren = await app.ganttChart.locator('.gantt-block').count();
      expect(ganttChildren).toBeGreaterThanOrEqual(1);
      expect(ganttChildren).toBeLessThanOrEqual(10); // sanity upper bound

      // Timeline should have markers (at least start and end)
      const timelineChildren = await app.timeline.locator('div').count();
      expect(timelineChildren).toBeGreaterThanOrEqual(2);

      // Ensure no runtime ReferenceError/TypeError/SyntaxError occurred
      const errorMsgs = consoleMessages.concat(pageErrors.map(e => ({ type: 'pageerror', text: String(e) })));
      const problematic = errorMsgs.filter(m =>
        /ReferenceError|TypeError|SyntaxError/.test(m.text)
      );
      expect(problematic.length).toBe(0);
    });

    test('Round Robin with invalid (zero) quantum shows alert and does not show results', async ({ page }) => {
      const app = new CpuSchedulingPage(page);
      await app.goto();

      // Choose RR and set quantum to zero to trigger validation
      await app.selectAlgorithm('rr');
      await app.setQuantum(0);

      // Provide processes
      await app.setProcesses(`P1 0 4
P2 1 3`);

      // Expect an alert dialog when clicking run
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await app.clickRun();

      // dialog should have been shown with expected message
      expect(dialogMessage).toContain('Please enter a valid time quantum');

      // Results should not be visible
      await expect(app.resultsDiv).toHaveCSS('display', 'none');

      // Also assert no uncaught page errors (console alerts are not page errors)
      const problematic = consoleMessages.concat(pageErrors.map(e => ({ text: String(e) })))
        .filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text));
      expect(problematic.length).toBe(0);
    });

    test('Priority non-preemptive without priorities triggers validation alert', async ({ page }) => {
      const app = new CpuSchedulingPage(page);
      await app.goto();

      // Select priority scheduling
      await app.selectAlgorithm('priority');

      // Provide processes without priority field (should trigger showError inside priorityNonPreemptive)
      await app.setProcesses(`P1 0 4
P2 1 3`);

      // Listen for alert
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await app.clickRun();

      // Expect alert about priority value required for first process considered
      expect(dialogMessage).toContain('Priority value required for process');

      // Results should not be visible
      await expect(app.resultsDiv).toHaveCSS('display', 'none');

      // No runtime Reference/Type/Syntax errors
      const problematic = consoleMessages.concat(pageErrors.map(e => ({ text: String(e) })))
        .filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text));
      expect(problematic.length).toBe(0);
    });
  });

  test.describe('Reset functionality and transitions (S2->S3->S0)', () => {
    test('Reset clears inputs, hides results, and returns to idle', async ({ page }) => {
      const app = new CpuSchedulingPage(page);
      await app.goto();

      // Populate inputs and run a small simulation to populate results
      await app.setProcesses(`P1 0 2
P2 1 1`);
      await app.selectAlgorithm('fcfs');
      await app.clickRun();
      await expect(app.resultsDiv).toHaveCSS('display', 'block');
      await expect(app.resultTableBody.locator('tr')).toHaveCount(2);

      // Click reset (S2_ResultsDisplayed -> S3_Reset)
      await app.clickReset();

      // After reset, resultsDiv should be hidden (expected_observables)
      await expect(app.resultsDiv).toHaveCSS('display', 'none');

      // processInput should be cleared (S3_Reset -> S0_Idle)
      const processValue = await app.processInput.inputValue();
      expect(processValue).toBe('');

      // Table cleared
      await expect(app.resultTableBody.locator('tr')).toHaveCount(0);

      // Gantt chart cleared
      await expect(app.ganttChart.locator('.gantt-block')).toHaveCount(0);

      // No runtime Reference/Type/Syntax errors
      const problematic = consoleMessages.concat(pageErrors.map(e => ({ text: String(e) })))
        .filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text));
      expect(problematic.length).toBe(0);
    });
  });

  test.describe('Edge cases and parsing errors', () => {
    test('Invalid process line shows alert and prevents simulation', async ({ page }) => {
      const app = new CpuSchedulingPage(page);
      await app.goto();

      // Provide malformed process input (missing burst time in second line)
      const badInput = `P1 0 3
P2 1`; // second line invalid

      await app.setProcesses(badInput);
      await app.selectAlgorithm('fcfs');

      // Listen for dialog alert
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await app.clickRun();

      expect(dialogMessage).toContain('is invalid. Expected format');

      // Results must remain hidden
      await expect(app.resultsDiv).toHaveCSS('display', 'none');

      // No uncaught Reference/Type/Syntax errors
      const problematic = consoleMessages.concat(pageErrors.map(e => ({ text: String(e) })))
        .filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text));
      expect(problematic.length).toBe(0);
    });

    test('Negative arrival time or non-numeric burst triggers validation alert', async ({ page }) => {
      const app = new CpuSchedulingPage(page);
      await app.goto();

      // Negative arrival
      await app.setProcesses(`P1 -1 4`);
      await app.selectAlgorithm('fcfs');

      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await app.clickRun();
      expect(dialogMessage).toContain('Invalid arrival time');

      // Now non-numeric burst
      await app.setProcesses(`P1 0 abc`);
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await app.clickRun();
      expect(dialogMessage).toContain('Invalid burst time');

      // No uncaught Reference/Type/Syntax errors
      const problematic = consoleMessages.concat(pageErrors.map(e => ({ text: String(e) })))
        .filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text));
      expect(problematic.length).toBe(0);
    });
  });
});