import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14a1b2-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object helper encapsulating common selectors and helpers
class RecursionPage {
  constructor(page) {
    this.page = page;
  }
  async goto() {
    await this.page.goto(APP_URL);
  }
  runBtn() { return this.page.locator('#runBtn'); }
  stepBtn() { return this.page.locator('#stepBtn'); }
  autoBtn() { return this.page.locator('#autoBtn'); }
  pauseBtn() { return this.page.locator('#pauseBtn'); }
  backBtn() { return this.page.locator('#backBtn'); }
  resetBtn() { return this.page.locator('#resetBtn'); }
  buildTreeBtn() { return this.page.locator('#buildTreeBtn'); }
  exportBtn() { return this.page.locator('#exportBtn'); }
  importBtn() { return this.page.locator('#importBtn'); }
  fileInput() { return this.page.locator('#fileInput'); }
  fillTemplate() { return this.page.locator('#fillTemplate'); }
  validateBtn() { return this.page.locator('#validateBtn'); }
  templateSelect() { return this.page.locator('#templateSelect'); }
  paramN() { return this.page.locator('#paramN'); }
  branchB() { return this.page.locator('#branchB'); }
  maxDepth() { return this.page.locator('#maxDepth'); }
  delay() { return this.page.locator('#delay'); }
  memoize() { return this.page.locator('#memoize'); }
  expr() { return this.page.locator('#expr'); }
  stackView() { return this.page.locator('#stackView'); }
  treeView() { return this.page.locator('#treeView'); }
  logView() { return this.page.locator('#logView'); }
  stats() { return this.page.locator('#stats'); }
  nodeDetails() { return this.page.locator('#nodeDetails'); }
  forceReturn() { return this.page.locator('#forceReturn'); }
  applyForce() { return this.page.locator('#applyForce'); }

  // Utility: wait until stackView shows at least one frame (indicates a run has begun)
  async waitForStackContains(text, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, t) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(t),
      '#stackView',
      text,
      { timeout }
    );
  }

  async waitForLogContains(substr, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, s) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(s),
      '#logView',
      substr,
      { timeout }
    );
  }

  async getTreeListItems() {
    return this.page.locator('#treeView li');
  }
}

