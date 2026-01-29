import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dd571-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * Page Object for the Runtime Environment Demo application.
 * Encapsulates common selectors and interactions so tests read clearly.
 */
class RuntimeDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.detectBtn = page.locator('#detect-btn');
    this.memoryBtn = page.locator('#memory-btn');
    this.eventBtn = page.locator('#event-btn');
    this.runtimeType = page.locator('#runtime-type');
    this.output = page.locator('#output');

    // collectors for console and page errors to assert on later
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  /**
   * Attach listeners for console and page errors.
   * Must be called before goto() to capture errors during initial page load.
   */
  attachErrorListeners() {
    this.page.on('console', (msg) => {
      // collect only actual error-level console messages
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null,
        });
      }
    });

    this.page.on('pageerror', (err) => {
      // collect uncaught exceptions reported by the page
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickDetect() {
    await this.detectBtn.click();
  }

  async clickMemory() {
    await this.memoryBtn.click();
  }

  async clickEvent() {
    await this.eventBtn.click();
  }

  async getRuntimeTypeText() {
    return (await this.runtimeType.textContent())?.trim() ?? '';
  }

  async getOutputHTML() {
    return await this.output.innerHTML();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }
}

/**
 * Tests for FSM states and transitions described in the specification.
 * - Verifies initial entry action detectEnvironment() runs on load.
 * - Verifies transitions triggered by clicking each button.
 * - Observes console and page errors (collects them and asserts expectations).
 * - Covers edge cases like rapid repeated clicks.
 */
test.describe('Runtime Environment Demo - FSM states and transitions', () => {
  // Provide a fresh RuntimeDemoPage for each test and attach error listeners early
  test.beforeEach(async ({ page }) => {
    // nothing here because each test creates its own page object and attaches listeners
  });

  test('S0_Idle: on load detectEnvironment() is executed (runtime-type set)', async ({ page }) => {
    // Arrange
    const app = new RuntimeDemoPage(page);
    app.attachErrorListeners(); // start collecting errors before navigation

    // Act
    await app.goto();

    // Assert - entry action detectEnvironment() should set runtime type (expected "Browser" in a browser)
    const runtime = await app.getRuntimeTypeText();
    expect(runtime).toBe('Browser');

    // The output should be empty initially (detectEnvironment does not write to #output)
    const outputHTML = await app.getOutputHTML();
    expect(outputHTML.trim()).toBe('');

    // There should be no uncaught page errors or console error messages on initial load.
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('S1_EnvironmentFeatures: clicking Detect Environment Features shows browser features', async ({ page }) => {
    // This test validates the DetectEnvironmentFeatures event and S0 -> S1 transition
    const app = new RuntimeDemoPage(page);
    app.attachErrorListeners();
    await app.goto();

    // Act - trigger transition by clicking detect button
    await app.clickDetect();

    // Assert - output contains the Browser Environment features header and expected items
    const outputHTML = await app.getOutputHTML();
    expect(outputHTML).toContain('Browser Environment Features:');
    // Check that some specific feature lines are present and truthy for a browser context
    expect(outputHTML).toContain('Window object: true');
    expect(outputHTML).toContain('Document object: true');
    // If fetch or localStorage are available in the runtime, the text will reflect that:
    expect(outputHTML).toMatch(/Fetch API: (true|false)/);
    expect(outputHTML).toMatch(/LocalStorage: (true|false)/);

    // Ensure no uncaught exceptions or console errors occurred due to this transition
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('S2_MemoryAllocation: clicking Simulate Memory Allocation displays stack and heap details', async ({ page }) => {
    // Validates the SimulateMemoryAllocation event and S0 -> S2 transition
    const app = new RuntimeDemoPage(page);
    app.attachErrorListeners();
    await app.goto();

    // Act
    await app.clickMemory();

    // Assert - output contains the memory simulation header and expected details
    const outputText = await app.getOutputText();
    expect(outputText).toContain('Memory Allocation Simulation');
    expect(outputText).toContain('stackVar1: 42');
    expect(outputText).toContain('stackVar2: Hello');
    // JSON stringified heap objects should appear
    expect(outputText).toContain('"value":"Object 1"');
    expect(outputText).toContain('"value":"Object 2"');
    expect(outputText).toContain('references heapObj1');

    // Confirm no page errors or console errors were observed
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('S3_EventLoopDemonstrated: clicking Demonstrate Event Loop shows synchronous, microtask, and macrotask behavior in order', async ({ page }) => {
    // Validates the DemonstrateEventLoop event and S0 -> S3 transition, including event loop ordering
    const app = new RuntimeDemoPage(page);
    app.attachErrorListeners();
    await app.goto();

    // Act - click the event loop demonstration button
    await app.clickEvent();

    // Immediately after clicking, synchronous messages should already be present
    const immediateOutput = await app.getOutputText();
    expect(immediateOutput).toContain('Event Loop Demonstration');
    expect(immediateOutput).toContain('Starting synchronous code execution');
    expect(immediateOutput).toContain('Synchronous iteration 0');
    expect(immediateOutput).toContain('Synchronous iteration 1');
    expect(immediateOutput).toContain('Synchronous iteration 2');
    expect(immediateOutput).toContain('Synchronous code completed');

    // Wait a short while to allow microtasks and macrotasks to run
    // Microtask (Promise.then) should execute before macrotask (setTimeout(0)), but both will run quickly.
    await page.waitForTimeout(100);

    const finalHTML = await app.getOutputHTML();

    // Ensure both microtask and macrotask messages were appended
    expect(finalHTML).toContain('Micro task (Promise callback) executed');
    expect(finalHTML).toContain('Macro task (setTimeout callback) executed');

    // Verify ordering: microtask message should appear before macro task message in the HTML
    const microIndex = finalHTML.indexOf('Micro task (Promise callback) executed');
    const macroIndex = finalHTML.indexOf('Macro task (setTimeout callback) executed');
    expect(microIndex).toBeGreaterThan(-1);
    expect(macroIndex).toBeGreaterThan(-1);
    expect(microIndex).toBeLessThan(macroIndex);

    // No uncaught page errors or console errors are expected
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks on each button do not cause uncaught errors and update output', async ({ page }) => {
    // This test triggers edge-case interactions (rapid clicks) to ensure resilience
    const app = new RuntimeDemoPage(page);
    app.attachErrorListeners();
    await app.goto();

    // Rapid clicks on detect
    for (let i = 0; i < 5; i++) {
      await app.clickDetect();
    }
    // Rapid clicks on memory
    for (let i = 0; i < 5; i++) {
      await app.clickMemory();
    }
    // Rapid clicks on event (this schedules multiple micro/macrotasks)
    for (let i = 0; i < 5; i++) {
      await app.clickEvent();
    }

    // Allow asynchronous tasks to settle
    await page.waitForTimeout(200);

    const combinedOutput = await app.getOutputText();

    // After repeated interactions, content should reflect the last actions and remain sensible:
    // Memory simulation includes a specific sentence
    expect(combinedOutput).toContain('Note: Objects are allocated in heap memory, while primitives are stored in stack memory.')
      .or(expect(combinedOutput).toContain('Event Loop Demonstration'));

    // No uncaught exceptions or console errors should have been produced by repeated interactions
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('Error observation: capture any console.error or uncaught page exceptions during navigation and interactions', async ({ page }) => {
    // This test explicitly demonstrates collection of console and page errors.
    // It does not assert that errors must exist; instead it asserts that our listeners captured whatever occurred
    // and fails if unexpected errors occurred (we treat unexpected as any occurrences).
    const app = new RuntimeDemoPage(page);
    app.attachErrorListeners();
    await app.goto();

    // Perform normal interactions
    await app.clickDetect();
    await app.clickMemory();
    await app.clickEvent();

    // Wait for async tasks
    await page.waitForTimeout(100);

    // If any console errors or page errors occurred, fail the test with diagnostic information.
    if (app.consoleErrors.length > 0 || app.pageErrors.length > 0) {
      // Build informative failure message
      const consoleMsgs = app.consoleErrors.map((c) => c.text).join('\n---\n') || '(none)';
      const pageErrMsgs = app.pageErrors.map((e) => (e && e.message) ? e.message : String(e)).join('\n---\n') || '(none)';
      // Use expect to fail with message
      expect(false).toBe(true, `Unexpected console.error or pageerror during interactions.\nConsole errors:\n${consoleMsgs}\nPage errors:\n${pageErrMsgs}`);
    } else {
      // No errors observed - assert explicitly for clarity
      expect(app.consoleErrors.length).toBe(0);
      expect(app.pageErrors.length).toBe(0);
    }
  });
});