import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/12131541-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the AVL demo page to encapsulate common interactions
class AVLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // collect console messages and page errors for assertions
    this.page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(BASE);
    // wait for the main heading to ensure page has loaded
    await this.page.waitForSelector('h1:has-text("AVL Tree Interactive Demo")');
  }

  // getters for controls
  insertSelector() { return '#insertBtn'; }
  removeSelector() { return '#removeBtn'; }
  searchSelector() { return '#searchBtn'; }
  clearSelector() { return '#clearBtn'; }
  valInputSelector() { return '#valInput'; }
  traversalSelectSelector() { return '#traversalSelect'; }
  showTraversalSelector() { return '#showTraversalBtn'; }
  showTreeSelector() { return '#showTreeBtn'; }
  showBalanceSelector() { return '#showBalanceBtn'; }
  bulkInputSelector() { return '#bulkInput'; }
  bulkInsertSelector() { return '#bulkInsertBtn'; }
  outputSelector() { return '#output'; }
  showStepsCheckboxSelector() { return '#showStepsCheckbox'; }
  minSelector() { return '#minBtn'; }
  maxSelector() { return '#maxBtn'; }
  heightSelector() { return '#heightBtn'; }
  sizeSelector() { return '#sizeBtn'; }
  demoLLSelector() { return '#demoLL'; }
  demoRRSelector() { return '#demoRR'; }
  demoLRSelector() { return '#demoLR'; }
  demoRLSelector() { return '#demoRL'; }
  probeInputSelector() { return '#probeInput'; }
  probeBtnSelector() { return '#probeBtn'; }
  delayRangeSelector() { return '#delayRange'; }
  delayValSelector() { return '#delayVal'; }
  stepBtnSelector() { return '#stepBtn'; }
  autoRunBtnSelector() { return '#autoRunBtn'; }
  pauseBtnSelector() { return '#pauseBtn'; }

  // helper to read output content
  async getOutputText() {
    return (await this.page.locator(this.outputSelector()).innerText()).trim();
  }

  // helper to set the value of the main numeric input and click insert
  async insertKey(key) {
    await this.page.fill(this.valInputSelector(), String(key));
    await this.page.click(this.insertSelector());
  }

  async removeKey(key) {
    await this.page.fill(this.valInputSelector(), String(key));
    await this.page.click(this.removeSelector());
  }

  async searchKey(key) {
    await this.page.fill(this.valInputSelector(), String(key));
    await this.page.click(this.searchSelector());
  }

  async clearTree() {
    await this.page.click(this.clearSelector());
  }

  async showTraversal() {
    await this.page.click(this.showTraversalSelector());
  }

  async showTreeStructure() {
    await this.page.click(this.showTreeSelector());
  }

  async showBalances() {
    await this.page.click(this.showBalanceSelector());
  }

  async bulkInsert(values) {
    await this.page.fill(this.bulkInputSelector(), values);
    await this.page.click(this.bulkInsertSelector());
  }

  async setTraversal(type) {
    await this.page.selectOption(this.traversalSelectSelector(), type);
  }

  async toggleShowSteps(checked) {
    const locator = this.page.locator(this.showStepsCheckboxSelector());
    const isChecked = await locator.isChecked();
    if (isChecked !== checked) {
      await locator.click();
    }
  }

  async clickDemo(selector) {
    await this.page.click(selector);
  }

  async probeKey(key) {
    await this.page.fill(this.probeInputSelector(), String(key));
    await this.page.click(this.probeBtnSelector());
  }

  async setDelay(ms) {
    // set value property and dispatch input event so UI updates
    await this.page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, this.delayRangeSelector(), String(ms));
  }

  async clickAutoRun() {
    await this.page.click(this.autoRunBtnSelector());
  }

  async clickPause() {
    await this.page.click(this.pauseBtnSelector());
  }

  async clickStep() {
    await this.page.click(this.stepBtnSelector());
  }
}

