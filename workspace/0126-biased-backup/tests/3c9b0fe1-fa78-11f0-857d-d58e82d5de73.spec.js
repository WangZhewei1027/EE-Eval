import { test, expect } from '@playwright/test';

// Test file for Application ID: 3c9b0fe1-fa78-11f0-857d-d58e82d5de73
// This suite validates the FSM described in the prompt and the interactive behaviors
// in the served HTML. It also captures console errors and page errors without altering
// the application runtime (no patching or injection). The tests assert DOM changes,
// visual feedback (CSS classes/attributes), and that no unexpected runtime errors occur.

// Page Object to encapsulate element access and common operations
class RefactorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9b0fe1-fa78-11f0-857d-d58e82d5de73.html';
    this.beforeBtn = page.locator('#beforeBtn');
    this.afterBtn = page.locator('#afterBtn');
    this.codeblock = page.locator('#codeblock');
    this.morphPath = page.locator('#morphPath');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickBefore() {
    await this.beforeBtn.click();
  }

  async clickAfter() {
    await this.afterBtn.click();
  }

  async getBeforeAriaPressed() {
    return await this.beforeBtn.getAttribute('aria-pressed');
  }

  async getAfterAriaPressed() {
    return await this.afterBtn.getAttribute('aria-pressed');
  }

  async getCodeText() {
    return await this.codeblock.textContent();
  }

  async getCodeInnerHTML() {
    return await this.page.$eval('#codeblock', el => el.innerHTML);
  }

  async hasPulseClass() {
    return await this.codeblock.evaluate(el => el.classList.contains('pulse'));
  }

  async highlightCount() {
    return await this.page.locator('#codeblock .highlight-line').count();
  }

  async getMorphD() {
    return await this.morphPath.getAttribute('d');
  }
}

