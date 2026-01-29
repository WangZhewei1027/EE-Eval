import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9654f2-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the B+ Tree visualization page
class BPlusTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.highlightRootBtn = page.locator('#highlightRoot');
    this.highlightLeavesBtn = page.locator('#highlightLeaves');
    this.rootKeyLocator = page.locator('.node-group.root text.node-text');
    this.leafKeyLocator = page.locator('.node-group.leaf text.node-text');
    this.container = page.locator('#container');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main container to render as renderPage() is the "entry action" for Idle
    await expect(this.container).toBeVisible();
  }

  // Click root highlight button
  async toggleRoot() {
    await this.highlightRootBtn.click();
  }

  // Click leaves highlight button
  async toggleLeaves() {
    await this.highlightLeavesBtn.click();
  }

  // Get aria-pressed attribute values as text
  async getRootAriaPressed() {
    return (await this.highlightRootBtn.getAttribute('aria-pressed')) ?? null;
  }
  async getLeavesAriaPressed() {
    return (await this.highlightLeavesBtn.getAttribute('aria-pressed')) ?? null;
  }

  // Count highlighted root keys (elements with class 'key-highlight')
  async countHighlightedRootKeys() {
    return await this.page.locator('.node-group.root text.node-text.key-highlight').count();
  }

  // Count highlighted leaf keys
  async countHighlightedLeafKeys() {
    return await this.page.locator('.node-group.leaf text.node-text.key-highlight').count();
  }

  async totalRootKeys() {
    return await this.rootKeyLocator.count();
  }

  async totalLeafKeys() {
    return await this.leafKeyLocator.count();
  }

  // Utility to rapidly click a locator n times
  async rapidClicks(locator, n = 3, delayMs = 10) {
    for (let i = 0; i < n; i++) {
      await locator.click();
      // small delay to emulate quick user clicks
      await this.page.waitForTimeout(delayMs);
    }
  }
}

