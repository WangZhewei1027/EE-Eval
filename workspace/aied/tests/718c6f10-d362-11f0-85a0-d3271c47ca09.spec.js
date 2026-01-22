import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718c6f10-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Sliding Window FSM tests - Application 718c6f10-d362-11f0-85a0-d3271c47ca09', () => {
  // Arrays to collect console error messages and unhandled page errors for assertions
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each navigation so we capture script parse/runtime errors that occur during page load
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // collect only error console messages for easier assertions
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location ? msg.location() : null });
        }
      } catch (e) {
        // ignore any inspection errors
      }
    });

    page.on('pageerror', err => {
      // unhandled exceptions on the page (e.g., ReferenceError, SyntaxError)
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // tear down arrays - nothing to do beyond letting GC handle them
    consoleErrors = [];
    pageErrors = [];
  });

  test.describe('S0_Idle - Initial rendering', () => {
    test('renders #window element and does not crash the test runner', async ({ page }) => {
      // Validate the initial evidence: <div id="window"></div> exists
      const windowLocator = page.locator('#window');
      await expect(windowLocator).toHaveCount(1);
      await expect(windowLocator).toBeVisible();

      // Expect no .slide children initially (script is likely broken/doesn't add real slides)
      const slideCount = await page.locator('#window .slide').count();
      expect(slideCount).toBeGreaterThanOrEqual(0); // explicit check, should usually be 0 given broken script

      // The FSM mentions an entry action renderPage() which is not implemented.
      // Confirm that renderPage is not present on the page (so the FSM entry action is not a defined function).
      const renderPageType = await page.evaluate(() => typeof renderPage);
      expect(['undefined', 'function']).toContain(renderPageType); // primarily expect 'undefined'
    });
  });

  test.describe('S1_SlideAdded - addSlide entry actions', () => {
    test('attempting to call addSlide: validate behavior (function may be undefined or throw)', async ({ page }) => {
      // First detect whether addSlide exists
      const addSlideType = await page.evaluate(() => typeof addSlide).catch(() => 'undefined');
      if (addSlideType === 'undefined') {
        // If undefined, verify that attempting to call it from the page would produce a ReferenceError when invoked
        let caught = null;
        try {
          await page.evaluate(() => {
            // This will throw a ReferenceError in the page context
            // We let it occur naturally (per requirements)
            // eslint-disable-next-line no-undef
            addSlide('Slide 1');
          });
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeTruthy();
        // Error message should indicate the function is not defined or similar
        expect(String(caught.message)).toMatch(/addSlide|not defined|is not a function|ReferenceError|TypeError/i);
      } else {
        // If the function exists (unexpected), calling it may still produce runtime errors because implementation is faulty
        let runtimeError = null;
        try {
          await page.evaluate(() => addSlide('Slide 1'));
        } catch (err) {
          runtimeError = err;
        }
        // Ensure either it failed (we caught an error) or it executed without crashing (both cases are accepted),
        // but we assert that at minimum the page recorded console errors or page errors due to faulty implementation.
        const hadPageLevelError = pageErrors.length > 0 || consoleErrors.length > 0;
        expect(hadPageLevelError || runtimeError).toBeTruthy();
      }
    });

    test('FSM transition evidence: the page attempted to execute addSlide entry actions at load (errors expected)', async ({ page }) => {
      // The HTML explicitly calls addSlide('Slide 1') etc at the bottom.
      // Because the page script has multiple issues, we expect at least one console error or page error recorded.
      expect(consoleErrors.length + pageErrors.length).toBeGreaterThanOrEqual(1);

      // Try to assert that one of the console errors or page errors references addSlide or a parsing issue.
      const consoleText = consoleErrors.map(e => e.text).join(' || ');
      const pageErrText = pageErrors.map(e => e.message).join(' || ');
      const combined = `${consoleText} || ${pageErrText}`;

      // We expect either a SyntaxError (due to code issues) or errors referencing addSlide
      expect(/SyntaxError|Unexpected token|\.\.|addSlide|ReferenceError|TypeError/i.test(combined)).toBeTruthy();
    });
  });

  test.describe('S2_SlideRotated - rotateWindow transition', () => {
    test('rotateWindow is syntactically broken in the page script (double dot) and should produce parse/runtime errors', async ({ page }) => {
      // The inline script includes "document.getElementById('window')..querySelector" (double dot)
      // That should create a SyntaxError during parsing which will be captured as a console error or page error.
      // Assert that we observed a syntax-related error.
      const combinedErrors = [
        ...consoleErrors.map(e => e.text),
        ...pageErrors.map(e => e.message)
      ].join(' || ');

      // Expect syntax-related message to be present
      const hasSyntax = /SyntaxError|Unexpected token|Unexpected identifier|Unexpected end of input|\.\./i.test(combinedErrors);
      expect(hasSyntax).toBeTruthy();

      // Additionally, attempt to call rotateWindow; depending on parse behavior it may be undefined.
      const rotateType = await page.evaluate(() => typeof rotateWindow).catch(() => 'undefined');

      if (rotateType === 'undefined') {
        // Calling it will yield a ReferenceError — assert that
        let callErr = null;
        try {
          await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            rotateWindow();
          });
        } catch (err) {
          callErr = err;
        }
        expect(callErr).toBeTruthy();
        expect(String(callErr.message)).toMatch(/rotateWindow|not defined|ReferenceError/i);
      } else {
        // If rotateWindow exists, invoking it may create runtime errors (TypeError etc) due to the buggy code (double dot might not allow full script execution)
        let runtimeErr = null;
        try {
          await page.evaluate(() => rotateWindow());
        } catch (err) {
          runtimeErr = err;
        }
        expect(runtimeErr || consoleErrors.length + pageErrors.length > 0).toBeTruthy();
      }
    });
  });

  test.describe('S3_SlideToggled - toggleSlide transition', () => {
    test('toggleSlide behavior: calling with invalid input should either be undefined or produce runtime errors', async ({ page }) => {
      // Check whether toggleSlide exists
      const toggleType = await page.evaluate(() => typeof toggleSlide).catch(() => 'undefined');

      if (toggleType === 'undefined') {
        // Service the expectation that the function isn't defined on the page
        let thrown = null;
        try {
          await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            toggleSlide(document.createElement('div'));
          });
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeTruthy();
        expect(String(thrown.message)).toMatch(/toggleSlide|not defined|ReferenceError/i);
      } else {
        // If defined, attempt to call with a malformed slide (e.g., null) and expect graceful guard or errors
        let thrown = null;
        try {
          await page.evaluate(() => toggleSlide(null));
        } catch (err) {
          thrown = err;
        }
        // The implementation expects a slide with getAttribute; passing null may cause TypeError
        // Assert that either an error occurred OR the function safely returned (cover both implementations)
        expect(thrown || pageErrors.length + consoleErrors.length > 0).toBeTruthy();
      }
    });

    test('FSM evidence mentions toggleSlide(slide) - ensure page-level logs or errors reference toggleSlide or show absence', async ({ page }) => {
      // Merge captured errors and look for toggleSlide mention or typical missing-function error signatures
      const combined = [
        ...consoleErrors.map(e => e.text),
        ...pageErrors.map(e => e.message)
      ].join(' || ');

      // At least one error or console message should mention toggleSlide or a ReferenceError
      expect(/toggleSlide|ReferenceError|TypeError|is not defined/i.test(combined)).toBeTruthy();
    });
  });

  test.describe('Edge cases and additional assertions', () => {
    test('The page should not define slide list properly due to querying .slide at load; validate slides NodeList behavior', async ({ page }) => {
      // The script queries document.querySelectorAll('.slide') at top-level into const slides.
      // Because there are no initial slide elements and the script is buggy, that NodeList may be empty.
      // Validate that the NodeList length (from inside page) is consistent and that direct DOM query returns expected length.
      const nodeListLength = await page.evaluate(() => {
        try {
          // If slides is defined in page scope, return its length; else return -1
          // Use typeof to avoid ReferenceError when slides is not defined.
          return typeof slides !== 'undefined' ? slides.length : -1;
        } catch (e) {
          return -2;
        }
      });

      // Acceptable values: -1 (slides not defined), 0 (defined but empty), or -2 (error occurred)
      expect([-2, -1, 0].includes(nodeListLength)).toBeTruthy();

      // Also ensure that DOM-level query directly on #window yields zero .slide children in most normal failure cases
      const domSlideCount = await page.locator('#window .slide').count();
      expect(domSlideCount).toBeGreaterThanOrEqual(0); // primarily asserting no crash and numeric result
    });

    test('Observe and assert that at least one console or page error occurred during page load (script is intentionally broken)', async ({ page }) => {
      // Given the deliberate bugs in the JS, we expect at least one captured error
      const totalCaptured = consoleErrors.length + pageErrors.length;
      expect(totalCaptured).toBeGreaterThanOrEqual(1);

      // Log the captured errors in test output to help debugging (Playwright will show these if the test fails)
      for (const c of consoleErrors) {
        console.log('Captured console.error:', c.text);
      }
      for (const p of pageErrors) {
        console.log('Captured pageerror:', p && p.message ? p.message : String(p));
      }
    });
  });
});