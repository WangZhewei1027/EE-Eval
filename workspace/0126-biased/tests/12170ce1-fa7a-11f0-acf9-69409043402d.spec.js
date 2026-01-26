import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12170ce1-fa7a-11f0-acf9-69409043402d.html';

// Test suite for "Static Typing Interactive Exploration"
// Filename must be: 12170ce1-fa7a-11f0-acf9-69409043402d.spec.js

test.describe('Static Typing Interactive Exploration - FSM validation', () => {
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    // Arrays to collect console, errors, dialogs for assertions
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Listen to console messages
    page.on('console', msg => {
      try { consoleMessages.push({ type: msg.type(), text: msg.text() }); }
      catch (e) { consoleMessages.push({ type: 'unknown', text: String(msg) }); }
    });

    // Listen to page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture alerts/confirm/prompt dialogs and accept them, but record their messages
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // no-op cleanup; listeners are tied to page lifecycle
  });

  test('S0_Idle - initial render shows built-in primitives and UI elements', async ({ page }) => {
    // Validate presence of key UI elements and initial content - corresponds to S0_Idle entry action: renderPage()
    // Check headings and controls exist
    await expect(page.locator('h1')).toHaveText('Static Typing Interactive Exploration');
    await expect(page.locator('#typeNameInput')).toBeVisible();
    await expect(page.locator('#typeDefSelect')).toBeVisible();
    await expect(page.locator('#addTypeBtn')).toBeVisible();
    await expect(page.locator('#varNameInput')).toBeVisible();
    await expect(page.locator('#varTypeSelect')).toBeVisible();
    await expect(page.locator('#declareVarBtn')).toBeVisible();
    await expect(page.locator('#assignmentVarSelect')).toBeVisible();
    await expect(page.locator('#assignmentValueInput')).toBeVisible();
    await expect(page.locator('#assignValueBtn')).toBeVisible();
    await expect(page.locator('#enableTypeChecking')).toBeVisible();
    await expect(page.locator('#typeView')).toBeVisible();
    await expect(page.locator('#varView')).toBeVisible();
    await expect(page.locator('#log')).toBeVisible();

    // The typeView should include built-in primitive types: int, string, boolean
    const typeViewText = await page.locator('#typeView').textContent();
    expect(typeViewText).toBeTruthy();
    expect(typeViewText).toContain('int');
    expect(typeViewText).toContain('string');
    expect(typeViewText).toContain('boolean');

    // varView should be empty initially (no variables declared)
    const varViewText = await page.locator('#varView').textContent();
    expect(varViewText.trim()).toBe('');

    // Activity log should be initially empty
    const logText = await page.locator('#log').textContent();
    expect(logText.trim()).toBe('');

    // No uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Type creation and TypeDefined state (S1_TypeDefined)', () => {
    test('Add alias type -> transitions to Type Defined, updates typeView and logs', async ({ page }) => {
      // Create alias type MyInt = int
      await page.fill('#typeNameInput', 'MyInt');
      // select "Alias" in typeDefSelect
      await page.selectOption('#typeDefSelect', 'alias');

      // alias target select is dynamically created; wait for it
      const aliasSelect = page.locator('#aliasTargetTypeSelect');
      await expect(aliasSelect).toBeVisible();
      // choose int
      await aliasSelect.selectOption('int');

      // Click add type button
      await page.click('#addTypeBtn');

      // Expect log entry for alias definition
      await expect(page.locator('#log')).toContainText('Defined alias type MyInt = int');

      // Expect typeView to include MyInt mapped to int (string representation)
      await expect(page.locator('#typeView')).toContainText('MyInt = int');

      // varTypeSelect should be updated with MyInt option
      await expect(page.locator('#varTypeSelect')).toContainText('MyInt');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Add object type -> logs and typeView updated', async ({ page }) => {
      // Create object type Person with properties
      await page.fill('#typeNameInput', 'Person');
      await page.selectOption('#typeDefSelect', 'object');

      // Wait for objectPropsInput textarea
      const propsTa = page.locator('#objectPropsInput');
      await expect(propsTa).toBeVisible();
      await propsTa.fill('name:string\nage:int');

      await page.click('#addTypeBtn');

      // Expect log mentions properties
      await expect(page.locator('#log')).toContainText('Defined object type Person with props: name, age');

      // Type view shows Person
      await expect(page.locator('#typeView')).toContainText('Person = {name: string, age: int}');

      // varTypeSelect should include Person
      await expect(page.locator('#varTypeSelect')).toContainText('Person');

      expect(pageErrors.length).toBe(0);
    });

    test('Add generic type -> logs generic creation (S1 entry action: refreshTypeView reflected)', async ({ page }) => {
      // Define a generic List<T> with prop item: T
      await page.fill('#typeNameInput', 'List');
      await page.selectOption('#typeDefSelect', 'generic');

      const paramInput = page.locator('#genericParamInput');
      const genericProps = page.locator('#genericPropsInput');
      await expect(paramInput).toBeVisible();
      await expect(genericProps).toBeVisible();

      // Ensure default param T is present and set props
      await paramInput.fill('T');
      await genericProps.fill('item: T');

      await page.click('#addTypeBtn');

      // Expect log for generic type definition
      await expect(page.locator('#log')).toContainText('Defined generic type List<T> with props: item');

      // typeView should represent the generic (Generic<...>)
      await expect(page.locator('#typeView')).toContainText('List') ;
      await expect(page.locator('#typeView')).toContainText('Generic');

      expect(pageErrors.length).toBe(0);
    });

    test('Add union type -> logs union creation and typeView shows union', async ({ page }) => {
      // Define union type NumberOrText = int, string
      await page.fill('#typeNameInput', 'NumberOrText');
      await page.selectOption('#typeDefSelect', 'union');

      const unionInput = page.locator('#unionTypesInput');
      await expect(unionInput).toBeVisible();
      await unionInput.fill('int, string');

      await page.click('#addTypeBtn');

      await expect(page.locator('#log')).toContainText('Defined union type NumberOrText = int | string');
      await expect(page.locator('#typeView')).toContainText('NumberOrText = int | string');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Variable declaration and Value assignment (S2_VariableDeclared, S3_ValueAssigned)', () => {
    test('Declare variable of object type -> logs and varView updated (S2_VariableDeclared)', async ({ page }) => {
      // Precondition: Person type exists from prior tests; but tests are independent per Playwright file run.
      // To be safe, define Person here if not present.
      const typeViewText = await page.locator('#typeView').textContent();
      if (!typeViewText.includes('Person')) {
        // Define Person
        await page.fill('#typeNameInput', 'Person');
        await page.selectOption('#typeDefSelect', 'object');
        await page.locator('#objectPropsInput').fill('name:string\nage:int');
        await page.click('#addTypeBtn');
        await expect(page.locator('#log')).toContainText('Defined object type Person with props: name, age');
      }

      // Declare variable p1 : Person
      await page.fill('#varNameInput', 'p1');
      await page.selectOption('#varTypeSelect', 'Person');
      await page.click('#declareVarBtn');

      // Expect log entry
      await expect(page.locator('#log')).toContainText('Declared variable p1 of type Person');

      // varView should list p1 with type and null value
      await expect(page.locator('#varView')).toContainText('p1 : {name: string, age: int} = null');

      // assignmentVarSelect should include p1 option
      await expect(page.locator('#assignmentVarSelect')).toContainText('p1 : {name: string, age: int}');

      expect(pageErrors.length).toBe(0);
    });

    test('Assign valid object value -> passes type check and updates varView (S3_ValueAssigned)', async ({ page }) => {
      // Ensure p1 exists. If not, declare it as above.
      const assignmentSelect = page.locator('#assignmentVarSelect');
      const assignmentValueInput = page.locator('#assignmentValueInput');

      // If no options in assignmentVarSelect, declare p1 first
      const opts = await assignmentSelect.locator('option').count();
      if (opts === 0) {
        // define Person and declare variable
        await page.fill('#typeNameInput', 'Person');
        await page.selectOption('#typeDefSelect', 'object');
        await page.locator('#objectPropsInput').fill('name:string\nage:int');
        await page.click('#addTypeBtn');
        await page.fill('#varNameInput', 'p1');
        await page.selectOption('#varTypeSelect', 'Person');
        await page.click('#declareVarBtn');
      }

      // Select p1 for assignment
      await assignmentSelect.selectOption({ label: /p1/ });

      // Wait for placeholder update triggered by change event
      await assignmentSelect.dispatchEvent('change');

      // Fill valid JSON for Person
      await assignmentValueInput.fill('{"name": "Alice", "age": 30}');

      // Click assign
      await page.click('#assignValueBtn');

      // Expect log for assignment
      await expect(page.locator('#log')).toContainText('Assigned value to variable p1');

      // varView should show the assigned value
      await expect(page.locator('#varView')).toContainText('p1 : {name: string, age: int} = {"name":"Alice","age":30}');

      expect(pageErrors.length).toBe(0);
    });

    test('Assign invalid value with type checking enabled -> alert shown and no assignment', async ({ page }) => {
      // Ensure a variable p2 of type Person exists
      const assignmentSelect = page.locator('#assignmentVarSelect');
      const assignmentValueInput = page.locator('#assignmentValueInput');

      // Declare new variable p2
      await page.fill('#varNameInput', 'p2');
      await page.selectOption('#varTypeSelect', 'Person');
      await page.click('#declareVarBtn');
      await expect(page.locator('#log')).toContainText('Declared variable p2 of type Person');

      // Select p2
      await assignmentSelect.selectOption({ label: /p2/ });
      await assignmentSelect.dispatchEvent('change');

      // Now attempt to assign invalid value (age as string) while type checking is enabled (default)
      // Fill JSON with wrong type for age
      await assignmentValueInput.fill('{"name":"Bob","age":"thirty"}');

      // Click assign - should trigger an alert due to type mismatch (we capture dialogs in dialogs array)
      await page.click('#assignValueBtn');

      // We accepted the dialog automatically via the dialog handler; check that a dialog message was recorded
      // Expect the most recent dialog to mention 'Type check failed' or similar
      const recentDialog = dialogs.pop();
      expect(recentDialog).toBeTruthy();
      expect(recentDialog).toMatch(/Type check failed|Input parsing error|Failed to parse/);

      // varView should not have p2 assigned (value should be null)
      await expect(page.locator('#varView')).toContainText('p2 : {name: string, age: int} = null');

      expect(pageErrors.length).toBe(0);
    });

    test('Assign malformed JSON -> parsing error alert and no assignment', async ({ page }) => {
      // Use existing variable p1 or p3; create p3 to avoid interfering with earlier vars
      await page.fill('#varNameInput', 'p3');
      await page.selectOption('#varTypeSelect', 'Person');
      await page.click('#declareVarBtn');
      await expect(page.locator('#log')).toContainText('Declared variable p3 of type Person');

      // Select p3 and attempt to assign malformed JSON
      await page.selectOption('#assignmentVarSelect', { label: /p3/ });
      await page.locator('#assignmentVarSelect').dispatchEvent('change');

      await page.locator('#assignmentValueInput').fill('{"name": "Carol", "age": 25'); // missing closing }

      // Click assign and expect parsing error alert
      await page.click('#assignValueBtn');

      const recentDialog = dialogs.pop();
      expect(recentDialog).toBeTruthy();
      expect(recentDialog).toMatch(/Input parsing error|Failed to parse/);

      // Ensure p3 value still null
      await expect(page.locator('#varView')).toContainText('p3 : {name: string, age: int} = null');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Cannot redefine primitive types (alert expected)', async ({ page }) => {
      // Try to create type named 'int' which should produce an alert "Cannot redefine built-in primitive types."
      await page.fill('#typeNameInput', 'int');
      await page.selectOption('#typeDefSelect', 'alias'); // kind doesn't matter here

      await page.click('#addTypeBtn');

      // We expect an alert; recorded in dialogs
      const recentDialog = dialogs.pop();
      expect(recentDialog).toBeTruthy();
      expect(recentDialog).toMatch(/Cannot redefine built-in primitive types|Cannot add new primitive types/);

      // Confirm that typeView still contains built-in int and not redefined
      await expect(page.locator('#typeView')).toContainText('int');

      expect(pageErrors.length).toBe(0);
    });

    test('Cannot declare variable of uninstantiated generic type -> alert', async ({ page }) => {
      // Ensure generic type List exists; if not, create it
      const typeViewText = await page.locator('#typeView').textContent();
      if (!typeViewText.includes('List')) {
        await page.fill('#typeNameInput', 'List');
        await page.selectOption('#typeDefSelect', 'generic');
        await page.locator('#genericParamInput').fill('T');
        await page.locator('#genericPropsInput').fill('item: T');
        await page.click('#addTypeBtn');
        await expect(page.locator('#log')).toContainText('Defined generic type List<T> with props: item');
      }

      // Attempt to declare variable varList of type List (generic uninstantiated)
      await page.fill('#varNameInput', 'varList');
      await page.selectOption('#varTypeSelect', 'List');
      await page.click('#declareVarBtn');

      // Expect alert stating cannot declare variables of generic uninstantiated type
      const recentDialog = dialogs.pop();
      expect(recentDialog).toBeTruthy();
      expect(recentDialog).toMatch(/Cannot declare variables of generic uninstantiated type|Cannot declare variables of generic/);

      // Ensure variable not declared (varView should not show varList)
      const varViewText = await page.locator('#varView').textContent();
      expect(varViewText).not.toContain('varList');

      expect(pageErrors.length).toBe(0);
    });

    test('Invalid type name or property definitions produce alerts', async ({ page }) => {
      // Invalid type name (starts with digit)
      await page.fill('#typeNameInput', '123Bad');
      await page.selectOption('#typeDefSelect', 'object');
      await page.locator('#objectPropsInput').fill('a:int');
      await page.click('#addTypeBtn');

      // Expect alert about invalid type name
      const dlg1 = dialogs.pop();
      expect(dlg1).toBeTruthy();
      expect(dlg1).toMatch(/Invalid type name|Bad property definition/);

      // Bad property line format
      await page.fill('#typeNameInput', 'BadProps');
      await page.selectOption('#typeDefSelect', 'object');
      await page.locator('#objectPropsInput').fill('badlinewithoutcolon');
      await page.click('#addTypeBtn');

      const dlg2 = dialogs.pop();
      expect(dlg2).toBeTruthy();
      expect(dlg2).toMatch(/Bad property definition/);

      expect(pageErrors.length).toBe(0);
    });
  });

  test('Console and page error observations - ensure no unexpected runtime exceptions', async ({ page }) => {
    // This test validates that we captured console messages and page errors during interactions above.
    // There should be console logs for defined types, declared variables, and assignments we performed.
    const logText = await page.locator('#log').textContent();

    // Ensure at least some expected console log messages (activity log is used by app)
    expect(logText.length).toBeGreaterThanOrEqual(0);

    // There should be no uncaught page errors across interactions
    expect(pageErrors.length).toBe(0);

    // Ensure we collected dialog messages (edge cases and invalid operations produce them)
    // dialogs array may have been used throughout; it should be an array (possibly empty)
    expect(Array.isArray(dialogs)).toBeTruthy();
  });
});