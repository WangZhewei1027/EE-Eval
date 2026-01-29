import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f876d1-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object encapsulating interactions and queries for the app
class RestVisualPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleBtn = page.locator('#toggleBtn');
    this.btnLabel = page.locator('#btnLabel');
    this.scene = page.locator('#scene');
    this.requestBead = page.locator('.bead.request');
    this.responseBead = page.locator('.bead.response');
  }

  async goto() {
    // Navigate and wait for full load so the load event handler runs
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for scene to be present to avoid racing with entrance animations
    await this.scene.waitFor({ state: 'visible' });
  }

  async clickToggle() {
    await this.toggleBtn.click();
  }

  async isRunning() {
    // Returns true if the scene element has class 'running'
    return await this.scene.evaluate((el) => el.classList.contains('running'));
  }

  async ariaPressed() {
    return await this.toggleBtn.getAttribute('aria-pressed');
  }

  async labelText() {
    return await this.btnLabel.textContent();
  }

  async bodyOpacity() {
    return await this.page.evaluate(() => document.body.style.opacity);
  }

  async requestBeadAnimationName() {
    return await this.requestBead.evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('animation-name') || window.getComputedStyle(el).animationName;
    });
  }

  async responseBeadAnimationName() {
    return await this.responseBead.evaluate((el) => {
      return window.getComputedStyle(el).getPropertyValue('animation-name') || window.getComputedStyle(el).animationName;
    });
  }
}

