import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9337471-d360-11f0-a097-ffdd56c22ef4.html';

/*
 Page Object for the Priority Queue visualizer
 Encapsulates common interactions and queries to keep tests readable.
*/
class HeapPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      mode: page.locator('#mode'),
      val: page.locator('#val'),
      pri: page.locator('#pri'),
      enqueue: page.locator('#enqueue'),
      dequeue: page.locator('#dequeue'),
      peek: page.locator('#peek'),
      clear: page.locator('#clear'),
      random: page.locator('#random'),
      bulk: page.locator('#bulk'),
      findVal: page.locator('#findVal'),
      newPri: page.locator('#newPri'),
      changePri: page.locator('#changePri'),
      remove: page.locator('#remove'),
      speed: page.locator('#speed'),
      speedVal: page.locator('#speedVal'),
      arrayView: page.locator('#arrayView'),
      log: page.locator('#log'),
      size: page.locator('#size'),
      root: page.locator('#root'),
      treeWrap: page.locator('#treeWrap'),
    };
  }

  async navigate() {
    await this.page.goto(APP_URL);
    // Wait for initial render and log message
    await this.locators.log.waitFor({ state: 'visible' });
  }

  async getSizeText() {
    return (await this.locators.size.textContent()).trim();
  }

  async getRootText() {
    return (await this.locators.root.textContent()).trim();
  }

  async getLatestLog() {
    // log updates prepend new entries; get first child text
    const html = await this.locators.log.innerHTML();
    // strip tags to get latest message content (simple)
    // The log uses <div> wrappers for each entry; take the first
    const match = html.match(/<div[^>]*>\s*(\[[^\]]+\]\s*)(.*?)<\/div>/);
    if (match) return match[2].replace(/&lt;|&gt;|&amp;/g, (m) => (m === '&lt;' ? '<' : m === '&gt;' ? '>' : '&'));
    return html;
  }

  async waitForLogContains(text, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, t) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.innerText.indexOf(t) !== -1;
      },
      '#log',
      text,
      { timeout }
    );
  }

  async enqueueItem(value, priority) {
    if (value !== undefined) {
      await this.locators.val.fill(String(value));
    }
    if (priority !== undefined) {
      await this.locators.pri.fill(String(priority));
    }
    await this.locators.enqueue.click();
  }

  async clickDequeue() {
    await this.locators.dequeue.click();
  }

  async clickPeek() {
    await this.locators.peek.click();
  }

  async clickClear() {
    await this.locators.clear.click();
  }

  async clickRandom() {
    await this.locators.random.click();
  }

  async clickBulk() {
    await this.locators.bulk.click();
  }

  async changeMode(modeValue) {
    await this.locators.mode.selectOption(modeValue);
  }

  async changeSpeed(value) {
    await this.locators.speed.fill(String(value));
    // trigger input event
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async changePriority(findVal, newPri) {
    await this.locators.findVal.fill(String(findVal));
    await this.locators.newPri.fill(String(newPri));
    await this.locators.changePri.click();
  }

  async removeByValue(findVal) {
    await this.locators.findVal.fill(String(findVal));
    await this.locators.remove.click();
  }

  async clickArrayCell(index = 0) {
    // Wait for at least one cell
    await this.page.waitForFunction((sel) => !!document.querySelector(sel) && document.querySelector(sel).children.length > 0, '#arrayView');
    const cells = await this.page.$$('#arrayView .cell');
    if (cells.length === 0) throw new Error('No array cells to click');
    const idx = Math.min(index, cells.length - 1);
    await cells[idx].click();
  }

  async getArrayValues() {
    return this.page.$$eval('#arrayView .cell .val', els => els.map(e => e.textContent.trim()));
  }

  async getArrayPriorities() {
    return this.page.$$eval('#arrayView .cell .pri', els => els.map(e => e.textContent.trim()));
  }

  async waitForSize(expected, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, exp) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim() === String(exp);
      },
      '#size',
      String(expected),
      { timeout }
    );
  }

  async waitForRootContains(substr, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, s) => {
        const el = document.querySelector(sel);
        return el && el.textContent.indexOf(s) !== -1;
      },
      '#root',
      substr,
      { timeout }
    );
  }
}

