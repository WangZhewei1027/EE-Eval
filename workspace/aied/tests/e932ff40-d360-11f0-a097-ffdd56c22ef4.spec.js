import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e932ff40-d360-11f0-a097-ffdd56c22ef4.html';

// Page object for the Red-Black Tree visualizer
class RBTreePage {
  constructor(page) {
    this.page = page;
    // controls
    this.valueInput = page.locator('#valueInput');
    this.insertBtn = page.locator('#insertBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.randomInsert = page.locator('#randomInsert');
    this.randomDelete = page.locator('#randomDelete');
    this.clearBtn = page.locator('#clearBtn');
    this.playPause = page.locator('#playPause');
    this.stepBack = page.locator('#stepBack');
    this.stepForward = page.locator('#stepForward');
    this.speedInput = page.locator('#speed');
    this.speedVal = page.locator('#speedVal');

    // readouts
    this.status = page.locator('#status');
    this.log = page.locator('#log');
    this.snapIndex = page.locator('#snapIndex');
    this.snapTotal = page.locator('#snapTotal');
    this.treeProps = page.locator('#treeProps');
    this.svgRoot = page.locator('#svgRoot');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getStatusText() {
    return (await this.status.textContent()) || '';
  }

  async getLogLines() {
    return await this.page.evaluate(() => {
      const lines = [];
      const logDiv = document.getElementById('log');
      if (!logDiv) return lines;
      for (const child of Array.from(logDiv.children)) {
        lines.push(child.textContent || '');
      }
      return lines;
    });
  }

  async getSnapInfo() {
    const index = parseInt((await this.snapIndex.textContent()) || '0', 10);
    const total = parseInt((await this.snapTotal.textContent()) || '0', 10);
    return { index, total };
  }

  async setValue(v) {
    await this.valueInput.fill(String(v));
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async clickDelete() {
    await this.deleteBtn.click();
  }

  async clickRandomInsert() {
    await this.randomInsert.click();
  }

  async clickRandomDelete() {
    await this.randomDelete.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickPlayPause() {
    await this.playPause.click();
  }

  async clickStepForward() {
    await this.stepForward.click();
  }

  async clickStepBack() {
    await this.stepBack.click();
  }

  async setSpeed(val) {
    await this.speedInput.fill(String(val));
    // dispatch input event in case fill doesn't trigger it
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      if (!el) return;
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, val);
  }

  // Return array of node values currently rendered in the SVG (in document order)
  async getRenderedNodeValues() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('svgRoot');
      if (!svg) return [];
      const groups = Array.from(svg.querySelectorAll('g.node'));
      return groups.map(g => {
        const texts = g.querySelectorAll('text');
        // first text node is the value
        return texts.length > 0 ? texts[0].textContent : null;
      }).filter(Boolean).map(t => t.trim());
    });
  }

  // Return fill colors of rendered nodes (parallel to values)
  async getRenderedNodeFills() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('svgRoot');
      if (!svg) return [];
      const groups = Array.from(svg.querySelectorAll('g.node'));
      return groups.map(g => {
        const circle = g.querySelector('circle');
        return circle ? circle.getAttribute('fill') : null;
      }).filter(Boolean);
    });
  }

  async getTreePropsText() {
    return (await this.treeProps.textContent()) || '';
  }
}

