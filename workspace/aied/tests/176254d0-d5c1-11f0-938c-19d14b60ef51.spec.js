import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/176254d0-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Queue application
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.queueSelector = '#queue';
    this.inputSelector = '#queueInput';
    this.enqueueButton = 'button[onclick="enqueue()"]';
    this.dequeueButton = 'button[onclick="dequeue()"]';
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  // Enter text into input (replaces existing value)
  async fillInput(value) {
    await this.page.fill(this.inputSelector, value);
  }

  // Click Enqueue button
  async clickEnqueue() {
    await this.page.click(this.enqueueButton);
  }

  // Click Dequeue button
  async clickDequeue() {
    await this.page.click(this.dequeueButton);
  }

  // Returns array of queue item texts in DOM order
  async getQueueItems() {
    return await this.page.$$eval(`${this.queueSelector} .queue-item`, nodes =>
      nodes.map(n => n.textContent.trim())
    );
  }

  // Returns current value of input field
  async getInputValue() {
    return await this.page.$eval(this.inputSelector, el => el.value);
  }

  // Returns innerHTML of queue container (useful to assert styling/structure)
  async getQueueInnerHTML() {
    return await this.page.$eval(this.queueSelector, el => el.innerHTML);
  }

  // Utility to wait for an alert and capture its message.
  // Returns the message text; automatically accepts the dialog.
  async captureNextAlert(timeout = 5000) {
    return new Promise((resolve) => {
      const onDialog = async (dialog) => {
        try {
          resolve(dialog.message());
        } finally {
          await dialog.accept();
          this.page.off('dialog', onDialog);
        }
      };
      this.page.on('dialog', onDialog);
      // fallback timeout to avoid dangling promise in case no dialog appears
      setTimeout(() => {
        // remove listener and resolve with null if none fired
        this.page.off('dialog', onDialog);
        resolve(null);
      }, timeout);
    });
  }
}

