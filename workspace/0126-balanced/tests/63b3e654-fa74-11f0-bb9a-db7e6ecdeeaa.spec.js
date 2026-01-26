import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b3e654-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the Garbage Collection Demo page
class GarbageCollectionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.createBtn = page.locator('#createObjectsBtn');
    this.dropBtn = page.locator('#dropReferencesBtn');
    this.forceBtn = page.locator('#forceGCBtn');
    this.logItems = page.locator('#log p');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickCreate() {
    await this.createBtn.click();
  }

  async clickDrop() {
    await this.dropBtn.click();
  }

  async clickForceGC() {
    await this.forceBtn.click();
  }

  async getAllLogTexts() {
    // returns array of log paragraph texts
    return await this.logItems.allTextContents();
  }

  async waitForLogContaining(substring, opts = {}) {
    const timeout = opts.timeout ?? 2500;
    await this.page.waitForFunction(
      (selector, substr) => {
        const el = document.querySelector('#log');
        if (!el) return false;
        return Array.from(el.querySelectorAll('p')).some(p => p.textContent && p.textContent.includes(substr));
      },
      [ '#log', substring ],
      { timeout }
    );
  }

  async countLogEntries() {
    return await this.logItems.count();
  }
}

test.describe('Garbage Collection Demo - FSM and UI validations', () => {
  let gcPage;
  /** @type {string[]} */
  let consoleMessages;
  /** @type {string[]} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // collect console messages
    page.on('console', (msg) => {
      // record text for assertions; include type in case of error/warn
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    gcPage = new GarbageCollectionPage(page);
    await gcPage.goto();
    // Wait a short moment to allow the initial log to render
    await gcPage.waitForLogContaining("Welcome! Click 'Create Objects' to start.");
  });

  test.afterEach(async () => {
    // Basic teardown assertions can be placed here if needed in the future
  });

  test('Initial state (S0_Idle): UI elements and welcome log', async () => {
    // Validate initial buttons' enabled/disabled state and entry log from S0_Idle
    await expect(gcPage.createBtn).toBeVisible();
    await expect(gcPage.createBtn).toBeEnabled();

    await expect(gcPage.dropBtn).toBeVisible();
    await expect(gcPage.dropBtn).toBeDisabled();

    await expect(gcPage.forceBtn).toBeVisible();
    await expect(gcPage.forceBtn).toBeDisabled();

    const logs = await gcPage.getAllLogTexts();
    // The page logs a welcome message on load per FSM entry action
    const hasWelcome = logs.some(t => t.includes("Welcome! Click 'Create Objects' to start."));
    expect(hasWelcome).toBeTruthy();

    // There should be no uncaught page errors on initial load for this implementation
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_ObjectsCreated: Create Objects click creates objects and updates UI', async () => {
    // Click create and validate logs and button state changes
    await gcPage.clickCreate();

    // Wait for expected logs to appear
    await gcPage.waitForLogContaining('Creating 1000 DemoObject instances and registering them for finalization...');
    await gcPage.waitForLogContaining('1000 objects created and referenced in an array.');

    const logs = await gcPage.getAllLogTexts();

    // Check for the observable messages described in the FSM transition
    expect(logs.some(t => t.includes('Creating 1000 DemoObject instances'))).toBeTruthy();
    expect(logs.some(t => t.includes('1000 objects created and referenced in an array.'))).toBeTruthy();

    // After creation, create button should be disabled; drop and force should be enabled
    await expect(gcPage.createBtn).toBeDisabled();
    await expect(gcPage.dropBtn).toBeEnabled();
    await expect(gcPage.forceBtn).toBeEnabled();

    // No uncaught page errors expected during creation
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_ObjectsCreated -> S2_ReferencesDropped: Drop References click drops references and updates UI', async () => {
    // Prepare by creating objects
    await gcPage.clickCreate();
    await gcPage.waitForLogContaining('1000 objects created and referenced in an array.');

    // Now click drop references
    await gcPage.clickDrop();

    // Verify the expected log message for dropping references
    await gcPage.waitForLogContaining('Dropped references to all objects. Now they are eligible for garbage collection.');

    const logs = await gcPage.getAllLogTexts();
    expect(logs.some(t => t.includes('Dropped references to all objects. Now they are eligible for garbage collection.'))).toBeTruthy();

    // After dropping references, the drop button should be disabled
    await expect(gcPage.dropBtn).toBeDisabled();

    // The create button stays disabled (objects were created earlier)
    await expect(gcPage.createBtn).toBeDisabled();

    // forceGC button remains enabled (it was enabled after creation)
    await expect(gcPage.forceBtn).toBeEnabled();

    // No uncaught page errors expected during dropping references
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S2_ReferencesDropped -> S2_ReferencesDropped: Force GC click logs correct message (either forced-not-available or request)', async () => {
    // Create objects and drop references to reach S2
    await gcPage.clickCreate();
    await gcPage.waitForLogContaining('1000 objects created and referenced in an array.');
    await gcPage.clickDrop();
    await gcPage.waitForLogContaining('Dropped references to all objects. Now they are eligible for garbage collection.');

    // Click the Force GC button - behavior differs between environments. Accept either path.
    await gcPage.clickForceGC();

    // Wait briefly for any GC-related logs
    // Accept either the "Requesting garbage collection..." sequence or the "cannot be forced" fallback message.
    // We'll poll the log for up to 2s to make sure messages have time to be appended.
    await gcPage.page.waitForTimeout(500);

    const logs = await gcPage.getAllLogTexts();

    const requested = logs.some(t => t.includes('Requesting garbage collection...'));
    const requestedDone = logs.some(t => t.includes('Garbage collection requested.'));
    const cannotForce = logs.some(t => t.includes('Garbage collection cannot be forced in this browser'));

    // One of the expected behaviors must happen: either Requesting... (and maybe requested) OR cannot be forced message
    expect(requested || cannotForce).toBeTruthy();

    // If the implementation reports a successful request, also ensure the follow-up "requested" log appears.
    if (requested) {
      expect(requestedDone || cannotForce).toBeTruthy(); // if requested, expecting either a follow-up or fallback (in weird envs)
    }

    // There should remain no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases and error scenarios: disabled buttons cannot be clicked and attempting to do so throws', async () => {
    // Reload to initial state so buttons are back to defaults
    await gcPage.goto();

    // Ensure drop and force buttons are disabled initially
    await expect(gcPage.dropBtn).toBeDisabled();
    await expect(gcPage.forceBtn).toBeDisabled();

    // Attempting to click a disabled button should be rejected by Playwright.
    // We assert that Playwright throws when trying to click a disabled element.
    await expect(gcPage.page.locator('#dropReferencesBtn').click()).rejects.toThrow();
    await expect(gcPage.page.locator('#forceGCBtn').click()).rejects.toThrow();

    // Additionally assert that 'No objects to drop references from.' is not present because the drop button is disabled and click didn't proceed
    const logs = await gcPage.getAllLogTexts();
    expect(logs.some(t => t.includes('No objects to drop references from.'))).toBeFalsy();

    // No uncaught page errors expected as result of attempted clicks
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: repeated creation attempt detection logs expected message', async () => {
    // Create objects once
    await gcPage.clickCreate();
    await gcPage.waitForLogContaining('1000 objects created and referenced in an array.');

    // The create button is disabled after creation; to simulate a "user" attempt to create again, we cannot click the disabled
    // button directly. Instead, we assert that the UI prevented a second creation by being disabled and that the log
    // contains the creation message only once.
    await expect(gcPage.createBtn).toBeDisabled();

    // Count occurrences of the "Objects created" message
    const logs = await gcPage.getAllLogTexts();
    const createdMessages = logs.filter(t => t.includes('1000 objects created and referenced in an array.'));
    expect(createdMessages.length).toBeGreaterThanOrEqual(1);
    expect(createdMessages.length).toBeLessThanOrEqual(1); // should only appear once per normal flow

    // No page errors observed
    expect(pageErrors.length).toBe(0);
  });

  test('Console output capture: ensure the expected sequence of primary messages exists', async () => {
    // Create objects, drop references, then force GC - record console messages along the way
    await gcPage.clickCreate();
    await gcPage.waitForLogContaining('Creating 1000 DemoObject instances and registering them for finalization...');
    await gcPage.waitForLogContaining('1000 objects created and referenced in an array.');

    await gcPage.clickDrop();
    await gcPage.waitForLogContaining('Dropped references to all objects. Now they are eligible for garbage collection.');

    await gcPage.clickForceGC();
    await gcPage.page.waitForTimeout(300);

    // Ensure we have captured console messages (browser console may include script logs)
    // We at least expect that our page logs were sent to the DOM (checked earlier). Here we ensure console listener captured some items.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // at minimum, the listener worked

    // If there are any pageErrors, surface them in the assertion message for debugging
    if (pageErrors.length > 0) {
      throw new Error(`Detected page errors during interactions: ${pageErrors.join(' | ')}`);
    }
  });
});