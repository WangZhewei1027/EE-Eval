import { test, expect } from '@playwright/test';

// Test file: ed8df0c4-fa77-11f0-8492-31e949ed3c7c.spec.js
// Target URL:
// http://127.0.0.1:5500/workspace/0126-biased/html/ed8df0c4-fa77-11f0-8492-31e949ed3c7c.html

// Notes:
// - These tests load the page exactly as-is and observe console logs and page errors.
// - They do NOT modify the page source or patch runtime behavior.
// - They validate the FSM states: Idle (S0_Idle) and Visualizing (S1_Visualizing).
// - They validate the StartVisualization event (button click) and the transition actions
//   (depth increment, visualization cleared, recursion drawing circles).
// - They also cover edge cases like repeated clicks and rapid clicks, and assert no runtime errors occur.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8df0c4-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Recursion Visualizer - FSM and UI behavior', () => {
  // Containers for console and page errors captured per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions.
    page.on('console', (msg) => {
      // Collect relevant console info (type and text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Small sanity check to ensure page loaded (title present)
    await expect(page).toHaveTitle(/Recursion Visualizer/);
  });

  test.afterEach(async ({ page }) => {
    // Optionally ensure page is closed / navigated away to avoid cross-test pollution
    await page.close();
  });

  test('Idle state (S0_Idle) is rendered correctly: button present and visualization empty', async ({ page }) => {
    // Validate that the Start Visualization button exists and matches the FSM evidence selector
    const startButton = page.locator("button[onclick='startRecursion()']");
    await expect(startButton).toHaveCount(1);
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start Visualization');

    // Validate that the visualization container exists and is initially empty
    const viz = page.locator('#visualization');
    await expect(viz).toHaveCount(1);
    await expect(viz).toBeVisible();

    // In the idle state the visualization innerHTML should be empty
    const initialChildCount = await page.evaluate(() => {
      const v = document.getElementById('visualization');
      return v ? v.children.length : -1;
    });
    expect(initialChildCount).toBe(0);

    // Validate that global variables/functions referenced in FSM exist
    const globals = await page.evaluate(() => {
      return {
        hasStartRecursion: typeof window.startRecursion === 'function',
        hasRecursion: typeof window.recursion === 'function',
        depthValue: typeof window.depth !== 'undefined' ? window.depth : null
      };
    });
    expect(globals.hasStartRecursion).toBe(true);
    expect(globals.hasRecursion).toBe(true);
    // depth should be initialized to 0 per implementation
    expect(globals.depthValue).toBe(0);

    // Assert no uncaught page errors during initial render
    expect(pageErrors.length).toBe(0);
    // Assert no console errors were logged during initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('StartVisualization event transitions to Visualizing (S1_Visualizing): circles drawn and depth increments', async ({ page }) => {
    const startButton = page.locator("button[onclick='startRecursion()']");
    const viz = page.locator('#visualization');

    // Click the button to trigger startRecursion()
    await startButton.click();

    // Wait briefly to allow recursion synchronous DOM manipulations to occur
    // (recursion is synchronous here; no promise/async, so small wait is sufficient)
    await page.waitForTimeout(100);

    // After entering Visualizing state, visualization should contain several circle elements
    const childCount = await page.evaluate(() => {
      const v = document.getElementById('visualization');
      return v ? v.children.length : -1;
    });
    expect(childCount).toBeGreaterThan(0);

    // The first drawn circle corresponds to the initial radius 100 -> diameter 200px
    const firstCircleStyle = await page.evaluate(() => {
      const v = document.getElementById('visualization');
      if (!v || !v.children[0]) return null;
      const el = v.children[0];
      return {
        className: el.className,
        width: el.style.width,
        height: el.style.height,
        left: el.style.left,
        top: el.style.top
      };
    });
    expect(firstCircleStyle).not.toBeNull();
    expect(firstCircleStyle.className).toContain('circle');
    // width and height should be '200px' for radius 100
    expect(firstCircleStyle.width).toBe('200px');
    expect(firstCircleStyle.height).toBe('200px');

    // The global depth should have been incremented by the transition action (depth++ in startRecursion)
    const depthAfterStart = await page.evaluate(() => window.depth);
    expect(depthAfterStart).toBe(1);

    // Ensure that all visualization children have the circle class
    const allClasses = await page.evaluate(() => {
      const v = document.getElementById('visualization');
      return Array.from(v.children).map(c => c.className);
    });
    expect(allClasses.length).toBeGreaterThan(0);
    allClasses.forEach(cls => expect(cls).toContain('circle'));

    // Validate that the number of circles is reasonable (finite and bounded)
    // Given the recursion halves radius until <5, the count should be > 0 and less than a large number.
    expect(childCount).toBeLessThan(2000);

    // Assert no uncaught page errors during visualization
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition actions: starting again clears visualization and depth increments again', async ({ page }) => {
    const startButton = page.locator("button[onclick='startRecursion()']");
    const viz = page.locator('#visualization');

    // First click
    await startButton.click();
    await page.waitForTimeout(50);
    const countAfterFirst = await page.evaluate(() => document.getElementById('visualization').children.length);
    expect(countAfterFirst).toBeGreaterThan(0);
    const depthAfterFirst = await page.evaluate(() => window.depth);
    expect(depthAfterFirst).toBe(1);

    // Click again: per implementation, startRecursion clears innerHTML then calls recursion anew
    await startButton.click();
    await page.waitForTimeout(50);
    const countAfterSecond = await page.evaluate(() => document.getElementById('visualization').children.length);
    expect(countAfterSecond).toBeGreaterThan(0);

    // It should have cleared and redrawn: total child count after second should be > 0
    // And depth should have incremented to 2
    const depthAfterSecond = await page.evaluate(() => window.depth);
    expect(depthAfterSecond).toBe(2);

    // Visual confirmation: first circle after second run should still be 200px in diameter
    const firstCircleWidthAfterSecond = await page.evaluate(() => {
      const v = document.getElementById('visualization');
      return v && v.children[0] ? v.children[0].style.width : null;
    });
    expect(firstCircleWidthAfterSecond).toBe('200px');

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks increment depth and keep DOM stable (no exceptions)', async ({ page }) => {
    const startButton = page.locator("button[onclick='startRecursion()']");

    // Rapidly click the button multiple times
    for (let i = 0; i < 5; i++) {
      // Fire-and-forget clicks to simulate rapid interaction
      await startButton.click();
    }

    // Wait a short while for synchronous DOM updates to finish
    await page.waitForTimeout(100);

    // Depth should have incremented by 5 from initial 0 -> 5
    const depthValue = await page.evaluate(() => window.depth);
    expect(depthValue).toBeGreaterThanOrEqual(5);

    // The visualization should contain some circles after the last click
    const childCount = await page.evaluate(() => document.getElementById('visualization').children.length);
    expect(childCount).toBeGreaterThan(0);

    // Ensure the number of children is within reasonable bounds (not exploding)
    expect(childCount).toBeLessThan(5000);

    // No page errors or console errors should have occurred during rapid clicks
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity check: recursion stops when radius becomes small (<5) - finite number of circles', async ({ page }) => {
    // This test asserts the implementation's base case by relying on the finite DOM count
    const startButton = page.locator("button[onclick='startRecursion()']");

    // Trigger the visualization
    await startButton.click();
    await page.waitForTimeout(100);

    // Check that no extremely large number of nodes were created (recursion terminates)
    const childCount = await page.evaluate(() => document.getElementById('visualization').children.length);

    // We expect recursion to terminate; assert a finite limit
    expect(childCount).toBeGreaterThan(0);
    expect(childCount).toBeLessThan(2000);

    // Confirm there were no run-time exceptions thrown during recursion
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console outputs and page errors during interactions', async ({ page }) => {
    // This test demonstrates capturing logs and errors. It does not assert that an error must occur,
    // but asserts that we observed and recorded console messages properly.
    const startButton = page.locator("button[onclick='startRecursion()']");

    // Clear any previously recorded messages
    consoleMessages = [];
    pageErrors = [];

    // Trigger the visualization
    await startButton.click();
    await page.waitForTimeout(50);

    // We should have captured zero page errors for normal operation
    expect(pageErrors.length).toBe(0);

    // Console messages may or may not be present; ensure our listener captured whatever was emitted
    // (assert that captured messages is an array)
    expect(Array.isArray(consoleMessages)).toBe(true);

    // There should not be any console error entries
    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorEntries.length).toBe(0);
  });
});