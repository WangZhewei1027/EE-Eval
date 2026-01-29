import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72acc473-fa78-11f0-812d-c9788050701f.html';

test.describe('Agile Methodology | Visual Journey - FSM validation (72acc473-fa78-11f0-812d-c9788050701f)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      // store text for assertions / debugging
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError / TypeError / SyntaxError etc.)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page (S0_Idle is the initial state)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // After each test, attach console and errors to test info for easier debugging (if needed)
    // Note: we do not modify the page or global environment; only observe.
    // No explicit teardown required since Playwright manages pages.
  });

  test('Initial Idle State (S0_Idle) renders correctly and exposes primary components', async ({ page }) => {
    // Validate initial DOM structure expected for S0_Idle
    // - header and title present
    // - controls container exists and contains the two buttons
    // - agile wheel center is present
    // - three sprints and six wheel nodes exist

    // Header/title
    const title = await page.locator('header h1');
    await expect(title).toHaveText('Agile Methodology');

    // Subtitle present
    await expect(page.locator('p.subtitle')).toBeVisible();

    // Controls container
    const controls = page.locator('.controls');
    await expect(controls).toBeVisible();

    // Buttons exist
    const animateBtn = page.locator('#animateBtn');
    const learnBtn = page.locator('#learnBtn');
    await expect(animateBtn).toHaveText('Replay Animation');
    await expect(learnBtn).toHaveText('Learn More');

    // Agile wheel center text
    await expect(page.locator('.wheel-center')).toHaveText('Agile');

    // Six wheel nodes exist
    const nodes = page.locator('.wheel-node');
    await expect(nodes).toHaveCount(6);

    // Three sprint sections exist
    const sprints = page.locator('.sprint');
    await expect(sprints).toHaveCount(3);

    // Wait for CSS animations that expose controls to finish (controls animation starts at ~3.2s)
    // Use a reasonable timeout to wait for computed opacity to become '1'
    await page.waitForFunction(() => {
      const el = document.querySelector('.controls');
      if (!el) return false;
      return getComputedStyle(el).opacity === '1';
    }, null, { timeout: 6000 });

    // Assert that no page errors were emitted during initial load
    // The FSM expects renderPage() in S0_Idle; the implementation renders the page on load.
    expect(pageErrors.length === 0).toBeTruthy();

    // Ensure there are no obvious console errors
    const hasConsoleErrors = consoleMessages.some(m => m.type === 'error' || m.text.toLowerCase().includes('error'));
    expect(hasConsoleErrors).toBeFalsy();
  });

  test('Learn More transition (S0_Idle -> S2_Learning_More) triggers expected alert with message', async ({ page }) => {
    // The FSM defines that clicking #learnBtn should show an alert with a specific message
    const expectedAlertText = 'For more detailed information about Agile Methodology, visit agilealliance.org or scrum.org';

    // Listen for the dialog once and assert its message
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#learnBtn'), // triggers alert
    ]);

    // Validate the alert message matches FSM entry action
    expect(dialog.message()).toBe(expectedAlertText);

    // Accept the alert to allow the page to continue
    await dialog.accept();

    // After the alert, ensure we did not navigate away (should remain on same URL)
    expect(page.url()).toBe(APP_URL);

    // Ensure no unexpected page errors occurred during this interaction
    expect(pageErrors.length === 0).toBeTruthy();
  });

  test('Replay Animation transition (S0_Idle -> S1_Animation_Replayed) reloads the page', async ({ page }) => {
    // Clicking #animateBtn should call window.location.reload() and result in a page reload.
    // We'll click and wait for navigation to complete.

    // Ensure the page is in initial state first
    await expect(page.locator('#animateBtn')).toBeVisible();

    // Perform click and wait for the reload/navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.click('#animateBtn'),
    ]);

    // After reload, the URL should still be the same (reload of same page)
    expect(page.url()).toBe(APP_URL);

    // Verify that the page still renders the primary elements after reload (renderPage behavior)
    await expect(page.locator('header h1')).toHaveText('Agile Methodology');
    await expect(page.locator('#learnBtn')).toBeVisible();

    // Additionally, ensure that the learn button still triggers the alert after reload,
    // demonstrating that event handlers are reattached as part of the page lifecycle.
    const expectedAlertText = 'For more detailed information about Agile Methodology, visit agilealliance.org or scrum.org';
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#learnBtn'),
    ]);
    expect(dialog.message()).toBe(expectedAlertText);
    await dialog.accept();

    // Confirm no page errors were observed across the reload
    expect(pageErrors.length === 0).toBeTruthy();
  });

  test('Edge case: attempting to interact with the page while an alert is open causes interaction failure', async ({ page }) => {
    // This validates browser behavior when a blocking alert is open (S2_Learning_More active).
    // We open the alert via Learn More and do not accept it immediately, then attempt to click Replay Animation.
    // We expect the second interaction to fail while the dialog is open.

    // Trigger the alert and capture the Dialog object without accepting it yet
    const dialogPromise = new Promise(resolve => page.once('dialog', dialog => resolve(dialog)));
    await page.click('#learnBtn');
    const dialog = await dialogPromise;

    // At this point the alert is open and modal. Attempting to click another element should error.
    // Use a short timeout so the test does not hang long waiting for auto-wait.
    let clickFailed = false;
    try {
      await page.click('#animateBtn', { timeout: 2000 });
    } catch (err) {
      clickFailed = true;
      // The error should indicate that the page has a modal dialog open or the action was interrupted.
      // We assert that some error was thrown rather than attempting to interact.
      expect(err).toBeTruthy();
    }

    expect(clickFailed).toBeTruthy();

    // Clean up by accepting the dialog so subsequent tests are not contaminated
    await dialog.accept();
  });

  test('Edge case: repeated rapid click on Learn More (alert opens each time) is handled', async ({ page }) => {
    // Clicking the Learn More button multiple times will produce multiple alerts sequentially.
    // We will click, accept, click again, accept again, ensuring each alert shows the expected message.

    const expectedAlertText = 'For more detailed information about Agile Methodology, visit agilealliance.org or scrum.org';

    // First click -> alert
    const [firstDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#learnBtn'),
    ]);
    expect(firstDialog.message()).toBe(expectedAlertText);
    await firstDialog.accept();

    // Second click -> alert again
    const [secondDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#learnBtn'),
    ]);
    expect(secondDialog.message()).toBe(expectedAlertText);
    await secondDialog.accept();

    // Ensure no errors were recorded during this sequence
    expect(pageErrors.length === 0).toBeTruthy();
  });

  test('Observes console and page errors across interactions (reporting behavior)', async ({ page }) => {
    // This test ensures we actively observed console messages and page errors while interacting with the app.
    // We will perform both transitions and then assert the collected diagnostics meet expectations.

    // Perform Learn More (alert)
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#learnBtn'),
    ]);
    await dialog.accept();

    // Perform Replay Animation (reload)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.click('#animateBtn'),
    ]);

    // After interactions, assert that we have recorded any console messages (if they exist)
    // and that pageErrors array reflects any runtime errors. The implementation is expected to be clean,
    // so we assert there are no page errors, but we still output captured console messages for transparency.
    expect(pageErrors.length === 0).toBeTruthy();

    // If console messages exist, they should not be severe errors.
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.text.toLowerCase().includes('error'));
    expect(severeConsole.length).toBe(0);
  });

});