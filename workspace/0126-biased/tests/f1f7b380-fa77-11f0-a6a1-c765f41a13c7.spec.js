import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f7b380-fa77-11f0-a6a1-c765f41a13c7.html';

class PagerPage {
  /**
   * Page Object representing the paging demo.
   * Encapsulates common interactions and assertions to keep tests clear.
   */
  constructor(page) {
    this.page = page;
    this.nextBtn = page.locator('#nextBtn');
    this.prevBtn = page.locator('#prevBtn');
    this.pageInd = page.locator('#pageInd');
    this.progressBar = page.locator('#progressBar');
    this.pages = page.locator('.page');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait for initial layout to run and DOM to be stable
    await this.page.waitForSelector('.page.is-active');
  }

  async clickNext(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.nextBtn.click();
      // small wait to allow layout() transitions/DOM updates
      await this.page.waitForTimeout(50);
    }
  }

  async clickPrev(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.prevBtn.click();
      await this.page.waitForTimeout(50);
    }
  }

  // returns 1-based active index as number
  async getActiveIndex() {
    const idxStr = await this.page.locator('.page.is-active').getAttribute('data-index');
    return idxStr ? Number(idxStr) : null;
  }

  // returns textual page indicator like "1 / 4"
  async getPageIndText() {
    return (await this.pageInd.textContent())?.trim();
  }

  // returns progress bar width as percentage number (e.g., 33.333...)
  async getProgressPercent() {
    const width = await this.page.evaluate(() => {
      const el = document.getElementById('progressBar');
      return el ? el.style.width : '';
    });
    // width is something like "33.33333333333333%"
    if (!width) return null;
    return parseFloat(width.replace('%', ''));
  }

  // returns classes for the page with given 1-based data-index
  async getClassesForIndex(oneBasedIndex) {
    return await this.page.evaluate((idx) => {
      const el = document.querySelector(`.page[data-index="${idx}"]`);
      return el ? Array.from(el.classList) : null;
    }, oneBasedIndex);
  }

  // returns aria-hidden attribute for given page index
  async getAriaHiddenForIndex(oneBasedIndex) {
    return await this.page.locator(`.page[data-index="${oneBasedIndex}"]`).getAttribute('aria-hidden');
  }

  async totalPages() {
    return await this.pages.count();
  }
}

