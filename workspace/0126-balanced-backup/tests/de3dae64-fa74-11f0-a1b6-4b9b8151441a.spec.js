import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dae64-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('de3dae64-fa74-11f0-a1b6-4b9b8151441a - Type System Demonstration (FSM) E2E', () => {
  // Holders for page-level diagnostics per test
  let pageErrors;
  let consoleMessages;

  // Set up a fresh page and listeners before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore any issues serializing console messages
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the tested page
    await page.goto(APP_URL);
    // Wait for the main heading to ensure page finished rendering
    await expect(page.locator('h1')).toHaveText('Type System in JavaScript');
  });

  test.afterEach(async () => {
    // Sanity: after each test ensure that console and page error arrays are at least defined
    // (specific assertions about errors are done inside individual tests)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('Initial state (S0_Idle): buttons exist and output areas are empty', async ({ page }) => {
    // Validate existence of all five buttons per FSM S0_Idle evidence
    const selectors = [
      "button[onclick='showPrimitiveTypes()']",
      "button[onclick='showDynamicTyping()']",
      "button[onclick='showTypeCoercion()']",
      "button[onclick='showTypeChecking()']",
      "button[onclick='showObjectTypes()']"
    ];

    for (const sel of selectors) {
      const btn = page.locator(sel);
      await expect(btn).toBeVisible();
    }

    // Output containers should exist and be initially empty
    await expect(page.locator('#primitiveOutput')).toBeVisible();
    await expect(page.locator('#primitiveOutput')).toHaveText('', { timeout: 1000 });

    await expect(page.locator('#dynamicOutput')).toBeVisible();
    await expect(page.locator('#dynamicOutput')).toHaveText('', { timeout: 1000 });

    await expect(page.locator('#coercionOutput')).toBeVisible();
    await expect(page.locator('#coercionOutput')).toHaveText('', { timeout: 1000 });

    await expect(page.locator('#checkingOutput')).toBeVisible();
    await expect(page.locator('#checkingOutput')).toHaveText('', { timeout: 1000 });

    await expect(page.locator('#objectOutput')).toBeVisible();
    await expect(page.locator('#objectOutput')).toHaveText('', { timeout: 1000 });

    // Ensure no unexpected page errors on initial render
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Transitions from Idle -> specific states (S0 -> S1..S5)', () => {
    test('S0 -> S1_PrimitiveTypesShown when clicking "Show Primitive Types"', async ({ page }) => {
      // Click the button and assert output contains expected primitive type lines and spans with .type-info
      await page.click("button[onclick='showPrimitiveTypes()']");

      const output = page.locator('#primitiveOutput');
      await expect(output).toContainText('is of type:', { timeout: 2000 });

      // Verify several expected primitive type markers are present
      await expect(output).toContainText('"Hello" is of type', { timeout: 2000 });
      await expect(output).toContainText('42 is of type', { timeout: 2000 });
      await expect(output).toContainText('null is of type', { timeout: 2000 });
      await expect(output.locator('.type-info')).toHaveCountGreaterThan ? expect(await output.locator('.type-info').count()).toBeGreaterThan(0) : null;

      // Ensure no page errors occurred during this transition
      expect(pageErrors.length).toBe(0);
    });

    test('S0 -> S2_DynamicTypingShown when clicking "Show Dynamic Typing"', async ({ page }) => {
      // Click dynamic typing button and assert the output changes as expected
      await page.click("button[onclick='showDynamicTyping()']");

      const output = page.locator('#dynamicOutput');
      await expect(output).toContainText("Initially:", { timeout: 2000 });
      await expect(output).toContainText("Now:", { timeout: 2000 });
      await expect(output).toContainText('"name":', { timeout: 2000 }); // object JSON presence

      // Verify .type-info spans added
      await expect(output.locator('.type-info').first()).toBeVisible();

      // Ensure no page errors occurred during this transition
      expect(pageErrors.length).toBe(0);
    });

    test('S0 -> S3_TypeCoercionShown when clicking "Show Type Coercion"', async ({ page }) => {
      // Click type coercion button and validate textual results of JS coercion examples
      await page.click("button[onclick='showTypeCoercion()']");

      const output = page.locator('#coercionOutput');
      await expect(output).toContainText('"5" + 2 =', { timeout: 2000 });
      await expect(output).toContainText('5 + "2" =', { timeout: 2000 });
      await expect(output).toContainText('"5" - 2 =', { timeout: 2000 });
      await expect(output).toContainText('5 == "5" =', { timeout: 2000 });
      await expect(output).toContainText('5 === "5" =', { timeout: 2000 });

      // The output should include type-info spans (visual feedback)
      await expect(output.locator('.type-info').first()).toBeVisible();

      // Ensure no page errors occurred during this transition
      expect(pageErrors.length).toBe(0);
    });

    test('S0 -> S4_TypeCheckingShown when clicking "Show Type Checking"', async ({ page }) => {
      // Click type checking button and confirm typeof results and Array.isArray output appear
      await page.click("button[onclick='showTypeChecking()']");

      const output = page.locator('#checkingOutput');
      await expect(output).toContainText('typeof "hello" =', { timeout: 2000 });
      await expect(output).toContainText('typeof 42 =', { timeout: 2000 });
      await expect(output).toContainText('typeof null =', { timeout: 2000 });
      await expect(output).toContainText('Array.isArray', { timeout: 2000 });
      await expect(output.locator('.type-info')).toHaveCountGreaterThan ? expect(await output.locator('.type-info').count()).toBeGreaterThan(0) : null;

      // Ensure no page errors occurred during this transition
      expect(pageErrors.length).toBe(0);
    });

    test('S0 -> S5_ObjectTypesShown when clicking "Show Object Types"', async ({ page }) => {
      // Click object types button and assert multiple object-related outputs
      await page.click("button[onclick='showObjectTypes()']");

      const output = page.locator('#objectOutput');
      await expect(output).toContainText('Plain object:', { timeout: 2000 });
      await expect(output).toContainText('Array:', { timeout: 2000 });
      await expect(output).toContainText('Function:', { timeout: 2000 });
      await expect(output).toContainText('Date:', { timeout: 2000 });
      await expect(output).toContainText('Is array instance of Object?', { timeout: 2000 });

      // Ensure type-info spans are present for instanceof checks
      await expect(output.locator('.type-info').first()).toBeVisible();

      // Ensure no page errors occurred during this transition
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and repeated interactions', () => {
    test('Clicking the same button repeatedly resets/overwrites output (idempotence)', async ({ page }) => {
      // Click primitive types twice rapidly and verify output remains stable (not accumulating)
      const btn = page.locator("button[onclick='showPrimitiveTypes()']");
      const output = page.locator('#primitiveOutput');

      await btn.click();
      const first = await output.innerHTML();

      await btn.click();
      const second = await output.innerHTML();

      // The functions write output.innerHTML = result, so consecutive clicks should produce identical strings
      expect(second).toBe(first);

      // Also ensure the output contains multiple expected primitive identifiers
      expect(second).toContain('is of type');
      expect(second).toContain('null is of type');

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Rapidly clicking all buttons should populate their respective outputs without throwing', async ({ page }) => {
      // Click all buttons quickly to simulate a power user; ensure each output updates
      const selectors = [
        { btn: "button[onclick='showPrimitiveTypes()']", out: '#primitiveOutput', expectText: 'Hello' },
        { btn: "button[onclick='showDynamicTyping()']", out: '#dynamicOutput', expectText: 'Initially' },
        { btn: "button[onclick='showTypeCoercion()']", out: '#coercionOutput', expectText: '"5" + 2' },
        { btn: "button[onclick='showTypeChecking()']", out: '#checkingOutput', expectText: 'typeof' },
        { btn: "button[onclick='showObjectTypes()']", out: '#objectOutput', expectText: 'Plain object' }
      ];

      // Fire clicks without awaiting DOM updates to emulate concurrency
      for (const s of selectors) {
        page.locator(s.btn).click();
      }

      // Then assert each output contains expected evidence
      for (const s of selectors) {
        await expect(page.locator(s.out)).toContainText(s.expectText, { timeout: 2000 });
      }

      // No page errors should result from normal operation
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Explicit error scenarios (verify natural errors occur and are observable)', () => {
    test('Trigger a ReferenceError by invoking a non-existent function and assert the error is reported', async ({ page }) => {
      // Prepare capturing of the pageerror event
      let capturedError = null;
      const handler = err => { capturedError = err; };
      page.on('pageerror', handler);

      // Attempt to call a non-existent function in page context; this will reject the evaluate promise
      let evalError = null;
      try {
        await page.evaluate(() => {
          // Intentionally call an undefined function to trigger a ReferenceError
          // This is performed in page context and should produce a natural ReferenceError
          // Do NOT modify page globals; just call an undefined symbol
          // eslint-disable-next-line no-undef
          showNonExistentFunction();
        });
      } catch (e) {
        evalError = e;
      }

      // Remove handler to avoid leaking
      page.off('pageerror', handler);

      // The page.evaluate should have thrown an error
      expect(evalError).not.toBeNull();
      // The error message should indicate an undefined function; message content can vary across browsers
      expect(String(evalError)).toMatch(/ReferenceError|is not defined|not defined/);

      // The pageerror handler should have captured an Error object as well
      expect(capturedError).not.toBeNull();
      // The captured error should be an Error and typically a ReferenceError
      expect(String(capturedError)).toMatch(/ReferenceError|is not defined|not defined/);
    });

    test('Trigger a SyntaxError by evaluating malformed code and assert it is reported', async ({ page }) => {
      // Listen for pageerror
      let capturedError = null;
      const handler = err => { capturedError = err; };
      page.on('pageerror', handler);

      // Evaluate malformed code in page context to create a SyntaxError
      let evalError = null;
      try {
        await page.evaluate(() => {
          // Intentionally execute invalid JavaScript via eval to cause a SyntaxError
          eval('function () {'); // malformed function declaration
        });
      } catch (e) {
        evalError = e;
      }

      page.off('pageerror', handler);

      // Ensure the evaluate rejected
      expect(evalError).not.toBeNull();
      expect(String(evalError)).toMatch(/SyntaxError|Unexpected token|Unexpected end of input/);

      // Ensure the pageerror captured a SyntaxError also
      expect(capturedError).not.toBeNull();
      expect(String(capturedError)).toMatch(/SyntaxError|Unexpected token|Unexpected end of input/);
    });

    test('Trigger a TypeError in page context and assert it is observed', async ({ page }) => {
      // Example TypeError: attempt to access property of null
      let capturedError = null;
      const handler = err => { capturedError = err; };
      page.on('pageerror', handler);

      let evalError = null;
      try {
        await page.evaluate(() => {
          // Intentionally cause a TypeError: cannot read properties of null
          const x = null;
          // Accessing a property on null triggers a TypeError
          // eslint-disable-next-line no-unused-expressions
          return x.toString();
        });
      } catch (e) {
        evalError = e;
      }

      page.off('pageerror', handler);

      expect(evalError).not.toBeNull();
      expect(String(evalError)).toMatch(/TypeError|Cannot read properties of null|reading 'toString'/);

      expect(capturedError).not.toBeNull();
      expect(String(capturedError)).toMatch(/TypeError|Cannot read properties of null|reading 'toString'/);
    });
  });

  test('Inspect console messages for severity (no unexpected console.error during normal interactions)', async ({ page }) => {
    // Perform normal interactions
    await page.click("button[onclick='showPrimitiveTypes()']");
    await page.click("button[onclick='showDynamicTyping()']");
    await page.click("button[onclick='showTypeCoercion()']");
    await page.click("button[onclick='showTypeChecking()']");
    await page.click("button[onclick='showObjectTypes()']");

    // Give a little time for any asynchronous console messages (if present) to arrive
    await page.waitForTimeout(200);

    // Fail the test if any console messages of type 'error' or 'warning' emerged during normal interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    const consoleWarnings = consoleMessages.filter(m => m.type === 'warning');

    expect(consoleErrors.length).toBe(0);
    // Warnings may be acceptable but we assert none for stricter quality
    expect(consoleWarnings.length).toBe(0);

    // Additionally ensure pageErrors is still empty after normal interactions
    expect(pageErrors.length).toBe(0);
  });
});