import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9ae8d0-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Agile Methodology Visual Experience (FSM) - 3c9ae8d0-fa78-11f0-857d-d58e82d5de73', () => {
  // Shared expected texts from the page implementation for easier assertions
  const texts = [
    "Agile Methodology emphasizes flexible, iterative development — delivering small, incremental improvements quickly to maximize customer value and adapt to change efficiently.",
    "It is built on the principles of collaboration, continuous feedback, and adaptive planning, fostering highly responsive teams that prioritize working software and customer satisfaction above all.",
    "The Agile process involves repeated cycles of planning, design, development, testing, deployment, and retrospective analysis to continuously improve and deliver value with each iteration."
  ];

  // These will be reset in beforeEach for each test run
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors so tests can assert on them later.
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the application page exactly as-is (do not modify the page)
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the main app container is present before proceeding
    await expect(page.locator('#app')).toBeVisible();
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, attach some diagnostic info to the Playwright report
    if (testInfo.status !== testInfo.expectedStatus) {
      testInfo.attach('console-messages', {
        body: JSON.stringify({ consoleMessages, consoleErrors, pageErrors }, null, 2),
        contentType: 'application/json'
      });
    }
  });

  test('Initial Idle state is rendered correctly (S0_Idle) ', async ({ page }) => {
    // This test validates the initial "Idle" state evidence from the FSM:
    // - Button exists with id #btn-more
    // - Button text is "Learn More"
    // - aria-controls references desc-text, aria-expanded is "false"
    // - Description text initial content equals texts[0]
    // - Description has the "visible" class due to initial fade-in entry action

    const btn = page.locator('#btn-more');
    const desc = page.locator('#desc-text');

    // Button presence and attributes
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-controls', 'desc-text');
    await expect(btn).toHaveAttribute('aria-label', 'Read more about Agile');
    await expect(btn).toHaveAttribute('id', 'btn-more');
    await expect(btn).toHaveText('Learn More');

    // aria-expanded should be "false" initially (Idle)
    await expect(btn).toHaveAttribute('aria-expanded', 'false');

    // Description content should match the first entry in texts and be visible (class 'visible')
    await expect(desc).toHaveText(texts[0]);
    const descHasVisible = await desc.evaluate((el) => el.classList.contains('visible'));
    expect(descHasVisible).toBeTruthy();

    // Confirm there are no uncaught page errors or console errors at load time
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Learn More cycles states and updates DOM (S0 -> S1 and back) ', async ({ page }) => {
    // This test exercises the LearnMoreClick event and validates transitions:
    // - Each click should advance currentIndex modulo texts.length
    // - aria-expanded is updated immediately on click
    // - desc visible class is removed then re-added after the 300ms timeout
    // - desc.textContent should update to the next text after the timeout
    // - Button label toggles between "Learn More" (index 0) and "Show Less" (index != 0)

    const btn = page.locator('#btn-more');
    const desc = page.locator('#desc-text');

    // Helper to click and assert transition for an expected index
    async function clickAndAssert(expectedIndex) {
      // Click the button
      await btn.click();

      // Immediately after click:
      // - aria-expanded is set to (expectedIndex !== 0)
      const expectedAria = expectedIndex === 0 ? 'false' : 'true';
      await expect(btn).toHaveAttribute('aria-expanded', expectedAria);

      // - The 'visible' class should be removed right away (since script removes then re-adds after timeout)
      const visibleImmediately = await desc.evaluate((el) => el.classList.contains('visible'));
      // It might be removed very quickly; allow both cases but prefer that it was removed at least transiently.
      // We assert here that within 100ms it is not visible (if removal happened), otherwise continue.
      if (visibleImmediately) {
        // Try briefly waiting up to 150ms for the removal to take effect (non-flaky grace)
        await page.waitForTimeout(150);
      }

      // Wait for the script's timeout to complete and the text to update (default 300ms in implementation)
      await expect(desc).toHaveText(texts[expectedIndex], { timeout: 1000 });

      // After the timeout, the visible class should be present again.
      await expect(desc.locator(':scope')).toHaveJSProperty('className'); // ensures element still present
      const visibleAfter = await desc.evaluate((el) => el.classList.contains('visible'));
      expect(visibleAfter).toBeTruthy();

      // Button text should be "Learn More" only if index === 0, otherwise "Show Less"
      const expectedButtonText = expectedIndex === 0 ? 'Learn More' : 'Show Less';
      await expect(btn).toHaveText(expectedButtonText);
    }

    // Starting at index 0 (already asserted in previous test); click => index 1
    await clickAndAssert(1);

    // Click again => index 2
    await clickAndAssert(2);

    // Click again => cycles back to index 0
    await clickAndAssert(0);

    // Final sanity: no uncaught page errors or console errors through the sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid repeated clicks (edge case) should still converge and not throw errors', async ({ page }) => {
    // This edge case simulates many rapid clicks to ensure the FSM cycles correctly and the UI remains stable.
    // We will perform 10 rapid clicks and assert the final state corresponds to (initialIndex + 10) % texts.length.

    const btn = page.locator('#btn-more');
    const desc = page.locator('#desc-text');

    const rapidClicks = 10;
    for (let i = 0; i < rapidClicks; i++) {
      await btn.click();
      // do not wait between clicks to simulate user spamming the control
    }

    // Wait after the last click for the UI to settle (script uses 300ms per click to update)
    await page.waitForTimeout(400);

    // Compute expected index: starting at 0
    const expectedIndex = (0 + rapidClicks) % texts.length;

    // Check desc text and visibility
    await expect(desc).toHaveText(texts[expectedIndex], { timeout: 1000 });
    const visible = await desc.evaluate((el) => el.classList.contains('visible'));
    expect(visible).toBeTruthy();

    // Check button aria-expanded and text consistency
    const expectedAria = expectedIndex === 0 ? 'false' : 'true';
    await expect(btn).toHaveAttribute('aria-expanded', expectedAria);
    const expectedButtonText = expectedIndex === 0 ? 'Learn More' : 'Show Less';
    await expect(btn).toHaveText(expectedButtonText);

    // Assert that no uncaught errors were thrown during rapid clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence: ensure DOM updates correspond to documented entry/exit actions and transition observables', async ({ page }) => {
    // This test cross-checks the FSM evidence clauses against actual DOM behavior:
    // - When expanded, desc.classList should include 'visible'
    // - Button label reflects (currentIndex === 0) ? "Learn More" : "Show Less"
    // - aria-expanded toggles to reflect expansion state

    const btn = page.locator('#btn-more');
    const desc = page.locator('#desc-text');

    // Ensure starting evidence matches Idle
    await expect(btn).toHaveText('Learn More');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(desc).toHaveText(texts[0]);

    // Trigger expand (S0 -> S1)
    await btn.click();
    // After click and update:
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(desc).toHaveText(texts[1], { timeout: 1000 });
    const visibleAfterExpand = await desc.evaluate((el) => el.classList.contains('visible'));
    expect(visibleAfterExpand).toBeTruthy();
    await expect(btn).toHaveText('Show Less');

    // Trigger collapse (S1 -> S0) via two more clicks to cycle back to index 0
    await btn.click(); // index 2
    await expect(desc).toHaveText(texts[2], { timeout: 1000 });
    await btn.click(); // index 0
    await expect(desc).toHaveText(texts[0], { timeout: 1000 });
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(btn).toHaveText('Learn More');

    // Validate that the entry action "renderPage()" was conceptually executed by verifying the page content is present.
    // The application does not expose an explicit renderPage function; we validate presence of key visual elements.
    await expect(page.locator('.wheel')).toBeVisible();
    await expect(page.locator('.center-circle')).toBeVisible();

    // No page errors should have occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe and report console messages and page errors (diagnostic)', async ({ page }) => {
    // This test intentionally gathers console and page-level errors and asserts on their structure.
    // It does not modify the page. It ensures we observed console messages and that none are error-level.
    // This satisfies the requirement to observe console logs and page errors and to assert about them.

    // Wait a short while to ensure any deferred logs or errors are captured
    await page.waitForTimeout(200);

    // Basic expectations:
    // - consoleMessages is an array (could be empty)
    // - pageErrors is an array (should be empty for this page)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // Assert there were no uncaught page errors (ReferenceError/SyntaxError/TypeError...) at page execution
    // If such errors had occurred, they would be present in pageErrors and this assertion would fail,
    // which is desired because the test must surface runtime problems rather than hide them.
    expect(pageErrors.length, `Expected no uncaught page errors, found: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);

    // Assert there are no console.error messages emitted by the app during load
    expect(consoleErrors.length, `Expected no console.error messages, found: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);

    // For additional visibility in test reports, attach the console messages snapshot (if any)
    if (consoleMessages.length > 0) {
      test.info().attach('console-messages-snapshot', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json'
      });
    }
  });
});