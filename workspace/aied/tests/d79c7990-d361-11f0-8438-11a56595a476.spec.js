import { test, expect } from '@playwright/test';

// Test file for Application ID: d79c7990-d361-11f0-8438-11a56595a476
// Served at: http://127.0.0.1:5500/workspace/batch-1207/html/d79c7990-d361-11f0-8438-11a56595a476.html
//
// These tests validate the FSM states and transitions for the Union-Find visualization.
// They load the page as-is (do not modify or patch the page), observe console messages
// and page errors, and assert expected DOM updates, logs, and dialogs for error cases.
//
// Note: The page auto-initializes on load via initializeBtn.click() in the script; tests
// account for that behavior.

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79c7990-d361-11f0-8438-11a56595a476.html';

// Page Object for interacting with the Union-Find page
class UnionFindPage {
  constructor(page) {
    this.page = page;
    this.totalInput = page.locator('#totalElements');
    this.initializeBtn = page.locator('#initializeBtn');
    this.unionControls = page.locator('#unionControls');
    this.findControls = page.locator('#findControls');
    this.unionA = page.locator('#unionA');
    this.unionB = page.locator('#unionB');
    this.unionBtn = page.locator('#unionBtn');
    this.findElem = page.locator('#findElem');
    this.findBtn = page.locator('#findBtn');
    this.setsContainer = page.locator('#setsContainer');
    this.infoBox = page.locator('#info');
    this.logBox = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for auto-initialize to complete: initialized log entry should appear
    await expect(this.logBox).toContainText('Initialized Union-Find structure');
  }

  async getInfoText() {
    return (await this.infoBox.innerText()).trim();
  }

  async getLogLines() {
    const paragraphs = this.logBox.locator('p');
    const count = await paragraphs.count();
    const lines = [];
    for (let i = 0; i < count; i++) {
      lines.push((await paragraphs.nth(i).innerText()).trim());
    }
    return lines;
  }

  // Returns array of { representative: number, elements: number[] }
  async getSets() {
    const sets = this.page.locator('.set');
    const count = await sets.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const set = sets.nth(i);
      const reprText = await set.locator('.representative').innerText();
      // reprText like "Rep: 0"
      const rep = Number(reprText.replace(/[^0-9\-]/g, '').trim());
      const elems = [];
      const elemSpans = set.locator('.element');
      const ecount = await elemSpans.count();
      for (let j = 0; j < ecount; j++) {
        const v = await elemSpans.nth(j).innerText();
        elems.push(Number(v.trim()));
      }
      result.push({ representative: rep, elements: elems });
    }
    return result;
  }

  async clickInitializeExpectDialogIfAny(totalValue) {
    // If totalValue provided, set input
    if (totalValue !== undefined) {
      await this.totalInput.fill(String(totalValue));
    }
    // Perform click and handle dialog if it appears
    const dialogPromise = this.page.waitForEvent('dialog').then(dialog => dialog);
    // Race between click completing and potential dialog appearing.
    await Promise.resolve(this.initializeBtn.click());
    // Wait briefly to see if dialog appeared
    let dialog;
    try {
      dialog = await dialogPromise;
    } catch {
      dialog = null;
    }
    return dialog;
  }

  async clickUnionExpectDialogIfAny(a, b) {
    if (a !== undefined) await this.unionA.fill(String(a));
    if (b !== undefined) await this.unionB.fill(String(b));
    const dialogPromise = this.page.waitForEvent('dialog').then(dialog => dialog);
    await Promise.resolve(this.unionBtn.click());
    let dialog;
    try {
      dialog = await dialogPromise;
    } catch {
      dialog = null;
    }
    return dialog;
  }

  async clickFindExpectDialogIfAny(x) {
    if (x !== undefined) await this.findElem.fill(String(x));
    const dialogPromise = this.page.waitForEvent('dialog').then(dialog => dialog);
    await Promise.resolve(this.findBtn.click());
    let dialog;
    try {
      dialog = await dialogPromise;
    } catch {
      dialog = null;
    }
    return dialog;
  }
}

