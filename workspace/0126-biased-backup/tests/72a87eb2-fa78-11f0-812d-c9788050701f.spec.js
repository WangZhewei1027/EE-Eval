import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a87eb2-fa78-11f0-812d-c9788050701f.html';

// Page Object for the stack application
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.stackSel = '#stack';
    this.pushSel = '#push-btn';
    this.popSel = '#pop-btn';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async push() {
    await this.page.click(this.pushSel);
  }

  async pop() {
    await this.page.click(this.popSel);
  }

  async getItemsCount() {
    return await this.page.$$eval('.stack-item', items => items.length);
  }

  async getTopText() {
    return await this.page.$eval('.stack-item', el => el.textContent.trim());
  }

  async getAllTexts() {
    return await this.page.$$eval('.stack-item', items => items.map(i => i.textContent.trim()));
  }

  async getItemInlineStyleProperty(index, property) {
    // index 0 is top element (.stack-item:first-child)
    const handles = await this.page.$$('.stack-item');
    if (index >= handles.length) return null;
    return await this.page.evaluate((el, prop) => el.style[prop], handles[index], property);
  }

  async getItemComputedStyleProperty(index, property) {
    const handles = await this.page.$$('.stack-item');
    if (index >= handles.length) return null;
    return await this.page.evaluate((el, prop) => window.getComputedStyle(el)[prop], handles[index], property);
  }
}

