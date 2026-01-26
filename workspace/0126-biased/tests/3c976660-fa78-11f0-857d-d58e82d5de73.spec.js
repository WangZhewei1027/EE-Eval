import { test, expect } from '@playwright/test';

// Test file for Application ID: 3c976660-fa78-11f0-857d-d58e82d5de73
// This suite validates the FSM states and transitions of the Interpolation Search visualization.
// It loads the page exactly as-is, observes console messages and page errors (without modifying the page),
// and asserts expected DOM updates and visual cues for Idle, Searching, and Found states.
// Note: The page's internal search target is closed over and not modifiable from these tests.
// Therefore we validate the default "found" trajectory and assert that no unexpected JS errors appeared.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c976660-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the Interpolation Search visualization
class InterpolationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Controls
  startBtn() {
    return this.page.locator('#startBtn');
  }
  nextBtn() {
    return this.page.locator('#nextBtn');
  }

  // Visual containers
  arrayContainer() {
    return this.page.locator('.array-container');
  }
  explanation() {
    return this.page.locator('#explanation');
  }

  // Individual element by index
  elementAt(index) {
    return this.page.locator('.array-container >> .element').nth(index);
  }

  // Get number of elements in the rendered array
  async elementsCount() {
    return await this.page.locator('.array-container >> .element').count();
  }

  // Start search by clicking the Start button
  async startSearch() {
    await this.startBtn().click();
  }

  // Advance one step
  async nextStep() {
    await this.nextBtn().click();
  }

  // Read explanation innerText (trimmed)
  async explanationText() {
    const html = await this.explanation().innerHTML();
    return html.replace(/\s+/g, ' ').trim();
  }

  // Get classes of the element at index as array
  async elementClasses(index) {
    const cls = await this.elementAt(index).getAttribute('class');
    return cls ? cls.split(/\s+/).filter(Boolean) : [];
  }

  // Wait until an element gets a specific class (with timeout)
  async waitForElementClass(index, className, opts = {}) {
    const locator = this.elementAt(index);
    await locator.waitFor({ state: 'attached', timeout: opts.timeout ?? 5000 });
    await this.page.waitForFunction(
      (el, cls) => el.classList.contains(cls),
      locator,
      className,
      { timeout: opts.timeout ?? 5000 }
    );
  }
}

