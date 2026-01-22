import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa71e1-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Sliding Window FSM - 0baa71e1-d5b2-11f0-b169-abe023d0d932', () => {
  // Page object for the sliding window app
  class SlidingWindowPage {
    constructor(page) {
      this.page = page;
      this.input = page.locator('#window');
      this.addButton = page.locator('#add');
      this.removeButton = page.locator('#remove');
      this.windowContent = page.locator('#window-content');
    }

    async goto() {
      await this.page.goto(APP_URL);
    }

    async fillInput(text) {
      await this.input.fill(text);
    }

    async clickAdd() {
      await this.addButton.click();
    }

    async clickRemove() {
      await this.removeButton.click();
    }

    async getContentCount() {
      return await this.windowContent.locator(':scope > *').count();
    }

    async getLastContentText() {
      const count = await this.getContentCount();
      if (count === 0) return null;
      const last = this.windowContent.locator(':scope > *').nth(count - 1);
      return last.innerText();
    }

    async getLastContentComputedStyle(prop) {
      const count = await this.getContentCount();
      if (count === 0) return null;
      const handle = await this.page.evaluateHandle(
        ({ selector, idx, prop }) => {
          const root = document.querySelector(selector);
          const el = root.children[idx];
          return window.getComputedStyle(el).getPropertyValue(prop);
        },
        { selector: '#window-content', idx: count - 1, prop }
      );
      const value = await handle.jsonValue();
      await handle.dispose();
      return value;
    }

    // Helper to ensure no modifications to page environment are done; read-only checks only
    async hasUpdateContentFunction() {
      return await this.page.evaluate(() => typeof window.updateContent === 'function');
    }
  }

  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions from page scripts)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages to inspect potential logs or errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown in the browser; listeners are removed with page close by Playwright
  });

  test.describe('State validations and transitions', () => {
    test('Initial State (S0_Initial): updateContent exists and no content is present on load', async ({ page }) => {
      // Validate initial state behavior: updateContent should be defined and window-content empty
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Ensure the updateContent function is present (entry action defined in FSM)
      const hasUpdate = await app.hasUpdateContentFunction();
      expect(hasUpdate).toBe(true);

      // The initial updateContent() call runs on load. With an empty input it should not add children.
      const count = await app.getContentCount();
      expect(count).toBe(0);

      // Ensure there were no uncaught page errors during initialization
      expect(pageErrors.length).toBe(0);

      // No console.error messages expected during normal initialization
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Add Content transition (S0 -> S1): clicking Add appends content with correct text and styles', async ({ page }) => {
      // This validates the "AddContent" event and resulting S1_ContentAdded state
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Ensure no content initially
      expect(await app.getContentCount()).toBe(0);

      // Fill input and click add
      const sampleText = 'Hello Sliding Window';
      await app.fillInput(sampleText);
      await app.clickAdd();

      // After clicking Add, a new child should be appended
      const countAfterAdd = await app.getContentCount();
      expect(countAfterAdd).toBe(1);

      // The last child's textContent should match the input
      const lastText = await app.getLastContentText();
      expect(lastText).toBe(sampleText);

      // Verify some visual style properties set by implementation
      // They set border to '1px solid black' via inline style; computed style should reflect border style includes '1px'
      const border = await app.getLastContentComputedStyle('border-top-width');
      // border may return '1px', ensure it's present and non-empty
      expect(border).toBeTruthy();

      // No uncaught exceptions expected from a normal add operation
      expect(pageErrors.length).toBe(0);
    });

    test('Remove Content transition (S1 -> S2): clicking Remove removes last child when present', async ({ page }) => {
      // Validate "RemoveContent" event when content exists
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Add two contents to ensure remove removes only the last
      await app.fillInput('First');
      await app.clickAdd();
      await app.fillInput('Second');
      await app.clickAdd();

      expect(await app.getContentCount()).toBe(2);
      expect(await app.getLastContentText()).toBe('Second');

      // Click remove - should remove the last child without causing a page error
      await app.clickRemove();

      // After removal, there should be one child left and its text should be 'First'
      expect(await app.getContentCount()).toBe(1);
      expect(await app.getLastContentText()).toBe('First');

      // No uncaught exceptions expected for valid removal
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: Remove when no content exists should produce a page error (TypeError from removeChild)', async ({ page }) => {
      // This test purposely triggers the known edge-case where removeButton removes lastChild even if none exist.
      // The implementation does not check for null, so a TypeError is expected from DOM removeChild.
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Ensure no content exists
      expect(await app.getContentCount()).toBe(0);

      // Clear any prior errors/messages
      pageErrors = [];

      // Click remove when there is no child - this should throw an exception in the page context
      // We do not intercept or prevent it; we simply click and observe the emitted pageerror event.
      await app.clickRemove();

      // Wait briefly to allow the pageerror event to propagate
      // Use a small explicit wait via Promise.race with timeout to avoid indefinite hang
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Expect at least one page error to have occurred
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Validate that one of the errors is a TypeError or mentions removeChild to be robust across browsers
      const matches = pageErrors.some(err => {
        const nameMatch = err && err.name === 'TypeError';
        const msg = err && err.message ? String(err.message) : '';
        const messageMatch = msg.includes('removeChild') || msg.includes('removeChild') /* fallback */;
        return nameMatch || messageMatch;
      });
      expect(matches).toBe(true);
    });

    test('Re-add after removal (S2 -> S1): content can be added again after a successful removal', async ({ page }) => {
      // Ensure the system can transition back from S2_ContentRemoved to S1_ContentAdded by adding again
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Add content
      await app.fillInput('Temp');
      await app.clickAdd();
      expect(await app.getContentCount()).toBe(1);

      // Remove it successfully
      await app.clickRemove();
      expect(await app.getContentCount()).toBe(0);

      // There should be no page errors from the successful remove
      expect(pageErrors.length).toBe(0);

      // Now add another content to ensure the add path still works
      const newText = 'Readded';
      await app.fillInput(newText);
      await app.clickAdd();

      expect(await app.getContentCount()).toBe(1);
      expect(await app.getLastContentText()).toBe(newText);

      // No unexpected page errors during re-add
      expect(pageErrors.length).toBe(0);
    });

    test('Add with empty input should not append content (no-op)', async ({ page }) => {
      // Verify clicking Add with empty or whitespace-only input does nothing (updateContent guard)
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Ensure empty input
      await app.fillInput('');
      expect(await app.input.inputValue()).toBe('');

      // Click add - should be no-op
      await app.clickAdd();

      // Confirm still zero children
      expect(await app.getContentCount()).toBe(0);

      // Also test whitespace-only input
      await app.fillInput('   ');
      await app.clickAdd();
      expect(await app.getContentCount()).toBe(0);

      // No errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and error observation tests', () => {
    test('Observe console messages and page errors during user interactions', async ({ page }) => {
      // This test collects console messages and page errors while performing a sequence of interactions.
      const app = new SlidingWindowPage(page);
      await app.goto();

      // Start with a clean slate
      pageErrors = [];
      consoleMessages = [];

      // Perform interactions: add valid content, remove it, attempt remove again to create an error
      await app.fillInput('Obs1');
      await app.clickAdd();

      await app.clickRemove();

      // Now trigger the error by removing again (no content)
      await app.clickRemove();

      // Allow events to settle
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Validate console captured messages (there may be none, but ensure we can access them)
      expect(Array.isArray(consoleMessages)).toBe(true);

      // Validate that at least one page error happened due to the final remove
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Confirm one of the page errors references the removeChild operation or is a TypeError
      const found = pageErrors.some(err => (err && err.name === 'TypeError') || (err && String(err.message).includes('removeChild')));
      expect(found).toBe(true);
    });
  });
});