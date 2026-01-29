import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aceb83-fa78-11f0-812d-c9788050701f.html';

// Page object model for the Refactoring interactive page
class RefactoringPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtnSelector = '#animateBtn';
    this.conceptSelector = '.refactoring-concept';
    this.arrowSelector = '.arrow';
    this.lineSelector = '.transition-line';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getAnimateButton() {
    return this.page.locator(this.animateBtnSelector);
  }

  async getConcepts() {
    return this.page.locator(this.conceptSelector);
  }

  // Returns number of .refactoring-concept elements
  async countConcepts() {
    return this.page.locator(this.conceptSelector).count();
  }

  // Checks whether a specific concept (by index) has the 'visible' class
  async conceptHasVisibleClass(index) {
    const locator = this.page.locator(this.conceptSelector).nth(index);
    // Evaluate classList on element handle
    return await locator.evaluate(el => el.classList.contains('visible'));
  }

  // Checks whether arrow inside concept has 'visible' class
  async conceptArrowVisible(index) {
    const arrow = this.page.locator(this.conceptSelector).nth(index).locator(this.arrowSelector);
    return await arrow.evaluate((el) => el ? el.classList.contains('visible') : false).catch(() => false);
  }

  // Checks whether transition line inside concept has 'active' class
  async conceptLineActive(index) {
    const line = this.page.locator(this.conceptSelector).nth(index).locator(this.lineSelector);
    return await line.evaluate((el) => el ? el.classList.contains('active') : false).catch(() => false);
  }

  // Click the animate button
  async clickAnimateButton() {
    await this.page.click(this.animateBtnSelector);
  }

  // Wait for all concept elements to have the 'visible' class.
  // The animation timing in the app:
  // - Immediately removes visible on click
  // - After 50ms, staged re-adds at i*300 ms
  // - Each arrow/line becomes visible/active 300ms after its concept becomes visible
  // We'll allow generous timeout to be robust.
  async waitForAllConceptsVisible(timeout = 3000) {
    const count = await this.countConcepts();
    const start = Date.now();
    for (let i = 0; i < count; i++) {
      // Wait until this particular element has visible class or timeout
      await this.page.waitForFunction(
        (sel, idx) => {
          const el = document.querySelectorAll(sel)[idx];
          return el && el.classList.contains('visible');
        },
        [this.conceptSelector, i],
        { timeout: Math.max(500, timeout - (Date.now() - start)) }
      );
      // also wait for arrow and line to become visible/active (they are added asynchronously)
      await this.page.waitForFunction(
        (sel, idx) => {
          const el = document.querySelectorAll(sel)[idx];
          if (!el) return false;
          const arrow = el.querySelector('.arrow');
          const line = el.querySelector('.transition-line');
          return (!arrow || arrow.classList.contains('visible')) && (!line || line.classList.contains('active'));
        },
        [this.conceptSelector, i],
        { timeout: Math.max(500, timeout - (Date.now() - start)) }
      );
    }
  }

  // Wait until all concepts do NOT have 'visible' class (used to assert immediate removal)
  async waitForAllConceptsNotVisible(timeout = 500) {
    const count = await this.countConcepts();
    await this.page.waitForFunction(
      (sel, cnt) => {
        const els = Array.from(document.querySelectorAll(sel)).slice(0, cnt);
        return els.every(e => !e.classList.contains('visible'));
      },
      [this.conceptSelector, count],
      { timeout }
    );
  }
}

