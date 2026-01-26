import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1212ee32-fa7a-11f0-acf9-69409043402d.html';

// Page object to encapsulate interactions with the Multiset UI
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.elemInput = page.locator('#elem-input');
    this.countInput = page.locator('#count-input');
    this.addBtn = page.locator('#add-btn');
    this.removeBtn = page.locator('#remove-btn');
    this.setBtn = page.locator('#set-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.showFormat = page.locator('#show-format');
    this.multisetOutput = page.locator('#multiset-output');

    this.queryElemInput = page.locator('#query-elem-input');
    this.countQueryBtn = page.locator('#count-query-btn');
    this.containsQueryBtn = page.locator('#contains-query-btn');
    this.maxCountBtn = page.locator('#max-count-btn');
    this.minCountBtn = page.locator('#min-count-btn');
    this.totalSizeBtn = page.locator('#total-size-btn');
    this.distinctCountBtn = page.locator('#distinct-count-btn');
    this.queryOutput = page.locator('#query-output');

    this.msSelect1 = page.locator('#ms-select1');
    this.msSelect2 = page.locator('#ms-select2');
    this.unionBtn = page.locator('#union-btn');
    this.intersectionBtn = page.locator('#intersection-btn');
    this.sumBtn = page.locator('#sum-btn');
    this.differenceBtn = page.locator('#difference-btn');

    this.newMsName = page.locator('#newms-name');
    this.createMsBtn = page.locator('#create-ms-btn');
    this.deleteMsBtn = page.locator('#delete-ms-btn');
    this.multisetsList = page.locator('#multisets-list');
    this.multisetDetailOutput = page.locator('#multiset-detail-output');

    this.advSelectMs = page.locator('#adv-select-ms');
    this.filterMin = page.locator('#filter-min-count');
    this.filterMax = page.locator('#filter-max-count');
    this.applyFilterBtn = page.locator('#apply-filter-btn');
    this.transformSelect = page.locator('#transform-select');
    this.applyTransformBtn = page.locator('#apply-transform-btn');
    this.resetAdvOutputBtn = page.locator('#reset-adv-output-btn');
    this.advOutput = page.locator('#adv-output');
  }

  async addElement(element, count = 1) {
    await this.elemInput.fill(element);
    await this.countInput.fill(String(count));
    await this.addBtn.click();
  }

  async removeElement(element, count = 1) {
    await this.elemInput.fill(element);
    await this.countInput.fill(String(count));
    await this.removeBtn.click();
  }

  async setElementCount(element, count) {
    await this.elemInput.fill(element);
    await this.countInput.fill(String(count));
    await this.setBtn.click();
  }

  async clearMultiset(acceptConfirm = true) {
    // The clear button triggers a confirm dialog. Caller can choose acceptance.
    const p = this.page;
    const dialogPromise = p.waitForEvent('dialog').then(dialog => {
      // Accept or dismiss based on parameter
      if (acceptConfirm) dialog.accept();
      else dialog.dismiss();
      return dialog;
    });
    await this.clearBtn.click();
    return dialogPromise;
  }

  async getCurrentMultisetOutputText() {
    return (await this.multisetOutput.textContent()) || '';
  }

  async getDetailOutputText() {
    return (await this.multisetDetailOutput.textContent()) || '';
  }

  async doCountQuery(element) {
    await this.queryElemInput.fill(element);
    await this.countQueryBtn.click();
    return (await this.queryOutput.textContent()) || '';
  }

  async doContainsQuery(element) {
    await this.queryElemInput.fill(element);
    await this.containsQueryBtn.click();
    return (await this.queryOutput.textContent()) || '';
  }

  async doMaxCountQuery() {
    await this.maxCountBtn.click();
    return (await this.queryOutput.textContent()) || '';
  }

  async doMinCountQuery() {
    await this.minCountBtn.click();
    return (await this.queryOutput.textContent()) || '';
  }

  async doTotalSizeQuery() {
    await this.totalSizeBtn.click();
    return (await this.queryOutput.textContent()) || '';
  }

  async doDistinctCountQuery() {
    await this.distinctCountBtn.click();
    return (await this.queryOutput.textContent()) || '';
  }

  async createEmptyMultiset(name) {
    await this.newMsName.fill(name);
    await this.createMsBtn.click();
  }

  async performOperationAndCreate(opButton, newName) {
    await this.newMsName.fill(newName);
    await opButton.click();
  }

  async selectMsInSelectors(msName1, msName2) {
    // set values of selects via evaluate to ensure options update
    await this.msSelect1.selectOption(msName1);
    await this.msSelect2.selectOption(msName2);
  }

  async selectAdvMs(msName) {
    await this.advSelectMs.selectOption(msName);
  }

  async applyFilter(min = '0', max = '100') {
    await this.filterMin.fill(min);
    await this.filterMax.fill(max);
    await this.applyFilterBtn.click();
  }

  async applyTransformation(transformValue) {
    await this.transformSelect.selectOption(transformValue);
    await this.applyTransformBtn.click();
  }

  async resetAdvancedOutput() {
    await this.resetAdvOutputBtn.click();
  }

  async getMultisetsListItemsText() {
    const lis = this.multisetsList.locator('li');
    const count = await lis.count();
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(await lis.nth(i).textContent());
    }
    return arr;
  }

  async clickMultisetListItemByName(name) {
    const lis = this.multisetsList.locator('li');
    const count = await lis.count();
    for (let i = 0; i < count; i++) {
      const text = (await lis.nth(i).textContent()) || '';
      if (text.startsWith(name)) {
        await lis.nth(i).click();
        return true;
      }
    }
    return false;
  }

  async setShowFormat(formatValue) {
    await this.showFormat.selectOption(formatValue);
  }
}

