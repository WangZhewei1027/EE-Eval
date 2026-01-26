import { test, expect } from '@playwright/test';

// Page Object Model for the Static Typing Demonstration page
class StaticTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Inputs and buttons
    this.varName = page.locator('#varName');
    this.varType = page.locator('#varType');
    this.varValue = page.locator('#varValue');
    this.declareBtn = page.locator('#declareVar');
    this.variablesList = page.locator('#variablesList');

    this.checkVarName = page.locator('#checkVarName');
    this.checkTypeBtn = page.locator('#checkType');
    this.typeResult = page.locator('#typeResult');

    this.convertValueInput = page.locator('#convertValue');
    this.convertToType = page.locator('#convertToType');
    this.convertBtn = page.locator('#convertValueBtn');
    this.conversionResult = page.locator('#conversionResult');

    this.errorVarName = page.locator('#errorVarName');
    this.simulateErrorBtn = page.locator('#simulateError');
    this.errorResult = page.locator('#errorResult');
  }

  // Declare a variable, accepts the dialog automatically if present
  async declareVariable(name, type, value) {
    await this.varName.fill('');
    if (name !== null) await this.varName.fill(name);
    await this.varType.selectOption({ value: type });
    await this.varValue.fill('');
    if (value !== null) await this.varValue.fill(value);
    await this.declareBtn.click();
  }

  // Read the current variables list text (concatenated)
  async getVariablesListText() {
    return (await this.variablesList.innerText()).trim();
  }

  // Trigger a type check for a variable
  async checkType(name) {
    await this.checkVarName.fill('');
    if (name !== null) await this.checkVarName.fill(name);
    await this.checkTypeBtn.click();
  }

  // Get type result text
  async getTypeResultText() {
    return (await this.typeResult.innerText()).trim();
  }

  // Convert a value to a type
  async convertValue(value, toType) {
    await this.convertValueInput.fill('');
    if (value !== null) await this.convertValueInput.fill(value);
    await this.convertToType.selectOption({ value: toType });
    await this.convertBtn.click();
  }

  async getConversionResultText() {
    return (await this.conversionResult.innerText()).trim();
  }

  // Simulate an error by checking for variable existence (throws internally)
  async simulateErrorFor(name) {
    await this.errorVarName.fill('');
    if (name !== null) await this.errorVarName.fill(name);
    await this.simulateErrorBtn.click();
  }

  async getErrorResultText() {
    return (await this.errorResult.innerText()).trim();
  }
}

// Base URL for the served HTML file
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0f342-fa79-11f0-8075-e54a10595dde.html';

