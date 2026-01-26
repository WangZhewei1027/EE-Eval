import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c99b051-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the ACID visualization page
class AcidPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleAnimationBtn = page.locator('#toggleAnimationBtn');
    this.toggleThemeBtn = page.locator('#toggleThemeBtn');
    this.molecule = page.locator('.molecule');
    this.tooltip = page.locator('#tooltip');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Reads inline style animationPlayState from the molecule element
  async getMoleculeAnimationState() {
    return await this.page.evaluate(() => {
      const el = document.querySelector('.molecule');
      return el ? el.style.animationPlayState || getComputedStyle(el).animationPlayState : null;
    });
  }

  // Reads computed CSS custom property from documentElement
  async getCssVar(name) {
    return await this.page.evaluate((n) => {
      return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    }, name);
  }

  async clickToggleAnimation() {
    await this.toggleAnimationBtn.click();
  }

  async clickToggleTheme() {
    await this.toggleThemeBtn.click();
  }

  async getAnimationButtonText() {
    return await this.toggleAnimationBtn.textContent();
  }

  async getAnimationButtonAriaPressed() {
    return await this.toggleAnimationBtn.getAttribute('aria-pressed');
  }

  async getThemeButtonText() {
    return await this.toggleThemeBtn.textContent();
  }

  async tooltipHasText(expected) {
    return await this.tooltip.evaluate((el, text) => {
      return el && el.textContent.trim() === text && el.classList.contains('show');
    }, expected);
  }
}

