import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f43110-fa77-11f0-a6a1-c765f41a13c7.html';

/**
 * Page Object for the Dynamic Array Demo
 * Encapsulates common interactions and assertions against the UI.
 */
class DynamicArrayPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      addBtn: '#addBtn',
      resetBtn: '#resetBtn',
      sizeDisplay: '#sizeDisplay',
      capDisplay: '#capDisplay',
      nextDisplay: '#nextDisplay',
      message: '#message',
      opBadge: '#opBadge',
      slots: '#slots',
      filledSlot: '#slots .slot.filled',
      slotAll: '#slots .slot'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickAdd() {
    await this.page.click(this.selectors.addBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async pressEnterOnAdd() {
    await this.page.focus(this.selectors.addBtn);
    await this.page.keyboard.press('Enter');
  }

  async pressEnterOnReset() {
    await this.page.focus(this.selectors.resetBtn);
    await this.page.keyboard.press('Enter');
  }

  async getBadgeText() {
    return (await this.page.textContent(this.selectors.opBadge)) || '';
  }

  async getMessageText() {
    return (await this.page.textContent(this.selectors.message)) || '';
  }

  async getSize() {
    const t = (await this.page.textContent(this.selectors.sizeDisplay)) || '0';
    return Number(t.trim());
  }

  async getCapacity() {
    const t = (await this.page.textContent(this.selectors.capDisplay)) || '0';
    return Number(t.trim());
  }

  async getNextValue() {
    const t = (await this.page.textContent(this.selectors.nextDisplay)) || '0';
    return Number(t.trim());
  }

  async countSlots() {
    return await this.page.$$eval(this.selectors.slotAll, els => els.length);
  }

  async countFilledSlots() {
    return await this.page.$$eval(this.selectors.filledSlot, els => els.length);
  }

  // Wait until size equals expected (with timeout)
  async waitForSize(expected, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        return el && Number(el.textContent.trim()) === expected;
      },
      this.selectors.sizeDisplay,
      expected,
      { timeout }
    );
  }

  async waitForCapacity(expected, timeout = 7000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        return el && Number(el.textContent.trim()) === expected;
      },
      this.selectors.capDisplay,
      expected,
      { timeout }
    );
  }

  async waitForBadgeText(text, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim() === text;
      },
      this.selectors.opBadge,
      text,
      { timeout }
    );
  }

  async waitForMessageContains(substr, timeout = 4000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent.indexOf(substr) !== -1;
      },
      this.selectors.message,
      substr,
      { timeout }
    );
  }
}

