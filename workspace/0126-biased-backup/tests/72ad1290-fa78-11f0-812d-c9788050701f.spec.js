import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad1290-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Cosmic Compiler app
class CompilerPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getCompileButton() {
    return this.page.$('#compileBtn');
  }

  async getCompileButtonText() {
    return this.page.$eval('#compileBtn', el => el.textContent?.trim());
  }

  async clickCompile() {
    const btn = await this.getCompileButton();
    await btn.click();
  }

  async particlesCount() {
    return this.page.$eval('#particles', el => el.children.length);
  }

  async panelInlineAnimation(selector) {
    // returns the inline style.animation value (set by JS) for the matched element
    return this.page.$eval(selector, el => (el as any).style ? el.style.animation : '');
  }

  async connectionInlineAnimation(index) {
    return this.page.$$eval('.connection', nodes => {
      const idx = Math.max(0, Math.min(index, nodes.length - 1));
      const el = nodes[idx] as HTMLElement;
      return el && el.style ? el.style.animation : '';
    });
  }

  async dotInlineAnimation(index) {
    return this.page.$$eval('.connection-dot', nodes => {
      const idx = Math.max(0, Math.min(index, nodes.length - 1));
      const el = nodes[idx] as HTMLElement;
      return el && el.style ? el.style.animation : '';
    });
  }

  async computedAnimationName(selector) {
    // returns computed animation-name (can be comma separated) to check CSS-driven animations
    return this.page.$eval(selector, el => {
      const cs = window.getComputedStyle(el);
      return cs.animationName || cs.getPropertyValue('animation-name');
    });
  }
}

