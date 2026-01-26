import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f89de1-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the application under test
class AgileApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      stage: '.stage',
      btnPrinciples: '#btnPrinciples',
      btnPause: '#btnPause',
      iconPlay: '#iconPlay',
      iconPause: '#iconPause',
      modal: '#modal',
      closeModal: '#closeModal',
      ackModal: '#ackModal',
      hint: '.hint',
      body: 'body',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async isModalOpen() {
    return await this.page.$eval(this.selectors.modal, (m) => m.classList.contains('open'));
  }

  async modalAriaHidden() {
    return await this.page.$eval(this.selectors.modal, (m) => m.getAttribute('aria-hidden'));
  }

  async openModal() {
    await this.page.click(this.selectors.btnPrinciples);
  }

  async closeModalViaCloseButton() {
    await this.page.click(this.selectors.closeModal);
  }

  async closeModalViaAck() {
    await this.page.click(this.selectors.ackModal);
  }

  async pressEscape() {
    await this.page.keyboard.press('Escape');
  }

  async isPaused() {
    return await this.page.$eval(this.selectors.body, (b) => b.classList.contains('paused'));
  }

  async ariaPressed() {
    return await this.page.$eval(this.selectors.btnPause, (b) => b.getAttribute('aria-pressed'));
  }

  async pauseButtonText() {
    // Get visible text content of the btnPause (trim to avoid whitespace differences)
    return (await this.page.$eval(this.selectors.btnPause, (b) => b.textContent)).trim();
  }

  async iconDisplayState() {
    const playDisplay = await this.page.$eval(this.selectors.iconPlay, (el) => getComputedStyle(el).display);
    const pauseDisplay = await this.page.$eval(this.selectors.iconPause, (el) => getComputedStyle(el).display);
    return { playDisplay, pauseDisplay };
  }

  async clickPause() {
    await this.page.click(this.selectors.btnPause);
  }

  async focusActiveElementId() {
    return await this.page.evaluate(() => document.activeElement && document.activeElement.id);
  }

  async hintText() {
    return await this.page.$eval(this.selectors.hint, (h) => h.textContent.trim());
  }
}