// Capture console errors and page errors; helper to return arrays after navigation
async function captureConsoleAndPageErrors(page, fn) {
  const consoleErrors = [];
  const pageErrors = [];

  const onConsole = (msg) => {
    // collect only error-level console messages
    if (msg.type() === 'error') {
      // collect text for assertions
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  };

  const onPageError = (err) => {
    pageErrors.push(err);
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  try {
    await fn();
  } finally {
    // remove listeners to avoid leaking between tests
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }

  return { consoleErrors, pageErrors };
}

test.describe('REST API Visual Concept — FSM and UI validation', () => {
  // Standard setup: each test gets a fresh page and navigates to the app
  test.beforeEach(async ({ page }) => {
    // no-op here; each test will call goto via page object so we can capture errors per test
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Initial DOM and Idle state assertions (entry actions executed)', async ({ page }) => {
      // Capture console and page errors emitted during load
      const { consoleErrors, pageErrors } = await captureConsoleAndPageErrors(page, async () => {
        const app = new RestVisualPage(page);
        await app.goto();
        // Validate Idle state: scene should not have running class
        expect(await app.isRunning()).toBe(false);

        // Button should exist and indicate aria-pressed="false"
        const aria = await app.ariaPressed();
        expect(aria).toBe('false');

        // Label should show "Animate Flow" in Idle
        expect((await app.labelText()).trim()).toBe('Animate Flow');

        // Entry action: on load the script sets body.style.opacity = 1
        // Validate that the load handler ran and modified body inline style
        const opacity = await app.bodyOpacity();
        expect(opacity).toBe('1');

        // Before toggling, beads should not have active animation names
        const reqAnim = await app.requestBeadAnimationName();
        const resAnim = await app.responseBeadAnimationName();
        // In Idle state, animations should be absent or "none"
        expect(reqAnim === '' || reqAnim === 'none').toBeTruthy();
        expect(resAnim === '' || resAnim === 'none').toBeTruthy();
      });

      // Assert there were no console errors or unhandled page errors during initial load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Accessibility attributes and button metadata present', async ({ page }) => {
      const app = new RestVisualPage(page);
      await app.goto();

      // The toggle button should have a title attribute describing its purpose
      const title = await page.locator('#toggleBtn').getAttribute('title');
      expect(title).toMatch(/Animate request \/ response flow/);

      // The scene should have aria-hidden explicitly set to false per implementation
      const sceneAriaHidden = await page.locator('#scene').getAttribute('aria-hidden');
      expect(sceneAriaHidden).toBe('false');

      // Network path has role="img" and an accessible label
      const networkPath = page.locator('.path');
      expect(await networkPath.getAttribute('role')).toBe('img');
      expect(await networkPath.getAttribute('aria-label')).toBe('Network path');
    });
  });

  test.describe('Transitions (ToggleFlow event) between S0_Idle and S1_Running', () => {
    test('Clicking toggle transitions from Idle -> Running and updates DOM/CSS', async ({ page }) => {
      const { consoleErrors, pageErrors } = await captureConsoleAndPageErrors(page, async () => {
        const app = new RestVisualPage(page);
        await app.goto();

        // Precondition: Idle
        expect(await app.isRunning()).toBe(false);
        expect(await app.ariaPressed()).toBe('false');

        // Trigger the ToggleFlow event (user click)
        await app.clickToggle();

        // After click: running should be true, aria-pressed true, label updated
        expect(await app.isRunning()).toBe(true);
        expect(await app.ariaPressed()).toBe('true');
        expect((await app.labelText()).trim()).toBe('Pause Flow');

        // When running, the beads should have animation names set (animation applied via CSS)
        const reqAnim = await app.requestBeadAnimationName();
        const resAnim = await app.responseBeadAnimationName();
        // animation-name may include commas for multiple animations; test for presence of expected names
        expect(reqAnim.includes('moveRequest')).toBeTruthy();
        expect(resAnim.includes('moveResponse')).toBeTruthy();

        // Flow arrow path should have its active element visible due to 'running' class; check computed opacity
        const flowActiveOpacity = await page.$eval('.flow-active', (el) => {
          return window.getComputedStyle(el).getPropertyValue('opacity');
        });
        // When running, CSS sets animation that also makes opacity 1; at least ensure it's not '0'
        expect(flowActiveOpacity).not.toBe('0');
      });

      // Assert no console.error or page error occurred during the transition
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking toggle again transitions from Running -> Idle and reverts DOM/CSS', async ({ page }) => {
      const app = new RestVisualPage(page);
      await app.goto();

      // Enter Running first
      await app.clickToggle();
      expect(await app.isRunning()).toBe(true);
      expect(await app.ariaPressed()).toBe('true');

      // Now click again to go back to Idle
      await app.clickToggle();

      // Validate Idle state restored
      expect(await app.isRunning()).toBe(false);
      expect(await app.ariaPressed()).toBe('false');
      expect((await app.labelText()).trim()).toBe('Animate Flow');

      // Animations should stop (animation-name should be none or empty)
      const reqAnim = await app.requestBeadAnimationName();
      const resAnim = await app.responseBeadAnimationName();
      expect(reqAnim === '' || reqAnim === 'none').toBeTruthy();
      expect(resAnim === '' || resAnim === 'none').toBeTruthy();
    });

    test('Repeated rapid toggles result in consistent final state (edge case)', async ({ page }) => {
      const app = new RestVisualPage(page);
      await app.goto();

      // Rapidly click the toggle button odd number of times (5) to ensure final state flips
      for (let i = 0; i < 5; i++) {
        // small deliberate micro-wait to simulate a real user but still quick
        await app.clickToggle();
      }

      // After 5 toggles starting from false => final should be true (odd flips)
      expect(await app.isRunning()).toBe(true);
      expect(await app.ariaPressed()).toBe('true');

      // Now perform 4 more quick toggles (even), should end up true -> false
      for (let i = 0; i < 4; i++) {
        await app.clickToggle();
      }
      // 5 + 4 = 9 toggles => still odd => expected final true
      expect(await app.isRunning()).toBe(true);

      // Now one more to make it even and go to false
      await app.clickToggle();
      expect(await app.isRunning()).toBe(false);
    });
  });

  test.describe('Robustness checks: console/page errors, attributes, and unexpected scenarios', () => {
    test('No JavaScript runtime errors or console.error messages during typical interactions', async ({ page }) => {
      // This test exercises navigation, a couple of toggles, and asserts zero errors were captured
      const { consoleErrors, pageErrors } = await captureConsoleAndPageErrors(page, async () => {
        const app = new RestVisualPage(page);
        await app.goto();

        // perform a few interactions
        await app.clickToggle();
        await page.waitForTimeout(50); // allow CSS/JS toggles to settle
        await app.clickToggle();
        await page.waitForTimeout(50);
      });

      // Expect zero console.error messages and zero unhandled page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Button and scene survive if clicked when already in desired state (idempotency)', async ({ page }) => {
      const app = new RestVisualPage(page);
      await app.goto();

      // Ensure Idle; click when already Idle (should toggle to running, so to test idempotency we toggle twice)
      await app.clickToggle(); // Idle -> Running
      expect(await app.isRunning()).toBe(true);

      // Click while running to go back to Idle
      await app.clickToggle();
      expect(await app.isRunning()).toBe(false);

      // Click once more to go to Running and ensure no exceptions / state corruption
      await app.clickToggle();
      expect(await app.isRunning()).toBe(true);

      // Verify accessible label and aria reflect expected state
      expect((await app.labelText()).trim()).toBe('Pause Flow');
      expect(await app.ariaPressed()).toBe('true');
    });

    test('Scene DOM remains present and does not get removed (sanity check)', async ({ page }) => {
      const app = new RestVisualPage(page);
      await app.goto();

      // Ensure the scene element exists and keeps its children (beads)
      const sceneVisible = await page.isVisible('#scene');
      expect(sceneVisible).toBe(true);

      const requestBeadVisible = await page.isVisible('.bead.request');
      const responseBeadVisible = await page.isVisible('.bead.response');
      expect(requestBeadVisible).toBe(true);
      expect(responseBeadVisible).toBe(true);
    });
  });
});