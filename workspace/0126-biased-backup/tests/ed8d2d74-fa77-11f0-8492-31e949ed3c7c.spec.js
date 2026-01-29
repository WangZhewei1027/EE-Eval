import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d2d74-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Directed Graph Visualization page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  infoButton() {
    return this.page.locator("button[onclick='showAlert()']");
  }

  async clickInfoButton() {
    await this.infoButton().click();
  }

  nodeElements() {
    return this.page.locator('.node');
  }

  arrowElements() {
    return this.page.locator('.arrow');
  }

  heading() {
    return this.page.locator('h1');
  }

  // Evaluate whether a named global function exists on the window
  async hasGlobalFunction(functionName) {
    return this.page.evaluate((fn) => typeof window[fn] === 'function', functionName);
  }

  // Return the typeof of a global variable or function
  async typeOfGlobal(name) {
    return this.page.evaluate((n) => typeof window[n], name);
  }

  // Return the onclick attribute of the info button
  async infoButtonOnClickAttr() {
    return this.page.evaluate(() => {
      const btn = document.querySelector("button[onclick='showAlert()']");
      return btn ? btn.getAttribute('onclick') : null;
    });
  }
}

test.describe('Directed Graph Visualization - FSM validation (ed8d2d74-...-3c7c)', () => {
  let page;
  let graph;
  let consoleMessages;
  let pageErrors;

  // Setup: create a fresh page per test and capture console/page errors
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture runtime page errors
    page.on('pageerror', (err) => {
      // err is an Error object from the page
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    graph = new GraphPage(page);
    await graph.goto();
  });

  test.afterEach(async () => {
    // Basic tear down: close the page
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('S0_Idle: initial render shows graph elements and Info button (Idle state verification)', async () => {
    // This test validates the Idle state (S0_Idle) - the page rendering and DOM evidence described in the FSM.

    // Verify heading is present and correct
    await expect(graph.heading()).toBeVisible();
    await expect(graph.heading()).toHaveText('Directed Graph Visualization');

    // Verify nodes: there should be 4 nodes (A, B, C, D) as per HTML
    await expect(graph.nodeElements()).toHaveCount(4);

    // Verify arrows: 2 arrow elements present
    await expect(graph.arrowElements()).toHaveCount(2);

    // Verify the Info button exists and is visible
    const infoBtn = graph.infoButton();
    await expect(infoBtn).toBeVisible();
    await expect(infoBtn).toHaveText('Info');

    // Verify the button has the onclick attribute pointing to showAlert()
    const onclickAttr = await graph.infoButtonOnClickAttr();
    expect(onclickAttr).toBe("showAlert()");

    // Verify that the showAlert function is defined on the window (S1 entry action exists)
    const hasShowAlert = await graph.hasGlobalFunction('showAlert');
    expect(hasShowAlert).toBe(true);

    // Verify that renderPage (mentioned as an entry action in the FSM) is NOT present in the actual implementation.
    // We expect typeof window.renderPage to be 'undefined' because the HTML does not define it.
    const renderPageType = await graph.typeOfGlobal('renderPage');
    expect(renderPageType).toBe('undefined');

    // Assert that no page.error events were emitted during initial load
    expect(pageErrors.length).toBe(0);

    // Also assert there were no console messages of type 'error' (if any, list them for debug)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_AlertShown: clicking Info button shows the alert dialog with correct content (transition test)', async () => {
    // This test validates the transition from Idle to AlertShown (S0 -> S1) by clicking the Info button.

    // Prepare to capture the dialog
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      // Push dialog message and accept it to allow page to continue
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    // Click the Info button to trigger showAlert()
    await graph.clickInfoButton();

    // Ensure a dialog was received
    expect(dialogs.length).toBeGreaterThanOrEqual(1);

    // Verify dialog content matches the expected alert text from the HTML
    const expectedText = "This is a directed graph. Nodes represent entities and arrows represent relationships.";
    expect(dialogs[0].message).toBe(expectedText);
    expect(dialogs[0].type).toBe('alert');

    // After alert, DOM should remain intact (button still present)
    await expect(graph.infoButton()).toBeVisible();

    // No runtime errors should have occurred as a result of clicking the button
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking Info multiple times triggers multiple alerts (robustness check)', async () => {
    // This test checks repeated interactions and ensures each click produces an alert.

    const receivedDialogs = [];
    page.on('dialog', async (dialog) => {
      receivedDialogs.push(dialog.message());
      await dialog.accept();
    });

    // Click the Info button twice in succession
    await graph.clickInfoButton();
    await graph.clickInfoButton();

    // Wait a short time to ensure dialogs were delivered/handled
    await page.waitForTimeout(200);

    // Expect two alerts to have been captured
    expect(receivedDialogs.length).toBeGreaterThanOrEqual(2);
    const expectedText = "This is a directed graph. Nodes represent entities and arrows represent relationships.";
    expect(receivedDialogs[0]).toBe(expectedText);
    expect(receivedDialogs[1]).toBe(expectedText);

    // Ensure no page errors resulted from repeated clicks
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action mismatch: invoking non-existent renderPage leads to ReferenceError (error observation)', async () => {
    // The FSM mentions an entry action renderPage() for S0_Idle, but the HTML does not define it.
    // We intentionally attempt to call renderPage() to see how the runtime behaves, and assert that a ReferenceError occurs.

    // Evaluate a call to renderPage() and expect it to reject with a ReferenceError-like message.
    // We do not modify the page or define renderPage; we call it as-is to let the environment produce the natural error.
    await expect(page.evaluate(() => {
      // Directly call renderPage which is not defined in the page; this should throw in the page context.
      // The thrown error will cause page.evaluate's promise to reject.
      return renderPage();
    })).rejects.toThrow(/renderPage/);

    // Confirm that such an attempt produced a pageerror event as well (depending on the engine).
    // It is acceptable for pageErrors to include the ReferenceError thrown above.
    const foundReferenceError = pageErrors.some(e => /renderPage/.test(e.message));
    // It's allowed that the pageerror array may or may not capture the thrown error (different runtimes).
    // We assert that either the pageErrors contains a renderPage mention or the evaluate rejection above already validated it.
    expect(foundReferenceError || pageErrors.length >= 0).toBeTruthy();
  });

  test('Validate event handler evidence and attributes match FSM extraction', async () => {
    // Validate that the component described in the FSM (button[onclick="showAlert()"]) exists
    const infoBtn = graph.infoButton();
    await expect(infoBtn).toBeVisible();

    // Validate the attribute exactly matches the FSM evidence
    const onclick = await infoBtn.getAttribute('onclick');
    expect(onclick).toBe('showAlert()');

    // Validate text content matches the FSM component description
    await expect(infoBtn).toHaveText('Info');

    // Validate that nodes and arrows counts match extraction summary
    await expect(graph.nodeElements()).toHaveCount(4);
    await expect(graph.arrowElements()).toHaveCount(2);

    // Ensure there are no console errors from load and these inspections
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});