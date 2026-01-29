import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04434673-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Time Complexity Interactive - FSM validation (Application ID: 04434673-fa79-11f0-8a8e-bbe4f11717c6)', () => {

  // Helper: attach listeners to capture console messages and page errors for a single page
  async function attachErrorAndConsoleCollectors(page) {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });
    return { consoleMessages, pageErrors };
  }

  // Ensure page loads before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('Initial state - Idle: content exists and is visible but has no explicit inline display style (FSM: S0_Idle)', async ({ page }) => {
    // Attach collectors for console and errors
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleCollectors(page);

    // Validate presence of two buttons as evidence for S0_Idle
    const buttons = page.locator('button.button');
    await expect(buttons).toHaveCount(2);

    // Validate the content element exists
    const content = page.locator('.content');
    await expect(content).toBeVisible();

    // Check inline style for 'display' - initial page does not set it inline, so it should be empty string
    const inlineDisplay = await content.evaluate((el) => el.style.display);
    expect(inlineDisplay === '' || inlineDisplay === undefined).toBeTruthy();

    // Computed style should not be 'none' (visible)
    const computedDisplay = await content.evaluate((el) => getComputedStyle(el).display);
    expect(computedDisplay).not.toBe('none');

    // Ensure no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Console messages may be empty but capture them - assert it's an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('Transition S0_Idle -> S1_ContentVisible via Learn More button (first button) and verify entry action', async ({ page }) => {
    // Attach collectors
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleCollectors(page);

    const firstButton = page.locator('button.button').first();
    const content = page.locator('.content');

    // Precondition: ensure inline style is not 'block' yet (idle)
    const preInline = await content.evaluate((el) => el.style.display);
    // Click to trigger showTimeComplexity()
    await firstButton.click();

    // After click, entry action in FSM expects content.style.display = 'block'
    const postInline = await content.evaluate((el) => el.style.display);
    expect(postInline).toBe('block');

    // Computed style should be 'block'
    const computed = await content.evaluate((el) => getComputedStyle(el).display);
    expect(computed === 'block' || computed === 'flex' || computed === 'inline-block' ? true : computed === 'block').toBeTruthy();

    // No page errors expected during normal toggle
    expect(pageErrors.length).toBe(0);

    // No unexpected console errors
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S1_ContentVisible -> S0_Idle via Learn More button (toggle off) and verify exit behavior', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleCollectors(page);
    const firstButton = page.locator('button.button').first();
    const content = page.locator('.content');

    // Ensure we are in the 'block' inline style state by clicking once if needed
    await firstButton.click(); // ensures inline style becomes 'block'

    // Click again to toggle off (expected content.style.display = 'none')
    await firstButton.click();

    // Verify inline display is 'none'
    const inlineAfter = await content.evaluate((el) => el.style.display);
    expect(inlineAfter).toBe('none');

    // Computed display should be 'none' (hidden)
    const computedAfter = await page.evaluate(() => {
      const el = document.querySelector('.content');
      return el ? getComputedStyle(el).display : 'missing';
    });
    expect(computedAfter).toBe('none');

    // No page error should have occurred during normal toggling
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_ContentVisible via Understand Big O Notation button (second button)', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleCollectors(page);
    const secondButton = page.locator('button.button').nth(1);
    const content = page.locator('.content');

    // Ensure starting from Idle - reset inline style to empty by navigating anew
    await page.goto(APP_URL);

    // Click second button
    await secondButton.click();

    // Verify inline style becomes 'block'
    const inline = await content.evaluate((el) => el.style.display);
    expect(inline).toBe('block');

    // Verify computed display shows content as visible
    const computed = await content.evaluate((el) => getComputedStyle(el).display);
    expect(computed).not.toBe('none');

    // No page errors expected
    expect(pageErrors.length).toBe(0);
    const errConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errConsole.length).toBe(0);
  });

  test('Transition S1_ContentVisible -> S0_Idle via Understand Big O Notation button (toggle off) and cross-check both buttons', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleCollectors(page);
    const firstButton = page.locator('button.button').first();
    const secondButton = page.locator('button.button').nth(1);
    const content = page.locator('.content');

    // Start: click second button to set inline display to 'block'
    await secondButton.click();
    const inlineNow = await content.evaluate((el) => el.style.display);
    expect(inlineNow).toBe('block');

    // Now click first button to toggle back to 'none' — both buttons call same handler
    await firstButton.click();
    const inlineAfter = await content.evaluate((el) => el.style.display);
    expect(inlineAfter).toBe('none');

    // No page errors
    expect(pageErrors.length).toBe(0);
    const errConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errConsole.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks should toggle deterministically (idempotent toggling behavior)', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleCollectors(page);
    const firstButton = page.locator('button.button').first();
    const content = page.locator('.content');

    // Rapidly click the button 5 times
    for (let i = 0; i < 5; i++) {
      await firstButton.click();
    }

    // After odd number of toggles, expected inline style is 'block'
    const inlineAfter = await content.evaluate((el) => el.style.display);
    expect(inlineAfter).toBe('block');

    // Rapidly click 1 more time (even total 6) -> should be 'none'
    await firstButton.click();
    const inlineFinal = await content.evaluate((el) => el.style.display);
    expect(inlineFinal).toBe('none');

    // No page errors expected during rapid interactions
    expect(pageErrors.length).toBe(0);
    const errConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errConsole.length).toBe(0);
  });

  test('Error scenario: remove .content element then click a button -> expect a runtime error to be emitted (TypeError)', async ({ page }) => {
    // Collectors to capture page errors
    const { pageErrors, consoleMessages } = await attachErrorAndConsoleCollectors(page);

    // Remove the .content element from the DOM to induce an error inside showTimeComplexity()
    await page.evaluate(() => {
      const el = document.querySelector('.content');
      if (el && el.parentElement) {
        el.parentElement.removeChild(el);
      }
    });

    // Confirm .content no longer exists
    const contentExists = await page.$('.content');
    expect(contentExists).toBeNull();

    // Click the first button which will call showTimeComplexity and try to access .style of null
    await page.locator('button.button').first().click();

    // Wait a tick to allow error to be emitted
    await page.waitForTimeout(100);

    // Expect at least one page error captured
    expect(pageErrors.length).toBeGreaterThan(0);

    // The error should relate to reading 'style' of null or similar TypeError - match loosely
    const joinedErrors = pageErrors.join(' | ');
    expect(/null|cannot read|Cannot read|TypeError/i.test(joinedErrors)).toBeTruthy();

    // There may be console error entries as well; assert that if present they are error typed
    const foundConsoleErrors = consoleMessages.filter(m => m.type === 'error');
    // It's acceptable whether or not the console had 'error' messages; just assert that pageErrors captured the runtime exception
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Robustness: verify clicking buttons does not create unexpected global exceptions across multiple navigations', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachErrorAndConsoleCollectors(page);
    const clicks = 3;

    for (let i = 0; i < clicks; i++) {
      // Reload page to reset state
      await page.goto(APP_URL);
      const btn = page.locator('button.button').nth(i % 2); // alternate between the two buttons
      await btn.click();

      // Short wait to let UI update
      await page.waitForTimeout(50);
    }

    // Ensure no uncaught errors were produced throughout these navigations and interactions
    expect(pageErrors.length).toBe(0);
    const errConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errConsole.length).toBe(0);
  });

});