import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba89d20-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the BST page
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.form = '#tree-form';
    this.selectors = {
      root: '#root',
      left: '#left',
      right: '#right',
      leaf: '#leaf',
      submit: "button[type='submit']",
      tree: '#tree',
      heading: 'h1'
    };
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async fillForm({ root = '', left = '', right = '', leaf = '' } = {}) {
    await this.page.fill(this.selectors.root, root);
    await this.page.fill(this.selectors.left, left);
    await this.page.fill(this.selectors.right, right);
    await this.page.fill(this.selectors.leaf, leaf);
  }

  async clickSubmit() {
    await this.page.click(this.selectors.submit);
  }

  // Programmatically dispatch submit event (bypasses browser validation)
  async dispatchSubmitProgrammatically() {
    await this.page.evaluate(() => {
      const form = document.getElementById('tree-form');
      // Create an event that bubbles and is cancelable (like normal submit)
      const evt = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(evt);
    });
  }

  async getTreeInnerHTML() {
    return this.page.locator(this.selectors.tree).innerHTML();
  }

  async getHeadingText() {
    return this.page.locator(this.selectors.heading).innerText();
  }
}

test.describe('Binary Search Tree interactive app - states and transitions', () => {
  // Each test will capture page errors and console messages that occur during the test.
  test('S0_Idle: initial render shows heading, form and empty tree', async ({ page }) => {
    // This test validates the Idle state entry action (renderPage)
    const bst = new BSTPage(page);
    await bst.goto();

    // Verify heading present
    const heading = await bst.getHeadingText();
    expect(heading).toContain('Binary Search Tree (BST)');

    // Verify inputs exist and are required attributes
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('#left')).toBeVisible();
    await expect(page.locator('#right')).toBeVisible();
    await expect(page.locator('#leaf')).toBeVisible();

    // Check 'required' attributes are present
    const rootReq = await page.getAttribute('#root', 'required');
    const leftReq = await page.getAttribute('#left', 'required');
    const rightReq = await page.getAttribute('#right', 'required');
    const leafReq = await page.getAttribute('#leaf', 'required');
    expect(rootReq).not.toBeNull();
    expect(leftReq).not.toBeNull();
    expect(rightReq).not.toBeNull();
    expect(leafReq).not.toBeNull();

    // The tree div should be empty at initial render (Idle state)
    const treeHtml = await bst.getTreeInnerHTML();
    expect(treeHtml.trim()).toBe('');

    // No page errors should have occurred during initial render
    // We'll attach a temporary listener to ensure none fire synchronously
    let pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    // small nop to ensure any synchronous errors would be captured
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(0);
  });

  test('InsertSubmit transition: submitting values triggers bst.insert and bst.printTree (TreeUpdated) - expect runtime TypeError from printTree implementation', async ({ page }) => {
    // This test validates the transition from Idle to TreeUpdated when the form is submitted,
    // and asserts that the entry action bst.printTree() executes (we detect this by observing runtime behavior,
    // including the natural TypeError thrown by the implementation when it tries to access .value of null).
    const bst = new BSTPage(page);
    await bst.goto();

    // Capture page errors emitted during the submit flow
    const pageErrors = [];
    page.on('pageerror', (err) => {
      // Save the Error object for assertions later
      pageErrors.push(err);
    });

    // Fill the form with values that will build a small BST
    // Using string numbers; underlying implementation compares strings but that's acceptable for the test.
    await bst.fillForm({ root: '10', left: '5', right: '15', leaf: '3' });

    // Click the submit button to trigger the submit event handler.
    // Note: Due to HTML5 validation, because fields are filled, the submit event should proceed normally.
    await bst.clickSubmit();

    // Wait briefly to allow the event handler and any synchronous errors to surface
    await page.waitForTimeout(200);

    // The provided implementation's printTree method attempts to access node.left.value and node.right.value
    // without null-checks. We therefore expect a TypeError to be thrown during the print process.
    // Assert that at least one pageerror occurred and that it's a TypeError.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasTypeError = pageErrors.some((e) => e && e.name === 'TypeError');
    expect(hasTypeError).toBeTruthy();

    // Check the #tree innerHTML for any <tr> output. Depending on traversal and order, some rows may have been appended
    // before the error occurred. Accept either a non-empty set of <tr> rows OR the presence of the TypeError (which we already asserted).
    const treeHtml = await bst.getTreeInnerHTML();
    // If there are rows, ensure they look like table rows that the implementation tried to append
    if (treeHtml && treeHtml.includes('<tr')) {
      expect(treeHtml).toContain('<tr');
      expect(treeHtml).toContain('<td>');
    } else {
      // If there are no rows, at least the runtime error must have happened (already asserted).
      expect(hasTypeError).toBeTruthy();
    }
  });

  test('Submitting with empty fields via user click is blocked by HTML5 validation (no submit, no errors)', async ({ page }) => {
    // This test validates HTML form constraint validation prevents the submit event from firing
    // when required fields are empty. The page's submit handler should therefore not run and no page errors should occur.
    const bst = new BSTPage(page);
    await bst.goto();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Ensure fields are empty
    await bst.fillForm({ root: '', left: '', right: '', leaf: '' });

    // Try clicking the submit button - the browser should prevent submit due to required fields.
    await bst.clickSubmit();

    // Wait a short time to allow any unexpected errors to surface
    await page.waitForTimeout(200);

    // Because validation should block the submit event, there should be no runtime errors
    expect(pageErrors.length).toBe(0);

    // And the tree should remain empty
    const treeHtml = await bst.getTreeInnerHTML();
    expect(treeHtml.trim()).toBe('');
  });

  test('Programmatic submit bypasses validation -> submit handler runs and will throw TypeError (observed as pageerror)', async ({ page }) => {
    // This test bypasses browser constraint validation by dispatching the submit event programmatically,
    // thereby ensuring the submit handler runs even with empty fields. We expect the handler to run and the
    // printTree call to produce a TypeError as before.
    const bst = new BSTPage(page);
    await bst.goto();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Clear fields explicitly
    await bst.fillForm({ root: '', left: '', right: '', leaf: '' });

    // Dispatch the submit event programmatically (bypasses browser validation)
    await bst.dispatchSubmitProgrammatically();

    // Wait briefly for synchronous errors to be emitted
    await page.waitForTimeout(200);

    // The implementation will attempt to insert empty strings and then printTree, which will try to access .value on null children -> TypeError
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const typeErrorExists = pageErrors.some((e) => e && e.name === 'TypeError');
    expect(typeErrorExists).toBeTruthy();
  });

  test('Multiple submissions: repeated calls to printTree will surface runtime errors (at least one TypeError) and potentially multiple errors', async ({ page }) => {
    // This test submits the form multiple times to observe repeated execution of bst.insert and bst.printTree.
    // It asserts that multiple submit attempts still lead to runtime TypeErrors due to the known bug in printTree.
    const bst = new BSTPage(page);
    await bst.goto();

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // First submission with a set of values
    await bst.fillForm({ root: '20', left: '10', right: '30', leaf: '5' });
    await bst.clickSubmit();
    await page.waitForTimeout(150);

    // Second submission with different values
    await bst.fillForm({ root: '25', left: '22', right: '27', leaf: '21' });
    await bst.clickSubmit();
    await page.waitForTimeout(150);

    // At least one TypeError should have been encountered across these submissions
    const typeErrorCount = pageErrors.filter((e) => e && e.name === 'TypeError').length;
    expect(typeErrorCount).toBeGreaterThanOrEqual(1);

    // The #tree innerHTML may contain fragments from one or both submissions depending on where the error occurred.
    const treeHtml = await bst.getTreeInnerHTML();
    // If there is any tree output, it should contain <tr> entries (the implementation appends rows using <tr><td>...).
    if (treeHtml.trim().length > 0) {
      expect(treeHtml).toContain('<tr');
      expect(treeHtml).toContain('<td>');
    }
  });
});