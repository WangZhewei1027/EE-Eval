import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a5862-fa76-11f0-a09b-87751f540fd8.html';

// Page object to encapsulate common interactions and assertions
class VirtualMemoryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#run-apps');
    this.stopButton = page.locator('#stop-apps');
    this.memory = page.locator('#memory-usage');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runButton.click();
  }

  async clickStop() {
    await this.stopButton.click();
  }

  async getMemoryText() {
    return (await this.memory.innerText()).trim();
  }

  // Direct invocation of functions defined on the page (do not modify/patch them)
  async callRunApps(times = 1) {
    await this.page.evaluate((t) => {
      for (let i = 0; i < t; i++) {
        // call the function as-is
        runApps();
      }
    }, times);
  }

  async callStopApps(times = 1) {
    await this.page.evaluate((t) => {
      for (let i = 0; i < t; i++) {
        stopApps();
      }
    }, times);
  }

  async callHandleButtonClickWithId(buttonId) {
    return await this.page.evaluate((id) => {
      // call the function as-is with the expected string id
      // this mirrors the intended API in the FSM (handleButtonClick('run-apps'))
      handleButtonClick(id);
    }, buttonId);
  }

  async getAppsCount() {
    return await this.page.evaluate(() => apps);
  }
}

// Tests grouped by behavior/feature
test.describe('Virtual Memory FSM tests - 520a5862-fa76-11f0-a09b-87751f540fd8', () => {
  let pageErrors;
  let consoleErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    // Collect runtime page errors and console errors for each test run
    pageErrors = [];
    consoleErrors = [];
    dialogs = [];

    page.on('pageerror', (err) => {
      // store the error message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture dialogs (alerts) and auto-accept them while recording the message
    page.on('dialog', async (dialog) => {
      try {
        dialogs.push(dialog.message());
        await dialog.accept();
      } catch (e) {
        // If accepting the dialog throws, record it as a page error
        pageErrors.push(String(e));
      }
    });

    // Navigate to the page under test
    const vm = new VirtualMemoryPage(page);
    await vm.goto();
  });

  // Clean up listeners implicitly by Playwright between tests; explicit teardown not required here

  test('Initial state: buttons visible and memory display is empty', async ({ page }) => {
    // Validate initial (S0_Idle) state per FSM: Run Apps and Stop Apps should be present.
    const vm = new VirtualMemoryPage(page);

    // Buttons should be visible
    await expect(vm.runButton).toBeVisible();
    await expect(vm.stopButton).toBeVisible();

    // Memory usage should be empty on initial load (implementation initializes memoryUsage = 0
    // but does not populate the memory-usage element until functions are called).
    const memText = await vm.getMemoryText();
    expect(memText).toBe('', 'Expected memory display to be empty on initial load');

    // There should be no runtime page errors or console errors immediately after load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Run Apps uses an incorrect event handler signature and does NOT change memory', async ({ page }) => {
    // The implementation attaches handleButtonClick as a listener directly:
    // document.getElementById('run-apps').addEventListener('click', handleButtonClick);
    // handleButtonClick expects a string id, but the browser provides a MouseEvent.
    // This test validates that clicking the button (as a user would) does not trigger the intended action.
    const vm = new VirtualMemoryPage(page);

    // Sanity: memory is empty initially
    expect(await vm.getMemoryText()).toBe('');

    // Perform a user click on the Run Apps button
    await vm.clickRun();

    // Give the page a brief moment to process events
    await page.waitForTimeout(100);

    // Because the handler signature is wrong, the memory display should remain unchanged
    const memAfterClick = await vm.getMemoryText();
    expect(memAfterClick).toBe('', 'Clicking Run Apps should not have updated the memory due to handler signature mismatch');

    // No runtime page errors were expected as a result of the click (function simply did nothing)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Directly calling handleButtonClick with correct id triggers onEnter action runApps', async ({ page }) => {
    // The FSM indicates that entering the Running Apps state should call runApps().
    // The implementation provides handleButtonClick(buttonId) which works when called with the proper string.
    // This test invokes handleButtonClick with 'run-apps' to validate the runApps onEnter action.
    const vm = new VirtualMemoryPage(page);

    // Before invocation: apps should be the initial value (10) and memory display empty
    expect(await vm.getAppsCount()).toBe(10);
    expect(await vm.getMemoryText()).toBe('');

    // Call handleButtonClick with the intended string id to simulate the ideal invocation from the FSM
    await vm.callHandleButtonClickWithId('run-apps');

    // After calling, memory should reflect one runApps invocation
    const memText = await vm.getMemoryText();
    expect(memText).toBe('Memory Usage: 1000 MB', 'Direct call to handleButtonClick(\'run-apps\') should increment memory by 1000 MB');

    // Apps count should have incremented by 1
    const apps = await vm.getAppsCount();
    expect(apps).toBe(11, 'Apps should have incremented by one when runApps() is invoked');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Calling runApps repeatedly demonstrates auto-stop behavior when apps > 16', async ({ page }) => {
    // This verifies the entry action: runApps() increments apps and memory and calls stopApps() if apps > 16
    // Starting apps = 10. We call runApps 7 times to exceed 16 (10 -> 17) and observe the auto-invoked stopApps().
    const vm = new VirtualMemoryPage(page);

    // Call runApps 7 times directly (mirrors S1_RunningApps entry action behavior)
    await vm.callRunApps(7);

    // Expectation derived from implementation:
    // After 7 calls: apps goes 10->17, but the final call triggers stopApps() which decrements apps back to 16.
    // Memory increments happen per runApps and decrements by stopApps, resulting in a net memory of 6000 MB.
    const memText = await vm.getMemoryText();
    expect(memText).toBe('Memory Usage: 6000 MB', 'After repeated runApps calls with auto-stop logic, memory should be 6000 MB');

    const apps = await vm.getAppsCount();
    expect(apps).toBe(16, 'Apps should end at 16 after auto-stop invoked by runApps when apps > 16');

    // No runtime errors expected from these direct calls
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Stop Apps does not work as a user interaction because of handler signature mismatch', async ({ page }) => {
    // Mirror the earlier "click Run" test but for stopping: clicking the stop button with the incorrect handler
    // will receive an event object rather than the expected string id, so no action should occur.
    const vm = new VirtualMemoryPage(page);

    // Initial display empty
    expect(await vm.getMemoryText()).toBe('');

    // Click the stop button as a user would
    await vm.clickStop();
    await page.waitForTimeout(100);

    // Because handleButtonClick receives a MouseEvent (not the id), stopApps is not invoked.
    expect(await vm.getMemoryText()).toBe('', 'Clicking Stop Apps should not have updated memory due to handler signature mismatch');

    // No runtime errors as a result of the click
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Directly invoking stopApps repeatedly triggers alert when apps reaches 0 (edge case)', async ({ page }) => {
    // The FSM indicates that when stopping apps until none remain, an alert "All apps stopped!" appears.
    // The implementation's stopApps() does this when apps === 0. We directly invoke stopApps 10 times to reach that edge.
    const vm = new VirtualMemoryPage(page);

    // Ensure we capture dialog messages that will be generated by the implementation
    // (page.on('dialog') is already configured in beforeEach to record and accept dialogs)

    // Call stopApps 10 times directly. This will decrement apps from 10 down to 0.
    await vm.callStopApps(10);

    // The dialog should have been shown exactly once with the expected message
    expect(dialogs.includes('All apps stopped!')).toBeTruthy();

    // The memory display reflects the cumulative decrements. Starting from 0 and decrementing 10 times:
    // Memory becomes -10000 MB according to the implementation (no guard to prevent negative memory).
    const memText = await vm.getMemoryText();
    expect(memText).toBe('Memory Usage: -10000 MB', 'After calling stopApps 10 times starting from 0 memory, the implementation produces negative memory values');

    // Apps count should now be 0
    const apps = await vm.getAppsCount();
    expect(apps).toBe(0);

    // No page runtime errors expected during this sequence (alert is handled)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Directly invoking stopApps fewer times shows expected memory decrements without alert', async ({ page }) => {
    // Edge case: call stopApps a single time from the initial state to verify memory decrement behavior
    const vm = new VirtualMemoryPage(page);

    // Call stopApps once: apps 10 -> 9, memory 0 -> -1000
    await vm.callStopApps(1);

    const memText = await vm.getMemoryText();
    expect(memText).toBe('Memory Usage: -1000 MB', 'Single stopApps call decrements memory by 1000 MB even when starting at 0');

    const apps = await vm.getAppsCount();
    expect(apps).toBe(9);

    // No dialogs should have fired for this single call
    expect(dialogs.length).toBe(0);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Explicit invocation of wrong handleButtonClick signature (passing event) behaves as observed in UI clicks', async ({ page }) => {
    // This test programmatically invokes handleButtonClick with an actual event object
    // to replicate the erroneous behavior resulting from addEventListener('click', handleButtonClick).
    const vm = new VirtualMemoryPage(page);

    // Create a simple object resembling an event and pass it into handleButtonClick.
    // Because the function expects a string id, passing an object should not match any case and do nothing.
    await page.evaluate(() => {
      // Simulate the browser calling handleButtonClick with an event object
      handleButtonClick({ type: 'click', target: { id: 'run-apps' } });
    });

    // Memory should remain unchanged (empty)
    expect(await vm.getMemoryText()).toBe('');

    // Confirm there were no runtime errors during this incorrect invocation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity check: no unexpected ReferenceError/SyntaxError/TypeError occurred during page lifecycle', async ({ page }) => {
    // Per instructions, observe console and page errors and assert their states.
    // The implementation is expected to be broken in behavioral logic but not to throw runtime exceptions.
    // We assert that no ReferenceError/SyntaxError/TypeError occurred during the test session.
    expect(pageErrors.length).toBe(0, `Expected no runtime page errors but found: ${pageErrors.join(' | ')}`);
    expect(consoleErrors.length).toBe(0, `Expected no console errors but found: ${consoleErrors.join(' | ')}`);
  });
});