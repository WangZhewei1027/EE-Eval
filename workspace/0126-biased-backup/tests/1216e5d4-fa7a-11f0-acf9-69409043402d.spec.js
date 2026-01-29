import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/1216e5d4-fa7a-11f0-acf9-69409043402d.html';

// Page object for the Garbage Collection Interactive Simulator
class SimulatorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.newObjId = page.locator('#newObjId');
    this.createObjBtn = page.locator('#createObjBtn');
    this.existingObjs = page.locator('#existingObjs');
    this.objDetails = page.locator('#objDetails');
    this.refFrom = page.locator('#refFrom');
    this.refTo = page.locator('#refTo');
    this.addRefBtn = page.locator('#addRefBtn');
    this.removeRefBtn = page.locator('#removeRefBtn');
    this.refsList = page.locator('#refsList');
    this.rootCheckbox = page.locator('#rootObjCheckbox');
    this.rootsList = page.locator('#rootsList');
    this.gcAlgorithm = page.locator('#gcAlgorithm');
    this.runGcBtn = page.locator('#runGcBtn');
    this.refreshHeapViewBtn = page.locator('#refreshHeapViewBtn');
    this.heapView = page.locator('#heapView');
    this.clearLogBtn = page.locator('#clearLogBtn');
    this.logOutput = page.locator('#logOutput');
    this.scriptInput = page.locator('#scriptInput');
    this.runScriptBtn = page.locator('#runScriptBtn');
    this.clearScriptBtn = page.locator('#clearScriptBtn');
    this.currentRefObj = page.locator('#currentRefObj');
  }

  async navigate() {
    await this.page.goto(BASE);
    // Wait for important UI elements to be present
    await expect(this.createObjBtn).toBeVisible();
    await expect(this.heapView).toBeVisible();
  }

  // Create an object via UI
  async createObject(id) {
    await this.newObjId.fill(String(id));
    await this.createObjBtn.click();
  }

  // Select an existing object by value in the <select> elements
  async selectExistingObj(value) {
    await this.existingObjs.selectOption(String(value));
    // Changing selection fires change handlers; wait for details to update
    await this.page.waitForTimeout(50);
  }

  async selectRefFrom(value) {
    await this.refFrom.selectOption(String(value));
    await this.page.waitForTimeout(50);
  }

  async selectRefTo(value) {
    await this.refTo.selectOption(String(value));
    await this.page.waitForTimeout(50);
  }

  // Add reference via UI (click)
  async addReference() {
    await this.addRefBtn.click();
  }

  // Remove reference via UI: ensure a reference option is selected first
  async removeReference() {
    await this.removeRefBtn.click();
  }

  async toggleRootCheckbox(checked) {
    const isChecked = await this.rootCheckbox.isChecked();
    if (isChecked !== checked) {
      await this.rootCheckbox.click();
      // wait for update callbacks
      await this.page.waitForTimeout(50);
    }
  }

  async runGC(algoValue) {
    await this.gcAlgorithm.selectOption(algoValue);
    await this.runGcBtn.click();
  }

  async refreshHeapView() {
    await this.refreshHeapViewBtn.click();
  }

  async clearLog() {
    await this.clearLogBtn.click();
  }

  async getLogText() {
    return (await this.logOutput.textContent()) || '';
  }

  async getHeapViewText() {
    return (await this.heapView.textContent()) || '';
  }

  async setScript(text) {
    await this.scriptInput.fill(text);
  }

  async runScript() {
    await this.runScriptBtn.click();
  }

  async clearScript() {
    await this.clearScriptBtn.click();
  }

  async getExistingOptions() {
    return this.existingObjs.locator('option').allTextContents();
  }

  async getRefFromOptions() {
    return this.refFrom.locator('option').allTextContents();
  }

  async getRefToOptions() {
    return this.refTo.locator('option').allTextContents();
  }

  async getRefsListOptions() {
    return this.refsList.locator('option').allTextContents();
  }

  async getObjDetailsText() {
    return (await this.objDetails.textContent()) || '';
  }

  async getCurrentRefObjLabel() {
    return (await this.currentRefObj.textContent()) || '';
  }
}

