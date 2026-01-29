import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2fbf1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Indexing Demo
class IndexingDemoPage {
  constructor(page) {
    this.page = page;
    this.indexSelector = 'input#indexInput';
    this.buttonSelector = 'button[onclick="showIndexedElement()"]';
    this.resultSelector = 'div#result';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Read attributes of the input element
  async getInputAttributes() {
    return await this.page.$eval(this.indexSelector, (el) => {
      return {
        value: el.value,
        type: el.type,
        min: el.min,
        max: el.max,
      };
    });
  }

  // Set the index input using page.fill (works for numeric strings)
  async setIndex(value) {
    // Use evaluate to set value in all cases (handles non-numeric input)
    await this.page.evaluate(
      (sel, val) => {
        const el = document.querySelector(sel);
        el.value = val;
        // Dispatch input event to simulate user interaction
        const evt = new Event('input', { bubbles: true });
        el.dispatchEvent(evt);
      },
      this.indexSelector,
      String(value)
    );
  }

  async clickShow() {
    await this.page.click(this.buttonSelector);
  }

  async getResultText() {
    return await this.page.$eval(this.resultSelector, (el) => el.textContent);
  }

  async getResultInnerHTML() {
    return await this.page.$eval(this.resultSelector, (el) => el.innerHTML);
  }

  async getResultInlineColor() {
    // Return the inline style color (as set by JavaScript: 'red' or 'black')
    return await this.page.$eval(this.resultSelector, (el) => el.style.color);
  }

  async isResultEmpty() {
    const text = await this.getResultText();
    return !text || text.trim() === '';
  }
}

test.describe('JavaScript Indexing Demonstration - FSM states and transitions', () => {
  // Containers for console messages and page errors observed during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture runtime errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Utility to assert no runtime console errors or page errors occurred
  async function assertNoRuntimeErrors() {
    // Filter console messages for errors
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');

    // Provide helpful diagnostics in assertion messages if any errors were captured
    expect(consoleErrors, `Expected no console.error messages, but found: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
    expect(pageErrors, `Expected no page errors, but found: ${pageErrors.map(e => e.toString()).join('\n')}`).toEqual([]);
  }

  test('Initial Idle state (S0_Idle) renders input, button and empty result', async ({ page }) => {
    // This test validates the Idle state: input exists with correct attributes, button exists,
    // and the result container is initially empty. It also observes runtime errors on load.
    const demo = new IndexingDemoPage(page);
    await demo.goto();

    // Verify input attributes (value, type, min, max)
    const attrs = await demo.getInputAttributes();
    expect(attrs.type).toBe('number');
    expect(attrs.min).toBe('0');
    expect(attrs.max).toBe('4');
    // The value attribute in DOM is "0" initially per HTML
    expect(attrs.value).toBe('0');

    // Verify button exists and has expected text content
    const buttonText = await page.$eval(demo.buttonSelector, (b) => b.textContent?.trim());
    expect(buttonText).toBe('Show element at index');

    // Verify result div is empty on initial render (Idle state)
    const isEmpty = await demo.isResultEmpty();
    expect(isEmpty).toBe(true);

    // Ensure no runtime errors or exceptions occurred during page load
    await assertNoRuntimeErrors();
  });

  test('Transition to S1_InvalidIndex: negative index shows error message and red color', async ({ page }) => {
    // This test validates the transition from Idle to Invalid Index when user enters -1 and clicks.
    const demo1 = new IndexingDemoPage(page);
    await demo.goto();

    // Set index to -1 (invalid)
    await demo.setIndex(-1);

    // Click the "Show element at index" button
    await demo.clickShow();

    // Expect the error message prompting valid index
    const resultText = await demo.getResultText();
    expect(resultText).toBe('Please enter a valid index between 0 and 4.');

    // The JS sets inline style color to 'red' on invalid input
    const inlineColor = await demo.getResultInlineColor();
    expect(inlineColor).toBe('red');

    // No unexpected runtime errors should have occurred
    await assertNoRuntimeErrors();
  });

  test('Transition to S1_InvalidIndex: index greater than max shows error message and red color', async ({ page }) => {
    // This test validates the transition to Invalid Index when user enters 5 (out of bounds) and clicks.
    const demo2 = new IndexingDemoPage(page);
    await demo.goto();

    // Set index to 5 (invalid because max is 4)
    await demo.setIndex(5);

    // Click the show button
    await demo.clickShow();

    // Validate error message and red inline style
    const resText = await demo.getResultText();
    expect(resText).toBe('Please enter a valid index between 0 and 4.');
    const color = await demo.getResultInlineColor();
    expect(color).toBe('red');

    await assertNoRuntimeErrors();
  });

  test('Transition to S1_InvalidIndex: non-numeric input produces invalid index error', async ({ page }) => {
    // This test checks an edge case where input is set to a non-numeric string like 'abc',
    // which should result in NaN and thus trigger the Invalid Index behavior.
    const demo3 = new IndexingDemoPage(page);
    await demo.goto();

    // Set input to a non-numeric string via evaluate to bypass numeric input restrictions
    await demo.setIndex('abc');

    // Click button
    await demo.clickShow();

    // Expect invalid index error and red styling
    const text1 = await demo.getResultText();
    expect(text).toBe('Please enter a valid index between 0 and 4.');
    const color1 = await demo.getResultInlineColor();
    expect(color).toBe('red');

    await assertNoRuntimeErrors();
  });

  test('Transition to S2_ValidIndex: valid index displays expected element with black text', async ({ page }) => {
    // This test validates that entering a valid index (2) transitions to the Valid Index state,
    // updates the result with strong/code formatting, and sets inline color to black.
    const demo4 = new IndexingDemoPage(page);
    await demo.goto();

    // Set index to 2 (should map to "Cherry")
    await demo.setIndex(2);

    // Click the button to trigger the ShowElement event
    await demo.clickShow();

    // Validate inline style color is set to 'black'
    const color2 = await demo.getResultInlineColor();
    expect(color).toBe('black');

    // Validate innerHTML matches the expected template
    const inner = await demo.getResultInnerHTML();
    // Expect exact HTML produced by the function
    expect(inner).toBe('<strong>fruits[2]</strong> is: <code>Cherry</code>');

    await assertNoRuntimeErrors();
  });

  test('Input change does not auto-trigger ShowElement: must click to see result', async ({ page }) => {
    // This test validates the FSM expectation that changing the input alone doesn't trigger
    // the transition; the user must click the button to invoke showIndexedElement().
    const demo5 = new IndexingDemoPage(page);
    await demo.goto();

    // Ensure initial result is empty
    expect(await demo.isResultEmpty()).toBe(true);

    // Change input to 3 but do NOT click the button
    await demo.setIndex(3);

    // Give a short pause to ensure no background handlers unexpectedly run
    await page.waitForTimeout(200);

    // Result should remain empty (no automatic transition on input event)
    const stillEmpty = await demo.isResultEmpty();
    expect(stillEmpty).toBe(true);

    // Now click to verify that clicking triggers the transition and shows the element
    await demo.clickShow();
    const inner1 = await demo.getResultInnerHTML();
    expect(inner).toBe('<strong>fruits[3]</strong> is: <code>Date</code>');

    await assertNoRuntimeErrors();
  });

  test('Repeated clicks and consecutive transitions behave deterministically', async ({ page }) => {
    // This test verifies that multiple sequential interactions produce correct transitions
    // and that state is appropriately updated each time without side-effects.
    const demo6 = new IndexingDemoPage(page);
    await demo.goto();

    // Click with default value 0 -> should show Apple
    await demo.clickShow();
    expect(await demo.getResultInnerHTML()).toBe('<strong>fruits[0]</strong> is: <code>Apple</code>');
    expect(await demo.getResultInlineColor()).toBe('black');

    // Now set an invalid value -1 and click -> invalid message
    await demo.setIndex(-1);
    await demo.clickShow();
    expect(await demo.getResultText()).toBe('Please enter a valid index between 0 and 4.');
    expect(await demo.getResultInlineColor()).toBe('red');

    // Set a valid value 4 and click -> Elderberry
    await demo.setIndex(4);
    await demo.clickShow();
    expect(await demo.getResultInnerHTML()).toBe('<strong>fruits[4]</strong> is: <code>Elderberry</code>');
    expect(await demo.getResultInlineColor()).toBe('black');

    await assertNoRuntimeErrors();
  });

  test('No runtime errors on initial page load (observing console and page errors)', async ({ page }) => {
    // This test specifically observes console and page errors immediately after load
    // and asserts that none occurred. The test captures any ReferenceError, SyntaxError,
    // TypeError, or other runtime exceptions that happen naturally on page load.
    const demo7 = new IndexingDemoPage(page);
    await demo.goto();

    // Short wait to allow any potential async errors to surface
    await page.waitForTimeout(200);

    // Assert there were no console.error messages or page errors
    await assertNoRuntimeErrors();
  });
});