test.describe('Recursion Explorer — end-to-end FSM validation', () => {
  // capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Accept alerts by default, but capture their messages for assertions
    page.setDefaultTimeout(10_000);
  });

  test('Initialization & Idle state verification (S0_Idle)', async ({ page }) => {
    // This test verifies initial "Idle" state: resetState called on load, UI shows no active frames, stats zeros.
    const consoleMessages = [];
    const pageErrors = [];
    let lastDialog = null;

    page.on('console', m => consoleMessages.push({type: m.type(), text: m.text()}));
    page.on('pageerror', e => pageErrors.push(e));
    page.on('dialog', async dialog => { lastDialog = dialog; await dialog.accept(); });

    const rp = new RecursionPage(page);
    await rp.goto();

    // Assertions for idle UI
    await expect(rp.stackView()).toHaveText(/no active frames|\(no active frames\)/i);
    await expect(rp.nodeDetails()).toHaveText(/No node selected\./);
    await expect(rp.stats()).toHaveText(/Calls:\s*0\s*\|\s*Returns:\s*0\s*\|\s*Max depth:\s*0\s*\|\s*Memo hits:\s*0/);

    // No uncaught page errors on initialization
    expect(pageErrors.length).toBe(0);

    // No blocking dialogs were shown on load (lastDialog stays null)
    expect(lastDialog).toBeNull();

    // Ensure no severe console errors occurred (allow logs/info)
    const severe = consoleMessages.find(m => m.type === 'error');
    expect(severe).toBeUndefined();
  });

  test.describe('Run, Step, Auto, Pause, Back, Reset transitions (S1,S2,S3,S4,S0)', () => {
    test('Stepping through a simple factorial run (S0 -> S2_Stepping -> S4_Paused -> back -> reset)', async ({ page }) => {
      // This test covers stepping mode start, stepping through a few actions, pausing/back/reset behavior.
      const consoleMessages = [];
      const pageErrors = [];
      const dialogs = [];
      page.on('console', m => consoleMessages.push({type: m.type(), text: m.text()}));
      page.on('pageerror', e => pageErrors.push(e));
      page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });

      const rp = new RecursionPage(page);
      await rp.goto();

      // Ensure expression is factorial default
      await expect(rp.expr()).toHaveValue(/n<=1\?1:n\*recurse\(n-1\)/);

      // Click Step to start stepping run (should enter initial frame and pause)
      await rp.stepBtn().click();

      // After starting stepping, we expect at least root frame displayed in stack
      await rp.waitForStackContains('#1 n=', 3000);
      await expect(rp.stackView()).toContainText('#1 n=');

      // The history should now have at least one snapshot; do another step to create child frame(s)
      // Use step button again which acts as nextStep while running
      await rp.stepBtn().click();
      // Wait for a child frame to be created (stack should grow)
      await page.waitForTimeout(200); // brief pause to allow DOM update
      const stackText1 = await rp.stackView().innerText();
      expect(stackText1.length).toBeGreaterThan(10);

      // Ensure the log reflects entering/creating children
      const logText = await rp.logView().innerText();
      expect(logText.toLowerCase()).toMatch(/enter frame #|created child/i);

      // Click Back to rewind one snapshot (S4 -> back -> previous snapshot)
      await rp.backBtn().click();
      // A dialog may occur if no earlier snapshot; ensure either rewind happened or an alert shown
      await page.waitForTimeout(200);
      const logAfterBack = await rp.logView().innerText();
      // Either it contains "Rewind one step." or user saw an alert (dialog captured)
      const hadRewind = /rewind one step/i.test(logAfterBack);
      const hadAlert = dialogs.some(d => /no earlier snapshot available/i.test(d));
      expect(hadRewind || hadAlert).toBeTruthy();

      // Now Reset to go back to Idle
      await rp.resetBtn().click();
      await expect(rp.stackView()).toHaveText(/no active frames|\(no active frames\)/i);
      await expect(rp.stats()).toHaveText(/Calls:\s*0/);

      // Ensure no uncaught page errors happened during stepping
      expect(pageErrors.length).toBe(0);
      const severe = consoleMessages.find(m => m.type === 'error');
      expect(severe).toBeUndefined();
    });

    test('Auto run and pause (S0 -> S3_AutoRunning -> S4_Paused)', async ({ page }) => {
      // This test starts an auto-run, lets it run briefly, then pauses and checks log and stats update.
      const consoleMessages = [];
      const pageErrors = [];
      const dialogs = [];
      page.on('console', m => consoleMessages.push({type: m.type(), text: m.text()}));
      page.on('pageerror', e => pageErrors.push(e));
      page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });

      const rp = new RecursionPage(page);
      await rp.goto();

      // Reduce delay for quicker auto execution
      await rp.delay().fill('50');
      // Start auto run
      await rp.autoBtn().click(); // triggers startRun({auto:true,...})
      // Wait briefly to allow some log activity
      await rp.waitForLogContains('Enter frame', 3000);
      // Pause execution
      await rp.pauseBtn().click();
      // Pause should log 'Run paused.' (or at least pause auto), check log
      await rp.waitForLogContains('Run paused.', 2000);
      const logText = await rp.logView().innerText();
      expect(logText).toMatch(/Run paused\.|Enter frame/i);

      // After pause, ensure stats show some calls were made
      const statsText = await rp.stats().innerText();
      expect(/Calls:\s*\d+/.test(statsText)).toBeTruthy();

      // Ensure no uncaught errors
      expect(pageErrors.length).toBe(0);
      const severe = consoleMessages.find(m => m.type === 'error');
      expect(severe).toBeUndefined();
    });
  });

  test.describe('Build, Export, Import (S5_Exporting, S6_Importing)', () => {
    test('Build full recursion tree (buildTreeBtn) then export and import JSON', async ({ page, tmpDir }) => {
      // This test triggers buildFullTreeQuick, exports the produced tree via the UI,
      // captures the download, and then imports the same JSON file back to verify import handling.
      const consoleMessages = [];
      const pageErrors = [];
      const dialogs = [];
      page.on('console', m => consoleMessages.push({type: m.type(), text: m.text()}));
      page.on('pageerror', e => pageErrors.push(e));
      page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });

      const rp = new RecursionPage(page);
      await rp.goto();

      // Ensure root param is small so build is quick
      await rp.paramN().fill('5');
      // Build full recursion tree
      await rp.buildTreeBtn().click();

      // After building, treeView should contain list items
      await page.waitForFunction(() => {
        const tv = document.getElementById('treeView');
        return tv && tv.querySelectorAll('li').length > 0;
      }, null, { timeout: 3000 });

      const items = await rp.getTreeListItems().count();
      expect(items).toBeGreaterThan(0);

      // Trigger export and await download event generated by anchor click
      // Playwright can capture download events
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        rp.exportBtn().click()
      ]);
      // Save the download to a temporary path
      const downloadPath = path.join(tmpDir || '.', 'recursion_tree_test_export.json');
      await download.saveAs(downloadPath);
      // Verify file exists and contains JSON structure
      const fileContent = fs.readFileSync(downloadPath, 'utf-8');
      expect(() => JSON.parse(fileContent)).not.toThrow();

      // Now test import using the file we just saved.
      // Use fileInput#setInputFiles to simulate the user selecting the file
      await rp.fileInput().setInputFiles(downloadPath);
      // After import, the UI should display the imported tree
      await page.waitForFunction(() => {
        const tv = document.getElementById('treeView');
        return tv && (tv.textContent || '').length > 0;
      }, null, { timeout: 3000 });
      // Ensure nodeDetails text remains safe (no uncaught errors)
      const nodeDetailsText = await rp.nodeDetails().innerText();
      expect(nodeDetailsText.length).toBeGreaterThan(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
      const severe = consoleMessages.find(m => m.type === 'error');
      expect(severe).toBeUndefined();
    });
  });

  test.describe('Templates, Validation, Examples, and Edge cases', () => {
    test('Fill template, use quick example buttons, and validate expressions', async ({ page }) => {
      // This test confirms templates loading into expression textarea and that validate button shows alerts on parse errors.
      const dialogs = [];
      page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
      const rp = new RecursionPage(page);
      await rp.goto();

      // Select fibonacci template via select and fill template
      await rp.templateSelect().selectOption('fibonacci');
      await rp.fillTemplate().click();
      await expect(rp.expr()).toHaveValue(/recurse\(n-1\)\+recurse\(n-2\)/);

      // Click a quick example button (Factorial)
      await page.locator('button.exampleBtn', { hasText: 'Factorial' }).click();
      await expect(rp.expr()).toHaveValue(/n<=1\?1:n\*recurse\(n-1\)/);

      // Now try an invalid expression and expect validate to show an alert
      await rp.expr().fill('this_is_invalid_no_ternary');
      await rp.validateBtn().click();
      // Wait for dialog to be captured
      await page.waitForTimeout(200);
      expect(dialogs.some(d => /Parse error/i.test(d))).toBeTruthy();

      // Restore a valid expression
      await rp.expr().fill('n<=1?1:n*recurse(n-1)');
      await rp.validateBtn().click();
      // Should show "Expression parsed successfully."
      await page.waitForTimeout(200);
      expect(dialogs.some(d => /parsed successfully/i.test(d))).toBeTruthy();
    });

    test('Edge case: exceed max depth triggers abort (error path)', async ({ page }) => {
      // This test forces an exceeded max depth by setting a tiny maxDepth and a recursion that expands.
      const dialogs = [];
      page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
      const rp = new RecursionPage(page);
      await rp.goto();

      // Use a binary-tree like expression that creates multiple recursion levels quickly
      await rp.expr().fill('n<=0?1:recurse(n-1)+recurse(n-1)');
      await rp.paramN().fill('10');
      // Set maxDepth to 1 to force error quickly
      await rp.maxDepth().fill('1');

      // Click Run - startRun should attempt to create initial frames and eventually throw "Exceeded max depth limit"
      await rp.runBtn().click();
      // Wait for dialog to appear
      await page.waitForTimeout(300);
      // The startRun code catches createFrame exceptions and alerts "Cannot create initial frame: ..."
      expect(dialogs.some(d => /Cannot create initial frame|Exceeded max depth limit/i.test(d))).toBeTruthy();
    });
  });

  test.describe('Node selection and forced return behavior', () => {
    test('Select a pending node during stepping and apply forced return', async ({ page }) => {
      // This test starts a stepping run, creates a child frame that is still pending, selects it, forces a return value,
      // and asserts the forced return applied and logged.
      const dialogs = [];
      page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });

      const rp = new RecursionPage(page);
      await rp.goto();

      // Use an expression that creates at least one child: factorial is fine
      await rp.expr().fill('n<=1?1:n*recurse(n-1)');
      await rp.paramN().fill('4');

      // Start stepping run
      await rp.stepBtn().click();
      // Wait for root entered
      await rp.waitForStackContains('#1 n=', 2000);

      // Step to create child frames (press step to create child)
      await rp.stepBtn().click();
      // Give time for child to be created
      await page.waitForTimeout(200);

      // The treeView should have at least one li to click
      const firstLi = page.locator('#treeView li').first();
      await expect(firstLi).toBeVisible();
      // Click the child/first node to select it (this will set selectedNode)
      await firstLi.click();
      // After selection, nodeDetails should reflect a Frame #
      await expect(rp.nodeDetails()).toContainText(/Frame #/);

      // Apply a forced return: fill a numeric JSON value (e.g., 1)
      await rp.forceReturn().fill('1');
      await rp.applyForce().click();

      // After applying forced return, nodeDetails should show result and 'result:' line
      await page.waitForTimeout(200);
      const nd = await rp.nodeDetails().innerText();
      expect(/result:\s*1/.test(nd) || /result:\s*"1"/.test(nd)).toBeTruthy();

      // Log should contain "Forced return"
      await rp.waitForLogContains('Forced return', 2000);
      const logText = await rp.logView().innerText();
      expect(/Forced return/i.test(logText)).toBeTruthy();
    });
  });

  test.describe('Console & page error observation (global assertions)', () => {
    test('No unexpected uncaught exceptions during a typical workflow', async ({ page }) => {
      // This test performs a short workflow and ensures no pageerror events occurred.
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e));
      // Accept any dialogs
      page.on('dialog', async dialog => await dialog.accept());

      const rp = new RecursionPage(page);
      await rp.goto();

      // Do a small build and reset
      await rp.buildTreeBtn().click();
      await page.waitForTimeout(200);
      await rp.resetBtn().click();
      await page.waitForTimeout(200);
      // Do a step-run and abort via reset quickly
      await rp.stepBtn().click();
      await page.waitForTimeout(200);
      await rp.resetBtn().click();

      // Assert no page errors were emitted during the interactions
      expect(pageErrors.length).toBe(0);
    });
  });

});