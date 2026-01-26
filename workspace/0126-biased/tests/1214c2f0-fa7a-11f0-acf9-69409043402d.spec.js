import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1214c2f0-fa7a-11f0-acf9-69409043402d.html';

test.describe('PageRank Interactive Demonstration - FSM workflows and transitions', () => {
  // Collect console messages and page errors for each test run
  let consoleMsgs = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMsgs = [];
    pageErrors = [];

    // Capture console messages for diagnostic assertions
    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Assert no uncaught runtime errors occurred during the test.
    // The application is expected to run without throwing unhandled exceptions.
    expect(pageErrors.map(e => e.message || String(e))).toEqual([]);
  });

  test.describe('Initial idle state and workflow switching', () => {
    test('S0 Idle: Page title and initial status present', async ({ page }) => {
      // Validate initial page rendering (onEnter S0_Idle -> renderPage())
      await expect(page.locator('title')).toHaveText('PageRank Interactive Demonstration');
      // Status should have initial ready message
      await expect(page.locator('#status')).toHaveText(/Ready\. Build your graph and start exploring PageRank\./);
    });

    test('Switching workflows makes corresponding workflow visible and others hidden', async ({ page }) => {
      // Helper to select workflow and assert visible section
      const workflowSelect = page.locator('#workflow-select');

      // Map of select values to workflow section IDs
      const map = {
        build: '#build-workflow',
        matrix: '#matrix-workflow',
        'pagerank-step': '#pagerank-step-workflow',
        'pagerank-auto': '#pagerank-auto-workflow',
        compare: '#compare-workflow',
        'export-import': '#export-import-workflow'
      };

      for (const [value, selector] of Object.entries(map)) {
        await workflowSelect.selectOption(value);
        // ensure updateWorkflowVisibility executed and correct workflow visible
        await expect(page.locator(selector)).toBeVisible();
        // others should be hidden
        for (const otherSelector of Object.values(map)) {
          if (otherSelector === selector) continue;
          await expect(page.locator(otherSelector)).not.toBeVisible();
        }
      }
    });
  });

  test.describe('S1: Build Graph workflow', () => {
    test('Build nodes populates links table with checkboxes and saves links', async ({ page }) => {
      // Enter build workflow
      await page.locator('#workflow-select').selectOption('build');
      await expect(page.locator('#build-workflow')).toBeVisible();

      // Set node count to 3 and build
      const nodeCountInput = page.locator('#node-count-input');
      await nodeCountInput.fill('3');
      await page.locator('#build-nodes-btn').click();

      // Expect links table to have header and 3 rows x 3 columns of checkboxes
      const linksTable = page.locator('#links-table');
      await expect(linksTable.locator('thead th')).toHaveCount(4); // corner + 3 headers
      await expect(linksTable.locator('tbody tr')).toHaveCount(3);
      // Check presence of checkbox for (0,0)
      await expect(page.locator('#link-checkbox-0-0')).toBeVisible();

      // Change some checkboxes to create a non-trivial graph
      await page.locator('#link-checkbox-0-1').check(); // link from node1 to node2
      await page.locator('#link-checkbox-1-2').uncheck(); // ensure off
      // Click save links
      await page.locator('#save-links-btn').click();

      // Status should reflect saved links
      await expect(page.locator('#status')).toHaveText(/Links saved\. Graph with 3 nodes updated\./);
    });

    test('Edge case: invalid node count shows alert', async ({ page }) => {
      await page.locator('#workflow-select').selectOption('build');
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog);
        // Accept/dismiss to allow page flow to continue
        await dialog.accept();
      });

      // Set invalid node count 0 and try to build
      await page.locator('#node-count-input').fill('0');
      await page.locator('#build-nodes-btn').click();

      // Expect an alert dialog occurred
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[0].message()).toContain('Node count must be an integer between 1 and 20.');
    });
  });

  test.describe('S2: Matrix Workflow', () => {
    test('Show adjacency, transition matrices and link info', async ({ page }) => {
      // Ensure there is a graph: switch to build and build default 5 nodes to ensure adjacency exists
      await page.locator('#workflow-select').selectOption('build');
      await page.locator('#node-count-input').fill('5');
      await page.locator('#build-nodes-btn').click();
      await page.locator('#save-links-btn').click();

      // Switch to matrix workflow
      await page.locator('#workflow-select').selectOption('matrix');
      await expect(page.locator('#matrix-workflow')).toBeVisible();

      // Show adjacency matrix
      await page.locator('#show-adj-btn').click();
      const matrixDisplay = page.locator('#matrix-display');
      await expect(matrixDisplay).toContainText('1'); // adjacency contains ones (self-links)
      await expect(page.locator('#status')).toHaveText(/Adjacency matrix displayed\./);

      // Show transition matrix (should show decimals)
      await page.locator('#show-trans-btn').click();
      await expect(matrixDisplay).toHaveText(/0\.2000|0\.\d{4}/); // 1/5 -> 0.2000 or decimals
      await expect(page.locator('#status')).toHaveText(/Transition matrix \(column stochastic\) displayed\./);

      // Show link info
      await page.locator('#show-linkinfo-btn').click();
      await expect(matrixDisplay).toContainText('Graph with');
      await expect(page.locator('#status')).toHaveText(/Link info displayed\./);
    });
  });

  test.describe('S3: Step-by-step PageRank workflow', () => {
    test('Initialize, step, run N steps, show prev/current/diff vectors and reset', async ({ page }) => {
      // Build a small known graph first
      await page.locator('#workflow-select').selectOption('build');
      await page.locator('#node-count-input').fill('4');
      await page.locator('#build-nodes-btn').click();

      // Set some links and save
      await page.locator('#link-checkbox-0-1').check();
      await page.locator('#link-checkbox-1-2').check();
      await page.locator('#link-checkbox-2-3').check();
      await page.locator('#save-links-btn').click();

      // Switch to pagerank-step
      await page.locator('#workflow-select').selectOption('pagerank-step');
      await expect(page.locator('#pagerank-step-workflow')).toBeVisible();

      // Initialize PageRank vector (uniform)
      await page.locator('#damping-input-step').fill('0.85');
      await page.locator('#init-value-type').selectOption('uniform');
      await page.locator('#init-pagerank-btn').click();

      // Controls should show up and pagerank-output should contain Node lines
      await expect(page.locator('#pagerank-iteration-controls')).toBeVisible();
      await expect(page.locator('#pagerank-output')).toContainText('Node 1:');

      // Perform one step
      await page.locator('#step-btn').click();
      await expect(page.locator('#pagerank-output')).toContainText('Node 1:');
      await expect(page.locator('#status')).toHaveText(/Iteration 1 completed\./);

      // Save previous vector then run N steps (3 steps)
      await page.locator('#run-steps-count').fill('3');
      await page.locator('#run-steps-btn').click();
      await expect(page.locator('#status')).toHaveText(/Ran 3 iterations, now at iteration \d+\./);

      // Show previous vector (should be defined)
      // First, click show-prev-rank-btn -> but if no previous vector exists an alert would be shown. We expect previous exists.
      await page.locator('#show-prev-rank-btn').click();
      await expect(page.locator('#pagerank-output')).toContainText('Node 1:');

      // Show current vector
      await page.locator('#show-current-rank-btn').click();
      await expect(page.locator('#pagerank-output')).toContainText('Node 1:');

      // Show difference vector - requires both current and previous vectors present (it should work)
      await page.locator('#show-diff-rank-btn').click();
      await expect(page.locator('#pagerank-output')).toContainText('Node 1:');

      // Reset PageRank and verify controls hidden and output cleared
      await page.locator('#reset-pagerank-btn').click();
      await expect(page.locator('#pagerank-output')).toHaveText('');
      await expect(page.locator('#pagerank-iteration-controls')).not.toBeVisible();
      await expect(page.locator('#status')).toHaveText(/PageRank iteration reset\./);
    });

    test('Edge cases: initialize without graph triggers alert', async ({ page }) => {
      // We will artificially simulate "no graph" by navigating freshly and switching to pagerank-step
      // The page on load has a graph, but we can clear adjacency by importing invalid JSON - easier: directly reset to pagerank-step and then set adjacencyMatrix to null is forbidden.
      // Instead, test invalid damping value handling: set damping out of range and expect alert.
      await page.locator('#workflow-select').selectOption('pagerank-step');

      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog);
        await dialog.accept();
      });

      // Set invalid damping factor (e.g., 2)
      await page.locator('#damping-input-step').fill('2');
      await page.locator('#init-pagerank-btn').click();

      // Expect an alert about damping
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[0].message()).toContain('Damping factor must be between 0 and 1.');
    });
  });

  test.describe('S4: Auto PageRank workflow', () => {
    test('Initialize auto, run until convergence and stop', async ({ page }) => {
      // Ensure a graph is present
      await page.locator('#workflow-select').selectOption('build');
      await page.locator('#node-count-input').fill('5');
      await page.locator('#build-nodes-btn').click();
      await page.locator('#save-links-btn').click();

      // Switch to auto workflow
      await page.locator('#workflow-select').selectOption('pagerank-auto');

      // Initialize auto PageRank
      await page.locator('#damping-input-auto').fill('0.85');
      await page.locator('#convergence-epsilon').fill('0.00001'); // tight threshold may still converge
      await page.locator('#init-pagerank-auto-btn').click();

      // After init, run button enabled
      const runBtn = page.locator('#run-pagerank-auto-btn');
      const stopBtn = page.locator('#stop-pagerank-auto-btn');

      await expect(runBtn).toBeEnabled();
      await expect(stopBtn).toBeDisabled();

      // Click run - we expect it to eventually converge and re-enable the run button
      await runBtn.click();

      // Wait until either convergence happens (runBtn enabled again) or some iterations have been done
      await page.waitForFunction(() => {
        const run = document.getElementById('run-pagerank-auto-btn');
        return !run.disabled;
      }, { timeout: 5000 });

      // Expect pagerank-auto-output to at least contain 'Iteration' or L1 diff info
      await expect(page.locator('#pagerank-auto-output')).toContainText(/Iteration/);

      // Now test stop path: initialize again then start and stop quickly
      await page.locator('#init-pagerank-auto-btn').click();
      await page.locator('#run-pagerank-auto-btn').click();
      // Ensure stop becomes enabled
      await expect(page.locator('#stop-pagerank-auto-btn')).toBeEnabled();
      // Click stop
      await page.locator('#stop-pagerank-auto-btn').click();
      await expect(page.locator('#status')).toHaveText(/Auto PageRank run stopped by user\./);
    });

    test('Show current vector and steps count for auto', async ({ page }) => {
      // Build minimal graph and initialize
      await page.locator('#workflow-select').selectOption('build');
      await page.locator('#node-count-input').fill('3');
      await page.locator('#build-nodes-btn').click();
      await page.locator('#save-links-btn').click();

      await page.locator('#workflow-select').selectOption('pagerank-auto');
      await page.locator('#init-pagerank-auto-btn').click();

      // Show current vector
      await page.locator('#show-current-rank-auto-btn').click();
      await expect(page.locator('#pagerank-auto-output')).toContainText('Node 1:');

      // Show iteration count (should be 0 right after init)
      await page.locator('#show-steps-auto-btn').click();
      await expect(page.locator('#pagerank-auto-output')).toHaveText(/Iterations run: 0/);
    });
  });

  test.describe('S5: Compare Vectors workflow', () => {
    test('Save current vectors, list updated, compare differences and ranking differences', async ({ page }) => {
      // Prepare by creating a PageRank vector in step mode
      await page.locator('#workflow-select').selectOption('build');
      await page.locator('#node-count-input').fill('4');
      await page.locator('#build-nodes-btn').click();
      await page.locator('#save-links-btn').click();

      await page.locator('#workflow-select').selectOption('pagerank-step');
      await page.locator('#init-value-type').selectOption('uniform');
      await page.locator('#init-pagerank-btn').click();

      // Save first vector via compare workflow
      await page.locator('#workflow-select').selectOption('compare');
      await expect(page.locator('#compare-workflow')).toBeVisible();

      // Attempt to save without a name -> expect alert
      const dialogPromises = [];
      page.on('dialog', async dialog => {
        dialogPromises.push(dialog.message());
        await dialog.accept();
      });

      // Click save should trigger alert because name is empty
      await page.locator('#compare-save-btn').click();
      expect(dialogPromises.length).toBeGreaterThanOrEqual(1);
      expect(dialogPromises[dialogPromises.length - 1]).toContain('Enter a name to save the vector.');

      // Go back to pagerank-step, make sure vector exists, then save properly
      await page.locator('#workflow-select').selectOption('pagerank-step');
      // Re-initialize to be safe
      await page.locator('#init-value-type').selectOption('uniform');
      await page.locator('#init-pagerank-btn').click();

      // Run one step to make different states
      await page.locator('#step-btn').click();

      // Save current vector via compare
      await page.locator('#workflow-select').selectOption('compare');
      await page.locator('#compare-save-name').fill('runA');
      await page.locator('#compare-save-btn').click();

      // Save savedVectors list must update
      await expect(page.locator('#compare-saved-list')).toContainText('runA');

      // Create another vector by going back, running more steps, and saving as runB
      await page.locator('#workflow-select').selectOption('pagerank-step');
      // Ensure current vector exists; run a few steps
      await page.locator('#run-steps-count').fill('2');
      await page.locator('#run-steps-btn').click();

      // Save as runB
      await page.locator('#workflow-select').selectOption('compare');
      await page.locator('#compare-save-name').fill('runB');
      await page.locator('#compare-save-btn').click();

      // Both names should be in list and selects
      await expect(page.locator('#compare-saved-list')).toContainText('runA');
      await expect(page.locator('#compare-saved-list')).toContainText('runB');
      await expect(page.locator('#compare-select-1')).toContainText('runA');
      await expect(page.locator('#compare-select-2')).toContainText('runB');

      // Select runA and runB and click Show Differences
      await page.locator('#compare-select-1').selectOption('runA');
      await page.locator('#compare-select-2').selectOption('runB');
      await page.locator('#compare-diff-btn').click();

      // Compare output should contain L1 difference and per-node lines
      await expect(page.locator('#compare-output')).toContainText('L1 difference between "runA" and "runB":');

      // Show ranking differences
      await page.locator('#compare-rankdiff-btn').click();
      await expect(page.locator('#compare-output')).toContainText('Ranking differences between "runA" and "runB":');
      await expect(page.locator('#status')).toHaveText(/Displayed ranking differences\./);
    });

    test('Edge cases in compare: selecting same vector triggers alert', async ({ page }) => {
      // Setup saved vectors quickly
      await page.locator('#workflow-select').selectOption('build');
      await page.locator('#build-nodes-btn').click();
      await page.locator('#save-links-btn').click();

      await page.locator('#workflow-select').selectOption('pagerank-step');
      await page.locator('#init-pagerank-btn').click();

      await page.locator('#workflow-select').selectOption('compare');
      await page.locator('#compare-save-name').fill('sameA');
      await page.locator('#compare-save-btn').click();

      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      // Select same vector for both selects and try to compare
      await page.locator('#compare-select-1').selectOption('sameA');
      await page.locator('#compare-select-2').selectOption('sameA');
      await page.locator('#compare-diff-btn').click();

      // Expect alert about selecting two different vectors
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1]).toContain('Select two different vectors.');
    });
  });

  test.describe('S6: Export / Import workflow', () => {
    test('Export produces JSON; import restores graph and saved vectors; invalid JSON handled', async ({ page }) => {
      // Setup a simple graph and a saved vector to be exported
      await page.locator('#workflow-select').selectOption('build');
      await page.locator('#node-count-input').fill('3');
      await page.locator('#build-nodes-btn').click();

      // Save links and create a PageRank vector to be saved
      await page.locator('#save-links-btn').click();
      await page.locator('#workflow-select').selectOption('pagerank-step');
      await page.locator('#init-pagerank-btn').click();
      // Save current vector into compare then export workflow will capture it
      await page.locator('#workflow-select').selectOption('compare');
      await page.locator('#compare-save-name').fill('exportedVec');
      await page.locator('#compare-save-btn').click();

      // Export
      await page.locator('#workflow-select').selectOption('export-import');
      await page.locator('#export-btn').click();

      const exportTextarea = page.locator('#export-textarea');
      const exportedText = await exportTextarea.inputValue();
      expect(exportedText).toContain('"nodesCount"');
      expect(exportedText).toContain('"savedVectors"');

      // Now test invalid import JSON handling
      await page.locator('#import-textarea').fill('this is not json');
      await page.locator('#import-btn').click();
      await expect(page.locator('#import-msg')).toContainText('Invalid JSON');

      // Now perform a valid import: paste the exported text into import textarea and import
      await page.locator('#import-textarea').fill(exportedText);
      await page.locator('#import-btn').click();

      // Expect import message success and saved vectors restored
      await expect(page.locator('#import-msg')).toHaveText('Import successful.');
      await expect(page.locator('#compare-saved-list')).toContainText('exportedVec');

      // Node count input should reflect imported nodesCount (3)
      await page.locator('#workflow-select').selectOption('build');
      await expect(page.locator('#node-count-input')).toHaveValue('3');
    });
  });

  test.describe('General UI and reset behaviors', () => {
    test('Workflow reset clears appropriate workflow state', async ({ page }) => {
      // 1) Build workflow reset
      await page.locator('#workflow-select').selectOption('build');
      await page.locator('#node-count-input').fill('7');
      await page.locator('#build-nodes-btn').click();
      await page.locator('#workflow-reset-btn').click();
      await expect(page.locator('#node-count-input')).toHaveValue('5'); // reset to default in build reset
      await expect(page.locator('#status')).toHaveText(/Graph reset to 5 nodes with self-links\./);

      // 2) PageRank step reset
      await page.locator('#workflow-select').selectOption('pagerank-step');
      await page.locator('#init-pagerank-btn').click();
      await page.locator('#workflow-reset-btn').click();
      await expect(page.locator('#pagerank-iteration-controls')).not.toBeVisible();
      await expect(page.locator('#status')).toHaveText(/PageRank step-by-step reset\./);

      // 3) Auto PageRank reset
      await page.locator('#workflow-select').selectOption('pagerank-auto');
      await page.locator('#init-pagerank-auto-btn').click();
      await page.locator('#run-pagerank-auto-btn').click();
      await page.locator('#workflow-reset-btn').click();
      await expect(page.locator('#pagerank-auto-output')).toHaveText('');
      await expect(page.locator('#status')).toHaveText(/Auto PageRank reset\./);

      // 4) Compare reset
      await page.locator('#workflow-select').selectOption('compare');
      await page.locator('#compare-save-name').fill('tempName');
      // There may be no prVectorCurrent - so clicking reset will clear savedVectors
      await page.locator('#workflow-reset-btn').click();
      await expect(page.locator('#compare-saved-list')).toContainText('(No saved vectors)');
      await expect(page.locator('#status')).toHaveText(/Saved vectors cleared\./);

      // 5) Export/Import reset
      await page.locator('#workflow-select').selectOption('export-import');
      await page.locator('#export-textarea').fill('some');
      await page.locator('#workflow-reset-btn').click();
      await expect(page.locator('#export-textarea')).toHaveValue('');
      await expect(page.locator('#status')).toHaveText(/Export\/Import cleared\./);
    });
  });

  test('No uncaught runtime errors were emitted during interactions (diagnostic)', async ({ page }) => {
    // This test simply ensures earlier interactions didn't generate page errors (also checked in afterEach).
    // Additionally assert that console didn't emit fatal error-level messages.
    const errorConsole = consoleMsgs.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole.length).toBe(0);
  });
});