// Collect console messages and page errors per test
test.describe('ACID Properties — Visualized: FSM and UI tests', () => {
  let pageErrors;
  let consoleErrors;
  let consoleLogs;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleLogs = [];

    // Listen for uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // collect Error objects
      pageErrors.push(err);
    });

    // Collect console messages and categorize errors
    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type(); // 'log', 'error', 'warning', etc.
      consoleLogs.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });
  });

  test.describe('Initial state verification', () => {
    // Verify that on load the FSM initial states are represented:
    // - AnimationRunning: animationPlayState = 'running', button text 'Pause Rotation', aria-pressed='true'
    // - DarkTheme: --color-bg === '#0f1123', theme button text 'Dark Theme'
    test('initial UI reflects Animation Running and Dark Theme', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Wait for essential elements to be present
      await expect(app.toggleAnimationBtn).toBeVisible();
      await expect(app.toggleThemeBtn).toBeVisible();
      await expect(app.molecule).toBeVisible();

      // Animation state should be 'running' on initialization
      const animState = await app.getMoleculeAnimationState();
      // The implementation sets inline molecule.style.animationPlayState = 'running' in initializer
      expect(animState).toBe('running');

      // The animation button should indicate Pause Rotation and aria-pressed true
      const animBtnText = (await app.getAnimationButtonText()).trim();
      expect(animBtnText).toBe('Pause Rotation');
      const ariaPressed = await app.getAnimationButtonAriaPressed();
      expect(ariaPressed).toBe('true');

      // Dark theme initial CSS custom property
      const bg = await app.getCssVar('--color-bg');
      expect(bg).toBe('#0f1123');

      // Theme button initial text should read 'Dark Theme'
      const themeText = (await app.getThemeButtonText()).trim();
      expect(themeText).toBe('Dark Theme');

      // Ensure there were no uncaught runtime errors or console.error messages during load
      expect(pageErrors.length, `No page errors expected on load but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `No console.error messages expected on load but found: ${consoleErrors.join('; ')}`).toBe(0);
    });
  });

  test.describe('Animation Controls (ToggleAnimation event)', () => {
    test('clicking toggleAnimationBtn pauses and resumes the rotation with proper DOM updates and tooltip feedback', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // --- Transition: S0_AnimationRunning -> S1_AnimationPaused ---
      // Click to pause
      await app.clickToggleAnimation();

      // After click, molecule animation should be paused
      await expect.poll(async () => await app.getMoleculeAnimationState(), {
        timeout: 2000,
      }).toBe('paused');

      // Button text should update to 'Play Rotation' and aria-pressed to 'false'
      await expect.poll(async () => (await app.getAnimationButtonText()).trim(), { timeout: 2000 }).toBe('Play Rotation');
      const ariaAfterPause = await app.getAnimationButtonAriaPressed();
      expect(ariaAfterPause).toBe('false');

      // Tooltip should show 'Animation paused'
      await expect(app.tooltip).toBeVisible();
      await expect(app.tooltip).toHaveClass(/show/);
      await expect(app.tooltip).toHaveText('Animation paused');

      // Wait for tooltip to disappear (implementation hides after ~2000ms)
      await expect(app.tooltip).toHaveClass(/tooltip/); // still has base class; not strictly necessary
      await page.waitForTimeout(2200);
      // tooltip should no longer have 'show' class
      const tooltipHasShow = await app.tooltip.evaluate((el) => el.classList.contains('show'));
      expect(tooltipHasShow).toBe(false);

      // --- Transition: S1_AnimationPaused -> S0_AnimationRunning ---
      // Click again to resume
      await app.clickToggleAnimation();

      // Molecule should be running again
      await expect.poll(async () => await app.getMoleculeAnimationState(), { timeout: 2000 }).toBe('running');

      // Button text back to 'Pause Rotation' and aria-pressed to 'true'
      await expect.poll(async () => (await app.getAnimationButtonText()).trim(), { timeout: 2000 }).toBe('Pause Rotation');
      const ariaAfterResume = await app.getAnimationButtonAriaPressed();
      expect(ariaAfterResume).toBe('true');

      // Tooltip should show 'Animation resumed'
      await expect(app.tooltip).toBeVisible();
      await expect(app.tooltip).toHaveClass(/show/);
      await expect(app.tooltip).toHaveText('Animation resumed');

      // Confirm no uncaught page errors or console errors were emitted during interaction
      expect(pageErrors.length, `No page errors expected during animation toggles but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `No console.error messages expected during animation toggles but found: ${consoleErrors.join('; ')}`).toBe(0);
    });

    test('rapid repeated clicks toggle animation deterministically and last tooltip wins', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Rapidly click the animation button three times
      await Promise.all([
        app.clickToggleAnimation(),
        app.clickToggleAnimation(),
        app.clickToggleAnimation()
      ]);

      // After three toggles starting from running: running -> paused -> running -> paused
      // Final expected state is 'paused'
      await expect.poll(async () => await app.getMoleculeAnimationState(), { timeout: 2000 }).toBe('paused');

      // Final button label should be 'Play Rotation' and aria-pressed false
      await expect.poll(async () => (await app.getAnimationButtonText()).trim(), { timeout: 2000 }).toBe('Play Rotation');
      expect(await app.getAnimationButtonAriaPressed()).toBe('false');

      // The tooltip that appears should reflect the last action: 'Animation paused'
      await expect(app.tooltip).toBeVisible();
      await expect(app.tooltip).toHaveText('Animation paused');

      // No runtime errors should be produced even under rapid interactions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Theme Controls (ToggleTheme event)', () => {
    test('clicking toggleThemeBtn toggles between Dark and Light themes and updates CSS variables and tooltip', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Initial: Dark Theme
      expect((await app.getThemeButtonText()).trim()).toBe('Dark Theme');
      expect(await app.getCssVar('--color-bg')).toBe('#0f1123');

      // Click to toggle to Light Theme (S2_DarkTheme -> S3_LightTheme)
      await app.clickToggleTheme();

      // After click, CSS var should change to light theme background and button text to 'Light Theme'
      await expect.poll(async () => await app.getCssVar('--color-bg'), { timeout: 2000 }).toBe('#f7f8fe');
      await expect.poll(async () => (await app.getThemeButtonText()).trim(), { timeout: 2000 }).toBe('Light Theme');

      // Tooltip text should indicate switch to Light Theme
      await expect(app.tooltip).toBeVisible();
      await expect(app.tooltip).toHaveClass(/show/);
      await expect(app.tooltip).toHaveText('Switched to Light Theme');

      // Click again to return to Dark Theme (S3_LightTheme -> S2_DarkTheme)
      await app.clickToggleTheme();

      await expect.poll(async () => await app.getCssVar('--color-bg'), { timeout: 2000 }).toBe('#0f1123');
      await expect.poll(async () => (await app.getThemeButtonText()).trim(), { timeout: 2000 }).toBe('Dark Theme');

      // Tooltip should indicate switch to Dark Theme
      await expect(app.tooltip).toBeVisible();
      await expect(app.tooltip).toHaveText('Switched to Dark Theme');

      // Ensure no errors during theme toggling
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('theme toggle updates multiple CSS custom properties as expected (spot-check)', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Toggle to Light Theme
      await app.clickToggleTheme();

      // Spot-check a couple of other CSS custom properties updated in the light branch
      await expect.poll(async () => await app.getCssVar('--color-primary'), { timeout: 2000 }).toBe('#6b21a8');
      await expect.poll(async () => await app.getCssVar('--color-surface'), { timeout: 2000 }).toBe('#e4d7fa');

      // Toggle back to Dark Theme and spot-check a primary variable
      await app.clickToggleTheme();
      await expect.poll(async () => await app.getCssVar('--color-primary'), { timeout: 2000 }).toBe('#7f5af0');

      // Again, ensure no unexpected runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Robustness, edge cases and error observations', () => {
    test('no unexpected console.error or uncaught page errors across typical usage flows', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Perform a sequence of typical interactions
      await app.clickToggleAnimation();
      await page.waitForTimeout(150);
      await app.clickToggleTheme();
      await page.waitForTimeout(150);
      await app.clickToggleAnimation();
      await page.waitForTimeout(150);
      await app.clickToggleTheme();

      // Wait briefly for any deferred errors or tooltip timeouts to happen
      await page.waitForTimeout(500);

      // Collect and assert environment observations:
      // We expect the page to run without throwing uncaught exceptions (pageerror) or console.error logs.
      // If any such errors exist, include them in the assertion message to aid debugging.
      if (pageErrors.length > 0) {
        console.log('Page errors captured during interactions:', pageErrors);
      }
      if (consoleErrors.length > 0) {
        console.log('Console.error messages captured during interactions:', consoleErrors);
      }

      expect(pageErrors.length, `Expected no uncaught page errors but found ${pageErrors.length}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages but found ${consoleErrors.length}`).toBe(0);
    });

    test('the tooltip dismisses after the configured timeout and does not leave lingering show class', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Trigger an action that shows the tooltip
      await app.clickToggleAnimation(); // shows 'Animation paused' or resumed depending on state
      await expect(app.tooltip).toBeVisible();
      await expect(app.tooltip).toHaveClass(/show/);

      // Wait longer than tooltip timeout in implementation (2000ms)
      await page.waitForTimeout(2300);

      // Tooltip should be hidden (no 'show' class)
      const hasShow = await app.tooltip.evaluate(el => el.classList.contains('show'));
      expect(hasShow).toBe(false);

      // Ensure no errors related to timers or clearing timeouts
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('rapid toggles of theme and animation do not throw errors and final states are consistent', async ({ page }) => {
      const app = new AcidPage(page);
      await app.goto();

      // Rapidly toggle theme and animation in an interleaved manner
      const actions = [];
      for (let i = 0; i < 5; i++) {
        actions.push(app.clickToggleAnimation());
        actions.push(app.clickToggleTheme());
      }
      await Promise.all(actions);

      // Give the page a moment to settle
      await page.waitForTimeout(500);

      // Final states should be deterministic: compute expected parity
      // - Animation starts running, toggled 5 times -> final: paused (odd toggles)
      // - Theme starts dark, toggled 5 times -> final: light (odd toggles)
      await expect.poll(async () => await app.getMoleculeAnimationState(), { timeout: 2000 }).toBe('paused');
      await expect.poll(async () => await app.getCssVar('--color-bg'), { timeout: 2000 }).toBe('#f7f8fe');
      await expect((await app.getThemeButtonText()).trim()).toBe('Light Theme');

      // Sanity checks for tooltip presence (last tooltip reflects last action)
      await expect(app.tooltip).toBeVisible();

      // No runtime exceptions were thrown during this stress test
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  // After all tests within this describe block we can log summary of console messages for debugging
  test.afterEach(async ({}, testInfo) => {
    // If a test failed, surface the captured console logs and errors in the test output for easier debugging.
    if (testInfo.status !== 'passed') {
      console.group && console.group(`Captured console logs for failing test: ${testInfo.title}`);
      for (const m of consoleLogs) {
        console.log(`[console.${m.type}] ${m.text}`);
      }
      console.groupEnd && console.groupEnd();
      if (pageErrors.length) {
        console.error('Captured page errors:', pageErrors);
      }
    }
  });
});