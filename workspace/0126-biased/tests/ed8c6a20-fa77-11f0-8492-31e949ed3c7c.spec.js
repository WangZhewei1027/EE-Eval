import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8c6a20-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Linked List Visualization page
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async button() {
    return this.page.locator('#showArrows');
  }

  async arrow1() {
    return this.page.locator('#arrow1');
  }

  async arrow2() {
    return this.page.locator('#arrow2');
  }

  async nodes() {
    return this.page.locator('.node');
  }

  async clickToggle() {
    await (await this.button()).click();
  }

  async buttonText() {
    return (await (await this.button()).textContent())?.trim();
  }

  async isArrow1VisibleClass() {
    const handle = await this.arrow1();
    const classAttr = await handle.getAttribute('class');
    return classAttr ? classAttr.split(/\s+/).includes('visible') : false;
  }

  async isArrow2VisibleClass() {
    const handle = await this.arrow2();
    const classAttr = await handle.getAttribute('class');
    return classAttr ? classAttr.split(/\s+/).includes('visible') : false;
  }

  // Check computed opacity to confirm visual change (0 => hidden, 1 => visible)
  async arrowOpacity(id) {
    const el = await this.page.locator(id);
    return await el.evaluate((e) => {
      const cs = window.getComputedStyle(e);
      return cs.getPropertyValue('opacity');
    });
  }
}

