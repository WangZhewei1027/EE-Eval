import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e21e0-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Decision Tree Interactive App (FSM validation) - 122e21e0-fa7b-11f0-814c-dbec508f0b3b', () => {
  // We will capture console messages and page errors per test to assert runtime failures happen naturally.
  // Each test gets a fresh new page from Playwright's fixture, so global state resets between tests.

  test.beforeEach(async ({ page }) => {
    // Navigate to the provided page before each test
    await page.goto(APP_URL);
  });

  test('S0_Idle: initial render contains tree container and submit button, inputs present', async ({ page }) => {
    // Validate initial UI elements as described in S0_Idle
    // - tree div exists
    // - submit button exists
    // - ten inputs are present with their default values
    await expect(page.locator('#tree')).toBeVisible();
    await expect(page.locator('#submit')).toBeVisible();

    // Confirm there are 10 numeric input elements and their default values match the HTML
    const inputs = page.locator('input[type="number"]');
    await expect(inputs).toHaveCount(10);

    // Check a few sample defaults
    await expect(page.locator('#input1')).toHaveValue('10');
    await expect(page.locator('#input5')).toHaveValue('50');
    await expect(page.locator('#input10')).toHaveValue('100');

    // Ensure result area exists and is initially empty
    await expect(page.locator('#result')).toBeVisible();
    const resultText = await page.locator('#result').textContent();
    expect(resultText).toBe('');
  });

  test('Transition InputChange -> S1_InputReceived: changing an input updates window.inputsValues', async ({ page }) => {
    // Capture any unexpected page errors during this interaction
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Change input#input1 value and dispatch a change event to trigger the listener
    await page.fill('#input1', '42');
    // Trigger 'change' event explicitly in case fill didn't fire it
    await page.dispatchEvent('#input1', 'change');

    // Read the inputsValues array from the page
    const inputsValues = await page.evaluate(() => {
      // Return a shallow copy to avoid exposing internal references
      return Array.isArray(window.inputsValues) ? window.inputsValues.slice() : null;
    });

    // Expect inputsValues to contain the changed value ('42')
    expect(inputsValues).not.toBeNull();
    // There should be at least one entry and it should include '42'
    expect(inputsValues.length).toBeGreaterThanOrEqual(1);
    expect(inputsValues).toContain('42');

    // Ensure no runtime page errors occurred during a simple input change
    expect(pageErrors.length).toBe(0);
  });

  test('Transition ButtonClick (individual button) from S0_Idle -> S1_InputReceived: clicking button pushes to inputsValues and sets buttonsClick', async ({ page }) => {
    // Prepare to capture any page errors (none expected for this interaction)
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Click a per-input "Submit" button (e.g., button1)
    await page.click('#button1');

    // Read inputsValues and buttonsClick from the page
    const state = await page.evaluate(() => {
      return {
        inputsValues: Array.isArray(window.inputsValues) ? window.inputsValues.slice() : null,
        buttonsClick: window.buttonsClick ? { ...window.buttonsClick } : null,
      };
    });

    // inputsValues should have at least one entry (the button click pushes something, possibly an empty string)
    expect(state.inputsValues).not.toBeNull();
    expect(state.inputsValues.length).toBeGreaterThanOrEqual(1);

    // buttonsClick should include the clicked button id set to true
    expect(state.buttonsClick).not.toBeNull();
    expect(state.buttonsClick['button1']).toBeTruthy();

    // No page errors expected for this simple click
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_InputReceived -> S2_DecisionMade via submit: clicking submit leads to decision attempt that throws runtime error (assert natural TypeError/pageerror)', async ({ page }) => {
    // This test validates the FSM transition attempting to make a decision.
    // According to the implementation, calling submit may produce runtime exceptions.
    // We capture the pageerror that is expected to occur naturally and assert it was thrown.

    // Make sure there is some input recorded to mimic S1_InputReceived
    await page.fill('#input2', '123');
    await page.dispatchEvent('#input2', 'change');

    // Also click one of the per-input buttons to populate buttonsClick
    await page.click('#button2');

    // Now click the submit button and expect a pageerror to be emitted by the page script.
    // Use Promise.all to race the click and the pageerror capture so we reliably get the error.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#submit'),
    ]);

    // Assert that an error was indeed emitted and it is a TypeError or similar runtime error related to decision logic
    expect(error).toBeTruthy();
    // Error message should be informative about the failure; accept a few likely substrings
    const message = String(error.message || error.toString()).toLowerCase();
    const plausibleIndicators = ['children', 'is not a function', 'cannot read', 'cannot read properties', 'of undefined', 'undefined'];
    const matched = plausibleIndicators.some((ind) => message.includes(ind));
    expect(matched).toBeTruthy();

    // Because makeDecision threw, the result text should not have been updated to a valid "Decision: ..." value.
    const resultText = await page.locator('#result').textContent();
    // It might still be empty or unchanged; ensure it does NOT start with "Decision:".
    expect(resultText && resultText.startsWith('Decision:')).toBeFalsy();
  });

  test('TreeClick event: clicking an element inside #tree that matches the handler branch triggers expected runtime error', async ({ page }) => {
    // This test exercises the TreeClick event and its branch where the handler expects particular classes.
    // We will dynamically add an element inside #tree that has class "input" and id "input1" to trigger the branch.
    // This alters DOM for the purpose of testing interactions (not modifying JS functions).
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));

    // Inject a child element inside the #tree container to act as the target for the click handler
    await page.evaluate(() => {
      const tree = document.getElementById('tree');
      if (!tree) return;
      const child = document.createElement('div');
      // The handler checks classList.contains('input') - give it that class and an id that exists among inputs
      child.className = 'input';
      child.id = 'input1';
      child.textContent = 'synthetic-input-target';
      child.style.width = '50px';
      child.style.height = '20px';
      child.style.background = 'transparent';
      tree.appendChild(child);
    });

    // Click the injected element and await the runtime pageerror that the handler will produce
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#tree .input'),
    ]);

    // Assert an error was thrown by the tree click handler (likely TypeError due to NodeList.filter usage)
    expect(err).toBeTruthy();
    const msg = String(err.message || err.toString()).toLowerCase();

    // The known bad code uses inputs.filter -> this typically produces "inputs.filter is not a function"
    // Accept messages containing 'filter' or related type error substrings
    const expectedSubstrings = ['filter', 'is not a function', 'cannot read', 'of undefined'];
    const found = expectedSubstrings.some((s) => msg.includes(s));
    expect(found).toBeTruthy();
  });

  test('Edge case: clicking submit with no prior inputs/buttons (fresh state) still results in runtime error (verify natural failure)', async ({ page }) => {
    // This validates an edge case mentioned in requirements: submit when inputsValues is empty.
    // Expectation: the page's decision-making code throws naturally; we assert that pageerror occurs.
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#submit'),
    ]);

    // There should be a runtime error; assert its presence and that it looks like the decision code failed
    expect(err).toBeTruthy();
    const errMsg = String(err.message || err.toString()).toLowerCase();
    const indicators = ['children', 'is not a function', 'cannot read', 'of undefined'];
    expect(indicators.some((ind) => errMsg.includes(ind))).toBeTruthy();

    // result area should remain empty or not indicate a successful decision
    const text = await page.locator('#result').textContent();
    expect(text && text.startsWith('Decision:')).toBeFalsy();
  });
});