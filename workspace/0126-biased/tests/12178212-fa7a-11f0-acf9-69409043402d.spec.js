import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12178212-fa7a-11f0-acf9-69409043402d.html';

/**
 * Page Object for the KNN Interactive Demo page.
 * Encapsulates common operations and queries to keep tests readable.
 */
class KNNPage {
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#canvas');
    this.modeSelect = page.locator('#modeSelect');
    this.kInput = page.locator('#kInput');
    this.classifyButton = page.locator('#classifyButton');
    this.clearQueriesButton = page.locator('#clearQueriesButton');
    this.clearAllButton = page.locator('#clearAllButton');
    this.resetButton = page.locator('#resetButton');
    this.distanceMetric = page.locator('#distanceMetric');
    this.weighting = page.locator('#weighting');
    this.thresholdInput = page.locator('#thresholdInput');
    this.pointsList = page.locator('#pointsList');
    this.log = page.locator('#log');

    // Captured console messages and page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners
    page.on('console', msg => {
      // capture all console messages (info/debug/error)
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to application
  async goto() {
    await this.page.goto(APP_URL);
    // wait for initialization log entry that is appended at setup()
    await this.page.waitForSelector('#log');
    // small pause to allow initial script execution to write logs
    await this.page.waitForTimeout(200);
  }

  // Helpers to interact

  async selectMode(modeValue) {
    await this.modeSelect.selectOption({ value: modeValue });
    // ensure change event processed
    await this.page.waitForTimeout(50);
  }

  async setK(value) {
    await this.kInput.fill(String(value));
    // trigger input
    await this.kInput.dispatchEvent('input');
    await this.page.waitForTimeout(50);
  }

  async setDistanceMetric(value) {
    await this.distanceMetric.selectOption({ value });
    await this.page.waitForTimeout(50);
  }

  async setWeighting(value) {
    await this.weighting.selectOption({ value });
    await this.page.waitForTimeout(50);
  }

  async setThreshold(value) {
    await this.thresholdInput.fill(String(value));
    await this.thresholdInput.dispatchEvent('input');
    await this.page.waitForTimeout(50);
  }

  // Click the classify button
  async clickClassify() {
    await Promise.all([
      this.page.waitForTimeout(50), // give time for any log output
      this.classifyButton.click()
    ]);
  }

  async clickClearQueries() {
    await this.clearQueriesButton.click();
    await this.page.waitForTimeout(50);
  }

  // Clear All triggers a confirm dialog. Accept by default.
  async clickClearAll(accept = true) {
    this.page.once('dialog', dialog => {
      if (accept) dialog.accept();
      else dialog.dismiss();
    });
    await this.clearAllButton.click();
    await this.page.waitForTimeout(100);
  }

  // Reset triggers a confirm dialog. Accept by default.
  async clickReset(accept = true) {
    this.page.once('dialog', dialog => {
      if (accept) dialog.accept();
      else dialog.dismiss();
    });
    await this.resetButton.click();
    await this.page.waitForTimeout(150);
  }

  // Add a point by clicking on canvas at specific element coordinates (x,y) relative to canvas top-left.
  // mode should already be selected (e.g., classA/classB/classC/query)
  async addPointAt(x, y) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    await this.page.mouse.click(box.x + x, box.y + y, { button: 'left' });
    await this.page.waitForTimeout(80); // allow handlers to execute
  }

  // Remove nearest point by selecting 'remove' mode and clicking; accepts confirm dialogs.
  async removeNearestAt(x, y, accept = true) {
    await this.selectMode('remove');
    this.page.once('dialog', dialog => {
      if (accept) dialog.accept(); else dialog.dismiss();
    });
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    await this.page.mouse.click(box.x + x, box.y + y, { button: 'left' });
    await this.page.waitForTimeout(100);
  }

  // Move a point by simulating mousedown, mousemove, mouseup on canvas.
  // Should be in 'move' mode for dragging to start.
  async dragFromTo(startX, startY, endX, endY) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    await this.page.mouse.move(box.x + startX, box.y + startY);
    await this.page.mouse.down();
    // small delay while dragging
    await this.page.mouse.move(box.x + endX, box.y + endY, { steps: 8 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(120);
  }

  // Trigger canvas mouseleave event programmatically
  async triggerCanvasMouseLeave() {
    await this.canvas.dispatchEvent('mouseleave');
    await this.page.waitForTimeout(50);
  }

  // Read helpers

  // Return raw log text
  async getLogText() {
    return (await this.log.innerText()).trim();
  }

  // Return pointsList innerText
  async getPointsListText() {
    return (await this.pointsList.innerText()).trim();
  }

  // Count number of points listed by counting '[' occurrences at each point entry "[id]"
  async countPointsInList() {
    const text = await this.getPointsListText();
    if (!text) return 0;
    // If 'No points in dataset.' text then zero
    if (text.includes('No points in dataset.')) return 0;
    const matches = text.match(/\[\d+\]/g);
    return matches ? matches.length : 0;
  }

  // Count how many query points are in points list (appearance of 'Query' substring)
  async countQueryPointsInList() {
    const text = await this.getPointsListText();
    const matches = text.match(/Query/g);
    return matches ? matches.length : 0;
  }

  // Utility for checking whether any console messages of a given substring exist
  hasConsoleMessageContaining(substr) {
    return this.consoleMessages.some(m => m.text.includes(substr));
  }

  // Utility to clear recorded console messages and page errors
  clearCapturedMessages() {
    this.consoleMessages = [];
    this.pageErrors = [];
  }
}

/*
  Test suite verifying the FSM interactions described in the specification.
  The suite exercises:
  - Initialization
  - Adding points (various types)
  - Classification actions and logs
  - Clearing queries and all points (with confirm dialogs)
  - Reset behavior
  - Mode changes, K input changes, distance/weighting/threshold changes
  - Canvas interactions: mousedown/mousemove/mouseup/mouseleave
  - Edge cases: invalid K, invalid threshold
  - Observing console logs and page errors
*/
test.describe('K-Nearest Neighbors Interactive Demo (Application ID: 12178212-fa7a-11f0-acf9-69409043402d)', () => {
  let knn;

  test.beforeEach(async ({ page }) => {
    knn = new KNNPage(page);
    await knn.goto();
    // initial messages captured during setup
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors during the test run
    expect(knn.pageErrors.length).toBe(0);
  });

  test('Initialization: page renders canvas, points list and initial logs', async () => {
    // Validate essential elements are present
    await expect(knn.canvas).toBeVisible();
    await expect(knn.pointsList).toBeVisible();
    await expect(knn.log).toBeVisible();

    // The example data initialization should have run and logged an initialization message
    const logText = await knn.getLogText();
    expect(logText).toContain('Initialized with example data.');

    // Points list should contain multiple points (example data includes 12 points)
    const pointCount = await knn.countPointsInList();
    expect(pointCount).toBeGreaterThanOrEqual(10); // tolerant lower bound

    // There should be some query points present in example data (3 queries)
    const queryCount = await knn.countQueryPointsInList();
    expect(queryCount).toBeGreaterThanOrEqual(3);
  });

  test('Classify Query button triggers classification and appends logs', async () => {
    knn.clearCapturedMessages();
    // Click classify button; example dataset already has query points
    await knn.clickClassify();

    // The log should include classification details for queries
    const logs = await knn.getLogText();
    expect(logs).toMatch(/classified as:/i);

    // Expect console captured messages include classification-related messages (the app logs via DOM, not console)
    // But ensure no console errors occurred
    expect(knn.pageErrors.length).toBe(0);
  });

  test('Changing K input triggers reclassification path (and invalid K logs are shown)', async () => {
    // Enter invalid k=0 and click classify -> should log invalid k
    await knn.setK(0);
    await knn.clickClassify();
    const logs1 = await knn.getLogText();
    expect(logs1).toMatch(/Invalid k\./i);

    // Now set a valid k and classify; should produce classify messages
    await knn.setK(1);
    await knn.clickClassify();
    const logs2 = await knn.getLogText();
    expect(logs2).toMatch(/classified as:/i);
  });

  test('Distance metric, weighting, and threshold changes reclassify queries and handle invalid threshold', async () => {
    // Change distance metric and ensure classification occurs (no explicit log because handlers use false),
    // but clicking classify will reflect the new metric in logs
    await knn.setDistanceMetric('manhattan');
    await knn.setWeighting('distance');

    // Invalid threshold: negative number yields invalid threshold message when classify is clicked
    await knn.setThreshold(-1);
    await knn.clickClassify();
    const logs1 = await knn.getLogText();
    expect(logs1).toMatch(/Invalid threshold/i);

    // Valid threshold numeric, classification proceeds
    await knn.setThreshold(1000);
    await knn.clickClassify();
    const logs2 = await knn.getLogText();
    expect(logs2).toMatch(/classified as:/i);
  });

  test('Add points via canvas in different modes and verify points list updates', async () => {
    // Start with selecting classA and add a point near x=50,y=50
    await knn.selectMode('classA');
    const initialCount = await knn.countPointsInList();
    await knn.addPointAt(50, 50);
    const afterAddCount = await knn.countPointsInList();
    expect(afterAddCount).toBeGreaterThan(initialCount);

    // Add a query point
    await knn.selectMode('query');
    const initialQueryCount = await knn.countQueryPointsInList();
    await knn.addPointAt(120, 120);
    const afterQueryCount = await knn.countQueryPointsInList();
    expect(afterQueryCount).toBeGreaterThanOrEqual(initialQueryCount + 1);

    // The log should reflect the addition
    const logs = await knn.getLogText();
    expect(logs).toMatch(/Added (classA|query)/i);
  });

  test('Remove a point using remove mode via canvas and via points list click (confirm handled)', async () => {
    // Choose remove mode and remove a point near 100,80 (initial example point)
    const before = await knn.countPointsInList();
    // Accept confirm
    await knn.removeNearestAt(100, 80, true);
    const after = await knn.countPointsInList();
    expect(after).toBeLessThan(before);

    // Now add a point and remove via clicking its span in pointsList
    await knn.selectMode('classB');
    await knn.addPointAt(400, 50);
    // Wait and count to find new id presence
    const listText = await knn.getPointsListText();
    // find last added id by matching the last occurrence of [number]
    const idMatches = listText.match(/\[(\d+)\]/g);
    expect(idMatches).not.toBeNull();
    const lastIdMatch = idMatches[idMatches.length - 1];
    const lastId = lastIdMatch.replace(/[\[\]]/g, '');

    // Click the span that contains that ID; confirm dialog will appear and we accept it
    const spanLocator = knn.page.locator(`#pointsList span`, { hasText: `[${lastId}]` }).first();
    knn.page.once('dialog', dialog => dialog.accept());
    await spanLocator.click();
    await knn.page.waitForTimeout(100);

    // Verify the id no longer present in the text
    const afterText = await knn.getPointsListText();
    expect(afterText).not.toContain(`[${lastId}]`);
  });

  test('Clear Query Points removes only query points and logs appropriately', async () => {
    // Ensure there is at least one query point
    await knn.selectMode('query');
    await knn.addPointAt(210, 210);
    const queryBefore = await knn.countQueryPointsInList();
    expect(queryBefore).toBeGreaterThanOrEqual(1);

    // Click clear queries button and verify reduction
    await knn.clickClearQueries();
    const queryAfter = await knn.countQueryPointsInList();
    expect(queryAfter).toBeLessThanOrEqual(queryBefore - 1);

    // Log should say 'Removed X query point(s).'
    const logs = await knn.getLogText();
    expect(logs).toMatch(/Removed \d+ query point\(s\)\./i);
  });

  test('Clear All and Reset buttons prompt confirm and update state when accepted', async () => {
    // clear all: accept confirm -> pointsList should say no points
    await knn.clickClearAll(true);
    const countAfterClearAll = await knn.countPointsInList();
    expect(countAfterClearAll).toBe(0);
    const pointsText = await knn.getPointsListText();
    expect(pointsText).toContain('No points in dataset.');

    // Re-initialize by navigating again for reset test
    await knn.goto();

    // click reset and accept -> logs cleared and values reset
    // Pre-conditions: change some inputs
    await knn.setK(5);
    await knn.setDistanceMetric('chebyshev');
    await knn.setWeighting('distance');
    await knn.clickReset(true);

    // After reset, kInput should be default '3', distance metric 'euclidean', weighting 'uniform'
    const kVal = await knn.kInput.inputValue();
    expect(kVal).toBe('3');
    const distVal = await knn.distanceMetric.inputValue();
    expect(distVal).toBe('euclidean');
    const weightVal = await knn.weighting.inputValue();
    expect(weightVal).toBe('uniform');

    // Logs should contain the 'System reset.' message appended after clearing previous logs
    const logsAfterReset = await knn.getLogText();
    expect(logsAfterReset).toMatch(/System reset\./i);
  });

  test('Canvas drag (move) updates point position and logs the move', async () => {
    // Choose move mode
    await knn.selectMode('move');

    // Drag near an initial point: we know example has a classA at ~100,80
    // Start slightly offset to ensure within 10 px threshold for drag
    await knn.dragFromTo(100, 80, 140, 100);

    // The log should include a "Moved point ID ..." entry due to mouseup handler
    const logs = await knn.getLogText();
    expect(logs).toMatch(/Moved point ID \d+ to \(/i);
  });

  test('Canvas mouseleave cancels drag operations (no errors thrown)', async () => {
    // Simulate mouseleave event while not dragging; should be harmless
    await knn.triggerCanvasMouseLeave();

    // No page errors must have been recorded
    expect(knn.pageErrors.length).toBe(0);
  });

  test('Edge case: classify with no base points logs appropriate message', async () => {
    // Remove all points first (clearAll) and accept confirm
    await knn.clickClearAll(true);
    // Ensure no base points
    const totalAfter = await knn.countPointsInList();
    expect(totalAfter).toBe(0);

    // Add a query point only
    await knn.selectMode('query');
    await knn.addPointAt(250, 250);

    // Classify should log that there are no base points in dataset
    await knn.clickClassify();
    const logs = await knn.getLogText();
    expect(logs).toMatch(/No base points in dataset/i);
  });

  test('Edge case: classify when there are no query points logs appropriate message', async () => {
    // Ensure there are base points: navigate to re-init
    await knn.goto();

    // Remove all query points via clear queries button
    await knn.clickClearQueries();
    const queryCount = await knn.countQueryPointsInList();
    expect(queryCount).toBe(0);

    // Click classify -> should log 'No query points to classify.'
    await knn.clickClassify();
    const logs = await knn.getLogText();
    expect(logs).toMatch(/No query points to classify\./i);
  });

  test('Observe console and DOM logs throughout interactions (no uncaught runtime errors)', async () => {
    // Perform a sequence of interactions
    knn.clearCapturedMessages();
    await knn.selectMode('classC');
    await knn.addPointAt(50, 300);
    await knn.selectMode('query');
    await knn.addPointAt(60, 310);
    await knn.setK(3);
    await knn.clickClassify();

    // Ensure DOM log contains classification data
    const logs = await knn.getLogText();
    expect(logs).toMatch(/classified as:/i);

    // Ensure no page errors captured
    expect(knn.pageErrors.length).toBe(0);

    // Also validate that console messages do not contain uncaught exception markers
    const consoleText = knn.consoleMessages.map(m => `${m.type}: ${m.text}`).join('\n');
    expect(consoleText).not.toMatch(/uncaught/i);
  });

});