test.describe('Linked List Visualization - state & transition tests', () => {
  // Collect console errors and page errors for each test run
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will attach listeners so we capture events per-test
  });

  // Test initial Idle state (S0_Idle)
  test('Initial state: Idle - button shows "Show Connections" and arrows are hidden', async ({ page }) => {
    // Capture console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const p = new LinkedListPage(page);
    await p.goto();

    // Validate button exists and has expected initial text
    const btn = await p.button();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Show Connections');

    // Validate nodes exist (three nodes)
    const nodes = await p.nodes();
    await expect(nodes).toHaveCount(3);
    const nodeTexts = await nodes.allTextContents();
    expect(nodeTexts).toEqual(expect.arrayContaining(['Node 1', 'Node 2', 'Node 3']));

    // Arrows should be present in DOM but not visible (no 'visible' class)
    const arrow1 = await p.arrow1();
    const arrow2 = await p.arrow2();
    await expect(arrow1).toBeVisible(); // element exists and occupies layout
    await expect(arrow2).toBeVisible(); // element exists; visibility here means present, not opacity

    // Confirm class toggle hasn't been applied yet
    expect(await p.isArrow1VisibleClass()).toBe(false);
    expect(await p.isArrow2VisibleClass()).toBe(false);

    // Confirm CSS opacity is "0" for arrows (hidden by design)
    const op1 = await p.arrowOpacity('#arrow1');
    const op2 = await p.arrowOpacity('#arrow2');
    expect(op1.trim()).toBe('0');
    expect(op2.trim()).toBe('0');

    // Assert that there were no runtime errors during load
    expect(consoleErrors.length, `console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(String).join(' | ')}`).toBe(0);
  });

  // Test transition: S0_Idle -> S1_ConnectionsVisible
  test('Clicking "Show Connections" toggles arrows visible and button text updates to "Hide Connections"', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const p = new LinkedListPage(page);
    await p.goto();

    // Click the toggle to show connections
    await p.clickToggle();

    // After clicking, class 'visible' should be present on both arrows
    expect(await p.isArrow1VisibleClass()).toBe(true);
    expect(await p.isArrow2VisibleClass()).toBe(true);

    // CSS opacity should reflect visible state
    const op1 = await p.arrowOpacity('#arrow1');
    const op2 = await p.arrowOpacity('#arrow2');
    expect(op1.trim()).toBe('1');
    expect(op2.trim()).toBe('1');

    // Button text should change to 'Hide Connections'
    await expect(p.button()).toHaveText('Hide Connections');

    // No runtime JS errors occurred
    expect(consoleErrors.length, `console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(String).join(' | ')}`).toBe(0);
  });

  // Test transition: S1_ConnectionsVisible -> S0_Idle
  test('Clicking "Hide Connections" toggles arrows hidden and button text reverts to "Show Connections"', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const p = new LinkedListPage(page);
    await p.goto();

    // Bring to visible state first
    await p.clickToggle();
    await expect(p.button()).toHaveText('Hide Connections');
    expect(await p.isArrow1VisibleClass()).toBe(true);
    expect(await p.isArrow2VisibleClass()).toBe(true);

    // Click again to hide
    await p.clickToggle();

    // Arrows should no longer have 'visible' class
    expect(await p.isArrow1VisibleClass()).toBe(false);
    expect(await p.isArrow2VisibleClass()).toBe(false);

    // CSS opacity should reflect hidden state
    const op1 = await p.arrowOpacity('#arrow1');
    const op2 = await p.arrowOpacity('#arrow2');
    expect(op1.trim()).toBe('0');
    expect(op2.trim()).toBe('0');

    // Button text should revert
    await expect(p.button()).toHaveText('Show Connections');

    // No runtime JS errors occurred
    expect(consoleErrors.length, `console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(String).join(' | ')}`).toBe(0);
  });

  // Edge case: rapid multiple clicks - toggles should alternate predictably
  test('Rapid multiple clicks toggle the visibility state predictably (parity test)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const p = new LinkedListPage(page);
    await p.goto();

    // Click 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await p.clickToggle();
    }

    // After 5 clicks (odd), state should be visible
    expect(await p.isArrow1VisibleClass()).toBe(true);
    expect(await p.isArrow2VisibleClass()).toBe(true);
    await expect(p.button()).toHaveText('Hide Connections');

    // Click one more time -> 6 total (even) -> hidden
    await p.clickToggle();
    expect(await p.isArrow1VisibleClass()).toBe(false);
    expect(await p.isArrow2VisibleClass()).toBe(false);
    await expect(p.button()).toHaveText('Show Connections');

    // No runtime JS errors occurred
    expect(consoleErrors.length, `console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(String).join(' | ')}`).toBe(0);
  });

  // Edge case: Validate DOM integrity and that repeated toggles don't create duplicate classes or elements
  test('Repeated toggles do not create duplicate elements or unexpected classes', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const p = new LinkedListPage(page);
    await p.goto();

    const initialArrow1Class = await (await p.arrow1()).getAttribute('class');
    const initialArrow2Class = await (await p.arrow2()).getAttribute('class');

    // Toggle many times
    for (let i = 0; i < 10; i++) {
      await p.clickToggle();
    }

    // After even number of toggles should be back to initial classes
    const finalArrow1Class = await (await p.arrow1()).getAttribute('class');
    const finalArrow2Class = await (await p.arrow2()).getAttribute('class');

    // Compare class attribute strings (order may be same since only 'arrow' and optionally 'visible')
    expect(finalArrow1Class).toBe(initialArrow1Class);
    expect(finalArrow2Class).toBe(initialArrow2Class);

    // Ensure only expected elements in the DOM: 3 nodes and 2 arrows
    await expect(p.nodes()).toHaveCount(3);
    await expect(p.arrow1()).toBeVisible();
    await expect(p.arrow2()).toBeVisible();

    // No runtime JS errors occurred
    expect(consoleErrors.length, `console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(String).join(' | ')}`).toBe(0);
  });

  // Observe console and page errors during navigation and interactions
  test('No unexpected console errors or page exceptions during full interaction flow', async ({ page }) => {
    // This test explicitly captures and asserts there are no console errors or page exceptions
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const p = new LinkedListPage(page);
    await p.goto();

    // Perform sequence: show, hide, show
    await p.clickToggle(); // show
    await p.clickToggle(); // hide
    await p.clickToggle(); // show

    // Validate final expected state: visible
    expect(await p.isArrow1VisibleClass()).toBe(true);
    expect(await p.isArrow2VisibleClass()).toBe(true);
    await expect(p.button()).toHaveText('Hide Connections');

    // Assert zero console errors and page errors
    expect(consoleErrors.length, `console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(String).join(' | ')}`).toBe(0);
  });
});