import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5af7210-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object Model for the Doubly Linked List static page
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(BASE_URL);
  }

  // Returns the document title
  async title() {
    return this.page.title();
  }

  // Return visible header text (h1)
  async headerText() {
    return this.page.textContent('h1');
  }

  // Count a set of likely interactive elements (buttons, inputs, selects)
  async countInteractiveElements() {
    return this.page.$$eval('button, input, select, textarea, a[href^="javascript:"]', els => els.length);
  }

  // Count script tags present in the document
  async countScriptTags() {
    return this.page.$$eval('script', els => els.length);
  }

  // Count occurrences of specific text in page (case-sensitive)
  async countTextOccurrences(text) {
    return this.page.$$eval('*', (els, t) => els.filter(e => e.textContent && e.textContent.includes(t)).length, text);
  }

  // Trigger an undefined global function in the page context asynchronously.
  // This schedules the call via setTimeout so the error is emitted as a pageerror event (uncaught).
  // Returns the Playwright pageerror event object.
  async triggerUndefinedFunctionAndWaitForError(functionName, timeout = 3000) {
    // Wait for the pageerror event. Schedule the call to happen asynchronously so evaluate doesn't reject.
    return Promise.all([
      this.page.waitForEvent('pageerror', { timeout }),
      this.page.evaluate((fn) => {
        // schedule the invocation so it becomes an uncaught error in the page context
        setTimeout(() => {
          // Intentionally call an undefined function to reproduce a ReferenceError if not defined.
          // We do not guard or patch anything; error should occur naturally if the function is missing.
          // Using indexing to avoid static analysis warnings.
          window[fn]();
        }, 0);
      }, functionName)
    ]).then(([error]) => error);
  }
}

