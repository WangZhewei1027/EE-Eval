import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f7b383-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object to encapsulate interactions and queries for the page under test
class NoSQLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pauseBtn = page.locator('#pauseBtn');
    this.pauseLabel = page.locator('#pauseLabel');
    this.infoBtn = page.locator('#infoBtn');
    this.modal = page.locator('#modal');
    this.modalClose = page.locator('#modalClose');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // allow initial canvas/seeding time so animations have initialized
    await this.page.waitForTimeout(150);
  }

  async clickPause() {
    await this.pauseBtn.click();
    // allow handlers time to run
    await this.page.waitForTimeout(40);
  }

  async clickInfo() {
    await this.infoBtn.click();
    await this.page.waitForTimeout(40);
  }

  async clickModalClose() {
    await this.modalClose.click();
    await this.page.waitForTimeout(40);
  }

  async pressEscape() {
    // Press Escape at the page-level (sends to window)
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(40);
  }

  async isBodyPaused() {
    return this.page.evaluate(() => document.body.classList.contains('paused'));
  }

  async isModalOpen() {
    return this.page.evaluate(() => {
      const modal = document.getElementById('modal');
      return modal && modal.classList.contains('open');
    });
  }

  async getPauseLabelText() {
    return this.pauseLabel.textContent();
  }

  async pauseBtnHasClassPaused() {
    return this.pauseBtn.evaluate((el) => el.classList.contains('paused'));
  }

  async isNebulaRunning() {
    // If __nebulaControl is missing, return null to indicate not present
    return this.page.evaluate(() => {
      // intentionally do not patch anything; observe natural state
      if (window.__nebulaControl && typeof window.__nebulaControl.isRunning === 'function') {
        try {
          return window.__nebulaControl.isRunning();
        } catch (e) {
          // bubble up as undefined, tests will assert expected behavior
          return null;
        }
      }
      return null;
    });
  }

  async modalAttributes() {
    return this.page.evaluate(() => {
      const modal = document.getElementById('modal');
      if (!modal) return null;
      return {
        role: modal.getAttribute('role'),
        ariaModal: modal.getAttribute('aria-modal'),
        ariaLabelledby: modal.getAttribute('aria-labelledby')
      };
    });
  }
}