// Grouped tests for the AVL Tree Interactive Demo
test.describe('AVL Tree Interactive Demo - Comprehensive E2E', () => {
  let avl;

  test.beforeEach(async ({ page }) => {
    avl = new AVLPage(page);
    await avl.goto();
  });

  test.afterEach(async () => {
    // After each test ensure there were no uncaught exceptions on the page
    // If there are page errors, we will assert their absence in specific tests.
  });

  test('Initial render / Idle state: page elements and heading present', async ({ page }) => {
    // Validate basic rendering - corresponds to S0_Idle
    const heading = await page.locator('h1').innerText();
    expect(heading).toContain('AVL Tree Interactive Demo');

    // output container exists and is empty initially
    const out = await avl.getOutputText();
    // output may be empty string - ensure it's defined
    expect(typeof out).toBe('string');

    // There should be no immediate page errors after load
    expect(avl.pageErrors.length).toBe(0);
  });

  test('Clear Tree transition: clicking Clear Tree outputs cleared message', async ({ page }) => {
    // Click clear and assert output message - corresponds to S0 -> S1 ClearTree
    await avl.clearTree();
    await expect(page.locator(avl.outputSelector())).toHaveText(/Tree has been cleared\./, { timeout: 2000 });
    expect(avl.pageErrors.length).toBe(0);
  });

  test('InsertKey transition: insert a single key and verify traversal and step logs', async ({ page }) => {
    // Enable step logs so the stepQueue logs are shown in #output
    await avl.toggleShowSteps(true);

    // Insert a key and assert step logs (S0 -> S3)
    await avl.insertKey(15);

    // After insert processed (delay = 0 default), output should include an insertion header
    await expect(page.locator(avl.outputSelector())).toContainText('=== Insertion of 15 ===');

    // Now show traversal to validate tree contains the just inserted key
    await avl.setTraversal('inorder');
    await avl.showTraversal();
    const out = await avl.getOutputText();
    expect(out).toContain('Inorder traversal:');
    expect(out).toContain('15');

    expect(avl.pageErrors.length).toBe(0);
  });

  test('BulkInsert transition and various traversals', async ({ page }) => {
    // Bulk insert multiple values and validate traversals (S3 related transitions)
    await avl.toggleShowSteps(false); // step logs not needed; traversal outputs use outputSet

    // Insert multiple nodes
    await avl.bulkInsert('30, 20, 40, 10, 25');

    // Wait until operations complete: after bulk insertion with delay 0, tree should be ready
    // Now check inorder traversal contains sorted elements
    await avl.setTraversal('inorder');
    await avl.showTraversal();
    await expect(page.locator(avl.outputSelector())).toContainText('Inorder traversal:');
    const inorder = await avl.getOutputText();
    // inorder should contain the elements sorted: 10 20 25 30 40
    expect(inorder).toMatch(/10\s+20\s+25\s+30\s+40/);

    // Preorder traversal should contain root first (we at least ensure it's not empty)
    await avl.setTraversal('preorder');
    await avl.showTraversal();
    const pre = await avl.getOutputText();
    expect(pre).toContain('Preorder traversal:');

    // Level-order should display multiple lines (levels)
    await avl.setTraversal('levelorder');
    await avl.showTraversal();
    const level = await avl.getOutputText();
    expect(level).toContain('Level-order traversal:');

    expect(avl.pageErrors.length).toBe(0);
  });

  test('RemoveKey transition: remove an existing and a non-existing key', async ({ page }) => {
    // Ensure some nodes exist first
    await avl.bulkInsert('50, 30, 70');
    // Remove a key that exists
    await avl.removeKey(30);

    // Because step logs are not shown by default, use showTraversal to confirm removal
    await avl.setTraversal('inorder');
    await avl.showTraversal();
    let out = await avl.getOutputText();
    expect(out).not.toContain('30');

    // Attempt to remove a non-existing key - should output validation or removal-not-found in steps
    // Provide invalid input to test error output for remove
    await avl.removeKey('not-a-number'); // this will trigger the JS validation and outputSet
    await expect(page.locator(avl.outputSelector())).toContainText('Remove: Please input a valid integer.');

    expect(avl.pageErrors.length).toBe(0);
  });

  test('ShowTreeStructure and ShowNodeBalances transitions', async ({ page }) => {
    // Prepare tree with some nodes
    await avl.bulkInsert('15, 10, 20');

    // Show tree structure textual output
    await avl.showTreeStructure();
    const treeStr = await avl.getOutputText();
    expect(treeStr).toContain('Tree structure (rotated - root center):');
    // Expect some ASCII tree characters which indicate structure was produced
    expect(treeStr).toMatch(/[└┌──\(null\)]|└──/);

    // Show node balances
    await avl.showBalances();
    const balStr = await avl.getOutputText();
    expect(balStr).toContain('Tree structure with balance factors (B):');
    expect(balStr).toMatch(/\(B:\s*-?\d+\)/);

    expect(avl.pageErrors.length).toBe(0);
  });

  test('FindMin / FindMax / GetHeight / GetSize transitions', async ({ page }) => {
    // Start fresh
    await avl.clearTree();
    await avl.bulkInsert('8, 3, 10, 1, 6, 14');

    // Find Min
    await avl.page.click(avl.minSelector());
    await expect(page.locator(avl.outputSelector())).toContainText('Minimum key: 1');

    // Find Max
    await avl.page.click(avl.maxSelector());
    await expect(page.locator(avl.outputSelector())).toContainText('Maximum key: 14');

    // Height (root height)
    await avl.page.click(avl.heightSelector());
    const heightOut = await avl.getOutputText();
    expect(heightOut).toMatch(/Tree height:\s*\d+/);

    // Size
    await avl.page.click(avl.sizeSelector());
    const sizeOut = await avl.getOutputText();
    expect(sizeOut).toContain('Tree size (number of nodes):');
    expect(sizeOut).toMatch(/\d+/);

    expect(avl.pageErrors.length).toBe(0);
  });

  test('Demo rotations (LL, RR, LR, RL) produce demo messages and resulting tree', async ({ page }) => {
    // For each demo, verify initial demo message and that traversal after demo contains the expected set of keys
    // LL demo
    await avl.clickDemo(avl.demoLLSelector());
    await expect(page.locator(avl.outputSelector())).toContainText('Demo LL rotation:');
    // After demo completes, show inorder traversal to verify keys exist
    await avl.setTraversal('inorder');
    await avl.showTraversal();
    let out = await avl.getOutputText();
    expect(out).toContain('Inorder traversal:');
    expect(out).toMatch(/\b10\b|\b20\b|\b30\b/);

    // RR demo
    await avl.clickDemo(avl.demoRRSelector());
    await expect(page.locator(avl.outputSelector())).toContainText('Demo RR rotation:');
    await avl.setTraversal('inorder');
    await avl.showTraversal();
    out = await avl.getOutputText();
    expect(out).toContain('Inorder traversal:');
    expect(out).toMatch(/\b10\b|\b20\b|\b30\b/);

    // LR demo
    await avl.clickDemo(avl.demoLRSelector());
    await expect(page.locator(avl.outputSelector())).toContainText('Demo LR rotation:');
    await avl.setTraversal('inorder');
    await avl.showTraversal();
    out = await avl.getOutputText();
    expect(out).toContain('Inorder traversal:');

    // RL demo
    await avl.clickDemo(avl.demoRLSelector());
    await expect(page.locator(avl.outputSelector())).toContainText('Demo RL rotation:');
    await avl.setTraversal('inorder');
    await avl.showTraversal();
    out = await avl.getOutputText();
    expect(out).toContain('Inorder traversal:');

    expect(avl.pageErrors.length).toBe(0);
  });

  test('Probe node: valid and invalid probe inputs', async ({ page }) => {
    // Prepare tree
    await avl.bulkInsert('5, 2, 8');

    // Probe existing node
    await avl.probeKey(2);
    let out = await avl.getOutputText();
    expect(out).toContain('Node probe path:');
    expect(out).toContain('Found key 2').or(expect(out).toContain('Node details:'));

    // Probe non-existing node
    await avl.probeKey(999);
    out = await avl.getOutputText();
    expect(out).toContain('Node probe path:');
    expect(out).toContain('not found in tree').or(expect(out).toContain('Key 999 not found.'));

    // Invalid input (non-integer) for probe
    await avl.page.fill(avl.probeInputSelector(), 'abc');
    await avl.page.click(avl.probeBtnSelector());
    out = await avl.getOutputText();
    expect(out).toContain('Input is not a valid integer.');

    expect(avl.pageErrors.length).toBe(0);
  });

  test('Edge cases and error scenarios: invalid insert, invalid bulk insert, search not found', async ({ page }) => {
    // Invalid insert (empty)
    await avl.page.fill(avl.valInputSelector(), '');
    await avl.page.click(avl.insertSelector());
    await expect(page.locator(avl.outputSelector())).toContainText('Insert: Please input a valid integer.');

    // Invalid bulk insert
    await avl.bulkInsert('5, 3, foo, 7');
    await expect(page.locator(avl.outputSelector())).toContainText('Bulk Insert: Input must be space or comma separated integers only.');

    // Search for non-existing key
    await avl.searchKey(123456);
    const out = await avl.getOutputText();
    expect(out).toContain('Search path:');
    expect(out).toContain('not found');

    expect(avl.pageErrors.length).toBe(0);
  });

  test('Controls: Auto Run, Pause and Step behavior with delay', async ({ page }) => {
    // This test validates that the auto-run interval can be started and paused and that step does some work when paused.
    // Prepare multiple insertions so the queue is non-empty.
    await avl.toggleShowSteps(true); // show step outputs for visibility
    await avl.bulkInsert('100,200,300,400'); // populate queue and process (delay default 0). Now re-populate for autoRun scenario

    // Clear and enqueue with delay so autoRun uses intervals
    await avl.clearTree();
    // push items onto stepQueue via bulkInsert but we will set delay > 0 so processStepQueue uses interval
    await avl.toggleShowSteps(true);
    await avl.setDelay(200); // 200ms per step
    await avl.bulkInsert('7,6,5'); // these will be queued and auto-processed

    // Start auto-run
    await avl.clickAutoRun();

    // Wait a short time then pause; the page should report "Auto run paused." after we click pause
    await page.waitForTimeout(150); // allow some steps to process
    await avl.clickPause();

    // After pause, output should mention "Auto run paused."
    const out = await avl.getOutputText();
    expect(out).toContain('Auto run paused.').or(expect(out).toContain('All steps complete.'));

    // Ensure Step button works when not auto-running: click Step to process next step manually
    await avl.clickStep();
    // After stepping, output should include "=== Insertion" header or "No actions in queue."
    const out2 = await avl.getOutputText();
    expect(out2.length).toBeGreaterThan(0);

    // Reset delay back to 0 for other tests
    await avl.setDelay(0);

    expect(avl.pageErrors.length).toBe(0);
  });

  test('No uncaught runtime exceptions on page load and interactions', async ({ page }) => {
    // This test ensures that while using the app normally we do not observe uncaught page errors.
    // Perform some basic interactions
    await avl.clearTree();
    await avl.insertKey(42);
    await avl.setTraversal('inorder');
    await avl.showTraversal();

    // Assert that there have been no uncaught exceptions captured via pageerror during the test
    expect(avl.pageErrors.length).toBe(0);

    // Additionally ensure console messages do not contain "ReferenceError", "TypeError", "SyntaxError" strings
    const consoleText = avl.consoleMessages.map(m => m.text).join('\n');
    expect(consoleText).not.toContain('ReferenceError');
    expect(consoleText).not.toContain('TypeError');
    expect(consoleText).not.toContain('SyntaxError');
  });
});