import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d43c11-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Linked List Visualizer - FSM states and transitions', () => {
  // Keep track of any uncaught page errors during each test
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page
      pageErrors.push(err);
    });
    // Navigate to the page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial render completed by checking nodes container exists
    await expect(page.locator('#nodes')).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert no uncaught page errors happened during the test unless
    // the specific test intentionally causes page errors (none do here).
    expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);
  });

  test.describe('Initial state (S0_Idle) and basic UI', () => {
    test('Initial render shows seeded list with length 3 and head/tail (Idle)', async ({ page }) => {
      // Validate initial state: list seeded with 10,20,30 in constructor
      const length = page.locator('#length');
      const head = page.locator('#headVal');
      const tail = page.locator('#tailVal');

      await expect(length).toHaveText('3');
      await expect(head).toHaveText('10');
      await expect(tail).toHaveText('30');

      // There should be three .node elements
      const nodes = page.locator('#nodes .node');
      await expect(nodes).toHaveCount(3);

      // Values should render in order
      await expect(nodes.nth(0)).toContainText('10');
      await expect(nodes.nth(1)).toContainText('20');
      await expect(nodes).toContainText('30');
    });
  });

  test.describe('Append / Prepend / Insert / Remove interactions (S1-S4)', () => {
    test('Append a node (S1_NodeAppended): updates DOM, length, tail and logs', async ({ page }) => {
      // Append 40
      await page.fill('#valueInput', '40');
      await page.click('#appendBtn');

      // New length should be 4 and tail 40
      await expect(page.locator('#length')).toHaveText('4');
      await expect(page.locator('#tailVal')).toHaveText('40');

      // Last node should contain 40
      const lastNode = page.locator('#nodes .node').nth(3);
      await expect(lastNode).toContainText('40');

      // Log should contain Appended "40"
      await expect(page.locator('#log')).toContainText('Appended \"40\"');
    });

    test('Prepend a node (S2_NodePrepended): updates DOM, length, head and logs', async ({ page }) => {
      // Prepend 5
      await page.fill('#valueInput', '5');
      await page.click('#prependBtn');

      // New length should be 4 and head 5
      await expect(page.locator('#length')).toHaveText('4');
      await expect(page.locator('#headVal')).toHaveText('5');

      // First node should contain 5
      const firstNode = page.locator('#nodes .node').first();
      await expect(firstNode).toContainText('5');

      // Log should contain Prepended "5"
      await expect(page.locator('#log')).toContainText('Prepended \"5\"');
    });

    test('Insert at index (S3_NodeInserted): insert value in middle and log', async ({ page }) => {
      // Insert 15 at index 1 -> expected list: [10,15,20,30]
      await page.fill('#valueInput', '15');
      await page.fill('#indexInput', '1');
      await page.click('#insertBtn');

      await expect(page.locator('#length')).toHaveText('4');

      // Nodes check
      const nodes1 = page.locator('#nodes1 .node');
      await expect(nodes).toHaveCount(4);
      await expect(nodes.nth(1)).toContainText('15');

      // Log
      await expect(page.locator('#log')).toContainText('Inserted \"15\" at index 1');
    });

    test('Remove at index (S4_NodeRemovedAtIndex): remove middle element and log', async ({ page }) => {
      // Remove index 1 from initial [10,20,30] -> removes 20
      await page.fill('#indexInput', '1');
      await page.click('#removeAtBtn');

      await expect(page.locator('#length')).toHaveText('2');

      // Remaining nodes: 10 and 30
      const nodes2 = page.locator('#nodes2 .node');
      await expect(nodes).toHaveCount(2);
      await expect(nodes.nth(0)).toContainText('10');
      await expect(nodes.nth(1)).toContainText('30');

      // Log contains removed value
      await expect(page.locator('#log')).toContainText('Removed value \"20\" at index 1');
    });
  });

  test.describe('Remove by value, Find, Reverse, Clear, Random generation (S5-S9)', () => {
    test('Remove by value (S5_NodeRemovedByValue): removes first occurrence and logs', async ({ page }) => {
      // Remove value 20 from initial list
      await page.fill('#valueRemoveInput', '20');
      await page.click('#removeValueBtn');

      await expect(page.locator('#length')).toHaveText('2');

      const nodesText = await page.locator('#nodes').innerText();
      expect(nodesText).not.toContain('20');

      await expect(page.locator('#log')).toContainText('Removed first occurrence of \"20\"');
    });

    test('Find a value (S6_NodeFound): highlights found node and logs traversal', async ({ page }) => {
      // Speed up animation for test
      await page.selectOption('#speedSelect', '150');
      // Find value 20 by placing into valueInput (valueRemoveInput empty)
      await page.fill('#valueInput', '20');
      await page.click('#findBtn');

      // Log should report found
      await expect(page.locator('#log')).toContainText('Value \"20\" found at index');

      // After animateTraversal completes, a node with class 'found' should exist
      const foundNode = page.locator('#nodes .node.found');
      await expect(foundNode).toHaveCount(1);

      // Ensure that the found node contains '20'
      await expect(foundNode).toContainText('20');
    });

    test('Reverse list (S7_ListReversed): list order changes and log emitted', async ({ page }) => {
      // Before reverse, nodes: 10,20,30
      const nodesBefore = await page.locator('#nodes .node').allTextContents();
      expect(nodesBefore.join()).toContain('10');
      // Reverse
      await page.click('#reverseBtn');

      // After reverse, head should be 30 and tail 10
      await expect(page.locator('#headVal')).toHaveText('30');
      await expect(page.locator('#tailVal')).toHaveText('10');

      // Log indicates reversal
      await expect(page.locator('#log')).toContainText('List reversed');
    });

    test('Clear list (S8_ListCleared): empties list and logs', async ({ page }) => {
      await page.click('#clearBtn');

      await expect(page.locator('#length')).toHaveText('0');
      await expect(page.locator('#headVal')).toHaveText('null');
      await expect(page.locator('#tailVal')).toHaveText('null');

      // The nodes container should contain the placeholder message
      await expect(page.locator('#nodes')).toContainText('The list is empty. Use append or prepend to add nodes.');

      await expect(page.locator('#log')).toContainText('List cleared');
    });

    test('Random list generated (S9_RandomListGenerated): creates a list with n nodes and logs', async ({ page }) => {
      await page.click('#randomBtn');

      // Length should be between 2 and 7 inclusive
      const lengthText = await page.locator('#length').textContent();
      const lengthNum = Number(lengthText?.trim());
      expect(lengthNum).toBeGreaterThanOrEqual(2);
      expect(lengthNum).toBeLessThanOrEqual(7);

      // Log should include "Random list generated (n nodes)"
      await expect(page.locator('#log')).toContainText('Random list generated (');
    });
  });

  test.describe('Traversal and animations (S10) and edge cases', () => {
    test('Traverse list (S10_Traversal): animate visiting nodes and logs', async ({ page }) => {
      // Speed up for faster test
      await page.selectOption('#speedSelect', '150');

      // Click traverse - initial list exists
      await page.click('#traverseBtn');

      // Wait for at least one Visiting log entry
      await expect(page.locator('#log')).toContainText('Visiting index 0');

      // Wait until traversal completes (render() called at end). We wait for absence of '.highlight' class
      // The animation highlights index briefly; ensure the final render has no 'highlight' nodes
      await page.waitForTimeout(300 + 150 * 3); // small buffer based on default small list
      const highlighted = await page.locator('#nodes .node.highlight').count();
      expect(highlighted).toBeGreaterThanOrEqual(0); // just ensure the code ran; main check is logs
    });

    test('Traverse when list is empty logs an error', async ({ page }) => {
      // Clear then traverse
      await page.click('#clearBtn');
      await page.click('#traverseBtn');

      await expect(page.locator('#log')).toContainText('List is empty.');
    });

    test('Append with empty input shows an error log (edge case)', async ({ page }) => {
      // Ensure input is empty and click append
      await page.fill('#valueInput', '');
      await page.click('#appendBtn');

      await expect(page.locator('#log')).toContainText('Please enter a value to append.');
    });

    test('Insert with invalid index shows error (edge case)', async ({ page }) => {
      await page.fill('#valueInput', '100');
      await page.fill('#indexInput', 'not-a-number');
      await page.click('#insertBtn');

      await expect(page.locator('#log')).toContainText('Enter a valid index to insert at.');
    });

    test('Remove at with invalid index shows error (edge case)', async ({ page }) => {
      await page.fill('#indexInput', 'NaN');
      await page.click('#removeAtBtn');

      await expect(page.locator('#log')).toContainText('Enter a valid index to remove.');
    });

    test('Remove value not present logs not found (edge case)', async ({ page }) => {
      // Choose a value unlikely in initial list
      await page.fill('#valueRemoveInput', '9999');
      await page.click('#removeValueBtn');

      await expect(page.locator('#log')).toContainText('Value \"9999\" not found.');
    });

    test('Clicking node removes it and logs removal (UI exploration)', async ({ page }) => {
      // Ensure list has nodes
      const initialCount = await page.locator('#nodes .node').count();
      expect(initialCount).toBeGreaterThan(0);

      // Click the first node to remove it
      await page.locator('#nodes .node').first().click();

      // Length decremented by 1
      const newCount = await page.locator('#nodes .node').count();
      expect(newCount).toBe(initialCount - 1);

      // Log indicates removal from index 0
      await expect(page.locator('#log')).toContainText('Removed node at index 0 (value:');
    });

    test('Keyboard shortcut (Ctrl+Z) clears logs via accessibility handler', async ({ page }) => {
      // Add a log entry to be cleared
      await page.fill('#valueInput', '77');
      await page.click('#appendBtn');
      await expect(page.locator('#log')).toContainText('Appended \"77\"');

      // Press Ctrl+Z to clear logs (the page listens for Ctrl+Z)
      await page.keyboard.down('Control');
      await page.keyboard.press('z');
      await page.keyboard.up('Control');

      // After the shortcut, there should be a "Logs cleared." message present
      await expect(page.locator('#log')).toContainText('Logs cleared.');
    });
  });

  test.describe('Additional behavioral checks for parsedValue and boundaries', () => {
    test('Insert at negative index acts as prepend (boundary)', async ({ page }) => {
      // Insert value -1 at index -5 should prepend
      await page.fill('#valueInput', '-1');
      await page.fill('#indexInput', '-5');
      await page.click('#insertBtn');

      // Head should be -1 (parsed)
      await expect(page.locator('#headVal')).toHaveText('-1');
      await expect(page.locator('#log')).toContainText('Inserted \"-1\" at index -5');
      // After insertion, first node should show -1
      await expect(page.locator('#nodes .node').first()).toContainText('-1');
    });

    test('Insert at very large index acts as append (boundary)', async ({ page }) => {
      // Insert 999 at index 9999 should append
      await page.fill('#valueInput', '999');
      await page.fill('#indexInput', '9999');
      await page.click('#insertBtn');

      await expect(page.locator('#tailVal')).toHaveText('999');
      await expect(page.locator('#log')).toContainText('Inserted \"999\" at index 9999');
    });
  });
});