test.describe('Queue FSM - Interactive Application (176254d0-d5c1-11f0-938c-19d14b60ef51)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console.error messages and page errors for assertions
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial rendering and state checks (S0_Idle)', () => {
    test('renders page with input, enqueue and dequeue buttons and empty queue', async ({ page }) => {
      // This test validates the Idle state: initial elements present and queue empty
      const app = new QueuePage(page);
      await app.goto();

      // Verify structural elements exist
      await expect(page.locator('#queue')).toBeVisible();
      await expect(page.locator('#queueInput')).toBeVisible();
      await expect(page.locator('button[onclick="enqueue()"]')).toBeVisible();
      await expect(page.locator('button[onclick="dequeue()"]')).toBeVisible();

      // Queue should be empty on initial render
      const items = await app.getQueueItems();
      expect(items.length).toBe(0);

      // Verify input placeholder text (evidence of component)
      const placeholder = await page.getAttribute('#queueInput', 'placeholder');
      expect(placeholder).toBe('Enter a value');

      // Verify entry/exit action functions existence as per FSM:
      // - renderPage() was listed as entry action for Idle; it is NOT present in the HTML implementation.
      // - updateQueueDisplay() is present and should be a function.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
      const hasUpdateQueueDisplay = await page.evaluate(() => typeof window.updateQueueDisplay === 'function');

      // renderPage should not exist in the provided implementation
      expect(hasRenderPage).toBe(false);
      // updateQueueDisplay should be present
      expect(hasUpdateQueueDisplay).toBe(true);

      // Ensure no console or page errors occurred during initial load
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Enqueue transitions (S0 -> S1, S1 -> S0)', () => {
    test('enqueue a single item updates display and clears input (Idle -> Item Enqueued)', async ({ page }) => {
      // This test validates the Enqueue transition: adding an item leads to DOM update and input cleared
      const app = new QueuePage(page);
      await app.goto();

      // Fill input and click Enqueue
      await app.fillInput('A');
      // prepare to capture any alert (should be none)
      const alertPromise = app.captureNextAlert(500);
      await app.clickEnqueue();
      const alertText = await alertPromise;

      // No alert should be shown on enqueue
      expect(alertText).toBeNull();

      // Input should be cleared after enqueue as per FSM evidence: input.value = ""
      const inputVal = await app.getInputValue();
      expect(inputVal).toBe('');

      // Queue display should include the enqueued item
      const items = await app.getQueueItems();
      expect(items).toEqual(['A']);

      // Ensure updateQueueDisplay exists and has been used (we infer usage by DOM change)
      const innerHTML = await app.getQueueInnerHTML();
      expect(innerHTML).toContain('queue-item');
      expect(innerHTML).toContain('A');

      // No errors expected
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('enqueue multiple items preserves FIFO order and transitions back to Idle', async ({ page }) => {
      // This test enqueues multiple items to validate repeated Enqueue transitions and queue order
      const app = new QueuePage(page);
      await app.goto();

      // Enqueue A
      await app.fillInput('A');
      await app.clickEnqueue();

      // Enqueue B
      await app.fillInput('B');
      await app.clickEnqueue();

      // Enqueue C
      await app.fillInput('C');
      await app.clickEnqueue();

      const items = await app.getQueueItems();
      expect(items).toEqual(['A', 'B', 'C']);

      // No alerts on enqueue
      // Ensure input cleared after last enqueue
      expect(await app.getInputValue()).toBe('');

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('does not enqueue empty string (edge case)', async ({ page }) => {
      // This ensures that clicking Enqueue with empty input does not modify the queue
      const app = new QueuePage(page);
      await app.goto();

      // Precondition: queue empty
      expect(await app.getQueueItems()).toEqual([]);

      // Ensure input is empty and click Enqueue
      await app.fillInput('');
      await app.clickEnqueue();

      // Still empty
      expect(await app.getQueueItems()).toEqual([]);

      // No alerts and no errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('enqueues whitespace (implementation detail: whitespace is truthy and will be enqueued)', async ({ page }) => {
      // Demonstrates how the implementation treats whitespace as a value (no trimming)
      const app = new QueuePage(page);
      await app.goto();

      await app.fillInput('   '); // spaces
      await app.clickEnqueue();

      const items = await app.getQueueItems();
      // The visible text will contain spaces; after trim() in getter we expect empty string for display,
      // but the implementation wraps the raw value. We assert that an item exists and that innerHTML contains a div.
      expect(items.length).toBe(1);
      // Since getter trimmed the textContent, a pure space becomes empty string - assert item exists but may be empty text
      expect(items[0].length).toBeGreaterThanOrEqual(0);

      // Clean up by dequeuing the whitespace entry to avoid interference with subsequent tests
      const alertPromise = app.captureNextAlert(500);
      await app.clickDequeue();
      const alertText = await alertPromise;
      // Should alert "Dequeued:    " (spaces). Trimmed message comparison is not done; ensure alert contains 'Dequeued' prefix.
      expect(alertText).toMatch(/^Dequeued:/);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Dequeue transitions (S0 -> S2, S2 -> S0, S0 -> S3 Underflow)', () => {
    test('dequeue from non-empty queue alerts dequeued item and updates display (ItemDequeued)', async ({ page }) => {
      // This validates that Dequeue pops front element, shows alert and updates DOM
      const app = new QueuePage(page);
      await app.goto();

      // Setup: enqueue two items A, B
      await app.fillInput('A');
      await app.clickEnqueue();
      await app.fillInput('B');
      await app.clickEnqueue();

      // Dequeue: should alert "Dequeued: A" and leave B in queue
      const alertPromise = app.captureNextAlert(3000);
      await app.clickDequeue();
      const alertText = await alertPromise;

      expect(alertText).toBe('Dequeued: A');

      // Queue should now contain only B
      const items = await app.getQueueItems();
      expect(items).toEqual(['B']);

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('dequeue until empty then further dequeue triggers Underflow alert (Underflow state)', async ({ page }) => {
      // This validates the Underflow transition when dequeuing an empty queue
      const app = new QueuePage(page);
      await app.goto();

      // Ensure queue is empty
      // If leftover items exist from previous test, clear them by dequeuing until empty.
      // (This ensures test isolation in case environment persisted state unexpectedly.)
      let items = await app.getQueueItems();
      while (items.length > 0) {
        const p = app.captureNextAlert(500);
        await app.clickDequeue();
        await p;
        items = await app.getQueueItems();
      }

      // Now queue is empty. Dequeue should trigger alert "Underflow"
      const alertPromise = app.captureNextAlert(3000);
      await app.clickDequeue();
      const alertText = await alertPromise;

      expect(alertText).toBe('Underflow');

      // Queue should remain empty
      expect(await app.getQueueItems()).toEqual([]);

      // No console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('repeated Dequeue on Underflow does not break application (S3 -> S0 then S3 again possible)', async ({ page }) => {
      // This exercise repeatedly dequeues on empty queue to ensure app responds consistently with Underflow alerts
      const app = new QueuePage(page);
      await app.goto();

      // Guarantee empty
      let items = await app.getQueueItems();
      while (items.length > 0) {
        const p = app.captureNextAlert(500);
        await app.clickDequeue();
        await p;
        items = await app.getQueueItems();
      }

      // Click Dequeue three times and collect alerts
      const alerts = [];
      for (let i = 0; i < 3; i++) {
        const p = app.captureNextAlert(2000);
        await app.clickDequeue();
        const text = await p;
        alerts.push(text);
      }

      // Each should be 'Underflow'
      expect(alerts.every(a => a === 'Underflow')).toBe(true);

      // Still no console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Implementation details and error observation', () => {
    test('verify critical functions mentioned in FSM are present or absent as expected', async ({ page }) => {
      // FSM references renderPage() on entry to Idle; implementation does not provide renderPage
      // FSM references updateQueueDisplay() for entry to ItemEnqueued/ItemDequeued; implementation provides it.
      const app = new QueuePage(page);
      await app.goto();

      const fnExists = await page.evaluate(() => {
        return {
          renderPage: typeof window.renderPage === 'function',
          updateQueueDisplay: typeof window.updateQueueDisplay === 'function',
          enqueueFn: typeof window.enqueue === 'function',
          dequeueFn: typeof window.dequeue === 'function',
        };
      });

      // renderPage is missing in implementation -> expected false
      expect(fnExists.renderPage).toBe(false);
      // updateQueueDisplay should exist
      expect(fnExists.updateQueueDisplay).toBe(true);
      // enqueue and dequeue functions should exist (wired to buttons)
      expect(fnExists.enqueueFn).toBe(true);
      expect(fnExists.dequeueFn).toBe(true);

      // Observe console and page errors during this check
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('observe console logs and page errors during typical usage (no unexpected errors)', async ({ page }) => {
      // This test monitors console and page errors during a normal flow: enqueue then dequeue.
      const app = new QueuePage(page);

      const capturedConsoleErrors = [];
      const capturedPageErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') capturedConsoleErrors.push(msg.text());
      });
      page.on('pageerror', err => capturedPageErrors.push(err));

      await app.goto();

      await app.fillInput('X');
      await app.clickEnqueue();

      const p = app.captureNextAlert(2000);
      await app.clickDequeue();
      await p; // consume alert

      // Assert there were no runtime console errors or page errors
      expect(capturedConsoleErrors).toEqual([]);
      expect(capturedPageErrors).toEqual([]);
    });
  });
});