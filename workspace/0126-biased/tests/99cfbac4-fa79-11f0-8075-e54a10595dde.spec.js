import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cfbac4-fa79-11f0-8075-e54a10595dde.html';

test.describe('Context Switching Demo (Application ID: 99cfbac4-fa79-11f0-8075-e54a10595dde)', () => {
  let consoleMessages;
  let pageErrors;

  // Setup for each test: collect console messages and uncaught page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  // After each test we assert that there were no unexpected uncaught errors.
  test.afterEach(async () => {
    // Keep tests deterministic: assert there were no uncaught page errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    // Also assert there are no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console.error messages were emitted: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initial state and view visibility', () => {
    test('Initial state: all views should be hidden', async ({ page }) => {
      // Validate initial DOM state: view1, view2, view3 are hidden by default
      const view1 = page.locator('#view1');
      const view2 = page.locator('#view2');
      const view3 = page.locator('#view3');

      await expect(view1).not.toBeVisible();
      await expect(view2).not.toBeVisible();
      await expect(view3).not.toBeVisible();
    });

    test('Control buttons exist and are visible', async ({ page }) => {
      // Ensure the control buttons to switch views are present and visible
      await expect(page.locator('#view1Btn')).toBeVisible();
      await expect(page.locator('#view2Btn')).toBeVisible();
      await expect(page.locator('#view3Btn')).toBeVisible();
    });
  });

  test.describe('View switching transitions (FSM transitions)', () => {
    // Each test verifies a transition and expected onEnter/onExit behavior (visibility changes)
    test('Switch from initial state to View 1 when clicking View 1 button', async ({ page }) => {
      // Click the View 1 button and verify view1 becomes visible while others are hidden
      await page.click('#view1Btn');
      await expect(page.locator('#view1')).toBeVisible();
      await expect(page.locator('#view2')).not.toBeVisible();
      await expect(page.locator('#view3')).not.toBeVisible();
    });

    test('Transition: View1 -> View2 (click View2 button)', async ({ page }) => {
      // Ensure starting in view1 first (entry action)
      await page.click('#view1Btn');
      await expect(page.locator('#view1')).toBeVisible();

      // Trigger transition to View2
      await page.click('#view2Btn');

      // Observe expected observables: view2 visible, view1 hidden
      await expect(page.locator('#view2')).toBeVisible();
      await expect(page.locator('#view1')).not.toBeVisible();
      await expect(page.locator('#view3')).not.toBeVisible();
    });

    test('Transition: View1 -> View3 (click View3 button)', async ({ page }) => {
      // Ensure starting from view1
      await page.click('#view1Btn');
      await expect(page.locator('#view1')).toBeVisible();

      // Click View 3
      await page.click('#view3Btn');

      // Validate view3 visible and view1 hidden
      await expect(page.locator('#view3')).toBeVisible();
      await expect(page.locator('#view1')).not.toBeVisible();
      await expect(page.locator('#view2')).not.toBeVisible();
    });

    test('Transition: View2 -> View1 and View2 -> View3', async ({ page }) => {
      // Go to View2 first
      await page.click('#view2Btn');
      await expect(page.locator('#view2')).toBeVisible();

      // Switch back to View1
      await page.click('#view1Btn');
      await expect(page.locator('#view1')).toBeVisible();
      await expect(page.locator('#view2')).not.toBeVisible();

      // Switch to View2 again, then to View3
      await page.click('#view2Btn');
      await expect(page.locator('#view2')).toBeVisible();
      await page.click('#view3Btn');
      await expect(page.locator('#view3')).toBeVisible();
      await expect(page.locator('#view2')).not.toBeVisible();
    });

    test('Transition: View3 -> View1 and View3 -> View2', async ({ page }) => {
      // Start at View3
      await page.click('#view3Btn');
      await expect(page.locator('#view3')).toBeVisible();

      // Switch to View1
      await page.click('#view1Btn');
      await expect(page.locator('#view1')).toBeVisible();
      await expect(page.locator('#view3')).not.toBeVisible();

      // Switch to View3 then View2
      await page.click('#view3Btn');
      await expect(page.locator('#view3')).toBeVisible();
      await page.click('#view2Btn');
      await expect(page.locator('#view2')).toBeVisible();
      await expect(page.locator('#view3')).not.toBeVisible();
    });
  });

  test.describe('Form submissions and output verification', () => {
    test('Submit from View 1: normal input', async ({ page }) => {
      // Navigate to View1 and submit text input, asserting output text
      await page.click('#view1Btn');
      await expect(page.locator('#view1')).toBeVisible();

      const input1 = page.locator('#input1');
      const submit1 = page.locator('#submit1');
      const output1 = page.locator('#output1');

      await input1.fill('Hello Playwright');
      await submit1.click();

      await expect(output1).toHaveText('You entered: Hello Playwright');
    });

    test('Submit from View 1: empty input edge case', async ({ page }) => {
      // Submit with empty input; expected output should reflect empty value
      await page.click('#view1Btn');
      await expect(page.locator('#view1')).toBeVisible();

      const input1 = page.locator('#input1');
      const submit1 = page.locator('#submit1');
      const output1 = page.locator('#output1');

      // Clear any existing value
      await input1.fill('');
      await submit1.click();
      await expect(output1).toHaveText('You entered: ');
    });

    test('Submit from View 2: slider default and edge values', async ({ page }) => {
      // Navigate to View2 and test slider submissions
      await page.click('#view2Btn');
      await expect(page.locator('#view2')).toBeVisible();

      const slider = page.locator('#slider1');
      const submit2 = page.locator('#submit2');
      const output2 = page.locator('#output2');

      // Default value (as per HTML is 50)
      await submit2.click();
      await expect(output2).toHaveText('Slider value: 50');

      // Set slider to minimum (0) and submit
      await slider.evaluate((el) => {
        el.value = '0';
        // dispatch input/change to mimic user action
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await submit2.click();
      await expect(output2).toHaveText('Slider value: 0');

      // Set slider to maximum (100) and submit
      await slider.evaluate((el) => {
        el.value = '100';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await submit2.click();
      await expect(output2).toHaveText('Slider value: 100');
    });

    test('Submit from View 3: input text and select option', async ({ page }) => {
      // Navigate to View3 and submit input + selection
      await page.click('#view3Btn');
      await expect(page.locator('#view3')).toBeVisible();

      const input2 = page.locator('#input2');
      const select1 = page.locator('#select1');
      const submit3 = page.locator('#submit3');
      const output3 = page.locator('#output3');

      await input2.fill('Sample text');
      // Select the second option (Option 2) by value
      await select1.selectOption({ value: 'Option 2' });

      await submit3.click();
      await expect(output3).toHaveText('Input: Sample text, Selected: Option 2');
    });

    test('Submit from View 3: empty input and default selection', async ({ page }) => {
      // Empty input and default selection should still produce a coherent output
      await page.click('#view3Btn');
      await expect(page.locator('#view3')).toBeVisible();

      const input2 = page.locator('#input2');
      const select1 = page.locator('#select1');
      const submit3 = page.locator('#submit3');
      const output3 = page.locator('#output3');

      await input2.fill('');
      // Default selection is the first option (Option 1) unless changed
      await select1.selectOption({ value: 'Option 1' });
      await submit3.click();
      await expect(output3).toHaveText('Input: , Selected: Option 1');
    });
  });

  test.describe('Edge cases and accessibility of hidden controls', () => {
    test('Submit buttons are not interactable when their views are hidden', async ({ page }) => {
      // On initial load, views are hidden, submit buttons should not be visible
      await expect(page.locator('#submit1')).not.toBeVisible();
      await expect(page.locator('#submit2')).not.toBeVisible();
      await expect(page.locator('#submit3')).not.toBeVisible();
    });

    test('Attempting to click a hidden submit with normal click throws', async ({ page }) => {
      // This test verifies that Playwright won't click hidden elements normally.
      // We attempt to click a submit button that is initially hidden and assert it fails.
      const submit1 = page.locator('#submit1');
      let threw = false;
      try {
        // This will throw because the element is not visible
        await submit1.click({ timeout: 1000 });
      } catch (err) {
        threw = true;
        // Ensure the error message mentions visibility to confirm correct behavior
        expect(String(err.message)).toContain('visible');
      }
      expect(threw).toBe(true);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught page errors or console.error messages should occur during normal interactions', async ({ page }) => {
      // Run through a set of normal interactions to surface runtime errors if any
      await page.click('#view1Btn');
      await page.locator('#input1').fill('abc');
      await page.click('#submit1');

      await page.click('#view2Btn');
      await page.locator('#slider1').evaluate(el => {
        el.value = '42';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('#submit2');

      await page.click('#view3Btn');
      await page.locator('#input2').fill('xyz');
      await page.locator('#select1').selectOption({ value: 'Option 3' });
      await page.click('#submit3');

      // After performing interactions, ensure no uncaught page errors were recorded
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

      // Also ensure there are no console.error entries
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Console.error messages were emitted: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    });
  });
});