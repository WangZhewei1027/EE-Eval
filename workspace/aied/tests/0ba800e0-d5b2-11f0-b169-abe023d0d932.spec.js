import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba800e0-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the Queue application
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputSelector = '.input-field';
    this.buttonSelector = '.input-btn';
    this.outputSelector = '.output-field';
    this.outputInnerP = '#output';
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async fillInput(value) {
    await this.page.fill(this.inputSelector, value);
  }

  async clickAdd() {
    await this.page.click(this.buttonSelector);
  }

  async getOutputHTML() {
    return await this.page.$eval(this.outputSelector, el => el.innerHTML);
  }

  async getOutputText() {
    return await this.page.$eval(this.outputSelector, el => el.innerText);
  }

  async getInputValue() {
    return await this.page.$eval(this.inputSelector, el => el.value);
  }

  async getQueueArray() {
    return await this.page.evaluate(() => {
      // Access the page global variable 'queue' if present
      return typeof queue !== 'undefined' ? queue.slice() : null;
    });
  }

  async callDisplayQueue() {
    // Call the page's displayQueue function if it exists
    return await this.page.evaluate(() => {
      if (typeof displayQueue === 'function') {
        displayQueue();
        return true;
      }
      return false;
    });
  }
}

test.describe('Queue App FSM - Comprehensive E2E tests', () => {
  // Arrays to capture console errors and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors before navigation to capture any errors during load
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture only errors from console
      if (msg.type() === 'error') {
        try {
          consoleErrors.push(msg.text());
        } catch {
          consoleErrors.push(String(msg));
        }
      }
    });

    page.on('pageerror', err => {
      // Capture runtime exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err.message);
    });
  });

  test('Initial state S0_Idle: displayQueue invoked on load -> output empty and queue initialized', async ({ page }) => {
    // This test validates the initial state S0_Idle and entry action displayQueue()
    const app = new QueuePage(page);
    await app.navigate();

    // Verify the output area is empty (displayQueue on an empty queue should render no <p> items)
    const outputHTML = await app.getOutputHTML();
    expect(outputHTML).toBe(''); // The implementation sets output.innerHTML = '' on displayQueue with empty queue

    // Verify the global queue exists and is an empty array
    const queue = await app.getQueueArray();
    expect(Array.isArray(queue)).toBe(true);
    expect(queue.length).toBe(0);

    // Ensure no console errors or page errors happened during load/initialization
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('AddMessage transition S0 -> S1: adding a non-empty message updates queue and shows "Message added: <message>"', async ({ page }) => {
    // This test validates the transition from Idle to Message Added when clicking the Add Message button
    const app = new QueuePage(page);
    await app.navigate();

    // Add a single message
    await app.fillInput('hello');
    await app.clickAdd();

    // After addMessage(), implementation should push to queue and set output to "Message added: hello"
    const outputText = await app.getOutputText();
    expect(outputText).toContain('Message added: hello');

    // Queue should contain the new message
    const queue = await app.getQueueArray();
    expect(Array.isArray(queue)).toBe(true);
    expect(queue.length).toBe(1);
    expect(queue[0]).toBe('hello');

    // Input field should be cleared per implementation
    const inputVal = await app.getInputValue();
    expect(inputVal).toBe('');

    // No console/page errors should have occurred
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('AddMessage from S1: implementation vs FSM expectation and explicit displayQueue invocation', async ({ page }) => {
    // This test attempts to exercise the FSM's two-step transitions:
    // 1) S0 -> S1 on first AddMessage (which sets "Message added: ...")
    // 2) S1 -> S0 on next AddMessage is expected by the FSM to call displayQueue()
    //
    // The implementation does not automatically call displayQueue() on the second addMessage call,
    // so this test asserts the actual behavior and then calls displayQueue() explicitly to verify queue rendering.

    const app = new QueuePage(page);
    await app.navigate();

    // Add first message
    await app.fillInput('first');
    await app.clickAdd();

    // Confirm first add shows "Message added: first"
    let outputText = await app.getOutputText();
    expect(outputText).toContain('Message added: first');

    // Add second message (transition from S1 with event AddMessage)
    await app.fillInput('second');
    await app.clickAdd();

    // Implementation sets output to "Message added: second" again (it does NOT call displayQueue automatically)
    outputText = await app.getOutputText();
    expect(outputText).toContain('Message added: second');

    // FSM expectation (displayQueue showing queued <p> elements) is not met automatically.
    // Assert that the output does not contain a <p>first</p> element yet (i.e., displayQueue not auto-called).
    const outputHTML = await app.getOutputHTML();
    expect(outputHTML).not.toContain('<p>first</p>');

    // Now explicitly call displayQueue() (simulating what the FSM expected on S1->S0)
    const called = await app.callDisplayQueue();
    expect(called).toBe(true); // displayQueue should exist and be callable per implementation

    // After calling displayQueue(), output should contain both queued messages in <p> tags (order maintained)
    const outputAfterDisplay = await app.getOutputHTML();
    expect(outputAfterDisplay).toContain('<p>first</p>');
    expect(outputAfterDisplay).toContain('<p>second</p>');

    // Check the queue length and order
    const queue = await app.getQueueArray();
    expect(queue.length).toBe(2);
    expect(queue[0]).toBe('first');
    expect(queue[1]).toBe('second');

    // No console/page errors should have occurred during these interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking Add Message with an empty input does not modify queue or output', async ({ page }) => {
    // This test verifies the guard clause in addMessage() that prevents adding empty messages.
    const app = new QueuePage(page);
    await app.navigate();

    // Pre-populate queue with a known value for robustness
    await app.fillInput('preexisting');
    await app.clickAdd();

    let queue = await app.getQueueArray();
    expect(queue.length).toBe(1);
    expect(queue[0]).toBe('preexisting');

    // Now attempt to click Add Message with an empty input field
    await app.fillInput(''); // ensure empty
    await app.clickAdd();

    // Queue should remain unchanged
    queue = await app.getQueueArray();
    expect(queue.length).toBe(1);
    expect(queue[0]).toBe('preexisting');

    // Output should NOT be updated to "Message added: " (empty)
    const outputText = await app.getOutputText();
    expect(outputText).not.toContain('Message added:');

    // No console/page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity checks: addMessage and displayQueue functions exist and are callable; capture console/page errors during function invocation', async ({ page }) => {
    // This test validates the presence of functions and ensures calling them does not produce runtime errors.
    const app = new QueuePage(page);
    await app.navigate();

    // Validate functions exist on the window
    const functionsExist = await page.evaluate(() => {
      return {
        hasAddMessage: typeof addMessage === 'function',
        hasDisplayQueue: typeof displayQueue === 'function'
      };
    });
    expect(functionsExist.hasAddMessage).toBe(true);
    expect(functionsExist.hasDisplayQueue).toBe(true);

    // Call displayQueue (should be safe even on empty queue)
    const displayCalled = await app.callDisplayQueue();
    expect(displayCalled).toBe(true);

    // Call addMessage with an explicit non-empty value via DOM operations (simulate normal click flow)
    await app.fillInput('sanity');
    await app.clickAdd();

    // Verify queue includes the 'sanity' message
    const queue = await app.getQueueArray();
    expect(queue.includes('sanity')).toBe(true);

    // Ensure no console errors or page errors occurred during these calls
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});