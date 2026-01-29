import { test, expect } from '@playwright/test';

// Test file: de3cc403-fa74-11f0-a1b6-4b9b8151441a.spec.js
// Application URL (as provided)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3cc403-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object to encapsulate interactions with the demo
class DeadlockDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Button accessors
  btnA1() { return this.page.locator('#btnA1'); }
  btnA2() { return this.page.locator('#btnA2'); }
  btnReleaseA() { return this.page.locator('#btnReleaseA'); }
  btnB2() { return this.page.locator('#btnB2'); }
  btnB1() { return this.page.locator('#btnB1'); }
  btnReleaseB() { return this.page.locator('#btnReleaseB'); }
  btnReset() { return this.page.locator('button:has-text("Reset Demo")'); }

  // Resource status spans (note: page contains duplicate IDs; get the first occurrence)
  res1Status() { return this.page.locator('#res1Status').first(); }
  res2Status() { return this.page.locator('#res2Status').first(); }

  // Process containers
  processA() { return this.page.locator('#processA'); }
  processB() { return this.page.locator('#processB'); }

  // Log lines
  logEntries() { return this.page.locator('#log div'); }

  // Convenience clicks
  async acquireResource1(processId) {
    if (processId === 'A') {
      await this.btnA1().click();
    } else {
      await this.btnB1().click();
    }
  }

  async acquireResource2(processId) {
    if (processId === 'A') {
      await this.btnA2().click();
    } else {
      await this.btnB2().click();
    }
  }

  async releaseResources(processId) {
    if (processId === 'A') {
      await this.btnReleaseA().click();
    } else {
      await this.btnReleaseB().click();
    }
  }

  async reset() {
    await this.btnReset().click();
  }

  // Helpers to read application globals (resources/processes) safely
  async getResources() {
    return this.page.evaluate(() => {
      try {
        // Read only; do not modify
        return {
          resource1: { ...resources.resource1 },
          resource2: { ...resources.resource2 }
        };
      } catch (e) {
        return { error: String(e) };
      }
    });
  }

  async getProcesses() {
    return this.page.evaluate(() => {
      try {
        return {
          A: { holding: [...processes.A.holding], waiting: processes.A.waiting },
          B: { holding: [...processes.B.holding], waiting: processes.B.waiting }
        };
      } catch (e) {
        return { error: String(e) };
      }
    });
  }

  // Wait until a log entry containing text appears (with timeout)
  async waitForLogContains(text, options = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (expected) => {
        const log = document.getElementById('log');
        if (!log) return false;
        return Array.from(log.children).some(div => div.textContent.includes(expected));
      },
      text,
      options
    );
  }

  // Return all log messages as array of strings
  async getLogMessages() {
    return this.page.evaluate(() => {
      const log = document.getElementById('log');
      if (!log) return [];
      return Array.from(log.children).map(div => div.textContent);
    });
  }
}

