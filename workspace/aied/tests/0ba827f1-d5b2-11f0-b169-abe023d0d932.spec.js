import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba827f1-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Hash Table Demo - FSM tests (Application ID: 0ba827f1-d5b2-11f0-b169-abe023d0d932)', () => {
  // Arrays to collect runtime diagnostics for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // store type and text for easier assertions/debugging
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Provide a small debug output if a test fails - still rely on assertions in tests
    // (No mutation of page or app is performed here.)
    if (pageErrors.length > 0) {
      console.log('Captured page errors during test:', pageErrors.map(e => String(e)));
    }
    if (consoleMessages.length > 0) {
      console.log('Captured console messages during test:', consoleMessages.map(m => `${m.type}: ${m.text}`));
    }
    // Ensure page is left to the test harness to close; nothing to explicit teardown here.
  });

  test('S0 Idle: initial render shows form, inputs and empty hash table (entry state verification)', async ({ page }) => {
    // Validate the Idle state UI: form, inputs, submit button and an empty hash table container
    // Check the form exists and is visible
    const form = page.locator('#hashTableForm');
    await expect(form).toBeVisible();

    // Check key and value inputs exist and are required
    const keyInput = page.locator('#key');
    const valueInput = page.locator('#value');
    await expect(keyInput).toBeVisible();
    await expect(valueInput).toBeVisible();

    // Ensure required attributes are present (presence check)
    const keyRequired = await page.evaluate(() => document.querySelector('#key').hasAttribute('required'));
    const valueRequired = await page.evaluate(() => document.querySelector('#value').hasAttribute('required'));
    expect(keyRequired).toBe(true);
    expect(valueRequired).toBe(true);

    // Insert button presence
    const insertButton = page.locator('#insertButton');
    await expect(insertButton).toBeVisible();

    // Hash table container should be empty on initial render
    const hashTableInner = await page.locator('#hashTable').innerHTML();
    expect(hashTableInner).toBe('');

    // Verify no uncaught page errors occurred on initial load
    expect(pageErrors.length).toBe(0);

    // Check that there's no global renderPage function (FSM entry action mentions renderPage())
    // We don't expect the application to call an undefined renderPage; ensure it's not present to avoid ReferenceError
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('SubmitForm event: submitting the form triggers console logs and updates hashTable state (S0 -> S1 via submit)', async ({ page }) => {
    // This test validates the SubmitForm transition (form submit event).
    // The submit handler adds the key to the internal hashTable object and logs messages.
    const key = 'alpha';
    const value = '1';

    // Fill inputs
    await page.fill('#key', key);
    await page.fill('#value', value);

    // Trigger the submit event directly on the form (so we test the "submit" event handler separately from clicking the button).
    // Start waiting for console message(s) before dispatching the event.
    const [consoleMsg] = await Promise.all([
      page.waitForEvent('console'),
      // dispatch a submit event on the form element
      page.evaluate(() => {
        const form = document.getElementById('hashTableForm');
        // create and dispatch a submit event that will trigger the registered listener
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      })
    ]);

    // The submit handler logs when a key is added.
    const msgText = consoleMsg.text();
    expect(msgText).toMatch(new RegExp(`Key '${key}' added to the hash table\\.`));

    // Submitting the same key again should produce a message that it already exists
    const [consoleMsg2] = await Promise.all([
      page.waitForEvent('console'),
      page.evaluate(() => {
        const form = document.getElementById('hashTableForm');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      })
    ]);
    expect(consoleMsg2.text()).toMatch(new RegExp(`Key '${key}' already exists in the hash table\\.`));

    // The submit handler itself does NOT update the DOM (#hashTable), so ensure it remains empty
    const hashTableHtml = await page.locator('#hashTable').innerHTML();
    expect(hashTableHtml).toBe('');

    // Ensure the internal hashTable object in window was updated by the submit handler
    const internalHash = await page.evaluate(() => window.hashTable);
    expect(internalHash).toBeTruthy();
    expect(internalHash[key]).toBe(value);

    // No uncaught page errors expected during normal submit handling
    expect(pageErrors.length).toBe(0);
  });

  test('ClickInsert event: clicking Insert appends Key/Value to DOM and maintains internal hashTable (S0 -> S1 via click)', async ({ page }) => {
    // This test validates the ClickInsert transition which updates the visible UI (#hashTable)
    const key = 'beta';
    const value = '2';

    // Fill inputs
    await page.fill('#key', key);
    await page.fill('#value', value);

    // Clicking the insert button triggers a click handler that appends a <p> to the #hashTable element.
    // Also, because the button is a submit input, the form's submit handler may fire and log to console.
    // Wait for click to complete and then check content.
    await page.click('#insertButton');

    // After clicking, the DOM should contain one paragraph with the expected Key and Value
    const paragraphs = page.locator('#hashTable p');
    await expect(paragraphs).toHaveCount(1);
    const text = await paragraphs.nth(0).textContent();
    expect(text).toContain(`Key: ${key}, Value: ${value}`);

    // Internal hashTable object must contain the key with correct value
    const internalHash = await page.evaluate(() => window.hashTable);
    expect(internalHash).toBeTruthy();
    expect(internalHash[key]).toBe(value);

    // Clicking Insert again with the same key/value should append another DOM entry (duplicate insertion case)
    await page.click('#insertButton');
    await expect(paragraphs).toHaveCount(2);
    const text2 = await paragraphs.nth(1).textContent();
    expect(text2).toContain(`Key: ${key}, Value: ${value}`);

    // Verify the internal hashTable still reports the latest value for the key
    const internalHashAfter = await page.evaluate(() => window.hashTable);
    expect(internalHashAfter[key]).toBe(value);

    // Ensure console contains at least one log about adding the key (submit handler might have logged)
    const loggedAdd = consoleMessages.find(m => /added to the hash table/.test(m.text));
    expect(Boolean(loggedAdd)).toBe(true);

    // No uncaught exceptions expected during click-based insertion
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: clicking Insert with empty key and/or value appends empty entries (validation and robustness)', async ({ page }) => {
    // This test validates how the app behaves if inputs are empty.
    // Note: inputs have required attributes, but the click handler will still append DOM entries and the submit handler is distinct.
    await page.fill('#key', '');
    await page.fill('#value', '');

    // Click insert - observe DOM behavior
    await page.click('#insertButton');

    // Expect an appended paragraph showing empty Key and Value
    const paragraphs = page.locator('#hashTable p');
    await expect(paragraphs).toHaveCount(1);
    const text = await paragraphs.nth(0).textContent();
    // Expect the displayed text to reflect empty key/value fields
    expect(text.trim()).toBe('Key: , Value: ');

    // The internal hashTable object should have an empty string key if the click handler added it
    // (In the provided implementation, click handler always appends to DOM; it attempts to set hashTable[key] = value only in one branch,
    // but since key is '', the behavior is to append and possibly set hashTable[''] = '')
    const internalHash = await page.evaluate(() => window.hashTable);
    // The internal hash may or may not have the empty key depending on exact branch execution; assert defined object exists
    expect(internalHash).toBeTruthy();

    // Confirm no uncaught errors were thrown while handling empty inputs
    expect(pageErrors.length).toBe(0);
  });

  test('FSM onEnter/onExit actions observation: ensure no unexpected ReferenceError for renderPage() appears', async ({ page }) => {
    // FSM mentioned an entry action "renderPage()". Validate that the app did not attempt to call an undefined renderPage
    // by asserting there were no page errors naming renderPage or similar ReferenceErrors.
    const matchingPageErrors = pageErrors.filter(err => String(err).includes('renderPage') || String(err).includes('ReferenceError'));
    expect(matchingPageErrors.length).toBe(0);

    // Confirm again that renderPage is not defined on window (so it's not being used by the app)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });
});