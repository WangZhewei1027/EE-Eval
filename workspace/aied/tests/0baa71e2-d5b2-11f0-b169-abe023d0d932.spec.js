import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa71e2-d5b2-11f0-b169-abe023d0d932.html';

// Page object encapsulating interactions with the Two Pointers page
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Primary controls for example 1
    this.heading = page.locator('h1');
    this.point1Input = page.locator('#point1'); // Note: There are duplicate IDs in the HTML; this selects the first
    this.point2Input = page.locator('#point2'); // selects the first occurrence
    this.addPointBtn = page.locator('#add-point-btn');
    this.removePointBtn = page.locator('#remove-point-btn');
    this.pointsContainer1 = page.locator('#points-container');

    // Controls for example 2 (different button ids, but some handlers may not be wired up)
    this.addPointBtn2 = page.locator('#add-point-btn2');
    this.removePointBtn2 = page.locator('#remove-point-btn2');
    this.pointsContainer2 = page.locator('#points-container2');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for full load; errors (pageerror) may occur during parsing/execution; tests capture them separately
    await this.page.waitForLoadState('load');
  }

  // Returns the heading text content
  async getHeadingText() {
    return await this.heading.textContent();
  }

  // Click the add point button for example 1
  async clickAddPoint() {
    await this.addPointBtn.click();
  }

  // Click the remove point button for example 1
  async clickRemovePoint() {
    await this.removePointBtn.click();
  }

  // Add point to example 1 by ensuring input value and clicking the button
  async addPointWithValue(value) {
    await this.point1Input.fill(String(value));
    await this.clickAddPoint();
  }

  // Returns number of <p> elements inside points container 1
  async getPoints1Count() {
    return await this.pointsContainer1.locator('p').count();
  }

  // Returns array of text contents for points container 1
  async getPoints1Texts() {
    const locs = this.pointsContainer1.locator('p');
    const n = await locs.count();
    const results = [];
    for (let i = 0; i < n; i++) {
      results.push(await locs.nth(i).textContent());
    }
    return results;
  }

  // Click add on example 2
  async clickAddPoint2() {
    await this.addPointBtn2.click();
  }

  // Click remove on example 2
  async clickRemovePoint2() {
    await this.removePointBtn2.click();
  }

  async getPoints2Count() {
    return await this.pointsContainer2.locator('p').count();
  }
}