test.describe('Visual Stack FSM and interactions - 72a87eb2-fa78-11f0-812d-c9788050701f', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture console errors and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // no-op here; each test will assert error arrays as needed
  });

  test.describe('S0_Initial (Initial State) validations', () => {
    test('Initial DOM and basic elements exist; initial animation runs', async ({ page }) => {
      const stackPage = new StackPage(page);
      // Load the page exactly as-is
      await stackPage.goto();

      // Basic DOM sanity
      await expect(page.locator('#stack')).toBeVisible();
      await expect(page.locator('#push-btn')).toBeVisible();
      await expect(page.locator('#pop-btn')).toBeVisible();

      // At load, initial number of items should be 5 as per HTML
      const initialCount = await stackPage.getItemsCount();
      expect(initialCount).toBe(5);

      // Top item initial text should be "5" (the first child in the provided HTML)
      const topText = await stackPage.getTopText();
      expect(topText).toBe('5');

      // The initial animation is scheduled after 500ms and then per-item offsets.
      // Wait sufficiently long for the animation to apply inline transforms.
      await page.waitForTimeout(1200);

      // Verify that the top item's inline transform has been set by the animation.
      const topTransform = await stackPage.getItemInlineStyleProperty(0, 'transform');
      // We expect something like "translateY(0px)" or at least that transform includes "translateY"
      expect(topTransform).toBeTruthy();
      expect(topTransform).toContain('translateY');

      // Assert that no unexpected console or page errors occurred during initial load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_ItemPushed (PushEvent) validations', () => {
    test('Single push adds a new top item with expected visual changes', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Wait for initial animation to finish to avoid flakiness
      await page.waitForTimeout(1200);

      const beforeCount = await stackPage.getItemsCount();
      expect(beforeCount).toBe(5);
      const beforeTop = await stackPage.getTopText();
      expect(beforeTop).toBe('5');

      // Click push and validate immediate styles for the freshly inserted element (set before animation)
      await stackPage.push();

      // Immediately after click, the inserted element should have been created and have initial inline styles:
      // transform: translateY(-100px) and opacity: 0 (set synchronously before timeouts)
      // Wait a short moment to ensure DOM insertion happened
      await page.waitForTimeout(20);

      const afterCountSoon = await stackPage.getItemsCount();
      expect(afterCountSoon).toBe(6); // one new item inserted synchronously

      const newTopText = await stackPage.getTopText();
      // New item text should be '6' as counter starts at 6 in the page script
      expect(newTopText).toBe('6');

      // Check inline style on new top element before entrance animation completes
      const newTopTransformImmediate = await stackPage.getItemInlineStyleProperty(0, 'transform');
      const newTopOpacityImmediate = await stackPage.getItemInlineStyleProperty(0, 'opacity');
      // Because script sets these immediately before the entrance animation
      expect(newTopTransformImmediate).toBeTruthy();
      expect(newTopTransformImmediate).toContain('-100');
      expect(newTopOpacityImmediate).toBe('0');

      // Allow the entrance animation (50ms + transition time) to complete
      await page.waitForTimeout(300);

      const afterCount = await stackPage.getItemsCount();
      expect(afterCount).toBe(6);

      const newTopTransformFinal = await stackPage.getItemInlineStyleProperty(0, 'transform');
      const newTopOpacityFinal = await stackPage.getItemInlineStyleProperty(0, 'opacity');

      // After animation completes, transform should be translateY(0) and opacity should be 1
      expect(newTopTransformFinal).toBeTruthy();
      expect(newTopTransformFinal).toContain('translateY');
      expect(newTopOpacityFinal).toBe('1');

      // Assert no console or page errors happened during push
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Pushing items is limited to the max (edge case currentItems >= 8)', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      // Wait for initial animation
      await page.waitForTimeout(1200);

      // Starting at 5 items. Push 3 times to reach 8.
      for (let i = 0; i < 3; i++) {
        await stackPage.push();
        // Wait for insertion and animation to settle
        await page.waitForTimeout(200);
      }

      const countAtMax = await stackPage.getItemsCount();
      expect(countAtMax).toBe(8);

      const texts = await stackPage.getAllTexts();
      // The topmost three pushes should have added 6,7,8 at top (in that order)
      expect(texts[0]).toBe('8');
      expect(texts[1]).toBe('7');
      expect(texts[2]).toBe('6');

      // Attempt one more push - should be ignored due to guard if (currentItems >= 8) return;
      await stackPage.push();
      // Give a short delay to ensure if anything was inserted it would appear
      await page.waitForTimeout(200);

      const finalCount = await stackPage.getItemsCount();
      expect(finalCount).toBe(8); // no new item should be added

      // Assert still no console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple pushes preserve LIFO order of newly added items', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      await page.waitForTimeout(1200);

      // Push two items with known sequence
      await stackPage.push(); // adds 6
      await page.waitForTimeout(200);
      await stackPage.push(); // adds 7
      await page.waitForTimeout(300);

      // Now pop twice and verify popped items follow LIFO (7 then 6)
      // Capture top before first pop
      const topBeforeFirstPop = await stackPage.getTopText();
      expect(topBeforeFirstPop).toBe('7');

      // Click pop and check immediate visual of the popped element (transform and opacity set synchronously)
      // Grab current top element's inline style values before removal
      const topTransformBeforeRemove = await stackPage.getItemInlineStyleProperty(0, 'transform');
      const topOpacityBeforeRemove = await stackPage.getItemInlineStyleProperty(0, 'opacity');

      // Perform pop
      await stackPage.pop();

      // Immediately after clicking pop, top item should have transform '-100px' and opacity '0'
      // Wait a tiny bit to allow synchronous style changes to be observed
      await page.waitForTimeout(20);

      expect(topTransformBeforeRemove).toBeTruthy(); // we fetched it before clicking
      // Immediately after clicking, check current inline style
      const topTransformAfterClick = await stackPage.getItemInlineStyleProperty(0, 'transform');
      const topOpacityAfterClick = await stackPage.getItemInlineStyleProperty(0, 'opacity');
      // These should reflect the pop animation target
      expect(topTransformAfterClick).toContain('-100');
      expect(topOpacityAfterClick).toBe('0');

      // Wait for actual removal to occur (300ms in script)
      await page.waitForTimeout(350);

      // After first pop, the top should now be the previous item '6'
      const topAfterFirstRemoval = await stackPage.getTopText();
      expect(topAfterFirstRemoval).toBe('6');

      // Now pop again to remove '6'
      await stackPage.pop();
      await page.waitForTimeout(350);

      // After second pop, the new top should be previous existing item that was under 6 (which was originally 5)
      const topAfterSecondRemoval = await stackPage.getTopText();
      expect(topAfterSecondRemoval).toBe('5');

      // Assert no console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S2_ItemPopped (PopEvent) validations and edge cases', () => {
    test('Pop removes top item and updates DOM count & visuals', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      await page.waitForTimeout(1200);

      const beforeCount = await stackPage.getItemsCount();
      expect(beforeCount).toBe(5);

      // Identify top value
      const topVal = await stackPage.getTopText();
      expect(topVal).toBe('5');

      // Click pop and assert immediate visual changes: transform to -100px and opacity 0
      await stackPage.pop();

      // Allow synchronous style change to propagate
      await page.waitForTimeout(30);

      const topTransformAfterClick = await stackPage.getItemInlineStyleProperty(0, 'transform');
      const topOpacityAfterClick = await stackPage.getItemInlineStyleProperty(0, 'opacity');

      expect(topTransformAfterClick).toContain('-100');
      expect(topOpacityAfterClick).toBe('0');

      // Wait until removal completes
      await page.waitForTimeout(350);

      const afterCount = await stackPage.getItemsCount();
      expect(afterCount).toBe(beforeCount - 1);

      // New top should be '4'
      const newTop = await stackPage.getTopText();
      expect(newTop).toBe('4');

      // Assert no console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Popping when stack is empty is a no-op (edge case currentItems <= 0)', async ({ page }) => {
      const stackPage = new StackPage(page);
      await stackPage.goto();

      await page.waitForTimeout(1200);

      // Empty the stack by popping until no items remain
      let count = await stackPage.getItemsCount();
      while (count > 0) {
        await stackPage.pop();
        // Wait for each pop's removal to finish
        await page.waitForTimeout(350);
        count = await stackPage.getItemsCount();
      }

      expect(count).toBe(0);

      // Now attempt one additional pop - should be ignored and leave count at 0
      await stackPage.pop();
      // Wait a small time for any asynchronous action if it were to run
      await page.waitForTimeout(200);

      const finalCount = await stackPage.getItemsCount();
      expect(finalCount).toBe(0);

      // Assert no DOM negative issues and no console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation (must not modify runtime)', () => {
    test('Observe console and page errors while loading and interacting', async ({ page }) => {
      const stackPage = new StackPage(page);

      // Attach listeners again locally to capture for this test
      const localConsoleErrors = [];
      const localPageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') localConsoleErrors.push(msg.text());
      });
      page.on('pageerror', err => localPageErrors.push(err));

      await stackPage.goto();

      // Perform a few interactions to trigger possible runtime paths
      await page.waitForTimeout(1200);
      await stackPage.push();
      await page.waitForTimeout(200);
      await stackPage.pop();
      await page.waitForTimeout(350);

      // We do not alter the page; we only observe. Assert that no ReferenceError/SyntaxError/TypeError occurred.
      // If such errors exist, the arrays would be non-empty; fail the test to highlight runtime issues.
      expect(localConsoleErrors.length).toBe(0);
      expect(localPageErrors.length).toBe(0);
    });
  });
});