// Utility to capture console errors and page errors and dialogs during a test
test.describe.configure({ mode: 'parallel' });

test.describe('Multiset Interactive Demonstration - FSM coverage', () => {
  // Per-test collectors
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Collect console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Collect dialogs and automatically accept alerts/confirms unless tests want to examine message
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Accept all dialogs by default to allow flow to continue.
      try {
        await dialog.accept();
      } catch (e) {
        // ignore in collector
      }
    });

    // Navigate to the application page
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    // Wait briefly for initialization scripts
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // By default assert that no fatal JS errors (ReferenceError, SyntaxError, TypeError) were thrown
    const errorNamesFound = pageErrors.map(e => e.name).filter(n => !!n);
    // If any of these specific error types appeared, fail the test
    for (const bad of ['ReferenceError', 'SyntaxError', 'TypeError']) {
      expect(errorNamesFound.includes(bad)).toBe(false);
    }
    // Also ensure console did not log errors (helpful for detecting runtime issues)
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('1. Builder - add/remove/set/clear and display formats', () => {
    test('should add elements, update display and details, and support different show formats', async ({ page }) => {
      // Validate addElementToCurrent transition and updateCurrentMultisetOutput/Detail
      const ms = new MultisetPage(page);

      // Initially, default multiset should be present and shown as (empty)
      expect(await ms.getCurrentMultisetOutputText()).toContain('(empty)');

      // Add element 'apple' count 2
      await ms.addElement('apple', 2);
      // After adding, multiset-output should reflect counts format default is 'counts'
      const out1 = await ms.getCurrentMultisetOutputText();
      expect(out1).toContain('apple: 2');

      // Add another element 'banana' count 1
      await ms.addElement('banana', 1);
      const out2 = await ms.getCurrentMultisetOutputText();
      expect(out2).toContain('banana: 1');
      expect(out2).toContain('apple: 2');

      // Change show format to list (elements repeated)
      await ms.setShowFormat('list');
      const listOut = await ms.getCurrentMultisetOutputText();
      // list should include 'apple' twice and 'banana' once (order may vary)
      expect(listOut.split(',').length).toBeGreaterThanOrEqual(2);

      // Change to sorted-desc and verify it returns a string (no crash)
      await ms.setShowFormat('sorted-desc');
      const sortedDesc = await ms.getCurrentMultisetOutputText();
      expect(sortedDesc.length).toBeGreaterThan(0);

      // Click set to set apple count to 1 (transition SetElementCount)
      await ms.setElementCount('apple', 1);
      await ms.setShowFormat('counts');
      const countsOut = await ms.getCurrentMultisetOutputText();
      expect(countsOut).toContain('apple: 1');

      // Remove banana via remove button
      await ms.removeElement('banana', 1);
      const afterRemove = await ms.getCurrentMultisetOutputText();
      expect(afterRemove).not.toContain('banana');

      // Setting element count to 0 removes it
      await ms.setElementCount('apple', 0);
      const removedApple = await ms.getCurrentMultisetOutputText();
      expect(removedApple).toContain('(empty)');

      // Test clear multiset: add some element, then clear with confirm accepted
      await ms.addElement('x', 3);
      expect((await ms.getCurrentMultisetOutputText())).toContain('x: 3');
      // clear button triggers confirm; the test collects dialog and accepts it automatically
      const dialog = await ms.clearMultiset(true);
      // dialog was captured and accepted, and current should be empty
      const afterClear = await ms.getCurrentMultisetOutputText();
      expect(afterClear).toContain('(empty)');
      // Ensure a confirm was shown with expected fragment
      expect(dialog.message()).toContain('Are you sure');
    });
  });

  test.describe('2. Queries - count, contains, max/min, total size, distinct count', () => {
    test('should answer basic queries correctly for the current multiset', async ({ page }) => {
      const ms = new MultisetPage(page);

      // Prepare the default multiset with known content
      await ms.addElement('alpha', 3);
      await ms.addElement('beta', 2);
      await ms.addElement('gamma', 1);

      // Count query for alpha
      const countAlpha = await ms.doCountQuery('alpha');
      expect(countAlpha).toContain('"alpha" occurs 3 time');

      // Contains query for non-existing element
      const containsZ = await ms.doContainsQuery('zeta');
      expect(containsZ).toContain('is NOT in the multiset');

      // Max count query should show alpha (3)
      const maxOut = await ms.doMaxCountQuery();
      expect(maxOut).toContain('"alpha" (3)');

      // Min count query should show gamma (1)
      const minOut = await ms.doMinCountQuery();
      expect(minOut).toContain('"gamma" (1)');

      // Total size query (3+2+1=6)
      const totalOut = await ms.doTotalSizeQuery();
      expect(totalOut).toContain('Total size (sum of counts): 6');

      // Distinct count (3 elements)
      const distinctOut = await ms.doDistinctCountQuery();
      expect(distinctOut).toContain('Distinct elements count: 3');
    });

    test('should handle empty or missing query input gracefully', async ({ page }) => {
      const ms = new MultisetPage(page);

      // Empty query input should prompt a helpful message (no crash)
      await ms.queryElemInput.fill('');
      await ms.countQueryBtn.click();
      const msg = (await ms.queryOutput.textContent()) || '';
      expect(msg).toContain('Please enter an element to query.');

      // For contains likewise
      await ms.containsQueryBtn.click();
      const msg2 = (await ms.queryOutput.textContent()) || '';
      expect(msg2).toContain('Please enter an element to query.');
    });
  });

  test.describe('3. Inter-Multiset Operations - union/intersection/sum/difference and create/delete multisets', () => {
    test('should create named multisets and perform operations producing new multisets', async ({ page }) => {
      const ms = new MultisetPage(page);

      // Start by ensuring default has some content
      await ms.addElement('a', 2);
      await ms.addElement('b', 1);

      // Create empty multiset named 'A'
      await ms.createEmptyMultiset('A');
      // After creation, currentMSName becomes 'A' and detail should show empty
      expect((await ms.getDetailOutputText()).toLowerCase()).toContain('empty');

      // Populate 'A' with element 'c'
      await ms.addElement('c', 5);

      // Create another named multiset 'B'
      await ms.createEmptyMultiset('B');
      await ms.addElement('b', 3); // B has 'b':3

      // Select ms-select1 = default, ms-select2 = B (we assume 'default' exists)
      await ms.selectMsInSelectors('default', 'B');

      // Perform union creating 'U_default_B'
      await ms.performOperationAndCreate(ms.unionBtn, 'U_default_B');

      // After operation, new multiset should appear in the multisets list and be selected
      const listItems = await ms.getMultisetsListItemsText();
      const found = listItems.some(t => t && t.startsWith('U_default_B'));
      expect(found).toBe(true);

      // The adv-output should have been set by the op function (placeholder text)
      const advText = (await ms.advOutput.textContent()) || '';
      expect(advText).toContain('(result of union') || expect(advText.length).toBeGreaterThan(0);

      // Test intersection and sum and difference similarly (operate on A and B)
      await ms.selectMsInSelectors('A', 'B');

      // Sum -> create 'Sum_AB'
      await ms.performOperationAndCreate(ms.sumBtn, 'Sum_AB');
      expect((await ms.getMultisetsListItemsText()).some(t => t && t.startsWith('Sum_AB'))).toBe(true);

      // Intersection -> create 'I_AB'
      await ms.performOperationAndCreate(ms.intersectionBtn, 'I_AB');
      expect((await ms.getMultisetsListItemsText()).some(t => t && t.startsWith('I_AB'))).toBe(true);

      // Difference -> create 'D_A_B'
      await ms.performOperationAndCreate(ms.differenceBtn, 'D_A_B');
      expect((await ms.getMultisetsListItemsText()).some(t => t && t.startsWith('D_A_B'))).toBe(true);

      // Now test deleteSelectedMultiset edge cases:
      // Attempt to delete default (should trigger an alert "Cannot delete the default multiset.")
      // We click delete while default is selected. Ensure default is selected via clicking the list
      await ms.clickMultisetListItemByName('default');
      await ms.deleteMsBtn.click();
      // Dialogs are captured in the outer dialog collector. The last dialog should contain the message.
      expect(dialogs.length).toBeGreaterThan(0);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.message).toContain('Cannot delete the default multiset.');

      // Delete a non-default multiset:
      // Select one of the created multisets (e.g., Sum_AB), click delete and confirm
      // Clicking delete triggers confirm; the global dialog handler accepts by default
      // First ensure Sum_AB is selected by clicking the list
      const clicked = await ms.clickMultisetListItemByName('Sum_AB');
      expect(clicked).toBe(true);
      // Click delete - the dialog will be accepted automatically by the listener
      await ms.deleteMsBtn.click();
      // After deletion, Sum_AB should no longer appear
      const afterDeleteList = await ms.getMultisetsListItemsText();
      expect(afterDeleteList.some(t => t && t.startsWith('Sum_AB'))).toBe(false);
    });
  });

  test.describe('4. Advanced Exploration - filter, transform, reset output', () => {
    test('should apply filter then transformation and reset advanced output', async ({ page }) => {
      const ms = new MultisetPage(page);

      // Ensure we have a multiset with various counts to filter/transform
      // Use a named multiset 'AdvTest'
      await ms.createEmptyMultiset('AdvTest');
      // Populate it
      await ms.addElement('one', 1);
      await ms.addElement('two', 2);
      await ms.addElement('three', 3);
      // Select adv-select-ms to 'AdvTest'
      await ms.selectAdvMs('AdvTest');

      // Apply a filter min=2, max=3 -> should produce elements 'two' and 'three'
      await ms.applyFilter('2', '3');
      // applyFilter's handler sets advSetOutput(filtered) in the page script, so advOutput should update
      const advAfterFilter = (await ms.advOutput.textContent()) || '';
      expect(advAfterFilter.toLowerCase()).toContain('distinct elements');

      // Now apply a transformation. applyTransformation requires that lastAdvOutputMultiset is set,
      // which was done by applyFilter above. Choose 'increment' to increment counts.
      await ms.applyTransformation('increment');
      // After transform, advOutput should still show details and updated counts (counts increased by 1)
      const advAfterTransform = (await ms.advOutput.textContent()) || '';
      expect(advAfterTransform.toLowerCase()).toContain('multiset');

      // Reset advanced output and expect the placeholder message
      await ms.resetAdvancedOutput();
      const advReset = (await ms.advOutput.textContent()) || '';
      expect(advReset).toContain('(no advanced exploration yet)');
    });

    test('applyTransform should alert when no last advanced output exists', async ({ page }) => {
      const ms = new MultisetPage(page);

      // Ensure no last advanced output is present by resetting
      await ms.resetAdvancedOutput();
      // Clear dialog records before the action
      const beforeDialogs = dialogs.length;
      // Try to apply transformation when lastAdvOutputMultiset is null -> page shows alert
      await ms.applyTransformBtn.click();
      // We expect a dialog to have been captured with message about no multiset available
      expect(dialogs.length).toBeGreaterThan(beforeDialogs);
      const last = dialogs[dialogs.length - 1];
      expect(last.message).toContain('No multiset available for transformation');
    });
  });

  test.describe('5. Edge cases, inputs and error flows', () => {
    test('should show alerts when trying to add with empty element or invalid count', async ({ page }) => {
      const ms = new MultisetPage(page);

      // Attempt to add with empty element -> alert 'Please enter an element string.'
      await ms.elemInput.fill('');
      await ms.countInput.fill('1');
      await ms.addBtn.click();
      // A dialog should be captured with that alert message
      expect(dialogs.length).toBeGreaterThan(0);
      const last = dialogs[dialogs.length - 1];
      expect(last.message).toContain('Please enter an element string.');

      // Attempt to add with invalid count (0) -> alert 'Please enter a valid count'
      await ms.elemInput.fill('z');
      await ms.countInput.fill('0');
      await ms.addBtn.click();
      const last2 = dialogs[dialogs.length - 1];
      expect(last2.message).toContain('Please enter a valid count');
    });

    test('setCount with negative number should alert and not crash', async ({ page }) => {
      const ms = new MultisetPage(page);

      await ms.elemInput.fill('q');
      await ms.countInput.fill('-5');
      await ms.setBtn.click();
      // Dialog should indicate invalid count
      const last = dialogs[dialogs.length - 1];
      expect(last.message).toContain('Please enter a valid count (integer ≥ 0).');
    });

    test('applyFilter without selecting a valid multiset should alert', async ({ page }) => {
      const ms = new MultisetPage(page);

      // Select a made-up adv-select value that isn't present by direct evaluate
      // Instead, set adv-select-ms to empty string to trigger invalid selection path
      await page.evaluate(() => { const s = document.getElementById('adv-select-ms'); s.value = ''; });
      // Attempt to apply filter: the handler will alert about invalid selection
      await ms.applyFilterBtn.click();
      const last = dialogs[dialogs.length - 1];
      expect(last.message).toContain('Select a valid multiset for advanced exploration.');
    });
  });
});