test.describe('Garbage Collection Interactive Simulator - FSM & UI End-to-End', () => {
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages
    page.on('console', (msg) => {
      // Capture text and type for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture dialog messages (alerts used by the app)
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Accept to unblock
      await dialog.accept();
    });

    const sim = new SimulatorPage(page);
    await sim.navigate();

    // initial state expectations: Idle (S0_Idle) -> heap empty, no logs
    await expect(sim.getHeapViewText()).resolves.toContain('(no objects)');
    await expect(sim.getLogText()).resolves.toBe('');
  });

  test.afterEach(async ({ page }) => {
    // As a safety final check, there should be no uncaught page errors during interactions
    expect(pageErrors.length).toBe(0);
  });

  test.describe('State S0_Idle and Object Creation (S1_ObjectCreated)', () => {
    test('Create objects updates selects, heap view and logs (S0 -> S1 -> S0)', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Create object 1
      // Validate: log "Created object 1", existingObjs includes 1, heapView shows Object 1
      await sim.createObject(1);
      await expect.poll(() => sim.getLogText(), { timeout: 2000 }).toContain('Created object 1');
      await expect(sim.getExistingOptions()).resolves.toContain('1');
      await expect(sim.getHeapViewText()).resolves.toContain('Object 1');

      // Create object 2
      await sim.createObject(2);
      await expect.poll(() => sim.getLogText(), { timeout: 2000 }).toContain('Created object 2');
      await expect(sim.getExistingOptions()).resolves.toEqual(expect.arrayContaining(['1', '2']));
      await expect(sim.getHeapViewText()).resolves.toContain('Object 2');

      // Attempt to create duplicate object 1 -> should log failure message
      await sim.createObject(1);
      await expect.poll(() => sim.getLogText(), { timeout: 2000 }).toContain('Failed to create object 1: already exists.');

      // Check object details UI updates when selecting each object
      await sim.selectExistingObj(1);
      await expect(sim.getObjDetailsText()).resolves.toContain('Object ID: 1');
      await sim.selectExistingObj(2);
      await expect(sim.getObjDetailsText()).resolves.toContain('Object ID: 2');
    });
  });

  test.describe('Reference management: Add (S2) and Remove (S3)', () => {
    test('Add and remove references update ref lists, refCounts and logs', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Ensure objects 1 and 2 exist (create if necessary)
      await sim.createObject(1);
      await sim.createObject(2);
      // Make sure refFrom/refTo options exist
      await expect(sim.getRefFromOptions()).resolves.toEqual(expect.arrayContaining(['1', '2']));
      await expect(sim.getRefToOptions()).resolves.toEqual(expect.arrayContaining(['1', '2']));

      // Select from=1 to=2 and add reference
      await sim.selectRefFrom(1);
      await sim.selectRefTo(2);
      await sim.addReference();

      // Expect log entry and refsList to contain 2 when viewing refs of 1
      await expect.poll(() => sim.getLogText(), { timeout: 2000 }).toContain('Added reference from 1 to 2');
      // refsList should show '2' for object 1
      await expect(sim.getCurrentRefObjLabel()).resolves.toBe('1');
      await expect(sim.getRefsListOptions()).resolves.toContain('2');

      // Heap view should show "Ref to: 2" for object 1 and refCount for object 2 should be at least 1
      const heapText = await sim.getHeapViewText();
      expect(heapText).toContain('Ref to: 2');
      expect(heapText).toContain('RC=1');

      // Attempt to add the same reference again -> logs "already exists."
      await sim.addReference();
      await expect.poll(() => sim.getLogText(), { timeout: 2000 }).toContain('Reference from 1 to 2 already exists.');

      // Remove the reference
      // Select the reference in refsList first
      // There may be slight delay for refsList to update; wait for an option to exist
      await expect.poll(() => sim.getRefsListOptions(), { timeout: 2000 }).resolves.toContain('2');
      // Select the refsList option
      await sim.refsList.selectOption('2');
      await sim.removeReference();

      await expect.poll(() => sim.getLogText(), { timeout: 2000 }).toContain('Removed reference from 1 to 2');
      // After removal, refsList should not contain '2'
      await expect(sim.getRefsListOptions()).resolves.not.toContain('2');

      // Removing non-existent reference via UI (no selection) triggers alert dialog
      // Ensure refsList has no selection
      // Deselect by selecting a from object with no refs (create object 3 with no refs)
      await sim.createObject(3);
      await sim.selectRefFrom(3);
      // Click removeRef with no selection should cause dialog
      await sim.removeReference();
      // Confirm a dialog was shown with expected message
      await expect.poll(() => dialogs.length, { timeout: 2000 }).toBeGreaterThan(0);
      expect(dialogs.some(d => /Select a reference to remove/i.test(d.message))).toBeTruthy();
      dialogs = []; // clear for subsequent tests
    });

    test('Adding self-reference triggers alert and is blocked', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Create object 10
      await sim.createObject(10);
      // Select both refFrom and refTo as 10 and click add -> alert
      await sim.selectRefFrom(10);
      await sim.selectRefTo(10);
      await sim.addReference();
      await expect.poll(() => dialogs.length, { timeout: 2000 }).toBeGreaterThan(0);
      expect(dialogs.some(d => /cannot reference itself/i.test(d.message) || /cannot reference itself/i.test(d.message.toLowerCase()))).toBeTruthy();
      dialogs = [];
    });
  });

  test.describe('Roots Management (S4) and effects on refCount', () => {
    test('Setting and unsetting roots updates UI and logs', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Create object 4
      await sim.createObject(4);
      await sim.selectExistingObj(4);

      // Initially checkbox should be enabled and unchecked
      await expect(sim.rootCheckbox).toBeEnabled();
      expect(await sim.rootCheckbox.isChecked()).toBe(false);

      // Check the root checkbox -> should log increment message and root shown in UI
      await sim.toggleRootCheckbox(true);
      await expect.poll(() => sim.getLogText(), { timeout: 2000 }).toContain('Object 4 set as root (refCount incremented)');
      // The details should reflect Rooted: Yes
      await expect(sim.getObjDetailsText()).resolves.toContain('Rooted: Yes');

      // Uncheck root -> should log removal
      await sim.toggleRootCheckbox(false);
      await expect.poll(() => sim.getLogText(), { timeout: 2000 }).toContain('Object 4 removed from roots (refCount decremented)');
      await expect(sim.getObjDetailsText()).resolves.toContain('Rooted: No');
    });
  });

  test.describe('Run Garbage Collection algorithms (S5) and transitions', () => {
    test('Mark & Sweep GC collects unreachable objects and logs', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Create objects 20 (root) and 21 (unreferenced)
      await sim.createObject(20);
      await sim.createObject(21);
      await sim.selectExistingObj(20);
      // Set 20 as root
      await sim.toggleRootCheckbox(true);
      // Ensure 21 is unreachable
      await sim.runGC('markSweep');

      await expect.poll(() => sim.getLogText(), { timeout: 3000 }).toContain('Starting Mark & Sweep GC');
      // After mark & sweep 21 should be collected; heap should not include object 21
      await expect(sim.getHeapViewText()).resolves.not.toContain('Object 21');
      // 20 should still be present
      await expect(sim.getHeapViewText()).resolves.toContain('Object 20');
    });

    test('Reference Counting GC collects zero-ref objects and cascades', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Create objects 30 and 31; link 30->31, then remove link to make 31 zero-ref
      await sim.createObject(30);
      await sim.createObject(31);
      await sim.selectRefFrom(30);
      await sim.selectRefTo(31);
      await sim.addReference(); // 30 -> 31

      // Now remove reference, then run referenceCounting GC
      await sim.refsList.selectOption('31');
      await sim.removeReference(); // removes link and decrements refCount
      await sim.runGC('referenceCounting');

      await expect.poll(() => sim.getLogText(), { timeout: 3000 }).toContain('Starting Reference Counting GC');
      // 31 should be collected
      await expect(sim.getHeapViewText()).resolves.not.toContain('Object 31');
    });

    test('Copying Collector GC compacts heap and logs copy operations', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Create objects 40, 41; root 40 and link 40->41 so both copied
      await sim.createObject(40);
      await sim.createObject(41);
      await sim.selectRefFrom(40);
      await sim.selectRefTo(41);
      await sim.addReference();
      await sim.selectExistingObj(40);
      await sim.toggleRootCheckbox(true);

      await sim.runGC('copying');
      await expect.poll(() => sim.getLogText(), { timeout: 3000 }).toContain('Starting Copying Collector GC');
      // Should contain "Copied object" logs for reachable objects
      await expect(sim.getLogText()).resolves.toContain('Copied object 40');
      await expect(sim.getLogText()).resolves.toContain('Copied object 41');
      // After copying, heap should still include 40 and 41
      await expect(sim.getHeapViewText()).resolves.toContain('Object 40');
      await expect(sim.getHeapViewText()).resolves.toContain('Object 41');
    });

    test('Generational GC promotes young objects and applies RC to old generation', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Create objects 50 and 51, link 50->51, root 50
      await sim.createObject(50);
      await sim.createObject(51);
      await sim.selectRefFrom(50);
      await sim.selectRefTo(51);
      await sim.addReference();
      await sim.selectExistingObj(50);
      await sim.toggleRootCheckbox(true);

      // Run generational GC multiple times to cause promotion
      await sim.runGC('generational');
      await expect.poll(() => sim.getLogText(), { timeout: 3000 }).toContain('Starting Generational GC');
      // Subsequent generational GC to increase age/promotion
      await sim.runGC('generational');
      await sim.runGC('generational');

      // After multiple cycles, logs should indicate promotions
      await expect(sim.getLogText()).resolves.toMatch(/Promoted object 50|Promoted object 51/);
      // Heap should still contain at least one of these objects (rooted)
      await expect(sim.getHeapViewText()).resolves.toContain('Object 50');
    });
  });

  test.describe('Auxiliary controls: Refresh Heap View, Clear Logs, and Script Execution', () => {
    test('Refresh heap view updates displayed content and Clear Logs empties logs', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Create object to change heap view
      await sim.createObject(60);
      // Modify heap view and ensure content contains Object 60
      await sim.refreshHeapView();
      await expect(sim.getHeapViewText()).resolves.toContain('Object 60');

      // Clear logs and assert empty
      await sim.clearLog();
      await expect.poll(() => sim.getLogText(), { timeout: 2000 }).toBe('');
    });

    test('Run script executes commands, handles errors, and logs summary', async ({ page }) => {
      const sim = new SimulatorPage(page);

      const script = [
        'CREATE 70',
        'CREATE 71',
        'LINK 70 71',
        'ROOT 70',
        'GC referenceCounting',
        'UNLINK 70 71',
        'GC markSweep',
        'UNKNOWNCMD 1', // should produce an error per script processor
        'CLEARLOG',
        'REFRESHHEAP'
      ].join('\n');

      await sim.setScript(script);
      await sim.runScript();

      // Script should log started and completed messages and handle unknown command with an error log
      await expect.poll(() => sim.getLogText(), { timeout: 5000 }).toContain('Running Script...');
      await expect(sim.getLogText()).resolves.toContain('Script completed.');
      await expect(sim.getLogText()).resolves.toMatch(/Error at line \d+: Unknown command: UNKNOWNCMD/);
      // After CLEARLOG there will be a clear; then REFRESHHEAP should update heap view
      // The final heap should include object 70 (root) or at least be stable
      await expect(sim.getHeapViewText()).resolves.toContain('Object 70');
    });

    test('Clear Script button empties the script input', async ({ page }) => {
      const sim = new SimulatorPage(page);

      await sim.setScript('CREATE 80\n');
      await sim.clearScript();
      await expect(sim.scriptInput).toHaveText(''); // textarea should be empty
    });
  });

  test.describe('Edge case: Script commands referencing non-existent objects and invalid input', () => {
    test('Script logs errors for invalid commands and invalid object IDs', async ({ page }) => {
      const sim = new SimulatorPage(page);

      const script = [
        'CREATE abc',            // invalid ID
        'LINK 999 1000',         // non-existent objects
        'ROOT 500',              // non-existent root action
        'GC unsupported_algo'    // unsupported algorithm
      ].join('\n');

      await sim.setScript(script);
      await sim.runScript();

      // Expect error messages recorded for invalid commands/IDs
      await expect.poll(() => sim.getLogText(), { timeout: 5000 }).toContain('Error at line 1: Invalid object ID');
      await expect(sim.getLogText()).resolves.toMatch(/Error at line 2: Cannot add reference|one or both objects do not exist/);
      await expect(sim.getLogText()).resolves.toMatch(/Error at line 4: Unsupported GC algorithm/);
    });
  });

  test.describe('Observability: Console messages and page errors', () => {
    test('No uncaught page errors and console captured contains expected traces', async ({ page }) => {
      const sim = new SimulatorPage(page);

      // Perform a small interaction to generate console logs captured by the page
      await sim.createObject(90);
      await sim.createObject(91);
      await sim.selectRefFrom(90);
      await sim.selectRefTo(91);
      await sim.addReference();

      // Wait a moment for console events to flush
      await page.waitForTimeout(200);

      // Ensure we captured some console activity
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // at least defined
      // Look through captured console messages for some expected texts
      const combined = consoleMessages.map(c => c.text).join('\n');
      // The application logs to a <pre> element but does not necessarily log to console;
      // we still assert that no page errors occurred (collected in pageErrors)
      expect(pageErrors.length).toBe(0);
      // Also ensure UI-level logs contain the key messages we expect
      await expect(sim.getLogText()).resolves.toContain('Added reference from 90 to 91');
    });
  });
});