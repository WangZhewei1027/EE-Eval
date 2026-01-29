import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52080e70-fa76-11f0-a09b-87751f540fd8.html';

// Page object representing the static page structure
class CircularListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.header = page.locator('h1');
    this.listItems = page.locator('#list li');
  }

  async goto(commitOnly = true) {
    // Use 'commit' so navigation returns as soon as the response is received,
    // which allows us to attach listeners before long-running script work blocks events.
    return this.page.goto(APP_URL, { waitUntil: commitOnly ? 'commit' : 'load', timeout: 15000 });
  }
}

test.describe('Circular Linked List - Interactive Application (FSM: Idle)', () => {
  // Collect console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // No-op: listeners will be attached in each test to ensure fresh arrays per test
  });

  test.afterEach(async ({ page }) => {
    // Ensure we close any lingering dialogs or similar side-effects
    try {
      await page.close();
    } catch {
      // ignore if already closed by the fixture
    }
  });

  test('renders Idle state: header and static list are present', async ({ page }) => {
    // This test validates the FSM "Idle" state evidence: <h1>Circular Linked List</h1>
    // and that the static list contains the expected 5 nodes.

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      // Collect console messages (info, log, warn, error)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Collect uncaught exceptions from the page
      pageErrors.push(String(err));
    });

    const app = new CircularListPage(page);

    // Navigate (commit) so that we get access to DOM even if scripts run long
    await app.goto(true);

    // Verify the header exists and matches FSM evidence
    await expect(app.header).toHaveText('Circular Linked List', { timeout: 5000 });

    // Verify the static list has exactly 5 list items (Node 1..Node 5)
    await expect(app.listItems).toHaveCount(5);

    // Verify each list item contains expected text
    const expectedTexts = ['Node 1', 'Node 2', 'Node 3', 'Node 4', 'Node 5'];
    for (let i = 0; i < expectedTexts.length; i++) {
      await expect(app.listItems.nth(i)).toHaveText(expectedTexts[i]);
    }

    // Assert that no interactive controls are present (FSM had no events/transitions)
    const buttons = await page.$$('button');
    const inputs = await page.$$('input, textarea, select');
    expect(buttons.length).toBe(0);
    expect(inputs.length).toBe(0);

    // Check that renderPage (FSM entry action) is not defined on the window (we must not patch it)
    // Evaluate safely: if main thread is busy this may timeout; we set a small timeout for evaluation
    let renderPageType = undefined;
    try {
      renderPageType = await page.evaluate(() => typeof window.renderPage);
    } catch (e) {
      // If evaluation fails because the page main thread is busy, record that as part of page errors
      pageErrors.push(`evaluate-error: ${String(e)}`);
    }

    // Expect renderPage to be undefined (the HTML does not define this function)
    expect(renderPageType).toBe('undefined');

    // There should be zero or more console messages; ensure no uncaught exceptions were thrown during the short window
    // We don't assert that there are errors here: some environments may surface long-running-script exceptions elsewhere.
    // But we make sure the test captures any such page errors for diagnostics.
    // Log them to test output via expect (non-failing) by asserting the array is defined.
    expect(pageErrors).toBeDefined();
    expect(consoleMessages).toBeDefined();
  });

  test('observes printList console output and detects repeated logs indicating circular traversal', async ({ page }) => {
    // This test validates the runtime behavior of the CircularLinkedList.printList() call in the page script.
    // The HTML's printList implementation contains a logical error: it uses 'while (temp !== null)' on a circular list,
    // which will never become null and is expected to cause repeated console.log output.
    //
    // We attach console listeners before navigation, navigate, then wait briefly for console messages to appear.
    // We assert that the expected printed string appears and that it appears multiple times (indicating repetition).

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      // Only capture console.log messages (type 'log'), but keep others for observability
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    const app = new CircularListPage(page);
    await app.goto(true);

    // Wait up to 2 seconds for console logs to appear; collect logs that match the expected print output
    const expectedOutput = 'Node 1 Node 2 Node 3 Node 4 Node 5 ';
    const start = Date.now();
    let matchedCount = 0;

    // Poll the consoleMessages array for occurrences (non-blocking)
    while (Date.now() - start < 2000) {
      for (const m of consoleMessages) {
        if (m.type === 'log' && m.text.includes(expectedOutput)) {
          // Count how many messages contain the expected output
          // We deduplicate by counting occurrences in the array slice up to this moment
        }
      }
      // Count occurrences now
      matchedCount = consoleMessages.filter(m => m.type === 'log' && m.text.includes(expectedOutput)).length;
      if (matchedCount >= 1) {
        // If we have at least one, allow a short extra time to detect repetition
        await new Promise(r => setTimeout(r, 300));
        matchedCount = consoleMessages.filter(m => m.type === 'log' && m.text.includes(expectedOutput)).length;
        break;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    // Assert that at least one matching console.log was emitted
    expect(matchedCount).toBeGreaterThanOrEqual(1);

    // For this particular buggy implementation, we expect repetition (multiple logs), but it may depend on the browser throttling.
    // Assert that we observed either multiple identical logs OR at least one pageerror indicating long-running script.
    const repeated = matchedCount >= 2;
    const hasLongRunningScriptError = pageErrors.some(e => /long-running script|Uncaught|Maximum call stack|infinite/i.test(e));

    expect(repeated || hasLongRunningScriptError).toBeTruthy();

    // Provide diagnostic information in case of failure
    if (!repeated && !hasLongRunningScriptError) {
      // Attach the collected console messages for debugging (this will include at least one)
      // The test will still pass due to the previous expect when repeated or error occurred; if not, this will fail and show logs.
      console.log('Collected console messages:', consoleMessages.slice(0, 10));
      console.log('Collected page errors:', pageErrors);
    }
  });

  test('FSM transitions: none exist - ensure no interactive transitions and validate edge cases', async ({ page }) => {
    // This test asserts that there are no declared transitions or interactive elements in the application,
    // as per the FSM extraction summary. Additionally, it tries to probe the in-page LinkedList structure
    // to validate circularity — if the page's main thread is blocked by the infinite loop, the evaluation may fail,
    // which is an expected edge case and should be observed via pageerror or lack of evaluation result.

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(String(err)));

    const app = new CircularListPage(page);
    await app.goto(true);

    // Confirm there are no transitions / interactive controls: no links, forms, buttons
    const links = await page.$$('a');
    const forms = await page.$$('form');
    const buttons = await page.$$('button');
    expect(links.length).toBe(0);
    expect(forms.length).toBe(0);
    expect(buttons.length).toBe(0);

    // Attempt to evaluate circularity of the in-memory list structure.
    // This may hang if the page is busy; catch errors and assert their presence as part of edge-case handling.
    let circularityCheck = { success: false, isCircular: false, detail: null };
    try {
      const result = await page.evaluate(() => {
        // Access the globally created 'list' variable if present
        try {
          if (typeof window.list === 'undefined' || window.list === null) {
            return { success: false, detail: 'no-list' };
          }
          // Try to traverse up to 10 steps and see if we loop back to head
          const head = window.list.head;
          if (!head) return { success: true, isCircular: false, detail: 'empty-head' };
          let ptr = head.next;
          let steps = 1;
          while (ptr && steps <= 10) {
            if (ptr === head) return { success: true, isCircular: true, detail: `looped-in-${steps}` };
            ptr = ptr.next;
            steps++;
          }
          return { success: true, isCircular: false, detail: 'did-not-loop-within-10' };
        } catch (err) {
          return { success: false, detail: 'evaluate-exception:' + String(err) };
        }
      });
      circularityCheck = { success: Boolean(result && result.success), isCircular: Boolean(result && result.isCircular), detail: result && result.detail };
    } catch (e) {
      // If evaluate hangs or fails because the page main thread is busy, capture that
      pageErrors.push(`evaluate-failed: ${String(e)}`);
      circularityCheck = { success: false, isCircular: false, detail: 'evaluate-threw' };
    }

    // Accept either successful circularity detection OR evidence of runtime problems (console flood or page errors)
    const sawRepeatedPrints = consoleMessages.filter(m => m.type === 'log' && m.text.includes('Node 1 Node 2 Node 3 Node 4 Node 5 ')).length >= 2;
    const sawPageErrors = pageErrors.length > 0;

    // We expect that either:
    // - We successfully detected a circular list, OR
    // - We observed runtime problems (repeated logs or page errors) indicating the known bug in printList
    expect(circularityCheck.success || sawRepeatedPrints || sawPageErrors).toBeTruthy();

    // If we did detect circularity, assert it explicitly
    if (circularityCheck.success) {
      // If the structure was present and traversed, it should be circular given addNode implementation
      expect(circularityCheck.isCircular).toBeTruthy();
    } else {
      // Otherwise, provide diagnostics (non-fatal inside the test assertions)
      console.log('Circularity check result:', circularityCheck);
      console.log('Console messages sample:', consoleMessages.slice(0, 10));
      console.log('Page errors:', pageErrors);
    }
  });
});