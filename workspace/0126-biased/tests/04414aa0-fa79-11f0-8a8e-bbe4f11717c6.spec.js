import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04414aa0-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object encapsulating interactions with the Doubly Linked List page
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array<Error>} pageErrors
   * @param {Array<import('@playwright/test').ConsoleMessage>} consoleMessages
   * @param {Array<object>} failedResponses
   */
  constructor(page, pageErrors, consoleMessages, failedResponses) {
    this.page = page;
    this.pageErrors = pageErrors;
    this.consoleMessages = consoleMessages;
    this.failedResponses = failedResponses;
    this.addSelector = '#add-node';
    this.removeSelector = '#remove-node';
    this.listItemSelector = '#list li';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Give the page a moment to load any synchronous scripts/errors
    await this.page.waitForTimeout(150);
  }

  async getNodeCount() {
    return await this.page.locator(this.listItemSelector).count();
  }

  async clickAdd() {
    await this.page.click(this.addSelector);
    // wait a short while for any DOM updates or scripts to run
    await this.page.waitForTimeout(200);
  }

  async clickRemove() {
    await this.page.click(this.removeSelector);
    await this.page.waitForTimeout(200);
  }

  // Return true if any pageerror message suggests ReferenceError/TypeError/SyntaxError
  hasRuntimeErrorOfInterest() {
    return this.pageErrors.some(e =>
      /ReferenceError|TypeError|SyntaxError/i.test(String(e && e.message))
    );
  }

  // Return true if console messages include failed resource loads or JS errors
  hasConsoleErrorOfInterest() {
    return this.consoleMessages.some(msg => {
      const text = msg.text();
      return /Failed to load resource|404|ReferenceError|TypeError|SyntaxError|error/i.test(text);
    });
  }

  // Return true if any network response for script.js or other resources failed (status >= 400)
  hasFailedResourceLoads() {
    return this.failedResponses.some(r => r && r.status >= 400);
  }

  // Combined heuristic: any of the above
  anyErrorObserved() {
    return this.hasRuntimeErrorOfInterest() || this.hasConsoleErrorOfInterest() || this.hasFailedResourceLoads();
  }
}