test.describe('Two Pointers Example - FSM and UI validation', () => {
  // Arrays to capture page errors, console messages, and dialogs
  let pageErrors;
  let consoleMessages;
  let dialogs;
  let twoPointers;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    dialogs = [];

    // Capture runtime exceptions (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object; message contains V8-style message
      pageErrors.push(String(err.message));
    });

    // Capture console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Auto-dismiss dialogs but record them
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.dismiss();
    });

    twoPointers = new TwoPointersPage(page);
    await twoPointers.goto();

    // Small pause to ensure any async post-load errors/messages are captured
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // noop - cleanup is handled by Playwright fixtures
  });

  test('Idle state: page renders main heading (evidence of renderPage)', async () => {
    // Validate Idle state evidence: <h1>Two Pointers Example</h1>
    const heading = await twoPointers.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toEqual('Two Pointers Example');
  });

  test('Script runtime errors are observed (expect ReferenceError due to undefined handlers)', async () => {
    // The provided HTML contains references to functions that are not defined (e.g., updatePoint1),
    // which should produce a runtime ReferenceError during script execution.
    // Assert that at least one pageerror was captured and it references the problematic identifier(s).
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one error should mention 'updatePoint1' or 'updatePoints1' or 'updatePoint2'
    const joined = pageErrors.join(' | ').toLowerCase();
    const hasExpectedIdentifier = joined.includes('updatepoint1') || joined.includes('updatepoints1') || joined.includes('updatepoint2');
    expect(hasExpectedIdentifier).toBeTruthy();
  });

  test('AddPoint1 transition: clicking Add Point adds a point to example 1 (Point Added state)', async () => {
    // Ensure initial points1 container is empty (because erroneous init functions were not called)
    let initialCount = await twoPointers.getPoints1Count();
    expect(initialCount).toBe(0);

    // Use the value already in the input (or set explicitly) and click add
    await twoPointers.point1Input.fill('10');
    await twoPointers.clickAddPoint();

    // After clicking, we expect a new point to be rendered in points-container for example 1
    // This validates the transition S0_Idle -> S1_PointAdded (points1.length > 0)
    await twoPointers.page.waitForTimeout(100); // allow DOM update
    const countAfterAdd = await twoPointers.getPoints1Count();
    expect(countAfterAdd).toBeGreaterThan(0);

    const texts = await twoPointers.getPoints1Texts();
    // The first point should reflect the value we added
    expect(texts[0]).toContain('Point 1: 10');
  });

  test('RemovePoint1 transition: clicking Remove Point removes the last added point (Point Removed state)', async () => {
    // Ensure we have at least one point to remove
    await twoPointers.point1Input.fill('55');
    await twoPointers.clickAddPoint();
    await twoPointers.page.waitForTimeout(100);

    const beforeRemove = await twoPointers.getPoints1Count();
    expect(beforeRemove).toBeGreaterThanOrEqual(1);

    // Click remove and verify the count decreases
    await twoPointers.clickRemovePoint();
    await twoPointers.page.waitForTimeout(100);
    const afterRemove = await twoPointers.getPoints1Count();

    expect(afterRemove).toBeLessThanOrEqual(beforeRemove - 0); // either reduced by 1 or stayed same if other issues
    // If at least one was removed, afterRemove should be beforeRemove - 1
    // Accept either behavior but prefer evidence of pop: if beforeRemove >=1 then afterRemove should be < beforeRemove
    if (beforeRemove >= 1) {
      expect(afterRemove).toBeLessThan(beforeRemove);
    }
  });

  test('Edge case: Removing when no points exist triggers alert "No points to remove"', async () => {
    // Ensure points container is empty
    // Remove all points if any
    let count = await twoPointers.getPoints1Count();
    while (count > 0) {
      await twoPointers.clickRemovePoint();
      await twoPointers.page.waitForTimeout(50);
      count = await twoPointers.getPoints1Count();
    }

    expect(count).toBe(0);

    // Click remove when empty - script's removePoint() should alert 'No points to remove'
    await twoPointers.clickRemovePoint();

    // Wait briefly for dialog handling to capture
    await twoPointers.page.waitForTimeout(100);

    // At least one dialog should have been captured with message including 'No points to remove'
    const found = dialogs.some(d => d.message.includes('No points to remove'));
    expect(found).toBeTruthy();
  });

  test('Input events for InputPoint1/InputPoint2 are not registered (due to runtime error) - typing does not auto-add points', async () => {
    // Ensure points containers are empty
    const initialCount = await twoPointers.getPoints1Count();
    expect(initialCount).toBe(0);

    // Type into the point1 input - the intended input handler updatePoint1 is undefined in the HTML and its listener likely never got registered.
    await twoPointers.point1Input.fill('12345');
    await twoPointers.point1Input.type('6'); // a further input event

    // Allow time for any handlers to run (if they somehow exist)
    await twoPointers.page.waitForTimeout(200);

    // Since the input handler is missing, typing should not automatically add points to the container
    const afterTypingCount = await twoPointers.getPoints1Count();
    expect(afterTypingCount).toBe(0);
  });

  test('Example 2 buttons are no-ops (no event binding present in HTML) and do not affect example 1', async () => {
    // Ensure example 2 container is initially empty
    const initial2 = await twoPointers.getPoints2Count();
    // initial may be 0; assert it is 0 or stable
    expect(initial2).toBe(0);

    // Click add on example 2 which in the provided HTML has no event listeners attached
    await twoPointers.clickAddPoint2();
    await twoPointers.page.waitForTimeout(100);

    // Expect still no points in example 2
    const afterAdd2 = await twoPointers.getPoints2Count();
    expect(afterAdd2).toBe(0);

    // Ensure example 1 was not affected by clicking example2 buttons
    const afterAdd1 = await twoPointers.getPoints1Count();
    expect(afterAdd1).toBe(0);
  });

  test('Console messages and captured errors summary provide diagnostics for broken handlers', async () => {
    // This test just asserts we have captured console messages and at least one page error,
    // providing additional evidence for debugging the broken implementation.
    // Ensure we recorded page errors earlier
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Optionally assert that console messages array is available (may be empty)
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // The error list should contain at least one ReferenceError mentioning at least one missing function name
    const joinedErrors = pageErrors.join(' | ');
    expect(joinedErrors.length).toBeGreaterThan(0);
  });
});