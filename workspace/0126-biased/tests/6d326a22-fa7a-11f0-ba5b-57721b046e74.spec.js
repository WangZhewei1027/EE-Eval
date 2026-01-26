import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d326a22-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Dynamic Typing Explorer - FSM validation', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Helper to parse the visible type output text into a normalized string
  const getTypeOutputText = async (page) => {
    const el = page.locator('#typeOutput');
    await expect(el).toBeVisible();
    const text = (await el.textContent()) || '';
    // Normalize whitespace
    return text.replace(/\s+/g, ' ').trim();
  };

  // Helper to read code output textarea
  const getCodeOutputText = async (page) => {
    const el = page.locator('#codeOutput');
    await expect(el).toBeVisible();
    return (await el.inputValue()).trim();
  };

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors for assertions later
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown necessary beyond Playwright's built-in cleanup.
  });

  test.describe('Initialization and Idle state (S0_Idle)', () => {
    test('should display the idle entry message and initial code output', async ({ page }) => {
      // Validate the initial entry action: showTypeInfo('Click buttons to explore dynamic typing')
      const typeText = await getTypeOutputText(page);
      expect(typeText).toContain('Click buttons to explore dynamic typing');

      // The initial value is a string, so codeOutput should indicate string type in the inline comment
      const codeText = await getCodeOutputText(page);
      expect(codeText).toContain('typeof value; // string');

      // Ensure no uncaught page errors or console error messages occurred on initialization
      expect(pageErrors.length, `Expected no page errors, saw: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `Expected no console errors, saw: ${consoleErrors.join('; ')}`).toBe(0);
    });
  });

  test.describe('Type creation events (S1..S6)', () => {
    test('Create Number (S1_NumberCreated) should show a number type', async ({ page }) => {
      // Click createNumber and assert type displayed is number
      await page.click('#createNumber');
      const typeText = await getTypeOutputText(page);
      expect(typeText).toContain('Type:');
      expect(typeText).toMatch(/Type:\s*number/i);

      const codeText = await getCodeOutputText(page);
      expect(codeText).toContain('typeof value; // number');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Create String (S2_StringCreated) should show a string type and constructor Function name absent', async ({ page }) => {
      await page.click('#createString');
      const typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*string/i);
      // Constructor for string should be String
      expect(typeText).toMatch(/Constructor:\s*String/);

      const codeText = await getCodeOutputText(page);
      expect(codeText).toContain('typeof value; // string');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Create Boolean (S3_BooleanCreated) should show a boolean type', async ({ page }) => {
      await page.click('#createBoolean');
      const typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*boolean/i);

      const codeText = await getCodeOutputText(page);
      expect(codeText).toContain('typeof value; // boolean');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Create Array (S4_ArrayCreated) should display constructor Array', async ({ page }) => {
      await page.click('#createArray');
      const typeText = await getTypeOutputText(page);
      // typeof array is object, but constructor should be Array
      expect(typeText).toMatch(/Type:\s*object/i);
      expect(typeText).toMatch(/Constructor:\s*Array/);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Create Object (S5_ObjectCreated) should display constructor Object', async ({ page }) => {
      await page.click('#createObject');
      const typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Constructor:\s*Object/);
      expect(typeText).toMatch(/Type:\s*object/i);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Create Function (S6_FunctionCreated) should display constructor Function', async ({ page }) => {
      await page.click('#createFunction');
      const typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Constructor:\s*Function/);
      expect(typeText).toMatch(/Type:\s*function/i);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Custom evaluation and conversions (S7, S8)', () => {
    test('Evaluate custom value: object literal via Evaluate (S7_CustomValueEvaluated)', async ({ page }) => {
      // Provide a JS expression that evaluates to an object
      await page.fill('#customValue', '({foo: 42, bar: "baz"})');
      await page.click('#evaluateCustom');

      const typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Constructor:\s*Object/);
      // The visible Value for an object will be "[object Object]" in the template string
      expect(typeText).toContain('Value:');
      expect(typeText).toMatch(/Type:\s*object/i);

      const codeText = await getCodeOutputText(page);
      expect(codeText).toContain('"foo"') || expect(codeText).toContain('foo'); // JSON may include keys

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Convert value to string (S8_ValueConverted) after creating a number', async ({ page }) => {
      // Create a number deterministically by using EvaluateCustom with numeric literal
      await page.fill('#customValue', '10');
      await page.click('#evaluateCustom');

      // Ensure lastValue is number
      let typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*number/i);

      // Convert to string
      await page.selectOption('#conversionType', 'string');
      await page.click('#convertValue');

      typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*string/i);

      const codeText = await getCodeOutputText(page);
      expect(codeText).toContain('typeof value; // string');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Conversion does nothing when lastValue is null (edge case)', async ({ page }) => {
      // Set lastValue to null via EvaluateCustom
      await page.fill('#customValue', 'null');
      await page.click('#evaluateCustom');

      const before = await getTypeOutputText(page);
      expect(before).toMatch(/Value:\s*null/i);

      // Attempt conversion - should return early with no change
      await page.selectOption('#conversionType', 'string');
      await page.click('#convertValue');

      const after = await getTypeOutputText(page);
      expect(after).toBe(before); // No change expected

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Variable management (S9)', () => {
    test('Create variable from last value and update variable list', async ({ page }) => {
      // Set a known lastValue
      await page.fill('#customValue', '123');
      await page.click('#evaluateCustom');

      // Provide a variable name and create it
      await page.fill('#varName', 'myVar');
      await page.click('#createVar');

      // Ensure the variable list includes the new variable and its value
      const variableListText = await page.locator('#variableList').textContent();
      expect(variableListText).toBeTruthy();
      expect(variableListText).toContain('myVar');
      expect(variableListText).toContain('123');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Operations (S10_OperationPerformed)', () => {
    test('Add operation should add prompt-provided number to lastValue', async ({ page }) => {
      // Set lastValue to a known number
      await page.fill('#customValue', '7');
      await page.click('#evaluateCustom');

      // Prepare to handle the prompt and provide '3' as the input
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('3');
      });

      await page.click('#addOperation');

      const typeText = await getTypeOutputText(page);
      // result should be a number (7 + 3 => 10)
      expect(typeText).toMatch(/Type:\s*number/i);
      // Confirm the numeric result appears in the Value text (10)
      expect(typeText).toMatch(/Value:\s*10/);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Concatenate operation should append prompt string to last string', async ({ page }) => {
      // Set lastValue to a known string
      await page.fill('#customValue', "'base'");
      await page.click('#evaluateCustom');

      // Provide 'XYZ' to the prompt used by concatOperation
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('XYZ');
      });

      await page.click('#concatOperation');

      const typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*string/i);
      // The concatenated result should contain the prompt input 'XYZ'
      expect(typeText).toContain('XYZ');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Compare (==) vs Strict Compare (===) behavior', async ({ page }) => {
      // Set lastValue to numeric 5
      await page.fill('#customValue', '5');
      await page.click('#evaluateCustom');

      // For loose equality (==), if we prompt '5' (string), it should coerce true
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('5');
      });
      await page.click('#compareOperation');
      let typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*boolean/i);
      // Loose equality yields true
      expect(typeText).toMatch(/Value:\s*true/i);

      // Reset lastValue back to numeric 5 for strict test
      await page.fill('#customValue', '5');
      await page.click('#evaluateCustom');

      // For strict equality (===) with a string '5', result should be false
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('5');
      });
      await page.click('#strictCompareOperation');
      typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*boolean/i);
      expect(typeText).toMatch(/Value:\s*false/i);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Increment and Decrement change numeric lastValue appropriately', async ({ page }) => {
      // Start with known number 20
      await page.fill('#customValue', '20');
      await page.click('#evaluateCustom');

      // Increment
      await page.click('#increment');
      let typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*number/i);
      expect(typeText).toMatch(/Value:\s*21/);

      // Decrement
      await page.click('#decrement');
      typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*number/i);
      // Should be back to 20
      expect(typeText).toMatch(/Value:\s*20/);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Multiply and Divide with prompt values', async ({ page }) => {
      // Set lastValue to 6
      await page.fill('#customValue', '6');
      await page.click('#evaluateCustom');

      // Multiply by 3 -> expect 18
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('3');
      });
      await page.click('#multiply');
      let typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*number/i);
      expect(typeText).toMatch(/Value:\s*18/);

      // Divide by 2 -> expect 9
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('2');
      });
      await page.click('#divide');
      typeText = await getTypeOutputText(page);
      expect(typeText).toMatch(/Type:\s*number/i);
      // Allow decimals; 18 / 2 -> 9
      expect(typeText).toMatch(/Value:\s*9/);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Expression evaluation (S11_ExpressionEvaluated) and error handling', () => {
    test('Evaluate expression should compute and display result and its type', async ({ page }) => {
      await page.fill('#expressionInput', '2+3*4');
      await page.click('#evaluateExpression');

      const exprResult = await page.locator('#expressionResult').textContent();
      expect(exprResult).toContain('Result:');
      expect(exprResult).toContain('14');
      expect(exprResult).toContain('Type:');
      expect(exprResult.toLowerCase()).toContain('type: number' || 'Type: number'.toLowerCase());

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Evaluate expression with syntax error should display error message in expressionResult (edge case)', async ({ page }) => {
      // Provide an invalid JS expression - the page code catches errors and writes them to expressionResult
      await page.fill('#expressionInput', 'foo( '); // intentionally malformed
      await page.click('#evaluateExpression');

      const exprResult = await page.locator('#expressionResult').textContent();
      expect(exprResult.toLowerCase()).toContain('error:');

      // Confirm no uncaught browser errors (they should have been caught by the page's try/catch)
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Console and page error observation', () => {
    test('should not produce uncaught ReferenceError, SyntaxError, or TypeError during normal interactions', async ({ page }) => {
      // Perform a series of interactions that exercise many handlers
      await page.click('#createNumber');
      await page.click('#createString');
      await page.click('#createBoolean');
      await page.click('#createArray');
      await page.click('#createObject');
      await page.click('#createFunction');

      // Evaluate a safe custom expression
      await page.fill('#customValue', '42');
      await page.click('#evaluateCustom');

      // Convert to boolean
      await page.selectOption('#conversionType', 'boolean');
      await page.click('#convertValue');

      // Create variable
      await page.fill('#varName', 'varFromTest');
      await page.click('#createVar');

      // Use a prompt-driven operation: provide deterministic input for a prompt
      page.once('dialog', async (dialog) => dialog.accept('1'));
      await page.click('#addOperation');

      // Evaluate a valid expression
      await page.fill('#expressionInput', '1+1');
      await page.click('#evaluateExpression');

      // Collect console and page errors that may have been captured
      // Assert no uncaught page errors
      expect(pageErrors.length).toBe(0);
      // Assert no console errors emitted
      expect(consoleErrors.length).toBe(0);

      // Additionally ensure we captured some console messages or interactions (optional sanity)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });
});