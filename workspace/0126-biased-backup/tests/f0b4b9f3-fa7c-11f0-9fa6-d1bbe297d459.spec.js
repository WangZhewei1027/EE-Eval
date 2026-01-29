import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b4b9f3-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Comprehensive Guide to Static Typing (Application f0b4b9f3-...)', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Helper to attach listeners for console and page errors for a given page
  async function attachErrorListeners(page) {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // Collect only error-level console messages
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ensure listener doesn't throw
        consoleErrors.push(`Failed to read console message: ${String(e)}`);
      }
    });

    page.on('pageerror', err => {
      // Collect uncaught exceptions from the page
      try {
        pageErrors.push(err.message || String(err));
      } catch (e) {
        pageErrors.push(`Failed to read pageerror: ${String(e)}`);
      }
    });
  }

  test.beforeEach(async ({ page }) => {
    // Attach listeners first to catch any errors during navigation / inline scripts
    await attachErrorListeners(page);
    // Navigate to the exact URL specified in the requirements
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test we assert (explicitly in individual tests) about console/page errors.
    // No global assertion here to allow per-test specific checks.
  });

  test('Idle State (S0_Idle) - initial render: button exists and demo output is hidden', async ({ page }) => {
    // Validate initial FSM state S0_Idle: entry action renderPage() was listed in FSM,
    // but implementation does not call renderPage(). We therefore check DOM evidence:
    // - The button with onclick="showTypeError()" exists
    // - The demo output (#demo-output) is present and initially hidden

    // Locate the button using the exact selector from the FSM
    const button = page.locator("button[onclick='showTypeError()']");
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();

    // Validate the button's text content matches the FSM evidence
    await expect(button).toHaveText('Show Type Error Example');

    // Validate the demo output element is present but hidden initially
    const output = page.locator('#demo-output');
    await expect(output).toHaveCount(1);
    // Using Playwright's visibility helper: it should not be visible due to display: none
    await expect(output).not.toBeVisible();

    // Ensure the demo-output is empty at idle state (no innerHTML)
    const inner = await output.innerHTML();
    // trim to avoid whitespace-only content
    expect(inner.trim()).toBe('');

    // Confirm no immediate page errors or console errors occurred on initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition (ShowTypeError) - clicking button moves to S1_ErrorDisplayed and shows simulated compiler error', async ({ page }) => {
    // This test validates the transition defined in the FSM:
    // On clicking button[onclick='showTypeError()'] -> #demo-output becomes displayed and contains the error message.

    const button = page.locator("button[onclick='showTypeError()']");
    const output = page.locator('#demo-output');

    // Click the button to trigger showTypeError()
    await button.click();

    // The output should become visible
    await expect(output).toBeVisible();

    // Check that its style.display has been set to 'block'
    const displayStyle = await page.evaluate(() => {
      const o = document.getElementById('demo-output');
      return o ? window.getComputedStyle(o).display : null;
    });
    expect(displayStyle).toBe('block');

    // Check that the innerHTML contains the evidence strings from the FSM and the HTML implementation
    const html = await output.innerHTML();
    expect(html).toContain('Simulated Compiler Error');
    expect(html).toContain('incompatible types'); // part of the simulated compiler error text
    expect(html).toContain('// In a statically typed language like Java:');

    // Validate that the content includes the code-block container
    expect(html).toContain('class="code-block"'); // should be present inside the injected HTML

    // Ensure clicking the button produced no uncaught exceptions or console errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotence and repeated interactions - multiple clicks do not throw and show consistent output', async ({ page }) => {
    // This test checks edge-case behavior: clicking the button multiple times should not produce errors
    // and the displayed content should remain consistent (the implementation overwrites innerHTML)

    const button = page.locator("button[onclick='showTypeError()']");
    const output = page.locator('#demo-output');

    // Click once
    await button.click();
    await expect(output).toBeVisible();
    const firstHtml = await output.innerHTML();

    // Click a second time
    await button.click();
    await expect(output).toBeVisible();
    const secondHtml = await output.innerHTML();

    // The implementation sets innerHTML each time so content should be identical after second click
    expect(secondHtml).toBe(firstHtml);

    // No console or page errors after repeated interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM attributes and evidence verification - confirm elements match FSM components', async ({ page }) => {
    // This test verifies the DOM evidence described in the FSM:
    // - The button has an onclick attribute exactly "showTypeError()"
    // - The #demo-output is present and initially has style "display: none;" as attribute in source.

    // Check the button attribute
    const buttonHandle = await page.$("button[onclick='showTypeError()']");
    expect(buttonHandle).not.toBeNull();

    // Verify the attribute value exactly
    const onclickAttr = await page.evaluate(el => el.getAttribute('onclick'), buttonHandle);
    expect(onclickAttr).toBe('showTypeError()');

    // Check the presence of #demo-output and the inline style attribute (from source HTML)
    const outputHandle = await page.$('#demo-output');
    expect(outputHandle).not.toBeNull();

    const styleAttr = await page.evaluate(el => el.getAttribute('style'), outputHandle);
    // The HTML source includes style: "display: none;" but depending on browser it may be normalized.
    // We assert that the style attribute, if present, contains 'display' and 'none' to match evidence.
    if (styleAttr !== null) {
      expect(styleAttr.replace(/\s/g, '')).toContain('display:none');
    } else {
      // If the style attribute isn't present (some environments normalize styles differently),
      // validate via computed style instead (should be 'none' at initial state).
      const computed = await page.evaluate(() => {
        const o = document.getElementById('demo-output');
        return o ? window.getComputedStyle(o).display : null;
      });
      expect(computed).toBe('none');
    }

    // No runtime errors should have been captured during these checks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Error observation: capture and report any console/page errors during navigation and interactions', async ({ page }) => {
    // This test demonstrates error observation. We assert that the page runs cleanly in this environment.
    // If any of the following assertions fail, it means the page produced runtime errors (ReferenceError, TypeError, SyntaxError, etc.)
    // which should be investigated.

    // At this point the page was already loaded in beforeEach. Do an interaction too.
    const button = page.locator("button[onclick='showTypeError()']");
    await button.click();

    // Wait briefly to allow any async runtime errors to surface
    await page.waitForTimeout(200);

    // Build a helpful failure message if errors exist
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      const combined = [
        'Page errors:',
        ...pageErrors,
        'Console errors:',
        ...consoleErrors
      ].join('\n');
      // Fail with the collected messages for easier debugging
      expect(pageErrors.length + consoleErrors.length, combined).toBe(0);
    }

    // If we reach here, no runtime errors were observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: ensure clicking button does not remove the button or break the page structure', async ({ page }) => {
    // The FSM does not specify removal of controls. Ensure the button remains in the DOM and clickable after showing error.
    const button = page.locator("button[onclick='showTypeError()']");
    const output = page.locator('#demo-output');

    // Click to reveal output
    await button.click();
    await expect(output).toBeVisible();

    // Button should still be present and visible
    await expect(button).toBeVisible();

    // Ensure basic page structure (main headings) still present after action
    await expect(page.locator('h1')).toHaveText('Static Typing: A Comprehensive Guide');

    // No runtime errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});