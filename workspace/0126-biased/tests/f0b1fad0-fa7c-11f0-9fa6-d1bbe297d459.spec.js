import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1fad0-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Selection Sort Demo - FSM validation (f0b1fad0-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Attach listeners BEFORE navigation to capture load-time errors
    page.on('console', (msg) => {
      // Record console message type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Record unhandled exceptions thrown on the page
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic sanity: ensure our collectors are not leaking between tests
    consoleMessages = [];
    pageErrors = [];
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('Idle: Page loads with the Run Selection Sort Demo button present and no renderPage() function defined', async ({ page }) => {
      // Validate the button exists and has the expected text
      const button = page.locator("button[onclick='runDemo()']");
      await expect(button).toHaveCount(1);
      await expect(button).toHaveText('Run Selection Sort Demo');

      // Validate the button has the expected onclick attribute
      const onclickAttr = await button.getAttribute('onclick');
      expect(onclickAttr).toBe('runDemo()');

      // The FSM mentions an entry action renderPage() — verify it is NOT defined on the window.
      // We assert that typeof window.renderPage === 'undefined'
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // Attempting to call renderPage() should throw a ReferenceError in the page context.
      // We invoke it and assert that an exception is thrown and the message indicates it's not defined.
      let thrownError = null;
      try {
        await page.evaluate(() => {
          // This will throw a ReferenceError because renderPage is not defined on the page
          // We do not attempt to define or patch anything; just call it to let the error happen naturally.
          // eslint-disable-next-line no-undef
          renderPage();
        });
      } catch (err) {
        thrownError = err;
      }

      // Ensure an error was thrown and it is a ReferenceError-like message.
      expect(thrownError).not.toBeNull();
      // Message text varies slightly across browsers; check for common substrings.
      const msg = thrownError.message || '';
      expect(
        msg.includes('renderPage is not defined') ||
        msg.includes('renderPage is not a function') ||
        msg.includes('renderPage') // fallback: it should reference renderPage
      ).toBeTruthy();

      // Ensure no unexpected page errors were emitted during loading (other than our deliberate call above which we caught)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition RunDemo -> S1_DemoRunning and Demo behavior', () => {
    test('Transition: Clicking the Run Selection Sort Demo button displays running message and detailed steps', async ({ page }) => {
      // Ensure initial state has no demo output
      const outputLocator = page.locator('#demoOutput');
      await expect(outputLocator).toBeVisible();
      // Initially empty
      const initialHtml = await outputLocator.innerHTML();
      expect(initialHtml.trim().length).toBeGreaterThanOrEqual(0); // may be empty string

      // Click the demo button to trigger the RunDemo event/transition
      await page.click("button[onclick='runDemo()']");

      // After clicking, expect the output to have the running paragraph
      const runningParagraph = outputLocator.locator('p').first();
      await expect(runningParagraph).toHaveText('Running selection sort on array: [5, 2, 9, 1, 5, 6]');

      // Expect an ordered list with step-by-step items
      const listItems = outputLocator.locator('ol > li');
      const count = await listItems.count();

      // Based on the implementation and the fixed input array [5, 2, 9, 1, 5, 6],
      // we expect 11 steps:
      // 1 initial + passes (i=0..4): 2 + 1 + 2 + 2 + 2 = 9 + initial = 10 + final = 11
      expect(count).toBe(11);

      // Validate some expected step contents: initial and final states must be present
      const firstStep = await listItems.nth(0).innerText();
      expect(firstStep).toContain('Initial array: [5, 2, 9, 1, 5, 6]');

      const lastStep = await listItems.nth(count - 1).innerText();
      expect(lastStep).toContain('Final sorted array: [1, 2, 5, 5, 6, 9]');

      // Validate at least one 'Pass' and one 'Swapped' or 'already the minimum' message exists among list items
      let hasPass = false;
      let hasSwappedOrAlready = false;
      for (let i = 0; i < count; i++) {
        const text = await listItems.nth(i).innerText();
        if (text.includes('Pass')) hasPass = true;
        if (text.includes('Swapped') || text.includes('already the minimum')) hasSwappedOrAlready = true;
      }
      expect(hasPass).toBeTruthy();
      expect(hasSwappedOrAlready).toBeTruthy();

      // Ensure no unhandled page errors were emitted during clicking
      expect(pageErrors.length).toBe(0);

      // Also record console messages (should be none critical for this UI)
      // We assert there are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Idempotence and repeated clicks: clicking multiple times resets output (no accumulation of steps)', async ({ page }) => {
      const outputLocator = page.locator('#demoOutput');

      // Click the button once and record count
      await page.click("button[onclick='runDemo()']");
      const firstCount = await outputLocator.locator('ol > li').count();
      expect(firstCount).toBe(11);

      // Click the button a second time - since runDemo sets innerHTML initially, it should reset content
      await page.click("button[onclick='runDemo()']");
      const secondCount = await outputLocator.locator('ol > li').count();
      expect(secondCount).toBe(11);

      // The content after the second click should reflect a fresh run: check final sorted array present again
      const lastStep = await outputLocator.locator('ol > li').nth(secondCount - 1).innerText();
      expect(lastStep).toContain('Final sorted array: [1, 2, 5, 5, 6, 9]');

      // No unhandled page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Direct invocation: calling runDemo() from page context updates the DOM the same way as a click', async ({ page }) => {
      const outputLocator = page.locator('#demoOutput');

      // Invoke runDemo directly in the page context
      await page.evaluate(() => {
        // runDemo is defined by the page; invoking it should produce the same DOM changes as clicking the button.
        window.runDemo();
      });

      // Verify the same outcomes as the click-based invocation
      await expect(outputLocator.locator('p').first()).toHaveText('Running selection sort on array: [5, 2, 9, 1, 5, 6]');
      const count = await outputLocator.locator('ol > li').count();
      expect(count).toBe(11);
      const lastStep = await outputLocator.locator('ol > li').nth(count - 1).innerText();
      expect(lastStep).toContain('Final sorted array: [1, 2, 5, 5, 6, 9]');

      // No unhandled page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error and edge-case scenarios', () => {
    test('Calling an unrelated undefined function throws a ReferenceError in the page context', async ({ page }) => {
      // Deliberately call a non-existent function to assert that the runtime throws a ReferenceError
      let thrown = null;
      try {
        await page.evaluate(() => {
          // This should throw because nonExistentFunction is not defined.
          // We purposefully call it to validate error behavior; we do NOT patch or define anything.
          // eslint-disable-next-line no-undef
          nonExistentFunction();
        });
      } catch (err) {
        thrown = err;
      }

      expect(thrown).not.toBeNull();
      const message = thrown.message || '';
      // The message should reference the undefined function name
      expect(
        message.includes('nonExistentFunction is not defined') ||
        message.includes('nonExistentFunction is not a function') ||
        message.includes('nonExistentFunction')
      ).toBeTruthy();

      // Ensure that page did not emit additional pageerror entries (the thrown error is from evaluate and was caught)
      expect(pageErrors.length).toBe(0);
    });

    test('Ensure the demo output content is well-formed HTML (ol exists when run)', async ({ page }) => {
      const outputLocator = page.locator('#demoOutput');

      // Run the demo
      await page.click("button[onclick='runDemo()']");

      // Ensure an ordered list exists within demoOutput
      const ol = outputLocator.locator('ol');
      await expect(ol).toHaveCount(1);

      // Ensure each list item is non-empty
      const items = ol.locator('li');
      const count = await items.count();
      for (let i = 0; i < count; i++) {
        const text = (await items.nth(i).innerText()).trim();
        expect(text.length).toBeGreaterThan(0);
      }

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Accessibility & DOM contract checks related to FSM', () => {
    test('Button element matches the component definition in the FSM and has expected role/visibility', async ({ page }) => {
      const button = page.locator("button[onclick='runDemo()']");
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('onclick', 'runDemo()');
      await expect(button).toHaveText('Run Selection Sort Demo');

      // Ensure the demo output container exists and is initially empty or ready to receive content
      const output = page.locator('#demoOutput');
      await expect(output).toBeVisible();

      // No page errors on initial load
      expect(pageErrors.length).toBe(0);
    });
  });
});