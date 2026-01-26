import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac9d62-fa78-11f0-812d-c9788050701f.html';

test.describe('Ethereal REST API Visualization - FSM tests (72ac9d62-fa78-11f0-812d-c9788050701f)', () => {
  // Capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to unhandled exceptions in the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Basic sanity: ensure the document loaded the expected root elements
    await expect(page.locator('#sendRequest')).toBeVisible();
    await expect(page.locator('#response')).toBeVisible();
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright closing contexts
  });

  test('Initial Idle state is rendered correctly', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - request button exists and is visible
    // - response exists but is hidden (opacity: 0)
    // - particles and routes rendered

    const sendRequest = page.locator('#sendRequest');
    const response = page.locator('#response');

    // Check that the sendRequest element contains the expected text
    await expect(sendRequest).toHaveText('Send Request');

    // Response should exist but be visually hidden (opacity 0)
    const responseOpacity = await page.$eval('#response', el => window.getComputedStyle(el).opacity);
    expect(responseOpacity).toBe('0');

    // Check that there are 5 routes as per implementation
    const routesCount = await page.$$eval('.route', nodes => nodes.length);
    expect(routesCount).toBe(5);

    // Check particles created for client and server (at least the requested count)
    const clientParticles = await page.$$eval('#clientParticles .particle', nodes => nodes.length);
    const serverParticles = await page.$$eval('#serverParticles .particle', nodes => nodes.length);
    expect(clientParticles).toBeGreaterThanOrEqual(15);
    expect(serverParticles).toBeGreaterThanOrEqual(15);

    // No uncaught errors should have occurred during load (we assert zero page errors here)
    // NOTE: We observe page errors but do not modify page behavior; asserting none were thrown.
    expect(pageErrors.length, `Page errors captured: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Click "Send Request" triggers Request Sent and Response Visible states', async ({ page }) => {
    // This test validates transitions:
    // S0_Idle --ClickSendRequest--> S1_RequestSent (request opacity -> 0)
    // S1_RequestSent --setTimeout--> S2_ResponseVisible (response opacity -> 1, scaled)
    // S2_ResponseVisible --setTimeouts--> back to S0_Idle (request opacity -> 1)

    const sendRequest = page.locator('#sendRequest');
    const response = page.locator('#response');

    // Start time
    const clickTime = Date.now();
    await sendRequest.click();

    // Immediately after click, the inline transform should be applied (scale 0.9)
    const immediateTransform = await page.$eval('#sendRequest', el => el.style.transform || '');
    expect(immediateTransform).toContain('scale(0.9)');

    // Wait for 600ms (script sets opacity to 0 after 500ms)
    await page.waitForTimeout(600);
    const requestOpacityAfter500ms = await page.$eval('#sendRequest', el => window.getComputedStyle(el).opacity);
    expect(requestOpacityAfter500ms).toBe('0');

    // The response becomes visible after an additional 300ms (800ms total); wait a bit more to be safe
    await page.waitForTimeout(400); // now ~1000ms since click
    const responseOpacityVisible = await page.$eval('#response', el => window.getComputedStyle(el).opacity);
    expect(responseOpacityVisible).toBe('1');

    // Response transform should reflect the scale(1.1) inline style set by the script
    const responseInlineTransform = await page.$eval('#response', el => el.style.transform || '');
    expect(responseInlineTransform).toContain('scale(1.1)');

    // Wait for the response visible duration (script hides response after 2000ms). We'll wait 2200ms to be safe.
    await page.waitForTimeout(2200);
    const responseOpacityHidden = await page.$eval('#response', el => window.getComputedStyle(el).opacity);
    expect(responseOpacityHidden).toBe('0');

    // After final timeout sequence, the request button opacity should return to 1 (~500ms after response hide)
    await page.waitForTimeout(600);
    const finalRequestOpacity = await page.$eval('#sendRequest', el => window.getComputedStyle(el).opacity);
    expect(finalRequestOpacity).toBe('1');

    // And the request transform should be reset to original scale (scale(1) or translate only)
    const finalRequestInlineTransform = await page.$eval('#sendRequest', el => el.style.transform || '');
    // The script sets transform back to 'translate(-50%, -50%) scale(1)'
    expect(finalRequestInlineTransform).toContain('scale(1)');

    // Ensure no unexpected page errors were captured during the lifecycle
    expect(pageErrors.length, `Page errors during request lifecycle: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Hovering over routes scales method on mouseenter and restores on mouseleave', async ({ page }) => {
    // This test validates:
    // - MouseEnterRoute event: method.style.transform = 'scale(1.1)'
    // - MouseLeaveRoute event: method.style.transform = 'scale(1)'

    // Select the first route's method element
    const firstMethod = page.locator('.route >> .method').first();

    // Ensure initial inline style is empty or not a scale
    const initialInline = await page.$eval('.route .method', el => el.style.transform || '');
    // initial may be empty string
    expect(typeof initialInline).toBe('string');

    // Hover to trigger mouseenter
    await firstMethod.hover();
    // Small wait to allow event handler to run
    await page.waitForTimeout(100);

    // The handler sets inline style 'scale(1.1)', so check element.style.transform
    const afterHoverInline = await page.$eval('.route .method', el => el.style.transform || '');
    expect(afterHoverInline).toContain('scale(1.1)');

    // Move mouse away (mouse leave) - move to some other element
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);

    // After mouseleave, inline style should be 'scale(1)'
    const afterLeaveInline = await page.$eval('.route .method', el => el.style.transform || '');
    expect(afterLeaveInline).toContain('scale(1)');

    // Final check: no page errors triggered by hover interactions
    expect(pageErrors.length, `Page errors during hover interactions: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Edge case: rapid repeated clicks do not crash the page and resolve back to Idle', async ({ page }) => {
    // This test simulates a user rapidly clicking the Send Request button multiple times
    // It ensures overlapping timeouts do not throw errors and ultimately the UI returns to the Idle state

    const sendRequest = page.locator('#sendRequest');
    const response = page.locator('#response');

    // Rapidly click 3 times with short intervals
    await sendRequest.click();
    await page.waitForTimeout(100);
    await sendRequest.click();
    await page.waitForTimeout(100);
    await sendRequest.click();

    // Wait duration slightly longer than full animation cycle to allow all timeouts to resolve (~3600ms total),
    // include a buffer
    await page.waitForTimeout(4000);

    // Verify final state: request opacity 1 and response opacity 0 (Idle)
    const finalRequestOpacity = await page.$eval('#sendRequest', el => window.getComputedStyle(el).opacity);
    const finalResponseOpacity = await page.$eval('#response', el => window.getComputedStyle(el).opacity);
    expect(finalRequestOpacity).toBe('1');
    expect(finalResponseOpacity).toBe('0');

    // Verify no uncaught page errors as a result of rapid clicking
    expect(pageErrors.length, `Page errors during rapid clicking: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Also verify console did not capture console.error messages (we will allow other console types)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Observes console messages and page errors (observation test)', async ({ page }) => {
    // This test's primary goal is to confirm we are capturing console and page errors.
    // We assert that no runtime ReferenceError/SyntaxError/TypeError were thrown.
    // If any page errors exist, we surface them in the assertion message.

    // Allow a short idle to capture any late errors
    await page.waitForTimeout(500);

    // Collate error-like console messages (console.error)
    const errorConsoleMessages = consoleMessages.filter(msg => msg.type === 'error');
    // Assertions: we expect zero uncaught page errors and zero console.error messages for a healthy run
    expect(pageErrors.length, `Captured page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(errorConsoleMessages.length, `Captured console.error messages: ${errorConsoleMessages.map(e => e.text).join('; ')}`).toBe(0);

    // If there were errors, they would be available in pageErrors for debugging. We do not modify runtime.
  });
});