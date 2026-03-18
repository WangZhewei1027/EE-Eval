import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a324712-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object for the Deque Demo
 */
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors
    this.selectors = {
      dequeState: '#deque-state',
      message: '#message',
      inputAddFront: '#input-add-front',
      inputAddRear: '#input-add-rear',
      btnAddFront: '#btn-add-front',
      btnAddRear: '#btn-add-rear',
      btnRemoveFront: '#btn-remove-front',
      btnRemoveRear: '#btn-remove-rear',
      dequeElements: '#deque-state .deque-element'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Return the visible text inside deque-state container
  async getDequeText() {
    return (await this.page.locator(this.selectors.dequeState).textContent())?.trim() ?? '';
  }

  // Return array of element texts (front to rear)
  async getDequeElements() {
    return await this.page.$$eval(this.selectors.dequeElements, els => els.map(e => e.textContent?.trim() ?? ''));
  }

  async getMessageText() {
    return (await this.page.locator(this.selectors.message).textContent())?.trim() ?? '';
  }

  // Returns computed color (e.g. 'rgb(0, 126, 51)')
  async getMessageColor() {
    return await this.page.$eval(this.selectors.message, el => getComputedStyle(el).color);
  }

  async isRemoveFrontDisabled() {
    return await this.page.$eval(this.selectors.btnRemoveFront, el => el.disabled);
  }

  async isRemoveRearDisabled() {
    return await this.page.$eval(this.selectors.btnRemoveRear, el => el.disabled);
  }

  async addFront(value) {
    await this.page.fill(this.selectors.inputAddFront, value);
    await this.page.click(this.selectors.btnAddFront);
  }

  async addRear(value) {
    await this.page.fill(this.selectors.inputAddRear, value);
    await this.page.click(this.selectors.btnAddRear);
  }

  async removeFront() {
    await this.page.click(this.selectors.btnRemoveFront);
  }

  async removeRear() {
    await this.page.click(this.selectors.btnRemoveRear);
  }

  // Force dispatch a click event on a selector (bypass disabled attribute).
  // This deliberately dispatches a MouseEvent to simulate a click even when disabled.
  async forceClick(selector) {
    await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      el.dispatchEvent(ev);
    }, selector);
  }

  // Convenience wrappers for forced clicks on remove buttons
  async forceClickRemoveFront() {
    await this.forceClick(this.selectors.btnRemoveFront);
  }
  async forceClickRemoveRear() {
    await this.forceClick(this.selectors.btnRemoveRear);
  }
}

