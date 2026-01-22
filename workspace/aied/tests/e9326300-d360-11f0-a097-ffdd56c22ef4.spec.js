import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9326300-d360-11f0-a097-ffdd56c22ef4.html';

// Page Object for the Deque demo
class DequePage {
  constructor(page) {
    this.page = page;
    // Controls
    this.valueInput = page.locator('#valueInput');
    this.pushFrontBtn = page.locator('#pushFrontBtn');
    this.pushBackBtn = page.locator('#pushBackBtn');
    this.popFrontBtn = page.locator('#popFrontBtn');
    this.popBackBtn = page.locator('#popBackBtn');
    this.peekFrontBtn = page.locator('#peekFrontBtn');
    this.peekBackBtn = page.locator('#peekBackBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.fillRandomBtn = page.locator('#fillRandomBtn');
    this.rotateLeftBtn = page.locator('#rotateLeftBtn');
    this.rotateRightBtn = page.locator('#rotateRightBtn');
    this.rotateAmount = page.locator('#rotateAmount');
    this.runExampleBtn = page.locator('#runExampleBtn');
    this.showCodeBtn = page.locator('#showCodeBtn');
    this.copyStateBtn = page.locator('#copyStateBtn');

    // Visuals / badges / log
    this.dequeVisual = page.locator('#dequeVisual');
    this.opLog = page.locator('#opLog');
    this.sizeBadge = page.locator('#sizeBadge');
    this.capBadge = page.locator('#capBadge');
    this.emptyBadge = page.locator('#emptyBadge');
    this.codeBlock = page.locator('#codeBlock');
    this.sourceCode = page.locator('#sourceCode');
    this.speedRange = page.locator('#speed');
  }

  // Helpers
  async pushFront(value) {
    await this.valueInput.fill(String(value));
    await this.pushFrontBtn.click();
  }

  async pushBack(value) {
    await this.valueInput.fill(String(value));
    await this.pushBackBtn.click();
  }

  async popFront() {
    await this.popFrontBtn.click();
  }

  async popBack() {
    await this.popBackBtn.click();
  }

  async peekFront() {
    await this.peekFrontBtn.click();
  }

  async peekBack() {
    await this.peekBackBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  async fillRandom() {
    await this.fillRandomBtn.click();
  }

  async rotateLeft(amount = '1') {
    await this.rotateAmount.selectOption(String(amount));
    await this.rotateLeftBtn.click();
  }

  async rotateRight(amount = '1') {
    await this.rotateAmount.selectOption(String(amount));
    await this.rotateRightBtn.click();
  }

  async runExample() {
    await this.runExampleBtn.click();
  }

  async toggleShowCode() {
    await this.showCodeBtn.click();
  }

  async copyState() {
    await this.copyStateBtn.click();
  }

  // Inspect visible deque slots text content as array
  async visibleSlots() {
    // Each .slot element inside #dequeVisual; empty slot has 'Deque is empty' text
    const slots = this.dequeVisual.locator('.slot');
    const count = await slots.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await slots.nth(i).textContent()).trim());
    }
    return texts;
  }

  // Wait for a log line containing substring
  async waitForLogContains(text, timeout = 5000) {
    await this.page.waitForFunction(
      (selector, substring) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return Array.from(el.children).some(c => c.textContent.includes(substring));
      },
      '#opLog',
      text,
      { timeout }
    );
  }

  // Get the most recent log message text (opLog prepends new entries)
  async latestLogText() {
    const first = this.opLog.locator('div').first();
    if (await first.count() === 0) return '';
    return (await first.textContent()).trim();
  }
}