// Group related tests
test.describe('Deadlock Demonstration - FSM tests', () => {
  // We'll capture console messages and page errors per test to assert runtime health
  test.beforeEach(async ({ page }) => {
    // No-op: individual tests will set up listeners as needed
  });

  // Test initial state: verifies onEnter actions and UI initialization
  test('Initial State (S0_Initial): UI initialized and initial log messages present', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    // Observe console and page errors
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DeadlockDemoPage(page);
    await demo.goto();

    // The entry actions call updateUI() and logMessage(...); verify that the visible UI shows initial state
    await expect(demo.res1Status()).toHaveText('Available');
    await expect(demo.res2Status()).toHaveText('Available');

    // Buttons initial enabled/disabled states per HTML and updateUI logic
    await expect(demo.btnA1()).toBeEnabled();           // A can acquire R1 initially
    await expect(demo.btnA2()).toBeDisabled();          // A's Acquire R2 is disabled initially
    await expect(demo.btnReleaseA()).toBeDisabled();    // Release A disabled initially

    await expect(demo.btnB2()).toBeEnabled();           // B can acquire R2 initially
    await expect(demo.btnB1()).toBeDisabled();          // B's Acquire R1 disabled initially
    await expect(demo.btnReleaseB()).toBeDisabled();    // Release B disabled initially

    // Validate initial log messages written by the script on load
    const logs = await demo.getLogMessages();
    // Expect at least the first "Ready to demonstrate deadlock. Try this sequence:" message
    const hasReady = logs.some(l => l.includes('Ready to demonstrate deadlock. Try this sequence:'));
    expect(hasReady).toBe(true);

    // Ensure no uncaught exceptions occurred during initialization
    expect(pageErrors.length).toBe(0);
    // Console errors (if any) should be surfaced but are not expected here
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: Acquire Resource 1 by Process A -> S1_ProcessA_Holding_R1
  test('Transition: Process A acquires Resource 1 (AcquireResource1_A) -> S1_ProcessA_Holding_R1', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DeadlockDemoPage(page);
    await demo.goto();

    // Click Acquire Resource 1 for Process A
    await demo.btnA1().click();

    // The JS logs "Process A acquired Resource 1" as entry action; wait for it
    await demo.waitForLogContains('Process A acquired Resource 1');

    // Verify resources and processes globals reflect the state
    const resources = await demo.getResources();
    const processes = await demo.getProcesses();

    expect(resources.resource1.status).toContain('Held by Process A');
    expect(processes.A.holding).toContain('resource1');

    // UI must reflect that resource 1 is held (text updated)
    await expect(demo.res1Status()).toHaveText(/Held by Process A/);

    // After acquiring R1:
    await expect(demo.btnA1()).toBeDisabled();        // Can't acquire R1 again
    await expect(demo.btnA2()).toBeEnabled();         // A can now attempt to acquire R2
    await expect(demo.btnReleaseA()).toBeEnabled();   // Release now enabled for A

    // No uncaught JS errors expected
    expect(pageErrors.length).toBe(0);
  });

  // Test transition: Process B acquires Resource 2 -> S2_ProcessB_Holding_R2
  test('Transition: Process B acquires Resource 2 (AcquireResource2_B) -> S2_ProcessB_Holding_R2', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DeadlockDemoPage(page);
    await demo.goto();

    // Prepare by having A acquire R1 to mirror common scenario
    await demo.btnA1().click();
    await demo.waitForLogContains('Process A acquired Resource 1');

    // Now B acquires R2
    await demo.btnB2().click();
    await demo.waitForLogContains('Process B acquired Resource 2');

    // Verify application globals and UI reflect R2 held by B
    const resources = await demo.getResources();
    const processes = await demo.getProcesses();

    expect(resources.resource2.status).toContain('Held by Process B');
    expect(processes.B.holding).toContain('resource2');

    await expect(demo.res2Status()).toHaveText(/Held by Process B/);
    await expect(demo.btnB2()).toBeDisabled();
    await expect(demo.btnB1()).toBeEnabled();        // B can now attempt to acquire R1 (if logic allows)
    await expect(demo.btnReleaseB()).toBeEnabled();

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  // Test deadlock transition: create deadlock via sequence -> S3_Deadlock
  test('Deadlock detection (S3_Deadlock): A holds R1, B holds R2, both wait for the other', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DeadlockDemoPage(page);
    await demo.goto();

    // 1) A acquires R1
    await demo.btnA1().click();
    await demo.waitForLogContains('Process A acquired Resource 1');

    // 2) B acquires R2
    await demo.btnB2().click();
    await demo.waitForLogContains('Process B acquired Resource 2');

    // 3) A tries to acquire R2 (which is held by B) -> should log cannot acquire and set waiting
    await demo.btnA2().click();
    await demo.waitForLogContains('Process A cannot acquire Resource 2');

    // 4) B tries to acquire R1 (which is held by A) -> should log cannot acquire and then deadlock detection
    await demo.btnB1().click();

    // The deadlock detection routine logs the DEADLOCK DETECTED message
    await demo.waitForLogContains('DEADLOCK DETECTED! Both processes are waiting for resources held by the other.');

    // Assert that both process containers have the deadlock class applied (visual feedback)
    await expect(demo.processA()).toHaveClass(/deadlock/);
    await expect(demo.processB()).toHaveClass(/deadlock/);

    // Verify the processes globals show holding/waiting state consistent with deadlock
    const processes = await demo.getProcesses();
    expect(processes.A.holding).toContain('resource1');
    expect(processes.A.waiting).toBe('resource2');
    expect(processes.B.holding).toContain('resource2');
    expect(processes.B.waiting).toBe('resource1');

    // Verify the resources globals remain owned by respective processes
    const resources = await demo.getResources();
    expect(resources.resource1.owner).toBe('A');
    expect(resources.resource2.owner).toBe('B');

    // No uncaught errors expected during the deadlock sequence
    expect(pageErrors.length).toBe(0);
  });

  // Test releasing resources to return to initial state from S1 and S2
  test('Releasing resources (ReleaseResources_A / ReleaseResources_B) returns resources to Available', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DeadlockDemoPage(page);
    await demo.goto();

    // A acquires R1
    await demo.btnA1().click();
    await demo.waitForLogContains('Process A acquired Resource 1');

    // Release A's resources
    await demo.btnReleaseA().click();
    // Wait for release log entry
    await demo.waitForLogContains('Process A released resource1');

    // Confirm resource1 is available again
    await expect(demo.res1Status()).toHaveText('Available');
    const resourcesAfterARelease = await demo.getResources();
    expect(resourcesAfterARelease.resource1.status).toBe('Available');
    expect(resourcesAfterARelease.resource1.owner).toBe(null);

    // Now B acquires R2 and releases it
    await demo.btnB2().click();
    await demo.waitForLogContains('Process B acquired Resource 2');

    await demo.btnReleaseB().click();
    await demo.waitForLogContains('Process B released resource2');

    // Confirm resource2 is available again
    await expect(demo.res2Status()).toHaveText('Available');
    const resourcesAfterBRelease = await demo.getResources();
    expect(resourcesAfterBRelease.resource2.status).toBe('Available');
    expect(resourcesAfterBRelease.resource2.owner).toBe(null);

    // No uncaught errors expected
    expect(pageErrors.length).toBe(0);
  });

  // Test Reset Demo from deadlock state transitions back to S0_Initial
  test('Reset Demo transition (ResetDemo) from deadlock state returns everything to initial', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DeadlockDemoPage(page);
    await demo.goto();

    // Create deadlock first
    await demo.btnA1().click();
    await demo.waitForLogContains('Process A acquired Resource 1');
    await demo.btnB2().click();
    await demo.waitForLogContains('Process B acquired Resource 2');
    await demo.btnA2().click();
    await demo.waitForLogContains('Process A cannot acquire Resource 2');
    await demo.btnB1().click();
    await demo.waitForLogContains('DEADLOCK DETECTED! Both processes are waiting for resources held by the other.');

    // Now Reset
    await demo.reset();
    await demo.waitForLogContains('Demo reset to initial state');

    // After reset, both resources should be available and no deadlock highlighting
    await expect(demo.res1Status()).toHaveText('Available');
    await expect(demo.res2Status()).toHaveText('Available');

    await expect(demo.processA()).not.toHaveClass(/deadlock/);
    await expect(demo.processB()).not.toHaveClass(/deadlock/);

    // And the globals should reflect reset
    const resources = await demo.getResources();
    const processes = await demo.getProcesses();
    expect(resources.resource1.owner).toBeNull();
    expect(resources.resource2.owner).toBeNull();
    expect(resources.resource1.status).toBe('Available');
    expect(resources.resource2.status).toBe('Available');
    expect(processes.A.holding.length).toBe(0);
    expect(processes.B.holding.length).toBe(0);
    expect(processes.A.waiting).toBeNull();
    expect(processes.B.waiting).toBeNull();

    // No uncaught errors expected during reset
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: Attempt to acquire a resource already held - verify proper "cannot acquire" logging and waiting state set
  test('Edge case: attempting to acquire an already held resource logs a cannot-acquire message and sets waiting', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DeadlockDemoPage(page);
    await demo.goto();

    // B acquires R2 first
    await demo.btnB2().click();
    await demo.waitForLogContains('Process B acquired Resource 2');

    // A tries to acquire R2 (A.btnA2 is disabled initially; make A acquire R1 first so btnA2 becomes enabled)
    await demo.btnA1().click();
    await demo.waitForLogContains('Process A acquired Resource 1');

    // Now A will try to acquire R2 which is held by B -> leads to cannot acquire message
    await demo.btnA2().click();
    await demo.waitForLogContains('Process A cannot acquire Resource 2');

    // Verify process A waiting set to resource2
    const processes = await demo.getProcesses();
    expect(processes.A.waiting).toBe('resource2');

    // And verify that a clear log message exists describing the failed acquisition
    const logs = await demo.getLogMessages();
    const cannotAcquireLogExists = logs.some(l => l.includes('Process A cannot acquire Resource 2'));
    expect(cannotAcquireLogExists).toBe(true);

    // No uncaught errors expected
    expect(pageErrors.length).toBe(0);
  });

  // Observability test: ensure there are no unexpected console errors during normal interactions
  test('Observability: page should not emit uncaught exceptions or console errors during interactions', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new DeadlockDemoPage(page);
    await demo.goto();

    // Perform a set of typical interactions
    await demo.btnA1().click();
    await demo.waitForLogContains('Process A acquired Resource 1');

    await demo.btnB2().click();
    await demo.waitForLogContains('Process B acquired Resource 2');

    await demo.btnA2().click();
    await demo.waitForLogContains('Process A cannot acquire Resource 2');

    // Reset at the end
    await demo.reset();
    await demo.waitForLogContains('Demo reset to initial state');

    // Assert no page-level uncaught exceptions
    expect(pageErrors.length).toBe(0);

    // Assert no console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

});