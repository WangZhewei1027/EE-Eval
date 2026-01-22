import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba73d90-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Array Example FSM - Page load and script errors', () => {
  // This test validates that the page script throws a ReferenceError on load
  // due to missing button variables (addElementButton, deleteButton, clearButton).
  test('page should emit a ReferenceError for undefined button variables on load', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => {
      // Collect page error messages for assertions below
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the page - the inline script is expected to run and produce errors
    await page.goto(APP_URL);

    // Ensure at least one page error was recorded
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // There should be an error related to addElementButton (missing variable)
    const hasAddElementButtonError = pageErrors.some(msg =>
      /addElementButton/i.test(msg) && /(not defined|is not defined|ReferenceError)/i.test(msg)
    );
    expect(hasAddElementButtonError).toBe(true);

    // The page should still have the array display elements present
    const lengthExists = await page.$('#array-length');
    const dataExists = await page.$('#array-data');
    const valuesExists = await page.$('#array-values');
    expect(lengthExists).not.toBeNull();
    expect(dataExists).not.toBeNull();
    expect(valuesExists).not.toBeNull();

    // The three expected buttons from the FSM are not present in the DOM as elements
    const addBtn = await page.$('#addElementButton');
    const deleteBtn = await page.$('#deleteButton');
    const clearBtn = await page.$('#clearButton');
    expect(addBtn).toBeNull();
    expect(deleteBtn).toBeNull();
    expect(clearBtn).toBeNull();

    // The script declared functions (addElement, deleteElement, clearArray) before the error.
    // Verify those functions exist in the page context (function declarations are hoisted).
    const addElementType = await page.evaluate(() => typeof addElement);
    const deleteElementType = await page.evaluate(() => typeof deleteElement);
    const clearArrayType = await page.evaluate(() => typeof clearArray);
    expect(addElementType).toBe('function');
    expect(deleteElementType).toBe('function');
    expect(clearArrayType).toBe('function');

    // The FSM entry action renderArray() should have been attempted in the script,
    // but due to the runtime error it likely did not run on load.
    // Verify that the visible text content for array displays remains empty (Idle state visual)
    const lengthText = await page.textContent('#array-length');
    const dataText = await page.textContent('#array-data');
    const valuesText = await page.textContent('#array-values');
    expect(lengthText).toBe('');
    expect(dataText).toBe('');
    expect(valuesText).toBe('');
  });
});

