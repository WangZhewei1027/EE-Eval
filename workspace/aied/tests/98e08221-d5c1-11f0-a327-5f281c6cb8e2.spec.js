import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e08221-d5c1-11f0-a327-5f281c6cb8e2.html';

/**
 * Page Object for the Stack demo application.
 * Encapsulates selectors and common actions to keep tests readable.
 */
class StackPage {
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.pushBtn = page.locator('#pushBtn');
    this.popBtn = page.locator('#popBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.fillRandom = page.locator('#fillRandom');
    this.stepPush = page.locator('#stepPush');
    this.stepPop = page.locator('#stepPop');
    this.maxSizeInput = page.locator('#maxSizeInput');

    this.stackArea = page.locator('#stackArea');
    this.arrayView = page.locator('#arrayView');
    this.opLog = page.locator('#opLog');
    this.sizeBadge = page.locator('#sizeBadge');
    this.topBadge = page.locator('#topBadge');
    this.capBadge = page.locator('#capBadge');
    this.statusMsg = page.locator('#statusMsg');
    this.peekResult = page.locator('#peekResult');
    this.lastOp = page.locator('#lastOp');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for initial render
    await expect(this.statusMsg).toContainText('Ready', { timeout: 2000 });
  }

  async pushValueVisible(value) {
    await this.valueInput.fill(String(value));
    await this.pushBtn.click();
  }

  async pushValueViaEnter(value) {
    await this.valueInput.fill(String(value));
    await this.valueInput.press('Enter');
  }

  async pop() {
    await this.popBtn.click();
  }

  async peek() {
    await this.peekBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  async fillRandomClick() {
    await this.fillRandom.click();
  }

  async stepPushClick() {
    await this.stepPush.click();
  }

  async stepPopClick() {
    await this.stepPop.click();
  }

  async setMaxSize(n) {
    await this.maxSizeInput.fill(String(n));
    // trigger change event by blurring or pressing Tab
    await this.maxSizeInput.press('Tab');
  }

  async getStackSlots() {
    return this.stackArea.locator('.stack-slot');
  }

  async getTopSlotText() {
    const slot = this.stackArea.locator('.stack-slot').first();
    if (await slot.count() === 0) return null;
    return slot.textContent();
  }

  async logFirstOpText() {
    const first = this.opLog.locator('.log-entry').first();
    if (await first.count() === 0) return null;
    return first.textContent();
  }
}

// Global test-level listeners container
test.describe('Stack Demo — FSM and interactions', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions later
    page.on('console', (msg) => {
      // record error level console messages
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we ensure no uncaught console errors or page errors occurred
    // This asserts that runtime did not produce unexpected ReferenceError/SyntaxError/TypeError etc.
    expect(consoleErrors, `Console errors were emitted: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `Page errors were emitted: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test.describe('Initial state (S0_Ready) and basic UI', () => {
    test('should load and show Ready status and initial badges', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // Validate initial status contains 'Ready'
      await expect(app.statusMsg).toContainText('Ready');

      // Initial size is 0, top is placeholder, capacity is infinity (∞)
      await expect(app.sizeBadge).toHaveText('0');
      await expect(app.topBadge).toHaveText('—');
      await expect(app.capBadge).toHaveText('∞');

      // array view shows empty array
      await expect(app.arrayView).toHaveText('[]');

      // Pop button should be disabled when stack empty
      await expect(app.popBtn).toBeDisabled();
    });
  });

  test.describe('Events: Push / Pop / Peek / Clear / Fill / Step operations', () => {
    test('PushEvent: typing a value and clicking Push adds item to stack (S0_Ready -> S0_Ready)', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // Push value "foo"
      await app.pushValueVisible('foo');

      // After push: size badge increments, top badge shows pushed value, array view contains value
      await expect(app.sizeBadge).toHaveText('1');
      await expect(app.topBadge).toContainText('foo');
      await expect(app.arrayView).toContainText('foo');

      // Status should indicate pushed value (stringified)
      await expect(app.statusMsg).toContainText('Pushed');
      await expect(app.statusMsg).toContainText('foo');

      // The input should be cleared and focused
      await expect(app.valueInput).toBeFocused();
      await expect(app.valueInput).toHaveValue('');
    });

    test('PopEvent: popping returns the top and updates UI (S0_Ready -> S0_Ready)', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // push two items
      await app.pushValueVisible('one');
      await app.pushValueVisible('two');

      await expect(app.sizeBadge).toHaveText('2');
      await expect(app.topBadge).toContainText('two');

      // Pop
      await app.pop();

      // After pop: top should be previous item
      await expect(app.sizeBadge).toHaveText('1');
      await expect(app.topBadge).toContainText('one');

      // Status should indicate popped value and log should include 'pop'
      await expect(app.statusMsg).toContainText('Popped');
      const firstLog = app.opLog.locator('.log-entry').first();
      await expect(firstLog.locator('.op')).toHaveText('pop');
    });

    test('PeekEvent: peeking shows top without removing (S0_Ready -> S0_Ready)', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // ensure empty then push one
      await app.clear();
      await app.pushValueVisible('peek-me');

      // peek
      await app.peek();

      // peekResult should show same top value and stack size unchanged
      await expect(app.peekResult).toContainText('peek-me');
      await expect(app.sizeBadge).toHaveText('1');
      await expect(app.statusMsg).toContainText('Peeked');
    });

    test('ClearEvent: clears the stack and updates lastOp/status', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // push items
      await app.pushValueVisible('a');
      await app.pushValueVisible('b');

      // clear the stack
      await app.clear();

      // size should be zero, array view empty, lastOp should be 'clear', status updated
      await expect(app.sizeBadge).toHaveText('0');
      await expect(app.arrayView).toHaveText('[]');
      await expect(app.lastOp).toHaveText('clear');
      await expect(app.statusMsg).toContainText('Stack cleared');
    });

    test('FillRandomEvent: fills 6 random values (S0_Ready -> S0_Ready)', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // ensure empty
      await app.clear();

      // click fill 6 random
      await app.fillRandomClick();

      // Expect 6 items pushed (default cap Infinity)
      await expect(app.sizeBadge).toHaveText('6');
      await expect(app.statusMsg).toContainText('Filled 6 random values');

      // array view must be an array of length 6
      const arrayText = await app.arrayView.textContent();
      const arr = JSON.parse(arrayText);
      expect(arr.length).toBe(6);
    });