test.describe('Dynamic Array — Visual Demo (FSM validation)', () => {
  let pageErrors;
  let consoleErrors;
  let pageObject;

  // Attach console and pageerror listeners before each test and navigate
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console messages of severity "error" so we can assert none happened
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    pageObject = new DynamicArrayPage(page);
    await pageObject.goto();
  });

  // After each test ensure there were no unexpected runtime errors logged
  test.afterEach(async ({}, testInfo) => {
    // Provide helpful diagnostics in test output when errors occurred
    if (pageErrors.length > 0) {
      console.error('Page errors observed:', pageErrors);
    }
    if (consoleErrors.length > 0) {
      console.error('Console errors observed:', consoleErrors);
    }
    // Assert that there were no uncaught page errors
    expect(pageErrors.length, 'No uncaught page errors should have occurred').toBe(0);
    // Assert that there were no console.error messages
    expect(consoleErrors.length, 'No console.error messages should have been emitted').toBe(0);
  });

  test('Initial Idle state is rendered correctly', async () => {
    // Validate the initial UI reflects the Idle state per FSM S0_Idle
    await expect((await pageObject.getBadgeText()).trim()).toBe('Idle');
    const message = await pageObject.getMessageText();
    expect(message).toContain('Welcome — observe how dynamic arrays manage capacity');
    expect(await pageObject.getSize()).toBe(0);
    expect(await pageObject.getCapacity()).toBe(4);
    expect(await pageObject.getNextValue()).toBe(1);
    expect(await pageObject.countSlots()).toBe(4);
    expect(await pageObject.countFilledSlots()).toBe(0);
  });

  test('Add Element: Idle -> Prepare -> Appending -> Idle (single append, no resize)', async () => {
    // Click "Add Element" once and assert the sequence of badge/messages and final state.
    // Immediately after click, FSM should show 'Prepare'
    await pageObject.clickAdd();
    await pageObject.waitForBadgeText('Prepare');

    // While animating append, badge should become 'Appending' (animateAppend sets it)
    await pageObject.waitForBadgeText('Appending');

    // After append completes, size should update to 1 and badge back to Idle
    await pageObject.waitForSize(1, 7000);
    await pageObject.waitForBadgeText('Idle', 7000);

    const message = await pageObject.getMessageText();
    expect(message).toContain('Value 1 appended. Size is now 1.');
    expect(await pageObject.getNextValue()).toBe(2);
    expect(await pageObject.countFilledSlots()).toBe(1);
  });

  test('Keyboard Enter on Add triggers append (Idle -> Prepare -> Appending -> Idle)', async () => {
    // Use keyboard Enter to trigger addition and validate UI updates
    await pageObject.pressEnterOnAdd();
    await pageObject.waitForBadgeText('Prepare');
    await pageObject.waitForBadgeText('Appending');
    await pageObject.waitForSize(1, 7000); // if starting from fresh page this will be 1
    await pageObject.waitForBadgeText('Idle', 7000);
    expect((await pageObject.getMessageText())).toContain('Value');
  });

  test('Fill to capacity and trigger resizing on next Add (Resize transition S2_Resizing)', async () => {
    // Ensure clean state
    // Reset first to deterministic baseline
    await pageObject.clickReset();
    await pageObject.waitForSize(0);
    await pageObject.waitForCapacity(4);

    // Append up to capacity (4) sequentially, waiting for each append to finish
    for (let i = 1; i <= 4; i++) {
      await pageObject.clickAdd();
      // Each append will produce size i
      await pageObject.waitForSize(i, 7000);
      // After append finished, badge returns to Idle
      await pageObject.waitForBadgeText('Idle', 7000);
    }

    expect(await pageObject.getSize()).toBe(4);
    expect(await pageObject.getCapacity()).toBe(4);

    // Now click once more to trigger resize (capacity doubling)
    await pageObject.clickAdd();

    // After initiating, badge should become 'Prepare' then 'Resizing' during animateResize
    await pageObject.waitForBadgeText('Prepare', 3000);
    // Resizing badge is set immediately in animateResize
    await pageObject.waitForBadgeText('Resizing', 5000);

    // Verify message indicates capacity reached / resizing
    await pageObject.waitForMessageContains('Capacity reached. Resizing buffer to 8 (doubling).', 5000);

    // Wait for capacity to update to 8 (after animateResize commits)
    await pageObject.waitForCapacity(8, 10000);

    // After resize completes, append completes and size becomes 5
    await pageObject.waitForSize(5, 12000);

    // Final checks
    expect(await pageObject.getCapacity()).toBe(8);
    expect(await pageObject.getSize()).toBe(5);
    expect(await pageObject.getNextValue()).toBe(6);
    const message = await pageObject.getMessageText();
    expect(message).toContain('Resize complete. New capacity: 8. Values copied.');
  });

  test('Reset button resets the array to Idle (S0_Idle)', async () => {
    // Populate at least one element so reset has an observable effect
    await pageObject.clickAdd();
    await pageObject.waitForSize(1, 7000);
    // Click Reset and validate state returns to initial
    await pageObject.clickReset();
    await pageObject.waitForSize(0);
    await pageObject.waitForCapacity(4);
    expect(await pageObject.getNextValue()).toBe(1);
    expect((await pageObject.getMessageText())).toContain('Array reset. Start adding elements to see resizing.');
    expect(await pageObject.getBadgeText()).toBe('Idle');
    expect(await pageObject.countFilledSlots()).toBe(0);
  });

  test('Keyboard Enter on Reset triggers reset (S0_Idle)', async () => {
    // Add an element to make reset observable
    await pageObject.clickAdd();
    await pageObject.waitForSize(1, 7000);
    // Press Enter key while reset button focused
    await pageObject.pressEnterOnReset();
    await pageObject.waitForSize(0);
    await pageObject.waitForCapacity(4);
    expect(await pageObject.getBadgeText()).toBe('Idle');
    expect((await pageObject.getMessageText())).toContain('Array reset. Start adding elements to see resizing.');
  });

  test('Edge case: clicking Add while resizing is ongoing is ignored', async () => {
    // Reset to base
    await pageObject.clickReset();
    await pageObject.waitForSize(0);
    await pageObject.waitForCapacity(4);

    // Fill to capacity
    for (let i = 1; i <= 4; i++) {
      await pageObject.clickAdd();
      await pageObject.waitForSize(i, 7000);
      await pageObject.waitForBadgeText('Idle', 7000);
    }

    // Start the operation that triggers resizing (5th add)
    await pageObject.clickAdd();

    // Wait until we are definitely in the Resizing badge (which also implies busy=true)
    await pageObject.waitForBadgeText('Resizing', 7000);

    // While resizing, attempt another Add - this should be ignored by handleAdd because busy is set
    await pageObject.clickAdd();

    // Wait for the resizing and append to complete
    await pageObject.waitForSize(5, 12000);
    await pageObject.waitForCapacity(8, 12000);

    // Because we attempted a second add while resizing, ensure exactly one appended during that operation
    expect(await pageObject.getSize()).toBe(5);
    expect(await pageObject.getNextValue()).toBe(6);
  });

  test('Robustness: no uncaught exceptions during rapid sequence of operations', async () => {
    // Perform a rapid sequence of adds and resets to try and surface timing-related errors.
    // We don't patch the app - we simply exercise it heavily and assert no page errors.
    // Sequence: add x3, reset, add x2, add until resize (5th), reset
    for (let i = 0; i < 3; i++) {
      await pageObject.clickAdd();
      await pageObject.waitForBadgeText('Idle', 7000);
    }
    await pageObject.clickReset();
    await pageObject.waitForSize(0);

    for (let i = 0; i < 2; i++) {
      await pageObject.clickAdd();
      await pageObject.waitForBadgeText('Idle', 7000);
    }

    // Add until resize is triggered
    for (let i = 0; i < 3; i++) {
      await pageObject.clickAdd();
      await pageObject.waitForBadgeText('Idle', 12000);
    }

    await pageObject.clickReset();
    await pageObject.waitForSize(0);

    // If any runtime errors occurred they will be asserted in afterEach listener.
    expect(await pageObject.getBadgeText()).toBe('Idle');
  });

});