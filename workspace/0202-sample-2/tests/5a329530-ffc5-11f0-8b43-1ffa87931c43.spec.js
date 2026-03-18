import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a329530-ffc5-11f0-8b43-1ffa87931c43.html';

test.describe('BST Demo - FSM states and transitions (5a329530-ffc5-11f0-8b43-1ffa87931c43)', () => {
  // Arrays to capture console and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Helper page object methods
  const selectors = {
    input: '#valueInput',
    insertBtn: '#insertBtn',
    searchBtn: '#searchBtn',
    deleteBtn: '#deleteBtn',
    clearBtn: '#clearBtn',
    message: '#message',
    inorderList: '#inorderList',
    preorderList: '#preorderList',
    postorderList: '#postorderList',
    svg: '#treeSVG',
    nodeGroups: 'g.node',
  };

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console events
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the served HTML exactly as-is
    await page.goto(BASE_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Assert that there were no uncaught page errors
    // This checks that the page executed without throwing uncaught exceptions.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join('; ')}`).toEqual([]);
    // Also assert there were no console error messages
    expect(consoleErrors, `Console errors were logged: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // Utility functions interacting with the DOM via Playwright locators
  async function getMessageText(page) {
    return (await page.locator(selectors.message).textContent())?.trim() ?? '';
  }

  async function getInorderText(page) {
    return (await page.locator(selectors.inorderList).textContent())?.trim() ?? '';
  }

  async function getPreorderText(page) {
    return (await page.locator(selectors.preorderList).textContent())?.trim() ?? '';
  }

  async function getPostorderText(page) {
    return (await page.locator(selectors.postorderList).textContent())?.trim() ?? '';
  }

  async function getSvgNodeCount(page) {
    return await page.locator(`${selectors.svg} ${selectors.nodeGroups}`).count();
  }

  async function findSvgNodeGroupByValue(page, value) {
    // returns the first matching group element whose child text node equals the value
    const groups = page.locator(`${selectors.svg} ${selectors.nodeGroups}`);
    const count = await groups.count();
    for (let i = 0; i < count; i++) {
      const group = groups.nth(i);
      const text = (await group.locator('text').textContent()).trim();
      if (text === String(value)) return group;
    }
    return null;
  }

  test('Idle state on load: display initialized and shows Empty traversal lists', async ({ page }) => {
    // Validate Idle state (S0_Idle): updateDisplay() called on load, traversals empty, no message
    const msg = await getMessageText(page);
    expect(msg).toBe('', 'Expected no initial message in Idle state');

    const inorder = await getInorderText(page);
    const preorder = await getPreorderText(page);
    const postorder = await getPostorderText(page);

    expect(inorder).toBe('Empty', 'Expected in-order to indicate Empty on idle');
    expect(preorder).toBe('Empty', 'Expected pre-order to indicate Empty on idle');
    expect(postorder).toBe('Empty', 'Expected post-order to indicate Empty on idle');

    // SVG should be empty since no nodes present
    const svgNodeCount = await getSvgNodeCount(page);
    expect(svgNodeCount).toBe(0);
  });

  test('Insert event - S1_ValueInserted: inserting a value updates traversals, message, and visualization', async ({ page }) => {
    // Insert value 50
    await page.fill(selectors.input, '50');
    await page.click(selectors.insertBtn);

    // Validate message and that input cleared
    const msg = await getMessageText(page);
    expect(msg).toBe('Inserted 50 into BST.');

    const inputVal = await page.locator(selectors.input).inputValue();
    expect(inputVal).toBe('', 'Expected input to be cleared after insertion');

    // Traversals should reflect the single node
    const inorder = await getInorderText(page);
    const preorder = await getPreorderText(page);
    const postorder = await getPostorderText(page);

    expect(inorder).toBe('50');
    expect(preorder).toBe('50');
    expect(postorder).toBe('50');

    // Visualization should have one node with the text 50
    const svgNodeCount = await getSvgNodeCount(page);
    expect(svgNodeCount).toBe(1);

    const group = await findSvgNodeGroupByValue(page, 50);
    expect(group, 'SVG group with text 50 should exist').not.toBeNull();

    // The circle and text should be present under the group
    const circle = group.locator('circle');
    await expect(circle).toHaveAttribute('r', value => value === '20' || value === '20'); // radius set
  });

  test('Insert duplicate value shows duplicate message and does not change tree', async ({ page }) => {
    // Precondition: insert 50
    await page.fill(selectors.input, '50');
    await page.click(selectors.insertBtn);

    // Try to insert duplicate 50
    await page.fill(selectors.input, '50');
    await page.click(selectors.insertBtn);

    // Expect duplicate message and tree unchanged (still one node 50)
    const msg = await getMessageText(page);
    expect(msg).toBe('Value already exists in the BST.');

    const inorder = await getInorderText(page);
    expect(inorder).toBe('50');

    const svgNodeCount = await getSvgNodeCount(page);
    expect(svgNodeCount).toBe(1);
  });

  test('Insert multiple values to form a tree and verify in-order traversal ordering', async ({ page }) => {
    // Insert 50, 30, 70
    await page.fill(selectors.input, '50');
    await page.click(selectors.insertBtn);

    await page.fill(selectors.input, '30');
    await page.click(selectors.insertBtn);

    await page.fill(selectors.input, '70');
    await page.click(selectors.insertBtn);

    // In-order should be sorted: 30, 50, 70
    const inorder = await getInorderText(page);
    expect(inorder).toBe('30, 50, 70');

    // Pre-order and post-order should be non-empty and consistent with tree shape
    const preorder = await getPreorderText(page);
    const postorder = await getPostorderText(page);
    expect(preorder).toBeTruthy();
    expect(postorder).toBeTruthy();

    // SVG should have 3 nodes
    const svgNodeCount = await getSvgNodeCount(page);
    expect(svgNodeCount).toBe(3);
  });

  test('Search event - S2_ValueFound and S3_ValueNotFound: searching highlights node when found and shows messages appropriately', async ({ page }) => {
    // Precondition: build tree 50,30,70
    await page.fill(selectors.input, '50');
    await page.click(selectors.insertBtn);
    await page.fill(selectors.input, '30');
    await page.click(selectors.insertBtn);
    await page.fill(selectors.input, '70');
    await page.click(selectors.insertBtn);

    // Search for existing value 30 -> should highlight and show found message
    await page.fill(selectors.input, '30');
    await page.click(selectors.searchBtn);

    let msg = await getMessageText(page);
    expect(msg).toBe('Value 30 found in the BST.');

    // Node with value 30 should be highlighted (fill attribute equals highlight color)
    const group30 = await findSvgNodeGroupByValue(page, 30);
    expect(group30, 'SVG group for value 30 should exist').not.toBeNull();
    const circle30 = group30.locator('circle');
    // highlight color defined as "#e94e77" in drawNode when highlight true
    await expect(circle30).toHaveAttribute('fill', '#e94e77');

    // Search for non-existent value 999 -> show not found message and no highlight for a value 999
    await page.fill(selectors.input, '999');
    await page.click(selectors.searchBtn);

    msg = await getMessageText(page);
    expect(msg).toBe('Value 999 not found in the BST.');

    // Ensure highlight for 999 does not exist (no node)
    const group999 = await findSvgNodeGroupByValue(page, 999);
    expect(group999).toBeNull();
  });

  test('Delete event - S4_ValueDeleted and S5_ValueNotFoundForDeletion: deleting existing and non-existing values behaves correctly', async ({ page }) => {
    // Build tree with 50 and 30
    await page.fill(selectors.input, '50');
    await page.click(selectors.insertBtn);
    await page.fill(selectors.input, '30');
    await page.click(selectors.insertBtn);

    // Delete existing value 30
    await page.fill(selectors.input, '30');
    await page.click(selectors.deleteBtn);

    let msg = await getMessageText(page);
    expect(msg).toBe('Deleted value 30 from BST.');

    // Input should be cleared after successful deletion
    const inputValAfterDelete = await page.locator(selectors.input).inputValue();
    expect(inputValAfterDelete).toBe('', 'Expected input cleared after successful deletion');

    // In-order should no longer contain 30
    const inorderAfterDelete = await getInorderText(page);
    expect(inorderAfterDelete).toBe('50');

    // Delete non-existing value 999 -> should show not found message and keep tree unchanged
    await page.fill(selectors.input, '999');
    await page.click(selectors.deleteBtn);

    msg = await getMessageText(page);
    expect(msg).toBe('Value 999 not found in the BST.');

    const inorderFinal = await getInorderText(page);
    expect(inorderFinal).toBe('50');
  });

  test('Clear event - S6_TreeCleared: clearing the tree resets traversals and visualization', async ({ page }) => {
    // Build a small tree
    await page.fill(selectors.input, '50');
    await page.click(selectors.insertBtn);
    await page.fill(selectors.input, '40');
    await page.click(selectors.insertBtn);

    // Click clear
    await page.click(selectors.clearBtn);

    // Message and input cleared
    const msg = await getMessageText(page);
    expect(msg).toBe('Cleared the BST.');

    const inputVal = await page.locator(selectors.input).inputValue();
    expect(inputVal).toBe('', 'Expected input cleared after clearing tree');

    // Traversals show Empty and SVG has 0 nodes
    const inorder = await getInorderText(page);
    expect(inorder).toBe('Empty');

    const svgNodeCount = await getSvgNodeCount(page);
    expect(svgNodeCount).toBe(0);
  });

  test('EnterKeyInsert event - Enter key triggers Insert (S1_ValueInserted) and behaves like clicking insert', async ({ page }) => {
    // Type 10 in input and press Enter
    const input = page.locator(selectors.input);
    await input.fill('10');
    await input.press('Enter');

    // Should insert 10
    let msg = await getMessageText(page);
    expect(msg).toBe('Inserted 10 into BST.');

    const inorder = await getInorderText(page);
    expect(inorder).toBe('10');

    // Ensure SVG node exists
    const group10 = await findSvgNodeGroupByValue(page, 10);
    expect(group10).not.toBeNull();
  });

  test('Edge cases: invalid/empty input shows validation message; non-number handled gracefully', async ({ page }) => {
    // Clicking insert with empty input
    await page.fill(selectors.input, '');
    await page.click(selectors.insertBtn);
    let msg = await getMessageText(page);
    expect(msg).toBe('Please enter a valid number.');

    // Clicking search with empty input
    await page.fill(selectors.input, '');
    await page.click(selectors.searchBtn);
    msg = await getMessageText(page);
    expect(msg).toBe('Please enter a valid number.');

    // Clicking delete with empty input
    await page.fill(selectors.input, '');
    await page.click(selectors.deleteBtn);
    msg = await getMessageText(page);
    expect(msg).toBe('Please enter a valid number.');

    // Try entering a non-numeric string into the number input (Playwright will set it as text)
    // The application uses Number(input.value) and isNaN checks, so it should display validation message.
    await page.fill(selectors.input, 'not-a-number');
    await page.click(selectors.insertBtn);
    msg = await getMessageText(page);
    expect(msg).toBe('Please enter a valid number.');
  });
});