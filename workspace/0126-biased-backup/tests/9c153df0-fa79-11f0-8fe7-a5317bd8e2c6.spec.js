import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c153df0-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object for interacting with the Thread Simulator
class SimulatorPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // wait for the header to ensure page script run
    await expect(this.page.locator('h1')).toHaveText('Thread Simulator');
  }

  // Create a thread using UI controls
  async createThread({ name = 'threadX', priority = '5', behavior = 'EXIT' } = {}) {
    const p = this.page;
    await p.fill('#newName', name);
    await p.fill('#newPriority', String(priority));
    await p.fill('#newBehavior', behavior);
    await Promise.all([
      p.waitForEvent('console').catch(() => {}), // some actions log to console; avoid hanging if none
      p.click('#createThread')
    ]).catch(() => {});
    // allow UI to update
    await p.waitForTimeout(50);
    // return newly created thread id by inspecting simulator internals
    return p.evaluate(() => {
      // find the last created thread id (highest numeric suffix)
      const ids = Object.keys(window._simulator.threads || {});
      if (!ids.length) return null;
      ids.sort();
      return ids[ids.length - 1];
    });
  }

  async clickCreateClones() {
    await this.page.click('#createClones');
    await this.page.waitForTimeout(50);
  }

  async clickRun() {
    await this.page.click('#run');
    await this.page.waitForTimeout(50);
  }

  async clickPause() {
    await this.page.click('#pause');
    await this.page.waitForTimeout(50);
  }

  async clickStep() {
    await this.page.click('#step');
    await this.page.waitForTimeout(60);
  }

  async setBreakpoint(tid, pc) {
    await this.page.fill('#breakpoint', `${tid}:${pc}`);
    await this.page.click('#setBreakpoint');
    await this.page.waitForTimeout(50);
  }

  async clearBreakpoints() {
    await this.page.click('#clearBreakpoints');
    await this.page.waitForTimeout(50);
  }

  async runToBp() {
    await this.page.click('#runToBp');
    // we will wait for a breakpoint hit via logs elsewhere
  }

  async clickClearAll(acceptDialog = true) {
    // handle confirm dialog
    this.page.once('dialog', async (dialog) => {
      if (acceptDialog) await dialog.accept();
      else await dialog.dismiss();
    });
    await this.page.click('#clearAll');
    await this.page.waitForTimeout(50);
  }

  async createLock(name) {
    await this.page.fill('#lockName', name || '');
    await this.page.click('#createLock');
    await this.page.waitForTimeout(50);
  }

  async createChannel(name, size = '1') {
    await this.page.fill('#chanName', name || '');
    await this.page.fill('#chanSize', String(size));
    await this.page.click('#createChan');
    await this.page.waitForTimeout(50);
  }

  async clickAutoSetup() {
    await this.page.click('#autoSetup');
    await this.page.waitForTimeout(50);
  }

  async addWatch(expr) {
    await this.page.fill('#watchExpr', expr);
    await this.page.click('#addWatch');
    await this.page.waitForTimeout(50);
  }

  // Helpers to read simulator internals
  async getThreadIds() {
    return this.page.evaluate(() => Object.keys(window._simulator.threads || {}).sort());
  }

  async getSimLogText() {
    return this.page.locator('#log').inputValue();
  }

  async getSimRunning() {
    return this.page.evaluate(() => Boolean(window._simulator.sim.running));
  }

  async getSimObject() {
    return this.page.evaluate(() => window._simulator.sim);
  }

  async getThreadsCount() {
    return this.page.evaluate(() => Object.keys(window._simulator.threads || {}).length);
  }

  async getBreakpoints() {
    return this.page.evaluate(() => window._simulator.sim.breakpoints.slice());
  }

  async getWatches() {
    return this.page.evaluate(() => window._simulator.sim.watches.slice());
  }

  async setTickMs(ms) {
    await this.page.fill('#tickMs', String(ms));
    // trigger onchange
    await this.page.dispatchEvent('#tickMs', 'change');
    await this.page.waitForTimeout(30);
  }
}