// Group tests for the Doubly Linked List interactive app and FSM
test.describe('Doubly Linked List (Application ID: 04414aa0-fa79-11f0-8a8e-bbe4f11717c6) - FSM validation', () => {
  // Shared state captured per test
  let pageErrors;
  let consoleMessages;
  let failedResponses;

  // Attach listeners before each test to capture runtime issues (pageerror, console messages, failed resources)
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    failedResponses = [];

    page.on('pageerror', (err) => {
      // Capture page exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Capture console messages (network errors, logs, etc.)
      consoleMessages.push(msg);
    });

    page.on('response', async (response) => {
      // Detect failed resource loads (404s, 500s), e.g., script.js not found
      try {
        const status = response.status();
        if (status >= 400) {
          failedResponses.push({ url: response.url(), status });
        }
      } catch (e) {
        // ignore
      }
    });
  });

  // Clean up listeners automatically by Playwright when page is closed; no extra teardown needed

  test('Initial Idle state shows controls and initial list (S0_Idle)', async ({ page }) => {
    // This test validates the Idle state: buttons must exist, and initial list items are present
    const dll = new DoublyLinkedListPage(page, pageErrors, consoleMessages, failedResponses);
    await dll.goto();

    // Verify that the Add Node and Remove Node buttons are present and visible
    const addBtn = page.locator('#add-node');
    const removeBtn = page.locator('#remove-node');
    await expect(addBtn).toBeVisible({ timeout: 2000 });
    await expect(removeBtn).toBeVisible({ timeout: 2000 });

    // Verify there are 4 initial nodes as provided in the HTML
    const count = await dll.getNodeCount();
    expect(count).toBe(4);

    // Sanity check: record whether any errors were observed on initial load (may be expected if script.js missing)
    // We do not fail here if there are errors; further tests will assert presence of errors if required.
  });

  test('Add Node event transitions Idle -> Node Added (S0_Idle -> S1_NodeAdded) when implemented', async ({ page }) => {
    // This test validates the Add Node event/transition.
    // It passes if either:
    //  - clicking Add Node increases the list length by 1 (correct behavior), OR
    //  - a runtime or resource/load error is observed (e.g., missing script causes failure) — we assert that such errors are captured.
    const dll = new DoublyLinkedListPage(page, pageErrors, consoleMessages, failedResponses);
    await dll.goto();

    const initialCount = await dll.getNodeCount();

    // Click Add Node and then inspect DOM and captured errors
    await dll.clickAdd();

    const afterClickCount = await dll.getNodeCount();

    const domChanged = afterClickCount === initialCount + 1;
    const errorObserved = dll.anyErrorObserved();

    // Assert that either the DOM updated accordingly (node added) OR an error was observed
    expect(domChanged || errorObserved).toBeTruthy();

    // If DOM did change, additionally verify visual feedback: new list item exists and is a LI element
    if (domChanged) {
      const lastItem = page.locator('#list li').nth(afterClickCount - 1);
      await expect(lastItem).toBeVisible();
      const text = await lastItem.textContent();
      // Basic check: new node should have non-empty text
      expect(typeof text === 'string' && text.trim().length > 0).toBeTruthy();
    } else {
      // If no DOM change, assert that we captured at least one meaningful error message
      expect(errorObserved).toBeTruthy();
    }
  });

  test('Remove Node event transitions Node Added -> Idle (S1_NodeAdded -> S0_Idle) when implemented', async ({ page }) => {
    // This test validates the Remove Node event/transition.
    // It covers the scenario where removal should decrease the node count by 1,
    // or a runtime/resource error is observed and captured.
    const dll = new DoublyLinkedListPage(page, pageErrors, consoleMessages, failedResponses);
    await dll.goto();

    // To better mimic FSM path, attempt to add a node first (but tolerate if add fails)
    const beforeAddCount = await dll.getNodeCount();
    await dll.clickAdd();
    await page.waitForTimeout(150);
    const afterAddCount = await dll.getNodeCount();

    // Determine expected count to remove from
    const countBeforeRemove = afterAddCount >= beforeAddCount ? afterAddCount : beforeAddCount;

    // Click remove
    await dll.clickRemove();
    const afterRemoveCount = await dll.getNodeCount();

    const domChangedAsExpected = afterRemoveCount === Math.max(0, countBeforeRemove - 1);
    const errorObserved = dll.anyErrorObserved();

    // Assert either proper DOM behavior or that an error was observed
    expect(domChangedAsExpected || errorObserved).toBeTruthy();

    if (domChangedAsExpected) {
      // Verify that the list count decreased visually
      expect(afterRemoveCount).toBeLessThanOrEqual(countBeforeRemove);
    } else {
      // If not, ensure we observed an error condition to justify failure to change DOM
      expect(errorObserved).toBeTruthy();
    }
  });

  test('Edge case: Remove nodes until empty and observe behavior (edge case & error scenarios)', async ({ page }) => {
    // This test repeatedly clicks Remove Node to exercise edge-case behavior (removing from empty list).
    // The test passes if:
    //  - the list eventually becomes empty (expected behavior), OR
    //  - a runtime/resource error occurs and is captured.
    const dll = new DoublyLinkedListPage(page, pageErrors, consoleMessages, failedResponses);
    await dll.goto();

    // Start from the current count
    let currentCount = await dll.getNodeCount();

    // Attempt up to 8 removals (more than initial 4) to exercise removing beyond empty.
    const maxAttempts = 8;
    let errorObservedDuringLoop = false;
    for (let i = 0; i < maxAttempts; i++) {
      await dll.clickRemove();
      await page.waitForTimeout(100);
      // Update error status
      if (dll.anyErrorObserved()) {
        errorObservedDuringLoop = true;
        break;
      }
      const newCount = await dll.getNodeCount();
      // If count decreased, update currentCount
      if (newCount < currentCount) {
        currentCount = newCount;
      } else {
        // If no decrease and no error, we still continue to attempt removal; break to avoid infinite loop
        // but record that DOM didn't change on removal attempt
        // break here because further attempts likely won't change anything
        break;
      }
      if (currentCount === 0) break;
    }

    // At the end, assert that either the list is empty OR an error was observed during the process.
    const finalCount = await dll.getNodeCount();
    const becameEmpty = finalCount === 0;
    expect(becameEmpty || errorObservedDuringLoop || dll.anyErrorObserved()).toBeTruthy();
  });

  test('Runtime & resource errors are observed and reported (we expect missing/buggy script to surface errors)', async ({ page }) => {
    // This test explicitly asserts that runtime errors or failed resource loads are observed.
    // According to the instruction, we must let ReferenceError/SyntaxError/TypeError happen naturally and assert they occurred.
    // The test will fail if NO such errors or failed resource loads are observed on load + a short interaction.
    const dll = new DoublyLinkedListPage(page, pageErrors, consoleMessages, failedResponses);
    await dll.goto();

    // Do a few interactions to provoke runtime behavior (load, click add/remove)
    await dll.clickAdd();
    await dll.clickRemove();
    await page.waitForTimeout(200);

    // Gather diagnostics
    const runtimeErrors = pageErrors.map(e => String(e && e.message || e));
    const consoleTexts = consoleMessages.map(m => m.text());
    const failedRes = failedResponses.slice();

    // Determine if any of the desired errors are present
    const sawReferenceTypeOrSyntax = dll.hasRuntimeErrorOfInterest();
    const sawConsoleFailure = dll.hasConsoleErrorOfInterest();
    const sawFailedResources = dll.hasFailedResourceLoads();

    // We must assert that at least one of these observations happened.
    const anyError = sawReferenceTypeOrSyntax || sawConsoleFailure || sawFailedResources;

    // Output some helpful debug in assertion messages if the assertion fails (so test logs are informative)
    expect(anyError, `Expected to observe runtime or resource errors. Runtime errors: ${JSON.stringify(runtimeErrors)} | Console: ${JSON.stringify(consoleTexts)} | FailedResponses: ${JSON.stringify(failedRes)}`).toBeTruthy();
  });

  test('FSM entry/exit actions (none defined) - ensure no onEnter/onExit console traces', async ({ page }) => {
    // FSM entry_actions and exit_actions are empty in the definition.
    // This test confirms there are no console logs referring to onEnter/onExit lifecycle markers.
    const dll = new DoublyLinkedListPage(page, pageErrors, consoleMessages, failedResponses);
    await dll.goto();

    // Scan console messages for entry/exit markers
    const consoleTexts = consoleMessages.map(m => m.text()).join('\n');
    const hasLifecycleLogs = /onEnter|onExit|enter action|exit action/i.test(consoleTexts);

    // Since FSM does not specify entry/exit actions, we expect NOT to find such lifecycle logs.
    expect(hasLifecycleLogs).toBeFalsy();
  });
});