test.describe('Union-Find Visualization - FSM states and transitions', () => {
  // Arrays to capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', error => {
      // pageerror is an Error object
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // Ensure that tests explicitly assert pageErrors within tests.
    // This afterEach does not fail tests by itself.
  });

  test('Initial state after load (S1_Initialized): auto-initialize and render sets', async ({ page }) => {
    // Validate that auto-initialization occurred on load and the initial state is correct.
    const ufPage = new UnionFindPage(page);
    await ufPage.goto();

    // Verify controls for union/find are visible
    await expect(ufPage.unionControls).toBeVisible();
    await expect(ufPage.findControls).toBeVisible();

    // Info box should reflect initialization for 10 elements
    const info = await ufPage.getInfoText();
    expect(info).toContain('Initialized 10 disjoint sets');

    // The log should contain the initialization message
    const logs = await ufPage.getLogLines();
    expect(logs.some(l => /Initialized Union-Find structure with 10 elements/.test(l))).toBeTruthy();

    // There should be 10 .set elements rendered (each element in its own set)
    const sets = await ufPage.getSets();
    expect(sets.length).toBe(10);
    // Each set should contain exactly 1 element and representative equal to that element
    for (const s of sets) {
      expect(s.elements.length).toBe(1);
      expect(s.representative).toBe(s.elements[0]);
    }

    // Ensure no uncaught page errors happened during initialization
    expect(pageErrors.length).toBe(0);
  });

  test('Union operation merges sets (S2_UnionPerformed) and updates UI/logs', async ({ page }) => {
    // Validate union(0,1) merges sets and updates info and log.
    const ufPage = new UnionFindPage(page);
    await ufPage.goto();

    // Ensure default unionA=0, unionB=1; click union
    await ufPage.clickUnionExpectDialogIfAny(); // no dialog expected

    // Wait for expected log entry
    await expect(ufPage.logBox).toContainText('Union(0, 1): merged sets.');

    // Info box should reflect the union and count reduced by 1 (from 10 to 9)
    const info = await ufPage.getInfoText();
    expect(info).toContain('Union performed: elements 0 and 1 are now connected.');
    expect(info).toContain('Total sets: 9');

    // There should now be 9 sets
    const sets = await ufPage.getSets();
    expect(sets.length).toBe(9);

    // There must be a set that contains both 0 and 1
    const has01 = sets.some(s => s.elements.includes(0) && s.elements.includes(1));
    expect(has01).toBeTruthy();

    // Ensure the representative for 0 and 1 is consistent
    const repSet = sets.find(s => s.elements.includes(0));
    expect(repSet).toBeDefined();
    expect(repSet.elements).toContain(1);

    // No page errors should have occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Union already connected (S3_UnionAlreadyConnected): repeated union yields no merge', async ({ page }) => {
    // Validate performing union(0,1) twice results in an "already connected" message the second time
    const ufPage = new UnionFindPage(page);
    await ufPage.goto();

    // First union to merge
    await ufPage.clickUnionExpectDialogIfAny();
    await expect(ufPage.logBox).toContainText('Union(0, 1): merged sets.');

    // Second union (same pair) should report already connected
    await ufPage.clickUnionExpectDialogIfAny();
    await expect(ufPage.logBox).toContainText('elements already connected');

    // Info box should reflect "already in the same set" and total sets unchanged (9)
    const info = await ufPage.getInfoText();
    expect(info).toMatch(/already in the same set/);
    expect(info).toContain('Total sets: 9');

    // Sets count should still be 9
    const sets = await ufPage.getSets();
    expect(sets.length).toBe(9);

    expect(pageErrors.length).toBe(0);
  });

  test('Find operation (S4_FindPerformed): returns representative and updates logs/info', async ({ page }) => {
    // Validate find(x) after a union returns the correct representative and logs appropriately
    const ufPage = new UnionFindPage(page);
    await ufPage.goto();

    // Perform union(0,1) to ensure 0 and 1 are connected
    await ufPage.clickUnionExpectDialogIfAny();
    await expect(ufPage.logBox).toContainText('Union(0, 1): merged sets.');

    // Click find for element 0 (default)
    await ufPage.clickFindExpectDialogIfAny();

    // The log should contain Find(0) -> Representative: <rep>
    const logs = await ufPage.getLogLines();
    const findLine = logs.find(l => /^Find\(0\) -> Representative:/.test(l));
    expect(findLine).toBeTruthy();

    // Extract representative from the log line and check info box matches
    const repMatch = findLine.match(/Representative:\s*(-?\d+)/);
    expect(repMatch).not.toBeNull();
    const rep = Number(repMatch[1]);
    const info = await ufPage.getInfoText();
    expect(info).toContain(`Element 0 belongs to the set with representative ${rep}.`);

    // Ensure the sets' representative for 0 equals rep as well
    const sets = await ufPage.getSets();
    const setFor0 = sets.find(s => s.elements.includes(0));
    expect(setFor0.representative).toBe(rep);

    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid totalElements shows alert and prevents initialization', async ({ page }) => {
    // Provide invalid total (0) and verify dialog is shown and page state not updated to invalid
    const ufPage = new UnionFindPage(page);
    await ufPage.goto();

    // Fill totalElements with invalid value and click initialize
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      ufPage.totalInput.fill('0').then(() => ufPage.initializeBtn.click())
    ]);
    // Dialog should match the validation message
    expect(dialog).toBeDefined();
    expect(dialog.message()).toContain('Please enter a number between 1 and 30');
    await dialog.accept();

    // After rejecting invalid init, info box should still show previous valid initialization
    const info = await ufPage.getInfoText();
    expect(info).toContain('Initialized 10 disjoint sets');

    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid union indices trigger alert', async ({ page }) => {
    // Re-initialize with smaller total (5) and attempt union with out-of-range index
    const ufPage = new UnionFindPage(page);
    await ufPage.goto();

    // Re-initialize with total 5
    await ufPage.totalInput.fill('5');
    const initDialog = await ufPage.clickInitializeExpectDialogIfAny(); // no dialog expected for valid 5
    if (initDialog) {
      // If a dialog appeared unexpectedly, accept and fail the test
      await initDialog.accept();
      throw new Error('Unexpected dialog when initializing with valid value 5.');
    }
    await expect(ufPage.logBox).toContainText('Initialized Union-Find structure with 5 elements.');

    // Set unionB to an out-of-range index (5, valid indices 0..4)
    const dialogPromise = page.waitForEvent('dialog');
    await ufPage.unionA.fill('0');
    await ufPage.unionB.fill('5');
    // Trigger union click
    await ufPage.unionBtn.click();
    const dialog = await dialogPromise;
    expect(dialog).toBeDefined();
    expect(dialog.message()).toContain('Please enter valid element indices between 0 and 4');
    await dialog.accept();

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: union same element triggers alert', async ({ page }) => {
    // Use current initialization (should be valid) and try union with same indices
    const ufPage = new UnionFindPage(page);
    await ufPage.goto();

    // Set both union inputs to 2 and click union
    const dialogPromise = page.waitForEvent('dialog');
    await ufPage.unionA.fill('2');
    await ufPage.unionB.fill('2');
    await ufPage.unionBtn.click();
    const dialog = await dialogPromise;
    expect(dialog).toBeDefined();
    expect(dialog.message()).toContain('Cannot union the same element with itself.');
    await dialog.accept();

    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: find invalid index triggers alert', async ({ page }) => {
    // Re-initialize with total 3 and try to find index -1 (invalid)
    const ufPage = new UnionFindPage(page);
    await ufPage.goto();

    await ufPage.totalInput.fill('3');
    const initDialog = await ufPage.clickInitializeExpectDialogIfAny();
    if (initDialog) {
      await initDialog.accept();
      throw new Error('Unexpected dialog when initializing with valid value 3.');
    }
    await expect(ufPage.logBox).toContainText('Initialized Union-Find structure with 3 elements.');

    // Attempt find with invalid index -1
    const dialogPromise = page.waitForEvent('dialog');
    await ufPage.findElem.fill('-1');
    await ufPage.findBtn.click();
    const dialog = await dialogPromise;
    expect(dialog).toBeDefined();
    expect(dialog.message()).toContain('Please enter valid element index between 0 and 2');
    await dialog.accept();

    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observation: capture console messages and ensure no uncaught exceptions', async ({ page }) => {
    // This test only observes and asserts on console & pageerror events
    const ufPage = new UnionFindPage(page);
    await ufPage.goto();

    // We expect the app to not produce uncaught exceptions during normal use
    // The pageErrors array was collected in beforeEach via page.on('pageerror')
    // There may be console messages but they should not be errors (no TypeError/SyntaxError)
    // Confirm no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure that console did not log any 'error' type messages
    // (consoleMessages includes entries captured via page.on('console'))
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMessages.length).toBe(0);
  });
});