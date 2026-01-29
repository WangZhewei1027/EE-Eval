import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a272c4-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Understanding TCP/IP - FSM-driven UI tests (d5a272c4-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup listeners before each test so we can assert on console and runtime errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, warning, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the application page exactly as provided
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Clear collected arrays to avoid cross-test bleed (though new arrays are created each beforeEach)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Initial state (S0_Idle): button exists and demo panel is hidden', async ({ page }) => {
    // This test validates the Idle state from the FSM:
    // - The "Show TCP Connection Demonstration Example" button exists with the expected onclick.
    // - The #demo element exists but is initially hidden (display: none).
    // - Verify that any entry actions (renderPage) are not unexpectedly thrown as runtime errors.
    const button = page.locator('button');
    await expect(button).toHaveCount(1); // ensure button exists

    // Check button text matches expected evidence from FSM
    await expect(button).toHaveText('Show TCP Connection Demonstration Example');

    // Check the inline onclick attribute contains the expected snippet
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe("document.getElementById('demo').style.display='block';");

    // #demo element should exist in the DOM
    const demo = page.locator('#demo');
    await expect(demo).toHaveCount(1);

    // The demo should be hidden initially (Idle state)
    await expect(demo).toBeHidden();

    // Verify that renderPage() is not defined on the page (FSM lists it as an entry action;
    // the implementation does not define it). We assert that it is undefined rather than causing an exception.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
    expect(hasRenderPage).toBe(false);

    // Ensure no runtime page errors occurred during initial load
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console error-level messages on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition (ShowDemo): clicking button reveals the demo (S0_Idle -> S1_DemoVisible)', async ({ page }) => {
    // This test validates the transition triggered by the ShowDemo event:
    // - Clicking the button should change #demo from hidden to visible
    // - The demo content should match expected headings and content
    // - No runtime errors should occur during the transition
    const button = page.locator('button');
    const demo = page.locator('#demo');

    // Precondition: demo is hidden
    await expect(demo).toBeHidden();

    // Click the button triggering the inline onclick handler
    await button.click();

    // After click: #demo should be visible (FSM expected observable)
    await expect(demo).toBeVisible();

    // Verify visible demo contains the heading and sample list of handshake steps
    await expect(demo.locator('h3')).toHaveText('TCP Connection Demonstration');
    await expect(demo.locator('ul')).toContainText('Client sends SYN to Server');
    await expect(demo.locator('ul')).toContainText('Server sends SYN-ACK to Client');
    await expect(demo.locator('ul')).toContainText('Client sends ACK to Server');

    // Ensure no runtime page errors occurred during the click/transition
    expect(pageErrors.length).toBe(0);

    // Ensure no console error-level messages emitted during the interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotent behavior: clicking the Show button multiple times keeps demo visible and causes no errors', async ({ page }) => {
    // This test exercises an edge case: repeated firing of the same event.
    // The onclick sets display='block'; repeated clicks should keep it visible and not cause exceptions.
    const button = page.locator('button');
    const demo = page.locator('#demo');

    // Click once and assert visible
    await button.click();
    await expect(demo).toBeVisible();

    // Click multiple additional times quickly
    await Promise.all([button.click(), button.click(), button.click()]);

    // Ensure still visible after repeated clicks
    await expect(demo).toBeVisible();

    // No page errors from repeated actions
    expect(pageErrors.length).toBe(0);

    // No console errors emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Keyboard accessibility: focusing and pressing Enter on the button reveals demo', async ({ page }) => {
    // Validate keyboard interaction as an additional user interaction:
    // - Focus the button and press Enter to activate it (should trigger same inline onclick).
    const button = page.locator('button');
    const demo = page.locator('#demo');

    // Ensure hidden initially, then focus and press Enter
    await expect(demo).toBeHidden();
    await button.focus();
    // Press Enter to activate
    await page.keyboard.press('Enter');

    // Demo should become visible
    await expect(demo).toBeVisible();

    // No runtime page errors should have been emitted
    expect(pageErrors.length).toBe(0);

    // No console error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM integrity: verify styles and static content remain consistent after transition', async ({ page }) => {
    // Validate that visual feedback is provided by style changes, and static content remains intact.
    const button = page.locator('button');
    const demo = page.locator('#demo');

    // Check initial computed style of button (visual affordance)
    const buttonBg = await page.evaluate(() => {
      const btn = document.querySelector('button');
      return window.getComputedStyle(btn).backgroundColor;
    });
    expect(typeof buttonBg).toBe('string');
    expect(buttonBg.length).toBeGreaterThan(0);

    // Trigger transition
    await button.click();
    await expect(demo).toBeVisible();

    // Verify that demo's background color remains as defined in the stylesheet and is not empty
    const demoBg = await page.evaluate(() => {
      const el = document.getElementById('demo');
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(typeof demoBg).toBe('string');
    expect(demoBg.length).toBeGreaterThan(0);

    // Ensure footer text still present and unchanged
    await expect(page.locator('footer')).toContainText('© 2023 Understanding TCP/IP. All rights reserved.');

    // No runtime errors and no console errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Negative/edge assertion: clicking arbitrary page area does not hide demo once visible', async ({ page }) => {
    // This test ensures that unrelated clicks do not revert the visible state of the demo
    const button = page.locator('button');
    const demo = page.locator('#demo');

    // Show the demo
    await button.click();
    await expect(demo).toBeVisible();

    // Click on the body (outside the demo) several times
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.locator('body').click({ position: { x: 50, y: 50 } });
    await page.locator('body').click({ position: { x: 200, y: 200 } });

    // Demo should remain visible (there's no hide logic implemented)
    await expect(demo).toBeVisible();

    // No runtime errors from these arbitrary interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence checks: ensure markup contains the expected evidence snippets', async ({ page }) => {
    // Validate evidence strings from the FSM are present in the DOM/attributes:
    // - The button inline onclick snippet
    // - The #demo container exists
    const button = page.locator('button');
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toContain("document.getElementById('demo').style.display='block';");

    const demoHtml = await page.content();
    // Check that <div id="demo"> exists in the HTML content (evidence for S1_DemoVisible)
    expect(demoHtml).toContain('<div id="demo">');

    // No runtime errors related to evidence checking
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Assert no unexpected runtime exceptions (ReferenceError, TypeError, SyntaxError) during normal usage', async ({ page }) => {
    // This test makes a broad assertion that normal usage of the page (load + interactions tested earlier)
    // did not produce uncaught runtime exceptions. It collects the pageErrors array and fails if any such error exists.
    // We also inspect console messages for "Uncaught" or error-level messages as an additional guard.
    const button = page.locator('button');
    const demo = page.locator('#demo');

    // Interact with the page in a representative way
    await expect(demo).toBeHidden();
    await button.click();
    await expect(demo).toBeVisible();
    await button.click();

    // Assert no uncaught runtime exceptions collected by page.on('pageerror')
    if (pageErrors.length > 0) {
      // If there are errors, attach details to the failure message for debugging
      const msgs = pageErrors.map(e => `${e.name}: ${e.message}`).join('; || ');
      throw new Error(`Unexpected runtime page errors occurred: ${msgs}`);
    }

    // Inspect console messages for error-level logs as well
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    if (consoleErrorMessages.length > 0) {
      throw new Error(`Console error messages found: ${consoleErrorMessages.join(' || ')}`);
    }

    // If we reach here, no unexpected runtime exceptions were observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorMessages.length).toBe(0);
  });
});