import { test, expect } from '@playwright/test';

// Test file for Application ID: 122ce960-fa7b-11f0-814c-dbec508f0b3b
// URL served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/122ce960-fa7b-11f0-814c-dbec508f0b3b.html

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122ce960-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Semaphore interactive application (FSM validation + errors)', () => {
  // Collect page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors (ReferenceError/TypeError etc.)
    page.on('pageerror', (err) => {
      // Push Error object for later assertions
      pageErrors.push(err);
    });

    // Capture console messages for debugging and assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Give a small grace period for any asynchronous handlers or errors to surface
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // Optional: dump console messages if a test fails locally (useful for debugging)
    if (pageErrors.length > 0) {
      // no-op: pageErrors are asserted in tests; this ensures they remain available
    }
  });

  test('Page load should produce an initial runtime error due to missing slider element', async ({ page }) => {
    // This test validates that the implementation throws an error during initialization:
    // The script references a '#slider' element which does not exist and calls addEventListener on null,
    // which should produce a TypeError during page load.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // At least one of the page errors should be a TypeError related to 'addEventListener' or 'slider' being null.
    const hasSliderTypeError = pageErrors.some(err => {
      const msg = String(err.message || '');
      return msg.includes('addEventListener') || msg.includes('slider') || msg.includes('Cannot read properties of null') || msg.includes('null');
    });
    expect(hasSliderTypeError).toBeTruthy();
  });

  test('There should be no #slider element in the DOM (edge case)', async ({ page }) => {
    // Ensure the slider element referenced in script is absent
    const slider = await page.$('#slider');
    expect(slider).toBeNull();
  });

  test('Duplicate id "input2" elements exist (edge case) and are accessible via attribute selector', async ({ page }) => {
    // The HTML has a duplicate id "input2" (a button and an input). Assert both exist.
    const elements = await page.$$('[id="input2"]');
    // Expect two elements with id="input2" — the test verifies problematic duplicate id usage
    expect(elements.length).toBeGreaterThanOrEqual(2);
  });

  test('Clicking Button 2 should read input1 and update buttons text and output.value (successful transition)', async ({ page }) => {
    // This validates the Button2Click transition:
    // - handleInputChange() should read inputs[0] value (input1),
    // - call updateOutput(value) (which sets output.value on a div),
    // - and updateButtonValue(value) to change textContent of all buttons.
    // The initial page error (slider) occurs during load, but the click handlers for buttons were added
    // before that error, so clicking button2 should still work.

    const input1 = page.locator('#input1');
    const button2 = page.locator('#button2');

    // Type a value into input1
    await input1.fill('hello-from-input1');

    // Click button2 and wait a tiny bit for synchronous handler to complete
    await button2.click();
    await page.waitForTimeout(50);

    // Assert that all button elements have been updated to the input value
    const buttons = await page.$$('button');
    const buttonTexts = await Promise.all(buttons.map(async b => (await b.textContent()).trim()));
    for (const text of buttonTexts) {
      expect(text).toBe('hello-from-input1');
    }

    // Assert that the #output element had its .value property set (even though it's a div).
    const outputValue = await page.$eval('#output', (el) => el.value);
    expect(outputValue).toBe('hello-from-input1');
  });

  test('Clicking Button 3 should read the second input (inputs[1]) and update buttons text (successful transition)', async ({ page }) => {
    // This validates the Button3Click transition:
    // - handleInput2Change() reads inputs[1] and updates buttons.
    const inputs = await page.$$('input');
    // Ensure we have at least 2 input elements (input1 and the second input with id input2)
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    const secondInput = inputs[1]; // inputs[1] corresponds to the second <input> element
    await secondInput.fill('value-from-second-input');

    const button3 = page.locator('#button3');
    await button3.click();
    await page.waitForTimeout(50);

    // All buttons should now have updated text
    const buttons = await page.$$('button');
    const texts = await Promise.all(buttons.map(async b => (await b.textContent()).trim()));
    for (const t of texts) {
      expect(t).toBe('value-from-second-input');
    }

    // #output.value should also reflect the same value (since updateOutput sets .value)
    const outputValue = await page.$eval('#output', (el) => el.value);
    expect(outputValue).toBe('value-from-second-input');
  });

  test('Clicking the button with id "input2" (the button, not the input) triggers handleInput2Change and updates buttons', async ({ page }) {
    // This validates the Input2Click transition (button with id input2).
    // There are duplicate id="input2" elements; we specifically target the button.
    const inputButton = await page.$('button#input2');
    expect(inputButton).not.toBeNull();

    // Set the underlying second input value so the handler has something to read.
    // The second input element (text) also has id="input2". We target the input via element type to avoid ambiguity.
    const secondTextInput = await page.$('input[id="input2"]');
    expect(secondTextInput).not.toBeNull();
    await secondTextInput.fill('from-duplicate-input2');

    // Click the button that has id=input2
    await inputButton.click();
    await page.waitForTimeout(50);

    // Check that button texts were updated
    const buttons = await page.$$('button');
    const texts = await Promise.all(buttons.map(async b => (await b.textContent()).trim()));
    for (const t of texts) {
      expect(t).toBe('from-duplicate-input2');
    }

    // Ensure output.value was also updated
    const outputValue = await page.$eval('#output', el => el.value);
    expect(outputValue).toBe('from-duplicate-input2');
  });

  test('Clicking Button 1 should throw a TypeError because it depends on a missing #slider (error transition)', async ({ page }) => {
    // This validates the Button1Click transition results in a runtime error:
    // handleSliderChange tries to access document.getElementById('slider').value which will throw.
    // We listen for the next pageerror event produced by this click.
    const clickPromise = page.waitForEvent('pageerror', { timeout: 2000 });
    await page.click('#button1');
    const err = await clickPromise;
    expect(err).toBeTruthy();
    const msg = String(err.message || '');
    // Error should mention inability to read 'value' or 'addEventListener' on null/undefined
    const matches = msg.includes('Cannot read') || msg.toLowerCase().includes('null') || msg.toLowerCase().includes('undefined') || msg.includes('slider');
    expect(matches).toBeTruthy();
  });

  test('Clicking button with id "input3" should throw because inputs[2] is undefined (error transition)', async ({ page }) => {
    // Validate Input3Click causes a TypeError because handleInput3Change accesses inputs[2].value,
    // but there are only two input elements in the DOM (inputs[2] is undefined).
    // Wait for pageerror generated by the click handler.
    const clickPromise = page.waitForEvent('pageerror', { timeout: 2000 });
    // Click the button with id input3
    await page.click('#input3');
    const err = await clickPromise;
    expect(err).toBeTruthy();
    const msg = String(err.message || '');
    // Should reference reading 'value' of undefined
    const matches = msg.includes('Cannot read') || msg.toLowerCase().includes('undefined') || msg.toLowerCase().includes('cannot');
    expect(matches).toBeTruthy();
  });

  test('Input events for inputs are not attached because script crashed before adding them (edge case)', async ({ page }) => {
    // The script attempted to add input event listeners after referencing the missing slider,
    // which threw and prevented attaching input listeners.
    // Therefore, typing into input elements should NOT propagate updates to buttons automatically.

    // Reset page by navigating again to ensure clean state for this test
    await page.goto(APP_URL);
    await page.waitForTimeout(100);

    // Set an initial button label to a sentinel value so we can detect unexpected changes
    // We'll click button2 to set initial known label, then type into input1 and ensure labels do not change as a result of typing.
    await page.fill('#input1', 'initial-sentinel');
    await page.click('#button2');
    await page.waitForTimeout(50);

    // Verify initial sentinel applied
    const buttonsBefore = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
    for (const t of buttonsBefore) expect(t).toBe('initial-sentinel');

    // Now type into input1 - if input listeners were attached, buttons would change automatically.
    await page.fill('#input1', 'typed-value');
    // give a short time for any input listeners (if present) to run
    await page.waitForTimeout(100);

    // Buttons should remain unchanged because input listeners were not attached
    const buttonsAfter = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
    for (const t of buttonsAfter) expect(t).toBe('initial-sentinel');
  });

  test('FSM coverage: ensure all FSM-declared interactive triggers are exercised (either succeed or produce an error)', async ({ page }) => {
    // This test programmatically triggers each event in the FSM and asserts it either:
    // - produces expected DOM side-effects (successful transitions), or
    // - produces an uncaught page error (error transitions), as permitted by the instructions.

    // Re-navigate to get a fresh state and collect errors for this test run
    await page.goto(APP_URL);
    await page.waitForTimeout(100);

    // Button1Click -> expected to throw (missing slider)
    const p1 = page.waitForEvent('pageerror').then(e => ({ id: 'Button1Click', error: e })).catch(() => ({ id: 'Button1Click', error: null }));
    await page.click('#button1').catch(() => {});
    const r1 = await p1;
    expect(r1.error).toBeTruthy();

    // Button2Click -> expected to succeed and update buttons to input1 value
    await page.fill('#input1', 'fsm-button2');
    await page.click('#button2');
    await page.waitForTimeout(50);
    const btnTextsAfter2 = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
    for (const t of btnTextsAfter2) expect(t).toBe('fsm-button2');

    // Button3Click -> expected to succeed and update buttons to inputs[1]
    // Ensure second input exists and fill it
    const textInputs = await page.$$('input');
    if (textInputs.length >= 2) {
      await textInputs[1].fill('fsm-button3');
      await page.click('#button3');
      await page.waitForTimeout(50);
      const btnTextsAfter3 = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
      for (const t of btnTextsAfter3) expect(t).toBe('fsm-button3');
    }

    // Input2Click -> click the button with id input2 (the button) - should also succeed
    const input2Button = await page.$('button#input2');
    if (input2Button) {
      // fill the associated text input (input[id="input2"]) if present
      const textInputForInput2 = await page.$('input[id="input2"]');
      if (textInputForInput2) {
        await textInputForInput2.fill('fsm-input2-click');
      }
      await input2Button.click();
      await page.waitForTimeout(50);
      const btnTextsAfterInput2Click = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
      for (const t of btnTextsAfterInput2Click) expect(t).toBe('fsm-input2-click');
    }

    // Input3Click -> should throw because inputs[2] is undefined
    const pInput3 = page.waitForEvent('pageerror').then(e => ({ id: 'Input3Click', error: e })).catch(() => ({ id: 'Input3Click', error: null }));
    await page.click('#input3').catch(() => {});
    const rInput3 = await pInput3;
    expect(rInput3.error).toBeTruthy();

    // SliderInput -> cannot occur because no slider exists; assert inability to trigger
    const slider = await page.$('#slider');
    expect(slider).toBeNull();
  });
});