    test('StepPushEvent and StepPopEvent: step push/pop change size by 1', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // ensure clean
      await app.clear();
      await expect(app.sizeBadge).toHaveText('0');

      // step push -> size 1
      await app.stepPushClick();
      await expect(app.sizeBadge).toHaveText('1');

      // step pop -> size 0
      await app.stepPopClick();
      // step pop may animate, wait for badge update
      await expect(app.sizeBadge).toHaveText('0');
    });

    test('MaxSizeChangeEvent: setting max size updates cap and status', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // Set max size to 2
      await app.setMaxSize(2);
      await expect(app.capBadge).toHaveText('2');
      await expect(app.statusMsg).toContainText('Max size set to 2');
    });

    test('ValueInputEnterEvent: pressing Enter in input triggers push', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // ensure empty then type and press Enter
      await app.clear();
      await app.pushValueViaEnter('enter-push');

      await expect(app.sizeBadge).toHaveText('1');
      await expect(app.topBadge).toContainText('enter-push');
      await expect(app.statusMsg).toContainText('Pushed');
    });
  });

  test.describe('Edge cases and error states (S1_Overflow and S2_EmptyStack)', () => {
    test('Overflow: when capacity reached, PushEvent leads to overflow state (S1_Overflow)', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // Set capacity to 1 and ensure empty
      await app.clear();
      await app.setMaxSize(1);
      await expect(app.capBadge).toHaveText('1');

      // push one item succeeds
      await app.pushValueVisible('first');
      await expect(app.sizeBadge).toHaveText('1');

      // second push should be blocked and set status to overflow message
      await app.pushValueVisible('second');
      await expect(app.statusMsg).toContainText('Push blocked: stack overflow');

      // The stack should still be size 1 with top 'first'
      await expect(app.sizeBadge).toHaveText('1');
      await expect(app.topBadge).toContainText('first');

      // opLog newest entry should refer to 'overflow'
      const firstLog = app.opLog.locator('.log-entry').first();
      await expect(firstLog).toContainText('overflow');
    });

    test('Pop on empty triggers Empty Stack error (S2_EmptyStack)', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // ensure empty
      await app.clear();
      await expect(app.sizeBadge).toHaveText('0');

      // pop should produce error status and not change size
      await app.pop();
      await expect(app.statusMsg).toContainText('Pop failed: stack is empty');
      await expect(app.sizeBadge).toHaveText('0');

      // log contains 'underflow' message
      const firstLog = app.opLog.locator('.log-entry').first();
      await expect(firstLog).toContainText('underflow');
    });

    test('Peek on empty triggers Peek empty message (S2_EmptyStack)', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // ensure empty
      await app.clear();
      await expect(app.sizeBadge).toHaveText('0');

      // peek should indicate empty and leave stack unchanged
      await app.peek();
      await expect(app.statusMsg).toContainText('Peek: stack is empty');
      await expect(app.sizeBadge).toHaveText('0');

      // opLog should contain 'empty'
      const firstLog = app.opLog.locator('.log-entry').first();
      await expect(firstLog).toContainText('empty');
    });
  });

  test.describe('DOM interactions, visual feedback and accessibility hints', () => {
    test('Clicking a stack slot highlights and sets status to clicked index', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // ensure at least two items
      await app.clear();
      await app.pushValueVisible('idxA');
      await app.pushValueVisible('idxB');

      // locate the top slot and click it - should show Clicked index 1 (index of top is 1)
      const slots = app.getStackSlots();
      await expect(slots).toHaveCount(2);
      const topSlot = app.getStackSlots();
      await topSlot.first().click();

      // after clicking, status should contain 'Clicked index'
      await expect(app.statusMsg).toContainText('Clicked index');
    });

    test('Operation log shows entries with operation label and timestamp', async ({ page }) => {
      const app = new StackPage(page);
      await app.goto();

      // perform operations to generate logs
      await app.clear();
      await app.pushValueVisible('log1');
      await app.peek();
      await app.pop();

      // verify first three log entries correspond to operations performed (op spans)
      const first = app.opLog.locator('.log-entry').nth(0);
      const second = app.opLog.locator('.log-entry').nth(1);
      const third = app.opLog.locator('.log-entry').nth(2);

      // first should be pop (last operation)
      await expect(first.locator('.op')).toHaveText('pop');
      await expect(second.locator('.op')).toHaveText('peek');
      await expect(third.locator('.op')).toHaveText('push');
    });
  });
});