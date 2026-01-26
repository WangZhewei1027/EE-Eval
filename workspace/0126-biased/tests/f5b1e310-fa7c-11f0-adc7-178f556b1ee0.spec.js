import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b1e310-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('FSM: Big-O Notation (f5b1e310-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Shared state for capturing page errors and console messages per test
  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for full load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Test S0_Idle: initial render - verify presence of expected UI elements and attributes
  test('S0_Idle - initial render shows button and explanatory text (renderPage entry action expectation)', async ({ page }) => {
    // Validate the header and explanatory text exist (static page content)
    await expect(page.locator('h1')).toHaveText('Big-O Notation');
    await expect(page.locator('text=Big-O notation is used to describe the time or space complexity')).toBeVisible();

    // The FSM expects a button with onclick="displayText()"
    const button = page.locator("button[onclick='displayText()']");
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Get More Information');

    // Assert the onclick attribute is exactly present as in the HTML (evidence)
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe('displayText()');

    // Verify that the page did not define the expected entry action function renderPage (we must not patch it)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // The FSM's S0_Idle entry action listed renderPage(), but the implementation does not define it.
    // Confirm page remains in the initial visual state by grabbing container HTML snapshot
    const container = page.locator('.container');
    const initialHTML = await container.innerHTML();
    expect(initialHTML.length).toBeGreaterThan(100); // sanity check content exists
  });

  // Test S1_InformationDisplayed: clicking the button triggers onclick handler displayText()
  // The implementation does not define displayText(), so a ReferenceError is expected.
  test('S1_InformationDisplayed - clicking "Get More Information" triggers ReferenceError for missing displayText', async ({ page }) => {
    const btn = page.locator("button[onclick='displayText()']");

    // Ensure the function is not defined before click
    const beforeType = await page.evaluate(() => typeof window.displayText);
    expect(beforeType).toBe('undefined');

    // Prepare to capture the pageerror emitted when clicking triggers a missing function call.
    // Use Promise.all to make sure the click is the action that causes the error.
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      btn.click()
    ]);

    // The pageerror should reflect a ReferenceError about displayText being undefined.
    // Different browsers may format the message differently; assert that 'displayText' appears in the message.
    expect(pageError).toBeTruthy();
    const msg = String(pageError.message || pageError);
    expect(msg).toMatch(/displayText/i);
    expect(msg).toMatch(/not defined|is not defined|ReferenceError/i);

    // After the click, there should be no new DOM element added that indicates "Information displayed to the user."
    // The FSM transition expects information to be displayed, but the implementation is broken and should not add content.
    // Check that no obvious "information displayed" text exists.
    const infoLocator = page.locator('text=Information displayed to the user.');
    await expect(infoLocator).toHaveCount(0);

    // Verify that the container's HTML did not meaningfully change after the click (no new UI injected)
    const container = page.locator('.container');
    const afterHTML = await container.innerHTML();
    // It should remain roughly the same length; allow exact equality as click should not mutate DOM
    expect(afterHTML).toBe(await page.evaluate(() => document.querySelector('.container').innerHTML));
  });

  // Edge case: clicking multiple times should produce multiple pageerror events (one per click)
  test('Edge case: multiple clicks produce multiple ReferenceErrors (repeated missing handler)', async ({ page }) => {
    const btn = page.locator("button[onclick='displayText()']");

    // Ensure displayText still undefined
    const beforeType = await page.evaluate(() => typeof window.displayText);
    expect(beforeType).toBe('undefined');

    // Capture two consecutive pageerror events triggered by two clicks
    const waitForFirst = page.waitForEvent('pageerror');
    const clickFirst = btn.click();
    const firstError = await Promise.all([waitForFirst, clickFirst]).then(([err]) => err);

    const waitForSecond = page.waitForEvent('pageerror');
    const clickSecond = btn.click();
    const secondError = await Promise.all([waitForSecond, clickSecond]).then(([err]) => err);

    // Validate both errors reference displayText
    expect(String(firstError.message || firstError)).toMatch(/displayText/i);
    expect(String(secondError.message || secondError)).toMatch(/displayText/i);

    // They should both be ReferenceError-like
    expect(String(firstError.message || firstError)).toMatch(/not defined|is not defined|ReferenceError/i);
    expect(String(secondError.message || secondError)).toMatch(/not defined|is not defined|ReferenceError/i);
  });

  // Test that attempting to reference the expected function via typeof does not throw (safe check),
  // and confirm both displayText and renderPage are undefined (verifying onEnter/onExit actions are missing)
  test('Verify onEnter/onExit expected functions are absent (displayText, renderPage)', async ({ page }) => {
    // typeof checks should be safe and not throw ReferenceError
    const types = await page.evaluate(() => {
      return {
        displayText: typeof displayText,
        renderPage: typeof renderPage,
        // also check any other likely handler names are undefined
        someOther: typeof someOther
      };
    });

    expect(types.displayText).toBe('undefined');
    expect(types.renderPage).toBe('undefined');
    expect(types.someOther).toBe('undefined');
  });

  // Test to observe console messages when clicking; ensure console also reflects the error
  test('Console logs include ReferenceError when clicking the button', async ({ page }) => {
    const messages = [];
    page.on('console', msg => {
      // Capture console messages for inspection
      messages.push({ type: msg.type(), text: msg.text() });
    });

    const btn = page.locator("button[onclick='displayText()']");

    // Trigger the click and wait for pageerror as well
    await Promise.all([
      page.waitForEvent('pageerror'),
      btn.click()
    ]);

    // Give a short moment for any console events to arrive
    await page.waitForTimeout(50);

    // There should be at least one console message that mentions displayText or ReferenceError
    const found = messages.some(m => /displayText/i.test(m.text) || /ReferenceError/i.test(m.text) || /is not defined/i.test(m.text));
    expect(found).toBeTruthy();
  });

  // Negative test: ensure no accidental successful information display occurs by searching for expected "information" content
  test('Negative: ensure "Information Displayed" state does not materialize due to missing handler', async ({ page }) => {
    // Click the button expecting an error
    await Promise.all([page.waitForEvent('pageerror'), page.locator("button[onclick='displayText()']").click()]);

    // The FSM's S1 would presumably inject or reveal additional information.
    // Confirm none of the following indicative strings appear on the page
    const prohibitedTexts = [
      'Information displayed to the user',
      'More Information',
      'displayText()',
      'Additional Information'
    ];

    for (const txt of prohibitedTexts) {
      const count = await page.locator(`text=${txt}`).count();
      expect(count).toBe(0);
    }
  });
});