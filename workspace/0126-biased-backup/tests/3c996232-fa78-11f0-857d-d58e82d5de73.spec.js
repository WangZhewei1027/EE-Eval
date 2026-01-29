import { test, expect } from '@playwright/test';

// URL where the HTML is served
const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c996232-fa78-11f0-857d-d58e82d5de73.html';

// Page object encapsulating interactions and queries for the Paging app
class PagingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sliderSelector = '#pageSlider';
    this.prevSelector = '#prevBtn';
    this.nextSelector = '#nextBtn';
    this.pageSelector = `${this.sliderSelector} > article.page`;
  }

  // Click next button
  async clickNext() {
    await this.page.click(this.nextSelector);
  }

  // Click previous button
  async clickPrev() {
    await this.page.click(this.prevSelector);
  }

  // Returns boolean whether next button is disabled
  async isNextDisabled() {
    return this.page.$eval(this.nextSelector, (el) => el.disabled);
  }

  // Returns boolean whether prev button is disabled
  async isPrevDisabled() {
    return this.page.$eval(this.prevSelector, (el) => el.disabled);
  }

  // Returns the transform string applied to the slider (style attribute)
  async sliderTransform() {
    return this.page.$eval(this.sliderSelector, (el) => el.style.transform || '');
  }

  // Returns number of pages
  async pagesCount() {
    return this.page.$$eval(this.pageSelector, (els) => els.length);
  }

  // Returns index of the active page (the one with aria-hidden="false")
  async activeIndex() {
    return this.page.$$eval(this.pageSelector, (els) => {
      for (let i = 0; i < els.length; i++) {
        if (els[i].getAttribute('aria-hidden') === 'false' || els[i].classList.contains('active')) {
          return i;
        }
      }
      return -1;
    });
  }

  // Returns whether a specific page index has the 'active' class
  async isPageActive(index) {
    const selector = `${this.pageSelector}:nth-child(${index + 1})`;
    return this.page.$eval(selector, (el) => el.classList.contains('active'));
  }

  // Returns aria-hidden attribute for a specific page index
  async pageAriaHidden(index) {
    const selector = `${this.pageSelector}:nth-child(${index + 1})`;
    return this.page.$eval(selector, (el) => el.getAttribute('aria-hidden'));
  }

  // Wait until the expected page index becomes active (aria-hidden="false" and class contains 'active')
  async waitForActiveIndex(expectedIndex, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, idx) => {
        const els = Array.from(document.querySelectorAll(sel));
        if (!els[idx]) return false;
        return els[idx].getAttribute('aria-hidden') === 'false' && els[idx].classList.contains('active');
      },
      this.pageSelector,
      expectedIndex,
      { timeout }
    );
  }

  // Helper: get aria-label for a page index
  async pageAriaLabel(index) {
    const selector = `${this.pageSelector}:nth-child(${index + 1})`;
    return this.page.$eval(selector, (el) => el.getAttribute('aria-label'));
  }
}