test.describe('NoSQL — Visual Exposition (FSM validation)', () => {
  // capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // collect console messages for later assertions (info/warn/error)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // capture any uncaught page errors (ReferenceError, TypeError, etc)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // nothing to tear down specific; listeners are discarded with page
  });

  test('Initial state (S0_Idle) - page renders and animations appear running', async ({ page }) => {
    // Validate initial Idle state rendering and evidence
    const p = new NoSQLPage(page);
    await p.goto();

    // The controls container and pause button should be present (evidence of S0_Idle)
    await expect(page.locator('.controls')).toBeVisible();
    await expect(page.locator('#pauseBtn')).toBeVisible();

    // Body should not have 'paused' class initially
    expect(await p.isBodyPaused()).toBeFalsy();

    // Pause label should read "Pause"
    expect(await p.getPauseLabelText()).toBe('Pause');

    // Modal should not be open
    expect(await p.isModalOpen()).toBeFalsy();

    // Nebula control should be present and running (not forcibly stopped)
    const running = await p.isNebulaRunning();
    // we allow null if the global isn't available, but when present expect true initially
    if (running !== null) expect(running).toBeTruthy();

    // No uncaught errors should have occurred up to initial load
    expect(pageErrors.length).toBe(0);

    // A basic sanity check: modal element exists and has expected attributes
    const attrs = await p.modalAttributes();
    expect(attrs).not.toBeNull();
    expect(attrs.role).toBe('dialog');
    expect(attrs.ariaModal).toBe('true');
    expect(typeof attrs.ariaLabelledby).toBe('string');
  });

  test('PauseToggle: clicking pause toggles animations to Paused (S0 -> S1)', async ({ page }) => {
    // Validate clicking pause enters Paused state
    const p = new NoSQLPage(page);
    await p.goto();

    // Click pause button -> enters paused state
    await p.clickPause();

    // Body should have 'paused' class
    expect(await p.isBodyPaused()).toBeTruthy();

    // Pause label should update to "Resume"
    expect(await p.getPauseLabelText()).toBe('Resume');

    // Pause button should have 'paused' class
    expect(await p.pauseBtnHasClassPaused()).toBeTruthy();

    // Nebula animation should be stopped
    const running = await p.isNebulaRunning();
    if (running !== null) expect(running).toBeFalsy();

    // No uncaught page errors during toggle
    expect(pageErrors.length).toBe(0);
  });

  test('PauseToggle: clicking pause again returns to Idle/resumes animations (S1 -> S0)', async ({ page }) => {
    // Validate toggling pause twice resumes
    const p = new NoSQLPage(page);
    await p.goto();

    // Enter paused first
    await p.clickPause();
    expect(await p.isBodyPaused()).toBeTruthy();
    expect(await p.getPauseLabelText()).toBe('Resume');

    // Click again to resume
    await p.clickPause();
    expect(await p.isBodyPaused()).toBeFalsy();
    expect(await p.getPauseLabelText()).toBe('Pause');
    expect(await p.pauseBtnHasClassPaused()).toBeFalsy();

    const running = await p.isNebulaRunning();
    if (running !== null) expect(running).toBeTruthy();

    // No uncaught page errors during toggle/resume
    expect(pageErrors.length).toBe(0);
  });

  test('OpenModal: clicking info opens modal and pauses animations (S0 -> S2)', async ({ page }) => {
    // Validate opening modal sets modal.open and pauses body
    const p = new NoSQLPage(page);
    await p.goto();

    // Ensure initial not paused
    expect(await p.isBodyPaused()).toBeFalsy();
    expect(await p.isModalOpen()).toBeFalsy();

    // Click info button to open modal
    await p.clickInfo();

    // Modal should have .open
    expect(await p.isModalOpen()).toBeTruthy();

    // Body should be paused when modal is open (entry action adds paused class)
    expect(await p.isBodyPaused()).toBeTruthy();

    // Pause label should display 'Resume' as script sets paused=true when opening modal
    expect(await p.getPauseLabelText()).toBe('Resume');

    // Nebula should be stopped
    const running = await p.isNebulaRunning();
    if (running !== null) expect(running).toBeFalsy();

    // No uncaught page errors while opening modal
    expect(pageErrors.length).toBe(0);
  });

  test('CloseModal: clicking close closes modal and resumes animations (S2 -> S0)', async ({ page }) => {
    // Validate close button behavior after opening modal
    const p = new NoSQLPage(page);
    await p.goto();

    // Open modal first
    await p.clickInfo();
    expect(await p.isModalOpen()).toBeTruthy();
    expect(await p.isBodyPaused()).toBeTruthy();

    // Click close to close modal
    await p.clickModalClose();

    // Modal should no longer be open
    expect(await p.isModalOpen()).toBeFalsy();

    // Body should not be paused (close handler resumes)
    expect(await p.isBodyPaused()).toBeFalsy();

    // Pause label should be back to 'Pause'
    expect(await p.getPauseLabelText()).toBe('Pause');

    // Nebula should be running again
    const running = await p.isNebulaRunning();
    if (running !== null) expect(running).toBeTruthy();

    // No uncaught page errors on close
    expect(pageErrors.length).toBe(0);
  });

  test('EscapeCloseModal: pressing Escape closes the modal and resumes animations (S2 -> S0 via Escape)', async ({ page }) => {
    // Validate Escape key closes modal when open
    const p = new NoSQLPage(page);
    await p.goto();

    // Open modal
    await p.clickInfo();
    expect(await p.isModalOpen()).toBeTruthy();
    expect(await p.isBodyPaused()).toBeTruthy();

    // Press Escape to trigger window keydown handler
    await p.pressEscape();

    // Confirm modal closed
    expect(await p.isModalOpen()).toBeFalsy();

    // Confirm body not paused and animations resumed
    expect(await p.isBodyPaused()).toBeFalsy();
    expect(await p.getPauseLabelText()).toBe('Pause');
    const running = await p.isNebulaRunning();
    if (running !== null) expect(running).toBeTruthy();

    // No uncaught page errors triggered by Escape handling
    expect(pageErrors.length).toBe(0);
  });

  test('Edge: pressing Escape when modal is closed causes no errors', async ({ page }) => {
    // When modal is closed, Escape should be a no-op and not produce page errors
    const p = new NoSQLPage(page);
    await p.goto();

    // Ensure modal closed
    expect(await p.isModalOpen()).toBeFalsy();

    // Clear any previously captured errors (should be none)
    // (pageErrors is reset in beforeEach, so we simply press)
    await p.pressEscape();

    // Modal still closed
    expect(await p.isModalOpen()).toBeFalsy();

    // No new page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge: open modal while manually paused, then close — validates implemented resume behavior (bug verification)', async ({ page }) => {
    // This test verifies the observed (implemented) behavior:
    // If user manually pauses, then opens modal, closing the modal will resume animations
    // even though the user had paused manually. We assert this behaviour as-is.
    const p = new NoSQLPage(page);
    await p.goto();

    // Manually pause
    await p.clickPause();
    expect(await p.isBodyPaused()).toBeTruthy();
    expect(await p.getPauseLabelText()).toBe('Resume');

    // Now open modal while already paused
    await p.clickInfo();
    expect(await p.isModalOpen()).toBeTruthy();
    // modal open sets document.body.classList.add('paused') and paused = true again
    expect(await p.isBodyPaused()).toBeTruthy();
    expect(await p.getPauseLabelText()).toBe('Resume');

    // Click close on modal: per implementation, the close handler will set paused = true then
    // remove body.paused then set paused = false and update label to 'Pause' — thus resuming.
    await p.clickModalClose();

    // Modal closed
    expect(await p.isModalOpen()).toBeFalsy();

    // Body paused should be false (resumed)
    expect(await p.isBodyPaused()).toBeFalsy();

    // Pause label should be 'Pause' indicating resumed state
    expect(await p.getPauseLabelText()).toBe('Pause');

    // Nebula should be running again
    const running = await p.isNebulaRunning();
    if (running !== null) expect(running).toBeTruthy();

    // No uncaught page errors for this scenario
    expect(pageErrors.length).toBe(0);
  });

  test('Instrumentation: capture console messages and ensure no unexpected errors logged', async ({ page }) => {
    // This test demonstrates how console messages and page errors are observed.
    const p = new NoSQLPage(page);
    await p.goto();

    // perform a few interactions to generate potential console entries
    await p.clickPause();
    await p.clickPause();
    await p.clickInfo();
    await p.pressEscape();

    // Allow any async console messages to be emitted
    await page.waitForTimeout(100);

    // There should be no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Console messages may include warnings/info — ensure we captured them as an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // At minimum there should be no fatal "error" entries in console of type 'error'
    const fatalErrors = consoleMessages.filter(m => m.type === 'error');
    expect(fatalErrors.length).toBe(0);
  });
});