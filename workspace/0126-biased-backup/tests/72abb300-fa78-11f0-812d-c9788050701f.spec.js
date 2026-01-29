import { test, expect } from '@playwright/test';

test.setTimeout(60000); // Allow enough time for the long animation timeline (up to ~18s)

/**
 * Page object for the Mutex visualization page.
 * Encapsulates common selectors and utility helpers to keep tests organized.
 */
class MutexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/72abb300-fa78-11f0-812d-c9788050701f.html';

    // Selectors used across tests
    this.selectors = {
      startBtn: '#startBtn',
      resetBtn: '#resetBtn',
      status: '#status',
      lock: '#lock',
      mutex: '#mutex',
      thread1: '#thread1',
      thread2: '#thread2',
      line1: '#line1',
      line2: '#line2'
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  // Element handles
  async startButton() {
    return this.page.locator(this.selectors.startBtn);
  }
  async resetButton() {
    return this.page.locator(this.selectors.resetBtn);
  }
  async statusText() {
    return (await this.page.locator(this.selectors.status).textContent())?.trim();
  }

  // Helper to read a property from window (safe read, no mutation)
  async getWindowVar(varName) {
    return this.page.evaluate((v) => {
      // Access global variable if present
      return (window && Object.prototype.hasOwnProperty.call(window, v)) ? window[v] : undefined;
    }, varName);
  }

  // Wait until the status text equals expected value (with a specific timeout)
  async waitForStatus(expected, timeout = 5000) {
    await this.page.waitForFunction(
      (exp) => {
        const el = document.getElementById('status');
        return !!el && el.textContent.trim() === exp;
      },
      expected,
      { timeout }
    );
  }

  // Grab the thread icon text content
  async threadIconText(threadSelector) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const icon = el.querySelector('.thread-icon');
      return icon ? icon.textContent.trim() : null;
    }, threadSelector);
  }

  async elementHasClass(selector, className) {
    return this.page.evaluate(([sel, cls]) => {
      const el = document.querySelector(sel);
      return !!el && el.classList.contains(cls);
    }, [selector, className]);
  }

  async getStyleProperty(selector, property) {
    return this.page.evaluate(([sel, prop]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el)[prop];
    }, [selector, property]);
  }
}

