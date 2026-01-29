import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324fa9b3-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Garbage Collection demo app
class GarbagePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.createBtn = page.locator('#createObject');
    this.makeNullBtn = page.locator('#makeNull');
    this.output = page.locator('#output');
    // listeners storage
    this.consoleMessages = [];
    this.pageErrors = [];
    this._consoleListener = (msg) => {
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore
      }
    };
    this._pageErrorListener = (err) => {
      this.pageErrors.push(err);
    };
  }

  // attach listeners to capture console logs and page errors
  async attachListeners() {
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // detach listeners (cleanup)
  async detachListeners() {
    this.page.removeListener('console', this._consoleListener);
    this.page.removeListener('pageerror', this._pageErrorListener);
  }

  // navigate to app
  async goto() {
    await this.page.goto(APP_URL);
  }

  // convenience actions
  async clickCreate() {
    await this.createBtn.click();
  }

  async clickMakeNull() {
    await this.makeNullBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  // evaluate the global myObject variable in the page context
  async getMyObject() {
    return this.page.evaluate(() => {
      // return a serializable snapshot of myObject:
      try {
        if (typeof myObject === 'undefined') return { type: 'undefined' };
        if (myObject === null) return { type: 'null' };
        if (typeof myObject === 'object') return { type: 'object', snapshot: myObject };
        return { type: typeof myObject, value: myObject };
      } catch (e) {
        return { type: 'error', message: String(e) };
      }
    });
  }

  // helper to wait for a console message that matches predicate
  async waitForConsoleMessage(predicate, timeout = 3000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      for (const m of this.consoleMessages) {
        try {
          if (predicate(m)) return m;
        } catch (e) {
          // ignore predicate errors
        }
      }
      // small delay
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('Timed out waiting for console message');
  }
}

test.describe('Garbage Collection Interactive App (FSM validation)', () => {
  // Per-test page and page object
  test.beforeEach(async ({ page }) => {
    // nothing global here; each test will create its own GarbagePage and navigate
  });

  test.afterEach(async ({ page }) => {
    // ensure any intervals don't block Playwright; navigation away is handled by test runner cleanup
  });

  test('Initial Idle state: buttons present, output empty, and periodic memory log starts', async ({ page }) => {
    // Validate initial state S0_Idle and that renderPage is not throwing any errors
    const app = new GarbagePage(page);
    await app.attachListeners();
    await app.goto();

    // Buttons should be visible and enabled
    await expect(app.createBtn).toBeVisible();
    await expect(app.makeNullBtn).toBeVisible();
    await expect(app.createBtn).toBeEnabled();
    await expect(app.makeNullBtn).toBeEnabled();

    // Output should be initially empty
    const initialOutput = await app.getOutputText();
    expect(initialOutput.trim()).toBe('');

    // The page declares `let myObject;` - before interactions it should be undefined
    const myObjectBefore = await app.getMyObject();
    expect(myObjectBefore).toEqual({ type: 'undefined' });

    // The page starts a setInterval that logs "Memory cleanup example running..." every second.
    // Wait up to 3s for that console message to appear to validate the running background task.
    const memLog = await app.waitForConsoleMessage(
      (m) => typeof m.text === 'string' && m.text.includes('Memory cleanup example running...'),
      3500
    );
    expect(memLog.text).toContain('Memory cleanup example running...');

    // Ensure there are no runtime page errors on initial load (no ReferenceError / SyntaxError)
    expect(app.pageErrors.length).toBe(0);

    await app.detachListeners();
  });

  test('Transition S0_Idle -> S1_ObjectCreated via Create Object click', async ({ page }) => {
    // Validate clicking Create Object transitions to "Object Created" state.
    const app1 = new GarbagePage(page);
    await app.attachListeners();
    await app.goto();

    // Click Create Object
    await app.clickCreate();

    // Output should reflect object creation per FSM evidence
    await expect(app.output).toHaveText('Object Created: Garbage Collector');

    // The global myObject should now be an object with name 'Garbage Collector'
    const myObjectAfter = await app.getMyObject();
    expect(myObjectAfter.type).toBe('object');
    // snapshot should include the name property
    expect(myObjectAfter.snapshot).toBeDefined();
    expect(myObjectAfter.snapshot.name).toBe('Garbage Collector');

    // The app logs the object to the console; ensure a console message includes the name
    const objLog = await app.waitForConsoleMessage(
      (m) => typeof m.text === 'string' && m.text.includes('Garbage Collector'),
      2000
    );
    expect(objLog.text).toContain('Garbage Collector');

    // No page errors should have occurred
    expect(app.pageErrors.length).toBe(0);

    await app.detachListeners();
  });

  test('Transition S1_ObjectCreated -> S2_ObjectDereferenced via Make Object Null click', async ({ page }) => {
    // Click create then make null and validate dereference state
    const app2 = new GarbagePage(page);
    await app.attachListeners();
    await app.goto();

    // create first
    await app.clickCreate();
    await expect(app.output).toHaveText('Object Created: Garbage Collector');

    // then dereference
    await app.clickMakeNull();

    // Output should reflect the dereference per FSM evidence
    await expect(app.output).toHaveText('Object dereferenced. Garbage Collector will reclaim memory.');

    // global myObject should now be null
    const myObjectAfterNull = await app.getMyObject();
    expect(myObjectAfterNull).toEqual({ type: 'null' });

    // Console should include the dereference log
    const derefLog = await app.waitForConsoleMessage(
      (m) => typeof m.text === 'string' && m.text.includes('Object dereferenced.'),
      2000
    );
    expect(derefLog.text).toContain('Object dereferenced.');

    // No unexpected page errors
    expect(app.pageErrors.length).toBe(0);

    await app.detachListeners();
  });

  test('Edge case: clicking Make Object Null before Create Object (dereference without prior creation)', async ({ page }) => {
    // Validate making null when no object exists does not throw and still shows dereference message
    const app3 = new GarbagePage(page);
    await app.attachListeners();
    await app.goto();

    // ensure initially undefined
    const before = await app.getMyObject();
    expect(before).toEqual({ type: 'undefined' });

    // click make null first
    await app.clickMakeNull();

    // Output should show dereference message even if there was no prior object
    await expect(app.output).toHaveText('Object dereferenced. Garbage Collector will reclaim memory.');

    // myObject should now be null
    const after = await app.getMyObject();
    expect(after).toEqual({ type: 'null' });

    // Console should include the dereference message
    const derefLog1 = await app.waitForConsoleMessage(
      (m) => typeof m.text === 'string' && m.text.includes('Object dereferenced.'),
      2000
    );
    expect(derefLog.text).toContain('Object dereferenced.');

    // There should be no page errors resulting from dereferencing an undefined object
    expect(app.pageErrors.length).toBe(0);

    await app.detachListeners();
  });

  test('Robustness: multiple Create Object clicks remain consistent and do not produce errors', async ({ page }) => {
    // Validate repeated creation is idempotent for this UI and does not produce runtime errors.
    const app4 = new GarbagePage(page);
    await app.attachListeners();
    await app.goto();

    // click create multiple times
    await app.clickCreate();
    await expect(app.output).toHaveText('Object Created: Garbage Collector');

    await app.clickCreate();
    await expect(app.output).toHaveText('Object Created: Garbage Collector');

    await app.clickCreate();
    await expect(app.output).toHaveText('Object Created: Garbage Collector');

    // myObject should still be the expected object
    const myObj = await app.getMyObject();
    expect(myObj.type).toBe('object');
    expect(myObj.snapshot.name).toBe('Garbage Collector');

    // Console should contain at least one log with the object's name
    const objLog1 = await app.waitForConsoleMessage(
      (m) => typeof m.text === 'string' && m.text.includes('Garbage Collector'),
      2000
    );
    expect(objLog.text).toContain('Garbage Collector');

    // No page errors observed
    expect(app.pageErrors.length).toBe(0);

    await app.detachListeners();
  });

  test('Verify that no unexpected ReferenceError / SyntaxError related to missing FSM actions (renderPage) occurs', async ({ page }) => {
    // The FSM mentions an entry action renderPage() for Idle but the implementation does not call renderPage.
    // We assert that the page does not throw a ReferenceError complaining about renderPage being missing.
    const app5 = new GarbagePage(page);
    await app.attachListeners();
    await app.goto();

    // Allow a short period for potential runtime errors to surface
    await new Promise((r) => setTimeout(r, 800));

    // Collect any page errors and assert none refer to 'renderPage' being undefined
    const errorsText = app.pageErrors.map((e) => String(e && e.message ? e.message : e)).join('\n');
    expect(errorsText).not.toContain('renderPage');
    // Also assert there were no page errors at all
    expect(app.pageErrors.length).toBe(0);

    await app.detachListeners();
  });
});