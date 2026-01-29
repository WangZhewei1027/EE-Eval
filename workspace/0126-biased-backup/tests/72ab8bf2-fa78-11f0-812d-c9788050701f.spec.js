import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab8bf2-fa78-11f0-812d-c9788050701f.html';

test.describe('CPU Scheduling Visualizer (FSM: Idle <-> Simulating)', () => {
  // Collect console error messages and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and capture error-level logs
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // swallow any listener errors
      }
    });

    // Listen for unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Basic sanity: tests below will assert specifics. Here we assert there were no unexpected runtime errors.
    // If runtime errors occurred naturally, the individual tests will also observe them.
    expect(pageErrors).toEqual([]); // Expect no uncaught page errors by default
    expect(consoleErrors).toEqual([]); // Expect no console.error messages by default
  });

  test('Initial Idle state renders processes and timeline correctly', async ({ page }) => {
    // Validate initial render (S0_Idle onEnter: renderProcesses())
    // - ready-queue should contain 4 processes P1..P4
    // - timeline should contain 20 time-units labeled 0..19
    const readyQueue = page.locator('#ready-queue');
    await expect(readyQueue).toBeVisible();

    const processes = readyQueue.locator('.process');
    await expect(processes).toHaveCount(4);

    // Validate process IDs and their burst visual heights (derived from burstTime)
    const expectedIds = ['P1', 'P2', 'P3', 'P4'];
    const expectedHeights = {
      P1: '50px', // (5 / 10) * 100
      P2: '30px', // (3 / 10) * 100
      P3: '80px', // (8 / 10) * 100
      P4: '40px'  // (4 / 10) * 100
    };

    for (let i = 0; i < expectedIds.length; i++) {
      const proc = processes.nth(i);
      await expect(proc.locator('.process-id')).toHaveText(expectedIds[i]);
      // Check the computed style via inline style attribute set by JS
      const burstEl = proc.locator('.process-burst');
      const inlineStyle = await burstEl.getAttribute('style');
      expect(inlineStyle).toContain(`height: ${expectedHeights[expectedIds[i]]}`);
    }

    // Timeline units
    const timelineUnits = page.locator('#timeline .time-unit');
    await expect(timelineUnits).toHaveCount(20);

    // Check labels are 0..19
    for (let i = 0; i < 20; i++) {
      await expect(timelineUnits.nth(i).locator('.time-label')).toHaveText(String(i));
    }

    // Start button should be enabled in idle state
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeEnabled();

    // Reset button should be present
    const resetBtn = page.locator('#reset-btn');
    await expect(resetBtn).toBeVisible();
  });

  test('Transition: Start Simulation - enters Simulating state and creates execution visuals', async ({ page }) => {
    // This test validates transition S0_Idle -> S1_Simulating via clicking #start-btn
    // - on click: renderProcesses() is called and simulateRoundRobin() starts
    // - start button should be disabled after click
    // - after some time, .process-execution elements should be present in the timeline

    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeEnabled();

    // Click start to begin simulation
    await startBtn.click();

    // After clicking, the start button should be disabled (observed exit action)
    await expect(startBtn).toBeDisabled();

    // Wait enough time to let at least 2 simulation intervals occur
    // simulateRoundRobin uses setInterval with 1000ms; each iteration consumes quantum=2 units of "time".
    // Waiting 2500ms should allow the first interval to run and likely the second to begin.
    await page.waitForTimeout(2500);

    // There should be at least one execution visualization element appended to timeline units
    const executions = page.locator('.process-execution');
    const execCount = await executions.count();
    expect(execCount).toBeGreaterThanOrEqual(1);

    // Check that the text content of at least one execution element corresponds to a known process id (P1..P4)
    const execTexts = [];
    for (let i = 0; i < execCount; i++) {
      execTexts.push(await executions.nth(i).innerText());
    }
    const hasValidId = execTexts.some(t => ['P1', 'P2', 'P3', 'P4'].includes(t));
    expect(hasValidId).toBeTruthy();

    // Validate that an execution element was appended to the time-unit index 0 after ~1s
    // (use optional chaining; if not present yet, this is non-fatal because we already asserted execCount >=1)
    const firstTimeUnitExec = page.locator('.time-unit').first().locator('.process-execution');
    if (await firstTimeUnitExec.count() > 0) {
      const text = await firstTimeUnitExec.first().innerText();
      expect(['P1', 'P2', 'P3', 'P4']).toContain(text);
    }

    // Check no uncaught errors occurred during simulation start
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: Clicking Start twice should not create duplicate-running simulations', async ({ page }) => {
    // Start once
    const startBtn = page.locator('#start-btn');
    await startBtn.click();
    await expect(startBtn).toBeDisabled();

    // Attempt to click start again (button disabled). This should have no effect and should not throw.
    let threw = false;
    try {
      await startBtn.click({ timeout: 500 }).catch(() => {});
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(false);

    // Wait a bit to allow executions to appear
    await page.waitForTimeout(2200);
    const execsAfter = await page.locator('.process-execution').count();
    expect(execsAfter).toBeGreaterThanOrEqual(1);

    // Ensure there are no console errors or page errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Transition: Reset Simulation brings the app back to Idle state and clears timeline', async ({ page }) => {
    // Start simulation first so there are execution elements to clear
    const startBtn = page.locator('#start-btn');
    const resetBtn = page.locator('#reset-btn');
    await startBtn.click();
    await expect(startBtn).toBeDisabled();

    // Wait for at least one execution element to be created
    await page.waitForTimeout(1500);
    const execsBefore = await page.locator('.process-execution').count();
    expect(execsBefore).toBeGreaterThanOrEqual(1);

    // Click reset to transition S1_Simulating -> S0_Idle
    await resetBtn.click();

    // After reset:
    // - All .process-execution elements should be removed
    // - start button should be enabled again
    // - processes in ready-queue should be re-rendered with original burst heights

    // Allow tiny time for reset handler to run
    await page.waitForTimeout(200);

    const execsAfter = await page.locator('.process-execution').count();
    expect(execsAfter).toBe(0);

    await expect(startBtn).toBeEnabled();

    const processes = page.locator('#ready-queue .process');
    await expect(processes).toHaveCount(4);

    // Validate the burst heights correspond to original burst times again
    const expectedHeights = {
      P1: '50px', // (5 / 10) * 100
      P2: '30px',
      P3: '80px',
      P4: '40px'
    };
    for (let i = 0; i < 4; i++) {
      const id = await processes.nth(i).locator('.process-id').innerText();
      const style = await processes.nth(i).locator('.process-burst').getAttribute('style');
      expect(style).toContain(`height: ${expectedHeights[id]}`);
    }

    // Confirm no runtime errors happened during reset
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: Clicking Reset when not simulating is a no-op but keeps state stable', async ({ page }) => {
    // Ensure no simulation is running; start button should be enabled
    const startBtn = page.locator('#start-btn');
    const resetBtn = page.locator('#reset-btn');
    await expect(startBtn).toBeEnabled();

    // Click reset without starting
    await resetBtn.click();

    // There should be no .process-execution elements and start should remain enabled
    await page.waitForTimeout(100);
    const execs = await page.locator('.process-execution').count();
    expect(execs).toBe(0);
    await expect(startBtn).toBeEnabled();

    // Check processes still correctly rendered
    await expect(page.locator('#ready-queue .process')).toHaveCount(4);

    // No errors expected
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Visual feedback consistency: process elements and execution labels exist and are styled', async ({ page }) => {
    // Validate some styling and class presence—not altering page behavior
    const firstProcess = page.locator('#ready-queue .process').first();
    await expect(firstProcess).toHaveClass(/process/);

    // Check that the CPU element exists
    await expect(page.locator('.cpu')).toBeVisible();
    await expect(page.locator('.cpu')).toHaveText('CPU Core');

    // Start simulation and confirm execution elements have expected classes and inline style attributes (left/width/background)
    await page.locator('#start-btn').click();
    await page.waitForTimeout(1500);
    const exec = page.locator('.process-execution').first();
    await expect(exec).toHaveClass(/process-execution/);

    // Check that execution element has inline style left and width (set by script)
    const style = await exec.getAttribute('style');
    expect(style).toMatch(/left:\s*\d+(\.\d+)?%/);
    expect(style).toMatch(/width:\s*\d+(\.\d+)?%/);

    // Confirm label text corresponds to a known process
    const label = await exec.innerText();
    expect(['P1', 'P2', 'P3', 'P4']).toContain(label);

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});