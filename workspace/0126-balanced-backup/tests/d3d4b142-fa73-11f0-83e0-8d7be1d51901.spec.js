import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d4b142-fa73-11f0-83e0-8d7be1d51901.html';

// Page object for the Deque demo page
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.pushFrontBtn = page.locator('#pushFrontBtn');
    this.pushBackBtn = page.locator('#pushBackBtn');
    this.popFrontBtn = page.locator('#popFrontBtn');
    this.popBackBtn = page.locator('#popBackBtn');
    this.peekFrontBtn = page.locator('#peekFrontBtn');
    this.peekBackBtn = page.locator('#peekBackBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.demoOpsBtn = page.locator('#demoOpsBtn');

    this.belt = page.locator('#belt');
    this.sizeBadge = page.locator('#sizeBadge');
    this.headIdx = page.locator('#headIdx');
    this.tailIdx = page.locator('#tailIdx');
    this.keysList = page.locator('#keysList');
    this.mapView = page.locator('#mapView');
    this.log = page.locator('#log');
    this.lastResult = page.locator('#lastResult');
  }

  async pushFront(value) {
    await this.valueInput.fill(value);
    await this.pushFrontBtn.click();
  }

  async pushBack(value) {
    await this.valueInput.fill(value);
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
    await this.randomBtn.click();
  }

  async autoDemo() {
    await this.demoOpsBtn.click();
  }

  async pressEnterInInput() {
    await this.valueInput.press('Enter');
  }

  // helpers to obtain state
  async beltTexts() {
    const nodes = await this.belt.locator('.node').all();
    const texts = [];
    for (const n of nodes) {
      // the node contains the value text plus an appended idx label; get only the firstText
      const txt = await n.evaluate((el) => {
        // first child text node content (strip idx appended)
        // OuterText includes children; the value is put as textContent then appended child div with idx.
        // We'll return the node's childNodes[0].nodeValue trimmed
        const first = el.childNodes[0];
        return first ? String(first.nodeValue).trim() : el.textContent.trim();
      });
      texts.push(txt);
    }
    return texts;
  }

  async mapViewLines() {
    const content = await this.mapView.textContent();
    if (!content) return [];
    // if '(empty)' then single entry
    if (content.trim() === '(empty)') return [];
    // Otherwise split by newline
    const lines = await this.mapView.locator('div').allTextContents();
    return lines.map(l => l.trim()).filter(Boolean);
  }
}

