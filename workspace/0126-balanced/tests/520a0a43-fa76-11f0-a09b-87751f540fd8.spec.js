import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a0a43-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for interacting with the Thread Example app
class ThreadPage {
  constructor(page) {
    this.page = page;
  }

  // Get the raw innerText of the primary thread container (#thread)
  async getMainThreadText() {
    const txt = await this.page.locator('#thread').innerText();
    return txt.trim();
  }

  // Get all visible thread-like elements' texts by selector (including any dynamically added)
  async getAllThreadTexts() {
    // We consider any divs that contain "Thread" text as thread-related elements
    const handles = await this.page.$$eval('div, #thread', els =>
      els
        .filter(el => el && el.innerText && el.innerText.trim().length > 0 && /Thread\s*\d+/i.test(el.innerText))
        .map(el => el.innerText.trim())
    );
    return handles;
  }

  // Call the global createThread function
  async callCreateThread() {
    await this.page.evaluate(() => {
      // invoke the existing createThread defined by the page
      if (typeof createThread === 'function') {
        createThread();
      } else {
        // no-op if missing so evaluation doesn't throw in tests that inspect missing functions
      }
    });
  }

  // Call the global updateThread function
  async callUpdateThread() {
    await this.page.evaluate(() => {
      if (typeof updateThread === 'function') {
        updateThread();
      }
    });
  }

