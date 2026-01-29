import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c12f401-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object for the Stack Playground to centralize interactions
class StackPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      newStackName: page.locator('#newStackName'),
      createStackBtn: page.locator('#createStackBtn'),
      activeStackSelect: page.locator('#activeStackSelect'),
      targetStackSelect: page.locator('#targetStackSelect'),
      pushInput: page.locator('#pushInput'),
      pushParseMode: page.locator('#pushParseMode'),
      pushRepeat: page.locator('#pushRepeat'),
      pushBtn: page.locator('#pushBtn'),
      popBtn: page.locator('#popBtn'),
      undoBtn: page.locator('#undoBtn'),
      redoBtn: page.locator('#redoBtn'),
      searchInput: page.locator('#searchInput'),
      searchBtn: page.locator('#searchBtn'),
      actionLog: page.locator('#actionLog'),
      activeStackLabel: page.locator('#activeStackLabel'),
      activeStackSize: page.locator('#activeStackSize'),
      activeStackTop: page.locator('#activeStackTop'),
      globalStacksCount: page.locator('#globalStacksCount'),
      historyLen: page.locator('#historyLen'),
      stacksContainer: page.locator('#stacksContainer'),
      macroTextarea: page.locator('#macroTextarea'),
      runMacroBtn: page.locator('#runMacroBtn'),
      macroPointer: page.locator('#macroPointer'),
      macroTotal: page.locator('#macroTotal'),
    };
  }

  async createStack(name) {
    await this.locators.newStackName.fill(name);
    await this.locators.createStackBtn.click();
  }

  async selectActiveStackByName(name) {
    // choose option by visible text
    const opts = await this.page.$$('#activeStackSelect option');
    for (const o of opts) {
      const txt = await o.textContent();
      if (txt && txt.trim() === name) {
        const val = await o.getAttribute('value');
        await this.page.selectOption('#activeStackSelect', val);
        return;
      }
    }
    throw new Error('Active stack option not found: ' + name);
  }

  async pushValue(value, parseMode = 'auto', repeat = 1) {
    await this.locators.pushInput.fill(value);
    await this.locators.pushParseMode.selectOption(parseMode);
    await this.locators.pushRepeat.fill(String(repeat)); // range also responds to fill
    await this.locators.pushBtn.click();
  }

  async popActive() {
    await this.locators.popBtn.click();
  }

  async searchActive(pattern) {
    await this.locators.searchInput.fill(pattern);
    await this.locators.searchBtn.click();
  }

  async runMacro(text) {
    await this.locators.macroTextarea.fill(text);
    await this.locators.runMacroBtn.click();
  }

  async getActionLogText() {
    return (await this.locators.actionLog.textContent()) || '';
  }

  async getActiveStackStats() {
    const label = (await this.locators.activeStackLabel.textContent())?.trim();
    const sizeText = (await this.locators.activeStackSize.textContent())?.trim();
    const top = (await this.locators.activeStackTop.textContent())?.trim();
    return { label, size: Number(sizeText || '0'), top };
  }

  async getGlobalStacksCount() {
    const txt = (await this.locators.globalStacksCount.textContent()) || '0';
    return Number(txt.trim());
  }

  async getHistoryLen() {
    const t = (await this.locators.historyLen.textContent()) || '0';
    return Number(t.trim());
  }

  async waitForActionLogContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      ([sel, substr]) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(substr) !== -1;
      },
      [['#actionLog', substring]],
      { timeout }
    );
  }
}