test.describe('Paging Concept — A Visual Journey (FSM tests)', () => {
  // We'll collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  // Attach console and pageerror listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Load the application page
    await page.goto(BASE_URL);
  });

  // Teardown - make sure listeners do not leak (Playwright removes them automatically between tests,
  // but we still reset our arrays)
  test.afterEach(async () => {
    consoleMessages = [];
    pageErrors = [];
  });

  test('Initial state: Page 1 is active and buttons are correctly enabled/disabled', async ({ page }) => {
    // This test validates the FSM entry action for S0_Page1 (updatePages(0)), the initial DOM state,
    // and controls' enabled/disabled state at the lower bound.
    const app = new PagingPage(page);

    // Expect 5 pages
    const count = await app.pagesCount();
    expect(count).toBe(5);

    // Active index should be 0 (Page 1)
    const idx = await app.activeIndex();
    expect(idx).toBe(0);

    // Verify the first page has aria-hidden="false" and class 'active'
    expect(await app.pageAriaHidden(0)).toBe('false');
    expect(await app.isPageActive(0)).toBe(true);

    // Prev should be disabled at the start, Next should be enabled
    expect(await app.isPrevDisabled()).toBe(true);
    expect(await app.isNextDisabled()).toBe(false);

    // Slider transform should indicate rotateY(0deg) and translateX(0%)
    const transform = await app.sliderTransform();
    expect(transform).toContain('rotateY(0deg)');
    expect(transform).toContain('translateX(0%)');

    // Ensure no uncaught page errors were emitted during load
    expect(pageErrors).toHaveLength(0);

    // Ensure there are console messages captured (array exists). We assert that there are no console-level 'error' messages.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Navigate forward through all pages using Next button (S0 -> S4)', async ({ page }) => {
    // This test walks the FSM transitions using the Next event and verifies
    // that each target state becomes active and that the slider transform matches the expected rotation/translation
    const app = new PagingPage(page);

    // Iterate through pages 1 -> 5 by clicking Next; validate each transition
    for (let expected = 1; expected <= 4; expected++) {
      await app.clickNext();

      // Wait until that page becomes active (ensures updatePages entry_action effects are applied)
      await app.waitForActiveIndex(expected);

      // Validate active index
      const active = await app.activeIndex();
      expect(active).toBe(expected);

      // Verify aria-hidden and active class
      expect(await app.pageAriaHidden(expected)).toBe('false');
      expect(await app.isPageActive(expected)).toBe(true);

      // Buttons: prev should be enabled after moving forward; next disabled only on last
      if (expected === 4) {
        expect(await app.isNextDisabled()).toBe(true);
      } else {
        expect(await app.isNextDisabled()).toBe(false);
      }
      expect(await app.isPrevDisabled()).toBe(false);

      // Slider transform should reflect -current*12deg and translateX(-6% * current)
      const transform = await app.sliderTransform();

      const expectedRotate = `rotateY(${-expected * 12}deg)`;
      const expectedTranslateX = `translateX(${expected * -6}%)`;
      expect(transform).toContain(expectedRotate);
      expect(transform).toContain(expectedTranslateX);
    }

    // After reaching last page (Page 5), assert that the content's aria-label matches expected
    expect(await app.pageAriaLabel(4)).toBe('Page 5');

    // Ensure no uncaught page errors were emitted while navigating
    expect(pageErrors).toHaveLength(0);

    // Also check that console didn't log any 'error' typed messages during transitions
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Navigate backward through all pages using Previous button (S4 -> S0)', async ({ page }) => {
    // This test first goes to the last page then walks back using Previous and validates each transition.
    const app = new PagingPage(page);

    // Move to last page first
    for (let i = 0; i < 4; i++) {
      await app.clickNext();
    }
    await app.waitForActiveIndex(4);
    expect(await app.activeIndex()).toBe(4);
    expect(await app.isNextDisabled()).toBe(true);

    // Now step back to Page 1
    for (let expected = 3; expected >= 0; expected--) {
      await app.clickPrev();

      // Wait for the expected page to become active
      await app.waitForActiveIndex(expected);

      // Validate active index and aria-hidden/state
      const active = await app.activeIndex();
      expect(active).toBe(expected);
      expect(await app.pageAriaHidden(expected)).toBe('false');
      expect(await app.isPageActive(expected)).toBe(true);

      // Buttons edge checks
      if (expected === 0) {
        expect(await app.isPrevDisabled()).toBe(true);
      } else {
        expect(await app.isPrevDisabled()).toBe(false);
      }
      expect(await app.isNextDisabled()).toBe(false);

      // Check slider transform matches expected values
      const transform = await app.sliderTransform();
      const expectedRotate = `rotateY(${-expected * 12}deg)`;
      const expectedTranslateX = `translateX(${expected * -6}%)`;
      expect(transform).toContain(expectedRotate);
      expect(transform).toContain(expectedTranslateX);
    }

    // Final verification: back at Page 1
    expect(await app.activeIndex()).toBe(0);

    // No runtime page errors expected
    expect(pageErrors).toHaveLength(0);
  });

  test('Edge case: Clicking Next on the last page should be a no-op and not throw', async ({ page }) => {
    // This test ensures that clicking the Next button when on the last page does nothing,
    // both visually and without emitting page errors.
    const app = new PagingPage(page);

    // Navigate to the last page
    for (let i = 0; i < 4; i++) {
      await app.clickNext();
    }
    await app.waitForActiveIndex(4);
    expect(await app.activeIndex()).toBe(4);
    expect(await app.isNextDisabled()).toBe(true);

    // Record state before clicking disabled Next
    const beforeTransform = await app.sliderTransform();
    const beforeActive = await app.activeIndex();

    // Click Next (should be a no-op)
    await app.clickNext();

    // Small wait to ensure any potential side effects would surface
    await page.waitForTimeout(200);

    // After clicking, state should remain unchanged
    const afterTransform = await app.sliderTransform();
    const afterActive = await app.activeIndex();
    expect(afterActive).toBe(beforeActive);
    expect(afterTransform).toBe(beforeTransform);

    // No page errors are expected
    expect(pageErrors).toHaveLength(0);

    // Ensure no console.error messages were logged
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Clicking Previous on the first page should be a no-op and not throw', async ({ page }) => {
    // This test ensures clicking Previous on the first page does nothing.
    const app = new PagingPage(page);

    // Ensure starting at first page
    await app.waitForActiveIndex(0);
    expect(await app.activeIndex()).toBe(0);
    expect(await app.isPrevDisabled()).toBe(true);

    // Capture state
    const beforeTransform = await app.sliderTransform();
    const beforeActive = await app.activeIndex();

    // Click Prev (should be a no-op)
    await app.clickPrev();
    await page.waitForTimeout(200);

    // State unchanged
    const afterTransform = await app.sliderTransform();
    const afterActive = await app.activeIndex();
    expect(afterActive).toBe(beforeActive);
    expect(afterTransform).toBe(beforeTransform);

    // No runtime errors expected
    expect(pageErrors).toHaveLength(0);
  });

  test('Validate that page content aria-labels and footers match FSM states', async ({ page }) => {
    // This test iterates through pages, navigates to each, and validates the evidence elements
    // described in the FSM (aria-labels and footer text presence).
    const app = new PagingPage(page);

    const labels = [
      'Page 1',
      'Page 2',
      'Page 3',
      'Page 4',
      'Page 5'
    ];

    for (let target = 0; target < labels.length; target++) {
      // Move to the desired page by clicking Next or Prev as needed
      let current = await app.activeIndex();
      while (current < target) {
        await app.clickNext();
        current = await app.activeIndex();
        // Wait briefly for state change
        await app.waitForActiveIndex(current);
      }
      while (current > target) {
        await app.clickPrev();
        current = await app.activeIndex();
        await app.waitForActiveIndex(current);
      }

      // Verify the aria-label of the active page matches the expected label
      const ariaLabel = await app.pageAriaLabel(target);
      expect(ariaLabel).toBe(labels[target]);

      // Verify the footer text (PAGE n / 5) is present inside the active article
      const footerSelector = `${app.pageSelector}:nth-child(${target + 1}) footer.footer`;
      const footerText = await page.$eval(footerSelector, (el) => el.textContent.trim());
      expect(footerText).toBe(`PAGE ${target + 1} / 5`);
    }

    // No runtime errors expected during these verifications
    expect(pageErrors).toHaveLength(0);
  });

  test('Monitor console output while performing interactions (no console.error expected)', async ({ page }) => {
    // This test explicitly inspects console messages collected during interaction and asserts there are no console-level errors.
    const app = new PagingPage(page);

    // Perform a few interactions
    await app.clickNext();
    await app.clickNext();
    await app.clickPrev();
    await app.clickNext();
    await page.waitForTimeout(250);

    // We don't require any specific console messages to be present, but there should be none of type 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Make sure consoleMessages is an array and was populated (it may be empty on some environments),
    // but the important assertion is absence of console errors.
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Ensure no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);
  });
});