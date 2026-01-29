import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d52670-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the Set demo app
class SetDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.addBtn = page.locator('#addBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.hasBtn = page.locator('#hasBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.addSameObjectBtn = page.locator('#addSameObjectBtn');
    this.fromArrayBtn = page.locator('#fromArrayBtn');
    this.toArrayBtn = page.locator('#toArrayBtn');
    this.copyArrayBtn = page.locator('#copyArrayBtn');
    this.unionExample = page.locator('#unionExample');
    this.intersectionExample = page.locator('#intersectionExample');
    this.differenceExample = page.locator('#differenceExample');
    this.opsResult = page.locator('#opsResult');
    this.setDisplay = page.locator('#setDisplay');
    this.sizeEl = page.locator('#size');
    this.logEl = page.locator('#log');
    this.asNumberRadio = page.locator('#asNumber');
    this.asJSONRadio = page.locator('#asJSON');
    this.stringRadio = page.locator('#typeSelect'); // note: this is a radio using id 'typeSelect' in the page
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clearInput() {
    await this.input.fill('');
  }

  // Choose input type: 'string'|'number'|'json'
  async chooseType(type) {
    if (type === 'number') {
      await this.asNumberRadio.check();
    } else if (type === 'json') {
      await this.asJSONRadio.check();
    } else {
      // default string radio is the one with id 'typeSelect'
      await this.stringRadio.check();
    }
  }

  async addValue(value) {
    await this.input.fill(String(value));
    await this.addBtn.click();
  }

  async deleteValue(value) {
    await this.input.fill(String(value));
    await this.deleteBtn.click();
  }

  async hasValue(value) {
    await this.input.fill(String(value));
    await this.hasBtn.click();
  }

  async clearSet() {
    await this.clearBtn.click();
  }

  async addSameObject() {
    await this.addSameObjectBtn.click();
  }

  async createFromArray() {
    await this.fromArrayBtn.click();
  }

  async toArray() {
    await this.toArrayBtn.click();
  }

  async copyArray() {
    await this.copyArrayBtn.click();
  }

  async runUnion() {
    await this.unionExample.click();
  }

  async runIntersection() {
    await this.intersectionExample.click();
  }

  async runDifference() {
    await this.differenceExample.click();
  }

  async pressEnterInInput() {
    await this.input.press('Enter');
  }

  // Helpers to inspect UI
  async getSizeText() {
    return (await this.sizeEl.textContent()).trim();
  }

  async getOpsResultText() {
    return (await this.opsResult.textContent()).trim();
  }

  async lastLogText() {
    // log lines are prepended; first child is the most recent
    const firstChild = this.logEl.locator('div').first();
    if (await firstChild.count() === 0) return '';
    return (await firstChild.textContent()).trim();
  }

  async allLogText() {
    const nodes = this.logEl.locator('div');
    const count = await nodes.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await nodes.nth(i).textContent()).trim());
    }
    return texts;
  }

  async memberCount() {
    return await this.setDisplay.locator('.member').count();
  }

  async memberTexts() {
    const items = this.setDisplay.locator('.member');
    const count = await items.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await items.nth(i).innerText()).trim());
    }
    return texts;
  }
}

