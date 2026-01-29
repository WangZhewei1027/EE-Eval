import { test, expect } from '@playwright/test';

// Test suite for Context Switching Demo (Application ID: 324e9844-fa73-11f0-a9d0-d7a1991987c6)
// The HTML app is served at:
// http://127.0.0.1:5500/workspace/0126-balanced/html/324e9844-fa73-11f0-a9d0-d7a1991987c6.html

// Page object encapsulating interactions and queries for the demo page
class ProcessPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.switchButton = page.locator('#switch-button');
    this.processesLocator = page.locator('#process-container .process');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/324e9844-fa73-11f0-a9d0-d7a1991987c6.html', { waitUntil: 'load' });
  }

  // Click the Switch Context button
  async clickSwitch() {
    await this.switchButton.click();
  }

  // Return the number of rendered process elements
  async countProcesses() {
    return await this.processesLocator.count();
  }

  // Get text content for a given process index (0-based)
  async getProcessText(index) {
    return await this.processesLocator.nth(index).innerText();
  }

  // Find which process index is currently highlighted (bolded by inline style)
  // Accepts font-weight values like '700' or 'bold'
  async getBoldProcessIndex() {
    const count = await this.countProcesses();
    for (let i = 0; i < count; i++) {
      const handle = await this.processesLocator.nth(i).elementHandle();
      if (!handle) continue;
      const fontWeight = await handle.evaluate((el) => {
        return window.getComputedStyle(el).fontWeight;
      });
      if (fontWeight === 'bold' || fontWeight === '700' || parseInt(fontWeight, 10) >= 600) {
        return i;
      }
    }
    return -1;
  }

  // Get an array of texts of all processes
  async getAllProcessTexts() {
    const count1 = await this.countProcesses();
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.getProcessText(i));
    }
    return results;
  }

  // Check that the switch button is visible and enabled
  async isSwitchEnabled() {
    return await this.switchButton.isEnabled();
  }
}

