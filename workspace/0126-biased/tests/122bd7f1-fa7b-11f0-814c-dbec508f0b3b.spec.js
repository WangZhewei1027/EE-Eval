import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bd7f1-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Exponential Search App (122bd7f1-fa7b-11f0-814c-dbec508f0b3b)', () => {
  let page;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    // Capture console logs and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Record console messages (type and text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Uncaught exceptions on the page
      pageErrors.push(err.message);
    });

    // Load the app page as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  // Validate the initial Idle state: elements are present and page rendered
  test('Idle state: initial render shows input, button, and empty result container', async () => {
    // Verify input exists with placeholder and button exists
    const input = page.locator('#search-input');
    const button = page.locator('#search-button');
    const result = page.locator('#result-container');

    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Search...');
    await expect(button).toBeVisible();

    // Initially the result container should be empty
    await expect(result).toHaveText('', { timeout: 1000 });

    // There should be no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: clicking search with empty query should display 'Please enter a query'
  test('NoResults transition: clicking search with empty input displays "Please enter a query"', async () => {
    const button = page.locator('#search-button');
    const result = page.locator('#result-container');

    // Ensure input is empty
    const input = page.locator('#search-input');
    await expect(input).toHaveValue('');

    // Click the button. The page code will set resultContainer.innerHTML = 'Please enter a query'
    // Note: The button is inside a form and may trigger navigation; read the DOM immediately after click.
    try {
      await page.click('#search-button');
    } catch (e) {
      // Click might cause navigation; swallow to continue checks below
    }

    // Attempt to read the result container quickly — the handler sets the innerHTML synchronously before form submission
    let text = '';
    try {
      text = await result.innerText({ timeout: 500 });
    } catch (err) {
      // If navigation happened too quickly, re-load the page to a stable state and fail the assertion with context
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      text = await result.innerText().catch(() => '');
    }

    // Validate the No Results message was displayed (it's the specified behavior)
    expect(text.trim()).toBe('Please enter a query');
  });

  // Searching transition: clicking search with a non-empty query should trigger a network request to the API
  test('Searching transition (ClickSearchButton): clicking search with a query triggers a fetch to the API and logs errors on failure', async () => {
    const input = page.locator('#search-input');
    const button = page.locator('#search-button');

    // Fill a query
    await input.fill('test-query');

    // Listen for the outgoing network request to the exponential-search API
    const requestPromise = page.waitForRequest((req) =>
      req.url().includes('api.exponential-search.com/v1/search') && req.method() === 'GET'
    );

    // Click the search button. Because the button sits inside a form, click may cause navigation;
    // we still want to observe the outgoing request if the page tries to fetch.
    try {
      await page.click('#search-button');
    } catch (e) {
      // swallow navigation-related errors
    }

    // Wait for the request to be observed (if any). Use a modest timeout.
    const req = await requestPromise.catch(() => null);

    // Assert that the search request was attempted
    expect(req, 'Expected a network request to the exponential-search API to be made').not.toBeNull();
    if (req) {
      expect(req.url()).toContain('q=test-query');
    }

    // The page's fetch uses a .catch(error => console.error(error)); so a failed fetch should produce a console.error
    // Wait briefly to collect console messages
    await page.waitForTimeout(300);

    const errorConsole = consoleMessages.find((m) => m.type === 'error' || m.text.toLowerCase().includes('typeerror') || m.text.toLowerCase().includes('failed'));
    expect(errorConsole, 'Expected a console.error from the failed fetch to be logged').toBeTruthy();
  });

  // PressEnter event: pressing Enter in the input triggers the search (calls button.click())
  test('PressEnter event: pressing Enter key triggers search request (same behavior as clicking the button)', async () => {
    const input = page.locator('#search-input');

    // Type a query and press Enter
    await input.fill('enter-test');

    // Wait for the request to the API triggered by Enter -> click path
    const requestPromise = page.waitForRequest((req) =>
      req.url().includes('api.exponential-search.com/v1/search') && req.method() === 'GET'
    );

    // Focus and press Enter
    await input.focus();
    try {
      await page.keyboard.press('Enter');
    } catch (e) {
      // swallow potential navigation-caused exceptions
    }

    const req = await requestPromise.catch(() => null);
    expect(req, 'Expected a network request to the exponential-search API when pressing Enter').not.toBeNull();
    if (req) {
      expect(req.url()).toContain('q=enter-test');
    }

    // Confirm that an error was logged by the fetch.catch (if fetch failed)
    await page.waitForTimeout(300);
    const err = consoleMessages.find((m) => m.type === 'error' || m.text.toLowerCase().includes('failed') || m.text.toLowerCase().includes('typeerror'));
    expect(err, 'Expected a console error after the fetch attempt').toBeTruthy();
  });

  // Input event: typing toggles the search button's disabled state
  test('InputSearch event: typing into the input enables/disables the search button appropriately', async () => {
    const input = page.locator('#search-input');
    const button = page.locator('#search-button');

    // Initially clear input
    await input.fill('');
    // The script sets disabled based on input length on 'input' events.
    // Trigger an input event with empty value
    await input.dispatchEvent('input');
    // After empty input, button should be disabled
    // Note: some browsers may not set disabled initially; wait and check the attribute/state
    await page.waitForTimeout(100);
    const disabledAfterEmpty = await button.isDisabled().catch(() => false);
    // The app's logic sets button.disabled = !searchInput.value.trim().length;
    expect(disabledAfterEmpty).toBe(true);

    // Type non-empty text
    await input.fill('a');
    // Trigger input event
    await input.dispatchEvent('input');
    await page.waitForTimeout(100);
    const disabledAfterTyping = await button.isDisabled().catch(() => false);
    expect(disabledAfterTyping).toBe(false);

    // Clear again and ensure it becomes disabled
    await input.fill('');
    await input.dispatchEvent('input');
    await page.waitForTimeout(100);
    const disabledAfterClearing = await button.isDisabled().catch(() => false);
    expect(disabledAfterClearing).toBe(true);
  });

  // Transition from Searching to Idle on input: while a search is in-flight, user input should still be processed
  test('Transition S1 -> S0 on InputSearch: typing while search is in progress still triggers input handling', async () => {
    const input = page.locator('#search-input');
    const button = page.locator('#search-button');

    // Start with a query that will trigger a fetch
    await input.fill('inflight');
    // Prepare to observe the outgoing request
    const requestPromise = page.waitForRequest((req) =>
      req.url().includes('api.exponential-search.com/v1/search') && req.method() === 'GET'
    );

    // Click to start the search (Searching state)
    try {
      await page.click('#search-button');
    } catch (e) {
      // navigation may occur; swallow
    }

    // Immediately type into the input to trigger the input handler while the search is pending
    // This emulates a user interrupting the search with new input (S1 -> S0 via InputSearch)
    await input.fill('inflight-modified');
    await input.dispatchEvent('input');

    // Ensure that the input handler processed the new text by checking the button disabled state
    await page.waitForTimeout(100);
    const disabled = await button.isDisabled().catch(() => false);
    // Since input is non-empty, button should not be disabled
    expect(disabled).toBe(false);

    // Also assert that the original search request was attempted
    const req = await requestPromise.catch(() => null);
    expect(req, 'Expected an in-flight network request to be started').not.toBeNull();
  });

  // Observe console and page errors behavior across typical interactions
  test('Console & page errors: interactions produce console.error for failed fetches and no uncaught page exceptions', async () => {
    const input = page.locator('#search-input');

    // Trigger at least one fetch by initiating a search
    await input.fill('error-observe');
    try {
      await page.click('#search-button');
    } catch (e) {
      // swallow navigation issues
    }

    // Give some time for the fetch to fail and console.error to be logged
    await page.waitForTimeout(500);

    // Expect at least one console error due to fetch failure (the script logs errors in .catch)
    const hasConsoleError = consoleMessages.some((m) => m.type === 'error' || /failed to fetch|typeerror/i.test(m.text));
    expect(hasConsoleError, 'Expected console.error entries from fetch failure').toBeTruthy();

    // We do not expect uncaught page exceptions; any such pageerror should be recorded
    expect(pageErrors.length).toBe(0);
  });
});