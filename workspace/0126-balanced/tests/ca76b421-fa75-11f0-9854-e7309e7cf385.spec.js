import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca76b421-fa75-11f0-9854-e7309e7cf385.html';

// Page object encapsulating interactions with the B+ Tree page
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the app URL
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return count of visible .node elements under #tree in the DOM
  async getVisibleNodeCount() {
    return await this.page.locator('#tree .node').count();
  }

  // Click the #tree element (the FSM expects a click triggers addNode, but the implementation may not wire this)
  async clickTree() {
    await this.page.click('#tree');
  }

  // Call the page's global addNode() function directly
  async callAddNode() {
    return await this.page.evaluate(() => {
      // call the existing function in the page context; do NOT redefine anything
      return addNode();
    });
  }

  // Remove the #tree element from the DOM (simulate broken/missing element scenario)
  async removeTree() {
    await this.page.evaluate(() => {
      const t = document.getElementById('tree');
      if (t) t.remove();
    });
  }
}

test.describe('B+ Tree interactive application (ca76b421-fa75-11f0-9854-e7309e7cf385)', () => {

  // Test: initial state (S0_Idle) - page renders #tree and the script calls addNode() on load
  test('Initial render (S0_Idle) and automatic node addition - verifies entry behavior and DOM', async ({ page }) => {
    // Collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    page.on('pageerror', err => pageErrors.push(err.message));

    const tree = new TreePage(page);

    // Navigate to the app - attach listeners before goto to capture initial logs
    await tree.goto();

    // The implementation calls addNode() once on load. Wait for the corresponding console message.
    const firstConsole = await page.waitForEvent('console', {
      predicate: m => m.text().includes('Node added successfully'),
      timeout: 2000
    });
    expect(firstConsole.text()).toContain('Node added successfully');

    // Verify the #tree element exists and that at least one .node child is present (created by the initial addNode call)
    const nodeCount = await tree.getVisibleNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    // Verify there are no uncaught page errors on initial load
    expect(pageErrors).toEqual([]);

    // The FSM expected an entry action renderPage(); there is no such function in implementation.
    // Ensure we do not have any page errors that indicate renderPage was attempted (i.e., no ReferenceError about renderPage)
    const hasRenderPageError = pageErrors.some(e => e.includes('renderPage'));
    expect(hasRenderPageError).toBe(false);
  });

  // Test: attempt the FSM 'AddNode' event by clicking #tree.
  // The FSM declares clicking #tree should trigger addNode(), but the HTML implementation doesn't wire a click handler.
  // This test verifies the mismatch and asserts that clicking does not add a node unless addNode is called directly.
  test('Clicking #tree should trigger AddNode transition (verified behavior) - click is NOT wired in implementation', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    page.on('pageerror', err => pageErrors.push(err.message));

    const tree = new TreePage(page);
    await tree.goto();

    // Wait for initial automatic addNode() console message
    await page.waitForEvent('console', { predicate: m => m.text().includes('Node added successfully'), timeout: 2000 });

    // Record current visible node count and number of success logs
    const beforeCount = await tree.getVisibleNodeCount();
    const beforeSuccessLogs = consoleMessages.filter(m => m.includes('Node added successfully')).length;

    // Perform a user click on the #tree element (FSM expects this to trigger addNode)
    await tree.clickTree();

    // Wait briefly to allow any possible handlers to run
    await page.waitForTimeout(300);

    const afterCount = await tree.getVisibleNodeCount();
    const afterSuccessLogs = consoleMessages.filter(m => m.includes('Node added successfully')).length;

    // Since the implementation does not attach a click handler, clicking should NOT have added a node.
    expect(afterCount).toBe(beforeCount);
    expect(afterSuccessLogs).toBe(beforeSuccessLogs);

    // Ensure no unexpected page errors from the click
    expect(pageErrors).toEqual([]);
  });

  // Test: directly invoking addNode() (this calls the implementation's function) should add a node and log success.
  test('Direct invocation of addNode() triggers Node Added transition (S1_NodeAdded) - validates addNode() function', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    page.on('pageerror', err => pageErrors.push(err.message));

    const tree = new TreePage(page);
    await tree.goto();

    // Wait for initial automatic addition
    await page.waitForEvent('console', { predicate: m => m.text().includes('Node added successfully'), timeout: 2000 });

    const beforeCount = await tree.getVisibleNodeCount();
    const beforeSuccessLogs = consoleMessages.filter(m => m.includes('Node added successfully')).length;

    // Invoke the existing addNode() function directly in page context (simulate the transition action)
    const consoleEventPromise = page.waitForEvent('console', { predicate: m => m.text().includes('Node added successfully'), timeout: 2000 });
    await tree.callAddNode();
    const newConsole = await consoleEventPromise;
    expect(newConsole.text()).toContain('Node added successfully');

    // After calling addNode(), the DOM should have one more visible node under #tree
    const afterCount = await tree.getVisibleNodeCount();
    expect(afterCount).toBe(beforeCount + 1);

    // Confirm a new success log was emitted
    const afterSuccessLogs = consoleMessages.filter(m => m.includes('Node added successfully')).length;
    expect(afterSuccessLogs).toBe(beforeSuccessLogs + 1);

    // No unexpected page errors should have occurred
    expect(pageErrors).toEqual([]);
  });

  // Edge case: remove #tree element and then call addNode()
  // The implementation stores a reference "nodes = document.getElementById('tree')" at load.
  // Even if the element is removed from the document, addNode() will append to that detached element and still log success.
  test('Edge case: calling addNode() after removing #tree - logs success but node not visible in document', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    page.on('pageerror', err => pageErrors.push(err.message));

    const tree = new TreePage(page);
    await tree.goto();

    // Wait for initial automatic addNode()
    await page.waitForEvent('console', { predicate: m => m.text().includes('Node added successfully'), timeout: 2000 });

    // Remove the #tree element from the document (simulate missing DOM element)
    await tree.removeTree();

    // Confirm there are no visible nodes now (the #tree is gone)
    const visibleAfterRemoval = await tree.getVisibleNodeCount();
    expect(visibleAfterRemoval).toBe(0);

    // Calling addNode() now will operate on the saved reference 'nodes' inside the page script.
    // That may append to a detached DOM node but will still satisfy the if (nodes.appendChild(newNode)) condition and log success.
    const consolePromise = page.waitForEvent('console', { predicate: m => m.text().includes('Node added successfully'), timeout: 2000 });
    await tree.callAddNode();
    const log = await consolePromise;
    expect(log.text()).toContain('Node added successfully');

    // Since #tree is no longer in the document, there are still zero visible nodes under '#tree' selector
    const visibleAfterAdd = await tree.getVisibleNodeCount();
    expect(visibleAfterAdd).toBe(0);

    // Ensure no unexpected page errors were produced by these actions
    expect(pageErrors).toEqual([]);
  });

  // Edge case: attempt to click or interact with #tree after it has been removed -> should produce an error when invoking DOM APIs on null
  test('Edge case: clicking removed #tree via page.evaluate leads to a TypeError in the page context', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    const tree = new TreePage(page);
    await tree.goto();

    // Remove the element
    await tree.removeTree();

    // Attempt to call a DOM API on a null result inside page.evaluate - expect this to throw
    // This demonstrates an error scenario (e.g., TypeError: Cannot read properties of null)
    await expect(page.evaluate(() => {
      // This will attempt to call .click() on null and should throw inside the page context
      return document.querySelector('#tree').click();
    })).rejects.toThrow();

    // The page should have recorded at least one page error related to the above evaluation
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the page errors should indicate null property access (TypeError)
    const hasTypeError = pageErrors.some(msg =>
      msg.includes('Cannot read') || msg.includes('null') || msg.toLowerCase().includes('typeerror')
    );
    expect(hasTypeError).toBe(true);
  });

});