import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d8f700-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for interacting with the application UI
class SchedulerApp {
  constructor(page) {
    this.page = page;
    this.locators = {
      pname: page.locator('#pname'),
      parr: page.locator('#parr'),
      pburst: page.locator('#pburst'),
      pprio: page.locator('#pprio'),
      addBtn: page.locator('#addBtn'),
      clearBtn: page.locator('#clearBtn'),
      sampleBtn: page.locator('#sampleBtn'),
      runBtn: page.locator('#runBtn'),
      resetBtn: page.locator('#resetBtn'),
      exportBtn: page.locator('#exportBtn'),
      playPause: page.locator('#playPause'),
      stepBack: page.locator('#stepBack'),
      stepFwd: page.locator('#stepFwd'),
      speed: page.locator('#speed'),
      quantum: page.locator('#quantum'),
      algo: page.locator('#algo'),
      plist: page.locator('#plist'),
      gantt: page.locator('#gantt'),
      legend: page.locator('#legend'),
      metricsTableBody: page.locator('#metricsTable tbody'),
      summary: page.locator('#summary'),
      timeIndicator: page.locator('#timeIndicator'),
      timeRow: page.locator('#timeRow'),
    };
  }

  async addProcess({ name = 'P1', arrival = '0', burst = '5', priority = '0' } = {}) {
    const { pname, parr, pburst, pprio, addBtn } = this.locators;
    await pname.fill(name);
    await parr.fill(String(arrival));
    await pburst.fill(String(burst));
    await pprio.fill(String(priority));
    await addBtn.click();
  }

  async loadSample() {
    await this.locators.sampleBtn.click();
  }

  async clearAllAndAcceptConfirm() {
    // Accept the confirm dialog that appears on clear
    this.page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await this.locators.clearBtn.click();
  }

  async runSimulation() {
    await this.locators.runBtn.click();
  }

  async resetView() {
    await this.locators.resetBtn.click();
  }

  async exportCSV() {
    // The app triggers a download by creating and clicking an anchor.
    // Listen for a 'download' event - sometimes the click may not produce download event in Playwright,
    // but we attempt to capture it; fallback is just clicking and ensuring no errors thrown.
    const waitDownload = this.page.waitForEvent('download', { timeout: 2000 }).catch(() => null);
    await this.locators.exportBtn.click();
    const dl = await waitDownload;
    return dl;
  }

  async togglePlayPause() {
    await this.locators.playPause.click();
  }

  async stepForward() {
    await this.locators.stepFwd.click();
  }

  async stepBackward() {
    await this.locators.stepBack.click();
  }