test.describe('Static Typing Demonstration - FSM states and transitions', () => {
  // Arrays to collect runtime diagnostics
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught errors on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Ensure we accept alerts (declare variable triggers alert)
    page.on('dialog', async (dialog) => {
      // record the dialog message in consoleMessages so assertions can check it
      consoleMessages.push({ type: 'dialog', text: dialog.message() });
      await dialog.accept();
    });

    // Navigate to the application page (load exactly as-is)
    await page.goto(APP_URL);
    // Ensure the main heading exists (Idle state evidence)
    await expect(page.locator('h1')).toHaveText('Static Typing Demonstration');
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors (Runtime exceptions)
    expect(pageErrors, 'No uncaught page errors should have occurred').toHaveLength(0);

    // Assert there were no console.error messages
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, 'No console.error messages should be present').toHaveLength(0);
  });

  test.describe('S1_VariableDeclared (DeclareVariable) - variable declaration flow', () => {
    test('declares a number variable and updates variables list and alert is shown', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Declare variable x as number with value 42
      await app.declareVariable('x', 'number', '42');

      // The page script shows an alert on successful declaration; verify it was captured
      const dialogMsgs = consoleMessages.filter(m => m.type === 'dialog').map(m => m.text);
      expect(dialogMsgs.length).toBeGreaterThan(0);
      expect(dialogMsgs[dialogMsgs.length - 1]).toContain('Variable x of type number declared successfully.');

      // Verify variables list displays the declared variable with its value and JS typeof
      const listText = await app.getVariablesListText();
      // Expect "x: 42 (number)" somewhere in the list text
      expect(listText).toContain('x: 42 (number)');
    });

    test('declares a string variable and then overwrites it; list reflects latest value', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // First declare y as string 'hello'
      await app.declareVariable('y', 'string', 'hello');
      // Accept alert recorded by dialog handler
      let dialogMsgs = consoleMessages.filter(m => m.type === 'dialog').map(m => m.text);
      expect(dialogMsgs[dialogMsgs.length - 1]).toContain('Variable y of type string declared successfully.');

      // Overwrite y with boolean true
      await app.declareVariable('y', 'boolean', 'true');
      dialogMsgs = consoleMessages.filter(m => m.type === 'dialog').map(m => m.text);
      expect(dialogMsgs[dialogMsgs.length - 1]).toContain('Variable y of type boolean declared successfully.');

      const listText = await app.getVariablesListText();
      // Since value true when declared as boolean, it should show "true (boolean)"
      expect(listText).toContain('y: true (boolean)');
    });

    test('declares a number variable with non-numeric input -> NaN is stored; list shows NaN', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Declare z as number from non-numeric string 'abc' => parseFloat -> NaN
      await app.declareVariable('z', 'number', 'abc');
      const dialogMsgs = consoleMessages.filter(m => m.type === 'dialog').map(m => m.text);
      expect(dialogMsgs[dialogMsgs.length - 1]).toContain('Variable z of type number declared successfully.');

      const listText = await app.getVariablesListText();
      // NaN when converted to string is "NaN"
      expect(listText).toContain('z: NaN (number)');
    });
  });

  test.describe('S2_TypeChecked (CheckType) - checking types of variables', () => {
    test('checks type of an existing variable returns correct type string', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Prepare: declare a variable 'a' as boolean true
      await app.declareVariable('a', 'boolean', 'true');
      // Ensure declaration alert happened
      const dialogs = consoleMessages.filter(m => m.type === 'dialog').map(m => m.text);
      expect(dialogs[dialogs.length - 1]).toContain('Variable a of type boolean declared successfully.');

      // Now check the type of 'a'
      await app.checkType('a');
      const typeText = await app.getTypeResultText();
      expect(typeText).toBe('Type of a is boolean');
    });

    test('checking type of a non-existent variable displays not found message', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Ensure variable 'nope' does not exist
      await app.checkType('nope');
      const typeText = await app.getTypeResultText();
      expect(typeText).toBe('Variable nope not found.');
    });

    test('checking with empty name yields "Variable  not found."', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Edge case: empty name input
      await app.checkType('');
      const typeText = await app.getTypeResultText();
      // The implementation uses typeof variables[name] where name=='' => likely 'undefined' and considered falsy
      // The script expects: type ? `Type of ${name} is ${type}` : `Variable ${name} not found.`;
      // For empty name, this should result in "Variable  not found."
      expect(typeText).toBe('Variable  not found.');
    });
  });

  test.describe('S3_ValueConverted (ConvertValue) - conversion behaviors', () => {
    test('converts a numeric string to number', async ({ page }) => {
      const app = new StaticTypingPage(page);

      await app.convertValue('3.14', 'number');
      const conversion = await app.getConversionResultText();
      expect(conversion).toBe('Converted value: 3.14');
    });

    test('converts "true" and "false" to boolean', async ({ page }) => {
      const app = new StaticTypingPage(page);

      await app.convertValue('true', 'boolean');
      let conversion = await app.getConversionResultText();
      expect(conversion).toBe('Converted value: true');

      await app.convertValue('false', 'boolean');
      conversion = await app.getConversionResultText();
      expect(conversion).toBe('Converted value: false');
    });

    test('converts to string returns the original string representation', async ({ page }) => {
      const app = new StaticTypingPage(page);

      await app.convertValue('123abc', 'string');
      const conversion = await app.getConversionResultText();
      expect(conversion).toBe('Converted value: 123abc');
    });

    test('conversion of non-numeric to number results in NaN displayed', async ({ page }) => {
      const app = new StaticTypingPage(page);

      await app.convertValue('notanumber', 'number');
      const conversion = await app.getConversionResultText();
      // parseFloat('notanumber') -> NaN, stringified -> "NaN"
      expect(conversion).toBe('Converted value: NaN');
    });
  });

  test.describe('S4_ErrorSimulated (SimulateError) - error handling and messages', () => {
    test('simulate error for non-existent variable shows error message in errorResult', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Simulate error for a variable that does not exist
      await app.simulateErrorFor('doesNotExist');
      const errText = await app.getErrorResultText();
      expect(errText).toBe('Error: Variable doesNotExist does not exist.');
    });

    test('simulate error for existing variable displays existence and value', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Prepare variable
      await app.declareVariable('existVar', 'string', 'ok');
      const dialogs = consoleMessages.filter(m => m.type === 'dialog').map(m => m.text);
      expect(dialogs[dialogs.length - 1]).toContain('Variable existVar of type string declared successfully.');

      // Simulate error -> should instead display that variable exists
      await app.simulateErrorFor('existVar');
      const errText = await app.getErrorResultText();
      // Expect exact message pattern
      expect(errText).toBe('Variable existVar exists with value: ok');
    });

    test('simulate error with empty name shows "Variable  does not exist."', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Edge case: empty input
      await app.simulateErrorFor('');
      const errText = await app.getErrorResultText();
      expect(errText).toBe('Error: Variable  does not exist.');
    });
  });

  test.describe('Comprehensive FSM transitions and onEnter evidence checks', () => {
    test('transition from Idle -> VariableDeclared triggers updateVariablesList (list updated) and alert', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Start idle, declare variable alpha
      await app.declareVariable('alpha', 'string', 'valueAlpha');

      // Alert should have been shown and captured
      const dialogMsgs = consoleMessages.filter(m => m.type === 'dialog').map(m => m.text);
      expect(dialogMsgs[dialogMsgs.length - 1]).toContain('Variable alpha of type string declared successfully.');

      // updateVariablesList() should have updated variablesList; verify presence of alpha
      const listText = await app.getVariablesListText();
      expect(listText).toContain('alpha: valueAlpha (string)');
    });

    test('Idle -> TypeChecked transition shows appropriate typeResult message (existing and non-existing)', async ({ page }) => {
      const app = new StaticTypingPage(page);

      // Declare beta as number
      await app.declareVariable('beta', 'number', '10');
      const dialogs = consoleMessages.filter(m => m.type === 'dialog').map(m => m.text);
      expect(dialogs[dialogs.length - 1]).toContain('Variable beta of type number declared successfully.');

      // Check type for beta
      await app.checkType('beta');
      expect(await app.getTypeResultText()).toBe('Type of beta is number');

      // Check type for gamma (not present)
      await app.checkType('gamma');
      expect(await app.getTypeResultText()).toBe('Variable gamma not found.');
    });

    test('Idle -> ValueConverted transition displays conversion result for multiple conversions', async ({ page }) => {
      const app = new StaticTypingPage(page);

      await app.convertValue('100', 'number');
      expect(await app.getConversionResultText()).toBe('Converted value: 100');

      await app.convertValue('true', 'boolean');
      expect(await app.getConversionResultText()).toBe('Converted value: true');

      await app.convertValue('hello', 'string');
      expect(await app.getConversionResultText()).toBe('Converted value: hello');
    });

    test('Idle -> ErrorSimulated transition updates errorResult appropriately', async ({ page }) => {
      const app = new StaticTypingPage(page);

      await app.simulateErrorFor('nonexistentVar');
      expect(await app.getErrorResultText()).toBe('Error: Variable nonexistentVar does not exist.');
    });
  });
});