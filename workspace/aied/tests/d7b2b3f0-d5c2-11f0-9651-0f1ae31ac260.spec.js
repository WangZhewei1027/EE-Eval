import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b2b3f0-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the Set demo app
class SetDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.elementInput = '#elementInput';
    this.addBtn = '#addBtn';
    this.clearBtn = '#clearBtn';
    this.checkInput = '#checkInput';
    this.checkBtn = '#checkBtn';
    this.deleteInput = '#deleteInput';
    this.deleteBtn = '#deleteBtn';
    this.demoBtn = '#demoBtn';
    this.setOutput = '#setOutput';
    this.messageOutput = '#messageOutput';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Adds an element via the UI
  async addElement(value) {
    await this.page.fill(this.elementInput, value);
    await this.page.click(this.addBtn);
  }

  // Clears the set
  async clearSet() {
    await this.page.click(this.clearBtn);
  }

  // Checks membership for a value
  async checkMembership(value) {
    await this.page.fill(this.checkInput, value);
    await this.page.click(this.checkBtn);
  }

  // Deletes an element
  async deleteElement(value) {
    await this.page.fill(this.deleteInput, value);
    await this.page.click(this.deleteBtn);
  }

  // Runs demo operations
  async runDemo() {
    await this.page.click(this.demoBtn);
  }

  // Returns the textual content of the set output
  async getSetOutputText() {
    return (await this.page.locator(this.setOutput).innerText()).trim();
  }

  // Returns the textual content of the message output
  async getMessageText() {
    return (await this.page.locator(this.messageOutput).innerText());
  }

  // Returns the computed color style of the message output as the browser reports it (rgb(...))
  async getMessageColor() {
    return await this.page.$eval(this.messageOutput, el => {
      return window.getComputedStyle(el).color;
    });
  }

  // Utility to assert no page errors or console errors recorded
  static assertNoErrors(consoleMessages, pageErrors) {
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
    expect(consoleErrors.length, 'No console errors/warnings should be emitted').toBe(0);
  }
}

