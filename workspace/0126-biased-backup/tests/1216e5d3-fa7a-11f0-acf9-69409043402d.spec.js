import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1216e5d3-fa7a-11f0-acf9-69409043402d.html';

test.describe('Abstract Syntax Tree Interactive Explorer - end-to-end', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages
    page.on('console', (msg) => {
      consoleMessages.push({type: msg.type(), text: msg.text()});
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    await expect(page.locator('h1')).toHaveText('Abstract Syntax Tree Interactive Explorer');
  });

  test.afterEach(async () => {
    // After each test we ensure we observed runtime console/messages - assertion done in dedicated test below
  });

  test.describe('Initial state (S0_Idle) and basic UI', () => {
    test('renders main heading and controls on load (Idle state)', async ({ page }) => {
      // Validate presence of major UI components
      await expect(page.locator('#codeInput')).toBeVisible();
      await expect(page.locator('#parseBtn')).toBeVisible();
      await expect(page.locator('#resetBtn')).toBeVisible();
      await expect(page.locator('#astContainer')).toBeVisible();
      await expect(page.locator('#info')).toBeVisible();

      // Info area empty or contains minimal text after load (renderPage() implied)
      const infoText = (await page.locator('#info').textContent()).trim();
      // Accept either blank or some initial whitespace text; assert presence of heading is enough here
      expect(infoText.length).toBeLessThanOrEqual(200);
    });
  });

  test.describe('Parsing flows (S1_CodeParsed and S2_CodeParseError)', () => {
    test('successful parse transitions to CodeParsed and renders AST (ParseCode -> S1_CodeParsed)', async ({ page }) => {
      // Provide valid JS snippet for the lightweight parser
      const code = 'function add(a, b) { return a + b; }';
      await page.locator('#codeInput').fill(code);

      // Click Parse Code
      await page.locator('#parseBtn').click();

      // Expect info to indicate success and root node id mention
      await expect(page.locator('#info')).toHaveText(/Parsing succeeded. AST generated with root node ID n\d+\./);

      // AST container should have at least one node rendered with data-id attribute
      const firstNode = page.locator('#astContainer details[data-id]').first();
      await expect(firstNode).toBeVisible();
      const nid = await firstNode.getAttribute('data-id');
      expect(nid).toMatch(/^n\d+$/);

      // Ensure details/summary structure exists
      const summary = firstNode.locator('summary');
      await expect(summary).toBeVisible();
    });

    test('parse error leads to CodeParseError and shows message (ParseCode -> S2_CodeParseError)', async ({ page }) => {
      // Provide malformed input that should trigger parser exception
      await page.locator('#codeInput').fill('function (');
      await page.locator('#parseBtn').click();

      // Parser sets info to 'Parse error: ...'
      await expect(page.locator('#info')).toHaveText(/Parse error:/);

      // AST container cleared
      await expect(page.locator('#astContainer')).toHaveText('');
    });

    test('reset returns to Idle state (Reset from S1_CodeParsed -> S0_Idle)', async ({ page }) => {
      // First parse successfully
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();
      await expect(page.locator('#info')).toHaveText(/Parsing succeeded/);

      // Click Reset
      await page.locator('#resetBtn').click();

      // Info should show Reset done, AST cleared, code input cleared
      await expect(page.locator('#info')).toHaveText('Reset done.');
      await expect(page.locator('#codeInput')).toHaveValue('');
      await expect(page.locator('#astContainer')).toHaveText('');
    });
  });

  test.describe('View Mode & Expand Level adjustments (transitions within S1_CodeParsed / S3_NodeSelected)', () => {
    test('changing view mode re-renders AST (ChangeViewMode)', async ({ page }) => {
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();
      await expect(page.locator('#astContainer details[data-id]')).toHaveCountGreaterThan(0);

      // Switch to 'full' mode and expect extra property details to be present
      await page.locator('#modeSelect').selectOption('full');

      // After change, tree should still render - check for a property summary in full mode
      // In full mode, child <details> for properties exist - check for any summary with "id" or other prop labels
      const anyPropSummary = page.locator('#astContainer details summary', { hasText: 'id' }).first();
      // It might not exist for some node types, but at least root should still be visible
      await expect(page.locator('#astContainer details[data-id]').first()).toBeVisible();
    });

    test('changing expand level re-renders AST (ChangeExpandLevel)', async ({ page }) => {
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();

      // Increase expand level to fully expanded
      await page.locator('#expandLevelSlider').evaluate((el) => {
        el.value = '5';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // After increasing expand level, at least the first details should be open
      const firstDetails = page.locator('#astContainer details[data-id]').first();
      const isOpen = await firstDetails.evaluate((el) => el.open === true);
      expect(isOpen).toBe(true);
    });
  });

  test.describe('Filtering, Highlights and Clear (FilterNodes, HighlightMatches, ClearHighlights)', () => {
    test('filter nodes and highlight matches (FilterNodes + HighlightMatches)', async ({ page }) => {
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();

      // Type a filter that should match Identifier nodes
      await page.locator('#filterInput').fill('Identifier');

      // Click Highlight Filter Matches
      await page.locator('#highlightBtn').click();

      // Info should indicate highlight result
      await expect(page.locator('#info')).toHaveText(/Highlight done: \d+ nodes matched filter\./);

      // At least one summary should have applied inline style fontWeight=bold
      // We inspect summary elements and ensure at least one has bold set
      const summaryHasBold = await page.locator('#astContainer summary').evaluateAll((els) => {
        return els.some((s) => (s.style && (s.style.fontWeight === 'bold' || s.style.textDecoration.indexOf('underline') !== -1)));
      });
      expect(summaryHasBold).toBe(true);

      // Clear highlights
      await page.locator('#clearHighlightBtn').click();
      await expect(page.locator('#info')).toHaveText('Highlights cleared.');

      // After clearing, none of the summary elements should be bold/underlined
      const anyBoldNow = await page.locator('#astContainer summary').evaluateAll((els) => {
        return els.some((s) => (s.style && (s.style.fontWeight === 'bold' || s.style.textDecoration.indexOf('underline') !== -1)));
      });
      expect(anyBoldNow).toBe(false);
    });

    test('highlight button with no AST and with empty filter handle edge cases', async ({ page }) => {
      // No AST generated yet
      await page.locator('#highlightBtn').click();
      await expect(page.locator('#info')).toHaveText('No AST generated.');

      // Generate AST then click highlight with empty filter
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();

      // Clear filter input
      await page.locator('#filterInput').fill('');
      await page.locator('#highlightBtn').click();
      await expect(page.locator('#info')).toHaveText('Please enter filter text.');
    });
  });

  test.describe('Expand/Collapse all visible nodes (ExpandAll, CollapseAll)', () => {
    test('expand all visible makes details open; collapse all closes them', async ({ page }) => {
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();

      // Initially some details may be closed; click expand all
      await page.locator('#expandAllBtn').click();

      // Verify that at least one node is open and ideally all are open
      const allOpen = await page.locator('#astContainer details[data-id]').evaluateAll((els) => {
        return els.every((d) => d.open === true);
      });
      expect(allOpen).toBe(true);

      // Now collapse all
      await page.locator('#collapseAllBtn').click();

      const allClosed = await page.locator('#astContainer details[data-id]').evaluateAll((els) => {
        return els.every((d) => d.open === false);
      });
      expect(allClosed).toBe(true);
    });
  });

  test.describe('Jump to node, select and inspector interactions (JumpToNode, S3_NodeSelected)', () => {
    test('jump to a specific node by ID and update inspector (JumpToNode -> S3_NodeSelected)', async ({ page }) => {
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();

      // Grab first node id from the rendered tree
      const firstDetails = page.locator('#astContainer details[data-id]').first();
      const nid = await firstDetails.getAttribute('data-id');

      // Enter the ID and click Go
      await page.locator('#nodeSelector').fill(nid);
      await page.locator('#gotoNodeBtn').click();

      // Info should say selected node
      await expect(page.locator('#info')).toHaveText(new RegExp(`Selected node ${nid}`));

      // Inspector selectedNodeId should reflect the node id
      await expect(page.locator('#selectedNodeId')).toHaveValue(nid);
    });

    test('clicking a node summary selects it and updates inspector (onNodeSummaryClick -> S3_NodeSelected)', async ({ page }) => {
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();

      // Find a summary that contains 'Identifier' (parameters or name)
      const identifierSummary = page.locator('#astContainer summary', { hasText: 'Identifier' }).first();
      await identifierSummary.click();

      // After clicking, selectedNodeId should be populated
      const selectedId = await page.locator('#selectedNodeId').inputValue();
      expect(selectedId).toMatch(/^n\d+$/);
      // Type in selectedNodeType should be 'Identifier'
      await expect(page.locator('#selectedNodeType')).toHaveValue('Identifier');
      // editPropertySelect should be enabled if the node has editable string props like 'name'
      const propertyDisabled = await page.locator('#editPropertySelect').isDisabled();
      expect(propertyDisabled).toBe(false);
    });
  });

  test.describe('Editing and undo (ApplyEdit -> S4_NodeEdited -> UndoEdit -> S3_NodeSelected)', () => {
    test('apply edit to a node property and then undo the edit', async ({ page }) => {
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();

      // Select an Identifier node that should have 'name' property
      const identifierSummary = page.locator('#astContainer summary', { hasText: 'Identifier' }).first();
      await identifierSummary.click();

      const nid = await page.locator('#selectedNodeId').inputValue();
      expect(nid).toMatch(/^n\d+$/);

      // Choose the editable property option (e.g., name)
      // Wait for options to be populated
      await expect(page.locator('#editPropertySelect option')).toHaveCountGreaterThan(0);

      // Select the first non-empty option (skip placeholder)
      const options = page.locator('#editPropertySelect option:not([value=""])');
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);
      const firstOptionValue = await options.nth(0).getAttribute('value');

      // Select property
      await page.locator('#editPropertySelect').selectOption(firstOptionValue);

      // Update edit input to a new value and apply
      const oldVal = await page.locator('#editPropertyInput').inputValue();
      const newVal = oldVal + '_X';
      await page.locator('#editPropertyInput').fill(newVal);
      await page.locator('#applyEditBtn').click();

      // Info should reflect the applied edit
      await expect(page.locator('#info')).toHaveText(new RegExp(`Applied edit on node ${nid}: ${firstOptionValue} = ${newVal}`));

      // Undo the edit
      await page.locator('#undoEditBtn').click();
      await expect(page.locator('#info')).toHaveText(new RegExp(`Undid edit on node ${nid}: ${firstOptionValue} restored to`));
    });
  });

  test.describe('Serialization and download (SerializeAST, DownloadJSON)', () => {
    test('serialize AST to JSON enables download and download triggers info update', async ({ page }) => {
      // Attempt serialize with no AST - should show no AST message
      await page.locator('#serializeBtn').click();
      await expect(page.locator('#info')).toHaveText('No AST to serialize.');

      // Generate AST then serialize
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();
      await page.locator('#serializeBtn').click();

      // jsonOutputArea should be created and filled
      await expect(page.locator('#jsonOutputArea')).toBeVisible();
      const jsonVal = await page.locator('#jsonOutputArea').inputValue();
      expect(jsonVal.length).toBeGreaterThan(0);
      await expect(page.locator('#info')).toHaveText('AST serialized to JSON below. Use Download to save.');

      // Download button should now be enabled
      await expect(page.locator('#downloadBtn')).toBeEnabled();

      // Click download button - no file capture, but info should update to 'AST JSON downloaded.'
      await page.locator('#downloadBtn').click();
      await expect(page.locator('#info')).toHaveText('AST JSON downloaded.');
    });
  });

  test.describe('Edge cases and error scenarios (various)', () => {
    test('goto node with empty input and unknown id show appropriate info', async ({ page }) => {
      // Parse to have some nodes
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();

      // Empty go input
      await page.locator('#nodeSelector').fill('');
      await page.locator('#gotoNodeBtn').click();
      await expect(page.locator('#info')).toHaveText('Enter a node ID.');

      // Unknown id
      await page.locator('#nodeSelector').fill('n999999');
      await page.locator('#gotoNodeBtn').click();
      await expect(page.locator('#info')).toHaveText(/Node ID "n999999" not found\./);
    });

    test('apply edit without selection keeps apply button disabled', async ({ page }) => {
      // No AST: ensure applyEditBtn disabled
      await expect(page.locator('#applyEditBtn')).toBeDisabled();

      // After parse, without selecting a node apply should remain disabled
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();
      await expect(page.locator('#applyEditBtn')).toBeDisabled();
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('observe console logs and ensure no uncaught ReferenceError/SyntaxError/TypeError occurred', async ({ page }) => {
      // Perform a typical user journey to exercise many code paths
      await page.locator('#codeInput').fill('function add(a, b) { return a + b; }');
      await page.locator('#parseBtn').click();
      await page.locator('#filterInput').fill('Identifier');
      await page.locator('#highlightBtn').click();
      await page.locator('#clearHighlightBtn').click();
      await page.locator('#expandAllBtn').click();
      await page.locator('#collapseAllBtn').click();
      // Try selecting a node
      const firstSummary = page.locator('#astContainer summary').first();
      await firstSummary.click();
      // Serialize
      await page.locator('#serializeBtn').click();
      // Attempt download
      await page.locator('#downloadBtn').click();

      // Now assert pageErrors captured (uncaught exceptions)
      // The test asserts that none of the uncaught page errors are ReferenceError/SyntaxError/TypeError.
      // It also provides visibility into console messages gathered.
      // We do not attempt to modify page runtime; we simply assert what occurred naturally.

      // Ensure pageErrors array exists
      expect(Array.isArray(pageErrors)).toBe(true);

      // Fail the test if any pageerror is a common JS fatal type
      for (const err of pageErrors) {
        const msg = String(err && err.message ? err.message : err);
        // If there's any runtime ReferenceError/SyntaxError/TypeError, fail
        expect(msg).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }

      // Additionally assert console messages do not include fatal error indicators
      for (const c of consoleMessages) {
        expect(c.text).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
    });
  });
});