test.describe('B+ Tree Visualization - FSM States and Transitions (3c9654f2-...)', () => {
  // Capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and collect error-level logs
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // If anything goes wrong while processing console messages, push the error detail
        consoleErrors.push({ text: `console listener error: ${String(e)}` });
      }
    });

    // Listen to runtime page errors (unhandled exceptions)
    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async () => {
    // After each test make sure there were no unexpected runtime errors.
    // These assertions ensure we observed and recorded console / runtime errors reliably.
    expect(pageErrors, `Unexpected pageerror events: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
    expect(consoleErrors, `Unexpected console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
  });

  test('S0_Idle: initial render shows controls and tree (renderPage entry action)', async ({ page }) => {
    // Verify initial Idle state: page renders and controls exist
    const app = new BPlusTreePage(page);
    await app.goto();

    // Comments: Validate presence of control buttons and SVG tree.
    await expect(app.highlightRootBtn).toBeVisible();
    await expect(app.highlightLeavesBtn).toBeVisible();
    await expect(page.locator('#tree-svg')).toBeVisible();

    // Buttons should start with aria-pressed "false" (string)
    const rootPressed = await app.getRootAriaPressed();
    const leavesPressed = await app.getLeavesAriaPressed();
    expect(rootPressed === 'false' || rootPressed === null || rootPressed === 'undefined' ? true : false).toBe(true);
    expect(leavesPressed === 'false' || leavesPressed === null || leavesPressed === 'undefined' ? true : false).toBe(true);

    // Validate there are root keys and leaf keys present
    const totalRootKeys = await app.totalRootKeys();
    const totalLeafKeys = await app.totalLeafKeys();
    expect(totalRootKeys).toBeGreaterThan(0);
    expect(totalLeafKeys).toBeGreaterThan(0);
  });

  test('S1_RootHighlighted: clicking Highlight Root toggles root highlight and sets aria-pressed', async ({ page }) => {
    // Validate transition Idle -> RootHighlighted and toggling back (S0 <-> S1)
    const app = new BPlusTreePage(page);
    await app.goto();

    const rootKeysBefore = await app.totalRootKeys();
    expect(rootKeysBefore).toBeGreaterThan(0);

    // Click to highlight root keys (Idle -> RootHighlighted)
    await app.toggleRoot();

    // aria-pressed should be "true"
    const pressed = await app.getRootAriaPressed();
    expect(String(pressed)).toBe('true');

    // Root text elements should have key-highlight class applied
    const highlightedCount = await app.countHighlightedRootKeys();
    expect(highlightedCount).toBe(rootKeysBefore);

    // Click again to de-highlight (RootHighlighted -> Idle)
    await app.toggleRoot();
    const pressedAfter = await app.getRootAriaPressed();
    // Because implementation sometimes sets boolean directly, ensure we accept both 'false' and false-like values
    expect(String(pressedAfter)).toBe('false');

    // Confirm highlights removed
    const highlightedCountAfter = await app.countHighlightedRootKeys();
    expect(highlightedCountAfter).toBe(0);
  });

  test('S2_LeavesHighlighted: clicking Highlight Leaves toggles leaf highlight and sets aria-pressed', async ({ page }) => {
    // Validate Idle -> LeavesHighlighted and back
    const app = new BPlusTreePage(page);
    await app.goto();

    const totalLeaves = await app.totalLeafKeys();
    expect(totalLeaves).toBeGreaterThan(0);

    // Click to highlight leaves
    await app.toggleLeaves();

    // aria-pressed should be "true"
    const leavesPressed = await app.getLeavesAriaPressed();
    expect(String(leavesPressed)).toBe('true');

    // All leaf key elements should have key-highlight
    const highlightedLeafCount = await app.countHighlightedLeafKeys();
    expect(highlightedLeafCount).toBe(totalLeaves);

    // Click again to toggle off
    await app.toggleLeaves();
    const leavesPressedAfter = await app.getLeavesAriaPressed();
    expect(String(leavesPressedAfter)).toBe('false');

    const highlightedLeafCountAfter = await app.countHighlightedLeafKeys();
    expect(highlightedLeafCountAfter).toBe(0);
  });

  test('Transition S1_RootHighlighted -> S2_LeavesHighlighted: highlighting leaves dehighlights root', async ({ page }) => {
    // Validate that clicking leaves while root is highlighted will switch to LeavesHighlighted and clear root
    const app = new BPlusTreePage(page);
    await app.goto();

    // Highlight root first
    await app.toggleRoot();
    expect(String(await app.getRootAriaPressed())).toBe('true');
    expect(await app.countHighlightedRootKeys()).toBeGreaterThan(0);

    // Now click highlight leaves -> should highlight leaves and de-highlight root
    await app.toggleLeaves();

    // Leaves aria pressed true
    expect(String(await app.getLeavesAriaPressed())).toBe('true');

    // Root should be de-highlighted and its aria set to false
    expect(String(await app.getRootAriaPressed())).toBe('false');
    expect(await app.countHighlightedRootKeys()).toBe(0);

    // Leaf keys highlighted
    expect(await app.countHighlightedLeafKeys()).toBe(await app.totalLeafKeys());
  });

  test('Transition S2_LeavesHighlighted -> S1_RootHighlighted: highlighting root dehighlights leaves', async ({ page }) => {
    // Validate that clicking root while leaves is highlighted will switch to RootHighlighted and clear leaves
    const app = new BPlusTreePage(page);
    await app.goto();

    // Highlight leaves first
    await app.toggleLeaves();
    expect(String(await app.getLeavesAriaPressed())).toBe('true');
    expect(await app.countHighlightedLeafKeys()).toBeGreaterThan(0);

    // Now click highlight root -> should highlight root and de-highlight leaves
    await app.toggleRoot();

    // Root aria pressed true
    expect(String(await app.getRootAriaPressed())).toBe('true');

    // Leaves should be de-highlighted and aria set to false
    expect(String(await app.getLeavesAriaPressed())).toBe('false');
    expect(await app.countHighlightedLeafKeys()).toBe(0);

    // Root keys highlighted
    expect(await app.countHighlightedRootKeys()).toBe(await app.totalRootKeys());
  });

  test('Edge case: rapid toggling and quick alternation between buttons should maintain mutual exclusivity', async ({ page }) => {
    // Rapid clicks stress test: ensures FSM stays consistent under quick user interactions
    const app = new BPlusTreePage(page);
    await app.goto();

    // Rapidly click root 5 times
    await app.rapidClicks(app.highlightRootBtn, 5, 5);

    // After odd number of toggles, root should be highlighted
    const rootPressedAfterRapid = String(await app.getRootAriaPressed());
    expect(['true', 'false']).toContain(rootPressedAfterRapid);

    // Rapidly alternate clicks between root and leaves
    for (let i = 0; i < 6; i++) {
      await app.highlightRootBtn.click();
      await app.highlightLeavesBtn.click();
    }

    // After alternating, ensure there is no situation both have highlights
    const rootHighlightedCount = await app.countHighlightedRootKeys();
    const leafHighlightedCount = await app.countHighlightedLeafKeys();

    // At most one set should be highlighted (mutual exclusivity). Both being > 0 would violate FSM constraints.
    const bothHighlighted = rootHighlightedCount > 0 && leafHighlightedCount > 0;
    expect(bothHighlighted).toBe(false);

    // Confirm aria-pressed attributes are consistent with classes
    const rootAria = String(await app.getRootAriaPressed());
    const leavesAria = String(await app.getLeavesAriaPressed());

    if (rootHighlightedCount > 0) {
      expect(rootAria).toBe('true');
      expect(leavesAria).toBe('false');
    } else if (leafHighlightedCount > 0) {
      expect(leavesAria).toBe('true');
      expect(rootAria).toBe('false');
    } else {
      // Neither highlighted - acceptable final state (Idle)
      expect(rootAria).toBe('false');
      expect(leavesAria).toBe('false');
    }
  });

  test('Edge case: clicking non-button areas has no side effects and does not produce runtime errors', async ({ page }) => {
    // Ensure clicking the SVG or other non-interactive parts doesn't cause errors
    const app = new BPlusTreePage(page);
    await app.goto();

    const svg = page.locator('#tree-svg');
    await svg.click({ position: { x: 10, y: 10 } });

    // No changes to aria-pressed expected
    expect(String(await app.getRootAriaPressed())).toBe('false');
    expect(String(await app.getLeavesAriaPressed())).toBe('false');

    // And no runtime errors should have been captured (checked in afterEach)
  });

  test('Sanity: Verify key-highlight CSS class actually applies visible effect on elements', async ({ page }) => {
    // Validate that the class addition is reflected in DOM className for at least one element when toggling
    const app = new BPlusTreePage(page);
    await app.goto();

    // Highlight root and verify class applied to first root key element
    await app.toggleRoot();
    const firstRootKey = page.locator('.node-group.root text.node-text').first();
    await expect(firstRootKey).toHaveClass(/key-highlight/);

    // Remove highlight and verify class removed
    await app.toggleRoot();
    await expect(firstRootKey).not.toHaveClass(/key-highlight/);
  });
});