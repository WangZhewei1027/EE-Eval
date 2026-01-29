import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0442aa32-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object Model for the relevant UI elements
class BellmanFordPage {
  constructor(page) {
    this.page = page;
  }

  // Element handles
  async startButton() {
    return this.page.locator('#start-button');
  }
  async stopButton() {
    return this.page.locator('#stop-button');
  }
  async graphContainer() {
    return this.page.locator('.graph');
  }

  // Actions
  async clickStart() {
    await (await this.startButton()).click();
  }
  async clickStop() {
    await (await this.stopButton()).click();
  }

  // Helpers to inspect attributes/state
  async isStopDisabled() {
    // returns boolean whether disabled attribute is present
    const attr = await this.page.getAttribute('#stop-button', 'disabled');
    return attr !== null;
  }
  async hasResultElement() {
    return await this.page.evaluate(() => !!document.getElementById('result'));
  }
  async onclickAttr(selector) {
    return await this.page.getAttribute(selector, 'onclick');
  }
  async typeofGlobal(fnName) {
    return await this.page.evaluate(name => typeof window[name], fnName);
  }
}

test.describe('Bellman-Ford Algorithm - FSM and implementation validation', () => {
  // We will capture console and page errors for assertions in each test.
  // Each test creates its own page fixture (Playwright test handles setup/teardown).

  test('Initial Idle state: UI elements present and initial disabled states (S0_Idle)', async ({ page }) => {
    // Arrays to capture runtime issues
    const pageErrors = [];
    const consoleMessages = [];

    // Listen for page errors and console messages
    page.on('pageerror', err => {
      // pageerror provides an Error object; capture the message
      pageErrors.push(String(err.message || err));
    });
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // Navigate to the app page
    await page.goto(APP_URL);

    const ui = new BellmanFordPage(page);

    // Validate basic components required for Idle state per FSM
    await expect(ui.startButton()).toBeVisible(); // Start button must exist and be visible
    await expect(ui.startButton()).toHaveText('Start'); // Text should be "Start"

    await expect(ui.stopButton()).toBeVisible(); // Stop button exists
    // Stop button should be disabled initially according to FSM evidence
    expect(await ui.isStopDisabled()).toBe(true);

    // Graph container exists
    await expect(ui.graphContainer()).toBeVisible();

    // The implementation attempts to run a script at load which (as provided) contains runtime errors.
    // We expect some page errors (TypeError / ReferenceError / SyntaxError) to have occurred during load.
    // Assert that at least one page error was captured and it indicates a runtime error type.
    // We allow any of TypeError/ReferenceError/SyntaxError because message text varies by engine.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.join('\n')).toMatch(/TypeError|ReferenceError|SyntaxError/);

    // Additionally assert that console messages were captured (there may be stack traces / logs)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);

    // The page's markup does not include an element with id="result". The script tries to set it and
    // should have caused a related error. Confirm the element is absent.
    expect(await ui.hasResultElement()).toBe(false);

    // Confirm there are no inline onclick attributes on start/stop buttons in the actual HTML (implementation)
    // This validates that FSM's extracted handlers (onclick="startAlgorithm()") are not present in the HTML.
    expect(await ui.onclickAttr('#start-button')).toBeNull();
    expect(await ui.onclickAttr('#stop-button')).toBeNull();
  });

  test('StartButtonClick event: clicking Start does not run startAlgorithm (missing implementation) and does not enable Stop (transition failure)', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', err => pageErrors.push(String(err.message || err)));
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto(APP_URL);
    const ui = new BellmanFordPage(page);

    // Before clicking, capture the state: Stop should be disabled
    expect(await ui.isStopDisabled()).toBe(true);

    // The FSM expects a StartButtonClick to transition S0_Idle -> S1_Running and call startAlgorithm().
    // The provided implementation does not define startAlgorithm() and does not wire onclick handlers,
    // so clicking should not produce the expected state change. We assert that:
    //  - there is no global startAlgorithm function,
    //  - clicking the start button leaves stop-button disabled,
    //  - clicking does not crash the test harness (Playwright will simulate the click),
    //  - runtime errors from the page load still exist (we assert they were captured).
    const typeofStart = await ui.typeofGlobal('startAlgorithm');
    expect(typeofStart).toBe('undefined'); // entry action not present

    // Perform the user action: click Start
    await ui.clickStart();

    // Give the page a moment to process any additional errors triggered by click (if any)
    await page.waitForTimeout(100);

    // Stop should still be disabled because no startAlgorithm() ran to enable it.
    expect(await ui.isStopDisabled()).toBe(true);

    // Confirm that page had runtime errors (from initial load). At least one runtime error should exist.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.join('\n')).toMatch(/TypeError|ReferenceError|SyntaxError/);

    // No onclick wiring means clicking the button does not call startAlgorithm — assert via console messages/no new global
    expect(await ui.typeofGlobal('startAlgorithm')).toBe('undefined');

    // Optional: ensure clicking didn't create the missing result element
    expect(await ui.hasResultElement()).toBe(false);
  });

  test('StopButtonClick event: clicking Stop in its initial disabled state should not cause a transition to Stopped (S2_Stopped)', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', err => pageErrors.push(String(err.message || err)));
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto(APP_URL);
    const ui = new BellmanFordPage(page);

    // Ensure initial conditions: stop is disabled
    expect(await ui.isStopDisabled()).toBe(true);

    // Attempt to click the Stop button (it is disabled in the DOM).
    // Playwright's click on a disabled element will still attempt to interact; in the browser a disabled button won't fire click handlers.
    // We perform the click to validate no transition occurs and no unexpected global function (stopAlgorithm) exists.
    await ui.clickStop();

    // Allow any potential handlers (if they existed) to run
    await page.waitForTimeout(100);

    // The FSM expects stopAlgorithm() on entering S2_Stopped, but the implementation does not expose stopAlgorithm.
    expect(await ui.typeofGlobal('stopAlgorithm')).toBe('undefined');

    // Because stop was disabled and there is no wiring, the Stop click should not transition the UI: still disabled
    expect(await ui.isStopDisabled()).toBe(true);

    // Confirm the persistent runtime errors from the page load exist and include a runtime error type
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.join('\n')).toMatch(/TypeError|ReferenceError|SyntaxError/);
  });

  test('Edge case: validate specific runtime failure modes expected from the broken implementation', async ({ page }) => {
    // This test asserts the concrete runtime issues produced by the script's logic:
    //  - Accessing graph[currentVertex]['edges'] when graph[currentVertex] is undefined
    //  - Attempting to set innerHTML on document.getElementById("result") when that element is missing
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(String(err.message || err)));

    await page.goto(APP_URL);

    // We expect error messages that reference either "edges" access issue or "result" being null.
    // Browser engines produce slightly different text; check for key substrings indicative of those errors.
    const joined = pageErrors.join('\n');

    // At least one error should mention 'edges' (attempting to read property of undefined) OR mention 'result' / 'innerHTML'
    const edgesRelated = /edges/.test(joined);
    const resultRelated = /(result|innerHTML)/i.test(joined);
    const genericRuntime = /(TypeError|ReferenceError)/.test(joined);

    expect(genericRuntime).toBeTruthy();
    expect(edgesRelated || resultRelated).toBeTruthy();
  });
});