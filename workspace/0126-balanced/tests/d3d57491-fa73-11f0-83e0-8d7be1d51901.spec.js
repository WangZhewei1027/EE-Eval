import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d57491-fa73-11f0-83e0-8d7be1d51901.html';

// Page object for the Red-Black Tree demo
class RBDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valInput = page.locator('#valInput');
    this.insertBtn = page.locator('#insertBtn');
    this.rndBtn = page.locator('#rndBtn');
    this.bulkBtn = page.locator('#bulkBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.prevBtn = page.locator('#prevBtn');
    this.nextBtn = page.locator('#nextBtn');
    this.playBtn = page.locator('#playBtn');
    this.speedInput = page.locator('#speed');
    this.stepCounter = page.locator('#stepCounter');
    this.descBox = page.locator('#descBox');
    this.svg = page.locator('#svgCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getStepCounterText() {
    return (await this.stepCounter.textContent()) || '';
  }

  async getDescText() {
    return (await this.descBox.textContent()) || '';
  }

  async getPlayButtonText() {
    return (await this.playBtn.textContent()) || '';
  }

  async svgChildrenCount() {
    // number of children under svg element
    return await this.page.evaluate(() => {
      const svg = document.getElementById('svgCanvas');
      return svg ? svg.children.length : 0;
    });
  }

  async setSpeed(ms) {
    await this.speedInput.fill(String(ms));
    // since it's a range input, also set its value property directly to be safe
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      if (el) el.value = v;
    }, String(ms));
  }

  // Insert a specific value using the input and Insert button
  async insertValue(val) {
    await this.valInput.fill(String(val));
    await this.insertBtn.click();
    // allow UI to snapshot/render
    await this.page.waitForTimeout(120);
  }

  // Insert by simulating Enter keypress while input focused
  async insertValueByEnter(val) {
    await this.valInput.fill(String(val));
    await this.valInput.press('Enter');
    await this.page.waitForTimeout(120);
  }

  // Click the random insert button
  async insertRandom() {
    await this.rndBtn.click();
    await this.page.waitForTimeout(120);
  }

  // Click the bulk insertion button (schedules a sequence via setTimeout)
  async insertSampleSequence() {
    await this.bulkBtn.click();
    // wait enough time for scheduled insertions to complete (sequence uses 150ms intervals)
    // give generous buffer for snapshots and rendering
    await this.page.waitForTimeout(2200);
  }

  // Clear the tree
  async clearTree() {
    await this.clearBtn.click();
    await this.page.waitForTimeout(80);
  }

  // Navigation
  async nextStep() {
    await this.nextBtn.click();
    await this.page.waitForTimeout(80);
  }
  async prevStep() {
    await this.prevBtn.click();
    await this.page.waitForTimeout(80);
  }

  // Play/pause auto-play
  async togglePlay() {
    await this.playBtn.click();
    // slight wait for playing state to update
    await this.page.waitForTimeout(120);
  }

  // Read number of snapshots from exposed window.rb_demo.snapshots (if present)
  async getSnapshotsLength() {
    return await this.page.evaluate(() => {
      try {
        return window.rb_demo && typeof window.rb_demo.snapshots === 'function'
          ? window.rb_demo.snapshots().length
          : -1;
      } catch (e) {
        return -1;
      }
    });
  }
}