  // Append a new div to the DOM and also push it into the page's thread array (to emulate distinct threads)
  // Returns the new element id
  async appendNewThreadElement() {
    const id = await this.page.evaluate(() => {
      const newDiv = document.createElement('div');
      // generate a unique id for visibility
      const newId = `thread-dynamic-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      newDiv.id = newId;
      document.body.appendChild(newDiv);
      // push into existing thread array if present
      if (Array.isArray(window.thread)) {
        window.thread.push(newDiv);
      }
      return newId;
    });
    return id;
  }

  // Intentionally corrupt the thread array by pushing a non-element (null) to provoke errors
  async pushNullIntoThread() {
    await this.page.evaluate(() => {
      if (Array.isArray(window.thread)) {
        window.thread.push(null);
      } else {
        // create thread for the sake of the test (do not redefine functions, only modify existing variable)
        window.thread = [null];
      }
    });
  }

  // Read page-scoped variables for assertions
  async getPageVariables() {
    return await this.page.evaluate(() => {
      return {
        threadLength: Array.isArray(window.thread) ? window.thread.length : null,
        currentThread: typeof window.currentThread === 'number' ? window.currentThread : null,
        hasCreateThread: typeof window.createThread === 'function',
        hasUpdateThread: typeof window.updateThread === 'function',
      };
    });
  }
}

test.describe('Thread Example FSM and DOM validation', () => {
  let page;
  let threadPage;
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context and page per test to avoid cross-test state leakage
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and page errors to assert later
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    threadPage = new ThreadPage(page);

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Close page context to free resources
    await page.close();
  });

  test('Initial State (S0 -> S1 via createThread on load): createThread executed and DOM shows "Thread 1: Thread 0"', async () => {
    // This test validates:
    // - The page runs createThread() on load (S0 entry action)
    // - The primary thread container displays "Thread 1: Thread 0"
    // - No uncaught page errors occurred during initial load
    const mainText = await threadPage.getMainThreadText();
    expect(mainText).toContain('Thread 1: Thread 0');

    // Verify page-scoped variables reflect expected state after createThread()
    const vars = await threadPage.getPageVariables();
    expect(vars.hasCreateThread).toBe(true);
    expect(vars.hasUpdateThread).toBe(true);
    // currentThread should have incremented to 1 after initial createThread call
    expect(vars.currentThread).toBe(1);
    // thread array should have length 1 (the implementation pushes the same #thread element)
    expect(vars.threadLength).toBe(1);

    // Ensure no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Explicit CreateThread and UpdateThread calls: verify DOM behavior and transition effects', async () => {
    // This test validates:
    // - Calling createThread() again updates internal counters and DOM
    // - Calling updateThread() updates each element in the thread array
    // - Because the implementation stores references to the same element, updateThread may overwrite previous content
    // Step 1: Ensure initial single thread text exists
    let mainText = await threadPage.getMainThreadText();
    expect(mainText).toBe('Thread 1: Thread 0');

    // Step 2: Call createThread() manually to simulate another thread creation (FSM event: CreateThread)
    await threadPage.callCreateThread();

    // After calling createThread() a second time, due to implementation details, the #thread element will be set to "Thread 2: Thread 1"
    mainText = await threadPage.getMainThreadText();
    expect(mainText).toBe('Thread 2: Thread 1');

    // Inspect variables: thread length should now be 2 (same element pushed twice), currentThread should be 2
    const varsAfterCreate = await threadPage.getPageVariables();
    expect(varsAfterCreate.threadLength).toBe(2);
    expect(varsAfterCreate.currentThread).toBe(2);

    // Step 3: Call updateThread() to trigger S1 -> S1 UpdateThread event
    await threadPage.callUpdateThread();

    // Because the thread array contains two references to the same element, updateThread will ultimately leave the single element with the content from the last iteration
    const finalMainText = await threadPage.getMainThreadText();
    // Expect the last assignment to be 'Thread 2: Thread 1' given how updateThread iterates and overwrites the shared element
    expect(finalMainText).toBe('Thread 2: Thread 1');

    // There should still only be one visible <p> inside the #thread container
    const childCount = await page.$eval('#thread', el => el.childElementCount);
    expect(childCount).toBe(1);

    // No uncaught page errors should have happened during these normal function calls
    expect(pageErrors.length).toBe(0);
  });

  test('Creating a distinct second DOM element, pushing it into thread and running updateThread shows both "Thread 1" and "Thread 2"', async () => {
    // This test validates an edge case:
    // If distinct DOM elements are added and pushed into the page.thread array, updateThread will populate each separately
    // Step: Append a new element and push into thread
    const newId = await threadPage.appendNewThreadElement();
    // Now invoke updateThread to populate both elements
    await threadPage.callUpdateThread();

    // Gather all thread-texts visible across the document
    const texts = await threadPage.getAllThreadTexts();

    // There should be at least two thread-like elements visible (the original #thread and the newly added one)
    // They should reflect Thread 1: Thread 0 and Thread 2: Thread 1 respectively
    // We check that both expected lines are present somewhere in the collected texts
    const hasThread1 = texts.some(t => /Thread\s*1:\s*Thread\s*0/i.test(t));
    const hasThread2 = texts.some(t => /Thread\s*2:\s*Thread\s*1/i.test(t));

    expect(hasThread1).toBe(true);
    expect(hasThread2).toBe(true);

    // Ensure no uncaught errors during the dynamic element addition and update
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: corrupt thread array by pushing null then calling updateThread() should produce a TypeError (uncaught pageerror)', async () => {
    // This test validates error handling and ensures we observe natural runtime errors without patching the app
    // Prepare to collect errors that happen as a result of this action
    // Corrupt the thread array by pushing null
    await threadPage.pushNullIntoThread();

    // Clear previous pageErrors collected during navigation to isolate this test's error
    pageErrors = [];

    // Call updateThread and allow the page error to be thrown naturally
    // Because updateThread attempts to access element.innerHTML, pushing null will cause a TypeError
    // We call updateThread inside a page.evaluate to ensure the exception is thrown in page context
    await threadPage.callUpdateThread();

    // Wait a short time for the pageerror event to fire and be captured
    // (Playwright's event capture is synchronous to the event loop, but a small timeout ensures propagation)
    await new Promise(resolve => setTimeout(resolve, 100));

    // There should be at least one page error recorded
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error message should indicate an issue with innerHTML or reading properties of null/undefined
    const messages = pageErrors.map(err => err.message || String(err));
    const matched = messages.some(msg => /innerHTML|Cannot read property 'innerHTML'|Cannot set properties of null|Cannot set property 'innerHTML'|cannot read.*innerHTML/i.test(msg));
    expect(matched).toBe(true);
  });

  test('Console messages and general behaviors: we record console output and ensure functions exist', async () => {
    // This test verifies:
    // - The page exposes the expected functions (createThread, updateThread)
    // - We capture any console messages emitted on page load
    const vars = await threadPage.getPageVariables();
    expect(vars.hasCreateThread).toBe(true);
    expect(vars.hasUpdateThread).toBe(true);

    // There may be zero or more console messages; ensure our listener captured them as an array
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Optionally assert that no severe console types like 'error' are present on a clean load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});