test.describe('Deque Demo - FSM states & transitions', () => {
  // Collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors to assert later
    page._consoleMessages = [];
    page._pageErrors = [];
    page._dialogs = [];

    page.on('console', (msg) => {
      try {
        page._consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore errors while reading console messages
      }
    });

    page.on('pageerror', (err) => {
      page._pageErrors.push(err);
    });

    page.on('dialog', async (dialog) => {
      // Record and accept all dialogs (alerts that ask to "Enter a value to push")
      page._dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Assert that no unexpected page errors were thrown during the test.
    // Capture them here to fail fast if any runtime errors occurred.
    if (page._pageErrors && page._pageErrors.length > 0) {
      // Re-throw the first to make the test fail with details
      throw page._pageErrors[0];
    }
  });

  test('Initial state (S0_Idle) renders deque and metadata', async ({ page }) => {
    // Validate initial renderDeque() call produced the expected DOM:
    // - initial deque was seeded with X, Y, Z (three nodes)
    const dp = new DequePage(page);

    // The initial UI should show 3 nodes 'X','Y','Z'
    await expect(dp.belt.locator('.node')).toHaveCount(3);

    const texts = await dp.beltTexts();
    expect(texts[0]).toBe('X');
    expect(texts[1]).toBe('Y');
    expect(texts[2]).toBe('Z');

    // Metadata: size should be 3, headIdx 0, tailIdx 3, keysList contains [0,1,2]
    await expect(dp.sizeBadge).toHaveText('3');
    await expect(dp.headIdx).toHaveText('0');
    await expect(dp.tailIdx).toHaveText('3');

    const keysText = await dp.keysList.textContent();
    expect(keysText).toContain('0');
    expect(keysText).toContain('1');
    expect(keysText).toContain('2');

    // Map view should list the mapping lines
    const mapLines = await dp.mapViewLines();
    expect(mapLines.some(l => l.includes('0') && l.includes('X'))).toBeTruthy();
    expect(mapLines.some(l => l.includes('1') && l.includes('Y'))).toBeTruthy();
    expect(mapLines.some(l => l.includes('2') && l.includes('Z'))).toBeTruthy();

    // Last result should be the placeholder '—'
    await expect(dp.lastResult).toHaveText('—');

    // No page errors (ensure runtime is healthy on initial load)
    expect(Array.isArray(page._consoleMessages)).toBeTruthy();
    expect(page._pageErrors.length).toBe(0);
  });

  test.describe('Push operations (S1_PushedFront & S2_PushedBack)', () => {
    test('Push Front updates front, indices and logs', async ({ page }) => {
      const dp = new DequePage(page);

      // Push at front
      await dp.pushFront('FVAL');

      // After pushFront: new headIndex should be -1 (since initial head 0 decremented)
      await expect(dp.sizeBadge).toHaveText('4');
      const head = await dp.headIdx.textContent();
      expect(head.trim()).toBe('-1');

      // Belt first node (front) should show the pushed value 'FVAL'
      const texts = await dp.beltTexts();
      expect(texts[0]).toBe('FVAL');

      // The log should contain an entry with "pushFront(FVAL)".
      const logText = await dp.log.textContent();
      expect(logText).toContain('pushFront(FVAL)');

      // lastResult should reflect the op result (undefined since push returns nothing => lastResult becomes 'undefined' or string of undefined)
      // In performOp, res is undefined so lastResult.textContent === 'undefined'
      await expect(dp.lastResult).toHaveText('undefined');

      // No runtime errors
      expect(page._pageErrors.length).toBe(0);
    });

    test('Push Back updates back, indices and clears input', async ({ page }) => {
      const dp = new DequePage(page);

      // Push at back
      await dp.pushBack('BVAL');

      // After pushBack: size increases to 4, tail index becomes 4
      await expect(dp.sizeBadge).toHaveText('4');
      await expect(dp.tailIdx).toHaveText('4');

      // Belt last node should be 'BVAL'
      const texts = await dp.beltTexts();
      expect(texts[texts.length - 1]).toBe('BVAL');

      // The value input should be cleared after push
      await expect(dp.valueInput).toHaveValue('');

      // lastResult text updates to 'undefined' (push returns nothing)
      await expect(dp.lastResult).toHaveText('undefined');

      expect(page._pageErrors.length).toBe(0);
    });

    test('Pushing with empty input triggers alert and is handled by dialog handler', async ({ page }) => {
      const dp = new DequePage(page);

      // Ensure input empty
      await dp.valueInput.fill('');
      // Click pushBack with empty input to trigger alert
      await dp.pushBackBtn.click();

      // The page.on('dialog') handler in beforeEach accepts and records the dialog
      // Ensure that a dialog was recorded
      expect(Array.isArray(page._dialogs)).toBeTruthy();
      expect(page._dialogs.length).toBeGreaterThanOrEqual(1);
      const dlg = page._dialogs[page._dialogs.length - 1];
      expect(dlg.message).toContain('Enter a value to push');

      // lastResult should not have changed to any value from the push (remains initial or previous)
      // We assert it is still present (not Error)
      const last = await dp.lastResult.textContent();
      expect(typeof last).toBe('string');

      expect(page._pageErrors.length).toBe(0);
    });
  });

  test.describe('Pop and Peek operations (S3_PoppedFront, S4_PoppedBack, S5_PeekedFront, S6_PeekedBack)', () => {
    test('Pop Front removes element and updates metadata', async ({ page }) => {
      const dp = new DequePage(page);

      // Pop front (initial 'X' expected)
      await dp.popFront();

      // lastResult should be 'X'
      await expect(dp.lastResult).toHaveText('X');

      // size should decrement to 2 and head should become 1
      await expect(dp.sizeBadge).toHaveText('2');
      await expect(dp.headIdx).toHaveText('1');

      // belt should show remaining nodes 'Y','Z'
      const texts = await dp.beltTexts();
      expect(texts).toEqual(['Y', 'Z']);

      expect(page._pageErrors.length).toBe(0);
    });

    test('Pop Back removes element and updates metadata', async ({ page }) => {
      const dp = new DequePage(page);

      // Pop back (initial 'Z' expected)
      await dp.popBack();

      await expect(dp.lastResult).toHaveText('Z');

      // size should be 2 and tail should be 2
      await expect(dp.sizeBadge).toHaveText('2');
      await expect(dp.tailIdx).toHaveText('2');

      const texts = await dp.beltTexts();
      expect(texts).toEqual(['X', 'Y']);

      expect(page._pageErrors.length).toBe(0);
    });

    test('Peek Front and Peek Back do not remove elements', async ({ page }) => {
      const dp = new DequePage(page);

      // Peek front should report 'X' and not change size
      await dp.peekFront();
      await expect(dp.lastResult).toHaveText('X');
      await expect(dp.sizeBadge).toHaveText('3');

      // Peek back should report 'Z' and not change size
      await dp.peekBack();
      await expect(dp.lastResult).toHaveText('Z');
      await expect(dp.sizeBadge).toHaveText('3');

      // The belt contents remain unchanged
      const texts = await dp.beltTexts();
      expect(texts).toEqual(['X', 'Y', 'Z']);

      expect(page._pageErrors.length).toBe(0);
    });

    test('Popping from empty deque returns undefined', async ({ page }) => {
      const dp = new DequePage(page);

      // Clear first
      await dp.clear();
      await expect(dp.sizeBadge).toHaveText('0');

      // Pop front on empty -> 'undefined'
      await dp.popFront();
      await expect(dp.lastResult).toHaveText('undefined');

      // Pop back on empty -> 'undefined'
      await dp.popBack();
      await expect(dp.lastResult).toHaveText('undefined');

      expect(page._pageErrors.length).toBe(0);
    });
  });

  test.describe('Clear, Random Fill and Auto Demo (S7_Cleared, S8_FilledRandom, S9_AutoDemo)', () => {
    test('Clear operation empties the deque and updates the map view', async ({ page }) => {
      const dp = new DequePage(page);

      await dp.clear();

      // lastResult set to 'cleared'
      await expect(dp.lastResult).toHaveText('cleared');

      // sizeBadge 0, mapView indicates empty
      await expect(dp.sizeBadge).toHaveText('0');
      const mapLines = await dp.mapViewLines();
      expect(mapLines.length).toBe(0);
      expect(await dp.mapView.textContent()).toContain('(empty)');

      expect(page._pageErrors.length).toBe(0);
    });

    test('Fill Random populates five elements and logs the fill', async ({ page }) => {
      const dp = new DequePage(page);

      await dp.fillRandom();

      // lastResult should be 'random fill'
      await expect(dp.lastResult).toHaveText('random fill');

      // size should be 5
      await expect(dp.sizeBadge).toHaveText('5');

      // belt should have 5 nodes
      await expect(dp.belt.locator('.node')).toHaveCount(5);

      // log should contain 'fill random -> ['
      const logText = await dp.log.textContent();
      expect(logText).toContain('fill random ->');

      expect(page._pageErrors.length).toBe(0);
    });

    test('Auto Demo runs a scripted sequence and finishes', async ({ page }) => {
      const dp = new DequePage(page);

      // Click auto demo; button should be disabled during the demo
      await dp.autoDemo();

      // Immediately after click, button should be disabled
      await expect(dp.demoOpsBtn).toBeDisabled();

      // Wait until the demo finishes and lastResult displays 'demo finished'
      await page.waitForFunction(() => {
        const el = document.getElementById('lastResult');
        return el && el.textContent === 'demo finished';
      }, null, { timeout: 8000 });

      // After finish, demoOpsBtn should be enabled again
      await expect(dp.demoOpsBtn).toBeEnabled();

      // Ensure log contains demo entries
      const logText = await dp.log.textContent();
      expect(logText).toContain('demo:');

      // final lastResult is 'demo finished'
      await expect(dp.lastResult).toHaveText('demo finished');

      expect(page._pageErrors.length).toBe(0);
    }, /* test timeout ms */ 10000);
  });

  test.describe('Misc interactions and keyboard behavior', () => {
    test('Enter key on input triggers pushBack', async ({ page }) => {
      const dp = new DequePage(page);

      // Fill input and press Enter (should behave like pushBack)
      await dp.valueInput.fill('KEYVAL');
      await dp.pressEnterInInput();

      // last node should be KEYVAL (pushBack behavior)
      const texts = await dp.beltTexts();
      expect(texts[texts.length - 1]).toBe('KEYVAL');

      // input should be cleared
      await expect(dp.valueInput).toHaveValue('');

      expect(page._pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console and runtime errors handling', () => {
    test('No unexpected page errors emitted during a set of operations', async ({ page }) => {
      const dp = new DequePage(page);

      // Perform a series of operations
      await dp.pushBack('A1');
      await dp.pushFront('F1');
      await dp.peekFront();
      await dp.popBack();
      await dp.clear();
      await dp.fillRandom();

      // Give a short pause to ensure any async logging settles
      await page.waitForTimeout(200);

      // Assert that no page errors (ReferenceError, TypeError, SyntaxError) have been thrown
      expect(page._pageErrors.length).toBe(0);

      // Console messages array exists (may be empty); ensure it is an array and doesn't contain 'error' type console logs
      expect(Array.isArray(page._consoleMessages)).toBeTruthy();
      const errorConsoles = page._consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoles.length).toBe(0);
    });
  });
});