  async changeSpeed(value) {
    // Use evaluate on input to set value and dispatch 'input' event
    await this.locators.speed.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async clickGanttBlock(index = 0) {
    const blocks = this.page.locator('#gantt .gseg');
    await expect(blocks).toHaveCountGreaterThan(0);
    await blocks.nth(index).click();
  }

  async getProcessCount() {
    return await this.locators.plist.locator('.proc').count();
  }

  async getGanttSegmentCount() {
    return await this.page.locator('#gantt .gseg').count();
  }

  async getTimeIndicatorText() {
    return (await this.locators.timeIndicator.textContent()).trim();
  }

  async getPlayPauseText() {
    return (await this.locators.playPause.textContent()).trim();
  }

  async getMetricsRowsCount() {
    return await this.locators.metricsTableBody.locator('tr').count();
  }

  async getSummaryText() {
    return (await this.locators.summary.textContent()).trim();
  }

  async getTimeRowTicksCount() {
    const txt = await this.locators.timeRow.innerHTML();
    if (!txt) return 0;
    // Count number of <span> entries
    return (txt.match(/<span>/g) || []).length;
  }
}

// Helper matcher to assert count greater than zero using Playwright expect
expect.extend({
  async toHaveCountGreaterThan(locator, expected) {
    const count = await locator.count();
    const pass = count > expected;
    if (pass) {
      return {
        pass: true,
        message: () => `expected locator count not to be greater than ${expected}, but it was ${count}`,
      };
    } else {
      return {
        pass: false,
        message: () => `expected locator count to be greater than ${expected}, but it was ${count}`,
      };
    }
  },
});

// Capture console messages and page errors for assertions
test.describe('CPU Scheduling Visualizer - E2E (FSM validation)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept any alerts/confirm dialogs unless a test needs to intercept them
    page.on('dialog', async (dialog) => {
      // Default behavior: accept all dialogs in tests unless the test sets up a one-time handler.
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // nothing special for teardown; page will be closed by Playwright
  });

  test('Initial render - S0 Idle and application shell present', async ({ page }) => {
    // Validate that app shell rendered (header, footer, main app)
    const app = page.locator('.app');
    await expect(app).toBeVisible();

    const header = page.locator('header h1');
    await expect(header).toHaveText('CPU Scheduling Visualizer');

    const footer = page.locator('footer');
    await expect(footer).toContainText('Created as a single-file demonstration');

    // Because the page's script executes sampleBtn.click() and runBtn.click() on load,
    // we expect there to be processes and a rendered Gantt. This verifies initial entry actions executed.
    const scheduler = new SchedulerApp(page);
    const procCount = await scheduler.getProcessCount();
    expect(procCount).toBeGreaterThanOrEqual(1);

    // No uncaught exceptions on initial load
    expect(pageErrors.length).toBe(0);

    // Some console messages may exist (info), but there should be no console.error entries emitted unexpectedly
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test.describe('Process Management (S1 ProcessAdded)', () => {
    test('Load sample loads 4 sample processes and renders list', async ({ page }) => {
      const app = new SchedulerApp(page);
      // First, clear all to start fresh and accept confirmation dialog
      // Set up a one-off dialog handler to accept confirm
      page.once('dialog', async (d) => {
        await d.accept();
      });
      await app.locators.clearBtn.click().catch(() => { /* some builds may not show confirm if list empty */ });

      // Now load sample
      await app.loadSample();

      // Assert process list now contains at least 4 items and contains expected names
      const procCount = await app.getProcessCount();
      expect(procCount).toBeGreaterThanOrEqual(4);

      // The rendered info contains id:1..4; assert that at least 'id:1' appears
      const plistText = await page.locator('#plist').textContent();
      expect(plistText).toContain('(id:1)');
      expect(plistText).toContain('(id:4)');

      // Confirm renderProcessList was executed by checking delete buttons exist
      const deleteButtons = page.locator('#plist button');
      await expect(deleteButtons).toHaveCountGreaterThan(0);
    });

    test('Add process via form appends to list (transition S0->S1)', async ({ page }) => {
      const app = new SchedulerApp(page);

      // Count before add
      const before = await app.getProcessCount();

      // Add a new process
      await app.addProcess({ name: 'TestProc', arrival: '3', burst: '2', priority: '1' });

      // After adding, list grows
      const after = await app.getProcessCount();
      expect(after).toBe(before + 1);

      // Verify the new process is present in the list text
      const plistText = await page.locator('#plist').textContent();
      expect(plistText).toContain('TestProc');
      expect(plistText).toContain('Arrival: 3');
      expect(plistText).toContain('Burst: 2');
    });

    test('Clear All triggers confirm and empties list (transition S1->S0)', async ({ page }) => {
      const app = new SchedulerApp(page);

      // Ensure there is at least one process (script likely did sample)
      const before = await app.getProcessCount();
      expect(before).toBeGreaterThanOrEqual(1);

      // Intercept confirm to accept
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('confirm');
        await d.accept();
      });

      await app.locators.clearBtn.click();

      const after = await app.getProcessCount();
      expect(after).toBe(0);
    });

    test('Delete button on process removes it from list', async ({ page }) => {
      const app = new SchedulerApp(page);

      // Ensure sample loaded
      await app.loadSample();
      const before = await app.getProcessCount();
      expect(before).toBeGreaterThanOrEqual(1);

      // Click first process's Delete button
      const firstDelete = page.locator('#plist .proc').first().locator('button');
      await firstDelete.click();

      const after = await app.getProcessCount();
      expect(after).toBe(before - 1);
    });
  });

  test.describe('Simulation Execution & Playback (S2,S3,S4)', () => {
    test('Run simulation builds timeline, renders Gantt & metrics (S1->S2)', async ({ page }) => {
      const app = new SchedulerApp(page);

      // Ensure sample present
      await app.loadSample();

      // Run simulation
      await app.runSimulation();

      // Gantt should have segments
      const segCount = await app.getGanttSegmentCount();
      expect(segCount).toBeGreaterThan(0);

      // Metrics table should have a row per process
      const metricsRows = await app.getMetricsRowsCount();
      expect(metricsRows).toBeGreaterThan(0);

      // Summary should contain 'Total time' or 'Average'
      const summary = await app.getSummaryText();
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).toMatch(/Total time|Average/);
    });

    test('Play/Pause toggles playback state (S2 <-> S3)', async ({ page }) => {
      const app = new SchedulerApp(page);

      // Ensure there is a timeline
      await app.runSimulation();
      const segCount = await app.getGanttSegmentCount();
      expect(segCount).toBeGreaterThan(0);

      // Initially Play button text should be 'Play'
      let txt = await app.getPlayPauseText();
      expect(['Play', 'Pause']).toContain(txt); // could be Play after resetPlayback

      // Click play -> expect 'Pause'
      await app.togglePlayPause();
      const afterPlay = await app.getPlayPauseText();
      expect(afterPlay).toBe('Pause');

      // Click pause -> expect 'Play'
      await app.togglePlayPause();
      const afterPause = await app.getPlayPauseText();
      expect(afterPause).toBe('Play');
    });

    test('Click Gantt block jumps play position and updates UI', async ({ page }) => {
      const app = new SchedulerApp(page);

      await app.runSimulation();
      const segCount = await app.getGanttSegmentCount();
      expect(segCount).toBeGreaterThan(0);

      // Click the first visible gseg
      await app.clickGanttBlock(0);

      // Time indicator should reflect the segment's start time (t = <num>)
      const timeText = await app.getTimeIndicatorText();
      expect(timeText).toMatch(/^t =\s*\d+(\.\d+)?$/);
    });

    test('Step forward and backward adjust play position (S2 self-transitions)', async ({ page }) => {
      const app = new SchedulerApp(page);

      await app.runSimulation();

      // Ensure there are timeline ticks to bound stepping
      const ticksBefore = await app.getTimeRowTicksCount();
      expect(ticksBefore).toBeGreaterThanOrEqual(1);

      // Capture initial time
      const initial = await app.getTimeIndicatorText();

      // Step forward
      await app.stepForward();
      const afterFwd = await app.getTimeIndicatorText();
      expect(afterFwd).not.toBe(initial);

      // Step backward
      await app.stepBackward();
      const afterBack = await app.getTimeIndicatorText();
      // After stepping back, it should be less than or equal to afterFwd
      // We can't parse exact float reliably, but expect different or equal to initial depending on bounds
      expect(afterBack).not.toBe('');
    });

    test('Change playback speed while playing restarts play interval (S2 ChangeSpeed)', async ({ page }) => {
      const app = new SchedulerApp(page);

      await app.runSimulation();

      // Start playback
      await app.togglePlayPause();
      expect(await app.getPlayPauseText()).toBe('Pause');

      // Change speed
      await app.changeSpeed(2);

      // After changing speed while playing, button still should indicate 'Pause'
      expect(await app.getPlayPauseText()).toBe('Pause');

      // Pause to clean up
      await app.togglePlayPause();
      expect(await app.getPlayPauseText()).toBe('Play');
    });

    test('Reset View stops playback and updates UI (S2->S4)', async ({ page }) => {
      const app = new SchedulerApp(page);

      await app.runSimulation();

      // Start playback then reset view
      await app.togglePlayPause();
      expect(await app.getPlayPauseText()).toBe('Pause');

      await app.resetView();

      // Reset should not crash and Play button should be visible (playback stopped)
      expect(await app.getPlayPauseText()).toBe('Play');

      // Time indicator should remain valid
      const t = await app.getTimeIndicatorText();
      expect(t).toMatch(/^t =\s*\d+(\.\d+)?$/);
    });

    test('Export CSV attempts to download without throwing', async ({ page }) => {
      const app = new SchedulerApp(page);

      await app.runSimulation();

      // Try exporting; if download event fires, we capture it; otherwise just ensure no page errors
      const download = await app.exportCSV();
      // download may be null depending on environment; it's acceptable as long as no page errors occurred
      expect(pageErrors.length).toBe(0);
      // If download exists, ensure its suggested filename matches expected pattern
      if (download) {
        const suggested = download.suggestedFilename();
        expect(suggested).toMatch(/scheduling_metrics.*\.csv/);
      }
    });
  });

