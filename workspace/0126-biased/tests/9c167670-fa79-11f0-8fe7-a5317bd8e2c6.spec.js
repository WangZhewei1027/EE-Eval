import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c167670-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Abstract Syntax Tree Interactive Explorer - FSM and interactions', () => {
  // We'll collect console messages and page errors for assertions per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object from the page
      pageErrors.push(err);
    });

    // Generic dialog handler: tests will rely on this to accept prompts/confirms where appropriate.
    page.on('dialog', async (dialog) => {
      const msg = dialog.message();
      // Accept reset confirm dialogs automatically
      if (msg && msg.startsWith('Reset the workspace')) {
        await dialog.accept();
        return;
      }
      // Accept delete root confirmation if it appears during tests
      if (msg && msg.includes('Deleting root')) {
        await dialog.accept();
        return;
      }
      // Prompt for wrapper type: supply a deterministic wrapper name for tests
      if (msg && msg.startsWith('Enter wrapper node type')) {
        await dialog.accept('WrapperTest');
        return;
      }
      // For alerts (e.g., previews), just accept to continue
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait briefly to allow the page init() -> parseBtn.click() to complete initial parse
    await page.waitForTimeout(250);
  });

  test.afterEach(async ({ page }) => {
    // close page errors/console handlers implicitly by closing the page (done in fixture)
  });

  test('Initial load should auto-parse and render AST (S1_AST_Parsed expected on entry)', async ({ page }) => {
    // Validate AST exists after the page auto-initializes (init() calls parseBtn.click())
    const astExists = await page.evaluate(() => !!AST);
    expect(astExists).toBeTruthy();

    // The astTree container should not show "(no AST)"
    const treeText = await page.locator('#astTree').innerText();
    expect(treeText).not.toContain('(no AST)');

    // codeOutput should contain generated code from AST
    const codeOut = await page.locator('#codeOutput').inputValue();
    expect(codeOut.length).toBeGreaterThan(0);

    // traversalStatus should indicate stopped initially
    const travStatus = await page.locator('#traversalStatus').innerText();
    expect(travStatus).toMatch(/stopped/);

    // Ensure no unexpected page errors occurred during initial parse
    expect(pageErrors.length, 'No page errors on initial load').toBe(0);
  });

  test('ParseStart: parsing custom input updates AST and code output', async ({ page }) => {
    // Replace code input with a new program and click Parse → AST
    const newCode = 'x = 1 + 2;';
    await page.locator('#codeInput').fill(newCode);
    await page.locator('#parseBtn').click();

    // Wait for parse to complete and AST to be present
    await page.waitForFunction(() => typeof AST !== 'undefined' && AST !== null);

    // Verify AST root type Program
    const rootType = await page.evaluate(() => AST && AST.type);
    expect(rootType).toBe('Program');

    // Verify codeOutput matches expected small program form
    const codeOut = await page.locator('#codeOutput').inputValue();
    expect(codeOut).toContain('x'); // contains variable name
    expect(codeOut).toContain('+'); // contains binary operator

    // No page errors expected for a normal parse
    expect(pageErrors.length).toBe(0);
  });

  test('StartTraversal and StopTraversal (S3_Traversal_Running -> S1_AST_Parsed)', async ({ page }) => {
    // Ensure AST exists
    const hasAst = await page.evaluate(() => !!AST);
    expect(hasAst).toBeTruthy();

    // Start traversal and wait for traversalStatus to indicate running
    await page.locator('#startTraversalBtn').click();
    await page.waitForFunction(() => document.getElementById('traversalStatus').textContent.includes('Traversal'));
    const runningStatus = await page.locator('#traversalStatus').innerText();
    expect(runningStatus.toLowerCase()).toMatch(/traversal/);

    // Stop traversal
    await page.locator('#stopTraversalBtn').click();
    // Confirm traversal stopped text appears
    await page.waitForFunction(() => document.getElementById('traversalStatus').textContent.includes('stopped'));
    const stoppedStatus = await page.locator('#traversalStatus').innerText();
    expect(stoppedStatus).toMatch(/stopped/);

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Node selection, UpdateNode, AddChild, DeleteNode, Undo/Redo operations (S2_Node_Selected <-> S1_AST_Parsed)', async ({ page }) => {
    // Ensure AST is rendered and clickable nodes exist
    const nodeSpan = page.locator('#astTree .node span').first();
    await expect(nodeSpan).toBeVisible();

    // Click the first node to select it
    await nodeSpan.click();
    // Inspector should update
    await page.waitForFunction(() => document.getElementById('selectedPath').textContent.startsWith('Selected:'));
    const selPath = await page.locator('#selectedPath').innerText();
    expect(selPath).toMatch(/Selected:/);

    // Capture selectedNodeId from page
    const selectedId = await page.evaluate(() => selectedNodeId);
    expect(selectedId).toBeTruthy();

    // Modify inspector type and value and click Update Node
    const origType = await page.locator('#nodeType').inputValue();
    await page.locator('#nodeType').fill(origType + '_Edited');
    await page.locator('#nodeValue').fill('42');
    await page.locator('#updateNodeBtn').click();

    // After update, inspector should reflect new values
    await page.waitForFunction(() => document.getElementById('nodeType').value.includes('_Edited'));
    const updatedType = await page.locator('#nodeType').inputValue();
    const updatedValue = await page.locator('#nodeValue').inputValue();
    expect(updatedType).toContain('_Edited');
    expect(updatedValue).toContain('42');

    // Add a child to the currently selected node
    await page.locator('#newChildType').fill('TestChild');
    await page.locator('#newChildValue').fill('7');
    await page.locator('#addChildBtn').click();

    // Verify the selected node in AST has a child with given type and value
    const childExists = await page.evaluate((id) => {
      const res = findNodeAndParent(AST, id);
      if (!res) return false;
      return res.node.children.some(c => c.type === 'TestChild' && String(c.value) === '7');
    }, selectedId);
    expect(childExists).toBe(true);

    // Delete that newly added child by selecting it then clicking Delete Node
    // Find its id from the AST
    const childId = await page.evaluate((id) => {
      const res = findNodeAndParent(AST, id);
      if (!res) return null;
      const c = res.node.children.find(cc => cc.type === 'TestChild' && String(cc.value) === '7');
      return c ? c.id : null;
    }, selectedId);
    expect(childId).toBeTruthy();

    // Select the child in the rendered tree by clicking corresponding node element (search by text)
    // Wait for re-render then click a node entry that contains the child's type and value and id
    const childSelectorText = `TestChild [7] (id=${childId})`;
    // Wait for render; we will find a span containing the child line
    await page.waitForFunction((text) => {
      const spans = Array.from(document.querySelectorAll('#astTree .node span'));
      return spans.some(s => s.textContent.includes(text));
    }, childSelectorText);

    // Click the child node in the tree
    const childSpan = page.locator('#astTree .node span', { hasText: `id=${childId}` }).first();
    await childSpan.click();

    // Now delete the selected node
    await page.locator('#deleteNodeBtn').click();

    // After delete, ensure that node cannot be found in AST
    const childStillPresent = await page.evaluate((id) => !!findNodeAndParent(AST, id), childId);
    expect(childStillPresent).toBe(false);

    // Test Undo: Click undo and the previously deleted child should be back
    await page.locator('#undoBtn').click();
    await page.waitForTimeout(120); // slight wait for history to apply
    const childRestored = await page.evaluate((id) => !!findNodeAndParent(AST, id), childId);
    expect(childRestored).toBe(true);

    // Test Redo: Click redo to remove it again
    await page.locator('#redoBtn').click();
    await page.waitForTimeout(120);
    const childAfterRedo = await page.evaluate((id) => !!findNodeAndParent(AST, id), childId);
    // If redo logic returns to state where child absent, expect false
    expect(childAfterRedo).toBe(false);

    // Ensure no page errors during these node operations
    expect(pageErrors.length).toBe(0);
  });

  test('Search and ClearSearch behave as expected', async ({ page }) => {
    // Ensure AST is present
    const hasAst = await page.evaluate(() => !!AST);
    expect(hasAst).toBeTruthy();

    // Search for "Literal" nodes (common in AST)
    await page.locator('#searchInput').fill('Literal');
    await page.locator('#searchBtn').click();

    // searchResults should indicate some matches (could be 1+)
    await page.waitForFunction(() => document.getElementById('searchResults').textContent.includes('Matches:'));
    const searchResText = await page.locator('#searchResults').innerText();
    expect(searchResText).toMatch(/Matches:\s*\d+/);

    // The rendered astTree should annotate matches with '<<MATCH>>'
    const treeHtml = await page.locator('#astTree').innerText();
    expect(treeHtml).toContain('<<MATCH>>');

    // Clear the search
    await page.locator('#clearSearchBtn').click();
    // After clear, searchResults should be empty
    await page.waitForFunction(() => document.getElementById('searchResults').textContent === '');
    const cleared = await page.locator('#searchResults').innerText();
    expect(cleared).toBe('');

    // No page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('WrapNode: wrapping selected node uses prompt and updates AST structure', async ({ page }) => {
    // Select first non-root node to wrap; pick the first span that is not the root (root will be Program)
    // Find a node span that contains '(' or a type other than Program
    const span = page.locator('#astTree .node span').nth(1);
    await span.click();
    await page.waitForFunction(() => document.getElementById('selectedPath').textContent.startsWith('Selected:'));
    const beforeAst = await page.evaluate(() => JSON.stringify(AST));

    // Click wrap node button. The dialog handler in beforeEach will supply 'WrapperTest'
    await page.locator('#wrapNodeBtn').click();
    await page.waitForTimeout(150);

    const afterAst = await page.evaluate(() => JSON.stringify(AST));
    // AST structure should change (stringified should differ)
    expect(afterAst).not.toBe(beforeAst);

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Apply invalid JSON to AST editor triggers alert but should not crash page', async ({ page }) => {
    // Put invalid JSON in astJsonArea and click Apply JSON to AST
    await page.locator('#astJsonArea').fill('{ invalidJson: , }');
    // Click apply; handler displays alert (dialog), which our dialog handler will accept
    await page.locator('#applyJsonBtn').click();
    // Wait briefly to allow alert handling
    await page.waitForTimeout(100);

    // Page should remain responsive: AST should still be defined or null but no unhandled page error
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Rename identifiers when AST is null should generate a page error (TypeError)', async ({ page }) => {
    // Reset the workspace; our dialog handler auto-accepts the confirm
    await page.locator('#resetBtn').click();
    // Wait for reset to complete
    await page.waitForFunction(() => document.getElementById('astTree').textContent === '(no AST)');

    // Fill rename inputs and click rename to trigger renameIdentifiers which will attempt to walk AST=null
    await page.locator('#renameFrom').fill('x');
    await page.locator('#renameTo').fill('y');
    // Clear previously collected page errors
    pageErrors.length = 0;

    // Click renameBtn - this should trigger a TypeError in the page (unhandled) because renameIdentifiers doesn't guard AST null
    await page.locator('#renameBtn').click();

    // Wait a short time for a pageerror to be emitted
    await page.waitForTimeout(200);

    // Assert that at least one page error was captured and that it's a TypeError or similar
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const lastErr = pageErrors[pageErrors.length - 1];
    // The message may vary across engines; we assert that it's a TypeError or mentions 'cannot' or 'null'
    const msg = lastErr && lastErr.message ? lastErr.message.toLowerCase() : '';
    const isTypeIssue = msg.includes('typeerror') || msg.includes('cannot') || msg.includes('null') || msg.includes("cannot read");
    expect(isTypeIssue).toBeTruthy();
  });

  test('Custom transform preview and apply flow (preview writes to AST editor)', async ({ page }) => {
    // Ensure AST exists by parsing a small program
    await page.locator('#codeInput').fill('a = 2 + 3;');
    await page.locator('#parseBtn').click();
    await page.waitForFunction(() => !!AST);

    // Use the customTransform textarea (it contains a valid transform by default)
    // Click Preview Only and expect the AST JSON area to be populated and an alert to be shown and accepted
    // Clear any previous astJsonArea content
    await page.locator('#astJsonArea').fill('');
    await page.locator('#previewBtn').click();

    // Our dialog handler will accept the alert; wait for the astJsonArea to be populated with preview result
    await page.waitForFunction(() => document.getElementById('astJsonArea').value.trim().length > 0, { timeout: 1000 });

    const editorValue = await page.locator('#astJsonArea').inputValue();
    expect(editorValue.length).toBeGreaterThan(0);

    // Now apply the JSON (it is likely valid JSON). Click Apply JSON to AST to persist preview
    await page.locator('#applyJsonBtn').click();

    // Wait a short time and assert AST changed to match editor content
    await page.waitForTimeout(150);
    const astJson = await page.evaluate(() => JSON.stringify(AST, null, 2));
    expect(astJson.length).toBeGreaterThan(0);

    // No unhandled page errors during this flow
    expect(pageErrors.length).toBe(0);
  });

  test('Export JSON opens a new window (best-effort check) and should not produce page errors', async ({ page }) => {
    // Attempt to invoke export JSON; it opens a new window. Depending on environment, popup may be blocked,
    // but this should not throw an unhandled page error in the main page.
    await page.locator('#exportJsonBtn').click();
    // Wait briefly
    await page.waitForTimeout(200);
    // Ensure no page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge-case: runCustomTransform with a deliberately malformed function shows compile alert but no page crash', async ({ page }) => {
    // Put an intentionally invalid JS into customTransform to provoke a compile-time SyntaxError inside runCustomTransform
    const badTransform = "function transform(node, utils) { invalid syntax !!! ";
    await page.locator('#customTransform').fill(badTransform);
    // Clear recorded page errors
    pageErrors.length = 0;
    // Click Run Custom Transform (compile error should be caught and an alert shown)
    await page.locator('#runCustomBtn').click();
    // Wait briefly
    await page.waitForTimeout(150);
    // The page should still be alive and not produce an unhandled pageerror
    expect(pageErrors.length).toBe(0);
  });
});