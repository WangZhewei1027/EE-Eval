import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79c0460-d361-11f0-8438-11a56595a476.html';

test.describe('Binary Search Tree (BST) Demonstration - FSM comprehensive tests', () => {
  // We'll capture runtime page errors and console errors for assertions.
  test.beforeEach(async ({ page }) => {
    // Attach listeners to collect errors
    page.context().setDefaultTimeout(5000);
  });

  // Helper to navigate and set up listeners capturing errors and console messages
  async function openPageAndMonitor(page) {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(APP_URL);

    // Return useful locators and error collectors
    return {
      pageErrors,
      consoleErrors,
      nodeInput: page.locator('#nodeValue'),
      insertBtn: page.locator('#insertBtn'),
      deleteBtn: page.locator('#deleteBtn'),
      searchBtn: page.locator('#searchBtn'),
      clearBtn: page.locator('#clearBtn'),
      messageDiv: page.locator('#message'),
      inorder: page.locator('#inorder'),
      preorder: page.locator('#preorder'),
      postorder: page.locator('#postorder'),
      levelorder: page.locator('#levelorder'),
      canvas: page.locator('#bstCanvas'),
      page,
    };
  }

  test('Initial Idle state: traversals empty, message empty, canvas present, no console/page errors', async ({ page }) => {
    // Validate initial S0_Idle state entry actions update traversal displays and drawBST
    const {
      pageErrors,
      consoleErrors,
      messageDiv,
      inorder,
      preorder,
      postorder,
      levelorder,
      canvas,
    } = await openPageAndMonitor(page);

    // Message should be empty on load
    await expect(messageDiv).toHaveText('');

    // Traversal displays should be empty
    await expect(inorder).toHaveText('');
    await expect(preorder).toHaveText('');
    await expect(postorder).toHaveText('');
    await expect(levelorder).toHaveText('');

    // Canvas should be present and have the specified width/height attributes
    await expect(canvas).toHaveAttribute('width', '900');
    await expect(canvas).toHaveAttribute('height', '400');

    // No runtime exceptions or console errors expected on initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Insertion flows (S0_Idle -> S1_NodeInserted and edge cases)', () => {
    test('Insert a node transitions to NodeInserted and updates traversals & message', async ({ page }) => {
      // Insert 10 and validate state S1_NodeInserted
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        insertBtn,
        messageDiv,
        inorder,
        preorder,
        postorder,
        levelorder,
      } = await openPageAndMonitor(page);

      await nodeInput.fill('10');
      await insertBtn.click();

      // Expect success message and green color
      await expect(messageDiv).toHaveText('Inserted 10 into the BST.');
      // The inline style color was set to 'green' for successful insert
      const color = await messageDiv.evaluate((el) => el.style.color);
      expect(color).toBe('green');

      // Traversals should reflect the single node
      await expect(inorder).toHaveText('10');
      await expect(preorder).toHaveText('10');
      await expect(postorder).toHaveText('10');
      await expect(levelorder).toHaveText('10');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Duplicate insert produces "already exists" message (edge case)', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        insertBtn,
        messageDiv,
        inorder,
      } = await openPageAndMonitor(page);

      // Insert 20 twice
      await nodeInput.fill('20');
      await insertBtn.click();
      await expect(messageDiv).toHaveText('Inserted 20 into the BST.');

      await nodeInput.fill('20');
      await insertBtn.click();

      // Duplicate message expected and red-ish color (#b33)
      await expect(messageDiv).toHaveText('Value 20 already exists in the BST.');
      const color = await messageDiv.evaluate((el) => el.style.color);
      // It was set to '#b33' for duplicates in implementation
      expect(color).toBe('#b33');

      // Traversals should still contain 20 once
      await expect(inorder).toHaveText('20');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Invalid insert input produces prompt message (S1_NodeInserted -> S0_Idle transition)', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        insertBtn,
        messageDiv,
      } = await openPageAndMonitor(page);

      // Start by inserting a valid node to reach NodeInserted
      await nodeInput.fill('5');
      await insertBtn.click();
      await expect(messageDiv).toHaveText('Inserted 5 into the BST.');

      // Now simulate invalid input (empty) and click insert to transition back to Idle with error prompt
      await nodeInput.fill(''); // empty value
      await insertBtn.click();

      await expect(messageDiv).toHaveText('Please enter a valid number to insert.');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Search flows (S0_Idle -> S3_NodeFound / S4_NodeNotFound)', () => {
    test('Searching for an existing node transitions to NodeFound and highlights node', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        insertBtn,
        searchBtn,
        messageDiv,
        inorder,
      } = await openPageAndMonitor(page);

      // Ensure a node exists to find
      await nodeInput.fill('30');
      await insertBtn.click();
      await expect(messageDiv).toHaveText('Inserted 30 into the BST.');
      await expect(inorder).toHaveText('30');

      // Search for existing node 30
      await nodeInput.fill('30');
      await searchBtn.click();

      // Found message with highlight mention
      await expect(messageDiv).toHaveText(/Value 30 found in the BST. Highlighting node\.\.\./);
      const color = await messageDiv.evaluate((el) => el.style.color);
      expect(color).toBe('green');

      // Traversals should remain unchanged
      await expect(inorder).toHaveText('30');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Searching for a non-existent node transitions to NodeNotFound', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        searchBtn,
        messageDiv,
        inorder,
      } = await openPageAndMonitor(page);

      // Ensure tree is empty or does not contain 999
      await nodeInput.fill('999');
      await searchBtn.click();

      await expect(messageDiv).toHaveText('Value 999 not found in the BST.');
      const color = await messageDiv.evaluate((el) => el.style.color);
      // Not found color set to '#b33'
      expect(color).toBe('#b33');

      // Traversals should remain as they were (likely empty)
      await expect(inorder).toHaveText('');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Invalid search input produces prompt message (S3_NodeFound -> S0_Idle and S4_NodeNotFound -> S0_Idle transitions)', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        insertBtn,
        searchBtn,
        messageDiv,
      } = await openPageAndMonitor(page);

      // First, create a found state
      await nodeInput.fill('42');
      await insertBtn.click();
      await expect(messageDiv).toHaveText('Inserted 42 into the BST.');

      await nodeInput.fill('42');
      await searchBtn.click();
      await expect(messageDiv).toHaveText(/Value 42 found in the BST. Highlighting node\.\.\./);

      // Now clear input and click search to trigger invalid input handling
      await nodeInput.fill('');
      await searchBtn.click();
      await expect(messageDiv).toHaveText('Please enter a valid number to search.');

      // Now produce a not-found state
      await nodeInput.fill('9999'); // value not in tree
      await searchBtn.click();
      await expect(messageDiv).toHaveText('Value 9999 not found in the BST.');

      // Clear input and click search again to provoke invalid input handling from NodeNotFound
      await nodeInput.fill('');
      await searchBtn.click();
      await expect(messageDiv).toHaveText('Please enter a valid number to search.');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Deletion flows (S0_Idle -> S2_NodeDeleted and edge cases)', () => {
    test('Delete existing node transitions to NodeDeleted and updates traversals', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        insertBtn,
        deleteBtn,
        messageDiv,
        inorder,
      } = await openPageAndMonitor(page);

      // Insert then delete 77
      await nodeInput.fill('77');
      await insertBtn.click();
      await expect(messageDiv).toHaveText('Inserted 77 into the BST.');
      await expect(inorder).toHaveText('77');

      await nodeInput.fill('77');
      await deleteBtn.click();

      await expect(messageDiv).toHaveText('Deleted 77 from the BST.');
      const color = await messageDiv.evaluate((el) => el.style.color);
      expect(color).toBe('green');

      // Traversals should be empty after deletion
      await expect(inorder).toHaveText('');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Deleting non-existent node shows not found message', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        deleteBtn,
        messageDiv,
      } = await openPageAndMonitor(page);

      await nodeInput.fill('12345'); // assumed not present
      await deleteBtn.click();

      await expect(messageDiv).toHaveText('Value 12345 not found in the BST.');
      const color = await messageDiv.evaluate((el) => el.style.color);
      expect(color).toBe('#b33');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Invalid delete input produces prompt (S2_NodeDeleted -> S0_Idle transition)', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        insertBtn,
        deleteBtn,
        messageDiv,
      } = await openPageAndMonitor(page);

      // Insert then delete to reach NodeDeleted
      await nodeInput.fill('88');
      await insertBtn.click();
      await expect(messageDiv).toHaveText('Inserted 88 into the BST.');

      await nodeInput.fill('88');
      await deleteBtn.click();
      await expect(messageDiv).toHaveText('Deleted 88 from the BST.');

      // Now clear input and click delete to provoke invalid input message
      await nodeInput.fill('');
      await deleteBtn.click();
      await expect(messageDiv).toHaveText('Please enter a valid number to delete.');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Clear Tree flows (S0_Idle <-> S5_TreeCleared)', () => {
    test('Clear tree transitions to TreeCleared and empties traversals', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        nodeInput,
        insertBtn,
        clearBtn,
        messageDiv,
        inorder,
        preorder,
        postorder,
        levelorder,
      } = await openPageAndMonitor(page);

      // Insert some nodes
      await nodeInput.fill('1');
      await insertBtn.click();
      await nodeInput.fill('2');
      await insertBtn.click();
      await expect(inorder).toHaveText(/1, 2|1,2/); // allow for spacing variations

      // Clear the tree
      await clearBtn.click();

      // Message and color expectation for clear
      await expect(messageDiv).toHaveText('BST cleared.');
      const color = await messageDiv.evaluate((el) => el.style.color);
      expect(color).toBe('black');

      // Traversals should be cleared
      await expect(inorder).toHaveText('');
      await expect(preorder).toHaveText('');
      await expect(postorder).toHaveText('');
      await expect(levelorder).toHaveText('');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clearing an already cleared tree remains in TreeCleared -> S0_Idle transition behavior (idempotency)', async ({ page }) => {
      const {
        pageErrors,
        consoleErrors,
        clearBtn,
        messageDiv,
      } = await openPageAndMonitor(page);

      // First clear
      await clearBtn.click();
      await expect(messageDiv).toHaveText('BST cleared.');

      // Clear again - should still report 'BST cleared.'
      await clearBtn.click();
      await expect(messageDiv).toHaveText('BST cleared.');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test('Canvas rendering is invoked on operations (visual smoke test) and no runtime errors occur', async ({ page }) => {
    // This test ensures drawBST and compute functions run without throwing errors during normal operations.
    const {
      pageErrors,
      consoleErrors,
      nodeInput,
      insertBtn,
      searchBtn,
      deleteBtn,
      clearBtn,
      messageDiv,
      canvas,
      page: p,
    } = await openPageAndMonitor(page);

    // Do a sequence of operations to force canvas drawing code paths
    await nodeInput.fill('50');
    await insertBtn.click();
    await nodeInput.fill('25');
    await insertBtn.click();
    await nodeInput.fill('75');
    await insertBtn.click();

    // Search for node (highlight path)
    await nodeInput.fill('25');
    await searchBtn.click();
    await expect(messageDiv).toHaveText(/Value 25 found in the BST. Highlighting node\.\.\./);

    // Delete a node with two children or leaf to exercise delete drawing
    await nodeInput.fill('50');
    await deleteBtn.click();
    await expect(messageDiv).toHaveText('Deleted 50 from the BST.');

    // Clear tree to exercise empty-draw
    await clearBtn.click();
    await expect(messageDiv).toHaveText('BST cleared.');

    // The canvas should still be present and accessible
    await expect(canvas).toBeVisible();

    // No runtime page errors or console errors throughout visualization activities
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});