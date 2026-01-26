import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0443bba4-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('0443bba4-fa79-11f0-8a8e-bbe4f11717c6 - SQL Database interactive app (FSM validation)', () => {
  // Arrays to collect runtime errors and console messages produced by the page.
  let pageErrors = [];
  let consoleMessages = [];

  // Setup: attach listeners and navigate to the page before each test.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors (pageerror events).
    page.on('pageerror', (err) => {
      // err may be an Error object - convert to string for robust assertions
      try {
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Collect all console messages for inspection.
    page.on('console', (msg) => {
      // Collect text for easier assertions.
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Navigate to the application page.
    await page.goto(APP_URL);

    // Wait briefly to allow inline script execution and any synchronous errors to manifest.
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // Remove page listeners to avoid cross-test leaks (Playwright will close page per test scope,
    // but we explicitly clear handlers to keep test behavior explicit).
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('Application initialization: DB and functions are defined, but DOM components are missing', async ({ page }) => {
    // This test validates the initial "Idle" state artifacts:
    // - The in-memory db object should be present (script executed partially).
    // - Core functions (displayUsers, displayUsersList, addNewUser) should be defined as functions.
    // - Expected DOM elements referenced by the script (#users-list, #new-user-form, #name-input, #email-input) are missing.
    // - The page produced at least one runtime error logged to pageerror (script attempted operations on nulls).

    // Check that the page defined the db and that initial users exist (script top portion executed).
    const dbUsersLength = await page.evaluate(() => {
      // Access window.db if present
      return (typeof window.db !== 'undefined' && Array.isArray(window.db.users)) ? window.db.users.length : null;
    });
    expect(dbUsersLength).toBe(2); // the HTML defines two initial users in db

    // Verify that helper functions were declared on window
    const functionsExist = await page.evaluate(() => {
      return {
        displayUsers: typeof window.displayUsers === 'function',
        displayUsersList: typeof window.displayUsersList === 'function',
        addNewUser: typeof window.addNewUser === 'function'
      };
    });
    expect(functionsExist.displayUsers).toBeTruthy();
    expect(functionsExist.displayUsersList).toBeTruthy();
    expect(functionsExist.addNewUser).toBeTruthy();

    // Confirm that the DOM elements the script expects are NOT present in the served HTML.
    const usersListHandle = await page.$('#users-list');
    const newUserFormHandle = await page.$('#new-user-form');
    const nameInputHandle = await page.$('#name-input');
    const emailInputHandle = await page.$('#email-input');

    expect(usersListHandle).toBeNull();
    expect(newUserFormHandle).toBeNull();
    expect(nameInputHandle).toBeNull();
    expect(emailInputHandle).toBeNull();

    // There should be at least one page error since the script references missing DOM nodes synchronously.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Ensure one of the errors refers to null property access (common patterns: addEventListener or innerHTML)
    const combinedErrors = pageErrors.join(' | ').toLowerCase();
    const nullAccessPatterns = [
      'addeventlistener', // addNewUserForm.addEventListener -> property access on null
      'cannot read properties of null', // modern chromium message
      'cannot set property', // older message patterns like "Cannot set property 'innerHTML' of null"
      'innerhtml' // direct mention of innerHTML manipulation
    ];
    const matched = nullAccessPatterns.some(p => combinedErrors.indexOf(p) !== -1);
    expect(matched).toBeTruthy();
  });

  test('FSM S0_Idle: entry action displayUsersList attempted and led to an observable error or no DOM update', async ({ page }) => {
    // This test validates the Idle state's entry action: displayUsersList()
    // The implementation attempts to populate #users-list on load. Because #users-list is missing,
    // we assert that (a) the element is missing and (b) a runtime error referring to innerHTML or null access was captured.

    // Confirm users-list does not exist
    const usersListExists = await page.$('#users-list') !== null;
    expect(usersListExists).toBeFalsy();

    // Validate that errors emitted include attempts to use innerHTML or manipulate a null element
    expect(pageErrors.length).toBeGreaterThan(0);
    const foundInnerHtmlOrNull = pageErrors.some(msg => {
      if (!msg) return false;
      const m = msg.toLowerCase();
      return m.includes('innerhtml') || m.includes('cannot read properties of null') || m.includes('cannot set property') || m.includes('addeventlistener');
    });
    expect(foundInnerHtmlOrNull).toBeTruthy();
  });

  test('FSM transition SubmitNewUser (S0 -> S1): form submission cannot occur because form is missing; event wiring failed early', async ({ page }) => {
    // This test validates the SubmitNewUser event/transition behavior:
    // - The app expects a #new-user-form and wires a submit listener to it.
    // - Because #new-user-form is missing, the wiring step throws; we assert that the page errors include an addEventListener-related message.
    // - We also assert that attempting to locate the form yields null (edge case).
    // - We do NOT patch or create DOM elements; we only observe and assert errors that occurred.

    // Ensure the form element does not exist
    const formExists = await page.$('#new-user-form') !== null;
    expect(formExists).toBeFalsy();

    // Check that a page error mentions addEventListener (the script contains: addNewUserForm.addEventListener('submit', ...))
    const addEventListenerError = pageErrors.some(msg => {
      if (!msg) return false;
      const m = msg.toLowerCase();
      return m.includes('addeventlistener') || m.includes("cannot read properties of null (reading 'addeventlistener')") || m.includes("cannot read properties of null (reading 'addEventListener'".toLowerCase());
    });
    expect(addEventListenerError).toBeTruthy();

    // Confirm that because the form does not exist, no automatic submission/transition to "User Added" could have occurred.
    // We treat the "User Added" state as one where displayUsers() would have been invoked to re-render users.
    // Since #users-list is missing and initial attempt to wire submission failed, no successful user addition event can be observed.
    // Validate that db.users has the original two users (no new user added by any background process).
    const userCount = await page.evaluate(() => (window.db && Array.isArray(window.db.users)) ? window.db.users.length : null);
    expect(userCount).toBe(2);

    // Also check console messages for any helpful diagnostics
    const consoleCombined = consoleMessages.join(' | ').toLowerCase();
    // The console may be empty or contain unrelated logs; if present, assert it does not contain successful "User added" indications.
    expect(consoleCombined.includes('user added') || consoleCombined.includes('added new user')).toBeFalsy();
  });

  test('Edge cases: accessing missing elements via page APIs yields null; confirm safe assertions', async ({ page }) => {
    // This test exercises edge-case checks: ensure Playwright sees absent DOM nodes as null and that
    // programmatic operations (without patching page) cannot proceed.

    // Query selectors using Playwright should return null handles for missing elements.
    const selectors = ['#users-list', '#new-user-form', '#name-input', '#email-input'];
    for (const sel of selectors) {
      const handle = await page.$(sel);
      expect(handle).toBeNull();
    }

    // Attempting to dispatch an event on a missing element via direct in-page code would be no-op or throw.
    // We do NOT dispatch; instead, we confirm that the page has no form and that any attempt would be based on non-existent references.
    const hasForm = await page.evaluate(() => !!document.getElementById('new-user-form'));
    expect(hasForm).toBeFalsy();

    // Ensure that the pageErrors array includes at least one error produced during initial script execution,
    // verifying that the app's runtime assumptions about DOM presence are violated in this served HTML.
    expect(pageErrors.length).toBeGreaterThan(0);
  });
});