test.describe('Deque Interactive Demo - e9326300-d360-11f0-a097-ffdd56c22ef4', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      // store the Error object and its message for assertions
      pageErrors.push(err);
    });

    // Go to the demo page and wait for initial render
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for the initial "Initialized with [10, 20]" log line to appear in the opLog
    await page.waitForFunction(() => {
      const opLog = document.getElementById('opLog');
      return opLog && Array.from(opLog.children).some(c => c.textContent.includes('Initialized with [10, 20]'));
    }, { timeout: 3000 });
  });

  test.afterEach(async ({ page }) => {
    // Attach any console messages or page errors to the test output for debugging
    // (Playwright will display console output automatically; we keep arrays for assertions)
  });

  test('Initial state: shows seeded values and badges reflect size/capacity/empty', async ({ page }) => {
    // Validate initial render and badges reflect the FSM S0_Initial evidence (Initialized with [10, 20], render())
    const dp = new DequePage(page);

    // Visible deque slots should show 10 and 20 in order
    const slots = await dp.visibleSlots();
    expect(slots.length).toBeGreaterThanOrEqual(2);
    expect(slots[0]).toBe('10');
    expect(slots[1]).toBe('20');

    // Badges: size=2, capacity=8, emptyBadge=false
    await expect(dp.sizeBadge).toHaveText('2');
    await expect(dp.capBadge).toHaveText('8');
    await expect(dp.emptyBadge).toHaveText('false');

    // Operation log contains initialization message
    await dp.waitForLogContains('Initialized with [10, 20]');

    // Ensure no uncaught page errors occurred during initial render
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Basic push/pop and peek operations', () => {
    test('Push Front and Push Back transition deque and logs operations', async ({ page }) => {
      const dp = new DequePage(page);

      // Push front a value '5' and verify it becomes the first slot
      await dp.pushFront(5);
      await dp.waitForLogContains('pushFront(5)');
      let slots = await dp.visibleSlots();
      expect(slots[0]).toBe('5');

      // Push back '99' and verify it becomes the last slot
      await dp.pushBack(99);
      await dp.waitForLogContains('pushBack(99)');
      slots = await dp.visibleSlots();
      expect(slots[slots.length - 1]).toBe('99');

      // Size badge should reflect new size (original 2 + 2 = 4)
      await expect(dp.sizeBadge).toHaveText('4');
    });

    test('Pop Front and Pop Back remove items and log returned value (including undefined edge)', async ({ page }) => {
      const dp = new DequePage(page);

      // Ensure we have some items: pushBack 'X' and 'Y'
      await dp.pushBack('X');
      await dp.pushBack('Y');
      await dp.waitForLogContains('pushBack(Y)');

      // Pop front should remove the front value and log it
      await dp.popFront();
      await dp.waitForLogContains('popFront() ->');

      // Pop back should remove last and log it
      await dp.popBack();
      await dp.waitForLogContains('popBack() ->');

      // Clear all, then pop to exercise undefined behavior
      await dp.clear();
      await dp.waitForLogContains('clear()');

      // Pop from empty
      await dp.popFront();
      await dp.waitForLogContains('popFront() -> undefined');
      await dp.popBack();
      await dp.waitForLogContains('popBack() -> undefined');

      // emptyBadge should be 'true'
      await expect(dp.emptyBadge).toHaveText('true');
    });

    test('Peek Front and Peek Back do not mutate state and are logged', async ({ page }) => {
      const dp = new DequePage(page);

      // Start fresh: clear then pushBack known values
      await dp.clear();
      await dp.pushBack(1);
      await dp.pushBack(2);
      await dp.waitForLogContains('pushBack(2)');

      const before = await dp.visibleSlots();

      // Peek front
      await dp.peekFront();
      await dp.waitForLogContains('peekFront() -> 1');

      // Peek back
      await dp.peekBack();
      await dp.waitForLogContains('peekBack() -> 2');

      // Visual slots unchanged
      const after = await dp.visibleSlots();
      expect(after).toEqual(before);
    });
  });

  test.describe('Advanced operations: clear, fillRandom, rotate, runExample, code toggling, debug', () => {
    test('Clear empties the deque and Fill Random repopulates with >=6 items', async ({ page }) => {
      const dp = new DequePage(page);

      // Ensure non-empty then clear
      await dp.pushBack('A');
      await dp.waitForLogContains('pushBack(A)');
      await dp.clear();
      await dp.waitForLogContains('clear()');

      // Visual should show empty message
      const slots = await dp.visibleSlots();
      expect(slots.length).toBe(1);
      expect(slots[0]).toContain('Deque is empty');

      // Fill random when empty should produce at least 6 items
      await dp.fillRandom();
      await dp.waitForLogContains('fillRandom(');
      // Size badge should be >=6
      const sizeText = await dp.sizeBadge.textContent();
      const sizeNum = parseInt(sizeText, 10);
      expect(sizeNum).toBeGreaterThanOrEqual(6);
      expect(sizeNum).toBeLessThanOrEqual(12); // based on implementation 6..11
    });

    test('Rotate Left/Right changes logical order according to rotateAmount', async ({ page }) => {
      const dp = new DequePage(page);

      // Prepare predictable list [10,20,30,40]
      await dp.clear();
      await dp.pushBack(10);
      await dp.pushBack(20);
      await dp.pushBack(30);
      await dp.pushBack(40);
      await dp.waitForLogContains('pushBack(40)');

      let slots = await dp.visibleSlots();
      expect(slots).toEqual(['10', '20', '30', '40']);

      // Rotate left by 2 -> expected order [30,40,10,20]
      await dp.rotateLeft('2');
      await dp.waitForLogContains('rotateLeft(2)');
      slots = await dp.visibleSlots();
      expect(slots[0]).toBe('30');
      expect(slots[1]).toBe('40');
      expect(slots[2]).toBe('10');
      expect(slots[3]).toBe('20');

      // Rotate right by 1 -> expected [20,30,40,10]
      await dp.rotateRight('1');
      await dp.waitForLogContains('rotateRight(1)');
      slots = await dp.visibleSlots();
      expect(slots[0]).toBe('20');
      expect(slots[slots.length - 1]).toBe('10');
    });

    test('Run Example Sequence completes and logs final message', async ({ page }) => {
      const dp = new DequePage(page);

      // Speed up the example to keep test fast
      await dp.speedRange.fill('800'); // high value reduces pause in runExample
      // Kick off example
      await dp.runExample();

      // Wait for the example to finish (log 'Example sequence finished')
      await dp.waitForLogContains('Example sequence finished', 15000);
      const latest = await dp.latestLogText();
      expect(latest).toContain('Example sequence finished');
    });

    test('Show/Hide Code toggles codeBlock display and sourceCode contains Deque class string', async ({ page }) => {
      const dp = new DequePage(page);

      // Initially hidden
      await expect(dp.codeBlock).toBeHidden();

      // Show code
      await dp.toggleShowCode();
      await expect(dp.codeBlock).toBeVisible();

      // sourceCode should include the word 'class Deque' (Deque.toString() was set)
      const srcText = await dp.sourceCode.textContent();
      expect(srcText).toContain('class Deque');

      // Hide again
      await dp.toggleShowCode();
      await expect(dp.codeBlock).toBeHidden();
    });

    test('Double-click on visual logs debugBuffer and triggers an alert (dialog handled)', async ({ page }) => {
      const dp = new DequePage(page);

      // Ensure there is some content (seeded initially has [10,20])
      await dp.waitForLogContains('Initialized with [10, 20]');

      // Listen for dialog and accept it
      page.on('dialog', async (dialog) => {
        // verify the alert text contains 'Internal buffer snapshot' or buffer JSON
        expect(dialog.message()).toContain('Internal buffer snapshot');
        await dialog.accept();
      });

      // Perform double click on dequeVisual which triggers debugBuffer log and alert in handler
      await dp.dequeVisual.dblclick();

      // debugBuffer log entry should be present
      await dp.waitForLogContains('debugBuffer ->', 3000);
      const topLog = await dp.latestLogText();
      expect(topLog).toContain('debugBuffer ->');
    });

    test('Copy State click logs "State copied to clipboard" even if clipboard is unavailable', async ({ page }) => {
      const dp = new DequePage(page);

      // Click copy state button
      await dp.copyState();

      // The UI always logs 'State copied to clipboard' even if navigator.clipboard is undefined
      await dp.waitForLogContains('State copied to clipboard', 3000);
      const found = await dp.opLog.locator('div', { hasText: 'State copied to clipboard' }).count();
      expect(found).toBeGreaterThan(0);
    });
  });

  test.describe('Input parsing, keyboard shortcuts, and edge cases', () => {
    test('Value input accepts JSON-like text and is parsed on push', async ({ page }) => {
      const dp = new DequePage(page);

      // Push a JSON object string
      await dp.valueInput.fill('{"a":1}');
      await dp.pushBackBtn.click();
      await dp.waitForLogContains('pushBack({"a":1})');
      let slots = await dp.visibleSlots();
      expect(slots[slots.length - 1]).toBe('{"a":1}');

      // Push a quoted string
      await dp.valueInput.fill('"hello"');
      await dp.pushBackBtn.click();
      await dp.waitForLogContains('pushBack(hello)');
      slots = await dp.visibleSlots();
      expect(slots[slots.length - 1]).toBe('hello');

      // Push a bare number
      await dp.valueInput.fill('42');
      await dp.pushFrontBtn.click();
      await dp.waitForLogContains('pushFront(42)');
      slots = await dp.visibleSlots();
      expect(slots[0]).toBe('42');
    });

    test('Keyboard shortcuts: Enter => pushBack, F2 => pushFront, Delete => popBack', async ({ page }) => {
      const dp = new DequePage(page);

      // Clear and then use keyboard to pushBack with Enter
      await dp.clear();
      await dp.valueInput.fill('K');
      await page.keyboard.press('Enter'); // bound to pushBack
      await dp.waitForLogContains('pushBack(K)');

      // Use F2 to pushFront
      await dp.valueInput.fill('L');
      await page.keyboard.press('F2');
      await dp.waitForLogContains('pushFront(L)');

      // Use Delete to popBack
      await page.keyboard.press('Delete');
      await dp.waitForLogContains('popBack() ->');
    });

    test('Pushing with empty input logs a "no value provided" message and does not change deque', async ({ page }) => {
      const dp = new DequePage(page);

      // Ensure some content exists and record size
      await dp.pushBack('tmp');
      await dp.waitForLogContains('pushBack(tmp)');
      const beforeSize = parseInt(await dp.sizeBadge.textContent(), 10);

      // Clear input and attempt pushBack -> should log "no value provided" and not change size
      await dp.valueInput.fill('   ');
      await dp.pushBackBtn.click();
      await dp.waitForLogContains('pushBack: no value provided');

      const afterSize = parseInt(await dp.sizeBadge.textContent(), 10);
      expect(afterSize).toBe(beforeSize);
    });
  });

  test.describe('Console and page error observation (must not patch environment)', () => {
    test('No unexpected uncaught exceptions or console.error entries occurred during interactions', async ({ page }) => {
      // We executed many interactions in previous tests (Playwright runs tests isolated per worker but our beforeEach captured events for this test)
      // For this test we re-open the page and perform a small sequence while recording console/pageerror
      const localConsole = [];
      const localPageErrors = [];
      page.on('console', m => localConsole.push({ type: m.type(), text: m.text() }));
      page.on('pageerror', err => localPageErrors.push(err));

      // Visit app fresh
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForFunction(() => {
        const opLog = document.getElementById('opLog');
        return opLog && Array.from(opLog.children).some(c => c.textContent.includes('Initialized with [10, 20]'));
      }, { timeout: 3000 });

      // Perform small actions
      const dp = new DequePage(page);
      await dp.pushBack('E1');
      await dp.waitForLogContains('pushBack(E1)');
      await dp.clear();
      await dp.waitForLogContains('clear()');

      // Assertions: no uncaught page errors
      expect(localPageErrors.length).toBe(0);

      // Assertions: no console.error messages (we allow console info/debug)
      const consoleErrs = localConsole.filter(m => m.type === 'error' && /ReferenceError|TypeError|SyntaxError/i.test(m.text));
      // There should be no critical runtime error messages
      expect(consoleErrs.length).toBe(0);
    });
  });
});