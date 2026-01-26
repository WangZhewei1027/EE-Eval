import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12170ce2-fa7a-11f0-acf9-69409043402d.html';

// Utility to mirror the page's formatValue for expected assertions (kept here to assert DOM values)
// This duplicates the page formatting logic but does not change page behavior.
function expectedFormatValue(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}" (string)`;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2) + ' (object)';
    } catch {
      return '[object]';
    }
  }
  return String(v) + ' (' + typeof v + ')';
}

test.describe('Dynamic Typing Interactive Demo (FSM tests)', () => {
  // Collect console.error messages and page errors during each test to assert no runtime errors occurred.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept/dismiss alert dialogs produced by flows
    page.on('dialog', async (dialog) => {
      // Accept any alert/confirm/prompt so the test can continue.
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test assert that no console.error or uncaught page errors were emitted.
    // This helps catch runtime issues (ReferenceError, TypeError, SyntaxError) during the interactive flows.
    expect(consoleErrors, 'No console.error messages should be emitted during the test').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur during the test').toEqual([]);
  });

  test('Initial state (S0_Idle) - page initializes and displays stored value and defaults', async ({ page }) => {
    // Validate initial DOM content and default results as implemented by the page script
    // The script calls updateStoredDisplay() on init; current implementation formats undefined -> 'undefined'
    const stored = page.locator('#storedValueDisplay');
    const inspectRes = page.locator('#inspectResult');
    const binOpRes = page.locator('#binOpResult');

    await expect(stored).toHaveText(expectedFormatValue(undefined)); // 'undefined'
    await expect(inspectRes).toHaveText('[no operation applied]');
    await expect(binOpRes).toHaveText('[no operation applied]');
  });

  test.describe('Parsing and storing values (ParseAndStoreValue -> S1_ValueStored)', () => {
    test('Parse number literal and store', async ({ page }) => {
      // Enter 42 and click Parse and Store Value
      await page.fill('#inputValue', '42');
      await page.click('#evalButton');

      // Stored display should show number formatting
      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue(42));

      // Inspect/bin results should be reset per implementation
      await expect(page.locator('#inspectResult')).toHaveText('[no operation applied]');
      await expect(page.locator('#binOpResult')).toHaveText('[no operation applied]');
    });

    test('Parse single-quoted string literal and store', async ({ page }) => {
      // Single-quoted string should be interpreted as a string by safeParseLiteral
      await page.fill('#inputValue', "'hello'");
      await page.click('#evalButton');

      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue('hello'));
    });

    test('Parse boolean literal true and store', async ({ page }) => {
      await page.fill('#inputValue', 'true');
      await page.click('#evalButton');

      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue(true));
    });

    test('Parsing invalid input falls back to string and stores', async ({ page }) => {
      // Enter an unquoted word that is not JSON/number/boolean/null/undefined
      await page.fill('#inputValue', 'unquotedWord');
      await page.click('#evalButton');

      // Fallback returns the string verbatim
      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue('unquotedWord'));
    });
  });

  test.describe('Inspect & Convert operations (ApplyInspect -> S2_OperationApplied)', () => {
    test('Apply inspect type when no stored value (edge case)', async ({ page }) => {
      // Ensure storedValue is undefined (initial state) and clicking Apply yields "[no stored value]"
      await page.selectOption('#inspectSelect', 'type'); // select an op
      await page.click('#applyInspect');

      await expect(page.locator('#inspectResult')).toHaveText('[no stored value]');
    });

    test('Show type of a stored string', async ({ page }) => {
      // Store a string then apply 'type' inspect operation
      await page.fill('#inputValue', "'abc'");
      await page.click('#evalButton');

      await page.selectOption('#inspectSelect', 'type');
      await page.click('#applyInspect');

      // typeof storedValue is 'string' -> formatValue('string') => '"string" (string)'
      await expect(page.locator('#inspectResult')).toHaveText(expectedFormatValue('string'));
    });

    test('Convert stored string to number (toNumber)', async ({ page }) {
      await page.fill('#inputValue', "'123'");
      await page.click('#evalButton');

      await page.selectOption('#inspectSelect', 'toNumber');
      await page.click('#applyInspect');

      // Number('123') -> 123
      await expect(page.locator('#inspectResult')).toHaveText(expectedFormatValue(123));
    });

    test('Parse JSON string with toParsedJSON', async ({ page }) => {
      // Use the flow3 or manually store a JSON string and parse it
      await page.fill('#inputValue', '{"a":1,"b":[true,false,"str"]}');
      await page.click('#evalButton');

      await page.selectOption('#inspectSelect', 'toParsedJSON');
      await page.click('#applyInspect');

      // The result is an object, formatted with JSON.stringify + ' (object)'
      const expectedObj = { a: 1, b: [true, false, 'str'] };
      await expect(page.locator('#inspectResult')).toHaveText(expectedFormatValue(expectedObj));
    });

    test('toCharArray should split value into character array', async ({ page }) => {
      await page.fill('#inputValue', "'hi'");
      await page.click('#evalButton');

      await page.selectOption('#inspectSelect', 'toCharArray');
      await page.click('#applyInspect');

      // Result should be an array of chars; formatted as object JSON + ' (object)'
      const expected = ['h', 'i'];
      await expect(page.locator('#inspectResult')).toHaveText(expectedFormatValue(expected));
    });
  });

  test.describe('Binary operations (ApplyBinaryOperation -> S2_OperationApplied)', () => {
    test('Applying binary operation with no op selected (edge case)', async ({ page }) => {
      await page.fill('#inputValue', '5');
      await page.click('#evalButton');

      // Ensure no operation selected
      await page.selectOption('#binOpSelect', '');
      await page.fill('#binValueInput', '2');
      await page.click('#applyBinOp');

      await expect(page.locator('#binOpResult')).toHaveText('[no operation selected]');
    });

    test('Applying binary operation with no stored value (edge case)', async ({ page }) => {
      // Clear stored value explicitly
      await page.click('#clearStoredValue');

      // Choose an operation and second value
      await page.selectOption('#binOpSelect', 'add');
      await page.fill('#binValueInput', '2');
      await page.click('#applyBinOp');

      await expect(page.locator('#binOpResult')).toHaveText('[no stored value]');
    });

    test('Applying binary operation with missing second value (edge case)', async ({ page }) => {
      await page.fill('#inputValue', '10');
      await page.click('#evalButton');

      await page.selectOption('#binOpSelect', 'add');
      // Leave binValueInput empty
      await page.fill('#binValueInput', '   ');
      await page.click('#applyBinOp');

      await expect(page.locator('#binOpResult')).toHaveText('[no second value entered]');
    });

    test('Numeric addition: number + number', async ({ page }) => {
      await page.fill('#inputValue', '10');
      await page.click('#evalButton');

      await page.selectOption('#binOpSelect', 'add');
      await page.fill('#binValueInput', '5');
      await page.click('#applyBinOp');

      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue(15));
    });

    test('Plus operator with string stored demonstrates concatenation (dynamic typing)', async ({ page }) => {
      // Store string '123' and add 1: '123' + 1 => '1231' (string)
      await page.fill('#inputValue', "'123'");
      await page.click('#evalButton');

      await page.selectOption('#binOpSelect', 'add');
      await page.fill('#binValueInput', '1');
      await page.click('#applyBinOp');

      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue('1231'));
    });

    test('Concatenate operation forces string concatenation', async ({ page }) => {
      await page.fill('#inputValue', '10');
      await page.click('#evalButton');

      await page.selectOption('#binOpSelect', 'concatenate');
      await page.fill('#binValueInput', '5');
      await page.click('#applyBinOp');

      // '10' + '5' -> '105' (string)
      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue('105'));
    });

    test('Logical OR / AND operations', async ({ page }) => {
      // logicalOr: storedValue = false || 'fallback' -> 'fallback'
      await page.fill('#inputValue', 'false');
      await page.click('#evalButton');

      await page.selectOption('#binOpSelect', 'logicalOr');
      await page.fill('#binValueInput', "'fallback'");
      await page.click('#applyBinOp');

      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue('fallback'));

      // logicalAnd: true && 'x' -> 'x'
      await page.fill('#inputValue', 'true');
      await page.click('#evalButton');

      await page.selectOption('#binOpSelect', 'logicalAnd');
      await page.fill('#binValueInput', "'x'");
      await page.click('#applyBinOp');

      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue('x'));
    });

    test('Equality vs Strict Equality (Flow 4 typical scenario)', async ({ page }) => {
      // Use Flow4 to set up storedValue = 0 and bin inputs; flow triggers an alert which is auto-accepted
      await page.click('#flow4');

      // After flow4, storedValue should be 0
      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue(0));

      // Ensure bin input was set to 'false' by the flow; apply 'equals' operation
      await expect(page.locator('#binValueInput')).toHaveValue('false');
      await page.selectOption('#binOpSelect', 'equals');
      await page.click('#applyBinOp');

      // 0 == false -> true
      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue(true));

      // Change to strict equality and apply: 0 === false -> false
      await page.selectOption('#binOpSelect', 'strictEquals');
      await page.click('#applyBinOp');

      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue(false));
    });
  });

  test.describe('Assigning from binary result and clearing stored value (AssignFromBinaryOperation, ClearStoredValue)', () => {
    test('Assign stored value from last binary operation result', async ({ page }) => {
      // Start with numeric stored value and do addition
      await page.fill('#inputValue', '7');
      await page.click('#evalButton');

      await page.selectOption('#binOpSelect', 'add');
      await page.fill('#binValueInput', '8');
      await page.click('#applyBinOp');

      // Ensure binary result is 15
      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue(15));

      // Now click assignFromBinOp -> storedValue should update to lastBinOpResult
      await page.click('#assignFromBinOp');
      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue(15));
    });

    test('Clearing stored value resets state to idle', async ({ page }) => {
      // Store a value
      await page.fill('#inputValue', "'toBeCleared'");
      await page.click('#evalButton');

      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue('toBeCleared'));

      // Apply some operations to change other displays
      await page.selectOption('#inspectSelect', 'toNumber');
      await page.click('#applyInspect');

      await page.selectOption('#binOpSelect', 'add');
      await page.fill('#binValueInput', '1');
      await page.click('#applyBinOp');

      // Now clear
      await page.click('#clearStoredValue');

      // After clearing, storedValueDisplay should show 'undefined' per implementation
      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue(undefined));

      // And inspectResult & binOpResult should be reset to '[no operation applied]'
      await expect(page.locator('#inspectResult')).toHaveText('[no operation applied]');
      await expect(page.locator('#binOpResult')).toHaveText('[no operation applied]');
    });

    test('AssignFromBinOp when no last binary result should show message in stored display (edge case)', async ({ page }) => {
      // Ensure lastBinOpResult is undefined (fresh load or after clear)
      await page.click('#clearStoredValue');

      // Click assignFromBinOp with no lastBinOpResult
      await page.click('#assignFromBinOp');

      // Per implementation, storedValueDisplay is updated with the message
      await expect(page.locator('#storedValueDisplay')).toHaveText('[no binary operation result to assign]');
    });
  });

  test.describe('Interactive flows (Flow1, Flow2, Flow3) and their behaviors', () => {
    test('Flow1 sets up a string "123" and configures binary op + 1', async ({ page }) => {
      await page.click('#flow1'); // alert will be auto-accepted

      // stored value should be the string "123"
      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue('123'));

      // binOpSelect.value should be 'add' and binValueInput '1'
      await expect(page.locator('#binOpSelect')).toHaveValue('add');
      await expect(page.locator('#binValueInput')).toHaveValue('1');

      // Applying the binary op should yield string concatenation result '1231'
      await page.click('#applyBinOp');
      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue('1231'));
    });

    test('Flow2 sets boolean true and configures multiply by 10', async ({ page }) => {
      await page.click('#flow2'); // alert auto-accepted

      // storedValue should be boolean true
      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue(true));

      // binOpSelect is set to multiply and bin input to '10'
      await expect(page.locator('#binOpSelect')).toHaveValue('multiply');
      await expect(page.locator('#binValueInput')).toHaveValue('10');

      // Applying operation: true * 10 -> 10 (boolean coerces to number 1)
      await page.click('#applyBinOp');
      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue(10));
    });

    test('Flow3 sets JSON string and pre-selects toParsedJSON', async ({ page }) {
      await page.click('#flow3'); // alert auto-accepted

      // storedValue should be a JSON string
      const expectedJSONStr = '{"a":1,"b":[true,false,"str"]}';
      await expect(page.locator('#storedValueDisplay')).toHaveText(expectedFormatValue(expectedJSONStr));

      // Inspect select should be set to toParsedJSON according to flow3
      await expect(page.locator('#inspectSelect')).toHaveValue('toParsedJSON');

      // Applying parse should produce object result
      await page.click('#applyInspect');
      const expectedObj = { a: 1, b: [true, false, 'str'] };
      await expect(page.locator('#inspectResult')).toHaveText(expectedFormatValue(expectedObj));
    });
  });

  test.describe('Additional edge-case interactions', () => {
    test('Applying an unknown inspect operation yields no-operation message', async ({ page }) => {
      // Store any value
      await page.fill('#inputValue', '1');
      await page.click('#evalButton');

      // Select nothing (default) and apply
      await page.selectOption('#inspectSelect', '');
      await page.click('#applyInspect');

      await expect(page.locator('#inspectResult')).toHaveText(expectedFormatValue('[no operation selected]') || '"[no operation selected]" (string)');
      // Note: The page will format the string result as a string; the assertion above is tolerant by checking the formatted output.
    });

    test('Applying binary operation that produces an object result displays object formatting', async ({ page }) {
      // Store an object by entering a JSON literal
      await page.fill('#inputValue', '{"x":2}');
      await page.click('#evalButton');

      // Use an operation that will parse the stored object together with another object via concatenate (stringify)
      await page.selectOption('#binOpSelect', 'concatenate');
      await page.fill('#binValueInput', '{"y":3}');
      await page.click('#applyBinOp');

      // concatenate -> String(storedValue) + String(val2) where storedValue is object -> "[object Object]"? actually
      // safeParseLiteral will parse '{"y":3}' into an object; String(obj) -> "[object Object]" so result becomes string "[object Object][object Object]"
      await expect(page.locator('#binOpResult')).toHaveText(expectedFormatValue(String(JSON.parse('{"x":2}')) + String(JSON.parse('{"y":3}'))));
    });
  });
});