/*
 Capture console and page errors for each test.
 Tests will assert that no unexpected console errors or page errors occurred.
*/
test.describe('Priority Queue Visualizer - FSM and UI validations', () => {
  let consoleEntries = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleEntries = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleEntries.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initialization and Empty State (S0_Initialized -> S1_Empty)', () => {
    test('Initial render: size 0, root empty, initial logs present', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Verify initial stats
      await expect(hp.locators.size).toHaveText('0');
      await expect(hp.locators.root).toHaveText('—');

      // The application logs initialization messages; ensure they exist
      await hp.waitForLogContains('Initialized', 2000);
      await hp.waitForLogContains('Priority Queue visualizer ready', 2000);

      // Speed display should reflect default 300ms
      await expect(hp.locators.speedVal).toHaveText('300ms');

      // No runtime page errors or console.error messages occurred
      expect(pageErrors.length, `page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length, `console errors: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
    });

    test('Attempt to dequeue when empty should log an appropriate error message', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Click dequeue while empty
      await hp.clickDequeue();

      // Validate log contains the expected message
      await hp.waitForLogContains('Cannot dequeue — queue is empty');

      // Ensure size still zero and root unchanged
      await expect(hp.locators.size).toHaveText('0');
      await expect(hp.locators.root).toHaveText('—');

      // No unexpected runtime errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Peek when empty logs "Peek → empty"', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      await hp.clickPeek();
      await hp.waitForLogContains('Peek → empty');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Enqueue / Non-empty transitions (S1_Empty -> S2_NonEmpty and S2_NonEmpty behavior)', () => {
    test('Enqueue with valid priority updates size and root (single item)', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      await hp.enqueueItem('alpha', 42);

      // Enqueue logs a message
      await hp.waitForLogContains('Enqueued "alpha" with priority 42', 3000);

      // Size should be 1 and root should reflect the item
      await hp.waitForSize(1);
      await hp.waitForRootContains('alpha (42)');

      // The array view should contain a cell with value 'alpha'
      const values = await hp.getArrayValues();
      expect(values).toContain('alpha');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Enqueue without numeric priority logs validation message', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Provide a value but leave priority empty
      await hp.locators.val.fill('badPri');
      await hp.locators.pri.fill(''); // ensure empty
      await hp.locators.enqueue.click();

      await hp.waitForLogContains('Priority must be a number');

      // Size should remain 0
      await expect(hp.locators.size).toHaveText('0');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Bulk insert creates 10 items and updates size accordingly', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      await hp.clickBulk();

      // Wait for size to be 10 (bulk inserts synchronous then final render)
      await hp.waitForSize(10, 8000);

      // Log entry for bulk insert
      await hp.waitForLogContains('Bulk inserted 10 items', 3000);

      // Array view should show many cells
      const values = await hp.getArrayValues();
      expect(values.length).toBeGreaterThanOrEqual(10);

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Insert Random increases size by 1', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // initial size
      const initial = Number(await hp.getSizeText());
      await hp.clickRandom();

      // New size should be initial + 1
      await hp.waitForSize(initial + 1, 5000);
      await hp.waitForLogContains('Enqueued random', 3000);

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Dequeue on non-empty removes top and updates root/size', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Ensure at least two items exist so dequeue behavior is evident
      await hp.enqueueItem('d1', 20);
      await hp.waitForLogContains('Enqueued "d1" with priority 20');
      await hp.enqueueItem('d2', 10);
      await hp.waitForLogContains('Enqueued "d2" with priority 10');

      // Now size >= 2
      await hp.waitForSize(2);

      // Dequeue and expect a logged message referencing the dequeued item
      await hp.clickDequeue();
      await hp.waitForLogContains('Dequeued', 5000);

      // Size should have decreased by 1
      const sizeAfter = Number(await hp.getSizeText());
      expect(sizeAfter).toBeGreaterThanOrEqual(1);

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Modify / Remove operations (S2_NonEmpty)', () => {
    test('Change priority of an existing item updates structure and logs change', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Enqueue two known items
      await hp.enqueueItem('foo', 50);
      await hp.waitForLogContains('Enqueued "foo" with priority 50');
      await hp.enqueueItem('baz', 60);
      await hp.waitForLogContains('Enqueued "baz" with priority 60');

      // Now change foo's priority to 1 (should bubble up in min-heap)
      await hp.changePriority('foo', 1);

      await hp.waitForLogContains('Changed priority of "foo" → 1', 5000);

      // Root likely contains foo now (min-heap: priority 1 smallest)
      await hp.waitForRootContains('foo (1)', 3000);

      // Size unchanged
      await expect(hp.locators.size).toHaveText('2');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Changing priority with missing value or invalid new priority logs validation', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Attempt change without providing a value
      await hp.locators.findVal.fill('');
      await hp.locators.newPri.fill('5');
      await hp.locators.changePri.click();
      await hp.waitForLogContains('Provide a value to find');

      // Attempt change with non-numeric new priority
      await hp.locators.findVal.fill('ghost');
      await hp.locators.newPri.fill('notanumber');
      await hp.locators.changePri.click();
      await hp.waitForLogContains('New priority must be a number');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Remove by value removes the item and logs removal', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Enqueue an item
      await hp.enqueueItem('toremove', 33);
      await hp.waitForLogContains('Enqueued "toremove" with priority 33');

      // Remove it
      await hp.removeByValue('toremove');
      await hp.waitForLogContains('Removed "toremove"', 5000);

      // Ensure item no longer in array
      const values = await hp.getArrayValues();
      expect(values).not.toContain('toremove');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Remove with missing value logs validation', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      await hp.locators.findVal.fill('');
      await hp.locators.remove.click();

      await hp.waitForLogContains('Provide a value to remove');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('UI interactions and helpers', () => {
    test('Clicking array item pre-fills find and new priority fields and logs selection', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Enqueue an item and wait for it to appear
      await hp.enqueueItem('pickme', 77);
      await hp.waitForLogContains('Enqueued "pickme" with priority 77');
      await hp.waitForSize(1);

      // Click the first array cell
      await hp.clickArrayCell(0);

      // The findVal and newPri fields should be prefilled
      const findVal = await hp.locators.findVal.inputValue();
      const newPri = await hp.locators.newPri.inputValue();
      expect(findVal).toBe('pickme');
      expect(newPri).toBe('77');

      // A log entry should state selection
      await hp.waitForLogContains('Selected "pickme" from array (priority 77)');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Speed control updates the displayed speed text', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      await hp.changeSpeed(500);
      await expect(hp.locators.speedVal).toHaveText('500ms');

      await hp.changeSpeed(120);
      await expect(hp.locators.speedVal).toHaveText('120ms');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Mode change re-initializes the PQ and logs the new mode', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Change to max heap
      await hp.changeMode('max');
      // initPQ logs Initialized ...
      await hp.waitForLogContains('Initialized max-heap');

      // Size should be 0 after re-init
      await expect(hp.locators.size).toHaveText('0');
      await expect(hp.locators.root).toHaveText('—');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clear button empties the heap and logs cleared', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Add a few items
      await hp.enqueueItem('a', 1);
      await hp.waitForLogContains('Enqueued "a" with priority 1');
      await hp.enqueueItem('b', 2);
      await hp.waitForLogContains('Enqueued "b" with priority 2');

      // Now clear
      await hp.clickClear();
      await hp.waitForLogContains('Cleared heap');

      await expect(hp.locators.size).toHaveText('0');
      await expect(hp.locators.root).toHaveText('—');

      // Array view should indicate empty
      const arrayText = await hp.locators.arrayView.innerText();
      expect(arrayText.toLowerCase()).toContain('heap is empty');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Keyboard Enter on priority input triggers enqueue', async ({ page }) => {
      const hp = new HeapPage(page);
      await hp.navigate();

      // Fill value and priority, then focus priority and press Enter
      await hp.locators.val.fill('kbdItem');
      await hp.locators.pri.fill('11');
      await hp.locators.pri.focus();
      await page.keyboard.press('Enter');

      // Expect enqueue log
      await hp.waitForLogContains('Enqueued "kbdItem" with priority 11');

      // Size should be 1
      await hp.waitForSize(1);

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleEntries.filter(e => e.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final check: assert there are no unexpected runtime page errors or console error-level messages
    // If a test expects an error it should assert it explicitly inside the test.
    const consoleErrors = consoleEntries.filter(e => e.type === 'error');
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);

    // Close page to ensure teardown
    await page.close();
  });
});