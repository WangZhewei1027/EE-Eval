import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab64e3-fa78-11f0-812d-c9788050701f.html';

// Page Object to encapsulate common interactions and queries
class CosmicPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pauseBtn = page.locator('#pauseBtn');
    this.themeBtn = page.locator('#themeBtn');
    this.planets = page.locator('.planet');
    this.galaxy = page.locator('.galaxy');
    this.stars = page.locator('.star');
    this.root = page.locator(':root');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Wait for the control buttons to appear (they have fadeIn animation)
    await this.pauseBtn.waitFor({ state: 'visible' });
    await this.themeBtn.waitFor({ state: 'visible' });
  }

  async clickPause() {
    await this.pauseBtn.click();
  }

  async clickTheme() {
    await this.themeBtn.click();
  }

  async pauseBtnText() {
    return (await this.pauseBtn.innerText()).trim();
  }

  async getInlineAnimationPlayStateOnPlanets() {
    // returns array of inline style.animationPlayState values for each planet
    return this.page.evaluate(() => {
      const planets = Array.from(document.querySelectorAll('.planet'));
      return planets.map(p => p.style.animationPlayState || '');
    });
  }

  async getInlineAnimationPlayStateOnGalaxy() {
    return this.page.evaluate(() => {
      const g = document.querySelector('.galaxy');
      return g ? (g.style.animationPlayState || '') : null;
    });
  }

  async getComputedAnimationPlayState(selector) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).animationPlayState;
    }, selector);
  }

  async rootCssVar(varName) {
    // returns computed value of CSS variable on :root (documentElement)
    return this.page.evaluate((v) => {
      return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    }, varName);
  }

  async countStars() {
    return this.stars.count();
  }
}

