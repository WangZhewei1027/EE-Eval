import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04425c12-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for interacting with the Tim Sort demo
class TimSortPage {
  constructor(page) {
    this.page = page;
    this.container = '.container';
    this.lowButton = 'button[onclick="sort(\'low\')"]';
    this.midButton = 'button[onclick="sort(\'mid\')"]';
    this.highButton = 'button[onclick="sort(\'high\')"]';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickLowest() {
    await this.page.click(this.lowButton);
  }

  async clickMiddle() {
    await this.page.click(this.midButton);
  }

  async clickHighest() {
    await this.page.click(this.highButton);
  }

  // Returns a Set of class names on the container element
  async getContainerClassSet() {
    const classString = await this.page.locator(this.container).getAttribute('class');
    if (!classString) return new Set();
    return new Set(classString.split(/\s+/).filter(Boolean));
  }

  async hasClass(cls) {
    const set = await this.getContainerClassSet();
    return set.has(cls);
  }
}

test.describe.serial('Tim Sort FSM - Interactive tests for states and transitions', () => {
  // Each test will set up its own listeners for console and page errors
  // to observe runtime behavior without modifying the page.

  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will initialize and navigate using TimSortPage
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is left in a stable state; Playwright will clean up automatically.
    // This is reserved for potential teardown logic if needed in future.
  });