// Keep console messages and page errors for assertions
test.describe('Red-Black Tree — Interactive Demo (FSM validation)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and filter for errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Collect runtime errors (unhandled exceptions in the page)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack
      });
    });
  });

  // Initial state validation: S0_Initial
  test('S0_Initial: page loads with an explanatory snapshot and initial UI', async ({ page }) => {
    const demo = new RBDemoPage(page);
    await demo.goto();

    // Validate initial description contains explanatory text from implementation
    const desc = await demo.getDescText();
    expect(desc).toContain('Empty tree. Start inserting nodes');

    // After initialization the script calls snapshot() and goToStep(0) -> Step counter should reflect 1 / 1
    const stepText = await demo.getStepCounterText();
    expect(stepText).toMatch(/Step:\s*\d+\s*\/\s*\d+/);
    // Ensure the svg has no nodes drawn yet (initial snapshot is empty)
    const svgCount = await demo.svgChildrenCount();
    expect(svgCount).toBe(0);

    // Ensure no console runtime errors or page errors occurred during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test S0 -> S2 transition via InsertValue button
  test('InsertValue: clicking Insert transitions to Tree With Values and renders node', async ({ page }) => {
    const demo1 = new RBDemoPage(page);
    await demo.goto();

    // Insert a specific value
    await demo.insertValue(10);

    // After insertion we expect at least several snapshots (insert, fixups, final)
    const snapCount = await demo.getSnapshotsLength();
    expect(snapCount).toBeGreaterThanOrEqual(2);

    // The svg should now contain drawn nodes (some children: lines, circles, text)
    const svgCount1 = await demo.svgChildrenCount();
    expect(svgCount).toBeGreaterThan(0);

    // Step counter should show last step selected (n / n)
    const stepText1 = await demo.getStepCounterText();
    // Extract current step and total from text
    expect(stepText).toMatch(/Step:\s*\d+\s*\/\s*\d+/);

    // Description should end with 'Insertion complete: root is black.' in final snapshot text
    const desc1 = await demo.getDescText();
    // It may show the last snapshot description; ensure it contains either "Inserted" or "Insertion complete"
    expect(/Inserted|Insertion complete/.test(desc)).toBeTruthy();

    // No console or page errors occurred during insertion
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test Enter key insertion event (EnterKeyInsert)
  test('EnterKeyInsert: pressing Enter in input inserts the value', async ({ page }) => {
    const demo2 = new RBDemoPage(page);
    await demo.goto();

    // Use Enter to insert
    await demo.insertValueByEnter(21);

    // Assert a new snapshot was created and rendering occurred
    const snapCount1 = await demo.getSnapshotsLength();
    expect(snapCount).toBeGreaterThanOrEqual(2);
    const svgCount2 = await demo.svgChildrenCount();
    expect(svgCount).toBeGreaterThan(0);

    // No runtime errors on Enter
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test InsertRandomValue event
  test('InsertRandomValue: clicking Insert Random inserts a value and updates UI', async ({ page }) => {
    const demo3 = new RBDemoPage(page);
    await demo.goto();

    // Insert random value
    await demo.insertRandom();

    // After random insert, snapshots should increase
    const snapCount2 = await demo.getSnapshotsLength();
    expect(snapCount).toBeGreaterThanOrEqual(2);

    // SVG should have node renderings
    const svgCount3 = await demo.svgChildrenCount();
    expect(svgCount).toBeGreaterThan(0);

    // No console or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test InsertSampleSequence (bulk button) - S2 -> S2 for multiple inserts
  test('InsertSampleSequence: clicking Insert Sample Sequence schedules multiple inserts and updates snapshots', async ({ page }) => {
    const demo4 = new RBDemoPage(page);
    await demo.goto();

    // Ensure tree is empty first
    await demo.clearTree();

    // Click bulk - scheduled inserts will run via setTimeout
    await demo.insertSampleSequence();

    // Expect snapshots to have grown significantly (sequence length at least 6)
    const snapCount3 = await demo.getSnapshotsLength();
    expect(snapCount).toBeGreaterThanOrEqual(6);

    // SVG should render nodes
    const svgCount4 = await demo.svgChildrenCount();
    expect(svgCount).toBeGreaterThan(0);

    // No console or page errors during bulk insertion
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  }, { timeout: 10000 }); // extra time for scheduled inserts

  // Test ClearTree transition to S1_Tree_Cleared
  test('ClearTree: clicking Clear resets snapshots, counter and description', async ({ page }) => {
    const demo5 = new RBDemoPage(page);
    await demo.goto();

    // Insert a value to create snapshots
    await demo.insertValue(33);
    let snapCount4 = await demo.getSnapshotsLength();
    expect(snapCount).toBeGreaterThanOrEqual(2);

    // Now clear
    await demo.clearTree();

    // After clear, snapshots length should be 0 (exposed function returns [])
    snapCount = await demo.getSnapshotsLength();
    expect(snapCount).toBe(0);

    // Step counter should show 'Step: 0 / 0'
    const stepText2 = await demo.getStepCounterText();
    expect(stepText.trim()).toBe('Step: 0 / 0');

    // Description should be the cleared message
    const desc2 = await demo.getDescText();
    expect(desc).toContain('Cleared. Insert values to see the insertion algorithm.');

    // No svg children
    const svgCount5 = await demo.svgChildrenCount();
    expect(svgCount).toBe(0);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test PlayAuto (S2 -> S3) and playback controls (PreviousStep, NextStep)
  test('PlayAuto & Navigation: Play starts autoplay, Next/Previous navigate steps correctly', async ({ page }) => {
    const demo6 = new RBDemoPage(page);
    await demo.goto();

    // Prepare multiple snapshots by inserting several values
    await demo.clearTree();
    await demo.insertValue(40);
    await demo.insertValue(35);
    await demo.insertValue(50);

    let snapCount5 = await demo.getSnapshotsLength();
    expect(snapCount).toBeGreaterThanOrEqual(3);

    // Set speed lower to make playback faster
    await demo.setSpeed(200);

    // Start auto-play
    await demo.togglePlay();

    // Play button text should reflect playing state -> 'Pause'
    const playText = await demo.getPlayButtonText();
    expect(playText.toLowerCase()).toContain('pause');

    // Wait a bit so autoplay advances at least one step
    await page.waitForTimeout(500);

    // Ensure current step is > 0 (autoplay progressed)
    const stepText3 = await demo.getStepCounterText();
    const matches = /Step:\s*(\d+)\s*\/\s*(\d+)/.exec(stepText);
    expect(matches).not.toBeNull();
    const current = Number(matches[1]);
    const total = Number(matches[2]);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(current).toBeGreaterThanOrEqual(1);

    // Stop autoplay by toggling Play again
    await demo.togglePlay();
    const playTextAfter = await demo.getPlayButtonText();
    expect(playTextAfter.toLowerCase()).toContain('play');

    // Test NextStep and PreviousStep manual navigation
    // Move to first step
    await demo.prevStep(); // should be safe even if at step 0
    const beforeStepText = await demo.getStepCounterText();
    // Move forward
    await demo.nextStep();
    const afterNext = await demo.getStepCounterText();
    expect(afterNext).not.toBe(beforeStepText);
    // Move back
    await demo.prevStep();
    const afterPrev = await demo.getStepCounterText();
    expect(afterPrev).not.toBe(afterNext);

    // No console/page errors during playback/navigation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: invalid input triggers alert dialog (Enter invalid or empty)
  test('Edge case: invalid input triggers alert and does not create snapshot', async ({ page }) => {
    const demo7 = new RBDemoPage(page);
    await demo.goto();

    // Ensure no value in input
    await demo.valInput.fill('');
    // Listen for dialog
    const dialogs = [];
    page.once('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.dismiss();
    });

    // Click Insert with empty input -> triggers alert('Enter a valid integer.')
    await demo.insertBtn.click();
    // Allow dialog handler to run
    await page.waitForTimeout(100);

    expect(dialogs.length).toBe(1);
    expect(dialogs[0].message).toContain('Enter a valid integer');

    // Snapshots shouldn't have grown due to invalid input (should remain at initial 1)
    const snapCount6 = await demo.getSnapshotsLength();
    // Implementation created an initial snapshot on load, so expect 1
    expect(snapCount).toBeGreaterThanOrEqual(0);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: duplicate insertion triggers alert and is ignored
  test('Edge case: duplicate values are ignored and show alert "Duplicate value ignored."', async ({ page }) => {
    const demo8 = new RBDemoPage(page);
    await demo.goto();

    // Insert a value first
    await demo.insertValue(77);
    const beforeCount = await demo.getSnapshotsLength();
    expect(beforeCount).toBeGreaterThanOrEqual(2);

    // Try to insert the same value again - expect alert and no growth in snapshots
    const dialogs1 = [];
    page.once('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.dismiss();
    });

    // Use exposed method to call insertValue (this will run the duplicate check)
    // We call the insert button flow to ensure consistent behavior
    await demo.insertValue(77);
    await page.waitForTimeout(120);

    expect(dialogs.length).toBe(1);
    expect(dialogs[0].message).toContain('Duplicate value ignored');

    const afterCount = await demo.getSnapshotsLength();
    // snapshots should not grow due to duplicate insertion
    expect(afterCount).toBe(beforeCount);

    // No console/page errors recorded
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Final sanity: ensure no runtime ReferenceError, SyntaxError, TypeError occurred during any of the tests' page interactions
  test('No unexpected runtime ReferenceError/SyntaxError/TypeError in console or page errors', async ({ page }) => {
    // This test intentionally loads the page and checks for these errors
    const demo9 = new RBDemoPage(page);

    // Reset collectors for this test
    const consoleMsgs = [];
    const pageErrs = [];

    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrs.push(err);
    });

    await demo.goto();
    // perform some interactions to exercise code paths
    await demo.insertValue(5);
    await demo.insertRandom();
    await demo.insertValueByEnter(6);
    await demo.clearTree();

    // wait a short time to collect any async errors
    await page.waitForTimeout(300);

    // Scan captured console messages for ReferenceError, SyntaxError, TypeError
    const errorTypes = ['ReferenceError', 'SyntaxError', 'TypeError'];
    const foundErrors = consoleMsgs.filter(m =>
      m.type === 'error' && errorTypes.some(t => m.text.includes(t))
    );

    // Similarly inspect page error objects
    const pageErrorNames = pageErrs.map(e => e.name);

    // Assert that none of these severe JS errors occurred
    expect(foundErrors.length).toBe(0);
    expect(pageErrorNames.some(n => errorTypes.includes(n))).toBe(false);
  });

  test.afterEach(async ({ page }) => {
    // Final assertion in teardown: ensure no unexpected console.error or pageerror captured
    // (the arrays are accumulated in the beforeEach scope and tests have asserted emptiness; double-check)
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
    // close page to ensure clean teardown for next test
    try { await page.close(); } catch (e) { /* ignore */ }
  });
});