test.describe('Red-Black Tree Visualizer (e932ff40-d360-11f0-a097-ffdd56c22ef4)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages and types
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to application
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught page errors during a test run
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);

    // Ensure no console messages of type 'error' were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrors, `Console errors found: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });

  test('Initial Ready state: should render initial snapshot and show Ready status', async ({ page }) => {
    // Validate initial UI state and snapshot info
    const rb = new RBTreePage(page);

    // Status should be "Ready."
    await expect(rb.status).toHaveText('Ready.');

    // Log should contain the ready message
    const logs = await rb.getLogLines();
    expect(logs.some(l => l.includes('Red-Black Tree visualizer ready.')), 'Ready log entry missing').toBeTruthy();

    // Snapshot DOM information should show 1 / 1 (initial snapshot)
    const snap = await rb.getSnapInfo();
    expect(snap.index).toBeGreaterThanOrEqual(1);
    expect(snap.total).toBeGreaterThanOrEqual(1);

    // Tree props should indicate 'Initial empty tree' (note created during initialization)
    const propsText = await rb.getTreePropsText();
    expect(propsText).toContain('Initial empty tree');

    // No nodes should be drawn initially
    const values = await rb.getRenderedNodeValues();
    expect(values.length).toBe(0);
  });

  test('Insert a value: transitions, snapshots, log and rendering', async ({ page }) => {
    // This test validates the InsertValue event, S0 -> S1 transition behavior, and that the node is drawn.
    const rb = new RBTreePage(page);

    // Insert value 42
    await rb.setValue(42);
    await rb.clickInsert();

    // After insertion, status should reflect inserting action
    const status = await rb.getStatusText();
    expect(status).toContain('Inserting 42');

    // Log should contain 'Inserted 42.'
    const logs = await rb.getLogLines();
    expect(logs.some(l => l.includes('Inserted 42.')), 'Insert log missing').toBeTruthy();

    // Snapshot total should increase (at least one snapshot created for insertion)
    const snap = await rb.getSnapInfo();
    expect(snap.total).toBeGreaterThanOrEqual(2);

    // SVG should render a node with text '42'
    const values = await rb.getRenderedNodeValues();
    expect(values.some(v => v === '42'), `Expected rendered node with value 42, got: ${values.join(',')}`).toBeTruthy();

    // The inserted node should be red initially (circle fill should be the red color used in code)
    const fills = await rb.getRenderedNodeFills();
    expect(fills.some(f => f === '#d32f2f'), `Expected at least one red node fill, got: ${fills.join(',')}`).toBeTruthy();
  });

  test('Delete an existing value: transitions and log', async ({ page }) => {
    // Insert a value then delete it, validating delete flow and logs.
    const rb = new RBTreePage(page);

    // Insert 10 (default input has 10, but ensure fresh insert)
    await rb.setValue(10);
    await rb.clickInsert();

    // Ensure inserted
    let logs = await rb.getLogLines();
    expect(logs.some(l => l.includes('Inserted 10.')), 'Insert log for 10 missing').toBeTruthy();

    // Now delete 10
    await rb.setValue(10);
    await rb.clickDelete();

    // After deletion, there should be a "Delete attempted for 10." log entry
    logs = await rb.getLogLines();
    expect(logs.some(l => l.includes('Delete attempted for 10.')), 'Delete attempted log missing').toBeTruthy();

    // The rendered node values should not include 10 (it may or may not be fully removed visually depending on snapshots; check last snapshot rendering)
    const values = await rb.getRenderedNodeValues();
    expect(values.includes('10')).toBe(false);
  });

  test('Delete non-existing value: logs appropriate message and does not crash', async ({ page }) => {
    const rb = new RBTreePage(page);

    // Delete a value that certainly does not exist
    await rb.setValue(9999);
    await rb.clickDelete();

    // Expect log to say value not found
    const logs = await rb.getLogLines();
    expect(logs.some(l => l.includes('Value 9999 not found.')), 'Expected not-found log').toBeTruthy();
  });

  test('Duplicate insert is prevented and logged', async ({ page }) => {
    const rb = new RBTreePage(page);

    // Insert 77 twice
    await rb.setValue(77);
    await rb.clickInsert();
    // Insert again
    await rb.setValue(77);
    await rb.clickInsert();

    const logs = await rb.getLogLines();
    // First insert log
    expect(logs.some(l => l.includes('Inserted 77.')), 'First insert log missing').toBeTruthy();
    // Duplicate message
    expect(logs.some(l => l.includes('already exists (no duplicates).')), 'Duplicate insert warning missing').toBeTruthy();
  });

  test('Random insert and random delete behavior (with tree emptiness handling)', async ({ page }) => {
    const rb = new RBTreePage(page);

    // Ensure tree is empty by clearing
    await rb.clickClear();
    let logs = await rb.getLogLines();
    expect(logs.some(l => l.includes('Tree cleared.')), 'Clear log missing after clear').toBeTruthy();

    // randomDelete on empty tree should log 'Tree is empty.'
    await rb.clickRandomDelete();
    logs = await rb.getLogLines();
    expect(logs.some(l => l.includes('Tree is empty.')), 'Expected "Tree is empty." log for randomDelete on empty tree').toBeTruthy();

    // randomInsert should create a node and log Inserted x.
    await rb.clickRandomInsert();

    // There may be asynchronous insertion from click; wait a moment and then check logs and snapshot state
    await page.waitForTimeout(200);
    logs = await rb.getLogLines();
    const insertedLog = logs.find(l => /Inserted \d+\./.test(l));
    expect(insertedLog, 'Expected an Inserted log from randomInsert').toBeTruthy();

    // Now randomDelete should delete an existing value (log 'Delete attempted for X.')
    await rb.clickRandomDelete();
    await page.waitForTimeout(200);
    logs = await rb.getLogLines();
    const deleteAttempt = logs.find(l => /Delete attempted for \d+\./.test(l));
    expect(deleteAttempt, 'Expected delete attempted log from randomDelete').toBeTruthy();
  });

  test('Clear tree resets snapshots and UI', async ({ page }) => {
    const rb = new RBTreePage(page);

    // Insert multiple nodes
    await rb.setValue(5);
    await rb.clickInsert();
    await rb.setValue(15);
    await rb.clickInsert();

    // Confirm snapshots increased
    let snapInfo = await rb.getSnapInfo();
    expect(snapInfo.total).toBeGreaterThanOrEqual(3);

    // Clear the tree
    await rb.clickClear();

    // Log should contain Tree cleared.
    const logs = await rb.getLogLines();
    expect(logs.some(l => l.includes('Tree cleared.')), 'Clear log entry missing').toBeTruthy();

    // Snapshots should be reset: at least one snapshot (Cleared tree)
    snapInfo = await rb.getSnapInfo();
    expect(snapInfo.total).toBeGreaterThanOrEqual(1);

    // SVG should have no nodes drawn
    const values = await rb.getRenderedNodeValues();
    expect(values.length).toBe(0);
  });

  test('Play/Pause animation and stepping through snapshots', async ({ page }) => {
    const rb = new RBTreePage(page);

    // Create several snapshots by inserting distinct values
    const inputs = [11, 22, 33];
    for (const v of inputs) {
      await rb.setValue(v);
      await rb.clickInsert();
      // allow the insertion snapshots to stabilize
      await page.waitForTimeout(100);
    }

    // There should be multiple snapshots
    let snap = await rb.getSnapInfo();
    expect(snap.total).toBeGreaterThanOrEqual(4); // initial + inserted steps (and internal snapshots)

    // Set speed to a short delay to finish playback quickly
    await rb.setSpeed(100);
    await expect(rb.speedVal).toHaveText(/100 ms/);

    // Start play
    await rb.clickPlayPause();

    // The play button should change to 'Pause' when playing
    await expect(rb.playPause).toHaveText('Pause');

    // Wait until playback finishes - play code sets button back to 'Play' at the end
    // Give ample timeout because snapshots may be many
    await page.waitForFunction(() => {
      const el = document.getElementById('playPause');
      return el && el.textContent === 'Play';
    }, null, { timeout: 5000 });

    // After playback completes, ensure button shows 'Play'
    await expect(rb.playPause).toHaveText('Play');

    // Test stepping: go back one step and forward one step
    const before = await rb.getSnapInfo();
    // step back once
    await rb.clickStepBack();
    const afterBack = await rb.getSnapInfo();
    expect(afterBack.index).toBe(Math.max(1, before.index - 1));

    // step forward once
    await rb.clickStepForward();
    const afterForward = await rb.getSnapInfo();
    // After stepping forward, index should be at least equal to the original before or one greater than afterBack
    expect(afterForward.index).toBeGreaterThanOrEqual(afterBack.index);
  });
});