// Group tests for FSM and interactions
test.describe('Cosmic Compiler | FSM and UI integration tests', () => {
  // containers for console and page errors captured per test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors to assert on them later
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test('S0 Idle: Initial render shows compile button and particle generation (entry action evidence)', async ({ page }) => {
    // This test validates the "Idle" state (S0_Idle) entry: page renders, compile button exists,
    // and the particle generation ran (evidence of onEnter/renderPage-like behavior).
    const app = new CompilerPage(page);
    await app.goto();

    // Assert compile button exists and has correct text
    const btn = await app.getCompileButton();
    expect(btn).toBeTruthy();
    const text = await app.getCompileButtonText();
    expect(text).toBe('Animate Compilation');

    // Particles should have been created during DOMContentLoaded handler.
    // The implementation uses particleCount = 30. Validate that.
    const count = await app.particlesCount();
    expect(count).toBeGreaterThanOrEqual(1);
    // Prefer to assert the expected design count as strong evidence that the initialization ran.
    expect(count).toBe(30);

    // Ensure panels exist and initial CSS animations (defined in stylesheet) are present via computed style.
    // For example, source-code should initially have animation that includes 'slideInLeft' (from CSS).
    const sourceAnimName = await app.computedAnimationName('.source-code');
    // Accept that browser may return 'none' or a name; ensure at least an expected animation or none is present.
    expect(typeof sourceAnimName).toBe('string');
    // If an animation name is present, it should include slideInLeft (as defined in the CSS)
    if (sourceAnimName !== 'none' && sourceAnimName !== '') {
      expect(sourceAnimName.includes('slideInLeft') || sourceAnimName.includes('glow') || sourceAnimName.includes('none')).toBeTruthy();
    }

    // Verify no unexpected page errors occurred during load
    expect(pageErrors).toEqual([]);

    // There should be no console.error messages during a healthy initial render
    expect(consoleErrors).toEqual([]);
  });

  test('Transition: Clicking compile triggers Animating state (S0 -> S1) and reapplies animations', async ({ page }) => {
    // This test validates the transition defined by the FSM (CompileClick):
    // - Clicking #compileBtn should set inline animations on panels and connectors (evidence of Animating state).
    const app = new CompilerPage(page);
    await app.goto();

    // Click the compile button
    await app.clickCompile();

    // Wait sufficient time for all setTimeouts in the script to execute (900ms max + small buffer)
    await page.waitForTimeout(1200);

    // The page script sets inline style.animation = 'glow 2s ease infinite' on the panels (source, ast, ir, assembly)
    const sourceInline = await app.panelInlineAnimation('.source-code');
    const astInline = await app.panelInlineAnimation('.ast-panel');
    const irInline = await app.panelInlineAnimation('.ir-panel');
    const assemblyInline = await app.panelInlineAnimation('.assembly-panel');

    // Inline animation should include the 'glow' animation applied by the click handler
    expect(sourceInline.includes('glow')).toBeTruthy();
    expect(astInline.includes('glow')).toBeTruthy();
    expect(irInline.includes('glow')).toBeTruthy();
    expect(assemblyInline.includes('glow')).toBeTruthy();

    // Connections were animated inline by JS to include stretchRight/Left and glow
    const conn0 = await app.connectionInlineAnimation(0);
    const conn1 = await app.connectionInlineAnimation(1);
    const conn2 = await app.connectionInlineAnimation(2);
    expect(conn0.includes('stretchRight') || conn0.includes('stretchRight')).toBeTruthy();
    expect(conn0.includes('glow')).toBeTruthy();
    // For conn1 and conn2 check that at least something was applied (stretchRight/Left or glow)
    expect(conn1.length).toBeGreaterThan(0);
    expect(conn2.length).toBeGreaterThan(0);

    // Dots should have pulse animation inline applied
    const dot0 = await app.dotInlineAnimation(0);
    const dot1 = await app.dotInlineAnimation(1);
    const dot2 = await app.dotInlineAnimation(2);
    expect(dot0.includes('pulse') || dot0.includes('pulse')).toBeTruthy();
    expect(dot1.includes('pulse')).toBeTruthy();
    expect(dot2.includes('pulse')).toBeTruthy();

    // Ensure no uncaught page errors occurred as a result of the click transition
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: Rapid multiple clicks do not produce page errors and reapply animations', async ({ page }) => {
    // This test validates robustness: performing the CompileClick event repeatedly and rapidly
    // should not crash the page or produce uncaught exceptions.
    const app = new CompilerPage(page);
    await app.goto();

    // Rapidly click the compile button multiple times
    const btn = await app.getCompileButton();
    await btn.click();
    await btn.click();
    await btn.click();

    // Wait for animations / timeouts to settle
    await page.waitForTimeout(1500);

    // Verify inline animation remains applied (glow) on the source panel after repeated clicks
    const sourceInline = await app.panelInlineAnimation('.source-code');
    expect(sourceInline.includes('glow')).toBeTruthy();

    // Verify connections and dots are still animated inline
    const conn0 = await app.connectionInlineAnimation(0);
    expect(conn0.length).toBeGreaterThan(0);
    const dot0 = await app.dotInlineAnimation(0);
    expect(dot0.includes('pulse')).toBeTruthy();

    // Confirm no page error events were emitted
    expect(pageErrors).toEqual([]);
    // Confirm console did not emit error-level messages during rapid interactions
    expect(consoleErrors).toEqual([]);
  });

  test('Observability: Capture and assert console messages and runtime errors during lifecycle', async ({ page }) => {
    // This test explicitly demonstrates observation of console and page errors.
    // It asserts that the page's runtime remained free of uncaught exceptions and error-level console logs.
    const app = new CompilerPage(page);
    await app.goto();

    // Interact to trigger the main interactive code path
    await app.clickCompile();
    await page.waitForTimeout(1200);

    // Inspect captured console messages to ensure none are error-level
    const errorLevelMessages = consoleMessages.filter(m => m.type === 'error');
    // Expect no console.error entries
    expect(errorLevelMessages.length).toBe(0);

    // Inspect page errors
    expect(pageErrors.length).toBe(0);

    // Additionally assert that some console debug/info messages might exist (not required),
    // but the main contract is no runtime exceptions and no console.error
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test.afterEach(async ({ page }) => {
    // Final safety assertions can be done here per test, but they are already asserted inside tests.
    // Keep this hook to mirror setup/teardown structure if needed in the future.
  });
});