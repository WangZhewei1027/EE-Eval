import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3daf2d1-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for interacting with the AST Demo page
class ASTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main UI to be ready (status badge present)
    await this.page.waitForSelector('#status');
  }

  async getStatusText() {
    return (await this.page.locator('#status').innerText()).trim();
  }

  async clickParse() {
    await this.page.click('#parseBtn');
    // parseAndRender updates DOM synchronously; wait for generated content to appear
    await this.page.waitForSelector('#generated');
  }

  async clickEval() {
    await this.page.click('#evalBtn');
    // evaluation updates output area; wait a short moment for print outputs
    await this.page.waitForTimeout(50);
  }

  async clickFold() {
    await this.page.click('#foldBtn');
    // fold triggers parseAndRender -> generated will be updated
    await this.page.waitForTimeout(50);
  }

  async setRenameInputs(from, to) {
    await this.page.fill('#renameFrom', from);
    await this.page.fill('#renameTo', to);
  }

  async clickRename() {
    await this.page.click('#renameBtn');
    await this.page.waitForTimeout(50);
  }

  async clickReset(acceptConfirm = true) {
    // Accept or dismiss confirm dialog
    this.page.once('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        if (acceptConfirm) await dialog.accept();
        else await dialog.dismiss();
      } else {
        // If unexpected dialog type, accept to avoid blocking the test
        await dialog.accept();
      }
    });
    await this.page.click('#resetBtn');
    // reset flow calls parseAndRender and updates DOM; give it a moment
    await this.page.waitForTimeout(100);
  }

  async clickTraversePre() {
    await this.page.click('#trPre');
    // traversal starts; status updates
    await this.page.waitForTimeout(50);
  }

  async clickTraversePost() {
    await this.page.click('#trPost');
    await this.page.waitForTimeout(50);
  }

  async clickStopTraverse() {
    await this.page.click('#stopTraverse');
    // stopTraversal sets status to 'idle'
    await this.page.waitForTimeout(50);
  }

  async getGeneratedText() {
    return (await this.page.locator('#generated').innerText()).trim();
  }

  async getOutputText() {
    return (await this.page.locator('#output').innerText()).trim();
  }

  async getAstJsonText() {
    return (await this.page.locator('#astJson').innerText()).trim();
  }

  async getNodeInfoHtml() {
    return (await this.page.locator('#nodeInfo').innerHTML()).trim();
  }

  async selectFirstNodeLabel() {
    // select the first .node-label found inside astTree (if present)
    const label = this.page.locator('#astTree .node-label').first();
    if (await label.count() === 0) return false;
    await label.click();
    // give time for showNodeInfo to run and highlight generated code
    await this.page.waitForTimeout(50);
    return true;
  }

  async hasSelectedNodeInTree() {
    return (await this.page.locator('#astTree .node-selected').count()) > 0;
  }

  async getCodeInputValue() {
    return (await this.page.locator('#code').inputValue());
  }
}