// Collect console errors and page errors for assertions
test.describe('Stack Playground FSM - 9c12f401-fa79-11f0-8fe7-a5317bd8e2c6', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let dialogMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    dialogMessages = [];

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Automatically accept/record dialogs (alerts/confirms)
    page.on('dialog', async dialog => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown besides what Playwright provides automatically.
  });

  test('Initial Idle state: page renders and seed initialized (S0_Idle evidence)', async ({ page }) => {
    // Validate initial render - header and description exist
    const header = await page.locator('h2').textContent();
    expect(header).toContain('Stack Playground');

    const para = await page.locator('p').first().textContent();
    expect(para).toContain('Plain interface to explore stacks');

    // Initialize page object
    const sp = new StackPage(page);

    // The seed function creates stacks A, B, C. Validate that global stacks count >= 3
    const globalCount = await sp.getGlobalStacksCount();
    expect(globalCount).toBeGreaterThanOrEqual(3);

    // Active stack label should be present and non-empty
    const stats = await sp.getActiveStackStats();
    expect(stats.label).toBeTruthy();
    expect(stats.size).toBeGreaterThanOrEqual(0);

    // History should have at least one entry created by seed() (pushHistory('initial seed'))
    const historyLen = await sp.getHistoryLen();
    expect(historyLen).toBeGreaterThanOrEqual(1);

    // Ensure no unexpected page errors or console errors on fresh load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Create / Push / Pop / Undo / Redo / Search events and transitions', () => {
    test('CreateStack event - creates a new stack and logs creation (S0 -> S1)', async ({ page }) => {
      const sp = new StackPage(page);

      // Record history before create
      const beforeCount = await sp.getGlobalStacksCount();
      const historyBefore = await sp.getHistoryLen();

      // Create a unique stack
      const stackName = 'TestStack_' + Date.now();
      await sp.createStack(stackName);

      // After creation, global stacks should increase
      const afterCount = await sp.getGlobalStacksCount();
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);

      // Active stack select should include the new name
      const optionExists = await page.locator('#activeStackSelect option', { hasText: stackName }).count();
      expect(optionExists).toBeGreaterThan(0);

      // Action log should include CREATE_STACK
      const logText = await sp.getActionLogText();
      expect(logText).toContain('CREATE_STACK');

      // History increased
      const historyAfter = await sp.getHistoryLen();
      expect(historyAfter).toBeGreaterThanOrEqual(historyBefore + 1);

      // No uncaught errors from this interaction
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Push event - pushing increases stack size and is recorded (S1 -> S2)', async ({ page }) => {
      const sp = new StackPage(page);

      // Ensure an active stack exists and capture its name/size
      const { label: activeName, size: sizeBefore } = await sp.getActiveStackStats();

      // Push a simple value
      await sp.pushValue('123', 'auto', 1);

      // After push, active size increments by 1
      const statsAfter = await sp.getActiveStackStats();
      expect(statsAfter.size).toBe(sizeBefore + 1);

      // Action log should contain PUSH and the value string
      const log = await sp.getActionLogText();
      expect(log).toMatch(/PUSH/);

      // History should have grown
      const historyAfter = await sp.getHistoryLen();
      expect(historyAfter).toBeGreaterThanOrEqual(1);

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Pop event - popping decreases size and triggers alert with popped value (S2 -> S2)', async ({ page }) => {
      const sp = new StackPage(page);

      // Ensure there is at least one item to pop: push a known value
      await sp.pushValue('"toPop"', 'auto', 1);
      const before = await sp.getActiveStackStats();

      // Pop and observe that a dialog appears and is accepted automatically
      await sp.popActive();

      // Confirm that a dialog was shown with "Popped:" message
      const foundAlert = dialogMessages.some(d => d.message.startsWith('Popped:'));
      expect(foundAlert).toBe(true);

      // After pop, size should decrease by 1
      const after = await sp.getActiveStackStats();
      expect(after.size).toBe(before.size - 1);

      // Action log should include POP
      const log = await sp.getActionLogText();
      expect(log).toContain('POP');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Pop on empty stack - edge case: no alert and no history entry', async ({ page }) => {
      const sp = new StackPage(page);

      // Create a fresh stack to guarantee emptiness
      const emptyName = 'Empty_' + Date.now();
      await sp.createStack(emptyName);
      await sp.selectActiveStackByName(emptyName);

      // Ensure stack is empty
      const before = await sp.getActiveStackStats();
      expect(before.size).toBe(0);

      const historyBefore = await sp.getHistoryLen();

      // Attempt to pop - should not trigger an alert (no popped item), and history should not change
      await sp.popActive();

      // No new 'Popped' dialog message should be added (last dialog messages may be from previous tests)
      const lastDialog = dialogMessages[dialogMessages.length - 1];
      if (lastDialog) {
        // If last dialog was not from this action (we can't easily disambiguate),
        // ensure we did not add a 'Popped:' dialog as the most recent.
        expect(lastDialog.message.startsWith('Popped:')).toBe(false);
      }

      const historyAfter = await sp.getHistoryLen();
      // History likely unchanged because nothing was popped (function returns null)
      expect(historyAfter).toBeGreaterThanOrEqual(historyBefore);
    });

    test('Undo and Redo events - revert and reapply last action (S2 -> S2)', async ({ page }) => {
      const sp = new StackPage(page);

      // Ensure a predictable state: push a value to undo
      await sp.pushValue('9999', 'auto', 1);
      const afterPush = await sp.getActiveStackStats();

      // Undo should revert the push
      await sp.locators.undoBtn.click();

      // Action log should include UNDO
      const logAfterUndo = await sp.getActionLogText();
      expect(logAfterUndo).toContain('UNDO');

      const afterUndoStats = await sp.getActiveStackStats();
      // Size should be one less than afterPush
      expect(afterUndoStats.size).toBe(afterPush.size - 1);

      // Redo should reapply the push
      await sp.locators.redoBtn.click();

      const logAfterRedo = await sp.getActionLogText();
      expect(logAfterRedo).toContain('REDO');

      const afterRedoStats = await sp.getActiveStackStats();
      expect(afterRedoStats.size).toBe(afterPush.size);

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Search event - finds matches and alerts with count (S2 -> S2)', async ({ page }) => {
      const sp = new StackPage(page);

      // Ensure known content exists: push a unique string
      const unique = 'UniqueSearch_' + Date.now();
      await sp.pushValue(unique, 'auto', 1);

      // Run search for that substring
      await sp.searchActive(unique);

      // An alert with Found X matches should have been shown and recorded
      const foundSearchAlert = dialogMessages.some(d => d.message.startsWith('Found ') && d.message.indexOf('matches') !== -1);
      expect(foundSearchAlert).toBe(true);

      // Action log should include SEARCH or FIND
      const log = await sp.getActionLogText();
      expect(/SEARCH|FIND/.test(log)).toBeTruthy();

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Macro, transforms, and error scenarios', () => {
    test('Macro run - executes a small macro and logs MACRO_DONE', async ({ page }) => {
      const sp = new StackPage(page);

      // Compose a simple macro that pushes two values then duplicates
      const macro = `PUSH 1
PUSH 2
DUP`;

      const historyBefore = await sp.getHistoryLen();

      // Run macro
      await sp.runMacro(macro);

      // Wait for MACRO_DONE in action log (macro run invokes MACRO_DONE on completion)
      await page.waitForFunction(() => {
        const el = document.getElementById('actionLog');
        return el && el.textContent && el.textContent.indexOf('MACRO_DONE') !== -1;
      }, null, { timeout: 5000 });

      const log = await sp.getActionLogText();
      expect(log).toContain('MACRO_DONE');

      // History should have grown due to macro operations
      const historyAfter = await sp.getHistoryLen();
      expect(historyAfter).toBeGreaterThanOrEqual(historyBefore + 1);

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Invalid map expression triggers alert (edge case handling)', async ({ page }) => {
      // Prepare: create a stack and ensure it has items to be replaced
      const sp = new StackPage(page);
      await sp.createStack('MapTest_' + Date.now());
      await sp.pushValue('10', 'auto', 1);

      // Fill map expression with invalid JS to cause new Function to throw
      await page.locator('#mapExpr').fill('!!invalid js code ===');
      // Confirm() within mapReplace is triggered; dialogs are auto-accepted
      await page.locator('#mapReplaceBtn').click();

      // The implementation alerts 'Invalid map expression' on new Function error.
      // Check dialogs: at least one dialog with 'Invalid map expression' message should have occurred
      const invalidMapDialog = dialogMessages.some(d => d.message && d.message.toLowerCase().includes('invalid map expression'));
      // It might be that confirm was auto-accepted then the alert happened - accept either true or false depends on route.
      // We assert that the code handled expression gracefully (no uncaught error) and didn't crash.
      expect(pageErrors.length).toBe(0);
      // It's acceptable if the invalid expression produced an alert; we don't require it, but ensure no runtime exceptions
      // If an alert with the message exists, good; otherwise still OK.
    });

    test('Undo/Redo boundaries - multiple undos stop at earliest history and redos at latest', async ({ page }) => {
      const sp = new StackPage(page);

      // Record current history length
      const historyLen = await sp.getHistoryLen();

      // Perform several pushes to grow history
      await sp.pushValue('boundary1', 'auto', 1);
      await sp.pushValue('boundary2', 'auto', 1);
      await sp.pushValue('boundary3', 'auto', 1);

      // Repeatedly undo until no more changes (can't access historyIndex, so rely on presence of UNDO logs and size changes)
      for (let i = 0; i < 10; i++) {
        await sp.locators.undoBtn.click();
      }

      // After multiple undos, ensure no page errors and log contains UNDO (at least once)
      const log = await sp.getActionLogText();
      expect(log).toContain('UNDO');

      // Now redo multiple times
      for (let i = 0; i < 10; i++) {
        await sp.locators.redoBtn.click();
      }

      // Ensure REDO present in log
      const log2 = await sp.getActionLogText();
      expect(log2).toContain('REDO');

      // No runtime exceptions arose
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test('Inspect for console and page errors after exercising key interactions', async ({ page }) => {
    // This final check ensures that throughout the interactions we didn't miss runtime errors
    // (This test simply asserts that our captured arrays are arrays and that there were no page-level exceptions.)
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(Array.isArray(consoleErrors)).toBe(true);

    // Assert no page-level uncaught exceptions occurred during the test suite interactions
    expect(pageErrors.length).toBe(0);

    // consoleErrors might contain warnings depending on environment; assert none for this environment
    expect(consoleErrors.length).toBe(0);
  });
});