test.describe('Refactoring Interactive - FSM validation (Application ID: 72aceb83-fa78-11f0-812d-c9788050701f)', () => {
  // Capture console errors and page errors for each test
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          // store the text to help assertions / debugging
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore any console handler failure
      }
    });

    // Capture uncaught exceptions (pageerror)
    page.on('pageerror', err => {
      try {
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        // ignore
      }
    });
  });

  test.afterEach(async () => {
    // No teardown required beyond clearing arrays; kept for clarity
    consoleErrors = [];
    pageErrors = [];
  });

  test('Initial Idle state (S0_Idle): Animate button exists and page loads without JS runtime errors', async ({ page }) => {
    // This test validates the initial Idle state evidence:
    // - The Animate Refactoring button (#animateBtn) is present on the page.
    // - No immediate runtime errors (ReferenceError/SyntaxError/TypeError) occur on load.
    const refactor = new RefactoringPage(page);
    await refactor.goto();

    // Wait for the button to be present
    const button = await refactor.getAnimateButton();
    await expect(button).toBeVisible({ timeout: 2000 });
    await expect(button).toHaveAttribute('id', 'animateBtn');

    // Ensure at least one refactoring concept exists
    const count = await refactor.countConcepts();
    expect(count).toBeGreaterThanOrEqual(1);

    // Allow a little time for page scripts (IntersectionObserver) to run.
    // We record console and page errors during this startup period.
    await page.waitForTimeout(300);

    // Assert that no uncaught page errors happened during load (we expect none).
    // If there are JS errors injected by the environment, they will be captured here.
    expect(pageErrors, `Expected no page errors on load, saw: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Expected no console.error messages on load, saw: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('AnimateRefactoring event triggers transition to ConceptVisible (S0_Idle -> S1_ConceptVisible)', async ({ page }) => {
    // This test validates the event transition:
    // - Clicking #animateBtn causes all .refactoring-concept elements to become visible
    //   with arrow.visible and transition-line.active applied after animations.
    const refactor = new RefactoringPage(page);
    await refactor.goto();

    // Give the IntersectionObserver a small window to have possibly set initial visibility.
    await page.waitForTimeout(200);

    // Click the animate button to trigger the animation sequence
    await refactor.clickAnimateButton();

    // Immediately after click, elements are removed synchronously in the code.
    // Assert that they are initially not visible.
    // We guard with try/catch to provide helpful messages on failure.
    try {
      await refactor.waitForAllConceptsNotVisible(300);
    } catch (err) {
      // If they weren't removed, fail with clear context.
      throw new Error('Expected concepts to be removed (not visible) immediately after clicking animateBtn, but they were still visible.');
    }

    // Now wait for them to be re-added (staged additions). Use a generous timeout for robustness.
    await refactor.waitForAllConceptsVisible(3000);

    // After transition finishes, verify each concept has expected classes and sub-elements active.
    const count = await refactor.countConcepts();
    for (let i = 0; i < count; i++) {
      const isVisible = await refactor.conceptHasVisibleClass(i);
      expect(isVisible, `Expected concept[${i}] to have class 'visible' after animation`).toBe(true);

      const arrowVisible = await refactor.conceptArrowVisible(i);
      expect(arrowVisible, `Expected arrow inside concept[${i}] to have class 'visible'`).toBe(true);

      const lineActive = await refactor.conceptLineActive(i);
      expect(lineActive, `Expected transition line inside concept[${i}] to have class 'active'`).toBe(true);
    }

    // Confirm no runtime errors were emitted during the animation sequence
    // (if errors did occur, they would have been captured by pageErrors and consoleErrors)
    expect(pageErrors, `Expected no page errors during AnimateRefactoring transition, saw: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Expected no console.error messages during AnimateRefactoring transition, saw: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Self-transition on repeated AnimateRefactoring (S1_ConceptVisible -> S1_ConceptVisible): removes and re-adds classes', async ({ page }) => {
    // This test validates the self-transition when the AnimateRefactoring button is clicked while concepts are visible.
    // It asserts that classes are removed and then re-applied (the app removes visible immediately and re-adds with staged timeouts).
    const refactor = new RefactoringPage(page);
    await refactor.goto();

    // Wait to ensure IntersectionObserver has possibly set initial visibility
    await page.waitForTimeout(200);

    // Ensure concepts are visible to simulate S1 initial condition; if not visible, trigger a click first to bring them visible
    const count = await refactor.countConcepts();
    let allVisibleInitially = true;
    for (let i = 0; i < count; i++) {
      if (!(await refactor.conceptHasVisibleClass(i))) {
        allVisibleInitially = false;
        break;
      }
    }
    if (!allVisibleInitially) {
      await refactor.clickAnimateButton();
      await refactor.waitForAllConceptsVisible(3000);
    }

    // Now concepts are visible (S1). Click again to trigger the self-transition logic.
    await refactor.clickAnimateButton();

    // Immediately after click, expect that visible classes are removed
    await refactor.waitForAllConceptsNotVisible(500);

    // Then wait for them to be re-added
    await refactor.waitForAllConceptsVisible(3000);

    // Verify final state: all concepts visible with arrows and lines active
    for (let i = 0; i < count; i++) {
      expect(await refactor.conceptHasVisibleClass(i)).toBe(true);
      expect(await refactor.conceptArrowVisible(i)).toBe(true);
      expect(await refactor.conceptLineActive(i)).toBe(true);
    }

    // Check for runtime errors again
    expect(pageErrors, `Expected no page errors during repeated AnimateRefactoring, saw: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Expected no console.error messages during repeated AnimateRefactoring, saw: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Edge case: Rapid repeated clicks should converge to visible state and not throw uncaught errors', async ({ page }) => {
    // This test simulates rapid user interactions: multiple quick clicks on the animate button.
    // It ensures the UI still ends in the intended "visible" state and no runtime errors are produced.
    const refactor = new RefactoringPage(page);
    await refactor.goto();

    // Rapidly click the button several times
    const clicks = 6;
    for (let i = 0; i < clicks; i++) {
      await refactor.clickAnimateButton();
      // minimal delay between clicks to simulate frantic user
      await page.waitForTimeout(30);
    }

    // Wait for the final animation to settle (generous timeout)
    await refactor.waitForAllConceptsVisible(4000);

    // Assert final state
    const count = await refactor.countConcepts();
    for (let i = 0; i < count; i++) {
      expect(await refactor.conceptHasVisibleClass(i)).toBe(true);
      expect(await refactor.conceptArrowVisible(i)).toBe(true);
      expect(await refactor.conceptLineActive(i)).toBe(true);
    }

    // Validate no uncaught errors were emitted
    // Note: We specifically look for ReferenceError, SyntaxError, TypeError in pageErrors and consoleErrors.
    // If any errors exist, include them in the assertion message to aid debugging.
    const combinedErrors = [...pageErrors, ...consoleErrors];
    const errorKeywords = ['ReferenceError', 'SyntaxError', 'TypeError'];
    const foundCriticalErrors = combinedErrors.filter(e => errorKeywords.some(k => e.includes(k)));
    expect(foundCriticalErrors, `Expected no ReferenceError/SyntaxError/TypeError from rapid clicks, saw: ${foundCriticalErrors.join(' | ')}`).toHaveLength(0);

    // Also assert no general page errors or console.errors
    expect(pageErrors, `Expected no page errors after rapid clicks, saw: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Expected no console.error messages after rapid clicks, saw: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Observability: Validate that arrows and transition-lines toggle correctly during animation', async ({ page }) => {
    // This test inspects the intermediate toggling of arrow.visible and transition-line.active classes
    // after the concept element becomes visible. We click the button and sample at times to ensure toggles occur.
    const refactor = new RefactoringPage(page);
    await refactor.goto();

    // Ensure we start from a known baseline: remove any initial visibility by clicking once (if needed)
    await refactor.clickAnimateButton();
    await refactor.waitForAllConceptsNotVisible(500);

    // Start animation and sample the state in-between to assert intermediate transitions
    await refactor.clickAnimateButton();

    // After 50ms, the staged re-adds begin — the first element should be scheduled soon.
    await page.waitForTimeout(120); // sample sometime after the first concept may have been made visible

    const count = await refactor.countConcepts();
    // For the first concept (index 0), arrow/line should become visible/active shortly after it becomes visible.
    // We'll check that if the concept is visible, arrow and line either already activated or will be shortly.
    // This is tolerant to timing variability but asserts the general expected behavior.
    if (await refactor.conceptHasVisibleClass(0)) {
      // Arrow/line should either be active or quickly become active (we wait a bit)
      const arrowActive = await refactor.conceptArrowVisible(0);
      const lineActive = await refactor.conceptLineActive(0);
      if (!arrowActive || !lineActive) {
        // Wait a bit more for arrow/line to be activated
        await page.waitForTimeout(300);
      }
      expect(await refactor.conceptArrowVisible(0)).toBe(true);
      expect(await refactor.conceptLineActive(0)).toBe(true);
    } else {
      // If the first concept still isn't visible due to timing, wait for full completion and check
      await refactor.waitForAllConceptsVisible(3000);
      for (let i = 0; i < count; i++) {
        expect(await refactor.conceptArrowVisible(i)).toBe(true);
        expect(await refactor.conceptLineActive(i)).toBe(true);
      }
    }

    // Ensure no runtime errors during this observability test
    expect(pageErrors, `Expected no page errors during observability test, saw: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Expected no console.error messages during observability test, saw: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });
});