test.describe('JavaScript Set — Interactive Demo (d3d52670-fa73-11f0-83e0-8d7be1d51901)', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    dialogs = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture dialogs (alerts) so tests can continue and we can assert they occur
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      try {
        await dialog.accept();
      } catch {
        // ignore accept failure
      }
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected runtime errors (ReferenceError, SyntaxError, TypeError).
    // If any page errors occurred, fail the test and print them for diagnostics.
    const serious = pageErrors.filter(e =>
      e instanceof Error && (
        e.name === 'ReferenceError' ||
        e.name === 'SyntaxError' ||
        e.name === 'TypeError'
      )
    );
    if (serious.length > 0) {
      // Throw to fail the test with visibility into errors
      throw new Error('Found serious page errors: ' + serious.map(e => `${e.name}: ${e.message}`).join('; '));
    }
  });

  test.describe('Initialization and Idle state (S0_Idle)', () => {
    test('initial UI shows size 0 and initial logs exist', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Verify initial elements and state
      await expect(app.sizeEl).toHaveText('0');
      const memberCount = await app.memberCount();
      expect(memberCount).toBe(0);

      // The page script logs a ready message and NaN uniqueness on load; ensure logs exist
      const logs = await app.allLogText();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      // Most recent log should include 'NaN uniqueness' or 'Demo ready' as they are produced at init
      const foundInit = logs.some(t => /Demo ready|NaN uniqueness/.test(t));
      expect(foundInit).toBeTruthy();
    });
  });

  test.describe('Basic Set operations (transitions to S1_SetModified)', () => {
    test('Add a string value to the Set (AddToSet) and observe UI and logs', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Add a string - default radio is string
      await app.clearInput();
      await app.addValue('hello');

      // Size should update
      await expect(app.sizeEl).toHaveText('1');

      // Member display should show the value and type 'string'
      const members = await app.memberTexts();
      expect(members.length).toBeGreaterThanOrEqual(1);
      const first = members[0];
      expect(first).toMatch(/#0/);
      expect(first).toMatch(/hello/);
      expect(first).toMatch(/string/);

      // Most recent log should include the add action
      const lastLog = await app.lastLogText();
      expect(lastLog).toMatch(/add/);
      expect(lastLog).toMatch(/hello/);
    });

    test('Check existence of a value (CheckExistence) logs result', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Ensure 'hello' exists first
      await app.clearInput();
      await app.addValue('hello');

      // Check has?
      await app.hasValue('hello');

      const last = await app.lastLogText();
      expect(last).toMatch(/has/);
      expect(last).toMatch(/hello/);
      expect(last).toMatch(/true/);
    });

    test('Delete a value from the Set (DeleteFromSet) updates display and logs', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Add then delete
      await app.clearInput();
      await app.addValue('hello');
      await expect(app.sizeEl).toHaveText('1');

      await app.deleteValue('hello');

      // Size should drop back to 0
      await expect(app.sizeEl).toHaveText('0');

      // Display should have no members
      expect(await app.memberCount()).toBe(0);

      // Log should contain 'delete' and 'false' or 'true' for removal; ensure delete logged
      const last = await app.lastLogText();
      expect(last).toMatch(/delete/);
      expect(last).toMatch(/hello/);
    });

    test('Pressing Enter in input triggers add (UX keybinding)', async ({ page }) => {
      const app = new SetDemoPage(page);

      await app.clearInput();
      await app.input.fill('enterTest');
      await app.pressEnterInInput();

      await expect(app.sizeEl).toHaveText('1');
      const last = await app.lastLogText();
      expect(last).toMatch(/add/);
      expect(last).toMatch(/enterTest/);
    });
  });

  test.describe('Type handling and conversions', () => {
    test('Add a number value by selecting number radio and convert Set to Array', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Ensure clean state
      await app.clearSet();

      // Add number 42 via number radio
      await app.chooseType('number');
      await app.clearInput();
      await app.addValue('42');

      await expect(app.sizeEl).toHaveText('1');
      const memberTexts = await app.memberTexts();
      expect(memberTexts.some(t => t.includes('42') && /number/.test(t))).toBeTruthy();

      // Convert Set to Array and check opsResult and log
      await app.toArray();
      const opsText = await app.getOpsResultText();
      expect(opsText).toMatch(/Set → Array/);
      // Log should contain 'set to array'
      const lastLog = await app.lastLogText();
      expect(lastLog).toMatch(/set to array/);
    });

    test('Attempt to add invalid JSON shows an alert (error scenario)', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Choose JSON type and input invalid JSON
      await app.chooseType('json');
      await app.clearInput();
      await app.input.fill('{invalid:}');

      // Click add; parseInput will alert and throw, the handler catches it.
      await app.addBtn.click();

      // We expect a dialog (alert) to have been shown
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const foundInvalidJson = dialogs.some(msg => /Invalid JSON/i.test(msg));
      expect(foundInvalidJson).toBeTruthy();

      // No element should be added
      expect(await app.sizeEl.textContent()).toMatch(/0/);
    });

    test('Add same object twice demonstrates reference identity (AddSameObject)', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Clear set to start fresh
      await app.clearSet();
      await expect(app.sizeEl).toHaveText('0');

      // Add two distinct objects with same content
      await app.addSameObject();

      // Both objects should appear (different references) => size should be 2
      await expect(app.sizeEl).toHaveText('2');

      const members = await app.memberTexts();
      expect(members.length).toBeGreaterThanOrEqual(2);
      // Both entries should show object representation and badge 'object'
      expect(members[0]).toMatch(/object/);
      expect(members[1]).toMatch(/object/);

      // Log contains the explanatory message
      const last = await app.lastLogText();
      expect(last).toMatch(/added two distinct objects/);
    });

    test('Create Set from array (dedupe) populates demoSet and logs result', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Click the From Array example
      await app.createFromArray();

      // The example array should dedupe into Set size 7 (1,2,3,4,'a','b', NaN)
      await expect(app.sizeEl).toHaveText('7');

      const last = await app.lastLogText();
      expect(last).toMatch(/fromArray \(dedupe\):/);
      // opsResult isn't changed by this action; display should have several members
      expect(await app.memberCount()).toBeGreaterThanOrEqual(6);
    });
  });

  test.describe('Clipboard interaction and copy behavior', () => {
    test('Copy array to clipboard either logs success or triggers alert (CopyArrayToClipboard)', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Ensure some content exists in the set
      await app.clearSet();
      await app.chooseType('number');
      await app.addValue('1');
      await app.addValue('2');

      // Try to copy; depending on environment clipboard may fail (alert), or succeed (log)
      await app.copyArray();

      // Accept either: a log entry 'copied to clipboard:' OR an alert dialog indicating failure
      const logs = await app.allLogText();
      const copiedLog = logs.find(t => /copied to clipboard:/.test(t));
      const copyAlert = dialogs.find(d => /Copy failed|Copy failed:/.test(d) || /copied to clipboard/.test(d));

      expect(copiedLog || copyAlert).toBeTruthy();
    });
  });

  test.describe('Set operations examples (Union/Intersection/Difference)', () => {
    test('Union example produces expected result and logs (UnionExample)', async ({ page }) => {
      const app = new SetDemoPage(page);

      await app.runUnion();

      // The ops result should include Union = [1,2,3,4,5,6]
      const ops = await app.getOpsResultText();
      expect(ops).toMatch(/Union =/);
      expect(ops).toMatch(/\[1,2,3,4,5,6\]/);

      // Log should include union message
      const last = await app.lastLogText();
      expect(last).toMatch(/union A,B =>/);
      expect(last).toMatch(/\[1,2,3,4,5,6\]/);
    });

    test('Intersection example produces expected result and logs (IntersectionExample)', async ({ page }) => {
      const app = new SetDemoPage(page);

      await app.runIntersection();

      const ops = await app.getOpsResultText();
      expect(ops).toMatch(/Intersection =/);
      expect(ops).toMatch(/\[3,4\]/);

      const last = await app.lastLogText();
      expect(last).toMatch(/intersection A,B =>/);
      expect(last).toMatch(/\[3,4\]/);
    });

    test('Difference example produces expected result and logs (DifferenceExample)', async ({ page }) => {
      const app = new SetDemoPage(page);

      await app.runDifference();

      const ops = await app.getOpsResultText();
      expect(ops).toMatch(/Difference A \\ B =/);
      expect(ops).toMatch(/\[1,2\]/);

      const last = await app.lastLogText();
      expect(last).toMatch(/difference A \\ B =>/);
      expect(last).toMatch(/\[1,2\]/);
    });
  });

  test.describe('Clear Set (transition S1_SetModified -> S0_Idle)', () => {
    test('Clearing the Set resets size and logs clear action', async ({ page }) => {
      const app = new SetDemoPage(page);

      // Populate set with some items
      await app.clearSet();
      await app.addValue('one');
      await app.addValue('two');
      await expect(app.sizeEl).toHaveText('2');

      // Clear the set and observe
      await app.clearSet();
      await expect(app.sizeEl).toHaveText('0');
      expect(await app.memberCount()).toBe(0);

      // Log contains 'clear set'
      const last = await app.lastLogText();
      expect(last).toMatch(/clear set/);
    });
  });

  test.describe('Error and console observation', () => {
    test('Ensure no unexpected ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
      // This test intentionally relies on the afterEach to throw if such errors occurred.
      // We still assert here that collected console errors are empty or benign.
      const seriousConsoleErrors = consoleMessages.filter(m => m.type === 'error');
      // We allow console errors to exist but validate they are not uncaught runtime exceptions (they may include warnings).
      // Fail if a console message obviously contains ReferenceError/SyntaxError/TypeError text.
      const fatal = seriousConsoleErrors.filter(m =>
        /ReferenceError|SyntaxError|TypeError/.test(m.text)
      );
      expect(fatal.length).toBe(0);
    });
  });
});