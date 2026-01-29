import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0441e6e0-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object for the B+ Tree demo page.
 * Encapsulates common interactions and queries used by the tests.
 */
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickButton() {
    await this.page.click('.button');
  }

  async getSelection() {
    return await this.page.evaluate(() => {
      // read the in-page tree.selection value
      return window.tree ? window.tree.selection : undefined;
    });
  }

  async getNodesLength() {
    return await this.page.evaluate(() => {
      return window.tree ? window.tree.nodes.length : undefined;
    });
  }

  async getNodeText(id) {
    return await this.page.$eval(`.node-${id}`, el => el.textContent);
  }

  async getNodeLeftStyle(id) {
    return await this.page.$eval(`.node-${id}`, el => {
      // prefer computed style (left may be set inline)
      return window.getComputedStyle(el).left || el.style.left;
    });
  }

  async callDeselect() {
    return await this.page.evaluate(() => {
      // call the in-page function; let any exceptions propagate to page/pageerror
      return deselectNode();
    });
  }

  async callAddNode(id, text) {
    return await this.page.evaluate(({ id, text }) => {
      // call the in-page function; let any exceptions propagate
      return addNode(id, text);
    }, { id, text });
  }

  async getTreeNodesCountById(id) {
    return await this.page.evaluate((id) => {
      if (!window.tree) return undefined;
      return window.tree.nodes.filter(n => n.id === id).length;
    }, id);
  }
}

test.describe('B+ Tree interactive application (FSM validation)', () => {
  let page;
  let treePage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and page errors to assert later
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // store console messages for inspection
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', err => {
      // store page errors (unhandled exceptions thrown in page)
      pageErrors.push(err);
    });

    treePage = new TreePage(page);
    await treePage.goto();
  });

  test.afterEach(async () => {
    // ensure page is closed to avoid leaking contexts
    await page.close();
  });

  test('S0 Idle: On load updateTree() runs and initial model is populated', async () => {
    // Comment: Validate the Idle state's entry action (updateTree) by inspecting the in-page model
    // and checking DOM updates that updateTree() performs.

    // After page load, tree.selection should be null (Idle state)
    const selection = await treePage.getSelection();
    expect(selection).toBeNull();

    // The page script calls addNode(1), addNode(2), addNode(3) in addition to the initial nodes,
    // so there should be duplicates resulting in 6 entries.
    const nodesLength = await treePage.getNodesLength();
    expect(nodesLength).toBe(6);

    // The updateTree() function sets the left style to node.id * 20 px.
    // For id=1 this should be "20px".
    const left1 = await treePage.getNodeLeftStyle(1);
    // Depending on computed style, ensure it contains "20px"
    expect(left1).toContain('20px');

    // The node text contents should be set to their text values.
    const text1 = await treePage.getNodeText(1);
    const text2 = await treePage.getNodeText(2);
    const text3 = await treePage.getNodeText(3);
    expect(text1.trim()).toBe('1');
    expect(text2.trim()).toBe('2');
    expect(text3.trim()).toBe('3');

    // No unexpected page errors should have occurred during a correct load.
    expect(pageErrors.length).toBe(0);
  });

  test('ButtonClick event: clicking the button transitions Idle -> NodeSelected and calls selectNode(1)', async () => {
    // Comment: Validate the ButtonClick event (clicking .button) causes selectNode(1)
    // and transitions the FSM to Node Selected by checking the in-page model.

    // Ensure initial selection is null
    expect(await treePage.getSelection()).toBeNull();

    // Click the button which should call selectNode(1)
    await treePage.clickButton();

    // After the click, tree.selection should be 1 (Node Selected state)
    const selectionAfter = await treePage.getSelection();
    expect(selectionAfter).toBe(1);

    // updateTree() is invoked by selectNode(1). Confirm DOM still has expected text and left value
    const text1 = await treePage.getNodeText(1);
    expect(text1.trim()).toBe('1');

    const left1 = await treePage.getNodeLeftStyle(1);
    expect(left1).toContain('20px');

    // Ensure no page errors were thrown by the button click
    expect(pageErrors.length).toBe(0);

    // Optionally check we recorded console messages (not required to exist)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('DeselectNode transition: calling deselectNode() transitions NodeSelected -> Idle (selection cleared)', async () => {
    // Comment: Start by selecting a node (simulate user), then call deselectNode()
    // to exercise the S1 -> S0 transition and its exit action deselectNode()/updateTree().

    // Select the node via the button first
    await treePage.clickButton();
    expect(await treePage.getSelection()).toBe(1);

    // Now call deselectNode() directly (this is the DeselectNode event from the FSM)
    // The function should run without throwing and clear the selection.
    await treePage.callDeselect();

    const selectionAfter = await treePage.getSelection();
    expect(selectionAfter).toBeNull();

    // updateTree() runs but does not change the fact that node elements exist and text remains correct
    const text1 = await treePage.getNodeText(1);
    expect(text1.trim()).toBe('1');

    // Ensure no page errors were thrown while deselecting
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case / error scenario: adding a node without a matching DOM element produces a natural TypeError', async () => {
    // Comment: Intentionally call addNode with an id that has no corresponding .node-<id> element.
    // updateTree() will attempt to access textContent on a null element and naturally throw a TypeError.
    // We do not patch or modify the page; we let the error happen and assert that it occurred.

    // Clear any prior captured page errors for clearer expectations in this test
    pageErrors.length = 0;

    // Attempt to add a node that doesn't exist in the DOM (e.g., id 999).
    // The page.evaluate call is expected to throw because updateTree() will try to access .textContent
    // on a null element. We catch the thrown promise rejection here to allow the test to continue,
    // but the pageerror handler should still have recorded the error.
    let caught = null;
    try {
      await treePage.callAddNode(999, 'X');
    } catch (err) {
      // We expect an exception (TypeError) coming from the page context; record it for assertions.
      caught = err;
    }

    // Ensure we indeed observed a rejection from the page.evaluate call
    expect(caught).toBeTruthy();

    // The page's pageerror handler should have recorded the in-page unhandled exception as well.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Check that at least one of the captured errors mentions textContent or 'Cannot read' which is
    // typical for trying to set properties on null/undefined in browser engines.
    const messages = pageErrors.map(e => (e && e.message) ? e.message.toString() : String(e));
    const hasTextContentError = messages.some(m =>
      m.includes('textContent') || m.toLowerCase().includes('cannot read') || m.toLowerCase().includes('cannot set')
    );
    expect(hasTextContentError).toBeTruthy();
  });

  test('Model integrity: duplicate IDs exist in tree.nodes due to repeated addNode calls', async () => {
    // Comment: The application calls addNode(1), addNode(2), addNode(3) after initial definition,
    // so IDs 1,2,3 should appear twice in the model. Validate that duplicates exist.

    const countId1 = await treePage.getTreeNodesCountById(1);
    const countId2 = await treePage.getTreeNodesCountById(2);
    const countId3 = await treePage.getTreeNodesCountById(3);

    expect(countId1).toBeGreaterThanOrEqual(2);
    expect(countId2).toBeGreaterThanOrEqual(2);
    expect(countId3).toBeGreaterThanOrEqual(2);

    // Ensure DOM still only has one element per node class (the DOM was not updated to add new elements)
    // There should still be exactly one .node.node-1 element visible in DOM
    const domCount1 = await page.$$eval('.node.node-1', els => els.length);
    expect(domCount1).toBe(1);
  });
});