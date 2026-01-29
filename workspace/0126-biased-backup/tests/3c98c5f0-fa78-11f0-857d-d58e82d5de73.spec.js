import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c98c5f0-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object Model for the Big-Omega visual app.
 * Encapsulates common selectors and actions without mutating the page runtime.
 */
class BigOmegaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.replaySelector = '#replayBtn';
    this.themeSelector = '#themeBtn';
    this.omegaPathSelector = 'path.omega-bound';
    this.tPathSelector = 'path.t-function';
    this.bodySelector = 'body';
    this.mainSelector = 'main';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main content to be present to be reasonably sure app loaded.
    await this.page.waitForSelector('main[role="main"]', { state: 'visible' });
  }

  async getReplayHandle() {
    return this.page.$(this.replaySelector);
  }

  async getThemeHandle() {
    return this.page.$(this.themeSelector);
  }

  async getOmegaHandle() {
    return this.page.$(this.omegaPathSelector);
  }

  async getTHandle() {
    return this.page.$(this.tPathSelector);
  }

  async clickTheme() {
    return this.page.click(this.themeSelector);
  }

  // Click the replay button and wait for a pageerror (if any).
  // The caller should expect that the app may throw an error when replaying.
  async clickReplayAndWaitForError() {
    // Prepare waiting for the pageerror before clicking to ensure we capture it.
    const waitForError = this.page.waitForEvent('pageerror');
    await this.page.click(this.replaySelector);
    const err = await waitForError;
    return err;
  }
}