test.describe('Deque (Double-Ended Queue) Demo - FSM behavior and UI', () => {
  let dequePage;
  let consoleErrors = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    dequePage = new DequePage(page);

    // Collect console errors and page errors to assert runtime health.
    consoleErrors = [];
    pageErrors = [];

    consoleHandler = msg => {
      // Only store severe console messages (type === 'error')
      if (msg.type && msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    };
    pageErrorHandler = err => {
      pageErrors.push(err);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Load the app
    await dequePage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid cross-test leakage
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);

    // Assert that no uncaught page errors or console errors occurred during the test.
    // This verifies the application runs without thrown exceptions.
    expect(pageErrors, `Expected no page errors, found: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    expect(consoleErrors, `Expected no console.error messages, found: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test.describe('Initial State (S0_Empty)', () => {
    test('should show empty deque state and initial message on load', async () => {
      // Validate that the deque displays the empty placeholder
      const dequeText = await dequePage.getDequeText();
      expect(dequeText).toContain('[ empty ]');

      // The initial message should indicate deque is empty (onEnter action)
      const initialMessage = await dequePage.getMessageText();
      expect(initialMessage).toContain('Deque is empty. Add elements using the controls above.');

      // Removal buttons should be disabled in the empty state (evidence)
      expect(await dequePage.isRemoveFrontDisabled()).toBe(true);
      expect(await dequePage.isRemoveRearDisabled()).toBe(true);

      // Accessibility attributes check
      const ariaLive = await (await dequePage.page.$('#deque-state')).getAttribute('aria-live');
      expect(ariaLive).toBe('polite');

      const messageRole = await (await dequePage.page.$('#message')).getAttribute('role');
      expect(messageRole).toBe('alert');
    });
  });

  test.describe('Add operations (AddFront, AddRear) and Non-Empty state (S1_NonEmpty)', () => {
    test('adding to front enables removal and updates display and message', async () => {
      // Add 'A' to front
      await dequePage.addFront('A');

      // Message should indicate added to front
      await expect(dequePage.page.locator('#message')).toHaveText('Added "A" to front.');

      // Deque should have a single element 'A'
      const elems = await dequePage.getDequeElements();
      expect(elems).toEqual(['A']);

      // Removal buttons should now be enabled (evidence of S1_NonEmpty)
      expect(await dequePage.isRemoveFrontDisabled()).toBe(false);
      expect(await dequePage.isRemoveRearDisabled()).toBe(false);

      // Input should be cleared after adding
      const inputVal = await dequePage.page.$eval('#input-add-front', el => el.value);
      expect(inputVal).toBe('');
    });

    test('adding to rear respects order (front to rear)', async () => {
      // Start with clearing any existing state by ensuring empty (page reload done in beforeEach)
      // Add to front then rear and then another front to check order: front -> C, A, B (example)
      await dequePage.addFront('A'); // deque: A
      await dequePage.addRear('B');  // deque: A, B
      await dequePage.addFront('C'); // deque: C, A, B

      const elems = await dequePage.getDequeElements();
      expect(elems).toEqual(['C', 'A', 'B']);

      // Verify messages after last operation
      await expect(dequePage.page.locator('#message')).toHaveText('Added "C" to front.');
    });
  });

  test.describe('Remove operations and transitions', () => {
    test('remove front removes the front element and updates message and display', async () => {
      // Setup: add three items
      await dequePage.addFront('1'); // 1
      await dequePage.addRear('2');  // 1,2
      await dequePage.addRear('3');  // 1,2,3

      // Remove front -> should remove '1'
      await dequePage.removeFront();

      // Message should indicate removed "1" from front
      await expect(dequePage.page.locator('#message')).toHaveText('Removed "1" from front.');

      // Deque contents should now be 2,3
      const elems = await dequePage.getDequeElements();
      expect(elems).toEqual(['2', '3']);

      // Removals still enabled
      expect(await dequePage.isRemoveFrontDisabled()).toBe(false);
      expect(await dequePage.isRemoveRearDisabled()).toBe(false);
    });

    test('remove rear removes the rear element and updates message and display', async () => {
      // Setup: add two items
      await dequePage.addRear('X'); // X
      await dequePage.addRear('Y'); // X, Y

      // Remove rear -> should remove 'Y'
      await dequePage.removeRear();

      await expect(dequePage.page.locator('#message')).toHaveText('Removed "Y" from rear.');

      // Deque should have only 'X'
      const elems = await dequePage.getDequeElements();
      expect(elems).toEqual(['X']);
    });

    test('removing last element transitions back to empty state (S1_NonEmpty -> S0_Empty) and disables removals', async () => {
      // Add a single element then remove it
      await dequePage.addFront('LAST');

      // Remove front (removes LAST)
      await dequePage.removeFront();

      // Message indicates removal of 'LAST'
      await expect(dequePage.page.locator('#message')).toHaveText('Removed "LAST" from front.');

      // Deque should display empty placeholder and disable removal buttons (onExit entry actions)
      const dequeText = await dequePage.getDequeText();
      expect(dequeText).toContain('[ empty ]');

      expect(await dequePage.isRemoveFrontDisabled()).toBe(true);
      expect(await dequePage.isRemoveRearDisabled()).toBe(true);
    });
  });

  test.describe('Validation and edge-case behaviors', () => {
    test('adding empty or whitespace-only values is rejected with an error message', async () => {
      // Attempt to add whitespace-only to front
      await dequePage.addFront('   ');

      // Should show validation error message
      await expect(dequePage.page.locator('#message')).toHaveText('Please enter a non-empty value.');

      // Error color check (should be red-ish -> rgb(216, 0, 12) for #D8000C)
      const color = await dequePage.getMessageColor();
      expect(color).toBe('rgb(216, 0, 12)');

      // Deque should still be empty
      const dequeText = await dequePage.getDequeText();
      expect(dequeText).toContain('[ empty ]');

      // Now try adding empty to rear too
      await dequePage.addRear('');
      await expect(dequePage.page.locator('#message')).toHaveText('Please enter a non-empty value.');
    });

    test('attempting to remove when deque is empty shows the appropriate error message (guarded transitions)', async () => {
      // At initial load deque is empty and removal buttons are disabled.
      // We dispatch a click event manually (bypassing the disabled attribute) to test the guard branch
      // The application code checks deque.isEmpty() and should show the specific message.

      // Force a click dispatch on the remove front button to simulate this guarded transition
      await dequePage.forceClickRemoveFront();

      // Should show the expected error message for front removal when empty
      await expect(dequePage.page.locator('#message')).toHaveText('Deque is empty. Nothing to remove from front.');

      // Color should be error (red)
      const colorFront = await dequePage.getMessageColor();
      expect(colorFront).toBe('rgb(216, 0, 12)');

      // Similarly for rear
      await dequePage.forceClickRemoveRear();
      await expect(dequePage.page.locator('#message')).toHaveText('Deque is empty. Nothing to remove from rear.');
      const colorRear = await dequePage.getMessageColor();
      expect(colorRear).toBe('rgb(216, 0, 12)');

      // Ensure still empty
      const dequeText = await dequePage.getDequeText();
      expect(dequeText).toContain('[ empty ]');
    });
  });

  test.describe('Additional UI invariants and accessibility', () => {
    test('message uses assertive live region and deque updates are announced (aria attributes exist)', async () => {
      // Check message element has aria-live assertive
      const messageAriaLive = await (await dequePage.page.$('#message')).getAttribute('aria-live');
      expect(messageAriaLive).toBe('assertive');

      // Trigger an update and check deque aria attributes still present
      await dequePage.addRear('AA');
      const dequeAriaAtomic = await (await dequePage.page.$('#deque-state')).getAttribute('aria-atomic');
      expect(dequeAriaAtomic).toBe('true');

      // After update, message indicates added
      await expect(dequePage.page.locator('#message')).toHaveText('Added "AA" to rear.');
    });
  });
});