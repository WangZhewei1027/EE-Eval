import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122aed90-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Hash Map UI
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      input1: '#input1',
      input2: '#input2',
      addBtn: '#add-btn',
      removeBtn: '#remove-btn',
      select1: '#select1',
      checkbox1: '#checkbox1',
      checkbox2: '#checkbox2',
      checkbox3: '#checkbox3',
      clearBtn: '#clear-btn',
    };
  }

  async clickAdd() {
    await this.page.click(this.selectors.addBtn);
  }

  async clickRemove() {
    await this.page.click(this.selectors.removeBtn);
  }

  async fillInput1(text) {
    await this.page.fill(this.selectors.input1, text);
  }

  async fillInput2(text) {
    await this.page.fill(this.selectors.input2, text);
  }

  async getInput1Value() {
    return await this.page.$eval(this.selectors.input1, el => el.value);
  }

  async getInput2Value() {
    return await this.page.$eval(this.selectors.input2, el => el.value);
  }

  async toggleCheckbox1() {
    await this.page.click(this.selectors.checkbox1);
  }

  async toggleCheckbox2() {
    await this.page.click(this.selectors.checkbox2);
  }

  async toggleCheckbox3() {
    await this.page.click(this.selectors.checkbox3);
  }

  async selectOption(value) {
    await this.page.selectOption(this.selectors.select1, value);
  }

  async clickClear() {
    await this.page.click(this.selectors.clearBtn);
  }

  // read a global variable on window (safe access)
  async readWindowVar(varName) {
    return this.page.evaluate(name => window[name], varName);
  }
}