test.describe('Cosmic Harmony - FSM and UI behavior (72ab64e3-fa78-11f0-812d-c9788050701f)', () => {
  let cosmic;
  // Collect console events and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ text: msg.text(), type: msg.type() });
    });

    // Capture uncaught exceptions / runtime errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    cosmic = new CosmicPage(page);
    await cosmic.goto();
  });

  test.afterEach(async () => {
    // nothing to teardown beyond Playwright fixtures; keep listeners ephemeral per test
  });

  test.describe('Initial state validation', () => {
    test('Initial visual and state indicators correspond to Playing state', async () => {
      // The FSM S0_Playing evidence: isPaused = false
      // We cannot access isPaused directly; infer from button text and computed animation state
      const btnText = await cosmic.pauseBtnText();
      // Button should indicate Pause Motion when playing
      expect(btnText).toBe('Pause Motion');

      // There should be three planet elements as in the markup
      const planetCount = await cosmic.planets.count();
      expect(planetCount).toBeGreaterThanOrEqual(3);

      // The galaxy should have 200 generated stars as script creates them
      const starsCount = await cosmic.countStars();
      expect(starsCount).toBe(200);

      // Computed animation play state should be 'running' for the galaxy and at least the first planet
      const galaxyComputed = await cosmic.getComputedAnimationPlayState('.galaxy');
      expect(galaxyComputed).toBeTruthy();
      expect(galaxyComputed).toMatch(/running/i);

      const planetComputed = await cosmic.getComputedAnimationPlayState('.planet-1');
      expect(planetComputed).toBeTruthy();
      expect(planetComputed).toMatch(/running/i);
    });
  });

  test.describe('PauseToggle event and state transitions', () => {
    test('Clicking Pause toggles to Paused state and updates visuals and text', async () => {
      // Click pause to toggle to paused
      await cosmic.clickPause();

      // Button text should update to "Resume Motion"
      const btnTextPaused = await cosmic.pauseBtnText();
      expect(btnTextPaused).toBe('Resume Motion');

      // Inline styles should be set to 'paused' on planets and galaxy (script sets inline styles)
      const planetInlineStates = await cosmic.getInlineAnimationPlayStateOnPlanets();
      // All planets should have inline 'paused'
      expect(planetInlineStates.length).toBeGreaterThanOrEqual(3);
      for (const state of planetInlineStates) {
        expect(state).toBe('paused');
      }

      const galaxyInline = await cosmic.getInlineAnimationPlayStateOnGalaxy();
      expect(galaxyInline).toBe('paused');

      // Computed style should also reflect paused state
      const galaxyComputed = await cosmic.getComputedAnimationPlayState('.galaxy');
      expect(galaxyComputed.toLowerCase()).toBe('paused');
    });

    test('Clicking Pause again resumes motion and updates visuals and text', async () => {
      // First click to pause
      await cosmic.clickPause();
      // Second click to resume
      await cosmic.clickPause();

      // Button text should be back to "Pause Motion"
      const btnText = await cosmic.pauseBtnText();
      expect(btnText).toBe('Pause Motion');

      // Inline styles should now be 'running' on planets and galaxy
      const planetInlineStates = await cosmic.getInlineAnimationPlayStateOnPlanets();
      for (const state of planetInlineStates) {
        expect(state).toBe('running');
      }

      const galaxyInline = await cosmic.getInlineAnimationPlayStateOnGalaxy();
      expect(galaxyInline).toBe('running');

      // Computed style should reflect running state
      const galaxyComputed = await cosmic.getComputedAnimationPlayState('.galaxy');
      expect(galaxyComputed.toLowerCase()).toBe('running');
    });

    test('Rapid toggles maintain consistent final state (edge case)', async () => {
      // Rapidly click 5 times
      for (let i = 0; i < 5; i++) {
        await cosmic.clickPause();
      }

      // 5 is odd -> final state should be paused
      const finalText = await cosmic.pauseBtnText();
      expect(finalText).toBe('Resume Motion');

      // Confirm inline style is 'paused'
      const planetInlineStates = await cosmic.getInlineAnimationPlayStateOnPlanets();
      for (const state of planetInlineStates) {
        expect(state).toBe('paused');
      }

      // Now click once more to return to playing
      await cosmic.clickPause();
      const resumedText = await cosmic.pauseBtnText();
      expect(resumedText).toBe('Pause Motion');
    });
  });

  test.describe('ThemeChange event and CSS variable updates', () => {
    test('Theme button cycles through themes and updates CSS variables', async () => {
      // Initial theme (default)
      const primaryInitial = await cosmic.rootCssVar('--primary');
      expect(primaryInitial.toLowerCase()).toBe('#2a2358');

      // Click once -> nebula (first transition)
      await cosmic.clickTheme();
      const primaryNebula = await cosmic.rootCssVar('--primary');
      expect(primaryNebula.toLowerCase()).toBe('#1a1b3a');

      // Click second -> cosmic
      await cosmic.clickTheme();
      const primaryCosmic = await cosmic.rootCssVar('--primary');
      expect(primaryCosmic.toLowerCase()).toBe('#3a1b5a');

      // Click third -> back to default
      await cosmic.clickTheme();
      const primaryBack = await cosmic.rootCssVar('--primary');
      expect(primaryBack.toLowerCase()).toBe('#2a2358');
    });

    test('Theme cycles correctly after many clicks (edge case)', async () => {
      // Click theme 10 times and verify it cycles predictably (themes length = 3)
      const cycleCount = 10;
      for (let i = 0; i < cycleCount; i++) {
        await cosmic.clickTheme();
      }

      // After 10 clicks, the index should be (initialIndex + 10) % 3 = (0 + 10) % 3 = 1 => nebula
      const primaryAfter = await cosmic.rootCssVar('--primary');
      expect(primaryAfter.toLowerCase()).toBe('#1a1b3a');
    });
  });

  test.describe('DOM integrity and script side-effects', () => {
    test('Stars generation and presence of expected elements', async () => {
      // Validate planets exist and have expected class names
      const planet1Exists = await cosmic.page.locator('.planet-1').count();
      const planet2Exists = await cosmic.page.locator('.planet-2').count();
      const planet3Exists = await cosmic.page.locator('.planet-3').count();
      expect(planet1Exists).toBe(1);
      expect(planet2Exists).toBe(1);
      expect(planet3Exists).toBe(1);

      // Galaxy should have pulse class initially
      const galaxyHasPulse = await cosmic.page.evaluate(() => {
        const g = document.querySelector('.galaxy');
        return g && g.classList.contains('pulse');
      });
      expect(galaxyHasPulse).toBe(true);
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('No uncaught runtime errors or console.error entries were emitted during interactions', async ({ page }) => {
      // Interact a bit to exercise scripts
      await cosmic.clickPause();
      await cosmic.clickTheme();
      await cosmic.clickPause();
      await cosmic.clickTheme();

      // Small wait to ensure any asynchronous console messages or errors arrive
      await page.waitForTimeout(250);

      // Assert that there were no uncaught exceptions (pageerror)
      // The application should not throw ReferenceError, TypeError, SyntaxError in normal operation.
      expect(pageErrors.length).toBe(0);

      // Ensure there are no console.error messages captured
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      // Allow warnings but assert there are no 'error' console messages
      const errorsOnly = consoleMessages.filter(m => m.type === 'error');
      expect(errorsOnly.length).toBe(0);

      // Optionally assert there were informative console messages (not required)
      // This assertion is just to ensure our capture worked; it's okay if it's empty.
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });
});