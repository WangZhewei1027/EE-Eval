import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04412391-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('04412391-fa79-11f0-8a8e-bbe4f11717c6 - Linked List FSM end-to-end tests', () => {
  // We'll attach listeners in beforeEach so we can observe console messages and page errors for every test.
  test.beforeEach(async ({ page }) => {
    // Arrays to collect events for assertions in tests through page context.
    await page.addInitScript(() => {
      // No-op: ensure addInitScript exists; we are not injecting or modifying app logic.
    });
    // Navigate to the page after listeners are attached in the test itself.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Idle state: initial DOM elements exist and renderPage is not defined', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle) evidence:
    // - link with id #link1 exists
    // - button with id #button1 exists
    // - the spinner/render function renderPage is not defined in the page (as per implementation)
    const link = page.locator('#link1');
    const button = page.locator('#button1');

    await expect(link).toHaveCount(1);
    await expect(button).toHaveCount(1);

    // Verify initial visible text of the link is the expected label "Click Me!"
    // The implementation sets innerHTML to "Click Me!" in the static HTML.
    const linkText = await link.evaluate((el) => el.innerHTML);
    expect(linkText.trim()).toBe('Click Me!');

    // The FSM initial state's entry_action mentions renderPage(), but the HTML doesn't define it.
    // Verify that renderPage is indeed undefined on the window (so a ReferenceError would occur if it were invoked).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('S1_LinkClicked (error scenario): clicking link with empty links array triggers a runtime error', async ({ page }) => {
    // This test validates the Link1_Click event when the internal 'links' array is empty.
    // According to the implementation, clickLink1() will attempt to access properties of an undefined item,
    // producing an uncaught runtime error (TypeError). We assert that such an error occurs and inspect state.
    // Attach a listener for pageerror and trigger the click.
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Ensure links array is empty to simulate the error path.
    await page.evaluate(() => {
      // Reset links/currentLink if present.
      if (window.links && Array.isArray(window.links)) {
        window.links.length = 0;
      } else {
        // ensure variables exist as in the page script
        window.links = [];
        window.currentLink = null;
      }
      window.currentLink = null;
    });

    // Click the link and wait for a pageerror event to be emitted.
    // Use Promise.all to ensure we wait for the error triggered by the click.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#link1'),
    ]);

    // The runtime error should be a TypeError related to setting 'next' on undefined.
    // Error messages differ across engines; assert that it is indeed an Error and contains indicative words.
    expect(error).toBeTruthy();
    const msg = error.message || '';
    const lower = msg.toLowerCase();
    // Assert the message mentions 'next' or 'cannot' or 'undefined' as indicators of the TypeError occurrence.
    expect(
      lower.includes('next') || lower.includes('cannot') || lower.includes('undefined') || lower.includes('reading')
    ).toBeTruthy();

    // After the failed click, currentLink should have been set to the result of links.shift()
    // which is undefined. Confirm currentLink is either null or undefined (likely undefined).
    const currentLinkType = await page.evaluate(() => {
      return { value: window.currentLink, typeofValue: typeof window.currentLink };
    });
    // We accept either 'undefined' or 'object'/'object with null' depending on engine; prefer undefined check.
    expect(currentLinkType.value === undefined || currentLinkType.value === null).toBeTruthy();

    // The link's displayed text should remain unchanged because printList() does not run after the error.
    const linkTextAfter = await page.$eval('#link1', (el) => el.innerHTML);
    expect(linkTextAfter.trim()).toBe('Click Me!');
  });

  test('S1_LinkClicked (success path): populate links then clicking link removes the first node and updates display', async ({ page }) => {
    // This test validates the successful transition for Link1_Click when links are present.
    // We will add two links, click the link (which calls clickLink1()), and assert:
    // - no pageerror occurs
    // - link1's innerHTML updates to show the remaining list items
    // - currentLink references the removed item with next === null
    // - the internal links array is shortened by one

    // Collect pageerrors so we can assert none happen during the operation.
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Add two entries to the internal 'links' array using the exposed addLink function.
    await page.evaluate(() => {
      // Defensive: ensure the arrays exist
      if (!window.links) window.links = [];
      if (typeof window.addLink === 'function') {
        window.addLink('A');
        window.addLink('B');
      } else {
        // If addLink isn't available (should be), directly manipulate the array (allowed as reading the page context).
        window.links.push({ text: 'A', next: null }, { text: 'B', next: null });
      }
    });

    // For clarity, call printList to show the current list before clicking (not required but helpful for state).
    // We call it only if it's defined to avoid ReferenceError.
    await page.evaluate(() => {
      if (typeof window.printList === 'function') {
        window.printList();
      }
    });

    // Now click the link which should invoke clickLink1 and succeed.
    await page.click('#link1');

    // Give a short moment for script to run.
    await page.waitForTimeout(100);

    // Assert that no pageerror was emitted.
    expect(pageErrors.length).toBe(0);

    // After removal of 'A', the link display should reflect remaining link(s): only 'B\n' per printList implementation.
    const displayed = await page.$eval('#link1', (el) => el.innerHTML);
    // printList concatenates each link.text + "\n"
    expect(displayed).toBe('B\n');

    // currentLink should be the removed node with text 'A' and next === null.
    const currentLink = await page.evaluate(() => {
      return window.currentLink ? { text: window.currentLink.text, hasNext: window.currentLink.next === null } : null;
    });
    expect(currentLink).not.toBeNull();
    expect(currentLink.text).toBe('A');
    expect(currentLink.hasNext).toBe(true);

    // The internal links array length should now be 1.
    const remainingLength = await page.evaluate(() => window.links.length);
    expect(remainingLength).toBe(1);
  });

  test('S2_ButtonClicked: clicking the button directly does nothing (no onclick), but invoking clickButton1() mimics Link click (error & success cases)', async ({ page }) => {
    // This test validates the behavior of the button:
    // - a direct user click on #button1 should not trigger clickButton1 since no onclick is attached
    // - calling clickButton1() directly (as the FSM's entry_action expects) triggers the same logic as link click
    //   and therefore will error if links is empty, or succeed if links populated.

    // Collect pageerrors and console messages.
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    const consoleMsgs = [];
    page.on('console', (msg) => consoleMsgs.push({ type: msg.type(), text: msg.text() }));

    // First: direct click - this should do nothing because #button1 has no onclick attribute.
    // Ensure no links present and reset state.
    await page.evaluate(() => {
      window.links = [];
      window.currentLink = null;
      if (typeof window.printList === 'function') {
        // Reset displayed text to the static default to match initial DOM (since no direct binding exists).
        document.getElementById('link1').innerHTML = 'Click Me!';
      }
    });

    // Clear any recorded page errors.
    pageErrors.length = 0;

    // Click the button - nothing should happen, no pageerror thrown.
    await page.click('#button1');
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(0);

    // The link text should remain unchanged.
    const linkTextAfterButtonClick = await page.$eval('#link1', (el) => el.innerHTML);
    expect(linkTextAfterButtonClick.trim()).toBe('Click Me!');

    // Now: invoke clickButton1() directly to simulate FSM entry action for the Button1_Click transition.
    // Case A: With empty links array this should produce a runtime TypeError similar to clickLink1.
    // Wait for the pageerror event while invoking the function.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.evaluate(() => {
        // Call the function directly in page context.
        if (typeof window.clickButton1 === 'function') {
          window.clickButton1();
        } else {
          // If the function is missing, attempt to call a nonexistent function to provoke a ReferenceError (allowed per instructions).
          // This branch is defensive; the implementation declares clickButton1, so normally this branch won't run.
          // eslint-disable-next-line no-undef
          window.clickButton1();
        }
      }),
    ]);

    expect(error).toBeTruthy();
    const emsg = error.message || '';
    const lower = emsg.toLowerCase();
    // Verify the error message indicates the problem (e.g., property 'next' on undefined).
    expect(
      lower.includes('next') || lower.includes('cannot') || lower.includes('undefined') || lower.includes('reading')
    ).toBeTruthy();

    // Reset state by reloading the page (ensures a clean context for the success-case invocation).
    await page.reload({ waitUntil: 'load' });

    // Add links to allow clickButton1 to succeed.
    await page.evaluate(() => {
      if (!window.links) window.links = [];
      if (typeof window.addLink === 'function') {
        window.addLink('X');
        window.addLink('Y');
      } else {
        window.links.push({ text: 'X', next: null }, { text: 'Y', next: null });
      }
      // Ensure the display is updated prior to invocation to observe the change.
      if (typeof window.printList === 'function') {
        window.printList();
      }
    });

    // Clear pageErrors array and invoke clickButton1 directly (should succeed).
    pageErrors.length = 0;
    await page.evaluate(() => {
      // Before calling, ensure function exists
      if (typeof window.clickButton1 === 'function') {
        window.clickButton1();
      }
    });

    // Short wait to allow UI update
    await page.waitForTimeout(100);

    // No new pageerrors expected for this successful removal.
    expect(pageErrors.length).toBe(0);

    // After removing 'X', the display should show the remaining 'Y\n'
    const displayedAfterButtonInvocation = await page.$eval('#link1', (el) => el.innerHTML);
    expect(displayedAfterButtonInvocation).toBe('Y\n');

    // And currentLink should reference the removed item 'X' with next === null.
    const removed = await page.evaluate(() => {
      return window.currentLink ? { text: window.currentLink.text, nextIsNull: window.currentLink.next === null } : null;
    });
    expect(removed).not.toBeNull();
    expect(removed.text).toBe('X');
    expect(removed.nextIsNull).toBe(true);
  });

  test('Edge case: repeated removals until links empty then subsequent click triggers error', async ({ page }) => {
    // This test simulates repeated correct removals until the list is empty, then verifies that a further removal attempt triggers a runtime error.
    // Start fresh and add two links, remove twice successfully, and then attempt a third removal to provoke an error.
    await page.evaluate(() => {
      // reset
      window.links = [];
      window.currentLink = null;
      if (typeof window.addLink === 'function') {
        window.addLink('1');
        window.addLink('2');
      } else {
        window.links.push({ text: '1', next: null }, { text: '2', next: null });
      }
      if (typeof window.printList === 'function') {
        window.printList();
      }
    });

    // Remove first via clickLink1 (click)
    await page.click('#link1');
    await page.waitForTimeout(50);
    // Remove second by calling clickLink1 again (since link still has onclick)
    await page.click('#link1');
    await page.waitForTimeout(50);

    // Now links array should be empty.
    const remaining = await page.evaluate(() => window.links.length);
    expect(remaining).toBe(0);

    // Prepare to capture the error on subsequent click.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#link1'),
    ]);

    expect(error).toBeTruthy();
    const msg = error.message || '';
    const ll = msg.toLowerCase();
    expect(ll.includes('next') || ll.includes('cannot') || ll.includes('undefined') || ll.includes('reading')).toBeTruthy();
  });
});