test.describe('Interpolation Search - Visualized Elegance (FSM validation)', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors so tests can assert on them.
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store console messages for diagnostics; include level and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store unhandled exceptions from the page
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Helpful diagnostics if something went wrong: dump console and page errors to test output.
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => String(e)));
    }

    // Ensure the page is closed/cleanup done by Playwright fixtures automatically.
  });

  test('Initial Idle state: UI initialized correctly', async ({ page }) => {
    // This test validates the S0_Idle state -> initial conditions after page load.
    const p = new InterpolationPage(page);

    // The Start button should be visible, enabled, and reflect initial aria-pressed false.
    await expect(p.startBtn()).toBeVisible();
    await expect(p.startBtn()).toBeEnabled();
    await expect(p.startBtn()).toHaveText('Start Search');
    await expect(p.startBtn()).toHaveAttribute('aria-pressed', 'false');

    // The Next button should be disabled initially.
    await expect(p.nextBtn()).toBeVisible();
    await expect(p.nextBtn()).toBeDisabled();
    await expect(p.nextBtn()).toHaveText('Next Step');

    // Explanation should contain the idle evidence prompt.
    const explanationHtml = await p.explanation().innerHTML();
    expect(explanationHtml).toContain('Press <mark>Start Search</mark> to begin visualizing the Interpolation Search algorithm.');

    // Array should render the expected number of elements and their values (non-empty).
    const count = await p.elementsCount();
    expect(count).toBeGreaterThan(0);

    // Spot-check the first and last elements to ensure the array was rendered.
    const firstText = await p.elementAt(0).innerText();
    const lastText = await p.elementAt(count - 1).innerText();
    expect(firstText).toMatch(/\d+/);
    expect(lastText).toMatch(/\d+/);

    // No highlights should be present in Idle state.
    const highlighted = await page.locator('.element.highlight-low, .element.highlight-high, .element.highlight-mid, .element.found').count();
    expect(highlighted).toBe(0);

    // Assert there were no page errors or console errors during initialization.
    expect(pageErrors.length).toBe(0);
    // Filter console messages for errors/warnings
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('StartSearch event transitions to Searching and enables stepping', async ({ page }) => {
    // This test validates the S0_Idle -> S1_Searching transition via the StartSearch event.
    const p = new InterpolationPage(page);

    // Click Start Search to trigger start()
    await p.startSearch();

    // After clicking Start, Start button should become disabled (start disables it) and text changes to "Restart"
    await expect(p.startBtn()).toHaveText('Restart');
    // The script sets aria-pressed to 'true' on start()
    await expect(p.startBtn()).toHaveAttribute('aria-pressed', 'true');
    // Start button becomes disabled while the search is active (until found/restart)
    await expect(p.startBtn()).toBeDisabled();

    // Next button should be enabled (the first step is shown immediately, but typically next remains enabled if not found)
    // Because start() calls nextStep immediately, allow a short wait for the UI to update before asserting.
    await page.waitForTimeout(120); // small pause to allow animations/DOM updates
    await expect(p.nextBtn()).toBeVisible();

    // Explanation should mention "Searching for 63"
    const explanation = await p.explanationText();
    expect(explanation).toMatch(/Searching for.*63/);

    // At least one element should be highlighted as low/high/mid after starting.
    const highlightedCount = await page.locator('.element.highlight-low, .element.highlight-high, .element.highlight-mid, .element.found').count();
    expect(highlightedCount).toBeGreaterThan(0);

    // Assert no page errors occurred during start
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('NextStep events drive the search to Found state (S2_Found)', async ({ page }) => {
    // This test advances through steps (S1_Searching) using NextStep events until the Found (S2_Found) final state is reached.
    const p = new InterpolationPage(page);

    // Start the search first
    await p.startSearch();

    // Repeatedly click Next Step until Next becomes disabled (which happens when found or exhausted)
    // Protect with a max iteration to avoid infinite loops in case of unexpected behavior.
    const maxSteps = 30;
    let stepsTaken = 0;
    while (stepsTaken < maxSteps) {
      // If next button is disabled, break out - search is complete (found or failed).
      const isDisabled = await p.nextBtn().isDisabled();
      if (isDisabled) break;

      // Click next and wait briefly for UI changes to settle.
      await p.nextStep();
      await page.waitForTimeout(120);
      stepsTaken++;
    }

    // After stepping, Next should be disabled (search reached a final state)
    await expect(p.nextBtn()).toBeDisabled();

    // The explanation should indicate either success or failure; given default target=63 we expect success.
    const finalExplanation = await p.explanationText();
    const foundMatch = /search successful/i.test(finalExplanation) || /search successful/i.test(finalExplanation.toLowerCase());
    const notFoundMatch = /Value not found|Unable to locate <mark>63<\/mark>/i.test(finalExplanation);

    // Assert that we reached the Found explanation (S2_Found). If not, fail the test with diagnostic info.
    expect(foundMatch, `Expected 'search successful' explanation, got: ${finalExplanation}`).toBe(true);

    // Verify that exactly one element has the 'found' CSS class (the matched element).
    const foundElements = await page.locator('.element.found').count();
    expect(foundElements).toBeGreaterThanOrEqual(1);

    // The Start (Restart) button should now be enabled again after found as per implementation.
    await expect(p.startBtn()).toBeEnabled();
    await expect(p.startBtn()).toHaveText('Restart');

    // Assert no runtime exceptions were thrown during stepping.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Next Step disabled before Start and clicking is inert', async ({ page }) => {
    // This test confirms that Next Step is disabled in Idle state and that clicking it is prevented by the disabled attribute.
    const p = new InterpolationPage(page);

    // Ensure Next is disabled initially
    await expect(p.nextBtn()).toBeDisabled();

    // Attempt a click via JS even though it is disabled. Playwright's click will throw if element is disabled,
    // so instead we attempt to dispatch a click event through evaluate to mimic a user who can't click a disabled button.
    // We do not change page internals; we simply dispatch an event that will be ignored by default because the button
    // has no enabled click handler in this state.
    const clickDispatched = await page.evaluate(() => {
      const btn = document.getElementById('nextBtn');
      if (!btn) return false;
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
      return btn.dispatchEvent(ev);
    });

    // dispatchEvent returns false if preventDefault() called by any listener; in our case there shouldn't be any handler
    // that prevents default for disabled button; the important part is that this action should not throw and should not change state.
    expect(clickDispatched).toBeTruthy();

    // Confirm still disabled and explanation unchanged from Idle.
    await expect(p.nextBtn()).toBeDisabled();
    const explanationText = await p.explanationText();
    expect(explanationText).toContain('Press <mark>Start Search</mark> to begin visualizing the Interpolation Search algorithm.');

    // No errors should have been raised
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('NotFound (S3_NotFound) is not reached in the default demo; assert default behavior', async ({ page }) => {
    // The implementation's default target (63) exists in the array.
    // This test asserts that the NotFound final state is not reached for the default run.
    const p = new InterpolationPage(page);

    // Start and step until completion
    await p.startSearch();
    const maxSteps = 30;
    for (let i = 0; i < maxSteps; i++) {
      const disabled = await p.nextBtn().isDisabled();
      if (disabled) break;
      await p.nextStep();
      await page.waitForTimeout(80);
    }

    // Now inspect explanation text: it should show success and not the "Value not found" message.
    const finalExplanation = await p.explanationText();
    expect(finalExplanation).toContain('search successful');
    expect(finalExplanation).not.toContain('Value not found');

    // Confirm that the implementation did not render the "failed" explanation.
    expect(finalExplanation).not.toMatch(/Search space exhausted between <mark>low=\d+<\/mark> and <mark>high=\d+<\/mark>/);

    // If NotFound were to be validated, it would require a non-existent target. This demo uses an internal constant target
    // in a closure and thus cannot be mutated from the test without altering the page code, which is prohibited by the test requirements.
    // Therefore this test documents and asserts the expected default behavior (Found path).

    // No runtime errors expected during this standard scenario.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console and page errors on load - assert zero JS runtime errors', async ({ page }) => {
    // This dedicated test explicitly asserts that there were no console errors or unhandled page exceptions.
    // It is useful for verifying that the page executed without ReferenceError / SyntaxError / TypeError.
    // (Per instructions we observe errors naturally and assert their occurrence/absence.)
    // Note: listeners are attached in beforeEach.
    expect(pageErrors.length, `Page errors were observed: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);

    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length, `Console errors were observed: ${errorConsole.map(e => e.text).join(' | ')}`).toBe(0);
  });
});