test.describe('Big-Omega Notation — Visualized Elegance (FSM tests)', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new BigOmegaPage(page);
    // Capture console messages for debugging assertions in tests if needed.
    // Collect them per test in an array attached to the page object.
    page._consoleMessages = [];
    page.on('console', (msg) => {
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // Helpful for debugging failing tests: if the test fails, the console messages
    // will be available in the Playwright trace. We do not mutate the page here.
  });

  test('Idle state: initial render shows controls and graph elements (S0_Idle)', async ({ page }) => {
    // Validate the Idle state: controls exist and have the expected attributes.
    const replay = await app.getReplayHandle();
    const theme = await app.getThemeHandle();

    // Buttons should exist
    expect(replay, 'Replay button should be present').not.toBeNull();
    expect(theme, 'Theme button should be present').not.toBeNull();

    // Validate Replay button attributes and visible text
    const replayText = await replay!.innerText();
    expect(replayText).toContain('Replay Animation');
    const replayDesc = await replay!.getAttribute('aria-describedby');
    expect(replayDesc).toBe('desc');

    // Validate Theme button attributes
    const themeLabel = await theme!.getAttribute('aria-label');
    expect(themeLabel).toBe('Toggle light and dark theme');
    const ariaPressed = await theme!.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('false'); // initial expected state

    // Validate graph elements present and animation classes applied
    const omegaHandle = await app.getOmegaHandle();
    const tHandle = await app.getTHandle();
    expect(omegaHandle, 'Omega path should exist').not.toBeNull();
    expect(tHandle, 'T(n) path should exist').not.toBeNull();

    const omegaClasses = await omegaHandle!.getAttribute('class');
    const tClasses = await tHandle!.getAttribute('class');
    expect(omegaClasses).toContain('draw-omega');
    expect(tClasses).toContain('draw-t');

    // Body should not have 'light-theme' class in Idle
    const hasLightClass = await page.evaluate(() => document.body.classList.contains('light-theme'));
    expect(hasLightClass).toBe(false);

    // There should be an SVG with aria-live polite to announce changes
    const svgHasAriaLive = await page.$eval('svg.graph', (svg) => svg.getAttribute('aria-live'));
    expect(svgHasAriaLive).toBe('polite');
  });

  test('Toggle theme: transitions to Theme_Toggled and back to Idle (S0_Idle -> S2_Theme_Toggled -> S0_Idle)', async ({ page }) => {
    // Clicking the theme button should toggle the 'light-theme' class on <body>,
    // update aria-pressed, and change inline styles applied by the script.
    const themeHandle = await app.getThemeHandle();
    expect(themeHandle).not.toBeNull();

    // Click to enable light theme
    await themeHandle!.click();

    // After click: aria-pressed should be 'true' and body should have class 'light-theme'
    const pressedAfterEnable = await themeHandle!.getAttribute('aria-pressed');
    expect(pressedAfterEnable).toBe('true');

    const bodyHasLight = await page.evaluate(() => document.body.classList.contains('light-theme'));
    expect(bodyHasLight).toBe(true);

    // Inline style background was set to a light gradient; check that the inline style contains a light color hint
    const bodyBg = await page.evaluate(() => document.body.style.background || '');
    expect(bodyBg).toContain('#f0f4f8');

    // Verify main background inline style changed to the expected light-ish value
    const mainBg = await page.$eval('main', (m) => (m as HTMLElement).style.background || '');
    expect(mainBg).toContain('rgba');

    // Click again to go back to dark theme (S2_Theme_Toggled -> S0_Idle)
    await themeHandle!.click();

    const pressedAfterDisable = await themeHandle!.getAttribute('aria-pressed');
    expect(pressedAfterDisable).toBe('false');

    const bodyHasLight2 = await page.evaluate(() => document.body.classList.contains('light-theme'));
    expect(bodyHasLight2).toBe(false);

    // The script sets body.style.background back to an original dark gradient; check a token from that value
    const bodyBgAfter = await page.evaluate(() => document.body.style.background || '');
    expect(bodyBgAfter).toContain('#0f2027');
  });

  test('Replay animation: clicking replay replaces path node and results in a runtime TypeError (S0_Idle -> S1_Animation_Replayed, with exception)', async ({ page }) => {
    // This test asserts the observed behavior when pressing the Replay button:
    // 1) The omega-bound <path> node is replaced in the DOM (disconnected original node).
    // 2) The page emits a runtime pageerror, because the script attempts to reassign a const variable.
    const omegaHandleBefore = await app.getOmegaHandle();
    expect(omegaHandleBefore, 'Omega path must be present before replay').not.toBeNull();

    // Confirm the node is connected initially
    const isConnectedBefore = await omegaHandleBefore!.evaluate((n) => n.isConnected);
    expect(isConnectedBefore).toBe(true);

    // Click the replay button and capture the pageerror emitted by the event handler.
    // Wait for the pageerror to ensure we capture the runtime exception from the click handler.
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#replayBtn'),
    ]);

    // The app's script tries to reassign the const binding omegaPath -> triggers TypeError: Assignment to constant variable
    expect(pageError).toBeDefined();
    const msg = pageError!.message || pageError!.toString();
    // Accept common variants of the error message across engines
    expect(msg).toMatch(/Assignment to constant|Assignment to constant variable|Cannot assign to constant/);

    // After the click (even though an exception occurred), the original omega node should be disconnected
    const wasConnectedAfter = await omegaHandleBefore!.evaluate((n) => n.isConnected);
    expect(wasConnectedAfter, 'Original omega node should be removed from DOM after replacement attempt').toBe(false);

    // And the page should still have a path.omega-bound present (the replacement node exists)
    const omegaHandleAfter = await app.getOmegaHandle();
    expect(omegaHandleAfter, 'A new omega-bound path should exist after replay click').not.toBeNull();
    const isConnectedNew = await omegaHandleAfter!.evaluate((n) => n.isConnected);
    expect(isConnectedNew).toBe(true);

    // The new node should also have the expected class names (draw-omega)
    const newClasses = await omegaHandleAfter!.getAttribute('class');
    expect(newClasses).toContain('draw-omega');
  });

  test('Replay after toggling theme: combined transitions and observable error (S2_Theme_Toggled -> S1_Animation_Replayed)', async ({ page }) => {
    // Toggle theme first then replay animation; both transitions should be observable.
    const themeHandle = await app.getThemeHandle();
    expect(themeHandle).not.toBeNull();

    // Toggle theme to light
    await themeHandle!.click();
    const pressed = await themeHandle!.getAttribute('aria-pressed');
    expect(pressed).toBe('true');

    // Now attempt to replay; expect the same TypeError to be emitted by the replay handler
    // and the omega path to be replaced in the DOM.
    const omegaBefore = await app.getOmegaHandle();
    expect(omegaBefore).not.toBeNull();
    const connectedBefore = await omegaBefore!.evaluate((n) => n.isConnected);
    expect(connectedBefore).toBe(true);

    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#replayBtn'),
    ]);

    expect(pageError).toBeDefined();
    const errMsg = pageError!.message || '';
    expect(errMsg).toMatch(/Assignment to constant|Assignment to constant variable|Cannot assign to constant/);

    // Verify omega node replaced
    const wasConnectedAfter = await omegaBefore!.evaluate((n) => n.isConnected);
    expect(wasConnectedAfter).toBe(false);

    // And the theme is still toggled (script did not revert theme due to replay)
    const bodyHasLight = await page.evaluate(() => document.body.classList.contains('light-theme'));
    expect(bodyHasLight).toBe(true);

    // Toggling theme again should still work (transition back to Idle)
    await themeHandle!.click();
    const pressedNow = await themeHandle!.getAttribute('aria-pressed');
    expect(pressedNow).toBe('false');
  });

  test('Edge case: multiple rapid replay clicks produce repeated page errors (edge scenario)', async ({ page }) => {
    // This test ensures that repeated interactions keep producing runtime errors
    // because the underlying bug (const reassignment) remains unpatched.
    const replayHandle = await app.getReplayHandle();
    expect(replayHandle).not.toBeNull();

    // Trigger the first click and capture its error
    const firstErrorPromise = page.waitForEvent('pageerror');
    await replayHandle!.click();
    const firstError = await firstErrorPromise;
    expect(firstError).toBeDefined();
    expect(firstError!.message).toMatch(/Assignment to constant|Assignment to constant variable|Cannot assign to constant/);

    // Trigger a second click and capture another error
    const secondErrorPromise = page.waitForEvent('pageerror');
    await replayHandle!.click();
    const secondError = await secondErrorPromise;
    expect(secondError).toBeDefined();
    expect(secondError!.message).toMatch(/Assignment to constant|Assignment to constant variable|Cannot assign to constant/);

    // At least two errors were captured from two user attempts to replay.
    // This confirms the bug is reproducible across repeated interactions.
  });
});