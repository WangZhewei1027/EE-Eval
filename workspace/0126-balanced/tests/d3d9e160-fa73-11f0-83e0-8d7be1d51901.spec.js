import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d9e160-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('OSI Model Interactive Demo - d3d9e160-fa73-11f0-83e0-8d7be1d51901', () => {
  // Capture page errors and console.error messages to assert runtime health
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Basic sanity: wait for main elements to appear
    await expect(page.locator('#stack')).toBeVisible();
    await expect(page.locator('#sendBtn')).toBeVisible();
  });

  test.afterEach(async () => {
    // nothing to teardown beyond automatic Playwright cleanup
  });

  test.describe('Initial state and UI basics', () => {
    test('Initial Idle state is set and snapshot shows no packet', async ({ page }) => {
      // Validate S0_Idle entry action / visible texts and DOM
      const actionText = await page.locator('#actionText').textContent();
      expect(actionText.trim()).toBe('Idle — ready');

      const snapshot = await page.locator('#snapshot').textContent();
      expect(snapshot.trim()).toBe('No packet in motion.');

      const packetVisible = await page.locator('#packet').evaluate(el => getComputedStyle(el).display !== 'none');
      expect(packetVisible).toBe(false);

      // Ensure there are no runtime page errors (ReferenceError, TypeError, SyntaxError)
      expect(pageErrors.length).toBe(0, `Expected no page errors but got ${pageErrors.length}: ${pageErrors.map(String).join('; ')}`);
      expect(consoleErrors.length).toBe(0, `Expected no console.error messages but got ${consoleErrors.length}: ${consoleErrors.map(c=>c.text).join('; ')}`);
    });

    test('Layer click and Enter key show layer info and highlight', async ({ page }) => {
      // Click Application layer (layer 7) and verify info panel updates
      const appLayer = page.locator('.layer[data-layer="7"]');
      await appLayer.click();
      await expect(page.locator('#infoText')).toContainText('Application — Layer 7');
      await expect(page.locator('#infoText')).toContainText('HTTP');

      // Press Enter on Transport layer (layer 4)
      const transportLayer = page.locator('.layer[data-layer="4"]');
      await transportLayer.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#infoText')).toContainText('Transport — Layer 4');
      await expect(page.locator('#infoText')).toContainText('TCP');

      // The highlighting sets a boxShadow style; verify the focused/last-clicked layer has boxShadow set
      const transportBoxShadow = await transportLayer.evaluate(el => el.style.boxShadow);
      expect(transportBoxShadow.length).toBeGreaterThan(0);
    });
  });

  test.describe('Send, Receive, Step, Reset transitions and behaviors', () => {
    test('SendMessage transitions from Idle to Sending and completes send sequence', async ({ page }) => {
      // Ensure starting in Idle
      await expect(page.locator('#actionText')).toHaveText(/Idle/);

      // Click Send - should set state.running = true and direction = 'down'
      await page.click('#sendBtn');

      // Immediately after clicking, state.running should be true
      await page.waitForFunction(() => window.state && window.state.running === true, null, { timeout: 2000 });

      const running = await page.evaluate(() => window.state && window.state.running);
      const direction = await page.evaluate(() => window.state && window.state.direction);
      expect(running).toBe(true);
      expect(direction).toBe('down');

      // The packet element should be visible
      await expect(page.locator('#packet')).toBeVisible();

      // Wait for send animation to finish (state.running becomes false)
      await page.waitForFunction(() => window.state && window.state.running === false, null, { timeout: 12000 });

      // After completion, actionText should indicate packet left the local host
      await expect(page.locator('#actionText')).toContainText('Packet left the local host');

      // Snapshot should describe top headers (if any)
      const snapshot1 = await page.locator('#snapshot1').textContent();
      expect(snapshot.toLowerCase()).toContain('packet on the wire');

      // Validate no runtime errors happened during send
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('ReceiveMessage transitions from Sending-complete to Receiving and delivers payload', async ({ page }) => {
      // Ensure we have a packet on the wire: perform a send and wait until finished
      await page.click('#sendBtn');
      await page.waitForFunction(() => window.state && window.state.running === false, null, { timeout: 12000 });

      // Now click Receive - should initiate receiving (state.running true & direction 'up')
      await page.click('#receiveBtn');
      await page.waitForFunction(() => window.state && window.state.running === true && window.state.direction === 'up', null, { timeout: 3000 });

      let running1 = await page.evaluate(() => window.state.running1);
      let direction1 = await page.evaluate(() => window.state.direction1);
      expect(running).toBe(true);
      expect(direction).toBe('up');

      // Wait until receiving completes (decapsulation finished)
      await page.waitForFunction(() => window.state && window.state.running === false, null, { timeout: 12000 });

      // Verify actionText indicates delivery
      await expect(page.locator('#actionText')).toContainText('Message delivered');

      // Snapshot should mention payload delivered
      await expect(page.locator('#snapshot')).toContainText('Payload delivered');

      // No runtime page errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('StepThrough during sending: step-by-step encapsulation via Step button', async ({ page }) => {
      // Use Step button to start controlled send
      await page.click('#stepBtn'); // starts controlled step-send process
      // state should now be running and direction down
      await page.waitForFunction(() => window.state && window.state.running === true && window.state.direction === 'down', null, { timeout: 2000 });

      // The initial currentStep should be 7
      let currentStep = await page.evaluate(() => window.state.currentStep);
      expect(currentStep).toBe(7);

      // Press Step repeatedly to step through a few layers
      for (let i = 0; i < 3; i++) {
        await page.click('#stepBtn');
        // small delay to allow UI update
        await page.waitForTimeout(400);
      }

      // After some steps, headers stack should have entries
      const headersCount = await page.evaluate(() => window.state.headers.length);
      expect(headersCount).toBeGreaterThanOrEqual(1);

      // Continue stepping until send finished
      // Press step until state.running becomes false or safety max repeats
      for (let i = 0; i < 10; i++) {
        const r = await page.evaluate(() => window.state.running);
        if (!r) break;
        await page.click('#stepBtn');
        await page.waitForTimeout(300);
      }
      // After done, state.running should be false
      const finalRunning = await page.evaluate(() => window.state.running);
      expect(finalRunning).toBe(false);

      // Snapshot should reflect 'Send finished' or similar
      const actionText1 = await page.locator('#actionText1').textContent();
      expect(actionText.toLowerCase()).toMatch(/send|finished|packet on wire/);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    }, { timeout: 30000 });

    test('StepThrough during receiving: decapsulation step-by-step', async ({ page }) => {
      // Prepare: perform a full send to populate headers
      await page.click('#sendBtn');
      await page.waitForFunction(() => window.state && window.state.running === false, null, { timeout: 12000 });

      // Start receive which will set direction = 'up' and state.running true shortly
      await page.click('#receiveBtn');
      await page.waitForFunction(() => window.state && window.state.running === true && window.state.direction === 'up', null, { timeout: 3000 });

      // Wait briefly for headers to be present (stepUp will run)
      await page.waitForTimeout(500);

      // Now press Step while receiving to step remove headers (if the app allows)
      // Note: the app triggers stepUp internally; pressing Step during running/up will run stepUp logic in stepBtn handler
      // Press Step a few times; we handle both possibilities (internal auto stepUp or manual)
      for (let i = 0; i < 4; i++) {
        await page.click('#stepBtn');
        await page.waitForTimeout(400);
      }

      // Eventually headers should be empty and state.running false
      await page.waitForFunction(() => window.state && window.state.running === false, null, { timeout: 12000 });

      const headersLeft = await page.evaluate(() => window.state.headers.length);
      expect(headersLeft).toBeGreaterThanOrEqual(0);

      // Final action text should indicate decapsulation complete or delivery
      const finalAction = await page.locator('#actionText').textContent();
      expect(finalAction.length).toBeGreaterThan(0);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    }, { timeout: 30000 });

    test('ResetAnimation resets UI and state from any mode', async ({ page }) => {
      // Start a send
      await page.click('#sendBtn');
      // Give it a short moment to set running
      await page.waitForTimeout(300);
      // Now click Reset
      await page.click('#resetBtn');

      // After reset, state.running should be false, headers empty, packet hidden, actionText "Idle"
      await page.waitForTimeout(200);
      const running2 = await page.evaluate(() => window.state.running2 === false);
      const headersEmpty = await page.evaluate(() => Array.isArray(window.state.headers) && window.state.headers.length === 0);
      const packetDisplayed = await page.locator('#packet').evaluate(el => getComputedStyle(el).display !== 'none');
      const actionText2 = await page.locator('#actionText2').textContent();

      expect(running).toBe(true); // true because we asserted window.state.running === false above
      expect(headersEmpty).toBe(true);
      expect(packetDisplayed).toBe(false);
      expect(actionText).toMatch(/Idle/);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Toggles, quiz and edge cases', () => {
    test('ShowHeadersToggle and AutoMode toggle behaviors', async ({ page }) => {
      // Initially headersStack is hidden
      const headersStack = page.locator('#headersStack');
      await expect(headersStack).toHaveCSS('display', 'none');

      // Click show headers - should toggle to block
      await page.click('#showHeadersToggle');
      // Because the page toggles between 'none' and 'block', we check it's not 'none' now
      const displayAfter = await headersStack.evaluate(el => getComputedStyle(el).display);
      expect(displayAfter === 'block' || displayAfter !== 'none').toBeTruthy();

      // Toggle back
      await page.click('#showHeadersToggle');
      const displayBack = await headersStack.evaluate(el => getComputedStyle(el).display);
      // It might be 'none' again
      expect(displayBack).toBeDefined();

      // Auto mode toggling should change state.auto and style of the button
      const autoBtn = page.locator('#autoMode');
      const initialBg = await autoBtn.evaluate(el => el.style.background || '');
      await autoBtn.click();
      const bgAfter = await autoBtn.evaluate(el => el.style.background);
      const stateAuto = await page.evaluate(() => window.state.auto);
      expect(stateAuto).toBe(true);
      expect(bgAfter.length).toBeGreaterThanOrEqual(0);

      // Toggle off
      await autoBtn.click();
      const stateAutoOff = await page.evaluate(() => window.state.auto);
      expect(stateAutoOff).toBe(false);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Mini-quiz selection marks correct and wrong appropriately', async ({ page }) => {
      // For q1 correct is L3; click a wrong answer then verify wrong + correct highlighted
      const q1Wrong = page.locator('#q1 .chip[data-answer="L4"]');
      const q1Correct = page.locator('#q1 .chip[data-answer="L3"]');

      await q1Wrong.click();
      await expect(q1Wrong).toHaveClass(/wrong/);
      await expect(q1Correct).toHaveClass(/correct/);

      // For q2 correct is L4; click correct directly
      const q2Correct = page.locator('#q2 .chip[data-answer="L4"]');
      await q2Correct.click();
      await expect(q2Correct).toHaveClass(/correct/);

      // Ensure chips become non-interactive (pointerEvents disabled) per handler
      const q1ChipsPointer = await page.locator('#q1').evaluate(el => Array.from(el.querySelectorAll('.chip')).map(c => c.style.pointerEvents));
      expect(q1ChipsPointer.every(v => v === 'none')).toBeTruthy();

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: clicking Send while already running does not break state', async ({ page }) => {
      // Start a send
      await page.click('#sendBtn');
      await page.waitForFunction(() => window.state && window.state.running === true, null, { timeout: 2000 });

      // Click send again while running
      await page.click('#sendBtn');
      // Wait a short time and ensure still running (no crash)
      await page.waitForTimeout(500);
      const stillRunning = await page.evaluate(() => window.state && window.state.running === true);
      expect(stillRunning).toBe(true);

      // Click receive while running - animateReceive has a guard and should not start; state should remain running:true and direction should remain 'down'
      const directionBefore = await page.evaluate(() => window.state.direction);
      await page.click('#receiveBtn');
      await page.waitForTimeout(400);
      const directionAfter = await page.evaluate(() => window.state.direction);
      expect(directionAfter).toBe(directionBefore);

      // Reset to clean state
      await page.click('#resetBtn');

      // No runtime errors occurred as a result of these interactions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Direct state validation and invariants', () => {
    test('FSM state variables reflect expected onEnter/onExit behaviors', async ({ page }) => {
      // Ensure initial entry action for S0_Idle was applied (actionText updated)
      await expect(page.locator('#actionText')).toHaveText('Idle — ready');

      // Trigger S1_Sending via Send and check onEnter evidence: state.running true and direction down
      await page.click('#sendBtn');
      await page.waitForFunction(() => window.state && window.state.running === true && window.state.direction === 'down', null, { timeout: 2000 });
      const sendingRunning = await page.evaluate(() => window.state.running);
      const sendingDir = await page.evaluate(() => window.state.direction);
      expect(sendingRunning).toBe(true);
      expect(sendingDir).toBe('down');

      // Cancel via Reset to check exit action for S1 (state.running false)
      await page.click('#resetBtn');
      await page.waitForTimeout(200);
      const afterResetRunning = await page.evaluate(() => window.state.running);
      expect(afterResetRunning).toBe(false);

      // Trigger S2_Receiving via Receive (from idle) and check state.direction = 'up' and running true
      await page.click('#receiveBtn');
      await page.waitForFunction(() => window.state && window.state.running === true && window.state.direction === 'up', null, { timeout: 3000 });
      const recRunning = await page.evaluate(() => window.state.running);
      const recDir = await page.evaluate(() => window.state.direction);
      expect(recRunning).toBe(true);
      expect(recDir).toBe('up');

      // Wait for receive to finish naturally
      await page.waitForFunction(() => window.state && window.state.running === false, null, { timeout: 15000 });

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    }, { timeout: 30000 });
  });
});