import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9829b2-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Recursion | Visual Elegance - Animation FSM tests', () => {
  // Collect console and page errors to observe runtime issues without modifying the app.
  let consoleErrors = [];
  let pageErrors = [];

  // Simple Page Object for interacting with the demo page.
  class RecursionPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
      this.page = page;
      this.selectors = {
        toggleBtn: '#toggleAnimation',
        resetBtn: '#resetAnimation',
        recursiveGroup: '#recursiveGroup',
        circleSelector: '#recursiveGroup circle.recursive',
      };
    }

    async goto() {
      await this.page.goto(APP_URL);
      // Wait for controls to be available
      await Promise.all([
        this.page.waitForSelector(this.selectors.toggleBtn),
        this.page.waitForSelector(this.selectors.resetBtn),
        this.page.waitForSelector(this.selectors.recursiveGroup),
      ]);
    }

    async toggle() {
      await this.page.click(this.selectors.toggleBtn);
    }

    async reset() {
      await this.page.click(this.selectors.resetBtn);
    }

    async getToggleButtonHandle() {
      return await this.page.$(this.selectors.toggleBtn);
    }

    async getResetButtonHandle() {
      return await this.page.$(this.selectors.resetBtn);
    }

    async getCircles() {
      return await this.page.$$(this.selectors.circleSelector);
    }

    // Returns an array of objects describing relevant circle inline styles / computed styles
    async snapshotCircles() {
      return await this.page.$$eval(this.selectors.circleSelector, (nodes) =>
        Array.from(nodes).map((n, idx) => {
          const computed = window.getComputedStyle(n);
          return {
            index: idx,
            classList: Array.from(n.classList),
            inlineAnimation: n.style.animation, // inline style.animation
            inlinePlayState: n.style.animationPlayState,
            computedAnimationName: computed.animationName,
            computedPlayState: computed.animationPlayState,
            transform: n.style.transform || null,
            animationDelay: n.style.animationDelay || null,
            r: n.getAttribute('r'),
          };
        })
      );
    }

    async getToggleAttributes() {
      return await this.page.$eval(this.selectors.toggleBtn, (btn) => {
        return {
          text: btn.textContent,
          ariaPressed: btn.getAttribute('aria-pressed'),
          ariaLabel: btn.getAttribute('aria-label'),
        };
      });
    }

    async clickToggleMultiple(times, intervalMs = 0) {
      for (let i = 0; i < times; i++) {
        await this.page.click(this.selectors.toggleBtn);
        if (intervalMs > 0) await this.page.waitForTimeout(intervalMs);
      }
    }
  }

  test.beforeEach(async ({ page }) => {
    // reset arrays
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions in page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert there were no uncaught page errors or console.error calls.
    // If there were any, fail the test with the captured information so the runtime issues surface.
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Format a helpful message
      const ceMsgs = consoleErrors.map((c, i) => `console.error[${i}]: ${c.text} @ ${JSON.stringify(c.location)}`).join('\n');
      const peMsgs = pageErrors.map((e, i) => `pageerror[${i}]: ${e && e.stack ? e.stack : String(e)}`).join('\n');
      throw new Error(`Runtime issues detected:\n${ceMsgs}\n${peMsgs}`);
    }
  });

  test('Initial state should be Animation Running (S0) with expected controls and circles', async ({ page }) => {
    // Validate initial S0 state as per FSM evidence:
    // - toggleBtn.textContent = 'Pause'
    // - toggleBtn.aria-pressed = 'true'
    // - circles animated (computed animationPlayState === 'running')
    const app = new RecursionPage(page);
    await app.goto();

    // Snapshot toggle button attributes
    const toggle = await app.getToggleAttributes();
    // The page's script triggers two clicks on load to ensure proper ARIA; verify visible text and aria attribute are consistent with "running"
    expect(toggle.text.trim()).toBe('Pause');
    expect(toggle.ariaPressed).toBe('true');
    expect(toggle.ariaLabel).toContain('Pause');

    // Validate number of circles created matches expectation (implementation details lead to 6 circles)
    const circles = await app.getCircles();
    expect(circles.length).toBeGreaterThanOrEqual(1);
    // Based on code math: break condition stops after the radius drops below minRadius; expect 6 circles in this implementation
    expect(circles.length).toBe(6);

    // Validate computed animation play state is running for the first few circles
    const snapshot = await app.snapshotCircles();
    expect(snapshot.length).toBe(circles.length);
    for (let i = 0; i < snapshot.length; i++) {
      // Computed play state should be 'running' when animation is active
      expect(snapshot[i].computedPlayState).toBe('running');
      // Each circle should have class 'recursive'
      expect(snapshot[i].classList).toContain('recursive');
      // animationDelay is set inline in script as `${i * 0.5}s`
      expect(snapshot[i].animationDelay).toBe(`${i * 0.5}s`);
      // Transform should include a rotate(...) as script sets style.transform = `rotate(${rotate}deg)`
      expect(snapshot[i].transform).toContain('rotate(');
    }
  });

  test('Clicking toggle should pause and update ARIA (S0 -> S1) and clicking again resumes (S1 -> S0)', async ({ page }) => {
    // Validate the ToggleAnimation event transitions:
    // - From running -> paused: circles.forEach(c => c.style.animationPlayState = 'paused');
    // - From paused -> running: circles.forEach(c => c.style.animationPlayState = 'running');

    const app = new RecursionPage(page);
    await app.goto();

    // Ensure starting state consistent
    let t = await app.getToggleAttributes();
    expect(t.text.trim()).toBe('Pause');
    expect(t.ariaPressed).toBe('true');

    // Click toggle -> should pause
    await app.toggle();

    let tAfterPause = await app.getToggleAttributes();
    expect(tAfterPause.text.trim()).toBe('Play'); // UI evidence for paused
    expect(tAfterPause.ariaPressed).toBe('false');
    expect(tAfterPause.ariaLabel).toContain('Play');

    // Validate all circles have computed animationPlayState === 'paused'
    const pausedSnapshot = await app.snapshotCircles();
    expect(pausedSnapshot.length).toBeGreaterThan(0);
    for (const c of pausedSnapshot) {
      expect(c.computedPlayState).toBe('paused');
      // Inline style should also reflect the play state set by script
      expect(c.inlinePlayState).toBe('paused');
    }

    // Click toggle again -> should resume
    await app.toggle();

    const tAfterResume = await app.getToggleAttributes();
    expect(tAfterResume.text.trim()).toBe('Pause');
    expect(tAfterResume.ariaPressed).toBe('true');
    expect(tAfterResume.ariaLabel).toContain('Pause');

    const resumedSnapshot = await app.snapshotCircles();
    for (const c of resumedSnapshot) {
      expect(c.computedPlayState).toBe('running');
      expect(c.inlinePlayState).toBe('running');
    }
  });

  test('Reset button should reset the animation without removing circles (S0 -> S2 and S1 -> S2)', async ({ page }) => {
    // Verify ResetAnimation behavior both when running and when paused:
    // Evidence in FSM: c.style.animation = 'none'; void c.offsetWidth;
    // Implementation sets animation to 'none' then restores; we cannot reliably capture transient inline style during the exact frame.
    // Instead we assert that reset completes without errors and leaves the DOM consistent (same number of circles, classes intact).
    const app = new RecursionPage(page);
    await app.goto();

    // Snapshot before any resets
    const beforeSnapshot = await app.snapshotCircles();
    const beforeCount = beforeSnapshot.length;
    expect(beforeCount).toBeGreaterThan(0);

    // Reset while running (S0 -> S2)
    await app.reset();

    // After reset, circles should still exist and remain 'recursive'
    const afterResetSnapshot = await app.snapshotCircles();
    expect(afterResetSnapshot.length).toBe(beforeCount);
    for (const c of afterResetSnapshot) {
      expect(c.classList).toContain('recursive');
      // Computed play state should still be 'running' because reset restores animation
      expect(c.computedPlayState).toBe('running');
    }

    // Pause the animation (S0 -> S1), then reset (S1 -> S2)
    await app.toggle(); // pause
    const pausedSnapshot = await app.snapshotCircles();
    for (const c of pausedSnapshot) {
      expect(c.computedPlayState).toBe('paused');
    }

    await app.reset();

    // After reset from paused state, ensure DOM still intact and no errors occurred
    const afterResetFromPaused = await app.snapshotCircles();
    expect(afterResetFromPaused.length).toBe(beforeCount);
    for (const c of afterResetFromPaused) {
      // The implementation restores animations after reset; depending on timing the play state may be 'paused' if still paused
      // The key assertion: element remains and has required class
      expect(c.classList).toContain('recursive');
    }
  });

  test('Edge cases: rapid toggles, repeated resets, and stability checks', async ({ page }) => {
    // This test validates robustness for rapid user actions and repeated resets (error scenarios / edge cases).
    const app = new RecursionPage(page);
    await app.goto();

    // Rapid toggle clicks (odd number -> paused, even -> running)
    await app.clickToggleMultiple(5, 10); // 5 quick clicks
    // 5 is odd so expect paused
    let toggleState = await app.getToggleAttributes();
    expect(toggleState.ariaPressed).toBe('false');
    expect(toggleState.text.trim()).toBe('Play');

    // Now do 4 quick toggles -> should end up running
    await app.clickToggleMultiple(4, 5);
    toggleState = await app.getToggleAttributes();
    expect(toggleState.ariaPressed).toBe('true');
    expect(toggleState.text.trim()).toBe('Pause');

    // Repeated resets in quick succession should not throw and DOM should remain stable
    const before = await app.snapshotCircles();
    await Promise.all([
      app.reset(),
      app.reset(),
      app.reset(),
    ]);

    const afterManyResets = await app.snapshotCircles();
    expect(afterManyResets.length).toBe(before.length);
    for (let i = 0; i < afterManyResets.length; i++) {
      expect(afterManyResets[i].classList).toEqual(before[i].classList);
    }

    // Verify that toggling after many resets still works
    await app.toggle(); // pause
    const pausedSnapshot = await app.snapshotCircles();
    for (const c of pausedSnapshot) {
      expect(c.computedPlayState).toBe('paused');
    }
    await app.toggle(); // resume
    const resumedSnapshot = await app.snapshotCircles();
    for (const c of resumedSnapshot) {
      expect(c.computedPlayState).toBe('running');
    }
  });

  test('Accessibility checks: controls have expected aria attributes and roles', async ({ page }) => {
    // Validate presence of aria-labels, aria-pressed, and role/aria-label for recursion container
    const app = new RecursionPage(page);
    await app.goto();

    // Check container attributes
    const containerAttrs = await page.$eval('#recursion-container', (el) => {
      return {
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        tabIndex: el.getAttribute('tabindex'),
      };
    });
    expect(containerAttrs.role).toBe('img');
    expect(typeof containerAttrs.ariaLabel).toBe('string');
    expect(containerAttrs.ariaLabel).toContain('Recursive spiraling circles');

    // Check toggle button ARIA
    const toggle = await app.getToggleButtonHandle();
    expect(toggle).not.toBeNull();
    const toggleAttr = await app.getToggleAttributes();
    expect(toggleAttr.ariaLabel).toBeTruthy();
    expect(['true', 'false']).toContain(toggleAttr.ariaPressed);

    // Check reset button ARIA
    const resetAttr = await app.getResetButtonHandle();
    expect(resetAttr).not.toBeNull();
    const resetAriaLabel = await page.$eval('#resetAnimation', (btn) => btn.getAttribute('aria-label'));
    expect(resetAriaLabel).toContain('Reset recursion animation');
  });
});