test.describe('Refactoring — Elegance in Code Evolution (FSM)', () => {
  // Collect console errors and page errors for assertions without modifying the app
  let consoleErrors;
  let pageErrors;
  let rp; // RefactorPage instance

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages emitted by the page (not warnings/info)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page (pageerror)
    page.on('pageerror', err => {
      // err is an Error object; keep the message and stack for diagnostics
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    rp = new RefactorPage(page);
    await rp.goto();

    // Wait a short time to allow initial scripts (setCode and animateMorph) to run
    // This prevents racing against initialization of highlighted code and morph path.
    await page.waitForTimeout(150);
  });

  test.afterEach(async () => {
    // No teardown modifications to the app; listeners are per-test
  });

  test('Initial state: S0_Before is active on load (Before Refactor)', async () => {
    // This test validates the initial FSM state S0_Before:
    // - setCode(true) should have been called via entry_actions
    // - beforeBtn aria-pressed should be "true", afterBtn "false"
    // - the codeblock should display the "before" content (contains "Original tangled code")
    // - pulse class should be present on the codeblock
    // - expected number of highlighted lines for the "before" view (10)
    // - no runtime errors (console errors or uncaught page errors) occurred during load

    // Buttons aria-pressed
    expect(await rp.getBeforeAriaPressed()).toBe('true');
    expect(await rp.getAfterAriaPressed()).toBe('false');

    // Code content should include the comment identifying it as the "Original tangled code"
    const codeText = await rp.getCodeText();
    expect(codeText).toContain('Original tangled code');

    // Ensure the code block has the pulse animation class (onEnter visual state)
    expect(await rp.hasPulseClass()).toBe(true);

    // Count highlight-line spans created for the "before" variant
    const beforeHighlightCount = await rp.highlightCount();
    // The FSM/implementation listed highlightLinesBefore = [3,4,5,6,7,8,9,12,13,14] => 10 entries
    expect(beforeHighlightCount).toBe(10);

    // Ensure morph path has been assigned a 'd' attribute (animation initialized)
    const dAttr = await rp.getMorphD();
    expect(dAttr).toBeTruthy();

    // Assert no unexpected runtime errors occurred (we let errors happen naturally)
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);
    // Filter runtime console errors for JS reference/syntax/type errors (should be none)
    const jsRuntimeErrors = consoleErrors.filter(msg =>
      /ReferenceError|SyntaxError|TypeError/i.test(msg)
    );
    expect(jsRuntimeErrors.length, `Console errors (JS) found: ${jsRuntimeErrors.join(' | ')}`).toBe(0);
  });

  test('Transition S0_Before -> S1_After when clicking After Refactor', async () => {
    // Validate transition caused by clicking #afterBtn:
    // - setCode(false) should be invoked producing afterRefactor content
    // - aria-pressed states flipped (afterBtn true, beforeBtn false)
    // - pulse class removed from codeblock on transition to After
    // - highlighted lines count reduced to 2 (per highlightLinesAfter)
    // - DOM innerHTML should contain highlighted spans wrapping the afterRefactor content
    // - no runtime errors occurred during the transition

    // Click the "After Refactor" button
    await rp.clickAfter();

    // Wait briefly for DOM updates from event handler
    await rp.page.waitForTimeout(100);

    // Aria pressed toggled
    expect(await rp.getAfterAriaPressed()).toBe('true');
    expect(await rp.getBeforeAriaPressed()).toBe('false');

    // Code contains the refactored header
    const codeText = await rp.getCodeText();
    expect(codeText).toContain('Refactored for clarity');

    // Pulse class should have been removed when switching to After view
    expect(await rp.hasPulseClass()).toBe(false);

    // Highlight count for afterRefactor should be 2 (as per highlightLinesAfter = [5,8])
    const afterHighlightCount = await rp.highlightCount();
    expect(afterHighlightCount).toBe(2);

    // Verify innerHTML contains at least one span with highlight-line class (visual feedback)
    const inner = await rp.getCodeInnerHTML();
    expect(inner.includes('highlight-line')).toBe(true);

    // Assert no runtime errors occurred during the transition
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);
    const jsRuntimeErrors = consoleErrors.filter(msg =>
      /ReferenceError|SyntaxError|TypeError/i.test(msg)
    );
    expect(jsRuntimeErrors.length, `Console errors (JS) found: ${jsRuntimeErrors.join(' | ')}`).toBe(0);
  });

  test('Transition S1_After -> S0_Before when clicking Before Refactor', async () => {
    // This test ensures the reverse transition works:
    // - move to After first, then click Before
    // - setCode(true) called again, codeblock contains beforeRefactor
    // - aria-pressed attributes return to original states
    // - pulse class re-added
    // - highlight count returns to 10
    // - no runtime errors occurred during the sequence

    // Move to After first
    await rp.clickAfter();
    await rp.page.waitForTimeout(100);

    // Now click Before to return to initial state
    await rp.clickBefore();
    await rp.page.waitForTimeout(100);

    // Aria toggles back
    expect(await rp.getBeforeAriaPressed()).toBe('true');
    expect(await rp.getAfterAriaPressed()).toBe('false');

    // Code content is the "before" version again
    const codeText = await rp.getCodeText();
    expect(codeText).toContain('Original tangled code');

    // Pulse class should be present again
    expect(await rp.hasPulseClass()).toBe(true);

    // Highlight count restored to 10
    const beforeHighlightCount = await rp.highlightCount();
    expect(beforeHighlightCount).toBe(10);

    // Assert no runtime errors occurred during the sequence
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);
    const jsRuntimeErrors = consoleErrors.filter(msg =>
      /ReferenceError|SyntaxError|TypeError/i.test(msg)
    );
    expect(jsRuntimeErrors.length, `Console errors (JS) found: ${jsRuntimeErrors.join(' | ')}`).toBe(0);
  });

  test('Idempotent clicks: clicking the already-active button should be a no-op', async () => {
    // Validate clicking "Before Refactor" when already in S0_Before does not change content/state
    // We record the innerHTML and aria-pressed, click the button, and assert no changes.

    const beforeInner = await rp.getCodeInnerHTML();
    const beforeAria = await rp.getBeforeAriaPressed();

    // Click the before button while already showing before
    await rp.clickBefore();
    await rp.page.waitForTimeout(80);

    const afterInner = await rp.getCodeInnerHTML();
    const afterAria = await rp.getBeforeAriaPressed();

    // The innerHTML should remain identical (no unnecessary re-render)
    expect(afterInner).toBe(beforeInner);
    // aria-pressed should remain 'true'
    expect(afterAria).toBe(beforeAria);
    expect(beforeAria).toBe('true');

    // Assert no runtime errors were introduced by the redundant click
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);
    const jsRuntimeErrors = consoleErrors.filter(msg =>
      /ReferenceError|SyntaxError|TypeError/i.test(msg)
    );
    expect(jsRuntimeErrors.length, `Console errors (JS) found: ${jsRuntimeErrors.join(' | ')}`).toBe(0);
  });

  test('Rapid toggling sequence stability and no runtime exceptions', async () => {
    // Simulate rapid toggling between Before and After to ensure stability.
    // The final state should reflect the last click, highlight counts should match,
    // and no uncaught exceptions or console JS errors should occur.

    // Perform rapid alternating clicks
    for (let i = 0; i < 6; i++) {
      await (i % 2 === 0 ? rp.clickAfter() : rp.clickBefore());
      // very short delay to simulate fast user interactions
      await rp.page.waitForTimeout(30);
    }

    // After 6 iterations, since we started in Before:
    // sequence of i: 0 after,1 before,2 after,3 before,4 after,5 before -> last is before
    // So expected final state: Before active
    expect(await rp.getBeforeAriaPressed()).toBe('true');
    expect(await rp.getAfterAriaPressed()).toBe('false');
    expect(await rp.getCodeText()).toContain('Original tangled code');
    expect(await rp.hasPulseClass()).toBe(true);

    // Highlight count consistent with before view
    expect(await rp.highlightCount()).toBe(10);

    // Confirm no page errors or JS runtime errors occurred during rapid toggling
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);
    const jsRuntimeErrors = consoleErrors.filter(msg =>
      /ReferenceError|SyntaxError|TypeError/i.test(msg)
    );
    expect(jsRuntimeErrors.length, `Console errors (JS) found: ${jsRuntimeErrors.join(' | ')}`).toBe(0);
  });

  test('Animated morph path exists and does not throw during animation frames', async () => {
    // This test verifies that the morphing SVG path is being assigned 'd' attribute by the animation
    // and that no JS errors occur while the animation is running (observe for a short interval).

    // Wait some time to allow multiple animation frames to run
    await rp.page.waitForTimeout(400);

    // The morph path should have a non-empty 'd' attribute set
    const d = await rp.getMorphD();
    expect(d, 'morph path "d" attribute should be set').toBeTruthy();

    // Monitor for any errors that might have occurred during animation frames
    expect(pageErrors.length, `Unexpected page errors while animating: ${pageErrors.join(' | ')}`).toBe(0);
    const jsRuntimeErrors = consoleErrors.filter(msg =>
      /ReferenceError|SyntaxError|TypeError/i.test(msg)
    );
    expect(jsRuntimeErrors.length, `Console errors (JS) found during animation: ${jsRuntimeErrors.join(' | ')}`).toBe(0);
  });
});