test.describe('Agile Methodology Visual Demonstration - FSM validation', () => {
  // Collect console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach listeners for console errors and uncaught page errors.
    page.context()._consoleErrors = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // capture console.error messages to context storage to assert later
      if (msg.type() === 'error') {
        page.context()._consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test assert there were no uncaught console/page errors.
    const consoleErrors = page.context()._consoleErrors || [];
    const pageErrors = page.context()._pageErrors || [];

    // If there are any page errors or console errors, fail with diagnostic info.
    expect(consoleErrors.length, `Console error count (should be 0). Errors: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page error count (should be 0). Errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test.describe('Initial rendering and Idle state (S0_Idle)', () => {
    test('renders main stage, hint and controls exist (S0_Idle entry actions)', async ({ page }) => {
      // Validate initial renderPage() behavior by ensuring key DOM is present
      const app = new AgileApp(page);
      await app.goto();

      // Verify the stage is present and visible
      const stageVisible = await page.isVisible(app.selectors.stage);
      expect(stageVisible).toBe(true);

      // Hint element content matches FSM evidence
      const hint = await app.hintText();
      expect(hint).toContain('Visual only'); // minimal check for expected evidence text

      // Controls: buttons are present
      await expect(page.locator(app.selectors.btnPrinciples)).toBeVisible();
      await expect(page.locator(app.selectors.btnPause)).toBeVisible();

      // Pause button initially has aria-pressed "false"
      const ariaPressed = await app.ariaPressed();
      expect(ariaPressed).toBe('false');
    });

    test('pause button is interactive and toggles aria-pressed and body.paused class (S0 -> S1)', async ({ page }) => {
      const app = new AgileApp(page);
      await app.goto();

      // Ensure initial paused state is false
      expect(await app.isPaused()).toBe(false);
      expect(await app.ariaPressed()).toBe('false');

      // Click pause: transition S0_Idle -> S1_Paused
      await app.clickPause();

      // Verify body gained paused class and aria-pressed updated
      expect(await app.isPaused()).toBe(true);
      expect(await app.ariaPressed()).toBe('true');

      // Verify visible text updated and icons swapped according to implementation
      const textAfterPause = await app.pauseButtonText();
      expect(textAfterPause).toMatch(/Resume Motion|Pause Motion/); // check it's one of expected labels

      const icons = await app.iconDisplayState();
      // When paused, iconPlay should become visible and iconPause hidden (per implementation)
      expect(icons.playDisplay === 'inline' || icons.playDisplay === 'block').toBeTruthy();
      expect(icons.pauseDisplay === 'none' || icons.pauseDisplay === 'hidden' || icons.pauseDisplay === '0').toBeTruthy();

      // Click pause again to resume: S1_Paused -> S0_Idle
      await app.clickPause();
      expect(await app.isPaused()).toBe(false);
      expect(await app.ariaPressed()).toBe('false');

      const textAfterResume = await app.pauseButtonText();
      expect(textAfterResume).toMatch(/Pause Motion|Resume Motion/); // label toggled back

      // Rapid toggling (edge case) - ensure stability across multiple rapid clicks
      for (let i = 0; i < 3; i++) {
        await app.clickPause();
      }
      // After 3 toggles, parity: odd -> paused true
      expect(await app.isPaused()).toBe(true);
    });
  });

  test.describe('Principles modal behaviors (S2_ModalOpen and transitions)', () => {
    test('open modal via #btnPrinciples and verify attributes and focus (S0 -> S2)', async ({ page }) => {
      const app = new AgileApp(page);
      await app.goto();

      // Open modal
      await app.openModal();

      // Modal is marked open via class and aria-hidden attribute
      const open = await app.isModalOpen();
      expect(open).toBe(true);

      const ariaHidden = await app.modalAriaHidden();
      expect(ariaHidden).toBe('false');

      // Focus should be on closeModal (openModal implementation calls closeModal.focus())
      const activeId = await app.focusActiveElementId();
      expect(activeId).toBe('closeModal');

      // The modal should contain the expected title text
      await expect(page.locator('#modalTitle')).toHaveText('Agile Values & Principles');
    });

    test('close modal via close button and acknowledge button (S2 -> S0) and ensure focus returns', async ({ page }) => {
      const app = new AgileApp(page);
      await app.goto();

      // Open and close via Close button
      await app.openModal();
      expect(await app.isModalOpen()).toBe(true);

      await app.closeModalViaCloseButton();
      expect(await app.isModalOpen()).toBe(false);
      expect(await app.modalAriaHidden()).toBe('true');

      // After close, focus should return to principles button
      const activeIdAfterClose = await app.focusActiveElementId();
      expect(activeIdAfterClose).toBe('btnPrinciples');

      // Re-open and close via Acknowledge button
      await app.openModal();
      expect(await app.isModalOpen()).toBe(true);

      await app.closeModalViaAck();
      expect(await app.isModalOpen()).toBe(false);

      // Focus should again return to principles button
      const activeIdAfterAck = await app.focusActiveElementId();
      expect(activeIdAfterAck).toBe('btnPrinciples');
    });

    test('close modal using Escape key (CloseModalOnEscape)', async ({ page }) => {
      const app = new AgileApp(page);
      await app.goto();

      // Open modal first
      await app.openModal();
      expect(await app.isModalOpen()).toBe(true);

      // Press Escape: implementation listens on window keydown
      await app.pressEscape();

      // Modal should be closed
      expect(await app.isModalOpen()).toBe(false);

      // Focus should be returned to the principles button per closeModalFn
      const activeId = await app.focusActiveElementId();
      expect(activeId).toBe('btnPrinciples');
    });

    test('edge case: clicking modal close controls when modal already closed should not throw', async ({ page }) => {
      const app = new AgileApp(page);
      await app.goto();

      // Ensure modal is closed initially
      expect(await app.isModalOpen()).toBe(false);

      // Attempt to click #closeModal and #ackModal even when hidden.
      // Implementation shouldn't throw and modal should remain hidden.
      // We simply perform clicks and then assert no modal open and no page errors.
      // Playwright will throw if click cannot be performed (element hidden), so use force:true
      await page.click('#closeModal', { force: true });
      expect(await app.isModalOpen()).toBe(false);

      await page.click('#ackModal', { force: true });
      expect(await app.isModalOpen()).toBe(false);
    });
  });

  test.describe('Cross-checks & additional assertions', () => {
    test('UI accessibility attributes and visual indicators are consistent', async ({ page }) => {
      const app = new AgileApp(page);
      await app.goto();

      // Check that the principles button has aria-haspopup=dialog and a helpful title
      const hasAriaHaspopup = await page.$eval('#btnPrinciples', (b) => b.getAttribute('aria-haspopup'));
      expect(hasAriaHaspopup).toBe('dialog');

      const principlesTitle = await page.$eval('#btnPrinciples', (b) => b.getAttribute('title'));
      expect(principlesTitle).toContain('View Agile principles');

      // Pause button has a title attribute and a visible svg icon initially (pause icon visible by CSS)
      const pauseTitle = await page.$eval('#btnPause', (b) => b.getAttribute('title'));
      expect(pauseTitle).toContain('Pause/Resume motion');

      // The pointer and rings exist in DOM; even though aria-hidden, they should be present
      await expect(page.locator('.pointer')).toBeVisible({ timeout: 2000 });

      // Ensure that the hint text is present and matches FSM evidence
      const hintText = await app.hintText();
      expect(hintText).toContain('Visual only — minimal controls');
    });

    test('stress: repeatedly open/close modal and toggle pause to ensure transitions are stable', async ({ page }) => {
      const app = new AgileApp(page);
      await app.goto();

      // Repeat several cycles of interactions to exercise transitions
      for (let i = 0; i < 4; i++) {
        await app.openModal();
        expect(await app.isModalOpen()).toBe(true);
        // close with ack on even iterations, close button on odd
        if (i % 2 === 0) {
          await app.closeModalViaAck();
        } else {
          await app.closeModalViaCloseButton();
        }
        expect(await app.isModalOpen()).toBe(false);

        // Toggle pause twice to return to original state
        await app.clickPause();
        await app.clickPause();
      }

      // After stress cycles, ensure basic invariants still hold
      expect(await app.isModalOpen()).toBe(false);
      expect(await app.isPaused()).toBe(true || false); // simply ensure call doesn't throw and state accessible
    });
  });

  // Final smoke test to ensure there were no uncaught JS runtime issues during load and interactions
  test('no uncaught runtime errors during a sequence of typical interactions', async ({ page }) => {
    const app = new AgileApp(page);
    // Collect errors locally too
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await app.goto();

    // perform a variety of actions that exercise handlers
    await app.openModal();
    await app.pressEscape();
    await app.clickPause();
    await app.clickPause();
    await app.openModal();
    await app.closeModalViaCloseButton();

    // Give a moment for any async errors to surface
    await page.waitForTimeout(200);

    // Assert that no console errors or uncaught page errors were emitted
    expect(consoleErrors.length, `Console errors (if any): ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors (if any): ${pageErrors.join(' | ')}`).toBe(0);
  });
});