import { test, expect } from '@playwright/test';

test.describe('Encryption — Visual Concept (f1f9af50-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // The page under test
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f9af50-fa77-11f0-a6a1-c765f41a13c7.html';

  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console and page errors for each test run
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture unhandled exceptions thrown in the page context
      pageErrors.push(err);
    });

    // Navigate to the exact HTML as provided (do not modify the page)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the main container is present before tests run
    await expect(page.locator('#app')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic sanity assertions about runtime errors observed during the test.
    // The test observes page errors and console errors and asserts their counts.
    // We expect no uncaught page errors or console 'error' messages for this UI.
    // If any appear, they will surface here and fail the test for visibility.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e=>String(e)).join('\n')}`).toEqual([]);
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.map(e=>e.text).join('\n')}`).toEqual([]);
  });

  test('Idle state: initial render contains expected controls and hidden keycard', async ({ page }) => {
    // Verify the Idle (S0_Idle) state: buttons present and keycard hidden
    const encryptBtn = page.locator('#encryptBtn');
    const replayBtn = page.locator('#replayBtn');
    const revealBtn = page.locator('#revealKeyBtn');
    const keycard = page.locator('#keycard');
    const ciphertext = page.locator('#ciphertext');
    const plaintext = page.locator('#plaintext');

    // Buttons should be present and in unpressed state initially (aria-pressed="false")
    await expect(encryptBtn).toBeVisible();
    await expect(encryptBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(replayBtn).toBeVisible();
    await expect(replayBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(revealBtn).toBeVisible();
    await expect(revealBtn).toHaveAttribute('aria-pressed', 'false');

    // Keycard must exist but be hidden (S4_KeyHidden evidence)
    await expect(keycard).toBeVisible();
    await expect(keycard).toHaveAttribute('aria-hidden', 'true');
    // 'show' class should not be present in hidden state
    const keycardHasShow = await keycard.evaluate(el => el.classList.contains('show'));
    expect(keycardHasShow).toBe(false);

    // Plaintext and ciphertext initial content
    await expect(plaintext).toHaveText('HELLO, WORLD');
    await expect(ciphertext).toHaveText(/—|-/);

    // No runtime errors during initial render (asserted in afterEach)
  });

  test('Auto-demo runs on load then returns to Idle (encrypt button toggles during animation)', async ({ page }) => {
    const encryptBtn = page.locator('#encryptBtn');
    const lock = page.locator('#lock');

    // The page auto-triggers simulateEncryption after ~900ms.
    // Wait for encryptBtn to be pressed (animating true) and then return to unpressed.
    // First wait for it to go to pressed state (timeout generous to accommodate animation)
    await page.waitForFunction(() => {
      const b = document.getElementById('encryptBtn');
      return b && b.getAttribute('aria-pressed') === 'true';
    }, { timeout: 5000 });

    // During animation, lock should show 'unlocking' class as per S1_Animating evidence
    const unlockingDuring = await lock.evaluate(el => el.classList.contains('unlocking'));
    expect(unlockingDuring).toBe(true);

    // Wait for animation to finish (encryptBtn should return to aria-pressed="false")
    await page.waitForFunction(() => {
      const b = document.getElementById('encryptBtn');
      return b && b.getAttribute('aria-pressed') === 'false';
    }, { timeout: 8000 });

    // After animation completes, lock should be back to 'locked'
    const lockedAfter = await lock.evaluate(el => el.classList.contains('locked'));
    expect(lockedAfter).toBe(true);
  });

  test('Clicking Encrypt triggers animation: lock unlocks then re-locks, ciphertext updates', async ({ page }) => {
    const encryptBtn = page.locator('#encryptBtn');
    const lock = page.locator('#lock');
    const ciphertext = page.locator('#ciphertext');

    // Ensure idle before we start (if auto-demo is still running, wait until it finishes)
    await page.waitForFunction(() => {
      const b = document.getElementById('encryptBtn');
      return b && b.getAttribute('aria-pressed') === 'false';
    }, { timeout: 8000 });

    // Capture initial ciphertext text
    const beforeText = await ciphertext.textContent();

    // Click encrypt to start a new animation (transition S0_Idle -> S1_Animating)
    await encryptBtn.click();

    // Immediately expect encryptBtn to indicate pressed (animating started)
    await expect(encryptBtn).toHaveAttribute('aria-pressed', 'true');

    // While animating, lock should have 'unlocking' class
    await page.waitForFunction(() => {
      const l = document.getElementById('lock');
      return l && l.classList.contains('unlocking');
    }, { timeout: 2000 });

    // Wait for animation to finish (encryptBtn returns to false)
    await page.waitForFunction(() => {
      const b = document.getElementById('encryptBtn');
      return b && b.getAttribute('aria-pressed') === 'false';
    }, { timeout: 8000 });

    // After animation, ciphertext should have changed from previous placeholder and look like pseudo-base64
    const afterText = (await ciphertext.textContent()) || '';
    expect(afterText.trim().length).toBeGreaterThan(5);
    expect(afterText).not.toBe(beforeText);

    // Lock should be back to locked class
    const locked = await lock.evaluate(el => el.classList.contains('locked'));
    expect(locked).toBe(true);
  });

  test('Replay button: replays when idle, does nothing while animating', async ({ page }) => {
    const replayBtn = page.locator('#replayBtn');
    const encryptBtn = page.locator('#encryptBtn');
    const ciphertext = page.locator('#ciphertext');

    // Ensure idle
    await page.waitForFunction(() => {
      const b = document.getElementById('encryptBtn');
      return b && b.getAttribute('aria-pressed') === 'false';
    }, { timeout: 8000 });

    // Ensure initial transform is empty or not the replay transform
    const initialTransform = await ciphertext.evaluate(el => el.style.transform || '');

    // When idle, clicking replay should trigger a quick transform and opacity change
    await replayBtn.click();

    // Shortly after clicking replay, styles should reflect the replay action
    await page.waitForTimeout(50); // give the handler a fraction of time to apply
    const duringTransform = await ciphertext.evaluate(el => ({ transform: el.style.transform, opacity: el.style.opacity }));
    expect(duringTransform.transform === 'translateY(-4px)' || duringTransform.opacity === '0.7').toBeTruthy();

    // After replay completes (~320ms), it should return to its normal state
    await page.waitForTimeout(400);
    const afterTransform = await ciphertext.evaluate(el => ({ transform: el.style.transform || '', opacity: el.style.opacity || '' }));
    // transform and opacity should be restored or not stuck at replay values
    expect(afterTransform.transform).not.toBe('translateY(-4px)');

    // Now test that clicking replay while animating does nothing (transition S1_Animating -> S0_Idle on ReplayClick is gated)
    // Start encryption to make animating true
    await encryptBtn.click();
    // Wait until aria-pressed true (animating)
    await page.waitForFunction(() => document.getElementById('encryptBtn').getAttribute('aria-pressed') === 'true', { timeout: 2000 });

    // Capture ciphertext transform just before clicking replay during animating
    const beforeDuringAnim = await ciphertext.evaluate(el => el.style.transform || '');

    // Click replay during animating; handler checks if(animating) return; so it should not change transform
    await replayBtn.click();

    // short wait to give a possible but undesired transform a chance to apply
    await page.waitForTimeout(120);
    const afterDuringAnim = await ciphertext.evaluate(el => el.style.transform || '');

    // Expect no replay transform applied while animating
    expect(afterDuringAnim).toBe(beforeDuringAnim);

    // Wait for animation to finish to clean up state
    await page.waitForFunction(() => document.getElementById('encryptBtn').getAttribute('aria-pressed') === 'false', { timeout: 10000 });
  });

  test('Reveal Key toggles Key Visible (S3_KeyVisible <-> S4_KeyHidden) and reveals actual key text', async ({ page }) => {
    const revealBtn = page.locator('#revealKeyBtn');
    const keycard = page.locator('#keycard');
    const keyString = page.locator('#keyString');

    // Initially hidden
    await expect(keycard).toHaveAttribute('aria-hidden', 'true');
    const initialKeyText = await keyString.textContent();
    expect(initialKeyText).toMatch(/•/); // masked initially

    // Click to reveal (S0_Idle -> S3_KeyVisible)
    await revealBtn.click();

    // Button should reflect pressed state and keycard should be shown
    await expect(revealBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(keycard).toHaveAttribute('aria-hidden', 'false');
    const hasShow = await keycard.evaluate(el => el.classList.contains('show'));
    expect(hasShow).toBe(true);

    // After ~260ms the real key should be revealed (no bullets)
    await page.waitForTimeout(300);
    const revealedText = (await keyString.textContent()) || '';
    // It should not be masked with bullets when fully revealed
    expect(revealedText.includes('•')).toBe(false);
    expect(revealedText.trim().length).toBeGreaterThan(4);

    // Click again to hide key (S3_KeyVisible -> S4_KeyHidden)
    await revealBtn.click();
    await expect(revealBtn).toHaveAttribute('aria-pressed', 'false');

    // Keycard should be hidden
    await expect(keycard).toHaveAttribute('aria-hidden', 'true');
    const hasShowAfterHide = await keycard.evaluate(el => el.classList.contains('show'));
    expect(hasShowAfterHide).toBe(false);

    // After ~200ms the keyString should return to masked form
    await page.waitForTimeout(250);
    const maskedAgain = (await keyString.textContent()) || '';
    expect(maskedAgain.includes('•')).toBe(true);
  });

  test('Edge cases: clicking Encrypt while animating is a no-op; UI remains stable', async ({ page }) => {
    const encryptBtn = page.locator('#encryptBtn');
    const lock = page.locator('#lock');

    // Ensure idle
    await page.waitForFunction(() => {
      const b = document.getElementById('encryptBtn');
      return b && b.getAttribute('aria-pressed') === 'false';
    }, { timeout: 8000 });

    // Start animation
    await encryptBtn.click();
    await page.waitForFunction(() => document.getElementById('encryptBtn').getAttribute('aria-pressed') === 'true', { timeout: 2000 });

    // Attempt to click encrypt again while animating - simulateEncryption returns early if(animating)
    await encryptBtn.click();

    // Immediately after second click, still animating (aria-pressed true)
    await expect(encryptBtn).toHaveAttribute('aria-pressed', 'true');

    // Lock should still be in unlocking or locked state eventually, but not crash
    const unlockingNow = await lock.evaluate(el => el.classList.contains('unlocking') || el.classList.contains('locked'));
    expect(unlockingNow).toBe(true);

    // Wait for original animation to complete
    await page.waitForFunction(() => document.getElementById('encryptBtn').getAttribute('aria-pressed') === 'false', { timeout: 10000 });
  });

});