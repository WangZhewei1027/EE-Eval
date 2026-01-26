import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f9d660-fa77-11f0-a6a1-c765f41a13c7.html';

// Tests for the Authentication — Visual Concept interactive demo.
// The tests validate the FSM states: Idle, Authenticating, Success
// and events/transitions: AuthenticateClick, ResetClick, AuthKeyUp, ResetKeyUp.
// They also observe console messages and uncaught page errors.
//
// NOTE: The page includes a demo auto-run (startAuth called after load ~700ms).
// Tests are written to be tolerant of that auto-start (they introspect current state
// before taking actions to avoid flakiness).

test.describe('f1f9d660-fa77-11f0-a6a1-c765f41a13c7 — Authentication visual demo', () => {
  // Capture console messages and page errors for each test.
  test.beforeEach(async ({ page }) => {
    // Arrays to collect messages / errors for assertions.
    page.context().consoleMessages = [];
    page.context().pageErrors = [];

    page.on('console', (msg) => {
      // Store console events with type and text for inspection.
      page.context().consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Uncaught exceptions on the page
      page.context().pageErrors.push(err);
    });

    // Navigate to the page; allow load to complete.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // On teardown, attach a brief check that no fatal page errors remained unobserved.
    // This check is intentionally lenient and reports any uncaught page errors.
    const errors = page.context().pageErrors || [];
    // Expose the errors via a standard Playwright expectation (fail test if there are any).
    expect(errors.length, `Uncaught page errors (if any): ${errors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  test('Initial Idle state or possible auto-authentication on load (robust check)', async ({ page }) => {
    // This test validates the initial conditions of the page.
    // Because the demo auto-starts authentication after load (~700ms), we accept either:
    // - Idle: status not visible, auth button unpressed, reset hidden
    // - Authenticating: status visible with message "Authenticating…"
    const status = await page.$('#status');
    const authBtn = await page.$('#authBtn');
    const resetBtn = await page.$('#resetBtn');

    expect(status, 'status element should exist').not.toBeNull();
    expect(authBtn, 'authBtn should exist').not.toBeNull();
    expect(resetBtn, 'resetBtn should exist').not.toBeNull();

    // Read current attributes and classes
    const statusClasses = await page.evaluate((el) => el.className, status);
    const authPressed = await page.getAttribute('#authBtn', 'aria-pressed');
    const resetAriaHidden = await page.getAttribute('#resetBtn', 'aria-hidden');
    const msgText = await page.textContent('#msg');

    // Validate that the auth button exists and has an aria-pressed attribute (idle or active)
    expect(authPressed).not.toBeNull();

    // Accept either Idle or Authenticating depending on timing.
    if (statusClasses.includes('visible')) {
      // We are in Authenticating (auto-run or late test). Message should be either 'Authenticating…' or may progress.
      expect(msgText).toMatch(/Authenticating|Access Granted/);
      // Reset button should be hidden/aria-hidden true until success
      expect(resetAriaHidden).toBe('true');
    } else {
      // Idle expectations
      expect(statusClasses).not.toContain('visible');
      expect(authPressed).toBe('false');
      // Reset hidden initially
      expect(resetAriaHidden).toBe('true');
      // Message element should still contain the default 'Authenticating…' text
      expect(msgText).toContain('Authenticating');
    }

    // Check that no console errors were emitted during initial load
    const consoleErrors = (page.context().consoleMessages || []).filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Authenticate by clicking the Authenticate button — transitions to Authenticating then Success', async ({ page }) => {
    // This test triggers the authentication flow via click, verifies Authenticating observables,
    // waits for Success, and asserts DOM changes: status.visible, msg text, success class, token visible, reset visible.

    // Ensure we start from a stable state: read current status and, if already running, reset first.
    const statusEl = await page.$('#status');
    const statusClass = await page.evaluate((el) => el.className, statusEl);
    if (statusClass.includes('visible')) {
      // If an auto-run already started, wait for it to complete or reset to idle
      // We will wait until either success appears or it returns to idle; cap wait.
      await page.waitForTimeout(2600); // allow any pending auto-run to finish
    }

    // Trigger authentication via click
    await page.click('#authBtn');

    // Immediately after click: Authenticating state expectations
    await expect(page.locator('#status')).toHaveClass(/visible/);
    await expect(page.locator('#msg')).toHaveText('Authenticating…');

    // The auth button should reflect pressed state
    await expect(page.locator('#authBtn')).toHaveAttribute('aria-pressed', 'true');

    // Wait for success state (timer2 in source ~2400ms). Give generous timeout.
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.classList.contains('success');
    }, null, { timeout: 5000 });

    // Validate Success observables
    await expect(page.locator('#status')).toHaveClass(/success/);
    await expect(page.locator('#msg')).toHaveText('Access Granted');
    // Token should be aria-hidden false and visible via CSS class on status
    await expect(page.locator('#token')).toHaveAttribute('aria-hidden', 'false');
    // Reset button becomes visible (class 'visible' toggled)
    const resetVisibleClass = await page.evaluate(() => document.getElementById('resetBtn').className);
    expect(resetVisibleClass).toMatch(/visible/);

    // Also validate success visual is present (the success element is not hidden)
    const successDisplay = await page.$('#success');
    expect(successDisplay).not.toBeNull();

    // Ensure no console error messages were logged during the flow
    const consoleErrors = (page.context().consoleMessages || []).filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Authenticate via Enter key (AuthKeyUp) triggers same flow as click', async ({ page }) => {
    // Focus the button and press Enter to trigger keyboard-based startAuth().
    // This validates the AuthKeyUp event handling on #authBtn.

    // Ensure page in idle or stable state before test: allow any auto-run to finish.
    await page.waitForTimeout(800); // let potential auto-start happen

    // Focus the auth button
    await page.focus('#authBtn');
    // Send Enter
    await page.keyboard.press('Enter');

    // Expect authenticating state to appear
    await expect(page.locator('#status')).toHaveClass(/visible/);
    await expect(page.locator('#msg')).toHaveText('Authenticating…');

    // Wait for eventual success
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.classList.contains('success');
    }, null, { timeout: 5000 });

    // Validate success text and token visibility
    await expect(page.locator('#msg')).toHaveText('Access Granted');
    await expect(page.locator('#token')).toHaveAttribute('aria-hidden', 'false');

    // Validate that aria-pressed was updated on the button
    await expect(page.locator('#authBtn')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Reset via click after success returns to Idle (ResetClick transition)', async ({ page }) => {
    // Trigger authentication and wait for success, then click reset and verify we return to Idle.

    // Start auth
    await page.click('#authBtn');

    // Wait for success
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.classList.contains('success');
    }, null, { timeout: 5000 });

    // Now reset button should be visible; click it.
    await expect(page.locator('#resetBtn')).toHaveClass(/visible/);
    // Click reset — may be visually visible now.
    await page.click('#resetBtn');

    // After reset, status should no longer have 'visible' or 'success'
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      if (!s) return false;
      return !(s.classList.contains('visible') || s.classList.contains('success'));
    }, null, { timeout: 2000 });

    // Validate Idle observables
    await expect(page.locator('#status')).not.toHaveClass(/visible/);
    await expect(page.locator('#status')).not.toHaveClass(/success/);
    await expect(page.locator('#authBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#msg')).toHaveText('Authenticating…');
    await expect(page.locator('#token')).toHaveAttribute('aria-hidden', 'true');

    // Ensure reset button returned to hidden state aria-hidden true or class removed
    const resetClassAfter = await page.evaluate(() => document.getElementById('resetBtn').className);
    expect(resetClassAfter).not.toMatch(/visible/);
  });

  test('Reset via Enter key (ResetKeyUp) after success returns to Idle', async ({ page }) => {
    // Trigger auth, wait for success, then focus reset and press Enter to trigger keyboard reset.

    // Start authentication
    await page.click('#authBtn');

    // Wait for success
    await page.waitForFunction(() => document.getElementById('status')?.classList.contains('success'), null, { timeout: 5000 });

    // Focus the reset button and press Enter
    await page.focus('#resetBtn');
    await page.keyboard.press('Enter');

    // Validate state returned to Idle — no 'visible' or 'success' on status
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && !s.classList.contains('visible') && !s.classList.contains('success');
    }, null, { timeout: 2000 });

    await expect(page.locator('#msg')).toHaveText('Authenticating…');
    await expect(page.locator('#token')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#authBtn')).toHaveAttribute('aria-pressed', 'false');
  });

  test('Edge case: multiple rapid Authenticate clicks should still produce one successful outcome', async ({ page }) => {
    // Rapidly click Authenticate multiple times and ensure the demo still reaches Success without error.

    // Rapid clicks
    for (let i = 0; i < 4; i++) {
      // Use click; if the element becomes non-interactable, catching any error is acceptable.
      try {
        await page.click('#authBtn');
      } catch (err) {
        // If click fails due to visual timing, ignore — we still expect the flow to succeed once.
      }
    }

    // Wait for success
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.classList.contains('success');
    }, null, { timeout: 6000 });

    // Final assertions
    await expect(page.locator('#msg')).toHaveText('Access Granted');
    await expect(page.locator('#token')).toHaveAttribute('aria-hidden', 'false');

    // Ensure no uncaught page errors were emitted
    const pageErrors = page.context().pageErrors || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: triggering Reset while Authenticating (attempt) — timer clearing behavior', async ({ page }) => {
    // This test attempts to simulate ResetClick while authenticating.
    // In the implementation, the reset control is hidden until success — we will attempt a force-click to simulate
    // the transition described in the FSM (S1_Authenticating -> S0_Idle on ResetClick).
    // We will not modify page code; we will use Playwright's force click to emulate the event dispatch.

    // Start authentication
    await page.click('#authBtn');

    // Ensure we are in authenticating
    await expect(page.locator('#status')).toHaveClass(/visible/);
    await expect(page.locator('#msg')).toHaveText('Authenticating…');

    // Attempt to click the reset button forcibly (even if hidden)
    // If the designer intended Reset to cancel auth, reset() should run and clear timers.
    // Use force: true to dispatch the click regardless of visibility.
    await page.click('#resetBtn', { force: true });

    // After reset, status should remove 'visible' quickly
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && !s.classList.contains('visible');
    }, null, { timeout: 2000 });

    // Validate Idle-like observables
    await expect(page.locator('#authBtn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#msg')).toHaveText('Authenticating…');

    // Wait a moment longer to ensure no delayed success appears (timers were cleared)
    await page.waitForTimeout(1200);

    // Confirm no success class was added after reset
    const statusClasses = await page.locator('#status').evaluate((el) => el.className);
    expect(statusClasses).not.toMatch(/success/);
  });

  test('Observe and assert that no unexpected runtime errors (ReferenceError/SyntaxError/TypeError) occurred during interactions', async ({ page }) => {
    // This test aggregates console and pageerror events and asserts that no uncaught exceptions occurred.

    // Perform a couple of flows to exercise the code paths
    await page.click('#authBtn');
    await page.waitForFunction(() => document.getElementById('status')?.classList.contains('success'), null, { timeout: 6000 });
    await page.click('#resetBtn');

    // Allow any asynchronous console messages to flush
    await page.waitForTimeout(300);

    const consoleErrors = (page.context().consoleMessages || []).filter(m => m.type === 'error');
    const pageErrors = page.context().pageErrors || [];

    // Assert no console errors captured
    expect(consoleErrors.length, `Console errors encountered: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);

    // Assert no uncaught page errors captured
    expect(pageErrors.length, `Uncaught page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

});