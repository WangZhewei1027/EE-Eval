import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d6043-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('REST API Demo (FSM verification) - de3d6043-fa74-11f0-a1b6-4b9b8151441a', () => {
  // Keep track of console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application without altering any runtime code
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity checks after each test:
    // - Ensure there were no uncaught page errors (the app catches fetch errors internally).
    expect(pageErrors.length, 'There should be no uncaught page errors').toBe(0);

    // - Console should not contain any SyntaxError/ReferenceError/TypeError messages.
    for (const msg of consoleMessages) {
      const text = (msg && msg.text) ? msg.text : '';
      expect(text.includes('ReferenceError')).toBeFalsy();
      expect(text.includes('SyntaxError')).toBeFalsy();
      expect(text.includes('TypeError')).toBeFalsy();
    }

    // Close the page to ensure clean state for next test (Playwright test runner will handle this as well)
    await page.close();
  });

  test('Idle state: initial render shows all buttons and default pre texts; renderPage not implemented', async ({ page }) => {
    // Validate that each control described by the FSM is present in the Idle state.

    // Buttons presence
    const fetchBtn = page.locator("button[onclick='fetchPosts()']");
    const createBtn = page.locator("button[onclick='createPost()']");
    const updateBtn = page.locator("button[onclick='updatePost()']");
    const deleteBtn = page.locator("button[onclick='deletePost()']");

    await expect(fetchBtn).toBeVisible();
    await expect(createBtn).toBeVisible();
    await expect(updateBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // Pre elements default texts
    await expect(page.locator('#getResult')).toHaveText('Click the button to fetch data...');
    await expect(page.locator('#postResult')).toHaveText('Click the button to create a new post...');
    await expect(page.locator('#putResult')).toHaveText('Click the button to update post #1...');
    await expect(page.locator('#deleteResult')).toHaveText('Click the button to delete post #1...');

    // FSM mentions an entry action renderPage(). Verify whether that function exists on window.
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // The code shipped with the HTML does not define renderPage(); assert that fact.
    expect(renderPageExists).toBeFalsy();
  });

  test('Transition S0 -> S1 (Fetch Posts): clicking Fetch Posts displays status and first 5 posts', async ({ page }) => {
    // Click GET button and validate the getResult pre updates with a Status and JSON (first 5 posts)
    const getResult = page.locator('#getResult');
    await page.click("button[onclick='fetchPosts()']");

    // Expect either a successful response (Status) or an error message within a reasonable timeout
    await expect(getResult).toContainText('Status:', { timeout: 5000 });

    // The successful path should include a JSON array snippet - check for '[' indicating JSON array
    const text1 = await getResult.textContent();
    expect(text.length).toBeGreaterThan(10);
    expect(
      text.includes('[') || text.includes('Error:')
    ).toBeTruthy();
  });

  test('Transition S0 -> S2 (Create Post): clicking Create Post displays status and created post JSON', async ({ page }) => {
    const postResult = page.locator('#postResult');
    await page.click("button[onclick='createPost()']");

    // On success expect Status and JSON object; JSONPlaceholder usually returns an object with an id
    await expect(postResult).toContainText('Status:', { timeout: 5000 });

    const content = await postResult.textContent();
    // It should either show an object ("{") or display an Error message handled by the page
    expect(content.length).toBeGreaterThan(10);
    expect(content.includes('{') || content.includes('Error:')).toBeTruthy();

    // If successful and JSON contains 'title', ensure our posted title is reflected
    if (content.includes('title')) {
      expect(content.includes('New Post Title')).toBeTruthy();
    }
  });

  test('Transition S0 -> S3 (Update Post): clicking Update Post displays status and updated post JSON', async ({ page }) => {
    const putResult = page.locator('#putResult');
    await page.click("button[onclick='updatePost()']");

    await expect(putResult).toContainText('Status:', { timeout: 5000 });

    const content1 = await putResult.textContent();
    expect(content.length).toBeGreaterThan(10);
    // The updated JSON should include our updated title on success
    if (content.includes('"title"') || content.includes('Updated Post Title')) {
      expect(content.includes('Updated Post Title')).toBeTruthy();
    } else {
      // If an error occurred, the page is expected to show an Error message caught by the try/catch
      expect(content.includes('Error:')).toBeTruthy();
    }
  });

  test('Transition S0 -> S4 (Delete Post): clicking Delete Post displays status and simulated deletion message', async ({ page }) => {
    const deleteResult = page.locator('#deleteResult');
    await page.click("button[onclick='deletePost()']");

    await expect(deleteResult).toContainText('Status:', { timeout: 5000 });

    const content2 = await deleteResult.textContent();
    // The implementation inserts a simulated deletion message on success
    const containsSimulated = content.includes('Post #1 has been deleted (simulated)');
    const containsError = content.includes('Error:');

    expect(containsSimulated || containsError).toBeTruthy();
  });

  test('Error handling: simulate network failure for GET and verify the UI shows an Error message', async ({ page }) => {
    // Install a route to abort network requests to the API to force fetch() to throw.
    const routeUrl = 'https://jsonplaceholder.typicode.com/*';
    const abortHandler = async (route) => {
      await route.abort();
    };

    await page.route(routeUrl, abortHandler);

    const getResult1 = page.locator('#getResult1');
    await page.click("button[onclick='fetchPosts()']");

    // The page's fetchPosts function catches errors and writes 'Error:' into getResult.
    await expect(getResult).toContainText('Error:', { timeout: 5000 });

    // Clean up the route so other tests are not impacted.
    await page.unroute(routeUrl, abortHandler);
  });

  test('Error handling: simulate network failure for POST/PUT/DELETE and verify each displays an Error message', async ({ page }) => {
    // Abort network requests to force errors for POST/PUT/DELETE
    const routeUrl1 = 'https://jsonplaceholder.typicode.com/*';
    const abortHandler1 = async (route) => {
      await route.abort();
    };

    await page.route(routeUrl, abortHandler);

    // POST
    const postResult1 = page.locator('#postResult1');
    await page.click("button[onclick='createPost()']");
    await expect(postResult).toContainText('Error:', { timeout: 5000 });

    // PUT
    const putResult1 = page.locator('#putResult1');
    await page.click("button[onclick='updatePost()']");
    await expect(putResult).toContainText('Error:', { timeout: 5000 });

    // DELETE
    const deleteResult1 = page.locator('#deleteResult1');
    await page.click("button[onclick='deletePost()']");
    await expect(deleteResult).toContainText('Error:', { timeout: 5000 });

    // Clean up the route
    await page.unroute(routeUrl, abortHandler);
  });

  test('Console and page error observation: ensure no uncaught exceptions during a sequence of interactions', async ({ page }) => {
    // Perform a sequence: Fetch -> Create -> Update -> Delete to exercise multiple transitions.
    await page.click("button[onclick='fetchPosts()']");
    await expect(page.locator('#getResult')).toContainText('Status:', { timeout: 5000 });

    await page.click("button[onclick='createPost()']");
    await expect(page.locator('#postResult')).toContainText('Status:', { timeout: 5000 });

    await page.click("button[onclick='updatePost()']");
    await expect(page.locator('#putResult')).toContainText('Status:', { timeout: 5000 });

    await page.click("button[onclick='deletePost()']");
    await expect(page.locator('#deleteResult')).toContainText('Status:', { timeout: 5000 });

    // Confirm we captured console messages (there may be none). We assert that none of them represent fatal JS errors.
    for (const msg of consoleMessages) {
      const text2 = msg.text2 || '';
      expect(text.includes('ReferenceError')).toBeFalsy();
      expect(text.includes('SyntaxError')).toBeFalsy();
      expect(text.includes('TypeError')).toBeFalsy();
    }

    // Confirm no uncaught page errors occurred during the whole sequence
    expect(pageErrors.length).toBe(0);
  });

});