test.describe('Hash Map FSM - end-to-end tests (Application ID: 122aed90-fa7b-11f0-814c-dbec508f0b3b)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console error messages for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // capture runtime/page errors (ReferenceError, SyntaxError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the page under test and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners (best-effort cleanup)
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('Page load should report a script SyntaxError (observed in console/page errors)', async ({ page }) => {
    // This page intentionally contains a malformed function declaration causing a SyntaxError.
    // Validate that a SyntaxError (or similar parse error) was reported during page load.
    // We allow either pageerror events or console.error entries depending on the browser environment.
    // Wait briefly to ensure any synchronous parse errors are reported.
    await page.waitForTimeout(100);

    // At least one of pageErrors or consoleErrors should contain a syntax related error.
    const hasSyntaxInPageErrors = pageErrors.some(e => /SyntaxError|Unexpected token|Unexpected identifier|Unexpected reserved word|Unexpected/i.test(e.message));
    const hasSyntaxInConsole = consoleErrors.some(text => /SyntaxError|Unexpected token|Unexpected identifier|Unexpected reserved word|Unexpected/i.test(text));

    expect(hasSyntaxInPageErrors || hasSyntaxInConsole).toBeTruthy();
  });

  test('AddKey event (click #add-btn) should NOT attach handler due to script error -> input1 should remain unchanged', async ({ page }) => {
    // Verify that clicking Add does not update input1 because the script failed to attach event listeners.
    const ui = new HashMapPage(page);

    // Ensure initial input1 is empty
    expect(await ui.getInput1Value()).toBe('');

    // Clear any previously captured errors so we can observe new ones caused by this interaction
    pageErrors.length = 0;
    consoleErrors.length = 0;

    // Click the Add button - expected: no change because addBtn listener may not be registered
    await ui.clickAdd();

    // small wait to allow any erroneous handlers to run (if they exist)
    await page.waitForTimeout(50);

    // input1 should remain empty (no 'a' appended)
    const input1Val = await ui.getInput1Value();
    expect(input1Val).toBe('', 'Expected input1 to remain empty since add event handler should not be attached when script failed');

    // The global "count" variable should not be defined on window if the script didn't execute fully
    const countVal = await ui.readWindowVar('count');
    expect(countVal === undefined || typeof countVal === 'number' || countVal === null).toBeTruthy();
    // We don't assert a particular numeric value — we only verify there is no unexpected behavior (no appended 'a').
  });

  test('RemoveKey event (click #remove-btn) should have no effect when no previous adds occurred (and handlers may be missing)', async ({ page }) => {
    // Attempt to remove when nothing has been added. Because of parse errors the handler may not exist.
    const ui = new HashMapPage(page);

    // Ensure initial is empty
    expect(await ui.getInput1Value()).toBe('');

    // Clear prior error captures
    pageErrors.length = 0;
    consoleErrors.length = 0;

    // Click remove
    await ui.clickRemove();
    await page.waitForTimeout(50);

    // Input should remain unchanged
    expect(await ui.getInput1Value()).toBe('', 'Expected input1 to remain unchanged after Remove because handler may not be attached');

    // No unexpected negative effects should be present; count remains undefined or unchanged
    const countVal = await ui.readWindowVar('count');
    expect(countVal === undefined || typeof countVal === 'number' || countVal === null).toBeTruthy();
  });

  test('Inline oninput/onchange handlers calling updateDisplay should throw ReferenceError when interacting with inputs/select', async ({ page }) => {
    // The HTML uses inline oninput/onchange="updateDisplay()" but updateDisplay is not defined (syntax error).
    // Interacting with inputs and select should result in ReferenceError being thrown.
    const ui = new HashMapPage(page);

    // Reset captured errors
    pageErrors.length = 0;
    consoleErrors.length = 0;

    // Typing into input1 triggers oninput -> should throw ReferenceError for updateDisplay
    const fillPromise = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    await ui.fillInput1('key1'); // this will trigger the inline oninput
    const pageErr1 = await fillPromise;

    // Typing into input2 triggers oninput -> should throw ReferenceError as well
    const fillPromise2 = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    await ui.fillInput2('value1');
    const pageErr2 = await fillPromise2;

    // Changing select triggers inline onchange -> should also throw if updateDisplay missing
    const selectPromise = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    await ui.selectOption('2');
    const pageErr3 = await selectPromise;

    // At least one of these interactions should have produced a ReferenceError related to updateDisplay
    const errors = [pageErr1, pageErr2, pageErr3].filter(Boolean);

    // It's possible that some environments report errors to console rather than pageerror event; also check consoleErrors
    const consoleHasRef = consoleErrors.some(t => /updateDisplay|ReferenceError|is not defined|not defined|cannot read property/i.test(t));

    const pageHasRef = errors.some(e => /ReferenceError|updateDisplay|is not defined|not defined/i.test(String(e && e.message || '')));

    expect(pageHasRef || consoleHasRef).toBeTruthy();
  });

  test('ToggleCheckbox events (#checkbox1/#checkbox2/#checkbox3) should NOT update input2 when script did not attach listeners', async ({ page }) => {
    // Because the checkboxes rely on addEventListener in the script, and the script failed to parse, toggling them should not mutate input2.
    const ui = new HashMapPage(page);

    // Ensure input2 is empty initially
    expect(await ui.getInput2Value()).toBe('');

    // Reset captured errors
    pageErrors.length = 0;
    consoleErrors.length = 0;

    // Toggle checkbox1
    await ui.toggleCheckbox1();
    await page.waitForTimeout(50);
    expect(await ui.getInput2Value()).toBe('', 'Expected input2 to remain unchanged after toggling checkbox1 when handler is missing');

    // Toggle checkbox2
    await ui.toggleCheckbox2();
    await page.waitForTimeout(50);
    expect(await ui.getInput2Value()).toBe('', 'Expected input2 to remain unchanged after toggling checkbox2 when handler is missing');

    // Toggle checkbox3
    await ui.toggleCheckbox3();
    await page.waitForTimeout(50);
    expect(await ui.getInput2Value()).toBe('', 'Expected input2 to remain unchanged after toggling checkbox3 when handler is missing');

    // Confirm toggling did not generate additional page-level runtime errors (beyond any initial parse error)
    // We allow zero or few errors — but assert that no TypeError referencing input2 occurred here (safe heuristic)
    const hasTypeError = pageErrors.some(e => /TypeError/i.test(String(e && e.message || ''))) || consoleErrors.some(t => /TypeError/i.test(t));
    expect(hasTypeError).toBeFalsy();
  });

  test('ClearInputs button (#clear-btn) should NOT clear inputs if its handler was not attached due to script error', async ({ page }) => {
    // Fill inputs (these actions may cause ReferenceError via inline oninput; capture but proceed)
    const ui = new HashMapPage(page);

    // Reset errors arrays to observe new ones
    pageErrors.length = 0;
    consoleErrors.length = 0;

    // Fill values directly
    // These fills will trigger the inline oninput which will likely throw ReferenceError - we ignore that for now.
    await ui.fillInput1('prepopulated-key');
    await ui.fillInput2('prepopulated-value');

    // Confirm the DOM reflects the fills (even if updateDisplay errored)
    expect(await ui.getInput1Value()).toBe('prepopulated-key');
    expect(await ui.getInput2Value()).toBe('prepopulated-value');

    // Click Clear - if clearBtn's listener isn't attached, inputs should remain unchanged
    await ui.clickClear();
    await page.waitForTimeout(50);

    // Because the script was not executed, the clear handler likely wasn't attached; expect inputs to remain the same
    const input1AfterClear = await ui.getInput1Value();
    const input2AfterClear = await ui.getInput2Value();

    // Assert they did not clear
    expect(input1AfterClear).toBe('prepopulated-key', 'Expected input1 to remain unchanged after Clear click due to missing handler');
    expect(input2AfterClear).toBe('prepopulated-value', 'Expected input2 to remain unchanged after Clear click due to missing handler');
  });

  test('Edge case: repeatedly clicking Add beyond limit should not crash (and handlers likely missing)', async ({ page }) => {
    // The FSM mentions a count limit of 10. Because the script parse failed, add handler is likely not present.
    // This test tries to click Add many times and ensures no unexpected exceptions are thrown at page-level.
    const ui = new HashMapPage(page);

    // Reset captured errors
    pageErrors.length = 0;
    consoleErrors.length = 0;

    for (let i = 0; i < 15; i++) {
      await ui.clickAdd();
    }

    // Wait a short time to capture any errors
    await page.waitForTimeout(100);

    // Ensure no new page-level TypeError occurred due to repeated clicks (we allow the original parse SyntaxError)
    const hasNewTypeError = pageErrors.some(e => /TypeError/i.test(String(e && e.message || '')));
    expect(hasNewTypeError).toBeFalsy();

    // Input should remain empty (no handler)
    expect(await ui.getInput1Value()).toBe('', 'Expected input1 to remain empty after repeated Add clicks when handlers are missing');
  });

  test('Verify FSM state observables cannot be satisfied because of script errors (assert deviations are detectable)', async ({ page }) => {
    // This high-level test tries to validate FSM state transitions as per the specification,
    // but given the application's script has parse errors, we expect transitions to not occur.
    const ui = new HashMapPage(page);

    // Attempt Add -> expected FSM would append 'a' to input1; here we assert it does NOT happen
    await ui.clickAdd();
    await page.waitForTimeout(50);
    expect(await ui.getInput1Value()).not.toContain('a');

    // Attempt ToggleCheckbox1 -> expected FSM would append 'b' to input2; here we assert it does NOT happen
    await ui.toggleCheckbox1();
    await page.waitForTimeout(50);
    expect(await ui.getInput2Value()).not.toContain('b');

    // Attempt ToggleCheckbox2 -> no 'c' appended
    await ui.toggleCheckbox2();
    await page.waitForTimeout(50);
    expect(await ui.getInput2Value()).not.toContain('c');

    // Attempt ToggleCheckbox3 -> no 'd' appended
    await ui.toggleCheckbox3();
    await page.waitForTimeout(50);
    expect(await ui.getInput2Value()).not.toContain('d');

    // Attempt Clear -> inputs remain (handler likely missing)
    await ui.fillInput1('x');
    await ui.fillInput2('y');
    await ui.clickClear();
    await page.waitForTimeout(50);
    // If clear worked, inputs would be empty; assert they are not empty to document failure mode.
    const afterClear1 = await ui.getInput1Value();
    const afterClear2 = await ui.getInput2Value();
    // We allow either to be unchanged; assert that at least one remains non-empty to indicate clear didn't occur
    expect(afterClear1 !== '' || afterClear2 !== '').toBeTruthy();
  });
});