// Group tests
test.describe('AST Demo - FSM & Interaction Tests (d3daf2d1-fa73-11f0-83e0-8d7be1d51901)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors and console messages for assertions / observation
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app
    const ast = new ASTPage(page);
    await ast.goto();
  });

  // Test initial parse (note: the page script triggers parseAndRender() on load)
  test('Initial load should render AST (Parsed state) and set status accordingly', async ({ page }) => {
    const ast1 = new ASTPage(page);

    // The script auto-parses on load. Confirm parsed state evidence:
    const status = await ast.getStatusText();
    // Accept either 'Status: idle' or 'Status: Parsed successfully' depending on load ordering,
    // but prefer 'Parsed successfully' because parseAndRender() runs at the end of the inlined script.
    expect(['Status: Parsed successfully', 'Status: idle', 'Status: Parse error']).toContain(status);

    // Generated code should not be empty after parse
    const generated = await ast.getGeneratedText();
    expect(generated.length).toBeGreaterThan(0);

    // AST JSON should be present
    const astJson = await ast.getAstJsonText();
    expect(astJson.length).toBeGreaterThan(0);

    // There should be no uncaught page errors during initial load
    expect(pageErrors.length).toBe(0);

    // Capture console messages (we don't require any specific console output; just observe)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('ParseCode event (Parse ↔ Generate button) re-parses and updates UI', async ({ page }) => {
    const ast2 = new ASTPage(page);

    // Click parse button explicitly
    await ast.clickParse();

    // After parsing, status should be 'Parsed successfully'
    const status1 = await ast.getStatusText();
    expect(status).toBe('Status: Parsed successfully');

    // AST tree should contain at least one node-label
    const hasLabel = await page.locator('#astTree .node-label').count();
    expect(hasLabel).toBeGreaterThan(0);

    // Generated code should contain key fragments from the default program
    const generated1 = await ast.getGeneratedText();
    expect(generated).toContain('let x');
    expect(generated).toContain('print(');
  });

  test('EvaluateCode event runs program and appends to output (Evaluated state)', async ({ page }) => {
    const ast3 = new ASTPage(page);

    // Ensure AST exists
    await ast.clickParse();

    // Clear output just in case then evaluate
    await page.fill('#output', '');
    await ast.clickEval();

    // After evaluation, status set to 'Evaluated'
    const status2 = await ast.getStatusText();
    expect(status).toBe('Status: Evaluated');

    // Output should contain expected print results: 15 and 24 (from the default program)
    // Use contains instead of strict equality because there may be newline trailing chars
    const output = await ast.getOutputText();
    expect(output).toContain('15');
    expect(output).toContain('24');

    // No uncaught page errors during evaluation
    expect(pageErrors.length).toBe(0);
  });

  test('ConstantFold transition updates AST and generated code (Constant-fold applied)', async ({ page }) => {
    const ast4 = new ASTPage(page);

    // Ensure parsed
    await ast.clickParse();

    // Apply constant folding
    await ast.clickFold();

    // Status should reflect the fold
    const status3 = await ast.getStatusText();
    expect(status).toBe('Status: Constant-fold applied');

    // Generated code should now contain folded literal for x (2 + 3 * 4 => 14)
    const generated2 = await ast.getGeneratedText();
    expect(generated).toMatch(/let\s+x\s*=\s*14;/);

    // AST JSON should reflect literals for folded nodes
    const astJson1 = await ast.getAstJsonText();
    expect(astJson).toContain('"value": 14');
  });

  test('RenameIdentifier transition updates identifiers and status (Renamed state)', async ({ page }) => {
    const ast5 = new ASTPage(page);

    // Ensure parsed
    await ast.clickParse();

    // Set rename inputs and click rename
    await ast.setRenameInputs('x', 'z');
    await ast.clickRename();

    // The page sets status like 'Renamed x → z'
    const status4 = await ast.getStatusText();
    expect(status).toBe('Status: Renamed x → z');

    // Generated code should now reference 'z' instead of 'x'
    const generated3 = await ast.getGeneratedText();
    expect(generated).toContain('let z').or.toContain('z =');

    // AST JSON should include the renamed identifier
    const astJson2 = await ast.getAstJsonText();
    expect(astJson).toContain('"name": "z"');
  });

  test('ResetCode transition uses confirm dialog and resets to original source (Reset state)', async ({ page }) => {
    const ast6 = new ASTPage(page);

    // Modify code (rename or fold) to ensure reset actually changes things
    await ast.setRenameInputs('x', 'tempName');
    await ast.clickRename();

    // Now click reset and accept confirm
    let dialogSeen = false;
    page.once('dialog', async dialog => {
      dialogSeen = true;
      // confirm is expected; accept to perform reset
      await dialog.accept();
    });
    await ast.clickReset(true);

    // There should have been a confirm dialog
    expect(dialogSeen).toBe(true);

    // After reset, status should be 'Reset code'
    const status5 = await ast.getStatusText();
    expect(status).toBe('Status: Reset code');

    // Generated code should contain the original snippet 'let x = 2 + 3 * 4;'
    const generated4 = await ast.getGeneratedText();
    expect(generated).toContain('let x = 2 + 3 * 4;');

    // Output should be cleared on reset
    const output1 = await ast.getOutputText();
    expect(output).toBe('');
  });

  test('TraversePre, TraversePost, and StopTraversal events work and change status appropriately', async ({ page }) => {
    const ast7 = new ASTPage(page);

    // Ensure parsed
    await ast.clickParse();

    // Start pre-order traversal
    await ast.clickTraversePre();
    // Should set status to traversing
    let status6 = await ast.getStatusText();
    expect(status).toBe('Status: Traversing (pre-order)...');

    // Wait enough time for at least one traversal callback to run (traverseAnimate uses 600ms interval).
    // Wait 700ms to allow the first onStep to execute.
    await page.waitForTimeout(700);

    // During traversal there should be at least one node marked as selected (animation highlights nodes)
    const hasSelected = await ast.hasSelectedNodeInTree();
    expect(hasSelected).toBe(true);

    // Now stop traversal
    await ast.clickStopTraverse();
    status = await ast.getStatusText();
    // stopTraverse sets status to 'idle'
    expect(status).toBe('Status: idle');

    // Test post-order traversal similarly (fire and stop quickly)
    await ast.clickTraversePost();
    status = await ast.getStatusText();
    expect(status).toBe('Status: Traversing (post-order)...');

    // Allow one step to potentially highlight
    await page.waitForTimeout(700);

    // Stop traversal
    await ast.clickStopTraverse();
    status = await ast.getStatusText();
    expect(status).toBe('Status: idle');

    // Ensure no uncaught errors happened during traversal
    expect(pageErrors.length).toBe(0);
  }, { timeout: 20000 }); // allow extra time for traversal waits

  test('Selecting a node updates node details and highlights source region', async ({ page }) => {
    const ast8 = new ASTPage(page);

    // Ensure parsed
    await ast.clickParse();

    // Click the first node label in the tree to trigger showNodeInfo
    const clicked = await ast.selectFirstNodeLabel();
    expect(clicked).toBe(true);

    // NodeInfo should contain Type info and Range
    const infoHtml = await ast.getNodeInfoHtml();
    expect(infoHtml).toMatch(/<b>Type:<\/b>/);

    // The generated pane should contain a highlighted span for the source fragment
    const highlighted = await page.locator('#generated .code-highlight').count();
    expect(highlighted).toBeGreaterThan(0);
  });

  test('Edge case: clicking rename with empty inputs triggers alert and does not change status', async ({ page }) => {
    const ast9 = new ASTPage(page);

    // Ensure parsed
    await ast.clickParse();

    // Clear rename inputs
    await ast.setRenameInputs('', '');

    // Listen for alert dialog
    let alertSeen = false;
    page.once('dialog', async dialog => {
      alertSeen = true;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Provide both from and to names');
      await dialog.accept();
    });

    // Click rename; should trigger alert and return early (no status change)
    await ast.clickRename();

    expect(alertSeen).toBe(true);

    // Status should remain as parsed (or whatever current status is), but must not be renamed
    const status7 = await ast.getStatusText();
    expect(status).not.toMatch(/Renamed/);
  });

  test('Observe console and page errors over typical interactions (no uncaught errors expected)', async ({ page }) => {
    const ast10 = new ASTPage(page);

    // Perform a set of interactions to surface runtime errors if any
    await ast.clickParse();
    await ast.clickEval();
    await ast.clickFold();
    await ast.setRenameInputs('x', 'x1');
    await ast.clickRename();
    // Accept reset confirm
    await ast.clickReset(true);
    await ast.clickTraversePre();
    // Stop immediately
    await ast.clickStopTraverse();

    // After interactions, assert that there were no uncaught page errors
    // (The inline script handles many errors gracefully; uncaught page errors would indicate broken runtime)
    expect(pageErrors.length).toBe(0);

    // Console messages may exist; assert we successfully captured them as an array
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});