  test('Initial state (Idle) - container has no sort-* classes', async ({ page }) => {
    // Validate initial Idle state: no sort-low, sort-mid, sort-high classes present
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app = new TimSortPage(page);
    await app.goto();

    // Verify container exists and has no sort classes
    const classes = await app.getContainerClassSet();
    expect(classes.has('sort-low')).toBeFalsy();
    expect(classes.has('sort-mid')).toBeFalsy();
    expect(classes.has('sort-high')).toBeFalsy();

    // Assert there are no runtime page errors or console errors on initial load
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorCount).toBe(0);
  });

  test('Click Lowest from Idle -> Sorted Low (S0 -> S1)', async ({ page }) => {
    // This validates the onEnter action adding sort-low,
    // and the exit action removing sort-high (ensuring sort-high not present).
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TimSortPage(page);
    await app.goto();

    await app.clickLowest();

    // After clicking Lowest, container should have sort-low and not have sort-mid or sort-high
    expect(await app.hasClass('sort-low')).toBeTruthy();
    expect(await app.hasClass('sort-mid')).toBeFalsy();
    expect(await app.hasClass('sort-high')).toBeFalsy();

    // No runtime errors expected after clicking
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorCount).toBe(0);
  });

  test('Click Middle from Idle -> Sorted Mid (S0 -> S2)', async ({ page }) => {
    // Validates onEnter adding sort-mid and exit actions removing sort-low and sort-high
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TimSortPage(page);
    await app.goto();

    await app.clickMiddle();

    expect(await app.hasClass('sort-mid')).toBeTruthy();
    expect(await app.hasClass('sort-low')).toBeFalsy();
    expect(await app.hasClass('sort-high')).toBeFalsy();

    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Click Highest from Idle -> Sorted High (S0 -> S3)', async ({ page }) => {
    // Validates onEnter adding sort-high and exit actions removing sort-low and sort-mid
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TimSortPage(page);
    await app.goto();

    await app.clickHighest();

    expect(await app.hasClass('sort-high')).toBeTruthy();
    expect(await app.hasClass('sort-low')).toBeFalsy();
    expect(await app.hasClass('sort-mid')).toBeFalsy();

    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Transitions between all states covering FSM edges', async ({ page }) => {
    // This test sequences through the transitions to validate all inter-state moves:
    // S1 -> S2, S1 -> S3, S2 -> S1, S2 -> S3, S3 -> S1, S3 -> S2
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TimSortPage(page);
    await app.goto();

    // Start: go to S1 (low)
    await app.clickLowest();
    expect(await app.hasClass('sort-low')).toBeTruthy();
    expect(await app.hasClass('sort-mid')).toBeFalsy();
    expect(await app.hasClass('sort-high')).toBeFalsy();

    // S1 -> S2 (low -> mid)
    await app.clickMiddle();
    expect(await app.hasClass('sort-mid')).toBeTruthy();
    expect(await app.hasClass('sort-low')).toBeFalsy();
    expect(await app.hasClass('sort-high')).toBeFalsy();

    // S2 -> S3 (mid -> high)
    await app.clickHighest();
    expect(await app.hasClass('sort-high')).toBeTruthy();
    expect(await app.hasClass('sort-mid')).toBeFalsy();
    expect(await app.hasClass('sort-low')).toBeFalsy();

    // S3 -> S1 (high -> low)
    await app.clickLowest();
    expect(await app.hasClass('sort-low')).toBeTruthy();
    expect(await app.hasClass('sort-high')).toBeFalsy();
    expect(await app.hasClass('sort-mid')).toBeFalsy();

    // S1 -> S3 (low -> high)
    await app.clickHighest();
    expect(await app.hasClass('sort-high')).toBeTruthy();
    expect(await app.hasClass('sort-low')).toBeFalsy();
    expect(await app.hasClass('sort-mid')).toBeFalsy();

    // S3 -> S2 (high -> mid)
    await app.clickMiddle();
    expect(await app.hasClass('sort-mid')).toBeTruthy();
    expect(await app.hasClass('sort-high')).toBeFalsy();
    expect(await app.hasClass('sort-low')).toBeFalsy();

    // Ensure no runtime exceptions happened in the sequence
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Edge Cases: repeated clicks, rapid sequence, and unexpected key invocation', async ({ page }) => {
    // This test checks for stability under repeated interaction and an invocation
    // of the sort function with an unexpected key (should follow "else" path -> sort-high).
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TimSortPage(page);
    await app.goto();

    // Repeated clicks on the same button should be idempotent w.r.t. classes
    await app.clickLowest();
    expect(await app.hasClass('sort-low')).toBeTruthy();
    await app.clickLowest();
    await app.clickLowest();
    // Still only sort-low present from a class-perspective
    expect(await app.hasClass('sort-low')).toBeTruthy();
    expect(await app.hasClass('sort-mid')).toBeFalsy();
    expect(await app.hasClass('sort-high')).toBeFalsy();

    // Rapid sequence of clicks: low -> high -> mid
    // Use Promise.all to fire quickly one after another
    await Promise.all([
      app.clickLowest(),
      app.clickHighest(),
      app.clickMiddle()
    ]);
    // Final state should reflect the last click (Middle) -> sort-mid
    // The implementation processes clicks in sequence in the browser; verify final class
    expect(await app.hasClass('sort-mid')).toBeTruthy();
    expect(await app.hasClass('sort-low')).toBeFalsy();
    expect(await app.hasClass('sort-high')).toBeFalsy();

    // Unexpected key invocation: call the global sort with a non-standard key.
    // The page defines function sort(key) and the else branch treats unknown keys as 'high'
    // We are invoking existing function; this is allowed and not a modification.
    await page.evaluate(() => {
      // intentionally call with an unusual key to exercise else branch
      if (typeof sort === 'function') {
        sort('unexpected_key');
      }
    });

    // After calling with unexpected_key, the implementation should add sort-high
    expect(await app.hasClass('sort-high')).toBeTruthy();
    expect(await app.hasClass('sort-low')).toBeFalsy();
    expect(await app.hasClass('sort-mid')).toBeFalsy();

    // Assert no runtime exceptions surfaced during edge-case interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Visual feedback and DOM checks - class toggles and element presence', async ({ page }) => {
    // This test verifies the existence of the buttons and the header and ensures
    // that class toggles are reflected in the DOM (visual feedback hooks).
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TimSortPage(page);
    await app.goto();

    // Ensure UI elements are present
    await expect(page.locator('h1', { hasText: 'Tim Sort' })).toHaveCount(1);
    await expect(page.locator(app.lowButton)).toHaveCount(1);
    await expect(page.locator(app.midButton)).toHaveCount(1);
    await expect(page.locator(app.highButton)).toHaveCount(1);

    // Click each and assert classes (redo quick smoke verification)
    await app.clickLowest();
    expect(await app.hasClass('sort-low')).toBeTruthy();

    await app.clickMiddle();
    expect(await app.hasClass('sort-mid')).toBeTruthy();
    expect(await app.hasClass('sort-low')).toBeFalsy();

    await app.clickHighest();
    expect(await app.hasClass('sort-high')).toBeTruthy();
    expect(await app.hasClass('sort-mid')).toBeFalsy();

    // No runtime errors on UI interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });
});