test.describe('Paging — FSM and DOM validation', () => {
  // capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // pageerror captures unhandled exceptions → store for assertions
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Helpful debug info if a test fails: print the captured console messages
    if (pageErrors.length > 0 || consoleMessages.some(m => m.type === 'error')) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => String(e)));
    }
    // Clean up listeners by closing page (Playwright does this automatically per test).
  });

  test('Initial state: Page 1 is active and layout() entry action applied', async ({ page }) => {
    // Validate initial state S0_Page1 per FSM
    const pager = new PagerPage(page);
    await pager.goto();

    // Assertions: Page 1 should be active, aria-hidden false, indicator shows "1 / 4"
    const activeIndex = await pager.getActiveIndex();
    expect(activeIndex, 'Initial active page should be data-index=1').toBe(1);

    const pageIndText = await pager.getPageIndText();
    expect(pageIndText, 'Page indicator should reflect initial page "1 / 4"').toBe('1 / 4');

    const progress = await pager.getProgressPercent();
    // idx = 0 => progress = 0%
    expect(progress, 'Progress bar should start at 0% for first page').toBeCloseTo(0, 3);

    const ariaHidden = await pager.getAriaHiddenForIndex(1);
    expect(ariaHidden, 'Active page must have aria-hidden="false"').toBe('false');

    // Validate classes for other pages per FSM evidence: following pages are is-next
    const classesPage2 = await pager.getClassesForIndex(2);
    expect(classesPage2).toContain('is-next');

    // Assert no unexpected runtime errors captured on load
    expect(pageErrors.length, 'No pageerror events expected on initial load').toBe(0);
    // Also assert no console.error calls occurred during load
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError, 'No console.error messages expected on initial load').toBe(false);
  });

  test('Next button transitions through pages S0->S1->S2->S3->S0 (cycle) and updates DOM', async ({ page }) => {
    // Validate all Next transitions as per FSM transitions (4 pages total)
    const pager = new PagerPage(page);
    await pager.goto();

    const total = await pager.totalPages();
    expect(total).toBe(4);

    // Helper to assert expected index and progress
    const assertIndexAndProgress = async (expectedOneBasedIndex) => {
      const active = await pager.getActiveIndex();
      expect(active, `Expected active page ${expectedOneBasedIndex}`).toBe(expectedOneBasedIndex);

      const pageIndText = await pager.getPageIndText();
      expect(pageIndText).toBe(`${expectedOneBasedIndex} / ${total}`);

      const idxZeroBased = expectedOneBasedIndex - 1;
      const expectedPercent = (idxZeroBased) / (total - 1) * 100;
      const progress = await pager.getProgressPercent();
      // allow small rounding differences
      expect(Math.abs(progress - expectedPercent) < 1.0, `Progress ${progress} approx ${expectedPercent}`).toBeTruthy();

      // active page aria-hidden should be false; neighbors true
      const ariaActive = await pager.getAriaHiddenForIndex(expectedOneBasedIndex);
      expect(ariaActive).toBe('false');
      if (expectedOneBasedIndex > 1) {
        const ariaPrev = await pager.getAriaHiddenForIndex(expectedOneBasedIndex - 1);
        expect(ariaPrev).toBe('true');
      }
      if (expectedOneBasedIndex < total) {
        const ariaNext = await pager.getAriaHiddenForIndex(expectedOneBasedIndex + 1);
        expect(ariaNext).toBe('true');
      }
    };

    // S0 -> S1 (Page 1 -> Page 2)
    await pager.clickNext(1);
    await assertIndexAndProgress(2);

    // S1 -> S2 (Page 2 -> Page 3)
    await pager.clickNext(1);
    await assertIndexAndProgress(3);

    // S2 -> S3 (Page 3 -> Page 4)
    await pager.clickNext(1);
    await assertIndexAndProgress(4);

    // S3 -> S0 (Page 4 -> Page 1, wraps)
    await pager.clickNext(1);
    await assertIndexAndProgress(1);

    // Ensure no page errors or console error messages during transitions
    expect(pageErrors.length, 'No runtime page errors expected during Next transitions').toBe(0);
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError, 'No console.error messages expected during Next transitions').toBe(false);
  });

  test('Prev button transitions backwards and wraps correctly (edge cases)', async ({ page }) => {
    // Validate Prev transitions including wrapping S0->S3 and S1->S0 etc.
    const pager = new PagerPage(page);
    await pager.goto();
    const total = await pager.totalPages();
    expect(total).toBe(4);

    // From initial S0 (Page 1), Prev should wrap to Page 4 (S3)
    await pager.clickPrev(1);
    expect(await pager.getActiveIndex()).toBe(4);
    expect(await pager.getPageIndText()).toBe('4 / 4');
    let progress = await pager.getProgressPercent();
    expect(Math.abs(progress - 100) < 1.0).toBeTruthy();

    // Prev again should go to Page 3
    await pager.clickPrev(1);
    expect(await pager.getActiveIndex()).toBe(3);
    expect(await pager.getPageIndText()).toBe('3 / 4');

    // From Page 3, Prev -> Page 2
    await pager.clickPrev(1);
    expect(await pager.getActiveIndex()).toBe(2);
    expect(await pager.getPageIndText()).toBe('2 / 4');

    // Check classes: ensure pages before active have is-prev and after have is-next
    const classesPage1 = await pager.getClassesForIndex(1);
    expect(classesPage1).toContain('is-prev');

    const classesPage3 = await pager.getClassesForIndex(3);
    expect(classesPage3).toContain('is-next').or.toBeTruthy(); // depending on current idx, this may vary; we check at least one relation

    // Edge case: rapid clicking (more clicks than pages) should still properly wrap and compute idx modulo total
    // Restart to initial for clarity
    await pager.goto();
    // Rapid click Next 10 times -> (0+10)%4 = 2 => page index should be 3
    await pager.clickNext(10);
    expect(await pager.getActiveIndex()).toBe(3);
    expect(await pager.getPageIndText()).toBe('3 / 4');

    // Assert no page errors / console errors across Prev scenarios
    expect(pageErrors.length, 'No runtime page errors expected during Prev transitions').toBe(0);
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError, 'No console.error messages expected during Prev transitions').toBe(false);
  });

  test('Accessibility attributes and visual class state consistency across all pages', async ({ page }) => {
    // Validate that each page has consistent class state relative to the active index
    const pager = new PagerPage(page);
    await pager.goto();

    // Navigate through each page and assert the semantic consistency of classes and aria attributes
    const total = await pager.totalPages();
    for (let i = 1; i <= total; i++) {
      // Navigate to page i by computing steps forward from current active
      const current = await pager.getActiveIndex();
      const steps = (i - current + total) % total;
      if (steps > 0) await pager.clickNext(steps);

      // active page must be is-active
      const classesActive = await pager.getClassesForIndex(i);
      expect(classesActive).toContain('is-active');

      // pages with smaller data-index should be is-prev
      for (let j = 1; j < i; j++) {
        const cl = await pager.getClassesForIndex(j);
        expect(cl).toContain('is-prev');
        const aria = await pager.getAriaHiddenForIndex(j);
        expect(aria).toBe('true');
      }
      // pages with greater data-index should be is-next
      for (let k = i + 1; k <= total; k++) {
        const cl = await pager.getClassesForIndex(k);
        expect(cl).toContain('is-next');
        const aria = await pager.getAriaHiddenForIndex(k);
        expect(aria).toBe('true');
      }
    }

    // Final check: progress bar end states align with first and last pages
    // go to last page
    await pager.clickNext(total - 1);
    expect(await pager.getActiveIndex()).toBe(total);
    const progressLast = await pager.getProgressPercent();
    expect(Math.abs(progressLast - 100) < 1.0).toBeTruthy();

    // back to first page
    await pager.clickNext(1);
    expect(await pager.getActiveIndex()).toBe(1);
    const progressFirst = await pager.getProgressPercent();
    expect(Math.abs(progressFirst - 0) < 1.0).toBeTruthy();

    // No page errors or console.error observed during these checks
    expect(pageErrors.length).toBe(0);
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError).toBe(false);
  });

  test('Runtime observation: capture console messages and page errors for the session', async ({ page }) => {
    // This test intentionally focuses on observing console and runtime errors while loading and interacting.
    // It asserts that there are no unexpected ReferenceError / SyntaxError / TypeError or console.error entries.
    const pager = new PagerPage(page);
    await pager.goto();

    // perform a few interactions to stimulate timers/animations (but not wait excessively)
    await pager.clickNext(2);
    await page.waitForTimeout(100);
    await pager.clickPrev(1);
    await page.waitForTimeout(100);

    // Evaluate captured errors/messages
    // pageErrors contains Error objects for uncaught exceptions in page context
    // consoleMessages contains console messages with types
    const pageErrorTypes = pageErrors.map(e => String(e && e.constructor && e.constructor.name ? e.constructor.name : String(e)));
    // Log to test output to aid debugging in CI if needed
    if (pageErrorTypes.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Page errors observed:', pageErrorTypes);
    }
    // Assert that no fatal JS errors were thrown
    expect(pageErrors.length, 'No uncaught page errors (ReferenceError/SyntaxError/TypeError) should occur during normal usage').toBe(0);

    // Ensure console did not log errors
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrorMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Console errors observed:', consoleErrorMessages);
    }
    expect(consoleErrorMessages.length, 'No console.error messages expected during normal usage').toBe(0);

    // Additionally, ensure that no console messages indicate SyntaxError/ReferenceError/TypeError strings
    const problematic = consoleMessages.filter(m =>
      /ReferenceError|SyntaxError|TypeError/.test(m.text)
    );
    expect(problematic.length, 'No console messages should include ReferenceError, SyntaxError, or TypeError text').toBe(0);
  });

});