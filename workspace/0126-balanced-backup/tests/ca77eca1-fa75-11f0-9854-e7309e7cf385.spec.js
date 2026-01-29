import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca77eca1-fa75-11f0-9854-e7309e7cf385.html';

class BucketSortPage {
  /**
   * Page object for the Bucket Sort demo
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sortButtonSelector = "button[onclick='sortBuckets()']";
    this.bucketSelector = '.bucket';
  }

  async goto() {
    // Navigate to the provided HTML page
    await this.page.goto(APP_URL);
  }

  async getBucketElements() {
    return await this.page.$$(this.bucketSelector);
  }

  async getBucketCount() {
    return await this.page.$$eval(this.bucketSelector, els => els.length);
  }

  async getBucketComputedStyle() {
    return await this.page.$eval(this.bucketSelector, el => {
      const cs = window.getComputedStyle(el);
      return {
        width: cs.width,
        height: cs.height,
        backgroundColor: cs.backgroundColor,
        borderRadius: cs.borderRadius,
      };
    });
  }

  async getSortButton() {
    return await this.page.$(this.sortButtonSelector);
  }

  async getSortButtonText() {
    return await this.page.$eval(this.sortButtonSelector, btn => btn.textContent.trim());
  }

  async clickSortButton() {
    await this.page.click(this.sortButtonSelector);
  }

  // Helper to determine whether a global function exists on the page
  async typeofOnWindow(name) {
    return await this.page.evaluate(n => typeof window[n], name);
  }
}

test.describe('Bucket Sort FSM - Interactive Application (ca77eca1-fa75-11f0-9854-e7309e7cf385)', () => {
  // Basic smoke tests for the Idle state (S0_Idle)
  test.describe('Idle State (S0_Idle) - initial page render checks', () => {
    test('Idle: page loads and renders expected components (bucket and Sort Buckets button)', async ({ page }) => {
      const app = new BucketSortPage(page);
      await app.goto();

      // Verify the Sort Buckets button exists and has the expected inline onclick attribute target
      const button = await app.getSortButton();
      expect(button).not.toBeNull();
      const btnText = await app.getSortButtonText();
      expect(btnText).toBe('Sort Buckets');

      // Verify at least one .bucket element is present (visual component evidence in FSM)
      const bucketCount = await app.getBucketCount();
      expect(bucketCount).toBeGreaterThanOrEqual(1);

      // Verify the visual styling of the bucket matches the CSS included in the page
      const style = await app.getBucketComputedStyle();
      // Styles are defined in CSS: width: 50px; height: 50px; background-color: red; border-radius: 50%;
      expect(style.width).toMatch(/50px/);
      expect(style.height).toMatch(/50px/);
      // backgroundColor may be reported as rgb(...) depending on the engine
      expect(style.backgroundColor).toMatch(/rgb|red/);
      expect(style.borderRadius).toMatch(/50%|25px/); // some engines resolve to px equivalent

      // FSM mentions an on-enter action renderPage(). Verify that this function is NOT defined
      // (we assert the actual runtime behavior rather than attempting to patch the page)
      const renderPageType = await app.typeofOnWindow('renderPage');
      expect(renderPageType).toBe('undefined');
    });
  });

  // Tests covering Sorting state (S1_Sorting) and the SortBuckets_Click transition
  test.describe('Sorting State (S1_Sorting) and transitions', () => {
    test('Transition: clicking Sort Buckets triggers sortBuckets and results in a runtime TypeError as implemented', async ({ page }) => {
      const app = new BucketSortPage(page);
      await app.goto();

      // Confirm that sortBuckets function is defined on the window (entry action for S1_Sorting)
      const sortType = await app.typeofOnWindow('sortBuckets');
      expect(sortType).toBe('function');

      // Ensure no pageerror has occurred yet
      let pageErrorDuringLoad = null;
      const loadListener = (err) => { pageErrorDuringLoad = err; };
      page.on('pageerror', loadListener);

      // small pause to ensure any load-time errors would surface
      await page.waitForTimeout(100);
      // Remove load listener now
      page.off('pageerror', loadListener);

      expect(pageErrorDuringLoad).toBeNull();

      // Clicking the button should execute sortBuckets(). The JS implementation has runtime issues
      // (e.g., querying '.item' returns null and uses .style -> TypeError). We monitor pageerror.
      const pageErrorPromise = page.waitForEvent('pageerror');

      // Trigger the transition by clicking the UI button
      await app.clickSortButton();

      // Await the uncaught exception event fired by the page
      const error = await pageErrorPromise;

      // Validate that an error was captured and looks like the expected TypeError due to null.style
      expect(error).toBeDefined();
      // Different Chromium/Renderer versions may report slightly different messages. Check key tokens.
      expect(error.message).toMatch(/(Cannot read properties of null|Cannot read property 'style'|reading 'style')/i);
      expect(error.name).toMatch(/TypeError/i);

      // After the runtime error, the DOM should remain stable: the original bucket should still exist
      const bucketCountAfter = await app.getBucketCount();
      expect(bucketCountAfter).toBeGreaterThanOrEqual(1);

      // Also verify that the bucket's visual style is unchanged (still rendered)
      const styleAfter = await app.getBucketComputedStyle();
      expect(styleAfter.backgroundColor).toMatch(/rgb|red/);
    });

    test('Edge case: invoking sortBuckets via page.evaluate results in a rejected promise with the runtime error', async ({ page }) => {
      const app = new BucketSortPage(page);
      await app.goto();

      // Call the function directly from the test context. The function throws, which will make
      // the page.evaluate promise reject. We assert that it rejects and includes expected tokens.
      await expect(page.evaluate(() => {
        // Do not catch inside page context; let the runtime error be thrown so the promise rejects
        // (this mirrors the natural uncaught exception when invoked from page script)
        return sortBuckets();
      })).rejects.toThrow(/(Cannot read properties of null|Cannot read property 'style'|reading 'style')/i);
    });

    test('Robustness: multiple clicks produce multiple uncaught page errors (repeated transition attempts)', async ({ page }) => {
      const app = new BucketSortPage(page);
      await app.goto();

      // Ensure function exists
      const sortType = await app.typeofOnWindow('sortBuckets');
      expect(sortType).toBe('function');

      // Capture pageerror events into an array so we can assert multiple errors occur
      const errors = [];
      const listener = (err) => errors.push(err);
      page.on('pageerror', listener);

      // Trigger the click twice, awaiting the corresponding pageerror for each invocation sequentially
      // We do sequential waits to ensure deterministic pairing of click -> pageerror
      const p1 = page.waitForEvent('pageerror');
      await app.clickSortButton();
      const e1 = await p1;
      expect(e1).toBeDefined();

      const p2 = page.waitForEvent('pageerror');
      await app.clickSortButton();
      const e2 = await p2;
      expect(e2).toBeDefined();

      // Unregister listener and perform assertions on captured errors
      page.off('pageerror', listener);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      // Both errors should be TypeError related to reading 'style' of null
      for (const err of errors.slice(0, 2)) {
        expect(err.name).toMatch(/TypeError/i);
        expect(err.message).toMatch(/(Cannot read properties of null|Cannot read property 'style'|reading 'style')/i);
      }
    });
  });

  // Tests that validate FSM evidence and event wiring
  test.describe('FSM evidence and event handler validations', () => {
    test('Evidence: the button uses inline onclick wiring to sortBuckets as described by FSM', async ({ page }) => {
      const app = new BucketSortPage(page);
      await app.goto();

      // The FSM indicates a component selector button[onclick='sortBuckets()']
      // Confirm that the DOM contains an element with that exact attribute string
      const hasInlineOnclick = await page.$eval('body', () => {
        const el = document.querySelector("button[onclick='sortBuckets()']");
        return !!el;
      });
      expect(hasInlineOnclick).toBe(true);
    });

    test('Evidence: .bucket elements exist and are selectable as the visual component', async ({ page }) => {
      const app = new BucketSortPage(page);
      await app.goto();

      // Confirm .bucket is present and is an Element node
      const isBucketElement = await page.$eval('.bucket', el => el instanceof Element);
      expect(isBucketElement).toBe(true);

      // Confirm innerHTML/text content is initially empty (per the given HTML)
      const bucketText = await page.$eval('.bucket', el => el.textContent);
      expect(bucketText.trim()).toBe('');
    });
  });
});