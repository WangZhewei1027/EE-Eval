import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3db19e2-fa73-11f0-83e0-8d7be1d51901.html';

class DemoPage {
  /**
   * Page object encapsulating interactions with the Dynamic Typing demo page.
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.operandInput = page.locator('#operandInput');
    this.setBtn = page.locator('#setBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.runOpBtn = page.locator('#runOpBtn');
    this.inspectBtn = page.locator('#inspectBtn');
    this.examplesToggle = page.locator('#examplesToggle');
    this.examplesPanel = page.locator('#examplesPanel');
    this.examplesButtons = page.locator('.examples button');
    this.interpretMode = page.locator('#interpretMode');
    this.opSelect = page.locator('#opSelect');
    this.currentValue = page.locator('#currentValue');
    this.currentType = page.locator('#currentType');
    this.log = page.locator('#log');
    this.demoCoercion = page.locator('#demoCoercion');
    this.demoEquality = page.locator('#demoEquality');
    this.demoObjects = page.locator('#demoObjects');
    this.demoFunctions = page.locator('#demoFunctions');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Convenience: wait until log contains substring
  async waitForLogContaining(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, sub) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(sub);
      },
      '#log',
      substring,
      { timeout }
    );
  }

  async getLogText() {
    return (await this.log.textContent()) || '';
  }

  async setValue(text, mode = 'auto') {
    await this.valueInput.fill(String(text));
    await this.interpretMode.selectOption(mode);
    await this.setBtn.click();
  }

  async resetValue() {
    await this.resetBtn.click();
  }

  async toggleExamples() {
    await this.examplesToggle.click();
  }

  async clickExampleByDataVal(dataVal) {
    // find a button with matching data-val attribute
    const btn = this.page.locator(`.examples button[data-val="${dataVal}"]`);
    await btn.click();
  }

  async runOperation(opValue, operandText = '') {
    await this.opSelect.selectOption(opValue);
    await this.operandInput.fill(String(operandText));
    await this.runOpBtn.click();
  }

  async inspectX() {
    await this.inspectBtn.click();
  }

  async clickDemo(demoBtnLocator) {
    await demoBtnLocator.click();
  }

  async getCurrentValueText() {
    return (await this.currentValue.textContent()) || '';
  }

  async getCurrentTypeText() {
    return (await this.currentType.textContent()) || '';
  }

  async exampleIsVisible() {
    // return computed style display
    return await this.page.evaluate(() => {
      const el1 = document.getElementById('examplesPanel');
      return window.getComputedStyle(el).display !== 'none';
    });
  }
}

test.describe('Dynamic Typing — FSM states and transitions', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Observe console messages and page errors for each test
    page.on('console', msg => {
      // capture console text
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test.describe('Idle state and initialization', () => {
    test('Initial idle state shows undefined and logs ready message', async ({ page }) => {
      // Validate S0_Idle: initial display, updateDisplay called on init, and a ready log is present
      const demo = new DemoPage(page);
      await demo.goto();

      // Validate displayed initial value and type
      await expect(demo.currentValue).toHaveText('undefined');
      await expect(demo.currentType).toHaveText('undefined');

      // The script logs a ready message on initialization
      await demo.waitForLogContaining('Demo ready. Use the controls on the left to experiment with dynamic typing in JS.');

      const logText = await demo.getLogText();
      expect(logText).toContain('Demo ready');

      // Ensure no uncaught page errors occurred during load
      expect(pageErrors).toEqual([]);
      // At least one console message expected (the ready log)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Set, Reset, and Example Set transitions', () => {
    test('Set x via input and Set button transitions to S1_SetX and updates display and log', async ({ page }) => {
      const demo1 = new DemoPage(page);
      await demo.goto();

      // Set x to 42 using auto interpretation -> should parse
      await demo.setValue('42', 'auto');

      // Wait for log line about setting x
      await demo.waitForLogContaining('set x =');

      // Validate display updated with new value and type (S1_SetX entry action updateDisplay)
      await expect(demo.currentValue).toHaveText('42'); // JSON.stringify(42) -> "42" (no quotes in display)
      await expect(demo.currentType).toHaveText('number');

      const logText1 = await demo.getLogText();
      expect(logText).toContain('set x =');
      expect(logText).toContain('typeof -> number');

      // No uncaught errors
      expect(pageErrors).toEqual([]);
    });

    test('Reset x transitions to S2_ResetX and sets value to undefined and logs reset', async ({ page }) => {
      const demo2 = new DemoPage(page);
      await demo.goto();

      // First set to something to show change then reset
      await demo.setValue('"hello"', 'auto');
      await demo.waitForLogContaining('set x =');

      // Now reset
      await demo.resetValue();
      await demo.waitForLogContaining('x reset to undefined');

      await expect(demo.currentValue).toHaveText('undefined');
      await expect(demo.currentType).toHaveText('undefined');

      const logText2 = await demo.getLogText();
      expect(logText).toContain('x reset to undefined');
      expect(pageErrors).toEqual([]);
    });

    test('Example button sets x (S5_ExampleSetX) and updateDisplay reflects example value', async ({ page }) => {
      const demo3 = new DemoPage(page);
      await demo.goto();

      // Toggle examples to make buttons visible
      await demo.toggleExamples();
      expect(await demo.exampleIsVisible()).toBe(true);

      // Click example that sets x to [1,2,3]
      await demo.clickExampleByDataVal('[1,2,3]');
      await demo.waitForLogContaining('example set x =');

      // After clicking, x should be an array
      await expect(demo.currentType).toHaveText('array');

      // currentValue should contain the array JSON
      const valText = await demo.getCurrentValueText();
      expect(valText).toContain('[1,2,3]');

      const logText3 = await demo.getLogText();
      expect(logText).toContain('example set x =');
      expect(pageErrors).toEqual([]);
    });

    test('Toggle examples (S6_ToggleExamples) shows and hides panel', async ({ page }) => {
      const demo4 = new DemoPage(page);
      await demo.goto();

      // Initially hidden
      expect(await demo.exampleIsVisible()).toBe(false);

      // Toggle on
      await demo.toggleExamples();
      expect(await demo.exampleIsVisible()).toBe(true);

      // Toggle off
      await demo.toggleExamples();
      expect(await demo.exampleIsVisible()).toBe(false);

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('RunOperation transitions and behaviors (S3_RunOperation)', () => {
    test('String "5" + 3 produces concatenation whereas "5" - 3 produces numeric subtraction', async ({ page }) => {
      const demo5 = new DemoPage(page);
      await demo.goto();

      // Set x to string "5" via example
      await demo.toggleExamples();
      await demo.clickExampleByDataVal('"5"');
      await demo.waitForLogContaining('example set x =');

      // Run + with operand 3
      await demo.runOperation('+', '3');
      await demo.waitForLogContaining('operation: x + y');

      let logText4 = await demo.getLogText();
      // Expect concatenation result "53" (preview wraps string values with quotes)
      expect(logText).toContain('"53"');
      // x itself should remain the original string "5"
      await expect(demo.currentType).toHaveText('string');

      // Run - with operand 3
      await demo.runOperation('-', '3');
      await demo.waitForLogContaining('operation: x - y');

      logText = await demo.getLogText();
      // Expect numeric result 2
      expect(logText).toContain('2');

      expect(pageErrors).toEqual([]);
    });

    test('Equality operations: == can coerce while === does not', async ({ page }) => {
      const demo6 = new DemoPage(page);
      await demo.goto();

      // Set x to string "0"
      await demo.setValue('"0"', 'auto');
      await demo.waitForLogContaining('set x =');

      // Compare x == 0
      await demo.runOperation('==', '0');
      await demo.waitForLogContaining('operation: x == y');
      let lt = await demo.getLogText();
      // x == y should be true (coerced)
      expect(lt).toContain('true');

      // Compare x === 0
      await demo.runOperation('===', '0');
      await demo.waitForLogContaining('operation: x === y');
      lt = await demo.getLogText();
      // Expect false for strict equality
      expect(lt).toContain('false');

      expect(pageErrors).toEqual([]);
    });

    test('Add property to object and push into array demonstrate mutation operations and updateDisplay', async ({ page }) => {
      const demo7 = new DemoPage(page);
      await demo.goto();

      // Set x to object {a:1}
      await demo.toggleExamples();
      await demo.clickExampleByDataVal('{a:1}');
      await demo.waitForLogContaining('example set x =');

      // addProp should add a new property key
      await demo.runOperation('addProp', 'newKey');
      await demo.waitForLogContaining('added property');

      // After adding, currentValue should include newKey
      const valAfterAdd = await demo.getCurrentValueText();
      expect(valAfterAdd).toContain('newKey');

      // Now set x to array [1,2,3]
      await demo.clickExampleByDataVal('[1,2,3]');
      await demo.waitForLogContaining('example set x =');

      // Use push to add 99
      await demo.runOperation('push', '99');
      await demo.waitForLogContaining('pushed y into array');

      const valAfterPush = await demo.getCurrentValueText();
      expect(valAfterPush).toContain('99');

      expect(pageErrors).toEqual([]);
    });

    test('Call operation handles functions and logs call results, or logs failure when not a function', async ({ page }) => {
      const demo8 = new DemoPage(page);
      await demo.goto();

      // Ensure call on non-function logs a failure message
      await demo.setValue('5', 'number'); // forced number interpretation
      await demo.waitForLogContaining('set x =');
      await demo.runOperation('call', '"Sam"');
      await demo.waitForLogContaining('call failed');
      let logText5 = await demo.getLogText();
      expect(logText).toContain('call failed: x is not a function');

      // Now set x to a function using demoFunctions button (S3 demo)
      await demo.clickDemo(demo.demoFunctions);
      await demo.waitForLogContaining('set x to function greet');

      // Run call with operand "Sam" — greet expects an argument and should return 'hello Sam'
      await demo.runOperation('call', '"Sam"');
      await demo.waitForLogContaining('called x(y) ->');

      logText = await demo.getLogText();
      expect(logText).toContain('called x(y) ->');
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Inspect and demos (S4_InspectX and demo transitions)', () => {
    test('Inspect x shows detailed type information and object keys when applicable', async ({ page }) => {
      const demo9 = new DemoPage(page);
      await demo.goto();

      // Set x to object via demoObjects (this demo also sets state.x)
      await demo.clickDemo(demo.demoObjects);
      await demo.waitForLogContaining('--- Objects demo ---');

      // Inspect x
      await demo.inspectX();
      await demo.waitForLogContaining('inspect: typeof ->');

      const logText6 = await demo.getLogText();
      expect(logText).toContain('inspect: typeof ->');
      expect(logText).toContain('object keys ->');

      expect(pageErrors).toEqual([]);
    });

    test('Predefined demos log illustrative messages without throwing', async ({ page }) => {
      const demo10 = new DemoPage(page);
      await demo.goto();

      // Coercion demo
      await demo.clickDemo(demo.demoCoercion);
      await demo.waitForLogContaining('--- Coercion demo ---');
      let logText7 = await demo.getLogText();
      expect(logText).toContain('a + b ->');
      expect(logText).toContain('a - b ->');

      // Equality demo
      await demo.clickDemo(demo.demoEquality);
      await demo.waitForLogContaining('--- Equality demo ---');
      logText = await demo.getLogText();
      expect(logText).toContain('0 == "0" ->');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Numeric interpret mode falls back to string when value is not a number', async ({ page }) => {
      const demo11 = new DemoPage(page);
      await demo.goto();

      // Force interpretMode to 'number' but input 'abc' which is NaN -> parseInput should return original text
      await demo.setValue('abc', 'number');
      await demo.waitForLogContaining('set x =');

      // Because parsing failed, the stored value should be the raw text, so type should be 'string'
      await expect(demo.currentType).toHaveText('string');

      const logText8 = await demo.getLogText();
      expect(logText).toContain('set x =');
      expect(pageErrors).toEqual([]);
    });

    test('Operations that fail (e.g., addProp on non-object, push on non-array) produce user-facing log messages rather than uncaught exceptions', async ({ page }) => {
      const demo12 = new DemoPage(page);
      await demo.goto();

      // Ensure x is undefined and try addProp -> should log failure, not throw
      await demo.resetValue();
      await demo.waitForLogContaining('x reset to undefined');

      await demo.runOperation('addProp', 'k');
      await demo.waitForLogContaining('addProp failed', 2000).catch(() => {}); // Some messages are different; we'll inspect overall log

      const logText9 = await demo.getLogText();
      expect(logText).toMatch(/addProp failed:|addProp failed|addProp failed:/i)
        .or(expect(logText).toContain('addProp failed: x is not an object').not); // flexible check

      // Try push on non-array
      await demo.runOperation('push', '7');
      await demo.waitForLogContaining('push failed', 2000).catch(() => {});

      const logTextAfter = await demo.getLogText();
      expect(logTextAfter).toMatch(/push failed: x is not an array/i);

      // Critically: ensure no uncaught page errors occurred
      expect(pageErrors).toEqual([]);
    });

    test('No uncaught runtime errors should be present for typical flows (observe pageerror array)', async ({ page }) => {
      const demo13 = new DemoPage(page);
      await demo.goto();

      // Execute a typical sequence of interactions that covers many branches
      await demo.setValue('"10"', 'auto');
      await demo.runOperation('+', '5');
      await demo.runOperation('-', '3');
      await demo.toggleExamples();
      await demo.clickExampleByDataVal('{a:1}');
      await demo.runOperation('addProp', 'b');
      await demo.runOperation('push', '100'); // should log failure because object is not array
      await demo.clickDemo(demo.demoCoercion);
      await demo.clickDemo(demo.demoEquality);
      await demo.clickDemo(demo.demoObjects);
      await demo.clickDemo(demo.demoFunctions);

      // Wait a moment for logs to flush
      await page.waitForTimeout(200);

      // Assert no uncaught errors occurred
      expect(pageErrors).toEqual([]);
      // Some console messages should exist
      expect(consoleMessages.length).toBeGreaterThan(0);
    });
  });
});