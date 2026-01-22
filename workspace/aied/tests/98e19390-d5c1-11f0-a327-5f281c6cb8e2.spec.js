import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e19390-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe.serial('Adjacency Matrix Interactive Demo (FSM validation) - 98e19390...', () => {
  // Capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Ensure app finished rendering (seed demo runs on load)
    await page.waitForSelector('#matrixTable');
  });

  test.afterEach(async () => {
    // Assert that no fatal page errors (ReferenceError, SyntaxError, TypeError) occurred
    // If any such errors occurred, fail the test suite. This validates the runtime integrity.
    const fatal = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(fatal, `No Reference/Syntax/Type errors should occur. Page errors: ${pageErrors.map(e=>String(e)).join(' || ')}`)
      .toHaveLength(0);

    // Assert there are no console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, `No console.error should be emitted. Console errors: ${consoleErrors.map(c=>c.text).join(' || ')}`)
      .toHaveLength(0);
  });

  // Helper page object encapsulating common interactions
  class GraphApp {
    constructor(page) {
      this.page = page;
    }

    async wrapBox() {
      const wrap = this.page.locator('#canvasWrap');
      return await wrap.boundingBox();
    }

    // Click absolute coordinates relative to the wrap
    async clickOnWrapAt(relX, relY, options = {}) {
      const box = await this.wrapBox();
      const x = box.x + relX;
      const y = box.y + relY;
      // Use mouse to ensure pointer events (pointerdown/up) are fired as expected
      await this.page.mouse.move(x, y);
      if (options.button === 'right') {
        await this.page.mouse.down({ button: 'right' });
        await this.page.mouse.up({ button: 'right' });
      } else {
        await this.page.mouse.click(x, y, { button: options.button || 'left' });
      }
    }

    // Click center of canvas (useful for adding nodes via canvas click)
    async clickCanvasCenter() {
      const box = await this.wrapBox();
      await this.clickOnWrapAt(box.width / 2, box.height / 2);
    }

    async getNodeCount() {
      return parseInt(await this.page.locator('#nodeCount').innerText(), 10);
    }

    async getEdgeCount() {
      return parseInt(await this.page.locator('#edgeCount').innerText(), 10);
    }

    // matrix td at row i (0-based), col j (0-based)
    matrixCell(i, j) {
      // matrix table has header row as first tr, then data rows
      // so td is in tr:nth-child(i+2) and td:nth-child(j+1)
      return this.page.locator(`#matrixTable tr:nth-child(${i + 2}) td:nth-child(${j + 1})`);
    }

    matrixHeaderLabels() {
      return this.page.locator('#matrixTable tr:first-child th');
    }

    // Click a matrix cell (will trigger toggle/edit)
    async clickMatrixCell(i, j) {
      const cell = this.matrixCell(i, j);
      await cell.waitFor();
      await cell.click();
    }

    async selectNodeByApproxPosition(fractionX, fractionY) {
      // Click at given fractional positions of wrap (0..1)
      const box = await this.wrapBox();
      await this.clickOnWrapAt(box.width * fractionX, box.height * fractionY);
    }
  }

  test('Initial state: Idle -> seeded demo nodes present (S0_Idle evidence)', async ({ page }) => {
    // Validate initial seeded graph created by the app on load
    const app = new GraphApp(page);

    // The demo seeds 5 nodes; ensure UI reflects that
    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(5);

    // Matrix table should have header and at least as many rows as nodes
    const headerCells = await app.matrixHeaderLabels().count();
    // header has one corner th plus N ths => headerCells === N + 1
    expect(headerCells).toBe(nodeCount + 1);

    // Verify Nodes and Edges counts are displayed
    const edgeCount = await app.getEdgeCount();
    expect(edgeCount).toBeGreaterThanOrEqual(0);
  });

  test('Add Node via Add Node button (Transition S0_Idle -> S2_NodeAdded)', async ({ page }) => {
    // Clicking Add Node should increase node count and re-render matrix
    const app = new GraphApp(page);
    const before = await app.getNodeCount();

    await page.click('#addNodeBtn');
    // wait for UI update
    await page.waitForTimeout(150);

    const after = await app.getNodeCount();
    expect(after).toBe(before + 1);
  });

  test('Add Node via canvas click (Transition S0_Idle -> S2_NodeAdded)', async ({ page }) => {
    const app = new GraphApp(page);
    const before = await app.getNodeCount();

    // Click center of canvas to add node
    await app.clickCanvasCenter();
    await page.waitForTimeout(150);

    const after = await app.getNodeCount();
    expect(after).toBe(before + 1);
  });

  test('Toggle edge via matrix cell (S0_Idle -> S1_NodeSelected / S3_EdgeToggled)', async ({ page }) => {
    // Clicking a matrix cell toggles the edge value; test both toggle off and on
    const app = new GraphApp(page);

    // Use first two nodes (0,1). Determine current value and toggle.
    const cell01 = app.matrixCell(0, 1);
    await cell01.waitFor();
    const beforeText = (await cell01.innerText()).trim();
    const beforeVal = beforeText === '' ? '0' : beforeText;

    // Click to toggle
    await cell01.click();
    await page.waitForTimeout(120);
    const afterText = (await cell01.innerText()).trim();
    expect(afterText).not.toBe(beforeVal);

    // Toggle back to original to restore state
    await cell01.click();
    await page.waitForTimeout(120);
    const restoredText = (await cell01.innerText()).trim();
    expect(restoredText).toBe(beforeVal);
  });

  test('Export CSV shows alert with CSV snippet (Transition to S7_CSVExported)', async ({ page }) => {
    const app = new GraphApp(page);

    // Capture the alert dialog and assert its text content
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#exportBtn'),
    ]);
    expect(dialog.type()).toBe('alert');
    const text = dialog.message();
    expect(text.startsWith('CSV export:')).toBeTruthy();
    await dialog.dismiss();
  });

  test('Copy CSV handles clipboard or fallback prompt', async ({ page }) => {
    const app = new GraphApp(page);

    // The app attempts navigator.clipboard.writeText; if that fails it calls prompt('Copy this CSV:', csv)
    // We handle either an alert (success) or prompt fallback. We do not assume persistent clipboard API.
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('#copyBtn');
    const dialog = await dialogPromise;
    const t = dialog.type();
    const msg = dialog.message();
    if (t === 'alert') {
      expect(msg).toMatch(/CSV copied to clipboard/);
      await dialog.dismiss();
    } else if (t === 'prompt') {
      // Prompt fallback provides CSV to copy
      expect(msg).toMatch(/Copy this CSV:/);
      // Dismiss it (user would copy manually)
      await dialog.dismiss();
    } else {
      // Unexpected type: fail
      await dialog.dismiss();
      throw new Error('Unexpected dialog type when copying CSV: ' + t);
    }
  });

  test('Download CSV triggers download anchor creation without errors', async ({ page }) => {
    const app = new GraphApp(page);
    // Clicking download should create an anchor and click it; we ensure no page errors and node count unchanged
    const before = await app.getNodeCount();
    await page.click('#downloadBtn');
    // give some time for the download flow to execute
    await page.waitForTimeout(200);
    const after = await app.getNodeCount();
    expect(after).toBe(before);
  });

  test('Rename selected node via UI (S1_NodeSelected -> S6_NodeRenamed)', async ({ page }) => {
    const app = new GraphApp(page);

    // Seed uses specific relative positions to place nodes; click approximate location of first seeded node (A)
    // From implementation: node 0 placed at rect.width*0.25, rect.height*0.35
    const wrapBox = await app.wrapBox();
    const fx = 0.25, fy = 0.35;
    await app.clickOnWrapAt(wrapBox.width * fx, wrapBox.height * fy);
    await page.waitForTimeout(120);

    // Confirm selectedLabel is enabled and contains current label
    const selectedLabel = page.locator('#selectedLabel');
    await expect(selectedLabel).toBeEnabled();

    // Rename to a new label
    await selectedLabel.fill('Zed');
    await page.click('#renameBtn');
    await page.waitForTimeout(120);

    // Verify matrix header updated (first header th after corner should be 'Zed')
    const firstHeader = page.locator('#matrixTable tr:first-child th').nth(1);
    await expect(firstHeader).toHaveText('Zed');
  });

  test('Delete selected node via Delete button (S1_NodeSelected -> S5_NodeDeleted)', async ({ page }) => {
    const app = new GraphApp(page);

    // Select a node (use the same approximate position as before)
    const wrapBox = await app.wrapBox();
    await app.clickOnWrapAt(wrapBox.width * 0.25, wrapBox.height * 0.35);
    await page.waitForTimeout(120);

    const before = await app.getNodeCount();

    // Confirm dialog should appear; accept deletion
    const dlgPromise = page.waitForEvent('dialog');
    await page.click('#deleteNodeBtn');
    const dlg = await dlgPromise;
    expect(dlg.type()).toBe('confirm');
    // The confirm text matches the implementation: 'Delete selected node?'
    await dlg.accept();
    await page.waitForTimeout(150);

    const after = await app.getNodeCount();
    expect(after).toBe(before - 1);
  });

  test('Clear entire graph via Clear Graph button (S0_Idle -> S4_GraphCleared)', async ({ page }) => {
    const app = new GraphApp(page);

    // Confirm clearing resets nodes and edges to zero
    const before = await app.getNodeCount();
    expect(before).toBeGreaterThanOrEqual(0);

    const dlgPromise = page.waitForEvent('dialog');
    await page.click('#clearBtn');
    const dlg = await dlgPromise;
    expect(dlg.type()).toBe('confirm');
    await dlg.accept(); // accept the "Clear entire graph?" confirm
    await page.waitForTimeout(150);

    const after = await app.getNodeCount();
    expect(after).toBe(0);

    // Try clearing again but dismissing confirm should keep graph empty (edge case)
    const dlgPromise2 = page.waitForEvent('dialog');
    await page.click('#clearBtn');
    const dlg2 = await dlgPromise2;
    await dlg2.dismiss();
    await page.waitForTimeout(100);
    const after2 = await app.getNodeCount();
    expect(after2).toBe(0);
  });

  test('Import valid CSV updates graph (S0_Idle -> S8_CSVImported)', async ({ page }) => {
    const app = new GraphApp(page);

    // Prepare a 3x3 CSV with header labels
    const csv = [
      ',X,Y,Z',
      'X,0,1,0',
      'Y,1,0,1',
      'Z,0,1,0'
    ].join('\n');

    const dlgPromise = page.waitForEvent('dialog');
    await page.click('#importBtn');
    const dlg = await dlgPromise;
    expect(dlg.type()).toBe('prompt');
    // supply the CSV
    await dlg.accept(csv);

    // allow import processing time
    await page.waitForTimeout(300);

    // Validate node count updated to 3
    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBe(3);

    // Validate header labels match X,Y,Z
    const header2 = page.locator('#matrixTable tr:first-child th');
    await expect(header2.nth(1)).toHaveText('X');
    await expect(header2.nth(2)).toHaveText('Y');
    await expect(header2.nth(3)).toHaveText('Z');
  });

  test('Import invalid CSV shows error alert and preserves previous graph (error scenario)', async ({ page }) => {
    const app = new GraphApp(page);

    // Save current node count
    const before = await app.getNodeCount();

    // Provide a malformed (non-square) CSV
    const badCsv = [
      ',A,B',
      'A,0,1,2'  // row has 3 entries while header indicates 2; non-square
    ].join('\n');

    const dlgPromise = page.waitForEvent('dialog');
    await page.click('#importBtn');
    const dlg = await dlgPromise;
    expect(dlg.type()).toBe('prompt');
    await dlg.accept(badCsv);

    // The code alerts on failure: wait for the alert
    const alertDlg = await page.waitForEvent('dialog');
    expect(alertDlg.type()).toBe('alert');
    const msg = alertDlg.message();
    expect(msg).toMatch(/Failed to import CSV/);
    await alertDlg.dismiss();

    // Ensure node count unchanged
    const after = await app.getNodeCount();
    expect(after).toBe(before);
  });

  test('Weighted mode: invalid weight input shows alert; valid weight updates matrix (edge case)', async ({ page }) => {
    const app = new GraphApp(page);

    // Ensure at least 2 nodes exist; add if necessary
    let nodes = await app.getNodeCount();
    if (nodes < 2) {
      await page.click('#addNodeBtn');
      await page.waitForTimeout(120);
      nodes = await app.getNodeCount();
      expect(nodes).toBeGreaterThanOrEqual(2);
    }

    // Turn on Weighted mode
    await page.click('#weightedChk');
    await page.waitForTimeout(80);

    // Click a matrix cell (0,1) to prompt for a weight; supply invalid number 'abc' first
    const dlgPromise1 = page.waitForEvent('dialog');
    await app.clickMatrixCell(0, 1);
    const prompt1 = await dlgPromise1;
    expect(prompt1.type()).toBe('prompt');
    await prompt1.accept('abc'); // invalid numeric input

    // There will be an alert "Invalid number"
    const alert1 = await page.waitForEvent('dialog');
    expect(alert1.type()).toBe('alert');
    expect(alert1.message()).toContain('Invalid number');
    await alert1.dismiss();

    // Now provide a valid numeric value
    const dlgPromise2 = page.waitForEvent('dialog');
    await app.clickMatrixCell(0, 1);
    const prompt2 = await dlgPromise2;
    expect(prompt2.type()).toBe('prompt');
    await prompt2.accept('2.5');

    // Give UI time to update
    await page.waitForTimeout(150);
    const cellText = (await app.matrixCell(0, 1).innerText()).trim();
    // The cell should now show 2.5 (string)
    expect(cellText).toBe('2.5');

    // Turn off weighted mode -> should coerce nonzero entries to 1
    await page.click('#weightedChk');
    await page.waitForTimeout(120);
    const coercedText = (await app.matrixCell(0, 1).innerText()).trim();
    expect(coercedText).toBe('1');
  });

  test('Right-click on node triggers deletion confirm (edge-case contextmenu handler)', async ({ page }) => {
    const app = new GraphApp(page);

    // Ensure there's at least one node
    let before = await app.getNodeCount();
    if (before === 0) {
      await page.click('#addNodeBtn');
      await page.waitForTimeout(100);
      before = await app.getNodeCount();
      expect(before).toBeGreaterThanOrEqual(1);
    }

    // Right-click on an approximate node position (seeded first node location)
    const wrapBox = await app.wrapBox();
    const fx = 0.25, fy = 0.35;
    const dialogPromise = page.waitForEvent('dialog');
    // simulate pointerdown with button=2 at location to trigger right-click delete path
    await app.clickOnWrapAt(wrapBox.width * fx, wrapBox.height * fy, { button: 'right' });
    const dlg = await dialogPromise;
    // The impl uses confirm('Delete node "'+node.label+'"?')
    expect(dlg.type()).toBe('confirm');
    await dlg.accept();
    await page.waitForTimeout(120);

    const after = await app.getNodeCount();
    expect(after).toBe(before - 1);
  });

  // Final sanity check: ensure no unexpected dialogs or page errors remained
  test('Final sanity checks: no fatal errors emitted during sequence', async ({ page }) => {
    // This test relies on the afterEach hook assertions to validate no fatal page errors / console errors
    // We simply perform a trivial interaction to ensure app still responsive
    await page.click('#addNodeBtn');
    await page.waitForTimeout(80);
    const nodeCount = parseInt(await page.locator('#nodeCount').innerText(), 10);
    expect(nodeCount).toBeGreaterThanOrEqual(1);
  });

});