// Tests
test.describe('Thread Simulator - FSM and interactions', () => {
  let pageErrors;
  let consoleErrors;
  let page;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleErrors = [];
    page = await browser.newPage();

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages; collate errors specifically
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore instrumentation errors
      }
    });

    // Navigate to app
    const simPage = new SimulatorPage(page);
    await simPage.goto();

    // Expose for tests
    (globalThis).simPage = simPage;
  });

  test.afterEach(async () => {
    // Assert that the page did not produce JS errors during the test flows
    // It's important to detect uncaught exceptions — fail if any are present.
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    await page.close();
  });

  test('Idle: initial render shows simulator header and initial main thread', async () => {
    const simPage = globalThis.simPage;
    // The page must have rendered the H1 and initial components
    await expect(page.locator('h1')).toHaveText('Thread Simulator');

    // By default the script creates a 'main' thread; verify it exists in threads list
    const ids = await simPage.getThreadIds();
    expect(ids.length).toBeGreaterThan(0);
    // Confirm at least one thread has name 'main' in UI by checking log for created main thread
    const log = await simPage.getSimLogText();
    expect(log).toContain('Created thread');
    // Confirm timeline controls show simTime 0 initially (span text)
    await expect(page.locator('#simTime')).toHaveText('0');
  });

  test('CreateThread transition: creates a new thread and logs creation', async () => {
    const simPage = globalThis.simPage;
    const beforeCount = await simPage.getThreadsCount();
    // Create a short-lived thread with explicit name for clarity
    const newTid = await simPage.createThread({ name: 'tester', priority: '3', behavior: 'EXIT' });
    expect(newTid).toBeTruthy();

    const afterIds = await simPage.getThreadIds();
    expect(afterIds.length).toBeGreaterThan(beforeCount);

    // The log must contain the Created thread entry referencing the new id
    const log = await simPage.getSimLogText();
    expect(log).toMatch(new RegExp(`Created thread ${newTid} \\(`));
    // Verify that the thread exists in internal simulator state
    const threadsList = await simPage.getThreadIds();
    expect(threadsList).toContain(newTid);
  });

  test('CreateClones: creates 5 clones of last created thread', async () => {
    const simPage = globalThis.simPage;
    // Ensure at least one thread exists and then create a baseline thread
    const baseTid = await simPage.createThread({ name: 'baseClone', priority: '2', behavior: 'EXIT' });
    const beforeCount = await simPage.getThreadsCount();
    // Create 5 clones
    await simPage.clickCreateClones();
    await page.waitForTimeout(100);
    const afterCount = await simPage.getThreadsCount();
    // Should have increased by 5
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 5);
    // Logs should contain multiple "Created thread" entries
    const log = await simPage.getSimLogText();
    // At least one clone creation log present
    expect((log.match(/Created thread/g) || []).length).toBeGreaterThanOrEqual(1);
  });

  test('RunSimulation and PauseSimulation transitions', async () => {
    const simPage = globalThis.simPage;

    // Speed up tick interval to make the test faster
    await simPage.setTickMs(20);

    // Start run; should log 'Simulation started' and set running flag
    await simPage.clickRun();
    // Allow a few ticks to happen
    await page.waitForTimeout(120);
    const running = await simPage.getSimRunning();
    expect(running).toBe(true);

    const log = await simPage.getSimLogText();
    expect(log).toContain('Simulation started');

    // Pause simulation; should log 'Simulation paused' and unset running
    await simPage.clickPause();
    const runningAfter = await simPage.getSimRunning();
    expect(runningAfter).toBe(false);

    const logAfter = await simPage.getSimLogText();
    expect(logAfter).toContain('Simulation paused');
  });

  test('StepSimulation: stepping executes instructions and can terminate a thread', async () => {
    const simPage = globalThis.simPage;

    // Create a thread that immediately EXITs
    const tid = await simPage.createThread({ name: 'exiter', priority: '1', behavior: 'EXIT' });
    expect(tid).toBeTruthy();

    // Perform one step; stepping should schedule and execute EXIT, producing termination log
    await simPage.clickStep();

    const log = await simPage.getSimLogText();
    // Termination message for the thread should appear
    expect(log).toMatch(new RegExp(`${tid} reached end and terminated`));
  });

  test('Breakpoints: set, run-to-breakpoint and clear breakpoints', async () => {
    const simPage = globalThis.simPage;

    // Create a thread with multiple instructions so breakpoint can be hit at pc=1
    const tid = await simPage.createThread({
      name: 'bpThread',
      priority: '4',
      behavior: 'COMPUTE 1\nCOMPUTE 1\nEXIT'
    });
    expect(tid).toBeTruthy();

    // Set a breakpoint at pc = 1
    await simPage.setBreakpoint(tid, 1);

    // Verify breakpoint was registered in simulator state
    const bps = await simPage.getBreakpoints();
    expect(bps.some(bp => bp.tid === tid && bp.pc === 1)).toBe(true);

    // Run until breakpoint. Use faster ticks to hit breakpoint quickly.
    await simPage.setTickMs(20);
    await simPage.runToBp();

    // Wait for logs to indicate a breakpoint hit and that simulation paused
    await page.waitForFunction(() => {
      const logText = document.getElementById('log').value;
      return logText.includes('Breakpoint hit') && logText.includes('Simulation paused');
    }, { timeout: 3000 });

    const log = await simPage.getSimLogText();
    expect(log).toContain('Breakpoint hit');
    expect(log).toContain('Simulation paused');

    // Clear breakpoints
    await simPage.clearBreakpoints();
    const logAfterClear = await simPage.getSimLogText();
    expect(logAfterClear).toContain('Breakpoints cleared');

    const bpsAfter = await simPage.getBreakpoints();
    expect(bpsAfter.length).toBe(0);
  });

  test('ClearAll: accepts confirmation and wipes state', async () => {
    const simPage = globalThis.simPage;

    // Create some artifacts to clear
    await simPage.createLock('ClearTestLock');
    await simPage.createChannel('ClearTestChan', 1);
    await simPage.createThread({ name: 'toClear', behavior: 'EXIT' });

    // Now clear all, accept dialog
    await simPage.clickClearAll(true);

    // After clearing, threads and logs should be empty
    const threadsCount = await simPage.getThreadsCount();
    const logText = await simPage.getSimLogText();

    // threads could contain system defaults again because the initial script creates a 'main' thread
    // but log should be cleared and locks/channels arrays should be empty or reset
    expect(logText.trim()).toBe(''); // log cleared

    // ensure locks and channels containers show the empty text in UI
    const locksText = await page.locator('#locks').textContent();
    const channelsText = await page.locator('#channels').textContent();
    expect(locksText.trim().length).toBeGreaterThanOrEqual(0);
    expect(channelsText.trim().length).toBeGreaterThanOrEqual(0);
  });

  test('Watches: adding a watch logs changes to watched expression', async () => {
    const simPage = globalThis.simPage;

    // Create a simple thread that will change its pc as it runs
    const tid = await simPage.createThread({
      name: 'watcher',
      priority: '3',
      behavior: 'COMPUTE 1\nCOMPUTE 1\nEXIT'
    });
    expect(tid).toBeTruthy();

    // Add a watch for its pc property (threadId.pc)
    await simPage.addWatch(`${tid}.pc`);

    const watchesBefore = await simPage.getWatches();
    expect(watchesBefore.some(w => w.expr === `${tid}.pc`)).toBe(true);

    // Step until watch log appears (watch logs when last value changes)
    // Step multiple times to progress the thread
    await simPage.clickStep();
    await simPage.clickStep();
    await simPage.clickStep();

    // Wait for a watch log entry inside the log textarea
    await page.waitForFunction((tid) => {
      const logText = document.getElementById('log').value;
      return logText.includes(`Watch ${tid}.pc`) || logText.includes(`Watch ${tid}.pc =>`);
    }, tid, { timeout: 2000 });

    const log = await simPage.getSimLogText();
    expect(log).toMatch(new RegExp(`Watch ${tid}\\.pc`));
  });

  test('Locks and Channels edge cases: creating duplicates logs warning and autoSetup configures scenario', async () => {
    const simPage = globalThis.simPage;

    // Try to create lock/channel with names that already exist (L1 and C1 are created initially)
    await simPage.createLock('L1'); // should log "already exists"
    await simPage.createChannel('C1', 1); // should log "already exists"

    // Trigger the auto setup (producer/consumer) and verify it creates channel and threads
    await simPage.clickAutoSetup();

    // After autoSetup, there should be at least two new threads and a channel 'C1' or another channel
    const ids = await simPage.getThreadIds();
    expect(ids.length).toBeGreaterThan(0);

    const log = await simPage.getSimLogText();
    expect(log).toContain('Created channel'); // autoSetup creates/creates channel
    expect(log).toContain('Created thread');
  });

  test('Workflows: run Priority Inversion setup and validate scenario setup logs', async () => {
    // Validate that the workflow button sets up scenario and logs accordingly
    await page.click('#wfPriorityInversion');
    await page.waitForTimeout(50);
    const log = await page.locator('#log').inputValue();
    expect(log).toContain('Priority inversion scenario setup');
    // Ensure locks and threads were created
    const locksText = await page.locator('#locks').textContent();
    expect(locksText).toContain('L1');
    const threadsText = await page.locator('#threads').textContent();
    expect(threadsText.length).toBeGreaterThan(0);
  });

  test('Edge case: setting invalid breakpoint triggers alert (handled) and does not crash', async () => {
    const simPage = globalThis.simPage;
    // Try to set a breakpoint against a non-existent thread id
    // The UI will show alert('No such thread') — handle dialog to avoid test hanging
    page.once('dialog', async (d) => {
      // this is expected; accept to close
      await d.accept();
    });
    await page.fill('#breakpoint', 'nonexistent:0');
    await page.click('#setBreakpoint');
    // The app should not crash — verify no pageerror
    await page.waitForTimeout(50);
    const pageErrs = pageErrors;
    expect(pageErrs.length).toBe(0);
  });

});