test.describe('JavaScript Set Demo (FSM states and transitions)', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // reset collectors for each test
    consoleMessages = [];
    pageErrors = [];

    // collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // collect uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial state (S0_Idle) -> UI initializes to empty Set', async ({ page }) => {
    // Validate that on load the app shows (Set is empty) and no messages
    const app = new SetDemoPage(page);
    await app.goto();

    const setText = await app.getSetOutputText();
    expect(setText).toBe('(Set is empty)');

    const msgText = await app.getMessageText();
    expect(msgText).toBe('');

    // Ensure no runtime errors were thrown during initialization
    SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
  });

  test.describe('Add Element transitions', () => {
    test('Add element (S0 -> S1_ElementAdded): adding "apple" shows added message and updates set output', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Add "apple"
      await app.addElement('"apple"'); // pass a quoted string so parseValue interprets as string via JSON.parse
      // The app JSON.stringify the value when showing messages,
      // since we used "\"apple\"" the JSON.stringify of string will be "\"apple\"" then displayed as "apple" with quotes.
      const msg = await app.getMessageText();
      expect(msg).toContain('Added element'); // message indicates element added
      // Expect message contains "apple"
      expect(msg).toContain('apple');

      // Message color should be green (browser reports as rgb(0, 128, 0))
      const color = await app.getMessageColor();
      expect(color).toBe('rgb(0, 128, 0)');

      // Set output should include the JSON-stringified element "apple" (with quotes)
      const setText = await app.getSetOutputText();
      expect(setText).toContain('"apple"');

      // Input cleared
      const elementInputValue = await page.$eval('#elementInput', el => el.value);
      expect(elementInputValue).toBe('');

      // No runtime errors occurred
      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });

    test('Add duplicate (S0 -> S2_ElementAlreadyExists): adding duplicate triggers error-style message and does not increase set', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // First add apple
      await app.addElement('"apple"');
      const beforeSetText = await app.getSetOutputText();
      expect(beforeSetText).toContain('"apple"');

      // Try adding duplicate apple
      await app.addElement('"apple"');
      const msg = await app.getMessageText();
      expect(msg).toContain('Element already exists in the Set');

      // Error style: red -> rgb(255, 0, 0)
      const color = await app.getMessageColor();
      expect(color).toBe('rgb(255, 0, 0)');

      // Ensure set still only has one "apple"
      const setText = await app.getSetOutputText();
      // Should still contain "apple" once; check that no unexpected additional values added
      expect(setText.split('"apple"').length - 1).toBe(1);

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });
  });

  test.describe('Clear Set transition (S0 -> S3_SetCleared)', () => {
    test('Clear set empties the set and shows "Set cleared." message', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Add some elements first
      await app.addElement('"pear"');
      expect((await app.getSetOutputText())).toContain('"pear"');

      // Clear
      await app.clearSet();

      // Set output should reflect empty set
      expect((await app.getSetOutputText())).toBe('(Set is empty)');

      // Message should be present and green
      expect((await app.getMessageText())).toBe('Set cleared.');
      const color = await app.getMessageColor();
      expect(color).toBe('rgb(0, 128, 0)');

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });
  });

  test.describe('Check Membership transitions (S0 -> S4_MembershipChecked)', () => {
    test('Check membership for existing and non-existing elements', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Add banana
      await app.addElement('"banana"');
      expect((await app.getSetOutputText())).toContain('"banana"');

      // Check banana (should be found)
      await app.checkMembership('"banana"');
      let msg = await app.getMessageText();
      expect(msg).toContain('Set HAS element:');
      expect(msg).toContain('banana');
      expect(await app.getMessageColor()).toBe('rgb(0, 128, 0)');

      // Check grape (should not be found)
      await app.checkMembership('"grape"');
      msg = await app.getMessageText();
      expect(msg).toContain('Set DOES NOT have element:');
      expect(msg).toContain('grape');
      expect(await app.getMessageColor()).toBe('rgb(255, 0, 0)');

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });

    test('Check membership with empty input yields validation error', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Click check without filling input
      await page.click('#checkBtn');
      const msg = await app.getMessageText();
      expect(msg).toBe('Please enter a valid element to check.');
      expect(await app.getMessageColor()).toBe('rgb(255, 0, 0)');

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });
  });

  test.describe('Delete Element transitions (S0 -> S5_ElementDeleted, S6_ElementNotFound)', () => {
    test('Delete existing element removes it and shows deleted message', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Add numeric 42 (enter as 42 so parseValue makes it Number)
      await app.addElement('42');
      // Set output should include 42 (stringified as 42)
      let setText = await app.getSetOutputText();
      expect(setText).toContain('42');

      // Delete 42
      await app.deleteElement('42');
      const msg = await app.getMessageText();
      expect(msg).toContain('Deleted element:');
      expect(msg).toContain('42');

      // After deletion, set should be empty
      setText = await app.getSetOutputText();
      expect(setText).toBe('(Set is empty)');

      // Message color green
      expect(await app.getMessageColor()).toBe('rgb(0, 128, 0)');

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });

    test('Delete non-existing element shows not found message', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Ensure set empty
      expect(await app.getSetOutputText()).toBe('(Set is empty)');

      // Attempt delete a value not present
      await app.deleteElement('"doesNotExist"');
      const msg = await app.getMessageText();
      expect(msg).toContain('Element not found in Set:');
      expect(msg).toContain('doesNotExist');
      // Error color red
      expect(await app.getMessageColor()).toBe('rgb(255, 0, 0)');

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });

    test('Delete with empty input yields validation error', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Click delete without filling input
      await page.click('#deleteBtn');
      const msg = await app.getMessageText();
      expect(msg).toBe('Please enter a valid element to delete.');
      expect(await app.getMessageColor()).toBe('rgb(255, 0, 0)');

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });
  });

  test.describe('Run Demo Operations transition (S0 -> S7_DemoCompleted)', () => {
    test('Run demo populates set, outputs demo messages, and shows Demo completed', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Click demo button
      await app.runDemo();

      // messageOutput should include the demo multi-line output
      const msg = await app.getMessageText();
      expect(msg).toContain('Initial elements added to Set:');
      expect(msg).toContain('Try adding duplicate "apple":');
      expect(msg).toContain('Final Set elements:');

      // message color should be #333 -> rgb(51, 51, 51)
      expect(await app.getMessageColor()).toBe('rgb(51, 51, 51)');

      // setOutput should list elements (not be empty)
      const setText = await app.getSetOutputText();
      expect(setText).not.toBe('(Set is empty)');
      // Expect at least '\"apple\"' and '\"banana\"' or numeric 42 present in output
      expect(setText.length).toBeGreaterThan(0);

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });
  });

  test.describe('Edge cases and input validation', () => {
    test('Adding empty input shows validation error', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Ensure elementInput empty and click add
      await page.fill('#elementInput', '');
      await page.click('#addBtn');

      const msg = await app.getMessageText();
      expect(msg).toBe('Please enter a valid element to add.');
      expect(await app.getMessageColor()).toBe('rgb(255, 0, 0)');

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });

    test('Parsing different types: boolean, null, array, object are handled and displayed', async ({ page }) => {
      const app = new SetDemoPage(page);
      await app.goto();

      // Add true (unquoted)
      await app.addElement('true');
      expect((await app.getMessageText())).toContain('Added element');
      expect((await app.getSetOutputText())).toContain('true'); // JSON.stringify(true) => true

      // Add null
      await app.addElement('null');
      expect((await app.getSetOutputText())).toContain('null');

      // Add array [1,2]
      await app.addElement('[1,2]');
      expect((await app.getSetOutputText())).toContain('[1,2]');

      // Add object {"a":1}
      await app.addElement('{"a":1}');
      const out = await app.getSetOutputText();
      // JSON.stringify on the object will produce {"a":1} as part of string; ensure its presence
      expect(out).toContain('{"a":1}');

      SetDemoPage.assertNoErrors(consoleMessages, pageErrors);
    });
  });
});