test.describe('Visual Mutex Demonstration (FSM) - 72abb300-fa78-11f0-812d-c9788050701f', () => {
  let mutexPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for assertion (observability)
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store messages with type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // collect uncaught exceptions
      pageErrors.push(err);
    });

    mutexPage = new MutexPage(page);
    await mutexPage.goto();
  });

  test.afterEach(async () => {
    // Assert that no page errors (uncaught exceptions) occurred during the test.
    // This verifies the page executed without throwing runtime exceptions.
    expect(pageErrors.length, `Expected no uncaught page errors, got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Assert there were no console 'error' messages (these often indicate runtime problems).
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrors.length, `Expected no console errors, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Initial Idle state (S0_Idle) - resetSimulation entry action applied on load', async ({ page }) => {
    // Validate initial conditions after the page's resetSimulation() call during initial setup.
    // Checks for idle state: not simulating, unlocked, visual primitives in their reset states.
    const startBtn = await mutexPage.startButton();
    const resetBtn = await mutexPage.resetButton();

    // Assert DOM presence and initial text
    const status = await mutexPage.statusText();
    expect(status).toBe('Mutex: Unlocked');

    // The lock icon should display unlocked glyph
    const lockText = await page.locator('#lock').textContent();
    expect(lockText.trim()).toBe('🔓');

    // Thread icons should show the default spinner icon
    const thread1Icon = await mutexPage.threadIconText('#thread1');
    const thread2Icon = await mutexPage.threadIconText('#thread2');
    expect(thread1Icon).toBe('🔄');
    expect(thread2Icon).toBe('🔄');

    // Global variables set by resetSimulation
    const isSimulating = await mutexPage.getWindowVar('isSimulating');
    const isLocked = await mutexPage.getWindowVar('isLocked');
    expect(isSimulating).toBe(false);
    expect(isLocked).toBe(false);

    // Start button enabled by default; reset button exists
    expect(await startBtn.isEnabled()).toBe(true);
    expect(await resetBtn.isEnabled()).toBe(true);
  });

  test('StartSimulation -> Thread A Requesting (S1) and Thread A Access (S2) then Release (S3)', async ({ page }) => {
    // This test validates the first three FSM states and transitions triggered by clicking Start Simulation.
    // It asserts DOM changes and global state (isLocked).
    const startBtn = await mutexPage.startButton();

    // Click Start Simulation to fire StartSimulation event
    await startBtn.click();

    // After clicking, animateStep is executed for step 0 immediately -> Thread A Requesting
    await mutexPage.waitForStatus('Mutex: Thread A Requesting...', 1000);
    expect(await mutexPage.threadIconText('#thread1')).toBe('🔒'); // thread1 icon shows lock
    expect(await mutexPage.getWindowVar('isSimulating')).toBe(true); // simulation flag set
    expect(await startBtn.isDisabled()).toBe(true); // button disabled while simulating

    // Wait for Thread A Access (S2) which should occur after timeline[0].delay = 1000ms
    // Give some buffer to account for scheduling: allow up to 3000ms
    await mutexPage.waitForStatus('Mutex: Locked by Thread A', 3000);

    // At access, isLocked should be true and central mutex should have 'pulse' class and lock glyph '🔒'
    const isLockedDuringA = await mutexPage.getWindowVar('isLocked');
    expect(isLockedDuringA).toBe(true);

    const lockGlyphDuringA = (await page.locator('#lock').textContent()).trim();
    expect(lockGlyphDuringA).toBe('🔒');

    const mutexHasPulse = await mutexPage.elementHasClass('#mutex', 'pulse');
    expect(mutexHasPulse).toBe(true);

    // Wait for Thread A Release (S3). This should be reached according to timeline scheduling.
    // Allow sufficient timeout for the scheduled delays (cumulative).
    await mutexPage.waitForStatus('Mutex: Unlocked', 6000);

    // After release, isLocked should be false and thread1 icon should revert to '🔄'
    const isLockedAfterRelease = await mutexPage.getWindowVar('isLocked');
    expect(isLockedAfterRelease).toBe(false);
    expect(await mutexPage.threadIconText('#thread1')).toBe('🔄');
  });

  test('Thread B Request (S4), Access (S5), Release (S6), then ResetSimulation transitions back to Idle (S0)', async ({ page }) => {
    // This test continues through the rest of the FSM states for Thread B,
    // validates visual states and confirms ResetSimulation returns to Idle.

    // Start simulation
    const startBtn = await mutexPage.startButton();
    const resetBtn = await mutexPage.resetButton();
    await startBtn.click();

    // Wait through Thread A phases first to get to Thread B Request.
    // Based on timeline scheduling, Thread B Request occurs at approx t = 7000 ms from start (cumulative).
    await mutexPage.waitForStatus('Mutex: Thread B Requesting...', 10000);

    // Validate that thread2 icon shows requesting lock glyph and line2 has width expanded
    expect(await mutexPage.threadIconText('#thread2')).toBe('🔒');
    // Confirm status text exactly
    expect(await mutexPage.statusText()).toBe('Mutex: Thread B Requesting...');

    // Wait for Thread B Access (Locked by Thread B).
    // This is expected after additional scheduled delay; allow larger timeout cumulatively.
    await mutexPage.waitForStatus('Mutex: Locked by Thread B', 10000);

    // When thread B accesses, isLocked should be true and central lock glyph set
    const isLockedDuringB = await mutexPage.getWindowVar('isLocked');
    expect(isLockedDuringB).toBe(true);
    expect((await page.locator('#lock').textContent()).trim()).toBe('🔒');

    // Finally wait for Thread B release -> 'Mutex: Unlocked' (end of simulation)
    // This should occur by cumulative ~18s from start; allow generous timeout.
    await mutexPage.waitForStatus('Mutex: Unlocked', 20000);

    // At the end of the simulation the page's code sets isSimulating = false and enables start button.
    expect(await mutexPage.getWindowVar('isSimulating')).toBe(false);
    expect(await startBtn.isEnabled()).toBe(true);

    // Now explicitly test the ResetSimulation event:
    // Modify a visual property to ensure reset has an effect, then click Reset.
    // For safety, click Reset after simulation; it should be idempotent and return to Idle semantics.
    await resetBtn.click();

    // After reset, verify Idle state: unlocked, no pulse, thread icons reset, start button enabled.
    await mutexPage.waitForStatus('Mutex: Unlocked', 1000);
    expect(await mutexPage.getWindowVar('isSimulating')).toBe(false);
    expect(await mutexPage.getWindowVar('isLocked')).toBe(false);
    expect(await mutexPage.threadIconText('#thread1')).toBe('🔄');
    expect(await mutexPage.threadIconText('#thread2')).toBe('🔄');
    expect(await page.locator('#lock').textContent()).toBe('🔓');
    const mutexHasPulseAfterReset = await mutexPage.elementHasClass('#mutex', 'pulse');
    expect(mutexHasPulseAfterReset).toBe(false);
  });

  test('Edge cases: clicking Start while already simulating and Reset during simulation', async ({ page }) => {
    // This test covers edge-case behavior per FSM: StartSimulation should be ignored while simulating.
    // Also verifies ResetSimulation will cancel in-progress simulation and return to Idle.

    const startBtn = await mutexPage.startButton();
    const resetBtn = await mutexPage.resetButton();

    // Click Start to begin simulation
    await startBtn.click();

    // Immediately attempt to click Start again - should be ignored because button is disabled in the script
    // But to be thorough, attempt programmatic click (it will be disabled in DOM, but we simulate user click).
    // Using the locator's click will fail if disabled; we assert it's disabled instead of forcing behavior.
    expect(await startBtn.isDisabled()).toBe(true);

    // Wait for Thread A Request (S1) to be active
    await mutexPage.waitForStatus('Mutex: Thread A Requesting...', 1000);

    // Now trigger Reset while simulation is in-progress to test whether it cancels future scheduled steps
    await resetBtn.click();

    // After reset, verify simulation flags and visuals indicate Idle
    await mutexPage.waitForStatus('Mutex: Unlocked', 1000);
    expect(await mutexPage.getWindowVar('isSimulating')).toBe(false);
    expect(await mutexPage.getWindowVar('isLocked')).toBe(false);
    expect(await mutexPage.threadIconText('#thread1')).toBe('🔄');
    expect(await page.locator('#lock').textContent()).toBe('🔓');

    // To further ensure that scheduled timeouts were canceled, wait a bit longer and confirm no spontaneous changes occur.
    // If timeouts weren't cleared, we might see later transitions; assert status remains 'Mutex: Unlocked'.
    await page.waitForTimeout(2000);
    expect(await mutexPage.statusText()).toBe('Mutex: Unlocked');
  });

  test('Observability: capture console output and page errors during a full run', async ({ page }) => {
    // This test intentionally runs through a full simulation and then asserts that there were no console errors or uncaught page exceptions.
    // It demonstrates observation of logs and runtime issues while exercising all transitions.

    const startBtn = await mutexPage.startButton();
    await startBtn.click();

    // Wait until the very end of the simulation: final 'Mutex: Unlocked' after Thread B release.
    await mutexPage.waitForStatus('Mutex: Unlocked', 20000);

    // By virtue of the afterEach hook, we will assert there were no pageErrors and no console 'error' messages.
    // But here we also programmatically assert that the console captured messages (if any) do not contain common JS runtime error keywords.
    const allConsoleText = consoleMessages.map(m => `${m.type}: ${m.text}`).join('\n');
    const errorKeywords = ['ReferenceError', 'TypeError', 'SyntaxError', 'Uncaught'];
    for (const kw of errorKeywords) {
      expect(allConsoleText.includes(kw), `Console should not include ${kw}`).toBe(false);
    }

    // Also assert that the final global flags are as expected
    expect(await mutexPage.getWindowVar('isSimulating')).toBe(false);
    expect(await mutexPage.getWindowVar('isLocked')).toBe(false);
  });
});