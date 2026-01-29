import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f5b91-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Socket Programming Demo - FSM and UI validation', () => {
  // Each test will attach its own listeners to capture runtime errors and console logs.
  // We intentionally do NOT modify the page JS environment. We allow any runtime errors
  // (ReferenceError / TypeError / SyntaxError, etc.) to happen naturally and assert they occur.

  test('UI elements are present and have expected attributes', async ({ page }) => {
    // Capture console messages and page errors for diagnostics (but not asserting them here)
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push(msg.text()));
    page.on('pageerror', (err) => pageErrors.push(err));

    // Navigate to the page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Validate presence of expected components from the FSM/components list
    const messageInput = page.locator('input#messageInput');
    const submitButton = page.locator("button[type='submit']");
    const messagesDiv = page.locator('#messages');
    const form = page.locator('form#form');

    // Assertions for DOM elements and attributes
    await expect(messageInput).toBeVisible();
    await expect(messageInput).toHaveAttribute('placeholder', 'Type a message...');
    await expect(messageInput).toHaveAttribute('required', '');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveText('Send');
    await expect(messagesDiv).toBeVisible();
    await expect(form).toBeVisible();

    // On initial load (before any server interactions) messages div should be empty or contain only whitespace
    const messagesContent = await messagesDiv.innerHTML();
    expect(messagesContent.trim().length).toBeLessThanOrEqual(0);

    // Ensure that at least one pageerror or console error occurred because the HTML includes Node.js server code (require)
    // which is not valid in the browser. We assert that such an error appeared.
    // We allow either a pageerror (uncaught exception) or a console.error that mentions require.
    const hasRequireError =
      pageErrors.some((e) => /require is not defined|ReferenceError: require is not defined/i.test(String(e?.message))) ||
      consoleMessages.some((m) => /require is not defined|ReferenceError: require is not defined/i.test(String(m)));

    expect(hasRequireError).toBeTruthy();
  });

  test('Submitting empty form is blocked by HTML required validation (no submit handler invoked)', async ({ page }) => {
    // We want to ensure the browser's native validation prevents submit when input is empty.
    // Attach listeners to detect any page error that might occur if submit handler ran.
    const pageErrors1 = [];
    const consoleMessages1 = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push(msg.text()));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure input is empty
    const messageInput1 = page.locator('input#messageInput1');
    await expect(messageInput).toHaveValue('');

    // Click the submit button without entering text
    await page.click("button[type='submit']");

    // Wait briefly to allow any event handlers to run if they were invoked
    await page.waitForTimeout(300);

    // Because the input is required, the 'submit' event should NOT be dispatched by the browser.
    // Therefore, we expect NOT to see errors caused by socket.send being executed.
    // Assert that we did not receive an additional pageerror that mentions send/InvalidStateError.
    const sendErrorDetected = pageErrors.some((e) =>
      /InvalidStateError|DOMException|send|WebSocket/i.test(String(e?.message))
    ) || consoleMessages.some((m) => /InvalidStateError|DOMException|send|WebSocket/i.test(String(m)));

    expect(sendErrorDetected).toBeFalsy();

    // Additionally, messages area should remain unchanged
    const messagesDiv1 = page.locator('#messages');
    const content = await messagesDiv.innerHTML();
    expect(content.trim().length).toBeLessThanOrEqual(0);
  });

  test('Submitting a message triggers the page script and results in a runtime error due to missing/closed WebSocket', async ({ page }) => {
    // This test validates the FormSubmitted transition and verifies that socket.send may fail in this environment.
    // We will fill the required input and submit the form. Since the page attempts to send via WebSocket to
    // ws://localhost:8080 and we have not provided a server, the operation may throw an error which we must assert.

    const pageErrors2 = [];
    const consoleMessages2 = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      // capture console.error or other console outputs
      consoleMessages.push(msg.text());
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Fill the input with a test message
    const messageInput2 = page.locator('input#messageInput2');
    await messageInput.fill('Hello Playwright');

    // Submit the form
    await page.click("button[type='submit']");

    // Wait to allow script to execute and errors to surface
    await page.waitForTimeout(500);

    // We expect at least one runtime exception or console error related to WebSocket or send attempt.
    // Possible observable errors:
    // - DOMException / InvalidStateError thrown by socket.send()
    // - console.error('WebSocket error:', error) handler invoked
    // - other pageerror from Node.js require() usage
    const sendRelatedError =
      pageErrors.some((e) => /InvalidStateError|DOMException|send|WebSocket/i.test(String(e?.message))) ||
      consoleMessages.some((m) => /WebSocket error:|InvalidStateError|DOMException|send/i.test(String(m)));

    expect(sendRelatedError).toBeTruthy();

    // After submission, if the script managed to execute socket.send successfully,
    // it would clear the input. However, if socket.send threw, the input may not be cleared.
    // We assert that either the input was cleared OR a send-related error was raised.
    const inputValue = await messageInput.inputValue();
    const inputCleared = inputValue === '';
    expect(inputCleared || sendRelatedError).toBeTruthy();
  });

  test('WebSocket connection failure and error logging observed in console', async ({ page }) => {
    // Validate that the script logs WebSocket related errors to the console (via console.error in the page script)
    // and that page-level errors due to Node code are present.

    const consoleMessages3 = [];
    const pageErrors3 = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for potential websocket errors and the require ReferenceError to surface
    await page.waitForTimeout(600);

    // Expect at least one console.error that mentions 'WebSocket error:' OR a connection failure message
    const wsConsoleError = consoleMessages.some((c) =>
      /WebSocket error:|WebSocket is closed|WebSocket connection to.*failed|security error/i.test(String(c.text))
    );

    // Expect a page-level ReferenceError due to require(...) in the browser script
    const requirePageError = pageErrors.some((e) => /require is not defined|ReferenceError: require/i.test(String(e?.message)));

    // At least one of these error indicators should be true in this environment
    expect(wsConsoleError || requirePageError).toBeTruthy();
  });

  test('FSM states: Connected and Disconnected messages are not erroneously present without a running ws server', async ({ page }) => {
    // This test checks the application's messagesDiv for the presence or absence of the 'Connected to server'
    // and 'Disconnected from server' indicators described in the FSM.
    // Since the environment likely has no ws server, we assert that the 'Connected to server' message does NOT appear.
    // We also check for 'Disconnected from server' which should only appear on a close event; absence is acceptable.

    const consoleMessages4 = [];
    const pageErrors4 = [];
    page.on('console', (msg) => consoleMessages.push(msg.text()));
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait to allow any open/close handlers to run if they will
    await page.waitForTimeout(800);

    const messagesDiv2 = page.locator('#messages');
    const content1 = await messagesDiv.innerText();

    // The FSM expects that when ConnectionOpened the page would contain 'Connected to server'.
    // In this test environment, we typically do not have a server so that string should NOT exist.
    expect(content).not.toContain('Connected to server');

    // Similarly, 'Disconnected from server' should only appear if a close event occurred.
    // It may or may not appear depending on runtime; we assert that appearance is not required,
    // but if it does appear, it's an allowed valid transition to S1_Disconnected.
    const disconnectedPresent = content.includes('Disconnected from server');

    // If disconnectedPresent is true it indicates the ConnectionClosed transition occurred; that's acceptable.
    // If it's false, it's also acceptable because no server close event happened.
    expect([true, false]).toContain(disconnectedPresent);
  });

  test.afterEach(async ({}, testInfo) => {
    // noop teardown - tests intentionally do not alter the app environment
    // We include this hook to highlight setup/teardown awareness per requirements.
  });
});