test.describe('Doubly Linked List - FSM S0_Idle (Static Page)', () => {
  let page;
  let dllPage;
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate before each test
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // ignore any weird console parsing problems
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    dllPage = new DoublyLinkedListPage(page);
    await dllPage.goto();
  });

  test.afterEach(async () => {
    // Close page and context to ensure teardown
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('Page initial state: S0_Idle should render static content and have the expected title', async () => {
    // Verify the page title matches FSM evidence for S0_Idle
    const title = await dllPage.title();
    // The FSM evidence expects "<title>Doubly Linked List</title>"
    expect(title).toContain('Doubly Linked List');

    // Verify that the main header is present and contains correct text
    const header = await dllPage.headerText();
    expect(header).toBeTruthy();
    expect(header).toContain('Doubly Linked List');

    // Verify that the static descriptive text is present (some expected paragraph content)
    const occurrences = await dllPage.countTextOccurrences('Doubly Linked List (DLL) is a data structure');
    expect(occurrences).toBeGreaterThanOrEqual(1);

    // Ensure no script tags execute dynamic behavior (page is largely static)
    const scriptCount = await dllPage.countScriptTags();
    // The implementation contains no <script> tags (everything is in <pre>), so expect 0.
    expect(scriptCount).toBe(0);

    // Ensure there are no typical interactive elements (FSM extraction said none)
    const interactiveCount = await dllPage.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // There should be no uncaught page errors initially
    expect(pageErrors.length).toBe(0);

    // There may be no console messages because no scripts execute
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Entry action renderPage() from FSM should be absent -> invoking it leads to a ReferenceError (uncaught pageerror)', async () => {
    // The FSM defines an entry action "renderPage()". This page does not define renderPage.
    // We intentionally invoke renderPage asynchronously in-page so that an uncaught ReferenceError is emitted.
    const error = await dllPage.triggerUndefinedFunctionAndWaitForError('renderPage');

    // Validate that a pageerror was captured and contains the function name
    expect(error).toBeTruthy();
    const message = String(error.message || error.toString());
    // Error message format varies across engines; assert it references the missing function name.
    expect(message).toContain('renderPage');

    // The pageerror should have been pushed into our collected pageErrors via the listener
    // (listener may have collected it slightly later, but should include at least one item containing function name)
    const matched = pageErrors.some(err => String(err.message || err.toString()).includes('renderPage'));
    expect(matched).toBe(true);

    // Ensure that no DOM changes were made by this call (the page is static)
    const header = await dllPage.headerText();
    expect(header).toContain('Doubly Linked List');
  });

  test('Edge case: invoking other expected-but-absent functions from the implementation should produce ReferenceError', async () => {
    // The HTML contains code examples with class names and variables like Node, DoublyLinkedList, dll.
    // None of these are actually defined in the global scope because the code is inside <pre>.
    // We test that attempting to call them leads to uncaught ReferenceError events.

    // Try calling "DoublyLinkedList"
    const err1 = await dllPage.triggerUndefinedFunctionAndWaitForError('DoublyLinkedList');
    expect(String(err1.message || err1.toString())).toContain('DoublyLinkedList');

    // Try calling "dll"
    const err2 = await dllPage.triggerUndefinedFunctionAndWaitForError('dll');
    expect(String(err2.message || err2.toString())).toContain('dll');

    // Try calling "addNode" (also expected absent)
    const err3 = await dllPage.triggerUndefinedFunctionAndWaitForError('addNode');
    expect(String(err3.message || err3.toString())).toContain('addNode');

    // Confirm we captured at least three page errors from these attempts
    const errorMessages = pageErrors.map(e => String(e.message || e.toString()));
    const foundDoublyLinkedList = errorMessages.some(m => m.includes('DoublyLinkedList'));
    const foundDll = errorMessages.some(m => m.includes('dll'));
    const foundAddNode = errorMessages.some(m => m.includes('addNode'));
    expect(foundDoublyLinkedList).toBe(true);
    expect(foundDll).toBe(true);
    expect(foundAddNode).toBe(true);
  });

  test('There are no FSM transitions or events to trigger; validate absence of interactive controls and event handlers', async () => {
    // FSM declares 0 transitions/events. Confirm there are no clickable buttons/inputs that could represent transitions.
    const interactiveCount = await dllPage.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Confirm that there are no elements with onclick attributes or data-event attributes that suggest handlers
    const onclickCount = await page.$$eval('[onclick]', els => els.length);
    const dataEventCount = await page.$$eval('[data-event], [data-action], [data-handler]', els => els.length);
    expect(onclickCount).toBe(0);
    expect(dataEventCount).toBe(0);

    // Attempt to query for commonly used interactive containers (e.g., controls, canvas) and assert they are absent
    const canvasCount = await page.$$eval('canvas', els => els.length);
    const controlPanelCount = await page.$$eval('#controls, .controls, .toolbar', els => els.length);
    expect(canvasCount).toBe(0);
    expect(controlPanelCount).toBe(0);
  });

  test('Console observation: scheduling prints from non-existent functions should not produce console.log output (only errors)', async () => {
    // Attempt to call a function that would have logged to console if defined (e.g., printList)
    // This should result in an uncaught ReferenceError pageerror and not a console.log message.
    const error = await dllPage.triggerUndefinedFunctionAndWaitForError('printList');

    // Confirm the pageerror references the function name
    expect(String(error.message || error.toString())).toContain('printList');

    // Confirm that among the collected console messages there is no message indicating printed list values
    // (since code is not executed). We assert none of the console messages include 'Printing DLL' that appears in the example.
    const anyPrinting = consoleMessages.some(m => m.text && m.text.includes('Printing DLL'));
    expect(anyPrinting).toBe(false);
  });

  // Additional sanity check: ensure the static documentation sections exist
  test('Static documentation sections (Implementation, Algorithms, Theory, Applications, Conclusion) are present', async () => {
    const sections = ['Implementation', 'Algorithms', 'Theory', 'Applications', 'Conclusion'];
    for (const section of sections) {
      const count = await dllPage.countTextOccurrences(section);
      expect(count).toBeGreaterThanOrEqual(1);
    }

    // Verify that "Doubly Linked List Implementation" code-block exists as <pre>
    const preCount = await page.$$eval('pre', els => els.length);
    expect(preCount).toBeGreaterThanOrEqual(1);
  });
});