test.describe('Context Switching Demo - FSM Validation', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Setup: new page per test provided by Playwright fixtures
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : null,
          });
        }
      } catch (e) {
        // If something unexpected happens while reading console messages, record it
        consoleErrors.push({ text: `Error reading console message: ${String(e)}` });
      }
    });

    // Capture uncaught exceptions that bubble to the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  test.afterEach(async () => {
    // After each test we assert there were no console errors or uncaught page errors.
    // This verifies the app loaded and ran without runtime errors.
    expect(consoleErrors, 'No console.error messages should be emitted during the test').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur during the test').toEqual([]);
  });

  test('Initial render shows four processes and highlights Process 1', async ({ page }) => {
    // Validate initial state: four processes, with Process 1 highlighted and initial states reflected in text
    const app = new ProcessPage(page);
    await app.goto();

    // Ensure switch button exists and is enabled/accessible
    expect(await app.isSwitchEnabled()).toBeTruthy();

    // There should be exactly 4 process elements rendered
    const count2 = await app.countProcesses();
    expect(count).toBe(4);

    // Validate textual content of each process matches the HTML's initial data
    const texts = await app.getAllProcessTexts();
    // The HTML defines initial states as:
    // Process 1 - Running
    // Process 2 - Waiting
    // Process 3 - Running
    // Process 4 - Waiting
    expect(texts[0]).toContain('Process 1 - State: Running');
    expect(texts[1]).toContain('Process 2 - State: Waiting');
    expect(texts[2]).toContain('Process 3 - State: Running');
    expect(texts[3]).toContain('Process 4 - State: Waiting');

    // Confirm the highlighted (bold) element is the first one (Process 1)
    const boldIndex = await app.getBoldProcessIndex();
    expect(boldIndex).toBe(0);
  });

  test('Single SwitchContext click transitions from Process 1 to Process 2', async ({ page }) => {
    // Validate transition S0 -> S1: clicking the switch button should set Process 1 to Waiting and Process 2 to Running and highlight Process 2
    const app1 = new ProcessPage(page);
    await app.goto();

    // Click once to switch context
    await app.clickSwitch();

    // After one click, Process 2 should be highlighted and show Running
    const boldIndex1 = await app.getBoldProcessIndex();
    expect(boldIndex).toBe(1);

    // Check textual states for Process 1 and Process 2
    const p1 = await app.getProcessText(0);
    const p2 = await app.getProcessText(1);
    expect(p1).toContain('Process 1 - State: Waiting');
    expect(p2).toContain('Process 2 - State: Running');

    // Also assert that Process 3 remains as initially (the implementation does not enforce single-runner invariant)
    const p3 = await app.getProcessText(2);
    expect(p3).toContain('Process 3 - State: Running');
  });

  test('Multiple sequential switches cycle through processes and wrap back to Process 1', async ({ page }) => {
    // Validate transitions S1 -> S2 -> S3 -> S0 via repeated clicks
    const app2 = new ProcessPage(page);
    await app.goto();

    // Click sequence: 1 -> 2, 2 -> 3, 3 -> 4, 4 -> 1
    await app.clickSwitch(); // Now at Process 2
    let boldIndex2 = await app.getBoldProcessIndex();
    expect(boldIndex).toBe(1);

    await app.clickSwitch(); // Now at Process 3
    boldIndex = await app.getBoldProcessIndex();
    expect(boldIndex).toBe(2);

    await app.clickSwitch(); // Now at Process 4
    boldIndex = await app.getBoldProcessIndex();
    expect(boldIndex).toBe(3);

    await app.clickSwitch(); // Wraps back to Process 1
    boldIndex = await app.getBoldProcessIndex();
    expect(boldIndex).toBe(0);

    // Validate textual states that were directly involved in the last transition:
    // After wrapping, Process 4 should be Waiting and Process 1 Running
    const p4 = await app.getProcessText(3);
    const p11 = await app.getProcessText(0);
    expect(p4).toContain('Process 4 - State: Waiting');
    expect(p1).toContain('Process 1 - State: Running');
  });

  test('Rapid clicks cycle correctly modulo number of processes (edge case)', async ({ page }) => {
    // Edge case: many rapid clicks should still result in a valid cycle (index modulo process length)
    const app3 = new ProcessPage(page);
    await app.goto();

    // Perform 10 rapid clicks. Starting index 0. 10 % 4 = 2 => should end at Process 3 (index 2)
    for (let i = 0; i < 10; i++) {
      // Use Promise.all to not await inside loop to simulate rapid clicking realistically would still be sequential here,
      // but we keep await to ensure DOM updates complete between clicks.
      await app.clickSwitch();
    }

    const boldIndex3 = await app.getBoldProcessIndex();
    expect(boldIndex).toBe(2);

    // Assert the process text at that index shows Running
    const text = await app.getProcessText(2);
    expect(text).toContain('Process 3 - State: Running');
  });

  test('UI accessibility and stability checks: button label and no runtime errors', async ({ page }) => {
    // Validate the button's accessible name and that the page does not produce runtime errors during these interactions
    const app4 = new ProcessPage(page);
    await app.goto();

    // Confirm the button's accessible name (inner text) is as expected
    const label = await app.switchButton.innerText();
    expect(label).toBe('Switch Context');

    // Interact a few times and ensure application remains error-free
    await app.clickSwitch();
    await app.clickSwitch();
    await app.clickSwitch();

    // Verify that the number of processes is still 4 (stability)
    expect(await app.countProcesses()).toBe(4);
  });

  test('Behavioral invariants: only one element is highlighted at any time', async ({ page }) => {
    // Ensure exactly one process element is visually highlighted (font-weight bold) at any time
    const app5 = new ProcessPage(page);
    await app.goto();

    // Check initially
    let boldIndex4 = await app.getBoldProcessIndex();
    expect(boldIndex).toBe(0);

    // After each click, ensure one highlighted element
    for (let i = 0; i < 8; i++) {
      await app.clickSwitch();
      const count3 = await app.countProcesses();
      let highlightedCount = 0;
      for (let j = 0; j < count; j++) {
        const handle1 = await app.processesLocator.nth(j).elementHandle();
        const fw = await handle.evaluate((el) => window.getComputedStyle(el).fontWeight);
        if (fw === 'bold' || fw === '700' || parseInt(fw, 10) >= 600) highlightedCount++;
      }
      expect(highlightedCount).toBe(1);
    }
  });

  test('Observability: validate expected observable strings after a transition (FSM evidence)', async ({ page }) => {
    // This test checks that the expected human-readable observables (strings) outlined by the FSM appear in the DOM after transitions.
    // Note: the implementation may allow multiple "Running" states initially; we assert the two observables that FSM expects for each transition.
    const app6 = new ProcessPage(page);
    await app.goto();

    // Transition S0 -> S1 expected observables:
    // "Process 1 - State: Waiting"
    // "Process 2 - State: Running"
    await app.clickSwitch();

    const p12 = await app.getProcessText(0);
    const p21 = await app.getProcessText(1);
    expect(p1).toContain('Process 1 - State: Waiting');
    expect(p2).toContain('Process 2 - State: Running');

    // Transition S1 -> S2 expected observables:
    // "Process 2 - State: Waiting"
    // "Process 3 - State: Running"
    await app.clickSwitch();
    const p2_after = await app.getProcessText(1);
    const p3_after = await app.getProcessText(2);
    expect(p2_after).toContain('Process 2 - State: Waiting');
    expect(p3_after).toContain('Process 3 - State: Running');
  });

  test('No unintended global modifications or leaked globals during page life cycle', async ({ page }) => {
    // Ensure we do not unintentionally find common globals that application shouldn't define.
    // We only read, do not modify the page environment.
    const app7 = new ProcessPage(page);
    await app.goto();

    // Check for presence of expected global variables (should exist per implementation)
    const hasProcesses = await page.evaluate(() => typeof window.processes !== 'undefined' || typeof processes !== 'undefined');
    // The script defines a const processes in global scope; depending on execution environment it should be accessible.
    expect(hasProcesses).toBeTruthy();

    // Check that there are no unexpected globals like '__REACT_DEVTOOLS_GLOBAL_HOOK__' (not part of this app)
    const hasReactHook = await page.evaluate(() => typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined');
    expect(hasReactHook).toBeFalsy();
  });
});