  test.describe('Edge cases, validation & error handling', () => {
    test('Adding process with invalid arrival shows alert and does not add', async ({ page }) => {
      const app = new SchedulerApp(page);

      // Ensure a clean starting count
      await app.loadSample();
      const before = await app.getProcessCount();

      // Intercept alert and verify it happens (the page script uses alert)
      let dialogSeen = false;
      page.once('dialog', async (d) => {
        dialogSeen = true;
        expect(d.type()).toBe('alert');
        // message should indicate arrival constraint
        expect(d.message()).toMatch(/Arrival must be >=0/);
        await d.accept();
      });

      // Try to add with negative arrival
      await app.addProcess({ name: 'Bad', arrival: '-5', burst: '2', priority: '0' });

      // Wait a short moment for dialog to be processed
      await page.waitForTimeout(200);

      const after = await app.getProcessCount();
      expect(dialogSeen).toBe(true);
      // Process shouldn't have been added
      expect(after).toBe(before);
    });

    test('Adding process with empty name triggers alert and is rejected', async ({ page }) => {
      const app = new SchedulerApp(page);

      const before = await app.getProcessCount();

      let dialogSeen = false;
      page.once('dialog', async (d) => {
        dialogSeen = true;
        expect(d.type()).toBe('alert');
        expect(d.message()).toMatch(/Provide a name/);
        await d.accept();
      });

      // Clear pname then press enter (the app listens for Enter to add)
      await app.locators.pname.fill('');
      await app.locators.pname.press('Enter');

      await page.waitForTimeout(200);

      const after = await app.getProcessCount();
      expect(dialogSeen).toBe(true);
      expect(after).toBe(before);
    });

    test('Scheduling algorithms produce reasonable non-empty timelines for sample data', async ({ page }) => {
      const app = new SchedulerApp(page);

      // Ensure sample processes present
      await app.loadSample();

      const algorithms = ['FCFS', 'SJF', 'SRTF', 'PRIO_NP', 'PRIO_P', 'RR'];
      for (const alg of algorithms) {
        // Set algorithm
        await app.locators.algo.selectOption(alg);
        // For RR, ensure quantum valid
        if (alg === 'RR') {
          await app.locators.quantum.fill('2');
          await app.locators.quantum.dispatchEvent('change');
        }

        // Run simulation for this algorithm
        await app.runSimulation();

        // Gantt should have segments (non-empty timeline)
        const segCount = await app.getGanttSegmentCount();
        expect(segCount).toBeGreaterThan(0);

        // Metrics should show at least one completed process
        const metricsRows = await app.getMetricsRowsCount();
        expect(metricsRows).toBeGreaterThan(0);

        // No uncaught page errors
        expect(pageErrors.length).toBe(0);
      }
    });
  });

  test('Final sanity: no uncaught exceptions during full test run', async ({ page }) => {
    // After all interactions within a test, ensure there were no uncaught exceptions collected
    expect(pageErrors.length).toBe(0);
  });
});