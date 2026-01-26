import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d3931-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('HTTPS Demonstration - FSM Validation (de3d3931-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions (e.g., form data)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure we clean up any potential lingering routes or handlers by reloading
    try {
      await page.reload({ waitUntil: 'load' });
    } catch (e) {
      // ignore reload errors during teardown
    }
  });

  test('Initial state S0: page renders connection status and protocol info (entry action verification)', async ({ page }) => {
    // This test validates the "Checking Connection Security" initial state.
    // It confirms the page executed its initial connection check (the entry action that writes status)
    const connectionStatus = page.locator('#connection-status');
    const protocolInfo = page.locator('#protocol-info');

    // The demo is served over http in the test environment. Expect the "not secure" message.
    await expect(connectionStatus).toContainText('not secure', { timeout: 3000 });
    // Confirm the insecure span is present
    await expect(connectionStatus.locator('span.insecure')).toBeVisible();

    // The protocol info should show the explanatory HTTPS recommendation for HTTP-served demo
    await expect(protocolInfo).toHaveText('For security, this demo should be viewed over HTTPS');

    // Ensure no unexpected page errors were emitted during initial render
    expect(pageErrors.length).toBe(0);
  });

  test('Transition LoadInsecureImage -> S1 (Insecure image loaded) when network allows image requests', async ({ page }) => {
    // This test clicks the "Try to Load Insecure Image" button and verifies the insecure image loads.
    // It supports either outcome (insecure loaded or blocked) and asserts the runtime result is one of the FSM's expected states.
    const loadButton = page.locator('#load-insecure');
    const imageResult = page.locator('#image-result');

    // Click to attempt to load insecure image
    await loadButton.click();

    // First, expect the immediate "Trying to load insecure image..." message
    await expect(imageResult).toContainText('Trying to load insecure image...', { timeout: 2000 });

    // After that, either the image will load (S1) or be blocked (S2).
    // Try to detect the insecure loaded state first.
    const insecureParagraph = imageResult.locator('p.insecure');
    const secureParagraph = imageResult.locator('p.secure');

    // Wait for either outcome with a reasonable timeout
    const outcome = await Promise.race([
      insecureParagraph.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'insecure').catch(() => null),
      secureParagraph.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'secure').catch(() => null),
      // If neither appears, we'll continue after timeout
      new Promise((resolve) => setTimeout(() => resolve(null), 5000))
    ]);

    if (outcome === 'insecure') {
      // S1: Insecure image loaded - assert the message and that an <img> element got appended
      await expect(insecureParagraph).toHaveText('Insecure image loaded (not expected with HTTPS!)');
      const appendedImage = imageResult.locator('img');
      await expect(appendedImage).toHaveCount(1);
      // The image src should be the insecure placeholder URL
      const src = await appendedImage.getAttribute('src');
      expect(src).toContain('http://via.placeholder.com/150');
    } else if (outcome === 'secure') {
      // S2: Browser blocked insecure image - assert blocked message text
      await expect(secureParagraph).toHaveText('Browser blocked insecure image (expected behavior with HTTPS)');
    } else {
      // Neither outcome observed: fail the test with diagnostic information
      const currentHtml = await imageResult.innerHTML();
      test.fail(true, `No definitive outcome after attempting to load insecure image. image-result HTML: ${currentHtml}`);
    }

    // Ensure no uncaught page errors occurred as a result of image loading attempt
    expect(pageErrors.length).toBe(0);
  });

  test('Transition LoadInsecureImage -> S2 (Blocked insecure image) by aborting network request', async ({ page }) => {
    // This test forces the browser to "fail" loading the insecure image by aborting the network request.
    // That should trigger the img.onerror handler and produce the blocked message (S2).
    const routeUrlPattern = 'http://via.placeholder.com/**';

    // Install a route to abort the insecure image request
    await page.route(routeUrlPattern, (route) => route.abort());

    const loadButton = page.locator('#load-insecure');
    const imageResult = page.locator('#image-result');

    // Click to attempt to load insecure image (the request will be aborted)
    await loadButton.click();

    // Expect the immediate "Trying to load insecure image..." message first
    await expect(imageResult).toContainText('Trying to load insecure image...', { timeout: 2000 });

    // Now expect the blocked message (secure paragraph)
    const secureParagraph = imageResult.locator('p.secure');
    await expect(secureParagraph).toBeVisible({ timeout: 5000 });
    await expect(secureParagraph).toHaveText('Browser blocked insecure image (expected behavior with HTTPS)');

    // Remove the route so subsequent tests are unaffected.
    await page.unroute(routeUrlPattern);

    // Confirm no uncaught errors were raised
    expect(pageErrors.length).toBe(0);
  });

  test('Transition SubmitSecureForm -> S4 (Form submitted insecurely) on HTTP and console logs form data', async ({ page }) => {
    // This test validates the form submit transition on HTTP (S4), confirms the DOM evidence,
    // and asserts that the page logged the form data to console as implemented in the page script.
    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    const submitButton = page.locator('button[type="submit"]');
    const formResult = page.locator('#form-result');

    // Fill with sample credentials
    await usernameInput.fill('testuser');
    await passwordInput.fill('p@ssw0rd');

    // Submit the form by clicking the submit button
    await Promise.all([
      page.waitForEvent('console', { timeout: 3000 }).catch(() => null), // console.log is expected
      submitButton.click()
    ]);

    // After submission on HTTP (the environment in this test), expect the insecure form submission message (S4)
    const insecureParagraph = formResult.locator('p.insecure');
    await expect(insecureParagraph).toBeVisible({ timeout: 2000 });
    await expect(insecureParagraph).toHaveText('Form submitted over insecure HTTP (data not encrypted)');

    // Assert that the page logged the form data to the console
    const formLog = consoleMessages.find((m) => m.text.includes('Form data:'));
    expect(formLog).toBeTruthy();
    // Ensure the logged JSON-like string includes the username and password we filled
    expect(formLog.text).toContain('testuser');
    expect(formLog.text).toContain('p@ssw0rd');

    // Confirm no uncaught page errors were raised during submission
    expect(pageErrors.length).toBe(0);
  });

  test('FSM evidence check: script contains secure form submission branch (S3 evidence present in source)', async ({ page }) => {
    // This test verifies that the page's script includes the S3 evidence string (i.e., the secure branch).
    // We cannot force the page to be served over HTTPS in this environment, but we can assert that the code path exists.
    // This helps validate that the FSM's S3 transition is represented in the implementation even if not reachable here.
    const scriptHandles = await page.locator('script').all();

    // Find any script element whose text contains the secure-form message
    let found = false;
    for (const handle of scriptHandles) {
      const text = await handle.innerText();
      if (text.includes('<p class="secure">Form submitted securely over HTTPS (data encrypted)</p>')) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  test('Edge case: submitting empty form still triggers form result and logs empty values', async ({ page }) => {
    // This test ensures that even when no username/password are provided, the form submit handler
    // still sets the result and logs something to the console (edge case handling).
    const formResult = page.locator('#form-result');
    const submitButton = page.locator('button[type="submit"]');

    // Clear fields to ensure they are empty
    await page.locator('#username').fill('');
    await page.locator('#password').fill('');

    // Submit
    await Promise.all([
      page.waitForEvent('console', { timeout: 3000 }).catch(() => null),
      submitButton.click()
    ]);

    // Expect insecure result (since served over HTTP)
    await expect(formResult.locator('p.insecure')).toBeVisible({ timeout: 2000 });
    await expect(formResult.locator('p.insecure')).toHaveText('Form submitted over insecure HTTP (data not encrypted)');

    // Ensure the console contains the 'Form data:' log and that empty values appear in the logged output
    const formLog = consoleMessages.find((m) => m.text.includes('Form data:'));
    expect(formLog).toBeTruthy();
    expect(formLog.text).toContain('username');
    expect(formLog.text).toContain('password');

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: clicking "Try to Load Insecure Image" multiple times behaves consistently', async ({ page }) => {
    // Click the button multiple times and ensure the page continues to produce a valid outcome each time.
    const loadButton = page.locator('#load-insecure');
    const imageResult = page.locator('#image-result');

    // Perform multiple attempts (3) and assert each attempt yields an expected FSM outcome
    for (let i = 0; i < 3; i++) {
      await loadButton.click();
      // Wait for the initial "Trying to load insecure image..." then for final outcome
      await expect(imageResult).toContainText('Trying to load insecure image...', { timeout: 2000 });

      const insecureParagraph = imageResult.locator('p.insecure');
      const secureParagraph = imageResult.locator('p.secure');

      // Wait for one of the outcome paragraphs
      const outcome = await Promise.race([
        insecureParagraph.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'insecure').catch(() => null),
        secureParagraph.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'secure').catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), 5000))
      ]);

      expect(['insecure', 'secure'].includes(outcome)).toBe(true);
      // Small pause between iterations to let DOM stabilize
      await page.waitForTimeout(200);
    }

    // Ensure no uncaught errors over repeated operations
    expect(pageErrors.length).toBe(0);
  });
});