test.describe('Array Example FSM - Direct function invocation tests (transitions)', () => {
  // Each test navigates to the page and captures any page errors emitted on load,
  // but proceeds to exercise the functions declared on the page to validate FSM transitions.
  test.beforeEach(async ({ page }) => {
    // Capture page errors but do not fail tests immediately; we assert their presence where required.
    const errors = [];
    page.on('pageerror', (err) => {
      errors.push(String(err && err.message ? err.message : err));
    });
    await page.goto(APP_URL);
  });

  test('Add Element: addElement() should add items and update length/data/values', async ({ page }) => {
    // Ensure buttons are absent (script did not wire them up)
    expect(await page.$('#addElementButton')).toBeNull();

    // Simulate user prompt input for addElement via dialog handling
    page.once('dialog', async (dialog) => {
      // The first dialog is the prompt for value - supply "first"
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('first');
    });
    // Call the function directly in the page context
    await page.evaluate(() => addElement());

    // Verify DOM updated correctly after adding first element
    expect(await page.textContent('#array-length')).toBe('1');
    expect(await page.textContent('#array-data')).toBe('first');
    expect(await page.textContent('#array-values')).toBe('first');

    // Add a second element
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('second');
    });
    await page.evaluate(() => addElement());

    // Verify DOM updated correctly after adding second element
    expect(await page.textContent('#array-length')).toBe('2');
    expect(await page.textContent('#array-data')).toBe('first, second');
    expect(await page.textContent('#array-values')).toBe('first, second');
  });

  test('Add Element edge case: user cancels prompt should trigger alert and not change array', async ({ page }) => {
    // Ensure array is empty initially
    expect(await page.textContent('#array-length')).toBe('');

    // Trigger addElement but dismiss the prompt
    // The function will then show an alert('Please enter a value.')
    // We need to handle two dialogs: prompt (dismiss) and alert (accept)
    const promptPromise = page.waitForEvent('dialog');
    const callPromise = page.evaluate(() => addElement());
    const promptDialog = await promptPromise;
    expect(promptDialog.type()).toBe('prompt');
    await promptDialog.dismiss();

    const alertDialog = await page.waitForEvent('dialog');
    expect(alertDialog.type()).toBe('alert');
    expect(alertDialog.message()).toContain('Please enter a value');
    await alertDialog.accept();

    await callPromise; // ensure evaluate resolves

    // Array should remain unchanged (still empty textContent)
    expect(await page.textContent('#array-length')).toBe('');
    expect(await page.textContent('#array-data')).toBe('');
    expect(await page.textContent('#array-values')).toBe('');
  });

  test('Delete Element: deleteElement() should remove last item and update DOM', async ({ page }) => {
    // Prepare array with two items by invoking addElement twice
    page.once('dialog', async (d) => await d.accept('one'));
    await page.evaluate(() => addElement());
    page.once('dialog', async (d) => await d.accept('two'));
    await page.evaluate(() => addElement());

    expect(await page.textContent('#array-length')).toBe('2');
    expect(await page.textContent('#array-data')).toBe('one, two');

    // Call deleteElement to remove last item
    await page.evaluate(() => deleteElement());

    // After deletion, length should be 1 and data should only include 'one'
    expect(await page.textContent('#array-length')).toBe('1');
    expect(await page.textContent('#array-data')).toBe('one');
    expect(await page.textContent('#array-values')).toBe('one');

    // Call deleteElement again to remove the remaining item
    await page.evaluate(() => deleteElement());
    expect(await page.textContent('#array-length')).toBe('0' || ''); // depending on implementation, 0 as string or empty
    // data and values should be empty
    expect(await page.textContent('#array-data')).toBe('');
    expect(await page.textContent('#array-values')).toBe('');
  });

  test('Delete Element edge case: deleting from empty array should trigger alert', async ({ page }) => {
    // Clear array to ensure empty state
    await page.evaluate(() => clearArray());

    // Call deleteElement and expect an alert 'Array is empty.'
    const alertPromise = page.waitForEvent('dialog');
    const resultPromise = page.evaluate(() => deleteElement());
    const alertDialog = await alertPromise;
    expect(alertDialog.type()).toBe('alert');
    expect(alertDialog.message()).toContain('Array is empty');
    await alertDialog.accept();
    await resultPromise;

    // Ensure array remains cleared
    expect(await page.textContent('#array-length')).toBe('0' || '');
    expect(await page.textContent('#array-data')).toBe('');
    expect(await page.textContent('#array-values')).toBe('');
  });

  test('Clear Array: clearArray() should empty the array and clear displays', async ({ page }) => {
    // Seed the array with two items
    page.once('dialog', async (d) => await d.accept('a'));
    await page.evaluate(() => addElement());
    page.once('dialog', async (d) => await d.accept('b'));
    await page.evaluate(() => addElement());

    expect(await page.textContent('#array-length')).toBe('2');
    expect(await page.textContent('#array-data')).toBe('a, b');

    // Call clearArray to empty it
    await page.evaluate(() => clearArray());

    // After clearing, the length should be 0 and data/values cleared
    // The implementation sets lengthInput.textContent = array.length; which will be '0'
    expect(await page.textContent('#array-length')).toBe('0');
    expect(await page.textContent('#array-data')).toBe('');
    expect(await page.textContent('#array-values')).toBe('');
  });

  test('renderArray function exists but was not run on entry due to script error; calling it sets non-visible value property', async ({ page }) => {
    // Check that renderArray exists
    const renderType = await page.evaluate(() => typeof renderArray);
    expect(renderType).toBe('function');

    // Prepare array with a couple of items
    page.once('dialog', async (d) => await d.accept('x'));
    await page.evaluate(() => addElement());
    page.once('dialog', async (d) => await d.accept('y'));
    await page.evaluate(() => addElement());

    // Call renderArray directly. It assigns dataInput.value but not dataInput.textContent.
    await page.evaluate(() => renderArray());

    // dataInput.textContent should still reflect the join (since addElement updated textContent),
    // but renderArray sets dataInput.value (a property on the element). Verify that the property was set.
    const dataValueProp = await page.evaluate(() => {
      // Return both textContent and the .value property (the latter may be undefined initially but renderArray sets it)
      return { text: dataInput.textContent, valueProp: dataInput.value };
    });

    // textContent should still show the joined list
    expect(dataValueProp.text).toBe('x, y');

    // renderArray set a non-visible 'value' property to the joined map representation.
    // Ensure that property contains the mapped values; we expect something like "1: x\n2: y"
    expect(typeof dataValueProp.valueProp).toBe('string');
    expect(dataValueProp.valueProp).toContain('1: x');
    expect(dataValueProp.valueProp).toContain('2: y');
  });
});