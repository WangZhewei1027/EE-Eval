import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d31a6d1-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('REST API Explorer - FSM and UI interactions (6d31a6d1-fa7a-11f0-ba5b-57721b046e74)', () => {
  // Capture console messages and page errors for each test so we can assert no unexpected runtime errors occur.
  test.beforeEach(async ({ page }) => {
    page.context().setDefaultNavigationTimeout(10_000);
    page.on('console', (msg) => {
      // Log console messages to test output for debugging
      // We'll also record them into an array attached to the page for assertions
      const arr = page.getByTestId ? undefined : undefined; // noop to avoid lint warnings
      // Attach to page for later assertions
      if (!page.__consoleMessages) page.__consoleMessages = [];
      page.__consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      if (!page.__pageErrors) page.__pageErrors = [];
      page.__pageErrors.push(err);
    });

    // Prevent default dialogs from failing tests unless we assert their content.
    page.on('dialog', async (dialog) => {
      if (!page.__dialogs) page.__dialogs = [];
      page.__dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.dismiss().catch(() => {});
    });

    // Intercept external fetches to ensure deterministic tests.
    // We'll provide default responses for common endpoints used by the app.
    await page.route('https://jsonplaceholder.typicode.com/**', async (route, req) => {
      const url = req.url();
      // Default mock body
      let body = {};
      let status = 200;
      let statusText = 'OK';
      if (url.endsWith('/posts') && req.method() === 'GET') {
        body = [{ id: 1, title: 'mock post' }];
      } else if (url.endsWith('/posts') && req.method() === 'POST') {
        body = { id: 101, title: 'created', body: 'created body', userId: 1 };
        status = 201;
        statusText = 'Created';
      } else if (url.includes('/posts/1')) {
        body = { id: 1, title: 'mock post 1' };
      } else {
        body = { message: 'mock' };
      }

      await route.fulfill({
        status,
        statusText,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test, assert that there were no uncaught exceptions (pageerror)
    const pageErrors = page.__pageErrors || [];
    // If there are page errors, fail with details.
    expect(pageErrors, `No uncaught page errors should be present. Found: ${pageErrors.map(e => e.toString()).join('; ')}`).toHaveLength(0);

    // Also ensure there are no console.error messages indicating runtime issues
    const consoleMessages = page.__consoleMessages || [];
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors, `No console error/warning messages expected. Found: ${errors.map(e => e.text).join(' | ')}`).toHaveLength(0);
  });

  test('S0 Idle: onload initializes endpoints, request body and headers, and request preview', async ({ page }) => {
    // Validate initial state rendered by init() called on body onload
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Endpoints should be rendered: there are 6 endpoints in the implementation
    const endpoints = page.locator('#endpoints button');
    await expect(endpoints).toHaveCount(6);

    // Request Body textarea should be populated with initial JSON from apiState.requestBody
    const requestBody = page.locator('#requestBody');
    await expect(requestBody).toHaveValue(/\{\s*"title":\s*"foo",/);

    // Custom Headers textarea should be populated with initial headers
    const customHeaders = page.locator('#customHeaders');
    await expect(customHeaders).toHaveValue(/\{\s*"Content-Type":\s*"application\/json"\s*\}/);

    // Request preview should be empty at idle (no selected endpoint and no custom URL)
    const preview = await page.locator('#requestPreview').innerText();
    expect(preview.trim()).toBe('');
  });

  test('S1 EndpointSelected: selecting an endpoint updates endpointInfo and request preview', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Click the first endpoint button (GET /posts)
    const firstEndpoint = page.locator('#endpoints button').first();
    await firstEndpoint.click();

    // endpointInfo should reflect the base URL + path
    await expect(page.locator('#endpointInfo')).toHaveText(/GET https:\/\/jsonplaceholder.typicode.com\/posts/);

    // requestPreview should update accordingly
    await expect(page.locator('#requestPreview')).toHaveText(/GET https:\/\/jsonplaceholder.typicode.com\/posts/);
  });

  test('S3_RequestExecuting -> S4_ResponseReceived: executing a selected endpoint request displays response status, headers and body and updates history', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Select GET /posts endpoint
    await page.locator('#endpoints button', { hasText: 'GET /posts' }).click();

    // Click Send Request
    await page.locator('button', { hasText: 'Send Request' }).click();

    // Wait for responseStatus to show a status (the page's fetch is mocked to respond)
    await expect(page.locator('#responseStatus')).toHaveText(/200/);

    // Response body should contain our mocked "mock post" string
    const responseBodyText = await page.locator('#responseBody').innerText();
    expect(responseBodyText).toContain('mock post');

    // Response headers should include content-type
    const responseHeaders = await page.locator('#responseHeaders').innerText();
    expect(responseHeaders.toLowerCase()).toContain('content-type');

    // History should have at least one entry
    await expect(page.locator('#history div')).toHaveCount(1);
    await expect(page.locator('#history')).toContainText('/posts');
  });

  test('S0 -> S2 CustomRequest: toggling request type to custom shows custom request UI and allows executing custom request', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Switch to custom request type
    await page.selectOption('#requestType', 'custom');

    // endpointsSection should be hidden, customRequestSection visible
    const endpointsSectionDisplay = await page.locator('#endpointsSection').evaluate((el) => getComputedStyle(el).display);
    const customSectionDisplay = await page.locator('#customRequestSection').evaluate((el) => getComputedStyle(el).display);
    expect(endpointsSectionDisplay).toBe('none');
    expect(customSectionDisplay).not.toBe('none');

    // Fill custom URL and method and ensure preview updates
    await page.fill('#customUrl', 'https://jsonplaceholder.typicode.com/posts');
    // dispatch change event to trigger updateCustomUrl (Playwright fill does not always trigger onchange)
    await page.locator('#customUrl').evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await page.selectOption('#customMethod', 'POST');
    await page.locator('#customMethod').evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

    await expect(page.locator('#requestPreview')).toHaveText(/POST https:\/\/jsonplaceholder.typicode.com\/posts/);

    // Click Send Request to perform POST (mock will respond with 201 Created)
    await page.locator('button', { hasText: 'Send Request' }).click();

    // Response status should reflect 201 Created from the mocked handler
    await expect(page.locator('#responseStatus')).toHaveText(/201/);
    const bodyText = await page.locator('#responseBody').innerText();
    expect(bodyText).toContain('"id": 101');
  });

  test('PARAMS: adding, filling, and removing query parameters affect request URL', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Add a parameter
    await page.locator('button', { hasText: 'Add Parameter' }).click();

    // After adding, there should be at least one param row (initial state already had one, but ensure inputs exist)
    const paramRows = page.locator('#paramsContainer div');
    const count = await paramRows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Fill the first param key and value and trigger change events
    const firstKey = paramRows.locator('input').nth(0);
    const firstValue = paramRows.locator('input').nth(1);

    await firstKey.fill('search');
    await firstKey.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await firstValue.fill('test value');
    await firstValue.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

    // Select an endpoint to use base URL
    await page.locator('#endpoints button', { hasText: 'GET /posts' }).click();

    // Intercept fetch calls to assert query string contains our param
    let interceptedUrl = null;
    await page.route('https://jsonplaceholder.typicode.com/**', async (route, req) => {
      interceptedUrl = req.url();
      await route.fulfill({
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: 1 }])
      });
    });

    // Execute request
    await page.locator('button', { hasText: 'Send Request' }).click();

    // Ensure the intercepted URL contains encoded query param
    await expect.poll(() => interceptedUrl).toContain('search=test%20value');

    // Now remove the param via the remove button on the first param row
    const removeBtn = paramRows.locator('button', { hasText: 'Remove' }).first();
    await removeBtn.click();

    // After removal, re-execute to ensure URL no longer contains param
    interceptedUrl = null;
    await page.route('https://jsonplaceholder.typicode.com/**', async (route, req) => {
      interceptedUrl = req.url();
      await route.fulfill({
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: 1 }])
      });
    });

    await page.locator('button', { hasText: 'Send Request' }).click();
    // If param removed, URL should not include 'search='
    await expect.poll(() => interceptedUrl).not.toContain('search=');
  });

  test('FORMAT_JSON: formatting valid JSON and handling invalid JSON for format and headers/body', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Put a compact JSON into customHeaders and click Format JSON
    await page.fill('#customHeaders', '{"a":1,"b":{"c":2}}');
    await page.locator('button', { hasText: 'Format JSON' }).click();

    // Formatted JSON should be pretty-printed (multiple lines)
    const formatted = await page.locator('#customHeaders').inputValue();
    expect(formatted).toContain('\n'); // pretty printed contains newlines
    expect(formatted).toContain('"a": 1');

    // Now test formatJson error path with invalid JSON for requestBody
    await page.fill('#requestBody', '{ invalid json }');
    // Click Format JSON next to Request Body (button with onclick formatJson('requestBody'))
    await page.locator('button', { hasText: 'Format JSON' }).nth(1).click();

    // A dialog should have been shown and dismissed by our handler; check captured dialogs
    const dialogs = page.__dialogs || [];
    // The last dialog should include 'Invalid JSON'
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toMatch(/Invalid JSON/);
  });

  test('Edge cases: invalid headers JSON and invalid request body JSON produce alerts and prevent fetch', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Select any endpoint
    await page.locator('#endpoints button', { hasText: 'GET /posts' }).click();

    // Put invalid headers JSON and attempt to send request
    await page.fill('#customHeaders', '{ invalid: json }');
    // Trigger change to ensure the page's apiState.customHeaders may not be updated by onchange, but executeRequest reads apiState.customHeaders which is initialized
    await page.locator('#customHeaders').evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

    // Clear previously captured dialogs
    page.__dialogs = [];

    // Click Send Request; since headers JSON is invalid, the function executeRequest will catch JSON.parse and alert 'Invalid headers JSON' then return without fetching.
    await page.locator('button', { hasText: 'Send Request' }).click();

    // Ensure an alert dialog was captured indicating invalid headers
    const dialogs = page.__dialogs || [];
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1].message).toMatch(/Invalid headers JSON/);

    // Now test invalid request body JSON for a non-GET method: toggle to custom: POST
    await page.selectOption('#requestType', 'custom');
    await page.selectOption('#customMethod', 'POST');
    await page.fill('#customUrl', 'https://jsonplaceholder.typicode.com/posts');
    await page.locator('#customUrl').evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

    // Set invalid request body
    await page.fill('#requestBody', '{ invalid body }');
    await page.locator('#requestBody').evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

    // Clear dialogs capture
    page.__dialogs = [];

    // Click Send Request, should alert about invalid request body JSON
    await page.locator('button', { hasText: 'Send Request' }).click();

    const dialogs2 = page.__dialogs || [];
    expect(dialogs2.length).toBeGreaterThanOrEqual(1);
    expect(dialogs2[dialogs2.length - 1].message).toMatch(/Invalid request body JSON/);
  });

  test('History: after successful requests, items can be loaded back into custom request inputs', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Select endpoint and send request to create a history item
    await page.locator('#endpoints button', { hasText: 'GET /posts' }).click();
    await page.locator('button', { hasText: 'Send Request' }).click();

    // Wait for history entry to appear
    await expect(page.locator('#history div')).toHaveCount(1);

    // Click Load in history to populate custom URL and method
    const loadBtn = page.locator('#history button', { hasText: 'Load' }).first();
    await loadBtn.click();

    // After loading, customUrl and customMethod inputs should be populated
    const customUrlVal = await page.locator('#customUrl').inputValue();
    const customMethodVal = await page.locator('#customMethod').inputValue();
    expect(customUrlVal).toContain('https://jsonplaceholder.typicode.com/posts');
    // customMethod should be GET for this request
    expect(customMethodVal).toBe('GET');

    // And request preview should reflect the custom request now
    await expect(page.locator('#requestPreview')).toHaveText(/GET https:\/\/jsonplaceholder.typicode.com\/posts/);
  });
});