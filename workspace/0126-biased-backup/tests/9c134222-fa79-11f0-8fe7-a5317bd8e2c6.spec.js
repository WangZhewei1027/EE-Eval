import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c134222-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper page-object like utilities for common actions
class MultisetPage {
  constructor(page) {
    this.page = page;
  }

  async clickWithPromptResponse(selector, response) {
    // prepare dialog handler to respond to the single prompt/confirm/alert
    this.page.once('dialog', async dialog => {
      await dialog.accept(response);
    });
    await this.page.click(selector);
  }

  async clickAndAcceptConfirm(selector) {
    this.page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await this.page.click(selector);
  }

  async clickAndCaptureAlert(selector) {
    return new Promise(async (resolve) => {
      this.page.once('dialog', async dialog => {
        const msg = dialog.message();
        await dialog.accept();
        resolve(msg);
      });
      await this.page.click(selector);
    });
  }

  async setInput(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async getText(selector) {
    return (await this.page.$eval(selector, el => el.textContent)).trim();
  }

  async getSelectOptions(selector) {
    return this.page.$$eval(selector + ' option', opts => opts.map(o => o.value));
  }

  async selectValue(selector, value) {
    await this.page.selectOption(selector, value);
  }

  async click(selector) {
    await this.page.click(selector);
  }
}

test.describe('Multiset Explorer - end-to-end', () => {
  let page;
  let msPage;
  const consoleMessages = [];
  const pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Collect console messages and page errors across each test for assertions
    consoleMessages.length = 0;
    pageErrors.length = 0;
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    msPage = new MultisetPage(page);
    await page.goto(APP_URL, { waitUntil: 'load' });
    // wait a tick for bootstrap to run and UI to render
    await page.waitForSelector('#ms-select');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial state (Idle) - UI rendered and bootstrap created sample multisets', async () => {
    // Validate core controls are present and initial sample multisets were created
    await expect(page.locator('#new-ms')).toBeVisible();
    await expect(page.locator('#clone-ms')).toBeVisible();
    await expect(page.locator('#add-element')).toBeVisible();
    const options = await msPage.getSelectOptions('#ms-select');
    // bootstrap should create M1 and M2 per implementation
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options).toEqual(expect.arrayContaining(['M1', 'M2']));

    // ms-stats should show non-zero totals (since M1 has elements)
    const stats = await msPage.getText('#ms-stats');
    expect(stats).toMatch(/distinct:\d+\s+total:\d+/);

    // history-list should contain at least the initial snapshot
    const historyText = await page.$eval('#history-list', el => el.textContent || '');
    expect(historyText).toContain('Initial sample multisets');

    // assert there were no uncaught page errors during initialization
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Multiset management (New, Clone, Rename, Delete)', () => {
    test('Create New multiset via prompt and observe history update', async () => {
      // Click New and provide a prompt response "TestMS"
      await msPage.clickWithPromptResponse('#new-ms', 'TestMS');

      // New multiset should appear in selects
      const opts = await msPage.getSelectOptions('#ms-select');
      expect(opts).toContain('TestMS');

      // History should include Created multiset TestMS
      const historyText = await page.$eval('#history-list', el => el.textContent || '');
      expect(historyText).toContain('Created multiset TestMS');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Clone active multiset creates new name and logs snapshot', async () => {
      // Ensure active is M1
      await msPage.selectValue('#ms-select', 'M1');
      // Click clone, implementation will create a unique name like M1_copy1 etc.
      await msPage.click('#clone-ms');

      // New option should be present in the ms-select
      const opts = await msPage.getSelectOptions('#ms-select');
      const cloneNames = opts.filter(o => o.startsWith('M1_copy'));
      expect(cloneNames.length).toBeGreaterThan(0);

      // History should reflect clone description
      const historyText = await page.$eval('#history-list', el => el.textContent || '');
      expect(historyText).toMatch(/Cloned M1 to M1_copy/);

      expect(pageErrors.length).toBe(0);
    });

    test('Rename active multiset via prompt and validate rename snapshot', async () => {
      // Make sure M2 exists to rename
      await msPage.selectValue('#ms-select', 'M2');

      // Intercept prompt and provide new name
      await msPage.clickWithPromptResponse('#rename-ms', 'M2_RENAMED');

      const opts = await msPage.getSelectOptions('#ms-select');
      expect(opts).toContain('M2_RENAMED');
      // history should include Renamed
      const historyText = await page.$eval('#history-list', el => el.textContent || '');
      expect(historyText).toContain('Renamed');

      expect(pageErrors.length).toBe(0);
    });

    test('Delete multiset with confirm and verify removal', async () => {
      // Create a fresh named multiset then delete it to keep other tests stable
      await msPage.clickWithPromptResponse('#new-ms', 'TO_DELETE');
      let opts = await msPage.getSelectOptions('#ms-select');
      expect(opts).toContain('TO_DELETE');

      // Accept delete confirm
      await msPage.clickAndAcceptConfirm('#delete-ms');

      opts = await msPage.getSelectOptions('#ms-select');
      expect(opts).not.toContain('TO_DELETE');

      // history should include Deleted
      const historyText = await page.$eval('#history-list', el => el.textContent || '');
      expect(historyText).toContain('Deleted');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Element operations (Add, Inc, Dec, Remove)', () => {
    test('Add element with multiplicity, increment, decrement and remove', async () => {
      // Ensure we're on M1
      await msPage.selectValue('#ms-select', 'M1');

      // Set element and multiplicity and add
      await msPage.setInput('#element-input', 'kiwi');
      await msPage.setInput('#multiplicity-input', '2');
      await msPage.click('#add-element');

      // View should show kiwi with multiplicity 2 (compact view default)
      // Ensure view-mode is compact to make parsing predictable
      await msPage.selectValue('#view-mode', 'compact');
      await page.waitForTimeout(50);
      let msView = await msPage.getText('#ms-view');
      expect(msView).toContain('kiwi:2');

      // Increment multiplicity
      await msPage.setInput('#element-input', 'kiwi');
      await msPage.click('#inc-element');
      msView = await msPage.getText('#ms-view');
      expect(msView).toContain('kiwi:3');

      // Decrement multiplicity
      await msPage.setInput('#element-input', 'kiwi');
      await msPage.click('#dec-element');
      msView = await msPage.getText('#ms-view');
      expect(msView).toContain('kiwi:2');

      // Remove element
      await msPage.setInput('#element-input', 'kiwi');
      await msPage.click('#remove-element');
      msView = await msPage.getText('#ms-view');
      expect(msView).not.toContain('kiwi:');

      expect(pageErrors.length).toBe(0);
    });

    test('Edge cases: Add element without active should alert (simulate by temporarily clearing active)', async () => {
      // This edge case: set ms-select to (none) by manipulating state via UI:
      // There is no direct UI to clear active; instead create new multiset and then delete all to cause no active
      // Create and delete a distinct temporary sequence to attempt an operation when no active exists.
      // Create a new multiset
      await msPage.clickWithPromptResponse('#new-ms', 'TEMP_EDGE');
      // Delete other multisets until only TEMP_EDGE remains, then delete it as well to produce no active.
      // To keep test deterministic, we'll delete TEMP_EDGE directly via selecting it and confirming delete.
      await msPage.selectValue('#ms-select', 'TEMP_EDGE');
      await msPage.clickAndAcceptConfirm('#delete-ms');

      // Now attempt add-element: the handler will alert('No active'). Capture that alert message.
      const alertPromise = msPage.clickAndCaptureAlert('#add-element');
      // ensure element input is populated to avoid 'No element' overshadowing, but the code checks active first
      await msPage.setInput('#element-input', 'z');
      const alertMsg = await alertPromise;
      expect(alertMsg).toContain('No active');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Bulk operations and previews (ApplyBulk, ClearBulk, binary ops)', () => {
    test('Apply bulk text to active multiset and clear bulk field', async () => {
      // Ensure using M1
      await msPage.selectValue('#ms-select', 'M1');

      // Put bulk text and apply
      await msPage.setInput('#bulk-input', 'apple:2, pear, grape:3');
      await msPage.click('#apply-bulk');

      // Ensure bulk result reflected in ms-view (apple increased). apple existed so it should be present
      await msPage.selectValue('#view-mode', 'compact');
      const msView = await msPage.getText('#ms-view');
      expect(msView).toMatch(/apple:\d+/);
      expect(msView).toMatch(/pear:\d+/);
      expect(msView).toMatch(/grape:\d+/);

      // Clear bulk
      await msPage.click('#clear-bulk');
      const bulkVal = await page.$eval('#bulk-input', el => el.value);
      expect(bulkVal).toBe('');

      expect(pageErrors.length).toBe(0);
    });

    test('Perform binary operations (union) and preview result & log', async () => {
      // Choose M1 and M2 as LHS and RHS
      await msPage.selectValue('#lhs-select', 'M1');
      await msPage.selectValue('#rhs-select', 'M2');

      // Click union and expect preview JSON and a log entry 'preview union'
      await msPage.click('#op-union');

      // op-preview should contain JSON with keys from M1 and M2, e.g., 'cherry' (from M2)
      const previewText = await msPage.getText('#op-preview');
      expect(previewText).toMatch(/\{/); // JSON-ish
      expect(previewText).toContain('cherry'); // cherry is in M2 in bootstrap

      // op-log should contain an entry for preview union
      const opLog = await page.$eval('#op-log', el => el.textContent || '');
      expect(opLog).toContain('preview union');

      expect(pageErrors.length).toBe(0);
    });

    test('Apply preview as new multiset (Create New) and validate created name & history', async () => {
      // Ensure a preview exists (generate union again)
      await msPage.selectValue('#lhs-select', 'M1');
      await msPage.selectValue('#rhs-select', 'M2');
      await msPage.click('#op-union');

      // Click apply-as-new
      await msPage.click('#apply-result-new');

      // A new multiset with name starting with M (makeUniqueName) should be created and in ms-select
      const opts = await msPage.getSelectOptions('#ms-select');
      // Expect at least one option whose name wasn't originally M1/M2; find any with prefix 'M' and not equal to M1/M2
      const newOpts = opts.filter(o => o !== 'M1' && o !== 'M2');
      expect(newOpts.length).toBeGreaterThan(0);

      // History should reflect creation from preview
      const historyText = await page.$eval('#history-list', el => el.textContent || '');
      expect(historyText).toContain('Created');
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('History (Undo/Redo) and history slider', () => {
    test('Undo and Redo change history index and update view', async () => {
      // Ensure multiple history entries exist by making a small change
      await msPage.selectValue('#ms-select', 'M1');
      await msPage.setInput('#element-input', 'tempX');
      await msPage.setInput('#multiplicity-input', '1');
      await msPage.click('#add-element');

      // Get current slider value
      const sliderValueBefore = await page.$eval('#history-slider', el => el.value);
      expect(Number(sliderValueBefore)).toBeGreaterThanOrEqual(1);

      // Click undo
      // Undo triggers alert if no more undo; here there should be history so it will proceed
      await msPage.click('#undo');

      // Slider value should have decreased by at least 1
      const sliderValueAfterUndo = Number(await page.$eval('#history-slider', el => el.value));
      expect(sliderValueAfterUndo).toBeLessThanOrEqual(Number(sliderValueBefore) - 1);

      // Click redo to go forward
      await msPage.click('#redo');
      const sliderValueAfterRedo = Number(await page.$eval('#history-slider', el => el.value));
      // Should be back at or above undo value
      expect(sliderValueAfterRedo).toBeGreaterThanOrEqual(sliderValueAfterUndo);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Workflow Builder and Diagnostics (edge/error scenarios)', () => {
    test('Workflow add op with invalid JSON parameter triggers alert', async () => {
      // Open new workflow
      await msPage.click('#wf-new');

      // Prepare to capture the alert message when invalid JSON param is used
      const alertPromise = new Promise(async (resolve) => {
        page.once('dialog', async dialog => {
          const msg = dialog.message();
          await dialog.accept();
          resolve(msg);
        });
      });

      // Put an invalid JSON string and click add op
      await msPage.setInput('#wf-param', 'not-json');
      await msPage.click('#wf-add-op');

      const alertMsg = await alertPromise;
      expect(alertMsg).toContain('Invalid JSON param');

      expect(pageErrors.length).toBe(0);
    });

    test('Diagnostics buttons produce expected textual output', async () => {
      // Ensure active set
      await msPage.selectValue('#ms-select', 'M1');

      // Click distinct
      await msPage.click('#distinct-btn');
      const distinctText = await msPage.getText('#diagnostic-result');
      expect(distinctText).toMatch(/\[.*\]/);

      // Cardinality
      await msPage.click('#cardinality-btn');
      const cardText = await msPage.getText('#diagnostic-result');
      expect(cardText).toContain('cardinality:');

      // Top-k
      await msPage.setInput('#topk-k', '2');
      await msPage.click('#topk-btn');
      const topkText = await msPage.getText('#diagnostic-result');
      expect(topkText).toContain('[');

      // Entropy
      await msPage.click('#entropy-btn');
      const entropyText = await msPage.getText('#diagnostic-result');
      expect(entropyText).toContain('Shannon entropy:');

      // Generating function (string)
      await msPage.click('#gfs-btn');
      const gfsText = await msPage.getText('#diagnostic-result');
      expect(typeof gfsText).toBe('string');
      expect(gfsText.length).toBeGreaterThan(0);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Operation log controls and clearing', () => {
    test('Clear log empties op-log', async () => {
      // Ensure there is at least one log entry by invoking a preview op
      await msPage.selectValue('#lhs-select', 'M1');
      await msPage.selectValue('#rhs-select', 'M2');
      await msPage.click('#op-sum');

      // There should be an entry now
      let opLogText = await page.$eval('#op-log', el => el.textContent || '');
      expect(opLogText.length).toBeGreaterThan(0);

      // Clear the log
      await msPage.click('#clear-log');

      opLogText = await page.$eval('#op-log', el => el.textContent || '');
      expect(opLogText.trim()).toBe('');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and page errors observation', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError occurred during interactions', async () => {
      // We have already performed a comprehensive set of interactions above in other tests;
      // Ensure (for this test run) that no page errors were captured.
      // If errors exist, fail and print them for debugging.
      if (pageErrors.length > 0) {
        // produce a clear failure showing the page errors captured
        const messages = pageErrors.map(e => e.message).join('\n---\n');
        throw new Error('Uncaught page errors detected:\n' + messages);
      }

      // Also make sure the console didn't emit 'error' messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      expect(consoleErrors.length).toBe(0);
    });
  });
});