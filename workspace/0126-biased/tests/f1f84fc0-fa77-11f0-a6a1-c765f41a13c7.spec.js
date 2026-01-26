import { test, expect } from '@playwright/test';

test.describe('DNS — Visual Journey (FSM validation)', () => {
  // URL for the HTML under test
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f84fc0-fa77-11f0-a6a1-c765f41a13c7.html';

  // Final caption text expected when animation completes (per implementation)
  const FINAL_CAPTION = "Done — example.com → 93.184.216.34 (example response). The resolver cached the result to answer future queries faster.";

  // Helper to check if an element has a CSS class
  const hasClass = async (page, selector, cls) => {
    return await page.$eval(selector, (el, cls) => el.classList.contains(cls), cls);
  };

  // Collect console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined
        });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown explicitly beyond Playwright closing the page
  });

  test('Initial Idle state: start button present, caption and nodes are idle', async ({ page }) => {
    // This test validates the Idle state (S0_Idle): presence of start button, caption text, and that nodes are not active/pulsing.
    const startBtn = page.locator('#startBtn');
    const caption = page.locator('#caption');

    // Ensure start button exists and is enabled
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();

    // Caption should contain the initial instruction text
    await expect(caption).toContainText(/Click "Start DNS Journey" to watch a single query flow/);

    // All major nodes should not have 'active' or 'pulse' classes in the Idle state
    const nodeIds = ['#node-client', '#node-resolver', '#node-root', '#node-tld', '#node-auth'];
    for (const id of nodeIds) {
      expect(await hasClass(page, id, 'active')).toBe(false);
      expect(await hasClass(page, id, 'pulse')).toBe(false);
    }

    // Assert that no console errors or page errors occurred during initial load
    expect(consoleErrors.length, 'console errors on load').toBe(0);
    expect(pageErrors.length, 'page errors on load').toBe(0);
  });

  test('Click StartAnimation: transitions to Animating and then back to Idle (full sequence)', async ({ page }) => {
    // This test validates the click-driven transition (S0_Idle -> S1_Animating) and completion transition back to Idle.
    // It checks intermediate captions, visual node classes, button disabled state during animation, and final state.

    test.setTimeout(30000); // allow enough time for the animation sequence to complete

    const startBtn = page.locator('#startBtn');
    const caption = page.locator('#caption');

    // Click the start button to begin the animation
    await startBtn.click();

    // Immediately after clicking, the button should be disabled per implementation
    await expect(startBtn).toBeDisabled();

    // Caption should quickly update to reflect the client creating a query
    await expect(caption).toContainText('Client creates a DNS query');

    // Client node should become active/pulse early in the sequence
    await expect.poll(async () => {
      return (await hasClass(page, '#node-client', 'active')) && (await hasClass(page, '#node-client', 'pulse'));
    }, { timeout: 3000 }).toBeTruthy();

    // Wait for resolver to be pulsing (mid-sequence)
    await expect.poll(async () => {
      return (await hasClass(page, '#node-resolver', 'pulse')) === true;
    }, { timeout: 5000 }).toBeTruthy();

    // Wait for root/TLD captions and animations to occur (look for text changes that indicate progress)
    await expect.poll(() => caption.innerText(), {
      timeout: 10000
    }).toContain('Resolver queries a Root nameserver');

    await expect.poll(() => caption.innerText(), {
      timeout: 12000
    }).toContain('Root refers the resolver to the appropriate TLD nameserver');

    // Wait until the final caption is reached which indicates AnimationComplete -> S0_Idle
    await page.waitForFunction(
      (sel, final) => document.querySelector(sel).textContent.trim() === final,
      '#caption',
      FINAL_CAPTION,
      { timeout: 20000 }
    );

    // After completion, the button should be enabled again
    await expect(startBtn).toBeEnabled();

    // After clearNodeStates and finalization, the client should be the single 'active' node per implementation
    // Nodes should not have 'pulse' classes lingering
    const nodeIds = ['#node-client', '#node-resolver', '#node-root', '#node-tld', '#node-auth'];
    for (const id of nodeIds) {
      const pulse = await hasClass(page, id, 'pulse');
      expect(pulse).toBe(false);
    }
    // Client should be active after the sequence finalizes
    expect(await hasClass(page, '#node-client', 'active')).toBe(true);

    // Ensure there were no console errors or uncaught page errors during the animation
    expect(consoleErrors.length, 'console errors during click-driven animation').toBe(0);
    expect(pageErrors.length, 'page errors during click-driven animation').toBe(0);
  });

  test('KeyPressStart (Enter) triggers the animation sequence', async ({ page }) => {
    // This test validates keyboard accessibility: pressing Enter while the button is focused triggers the same sequence.
    test.setTimeout(30000);

    const startBtn = page.locator('#startBtn');
    const caption = page.locator('#caption');

    // Focus the button and simulate Enter keyup/press
    await startBtn.focus();
    // Use keyboard press which triggers keydown/keyup on the focused element
    await page.keyboard.press('Enter');

    // Button should become disabled at start of sequence
    await expect(startBtn).toBeDisabled();

    // Wait for an expected mid-sequence caption
    await expect.poll(() => caption.innerText(), { timeout: 8000 }).toContain('Recursive resolver receives the query');

    // Wait for final caption text indicating completion
    await page.waitForFunction(
      (sel, final) => document.querySelector(sel).textContent.trim() === final,
      '#caption',
      FINAL_CAPTION,
      { timeout: 20000 }
    );

    // After completion, ensure button re-enabled and no errors occurred
    await expect(startBtn).toBeEnabled();
    expect(consoleErrors.length, 'console errors during Enter-driven animation').toBe(0);
    expect(pageErrors.length, 'page errors during Enter-driven animation').toBe(0);
  });

  test('KeyPressStart (Space) triggers the animation sequence (edge case for space key handling)', async ({ page }) => {
    // This test verifies that the implementation handles the space key on the button element.
    // Note: different browsers sometimes normalize the key value for spacebar; implementation checks for ' ' explicitly.
    test.setTimeout(30000);

    const startBtn = page.locator('#startBtn');
    const caption = page.locator('#caption');

    // Focus the button and send a Space key press
    await startBtn.focus();
    await page.keyboard.press('Space');

    // Expect the sequence to start (button disabled)
    await expect(startBtn).toBeDisabled();

    // Wait for final caption text to confirm completion
    await page.waitForFunction(
      (sel, final) => document.querySelector(sel).textContent.trim() === final,
      '#caption',
      FINAL_CAPTION,
      { timeout: 20000 }
    );

    // After completion, ensure button re-enabled and no console errors
    await expect(startBtn).toBeEnabled();
    expect(consoleErrors.length, 'console errors during Space-driven animation').toBe(0);
    expect(pageErrors.length, 'page errors during Space-driven animation').toBe(0);
  });

  test('Edge case: sending keyup while animation is in progress should not throw and should be ignored while disabled', async ({ page }) => {
    // This test validates behavior when multiple triggers are attempted during an ongoing sequence.
    test.setTimeout(30000);

    const startBtn = page.locator('#startBtn');
    const caption = page.locator('#caption');

    // Start the animation
    await startBtn.click();
    await expect(startBtn).toBeDisabled();

    // While disabled, attempt to press Enter and Space and click again rapidly
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await startBtn.click({ trial: false }).catch(() => { /* clicking disabled button may be ignored; allow no crash */ });

    // Ensure no page errors have been recorded so far
    expect(pageErrors.length, 'no page errors after rapid triggers').toBe(0);

    // Wait for the animation to complete (final caption)
    await page.waitForFunction(
      (sel, final) => document.querySelector(sel).textContent.trim() === final,
      '#caption',
      FINAL_CAPTION,
      { timeout: 20000 }
    );

    // After completion, ensure that the caption contains final text and button is enabled
    await expect(caption).toHaveText(FINAL_CAPTION);
    await expect(startBtn).toBeEnabled();

    // Ensure no console errors during the rapid interactions
    expect(consoleErrors.length, 'console errors during rapid triggers').toBe(0);
    expect(pageErrors.length, 'page errors during rapid triggers').toBe(0);
  });

  test('Verify onExit action clearNodeStates is executed (classes cleared) when animation completes', async ({ page }) => {
    // This test specifically validates the exit action behavior: clearNodeStates() removes active/pulse classes before final client active state is set.
    // We detect this by observing that pulse classes are removed before the final caption and that ultimately only the client remains active.
    test.setTimeout(30000);

    const startBtn = page.locator('#startBtn');

    // Start the animation
    await startBtn.click();
    await expect(startBtn).toBeDisabled();

    // At some point later in the sequence, ensure pulses existed (mid-run)
    await expect.poll(async () => {
      const anyPulse = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.node')).some(n => n.classList.contains('pulse'));
      });
      return anyPulse;
    }, { timeout: 5000 }).toBeTruthy();

    // Wait for near-finalization: wait until caption contains 'Resolver caches the answer' which is just prior to finalization
    await expect.poll(() => page.locator('#caption').innerText(), { timeout: 15000 }).toContain('Resolver caches the answer');

    // Immediately after the end, check that pulse classes have been cleared
    await page.waitForFunction(() => {
      // no node should have 'pulse' class
      return !Array.from(document.querySelectorAll('.node')).some(n => n.classList.contains('pulse'));
    }, null, { timeout: 15000 });

    // Finally ensure client is active and others are not
    expect(await hasClass(page, '#node-client', 'active')).toBe(true);
    expect(await hasClass(page, '#node-resolver', 'active')).toBe(false);
    expect(await hasClass(page, '#node-root', 'active')).toBe(false);
    expect(await hasClass(page, '#node-tld', 'active')).toBe(false);
    expect(await hasClass(page, '#node-auth', 'active')).toBe(false);

    // Ensure no JS runtime errors were thrown
    expect(consoleErrors.length, 'console errors during clearNodeStates verification').toBe(0);
    expect(pageErrors.length, 'page errors during clearNodeStates verification').toBe(0);
  });

  test('Observe console and page errors for unexpected ReferenceError / SyntaxError / TypeError', async ({ page }) => {
    // Per requirements: observe console and page errors and assert their presence or absence.
    // The page is expected to run without throwing ReferenceError/SyntaxError/TypeError. We assert none occurred.
    // This test will naturally surface any such errors if they happen in the runtime.
    const startBtn = page.locator('#startBtn');

    // Trigger the sequence to exercise most of the page JS
    await startBtn.click();

    // Wait for finish
    await page.waitForFunction(
      (sel, final) => document.querySelector(sel).textContent.trim() === final,
      '#caption',
      FINAL_CAPTION,
      { timeout: 20000 }
    );

    // Assert that no ReferenceError / SyntaxError / TypeError or other page errors were thrown
    const joinedPageErrors = pageErrors.join('\n');
    expect(joinedPageErrors, 'no uncaught page errors (ReferenceError/SyntaxError/TypeError)').toBe('');

    // Assert no console.error logs were emitted
    expect(consoleErrors.length, 'no console.error messages emitted').toBe(0);
  });
});