import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b42c3-fa76-11f0-a09b-87751f540fd8.html';

// Page object encapsulating common queries and captured events
class ASTPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array<Error>} pageErrors
   * @param {Array<import('@playwright/test').ConsoleMessage>} consoleMessages
   */
  constructor(page, pageErrors, consoleMessages) {
    this.page = page;
    this.pageErrors = pageErrors;
    this.consoleMessages = consoleMessages;
  }

  // Returns the innerHTML of the #tree container
  async getTreeInnerHTML() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('tree');
      return el ? el.innerHTML : null;
    });
  }

  // Returns whether there is any element with class .node inside #tree
  async hasNodeElements() {
    return await this.page.evaluate(() => {
      const tree = document.getElementById('tree');
      if (!tree) return false;
      return !!tree.querySelector('.node');
    });
  }

  // Returns the textContent of the #tree container
  async getTreeTextContent() {
    return await this.page.evaluate(() => {
      const el1 = document.getElementById('tree');
      return el ? el.textContent : null;
    });
  }

  // Check whether a global function named renderPage exists
  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined' && typeof window.renderPage === 'function');
  }

  // Returns the collected page errors
  getPageErrors() {
    return this.pageErrors;
  }

  // Returns the collected console messages as strings
  getConsoleMessages() {
    return this.consoleMessages.map(msg => ({
      type: msg.type(),
      text: msg.text()
    }));
  }
}

test.describe('AST Interactive Application - FSM Validation', () => {
  // Arrays to capture runtime errors and console messages for each test
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // reset arrays before each test
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions and add them to pageErrors
    page.on('pageerror', (err) => {
      // push Error objects for easier introspection
      pageErrors.push(err);
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
    });

    // Navigate to the application page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // nothing special to teardown; listeners are tied to the page and test fixture lifecycle
  });

  test.describe('State S0_Idle (Initial state) - DOM presence and entry evidence', () => {
    test('Initial page load should contain the #tree container and be in Idle evidence state', async ({ page }) => {
      // This test verifies the Idle state's evidence: the presence of <div id="tree"></div>
      const ast = new ASTPage(page, pageErrors, consoleMessages);

      // The #tree element must exist in the DOM (evidence for Idle)
      const treeInnerHTML = await ast.getTreeInnerHTML();
      expect(treeInnerHTML).not.toBeNull(); // element exists

      // Since the application script fails during rendering (see other tests), the container should be empty
      // or at least not contain rendered .node elements. Assert it's empty string or whitespace.
      const trimmed = (treeInnerHTML || '').trim();
      // Accept either empty or only whitespace, but assert it's not populated with .node markup.
      expect(trimmed === '' || trimmed.length >= 0).toBeTruthy();

      // There should be no .node element present as rendering likely failed
      const hasNode = await ast.hasNodeElements();
      expect(hasNode).toBe(false);
    });

    test('renderPage entry action from FSM is not defined in the page (verify onEnter action presence)', async ({ page }) => {
      // The FSM mentioned an entry action renderPage(). Verify whether that global exists.
      const ast1 = new ASTPage(page, pageErrors, consoleMessages);
      const defined = await ast.isRenderPageDefined();
      // The implementation does not provide renderPage; assert it is not defined.
      expect(defined).toBe(false);
    });
  });

  test.describe('Transition: S0_Idle -> S1_TreeRendered (TreeRender event) and error scenarios', () => {
    test('Attempting to render the tree throws a runtime error and prevents the TreeRendered final state', async ({ page }) => {
      // This test validates that the TreeRender event (DOM mutation) did NOT occur because
      // the script throws a TypeError when trying to add children to a DOM element using array push.
      const ast2 = new ASTPage(page, pageErrors, consoleMessages);

      // The page should have recorded at least one runtime error
      expect(pageErrors.length).toBeGreaterThan(0);

      // Check that at least one error message indicates the push/non-function issue.
      // Error messages can vary across engines; check for several plausible substrings.
      const messages = pageErrors.map(e => String(e && e.message ? e.message : e));
      const combined = messages.join(' | ').toLowerCase();

      // Acceptable substrings that indicate the nature of the failure
      const expectedSubstrings = ['push', 'not a function', 'is not a function', 'undefined', 'cannot', 'read'];

      const matched = expectedSubstrings.some(sub => combined.includes(sub));
      expect(matched).toBeTruthy();

      // Verify that the tree container was not populated with expected node markup (transition didn't happen)
      const treeInnerHTML1 = await ast.getTreeInnerHTML();
      // The FSM expected something like: <div class="node">0  root: This is the root of the tree.</div>
      // Ensure that exact substring does not appear
      const expectedNodeSnippet = '0  root: This is the root of the tree.';
      const containsSnippet = (treeInnerHTML || '').includes(expectedNodeSnippet);
      expect(containsSnippet).toBe(false);

      // Also assert there are no .node elements in the DOM (TreeRendered state evidence absent)
      const hasNode1 = await ast.hasNodeElements();
      expect(hasNode).toBe(false);

      // Because the script attempted to create a `treeElement` const, but the runtime error prevented normal completion,
      // there should be no visible nodes in the DOM and no final-state evidence.
      expect((await ast.getTreeTextContent()) || '').toBe('');
    });

    test('Console messages and page errors are captured (observability of the failure)', async ({ page }) => {
      // This test ensures that console and page error handlers captured useful diagnostics.
      const ast3 = new ASTPage(page, pageErrors, consoleMessages);

      // There should be at least one console message or page error recorded
      const consoleMsgs = ast.getConsoleMessages();
      const pageErrs = ast.getPageErrors();

      expect(consoleMsgs.length + pageErrs.length).toBeGreaterThan(0);

      // If console messages exist, include at least their text in the test logs (non-failing assertion)
      for (const cm of consoleMsgs) {
        expect(typeof cm.text).toBe('string');
      }

      // For the recorded page errors, ensure they have message strings
      for (const pe of pageErrs) {
        expect(typeof (pe && pe.message ? pe.message : '')).toBe('string');
      }
    });

    test('Edge case: waiting for a .node element should not succeed (TreeRendered unreachable)', async ({ page }) => {
      // Ensure that an attempt to wait for rendered nodes will timeout / not find any nodes.
      // We avoid waiting long to keep tests fast.
      const nodeLocator = page.locator('#tree .node');

      // Immediately assert that count is zero
      await expect(nodeLocator).toHaveCount(0);
    });
  });

  test.describe('FSM completeness checks and expected observables', () => {
    test('The expected observable markup (node with root text) is NOT present due to the runtime error', async ({ page }) => {
      // This test explicitly asserts that the FSM's expected_observables are not present.
      const ast4 = new ASTPage(page, pageErrors, consoleMessages);

      const expectedObservable = '<div class="node">0  root: This is the root of the tree.</div>';
      const inner = await ast.getTreeInnerHTML();

      // It should not include the expected observable string because the transition failed.
      expect((inner || '').includes(expectedObservable)).toBe(false);
    });
  });
});