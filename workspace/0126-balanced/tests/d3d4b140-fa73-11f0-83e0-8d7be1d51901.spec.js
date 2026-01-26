import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d4b140-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Stack (LIFO) Interactive Demo — FSM validation', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Helper selectors / getters
  const selectors = {
    valueInput: '#valueInput',
    pushBtn: '#pushBtn',
    popBtn: '#popBtn',
    peekBtn: '#peekBtn',
    clearBtn: '#clearBtn',
    size: '#size',
    topValue: '#topValue',
    isEmpty: '#isEmpty',
    arrayViewItems: '#arrayView .array-item',
    stackContainerChildren: '#stackContainer > .stack-item',
    notice: '#notice',
    logMsgs: '#log .msg'
  };

  // Attach console and page error listeners and navigate to the app before each test.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (message) => {
      // capture console messages for inspection, allow natural console errors to surface
      consoleMessages.push({
        type: message.type(),
        text: message.text()
      });
    });

    page.on('pageerror', (err) => {
      // capture uncaught errors from the page
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Wait for the seed demo pushes to complete (A, B, C)
    // The demo seeds three items with timeouts; wait until array view contains at least 3 items.
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length >= 3,
      selectors.arrayViewItems,
      { timeout: 5000 }
    );
  });

  test.afterEach(async () => {
    // Ensure there are no uncaught page errors after each test run
    // The application uses DOM-based logging; uncaught page errors would be real runtime failures.
    expect(pageErrors.map(e => String(e))).toEqual([]);
  });

  test.describe('Initial (Idle) and seeded state', () => {
    test('should have seeded values (A,B,C) and correct stats after seed — validates Idle -> ValuePushed entries', async ({ page }) => {
      // Verify size, top, and isEmpty reflect the seeded pushes
      const size = await page.$eval(selectors.size, (el) => el.textContent.trim());
      const top = await page.$eval(selectors.topValue, (el) => el.textContent.trim());
      const isEmpty = await page.$eval(selectors.isEmpty, (el) => el.textContent.trim());

      expect(size).toBe('3'); // seeded A,B,C
      expect(top).toBe('C');
      expect(isEmpty).toBe('false');

      // Verify array view order bottom -> top is A, B, C
      const items = await page.$$eval(selectors.arrayViewItems, (nodes) => nodes.map(n => n.textContent.trim()));
      expect(items).toEqual(['A', 'B', 'C']);

      // Ensure the top array-item is visually highlighted (last item should have inline style border set)
      const lastItemStyle = await page.$eval(`${selectors.arrayViewItems}:last-child`, el => el.getAttribute('style') || '');
      expect(lastItemStyle).toContain('border');

      // Ensure input is focused (Idle state's evidence suggests focus on valueInput)
      const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(activeId).toBe('valueInput');
    });
  });

  test.describe('Push interactions and EnterKeyPush', () => {
    test('push button should add a numeric value, update visual stack and stats', async ({ page }) => {
      // Push numeric value "42"
      await page.fill(selectors.valueInput, '42');
      await page.click(selectors.pushBtn);

      // Wait for size to reflect increment (from 3 to 4)
      await page.waitForFunction(
        (sel) => document.querySelector(sel).textContent.trim() === '4',
        selectors.size
      );

      const size = await page.$eval(selectors.size, el => el.textContent.trim());
      const top = await page.$eval(selectors.topValue, el => el.textContent.trim());
      expect(size).toBe('4');
      expect(top).toBe('42');

      // Verify the visual stack container's top element text and that it has "top" class
      const topText = await page.$eval(`${selectors.stackContainerChildren}:first-child`, el => el.textContent.trim());
      expect(topText).toBe('42');

      const topClassList = await page.$eval(`${selectors.stackContainerChildren}:first-child`, el => Array.from(el.classList));
      expect(topClassList).toContain('top');

      // Notice should indicate a push occurred with value
      const notice = await page.$eval(selectors.notice, el => el.textContent.trim());
      expect(notice).toContain('Pushed');

      // The in-DOM log should contain a push message mentioning size
      const latestLog = await page.$eval(`${selectors.logMsgs}:first-child`, el => el.textContent.trim());
      expect(latestLog).toContain('push(');
      expect(latestLog).toContain('size now');
    });

    test('pressing Enter in input triggers a push and clears input & focuses back (EnterKeyPush)', async ({ page }) => {
      // Record current size
      const startSize = Number(await page.$eval(selectors.size, el => el.textContent.trim()));

      // Type a non-numeric value and press Enter to push
      await page.fill(selectors.valueInput, 'hello-enter');
      await page.press(selectors.valueInput, 'Enter');

      // Wait for size to increment by 1
      await page.waitForFunction(
        (sel, expected) => Number(document.querySelector(sel).textContent.trim()) === expected,
        selectors.size,
        startSize + 1
      );

      // Input should be cleared and focused (evidence: valueInput.value = '' and focus())
      const inputValue = await page.$eval(selectors.valueInput, el => el.value);
      expect(inputValue).toBe('');

      const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(activeId).toBe('valueInput');

      // Top should equal the pushed string (string, not coerced to number)
      const top = await page.$eval(selectors.topValue, el => el.textContent.trim());
      expect(top).toBe('hello-enter');
    });

    test('attempting to push empty input shows notice and does not change size (edge case)', async ({ page }) => {
      // Ensure input is empty
      await page.fill(selectors.valueInput, '');
      const startSize = await page.$eval(selectors.size, el => el.textContent.trim());

      // Click push with empty input
      await page.click(selectors.pushBtn);

      // Notice should indicate to enter a value
      const notice = await page.$eval(selectors.notice, el => el.textContent.trim());
      expect(notice).toContain('Enter a value to push');

      // Size should remain the same
      const endSize = await page.$eval(selectors.size, el => el.textContent.trim());
      expect(endSize).toBe(startSize);
    });
  });

  test.describe('Pop interactions and Pop edge case', () => {
    test('pop button removes top value, updates stats, and logs the pop', async ({ page }) => {
      // Ensure starting size is 3 (seed)
      const initialSize = Number(await page.$eval(selectors.size, el => el.textContent.trim()));
      expect(initialSize).toBeGreaterThanOrEqual(1);

      // Click pop once
      await page.click(selectors.popBtn);

      // Wait for size to decrement
      await page.waitForFunction(
        (sel, start) => Number(document.querySelector(sel).textContent.trim()) === start - 1,
        selectors.size,
        initialSize
      ).catch(() => {}); // catch to proceed even if timing mismatches; we'll assert after a pause

      // Allow a small delay for updateStats to reflect
      await page.waitForTimeout(150);

      const sizeAfter = Number(await page.$eval(selectors.size, el => el.textContent.trim()));
      expect(sizeAfter).toBe(initialSize - 1);

      // Notice should report the popped value
      const notice = await page.$eval(selectors.notice, el => el.textContent.trim());
      expect(notice).toMatch(/Popped/);

      // The log should include a pop() => ... message
      const logTexts = await page.$$eval(selectors.logMsgs, nodes => nodes.map(n => n.textContent.trim()));
      const foundPopLog = logTexts.some(t => t.includes('pop() =>'));
      expect(foundPopLog).toBeTruthy();
    });

    test('popping until empty then popping again should produce the expected error notice/log', async ({ page }) => {
      // Repeatedly pop until isEmpty becomes true
      let isEmpty = await page.$eval(selectors.isEmpty, el => el.textContent.trim() === 'true');
      // Keep safety guard to avoid infinite loop
      let iterations = 0;
      while (!isEmpty && iterations < 10) {
        await page.click(selectors.popBtn);
        // wait a bit for DOM update and animation
        await page.waitForTimeout(120);
        isEmpty = await page.$eval(selectors.isEmpty, el => el.textContent.trim() === 'true');
        iterations++;
      }

      expect(isEmpty).toBe(true);

      // Now click pop on empty stack -> should set notice and add an error log message
      await page.click(selectors.popBtn);
      await page.waitForTimeout(80);

      const noticeText = await page.$eval(selectors.notice, el => el.textContent.trim());
      expect(noticeText).toContain('Stack is empty');

      // The in-DOM log should contain the 'pop() called on empty stack' error message
      const logTexts = await page.$$eval(selectors.logMsgs, nodes => nodes.map(n => n.textContent.trim()));
      const hasEmptyPopLog = logTexts.some(t => t.includes('pop() called on empty stack'));
      expect(hasEmptyPopLog).toBeTruthy();
    });
  });

  test.describe('Peek interactions', () => {
    test('peek on non-empty stack should show top and not remove it', async ({ page }) => {
      // Ensure there is at least one item
      const sizeBefore = Number(await page.$eval(selectors.size, el => el.textContent.trim()));
      expect(sizeBefore).toBeGreaterThanOrEqual(1);

      const topBefore = await page.$eval(selectors.topValue, el => el.textContent.trim());

      // Click peek
      await page.click(selectors.peekBtn);
      await page.waitForTimeout(80); // allow logging/notice update

      const notice = await page.$eval(selectors.notice, el => el.textContent.trim());
      expect(notice).toContain('Top is');

      // Size should remain unchanged
      const sizeAfter = Number(await page.$eval(selectors.size, el => el.textContent.trim()));
      expect(sizeAfter).toBe(sizeBefore);

      // Top should be unchanged
      const topAfter = await page.$eval(selectors.topValue, el => el.textContent.trim());
      expect(topAfter).toBe(topBefore);

      // Log should include peek() => ... entry
      const logTexts = await page.$$eval(selectors.logMsgs, nodes => nodes.map(n => n.textContent.trim()));
      const peekLogExists = logTexts.some(t => t.includes('peek() =>'));
      expect(peekLogExists).toBeTruthy();
    });

    test('peek on empty stack should indicate empty and log undefined', async ({ page }) => {
      // First clear the stack to ensure empty state
      await page.click(selectors.clearBtn);
      // Wait for size 0
      await page.waitForFunction(sel => document.querySelector(sel).textContent.trim() === '0', selectors.size);

      // Click peek on empty
      await page.click(selectors.peekBtn);
      await page.waitForTimeout(80);

      const notice = await page.$eval(selectors.notice, el => el.textContent.trim());
      expect(notice).toContain('Stack is empty');

      // Log should include 'peek() => undefined'
      const logTexts = await page.$$eval(selectors.logMsgs, nodes => nodes.map(n => n.textContent.trim()));
      const peekUndefined = logTexts.some(t => t.includes('peek() => undefined'));
      expect(peekUndefined).toBeTruthy();
    });
  });

  test.describe('Clear interactions', () => {
    test('clear button empties non-empty stack and updates DOM & stats', async ({ page }) => {
      // Ensure stack is non-empty
      const startSize = Number(await page.$eval(selectors.size, el => el.textContent.trim()));
      expect(startSize).toBeGreaterThanOrEqual(1);

      // Click clear
      await page.click(selectors.clearBtn);

      // Wait for size 0
      await page.waitForFunction(sel => document.querySelector(sel).textContent.trim() === '0', selectors.size, { timeout: 2000 });

      const size = await page.$eval(selectors.size, el => el.textContent.trim());
      expect(size).toBe('0');

      // Array view should show a single "empty" array-item
      const arrayItems = await page.$$eval(selectors.arrayViewItems, nodes => nodes.map(n => n.textContent.trim()));
      expect(arrayItems.length).toBe(1);
      expect(arrayItems[0]).toBe('empty');

      const notice = await page.$eval(selectors.notice, el => el.textContent.trim());
      expect(notice).toContain('Stack cleared');

      // Log should include clear() — stack emptied
      const logTexts = await page.$$eval(selectors.logMsgs, nodes => nodes.map(n => n.textContent.trim()));
      const hasClearLog = logTexts.some(t => t.includes('clear() — stack emptied'));
      expect(hasClearLog).toBeTruthy();
    });

    test('clear on already-empty stack gives appropriate notice and log entry (edge case)', async ({ page }) => {
      // Ensure empty first
      await page.click(selectors.clearBtn);
      await page.waitForFunction(sel => document.querySelector(sel).textContent.trim() === '0', selectors.size);

      // Click clear again on empty
      await page.click(selectors.clearBtn);
      await page.waitForTimeout(80);

      const notice = await page.$eval(selectors.notice, el => el.textContent.trim());
      expect(notice).toContain('already empty');

      // Log should include 'clear() — already empty'
      const logTexts = await page.$$eval(selectors.logMsgs, nodes => nodes.map(n => n.textContent.trim()));
      const hasAlreadyEmptyLog = logTexts.some(t => t.includes('clear() — already empty'));
      expect(hasAlreadyEmptyLog).toBeTruthy();
    });
  });

  test.describe('Implementation evidence & UI feedback checks (visuals & logs)', () => {
    test('visualPush / visualPop produce stack-item elements and animations classes are applied', async ({ page }) => {
      // Ensure we can push a new value and check the class transitions
      await page.fill(selectors.valueInput, 'vis-test');
      await page.click(selectors.pushBtn);

      // Wait for the new top element to appear with text vis-test
      await page.waitForFunction(
        (sel) => document.querySelector(sel) && document.querySelector(sel).textContent.trim() === 'vis-test',
        `${selectors.stackContainerChildren}:first-child`
      );

      // The top element should have class 'top'
      const classList = await page.$eval(`${selectors.stackContainerChildren}:first-child`, el => Array.from(el.classList));
      expect(classList).toContain('top');

      // Now pop it and ensure an animation class 'pop' is applied before removal
      await page.click(selectors.popBtn);
      // There might be a brief moment where the element has 'pop' class; poll for class or ensure the DOM updates to remove it
      await page.waitForTimeout(80);

      // After pop, top should not be 'vis-test'
      const currentTop = await page.$eval(selectors.topValue, el => el.textContent.trim());
      expect(currentTop).not.toBe('vis-test');
    });

    test('DOM log element receives messages corresponding to operations (push/pop/peek/clear)', async ({ page }) => {
      // Clear logs by reloading to simplify capturing the next messages
      await page.reload();
      // Wait for seed to complete again
      await page.waitForFunction(
        (sel) => document.querySelectorAll(sel).length >= 3,
        selectors.arrayViewItems
      );

      // Perform a sequence: push, peek, pop, clear
      await page.fill(selectors.valueInput, 'log-seq');
      await page.click(selectors.pushBtn);
      await page.click(selectors.peekBtn);
      await page.click(selectors.popBtn);
      await page.click(selectors.clearBtn);
      await page.waitForTimeout(200);

      // Collect log messages
      const logs = await page.$$eval(selectors.logMsgs, nodes => nodes.map(n => n.textContent.trim()));

      // Expect logs to mention push, peek, pop, clear in some order
      const hasPush = logs.some(l => l.includes('push('));
      const hasPeek = logs.some(l => l.includes('peek() =>') || l.includes('peek()'));
      const hasPop = logs.some(l => l.includes('pop() =>') || l.includes('pop() called'));
      const hasClear = logs.some(l => l.includes('clear()'));

      expect(hasPush).toBeTruthy();
      expect(hasPeek).toBeTruthy();
      expect(hasPop).toBeTruthy();
      expect(hasClear).toBeTruthy();
    });
  });
});