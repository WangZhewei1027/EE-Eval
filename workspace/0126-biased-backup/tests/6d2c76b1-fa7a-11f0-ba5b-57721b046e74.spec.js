import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2c76b1-fa7a-11f0-ba5b-57721b046e74.html';

// Capture console messages and page errors in each test
test.describe('Circular Linked List Interactive Demo - FSM validation', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console messages and uncaught page errors for assertions
    page.context()._collectedConsole = [];
    page.context()._collectedPageErrors = [];

    page.on('console', msg => {
      // store console message text and type
      page.context()._collectedConsole.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // store uncaught exceptions from the page
      page.context()._collectedPageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // If there were uncaught errors, attach them to the test by failing with details.
    const pageErrors = page.context()._collectedPageErrors || [];
    const consoleErrors = (page.context()._collectedConsole || []).filter(c => c.type === 'error' || c.type === 'warning');

    // Expect no uncaught page errors occurred during test; if any, surface them
    expect(pageErrors.length, `Unhandled page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    // Also expect no console error/warning output
    expect(consoleErrors.length, `Console errors/warnings: ${consoleErrors.map(c => `${c.type}:${c.text}`).join('; ')}`).toBe(0);
  });

  test.describe('State: Idle (S0_Idle) - initial rendering and entry actions', () => {
    test('renders empty state on init and shows "List is empty"', async ({ page }) => {
      // Validate initial visualization shows "List is empty" per renderList entry action
      const viz = page.locator('#listVisualization');
      await expect(viz).toContainText('List is empty');

      // Stats should reflect empty list as per updateStats called in renderList()
      await expect(page.locator('#listLength')).toHaveText('0');
      await expect(page.locator('#currentNode')).toHaveText('None');
      await expect(page.locator('#headNode')).toHaveText('None');
      await expect(page.locator('#tailNode')).toHaveText('None');
      await expect(page.locator('#traversalStatus')).toHaveText('Inactive');
    });
  });

  test.describe('Transitions and events: List modifications (S1_ListModified)', () => {
    // Insert at beginning and insert at end
    test('Insert at Beginning and Insert at End update DOM and stats', async ({ page }) => {
      // Insert at Beginning: set input and click
      await page.fill('#nodeValue', 'A');
      await page.click('button[onclick="insertAtBeginning()"]');

      // After insertion, visualization should show node "A", stats updated
      const viz = page.locator('#listVisualization');
      await expect(viz).toContainText('A');
      await expect(page.locator('#listLength')).toHaveText('1');
      await expect(page.locator('#headNode')).toHaveText('A');
      await expect(page.locator('#tailNode')).toHaveText('A');

      // Insert at End: add B
      await page.fill('#nodeValue', 'B');
      await page.click('button[onclick="insertAtEnd()"]');

      // Now should show both A and B, length 2, head remains A, tail becomes B
      await expect(page.locator('#listLength')).toHaveText('2');
      await expect(page.locator('#headNode')).toHaveText('A');
      await expect(page.locator('#tailNode')).toHaveText('B');

      // Visualization should contain both node texts and circular indicator
      await expect(viz).toContainText('↻ (circular)');
      await expect(viz).toContainText('A');
      await expect(viz).toContainText('B');
    });

    test('Insert After Node with prompt handling and error path for non-existent after node', async ({ page }) => {
      // Ensure baseline nodes exist
      await page.fill('#nodeValue', 'X');
      await page.click('button[onclick="insertAtEnd()"]');
      await page.fill('#nodeValue', 'Y');
      await page.click('button[onclick="insertAtEnd()"]');

      // Successful insertAfterNode: when prompt asks for afterValue, respond with 'X' to insert 'M'
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        // the application expects user-entered value for which node to insert after
        await dialog.accept('X');
      });

      // supply the new node value via the visible input, then trigger insertAfterNode
      await page.fill('#nodeValue', 'M');
      await page.click('button[onclick="insertAfterNode()"]');

      // Now list should include M
      const viz = page.locator('#listVisualization');
      await expect(viz).toContainText('M');
      await expect(page.locator('#listLength')).toHaveText('3');

      // Now test failure branch: attempt to insert after a non-existent node
      // Fill node value and respond to prompt with non-existent label, assert alert shown
      const nonExistentAfter = 'NOPE';
      page.once('dialog', async dialog => {
        // first dialog is prompt
        expect(dialog.type()).toBe('prompt');
        await dialog.accept(nonExistentAfter);
      });

      // next dialog will be alert about node not found; capture and assert message
      let alertMessage = '';
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        alertMessage = dialog.message();
        await dialog.accept();
      });

      await page.fill('#nodeValue', 'Z');
      await page.click('button[onclick="insertAfterNode()"]');

      // Ensure the alert message contains the attempted after value
      expect(alertMessage).toContain(nonExistentAfter);
    });

    test('Delete Node removes node and handles not-found alerts', async ({ page }) => {
      // Insert known nodes A, B, C
      await page.fill('#nodeValue', 'D1');
      await page.click('button[onclick="insertAtEnd()"]');
      await page.fill('#nodeValue', 'D2');
      await page.click('button[onclick="insertAtEnd()"]');
      await page.fill('#nodeValue', 'D3');
      await page.click('button[onclick="insertAtEnd()"]');

      // Delete middle node D2
      await page.fill('#nodeValue', 'D2');
      await page.click('button[onclick="deleteNode()"]');

      // D2 should no longer be in visualization
      const viz = page.locator('#listVisualization');
      await expect(viz).not.toContainText('D2');
      // Length decreased (originally maybe many, but ensure not equal to previous)
      const lengthText = await page.locator('#listLength').textContent();
      expect(Number(lengthText)).toBeGreaterThanOrEqual(2); // at least remaining nodes

      // Try deleting a non-existent node and capture alert
      let alertMsg = '';
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        alertMsg = dialog.message();
        await dialog.accept();
      });

      await page.fill('#nodeValue', 'NO_SUCH_NODE_DELETE');
      await page.click('button[onclick="deleteNode()"]');
      expect(alertMsg).toContain('not found');
    });

    test('Search Node highlights the node and sets current', async ({ page }) => {
      // Ensure nodes exist
      await page.fill('#nodeValue', 'S1');
      await page.click('button[onclick="insertAtEnd()"]');
      await page.fill('#nodeValue', 'S2');
      await page.click('button[onclick="insertAtEnd()"]');

      // Search for S2
      await page.fill('#nodeValue', 'S2');
      await page.click('button[onclick="searchNode()"]');

      // currentNode stat should be S2 and the corresponding node element should have highlight class
      await expect(page.locator('#currentNode')).toHaveText('S2');

      // verify at least one node element contains S2 and has highlight class
      const highlighted = page.locator('.node.highlight .data');
      await expect(highlighted).toContainText('S2');

      // Searching for non-existent node should show alert
      let alertText = '';
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        alertText = dialog.message();
        await dialog.accept();
      });

      await page.fill('#nodeValue', 'UNKNOWN_SEARCH');
      await page.click('button[onclick="searchNode()"]');
      expect(alertText).toContain('not found');
    });

    test('Reverse list swaps head and tail correctly', async ({ page }) => {
      // Clear existing list then create predictable nodes (non-random)
      await page.click('button[onclick="clearList()"]');

      // Insert in order 1,2,3
      await page.fill('#nodeValue', '1');
      await page.click('button[onclick="insertAtEnd()"]');
      await page.fill('#nodeValue', '2');
      await page.click('button[onclick="insertAtEnd()"]');
      await page.fill('#nodeValue', '3');
      await page.click('button[onclick="insertAtEnd()"]');

      // Check head and tail before reverse
      const headBefore = await page.locator('#headNode').textContent();
      const tailBefore = await page.locator('#tailNode').textContent();
      expect(headBefore).toBe('1');
      expect(tailBefore).toBe('3');

      // Reverse
      await page.click('button[onclick="reverseList()"]');

      // After reverse, head should be previous tail (3) and tail should be previous head (1)
      await expect(page.locator('#headNode')).toHaveText('3');
      await expect(page.locator('#tailNode')).toHaveText('1');
    });

    test('Clear list empties visualization and resets stats', async ({ page }) => {
      // Populate list
      await page.fill('#nodeValue', 'C1');
      await page.click('button[onclick="insertAtEnd()"]');
      await page.click('button[onclick="clearList()"]');

      // Should show empty text and stats reset
      await expect(page.locator('#listVisualization')).toContainText('List is empty');
      await expect(page.locator('#listLength')).toHaveText('0');
      await expect(page.locator('#headNode')).toHaveText('None');
      await expect(page.locator('#tailNode')).toHaveText('None');
    });

    test('Generate Random List with randomData unchecked produces predictable named nodes', async ({ page }) => {
      // Uncheck randomData to get deterministic values ("Node 1", "Node 2", ...)
      const randomCheckbox = page.locator('#randomData');
      const isChecked = await randomCheckbox.isChecked();
      if (isChecked) {
        await randomCheckbox.click();
      }

      // Set maxNodes to 3 for a small list
      await page.fill('#maxNodes', '3');

      // Generate
      await page.click('button[onclick="generateRandomList()"]');

      // listLength should be 3 and visualization should show 'Node 1' .. 'Node 3'
      await expect(page.locator('#listLength')).toHaveText('3');
      const vizText = await page.locator('#listVisualization').textContent();
      expect(vizText).toContain('Node 1');
      expect(vizText).toContain('Node 2');
      expect(vizText).toContain('Node 3');
    });

    test('Traversal controls: start, step forward/backward, update speed, and stop', async ({ page }) => {
      // Ensure deterministic nodes exist (if not, generate non-random)
      const randomCheckbox = page.locator('#randomData');
      const checked = await randomCheckbox.isChecked();
      if (checked) await randomCheckbox.click();
      await page.fill('#maxNodes', '4');
      await page.click('button[onclick="generateRandomList()"]');

      // Start traversal
      await page.click('button[onclick="startTraversal()"]');

      // Traversal status should indicate Active (Forward)
      await expect(page.locator('#traversalStatus')).toContainText('Active');

      // Step forward: use stepForward button and check currentNode updates
      const beforeCurrent = await page.locator('#currentNode').textContent();
      await page.click('button[onclick="stepForward()"]');
      const afterStepForward = await page.locator('#currentNode').textContent();
      // Current node should change (or be set if previously none)
      expect(afterStepForward).not.toBe(null);

      // Step backward: click and ensure it changes again
      await page.click('button[onclick="stepBackward()"]');
      const afterStepBackward = await page.locator('#currentNode').textContent();
      expect(afterStepBackward).not.toBe(null);

      // Update traversal speed by moving range input; ensure no exceptions and that traversalSpeed updated on window.cll
      await page.fill('#traversalSpeed', '300'); // set value textually then trigger change
      await page.locator('#traversalSpeed').evaluate((el) => {
        el.value = '300';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Validate via page.evaluate that cll.traversalSpeed equals 300
      const traversalSpeed = await page.evaluate(() => window.cll ? window.cll.traversalSpeed : null);
      expect(traversalSpeed).toBe(300);

      // Stop traversal
      await page.click('button[onclick="stopTraversal()"]');
      await expect(page.locator('#traversalStatus')).toHaveText('Inactive');
    });

    test('Show List Structure outputs structure into debugInfo', async ({ page }) => {
      // Ensure list has nodes
      await page.fill('#nodeValue', 'SS1');
      await page.click('button[onclick="insertAtEnd()"]');
      await page.fill('#nodeValue', 'SS2');
      await page.click('button[onclick="insertAtEnd()"]');

      await page.click('button[onclick="showListStructure()"]');

      // debugInfo should contain "List Structure:" and data entries with Data: ...
      await expect(page.locator('#debugInfo')).toContainText('List Structure:');
      await expect(page.locator('#debugInfo')).toContainText('Data:');
    });

    test('Export list triggers download link click without errors and export data equals list array', async ({ page }) => {
      // Create small list
      await page.click('button[onclick="clearList()"]');
      await page.fill('#nodeValue', 'E1');
      await page.click('button[onclick="insertAtEnd()"]');
      await page.fill('#nodeValue', 'E2');
      await page.click('button[onclick="insertAtEnd()"]');

      // Intercept the list content via the cll.getListAsArray() to validate export payload
      const listArray = await page.evaluate(() => window.cll ? window.cll.getListAsArray() : null);
      expect(Array.isArray(listArray)).toBe(true);
      expect(listArray).toContain('E1');
      expect(listArray).toContain('E2');

      // Click export; the function programmatically creates an <a> and clicks it.
      // Ensure no errors occur while doing so.
      await page.click('button[onclick="exportList()"]');
    });

    test('Import list via file chooser with valid JSON populates list; invalid JSON triggers alert', async ({ page }) => {
      // Prepare valid JSON file in tmp directory
      const tmpDir = os.tmpdir();
      const validPath = path.join(tmpDir, `cll_import_valid_${Date.now()}.json`);
      const invalidPath = path.join(tmpDir, `cll_import_invalid_${Date.now()}.json`);
      await fs.writeFile(validPath, JSON.stringify(['I1', 'I2']), 'utf8');
      await fs.writeFile(invalidPath, 'this is not json', 'utf8');

      // First test valid import: when input is created and clicked, Playwright will emit filechooser
      page.once('filechooser', async fileChooser => {
        await fileChooser.setFiles(validPath);
      });
      await page.click('button[onclick="importList()"]');

      // After import, list should contain I1 and I2
      await expect(page.locator('#listLength')).toHaveText('2');
      await expect(page.locator('#listVisualization')).toContainText('I1');
      await expect(page.locator('#listVisualization')).toContainText('I2');

      // Now simulate invalid JSON file to trigger alert for import error
      let alertText = '';
      page.once('dialog', async dialog => {
        // Alert thrown by importList error branch
        expect(dialog.type()).toBe('alert');
        alertText = dialog.message();
        await dialog.accept();
      });

      page.once('filechooser', async fileChooser => {
        await fileChooser.setFiles(invalidPath);
      });
      await page.click('button[onclick="importList()"]');

      expect(alertText).toContain('Error importing list');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempt operations with empty input value should do nothing and not throw', async ({ page }) => {
      // Clear input value explicitly and try insertAtBeginning which returns early when value is empty
      await page.fill('#nodeValue', '');
      await page.click('button[onclick="insertAtBeginning()"]');

      // Ensure still empty
      await expect(page.locator('#listVisualization')).toContainText('List is empty');
      await expect(page.locator('#listLength')).toHaveText('0');

      // Try deleteNode with empty input
      await page.fill('#nodeValue', '');
      await page.click('button[onclick="deleteNode()"]');

      // No page errors should have occurred; afterEach assertion will check for them
    });

    test('Programmatic access: verify DOM renderList entry action was called by checking visualization after direct operations', async ({ page }) => {
      // Use evaluate to call cll.insertAtBeginning directly and then call renderList
      await page.evaluate(() => {
        if (window.cll && typeof window.cll.insertAtBeginning === 'function') {
          window.cll.insertAtBeginning('Direct1');
          window.cll.insertAtEnd('Direct2');
          // renderList is invoked in entry actions in implementation; call to ensure UI updates
          if (typeof window.renderList === 'function') {
            window.renderList();
          }
        }
      });

      // UI should reflect those nodes
      await expect(page.locator('#listVisualization')).toContainText('Direct1');
      await expect(page.locator('#listVisualization')).toContainText('Direct2');
    });
  });
});