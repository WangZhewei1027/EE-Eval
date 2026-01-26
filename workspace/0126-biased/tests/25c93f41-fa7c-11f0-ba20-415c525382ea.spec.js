import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c93f41-fa7c-11f0-ba20-415c525382ea.html';

test.describe('AVL Tree Demo - FSM states and transitions (Application ID: 25c93f41-fa7c-11f0-ba20-415c525382ea)', () => {
  // Arrays to collect console errors and page errors during each test
  let consoleErrors;
  let pageErrors;

  // Common locators used across tests
  const selectors = {
    demoButton: '#show-demo-btn',
    demoText: '#demo-text',
  };

  // Setup listener hooks before each test to capture console and runtime errors.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages; filter for entries that are of type "error"
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location?.url ? msg.location : undefined,
          });
        }
      } catch (e) {
        // In case msg.type or other accessors throw in some envs, record generic message
        consoleErrors.push({ text: `Failed to read console message: ${String(e)}` });
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the application page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown assertion to ensure no console or page errors occurred during the test run
  test.afterEach(async () => {
    // Assert there were no uncaught exceptions on the page
    expect(pageErrors, `Expected no page errors, but found: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);

    // Assert there were no error-level console messages
    expect(consoleErrors, `Expected no console error messages, but found: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
  });

  test.describe('Initial Idle State (S0_Idle) validations', () => {
    test('Initial render: button exists and demo text is hidden', async ({ page }) => {
      // Validate that the Show Insertion Demo button is present with expected text
      const btn = page.locator(selectors.demoButton);
      await expect(btn).toHaveCount(1);
      await expect(btn).toHaveText('Show Insertion Demo');

      // Validate the demo text pre element exists
      const demoPre = page.locator(selectors.demoText);
      await expect(demoPre).toHaveCount(1);

      // The FSM indicates demoText should be hidden on entry of Idle state -> style display none
      // Check both inline attribute and computed style to be robust
      const inlineDisplay = await demoPre.getAttribute('style'); // may contain "display:none;"
      expect(
        typeof inlineDisplay === 'string' && inlineDisplay.includes('display:none'),
        `Expected inline style to contain 'display:none', got: ${inlineDisplay}`
      ).toBeTruthy();

      // Also check computed style is "none"
      const computedDisplay = await demoPre.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedDisplay, `Expected computed display to be 'none', got: ${computedDisplay}`).toBe('none');

      // The demo text content should initially be empty
      const initialText = await demoPre.textContent();
      expect((initialText || '').trim(), 'Expected demo text to be empty on initial render').toBe('');
    });
  });

  test.describe('ShowDemo event and transitions (S0_Idle <-> S1_DemoVisible)', () => {
    test('Clicking Show Insertion Demo transitions to Demo Visible (S1_DemoVisible) and displays content', async ({ page }) => {
      const btn = page.locator(selectors.demoButton);
      const demoPre = page.locator(selectors.demoText);

      // Click the button (trigger the ShowDemo event)
      await btn.click();

      // After click, demo text should be visible (style.display === 'block') and contain demoSteps text
      // Check computed style
      const computedDisplayAfter = await demoPre.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedDisplayAfter, `Expected demo text to be visible after click, got: ${computedDisplayAfter}`).toBe('block');

      // The FSM indicates demoText.textContent = demoSteps; so verify demo text includes well-known phrase from demoSteps
      const textAfter = await demoPre.textContent();
      expect(textAfter, 'Expected demo text to contain "Start with an empty AVL Tree."').toContain('Start with an empty AVL Tree.');

      // The button text must toggle to "Hide Insertion Demo"
      await expect(btn).toHaveText('Hide Insertion Demo');
    });

    test('Clicking Hide Insertion Demo toggles back to Idle (S0_Idle) and hides content', async ({ page }) => {
      const btn = page.locator(selectors.demoButton);
      const demoPre = page.locator(selectors.demoText);

      // First click to show
      await btn.click();
      // Ensure visible
      const displayed = await demoPre.evaluate((el) => window.getComputedStyle(el).display);
      expect(displayed).toBe('block');

      // Click again to hide (same ShowDemo event toggles)
      await btn.click();

      // After second click, demo text should be hidden again
      const computedDisplayAfterHide = await demoPre.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedDisplayAfterHide, `Expected demo text to be hidden after second click, got: ${computedDisplayAfterHide}`).toBe('none');

      // Button text returns to "Show Insertion Demo"
      await expect(btn).toHaveText('Show Insertion Demo');

      // The content remains present in DOM but hidden; ensure textContent is still the demoSteps (or empty if implementation clears it)
      // FSM indicates only style is changed back and button text changes; it does not clear textContent on hide.
      // Thus we assert that the textContent contains at least a known sentence (if implementation preserved it).
      const textAfterHide = await demoPre.textContent();
      expect(
        (textAfterHide || '').includes('Start with an empty AVL Tree.') || (textAfterHide || '').trim() === '',
        'Expected demo text to either remain populated with demo steps or possibly be empty; implementation may vary.'
      ).toBeTruthy();
    });

    test('Multiple toggles maintain correct button text and visibility (idempotency and stability)', async ({ page }) => {
      const btn = page.locator(selectors.demoButton);
      const demoPre = page.locator(selectors.demoText);

      // Toggle several times, asserting state after each toggle
      for (let i = 0; i < 5; i++) {
        await btn.click();
        const isVisible = (await demoPre.evaluate((el) => window.getComputedStyle(el).display)) === 'block';
        const expectedButtonText = isVisible ? 'Hide Insertion Demo' : 'Show Insertion Demo';
        await expect(btn).toHaveText(expectedButtonText);

        // If visible, ensure content contains at least "Insert 10" or top-level phrase to confirm it's the demo content
        if (isVisible) {
          const text = await demoPre.textContent();
          expect(text, 'When visible, demo text should contain "Insert 10" or starting phrase').toMatch(/Insert 10|Start with an empty AVL Tree/);
        }
      }
    });

    test('Keyboard activation (Enter key) triggers the same ShowDemo event and toggles visibility', async ({ page }) => {
      const btn = page.locator(selectors.demoButton);
      const demoPre = page.locator(selectors.demoText);

      // Focus the button and press Enter to toggle
      await btn.focus();
      await page.keyboard.press('Enter');

      // After activating via keyboard, it should be visible
      const visibleAfterKey = await demoPre.evaluate((el) => window.getComputedStyle(el).display);
      expect(visibleAfterKey).toBe('block');
      await expect(btn).toHaveText('Hide Insertion Demo');

      // Press Space to toggle back (space should also trigger a button click)
      await page.keyboard.press('Space');
      const visibleAfterSpace = await demoPre.evaluate((el) => window.getComputedStyle(el).display);
      expect(visibleAfterSpace).toBe('none');
      await expect(btn).toHaveText('Show Insertion Demo');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Rapid repeated clicks do not cause uncaught exceptions and keep UI consistent', async ({ page }) => {
      const btn = page.locator(selectors.demoButton);
      const demoPre = page.locator(selectors.demoText);

      // Click rapidly multiple times
      for (let i = 0; i < 20; i++) {
        await btn.click();
      }

      // After rapid clicks, the UI should be in a deterministic state: button text either Show or Hide and demo-text display corresponds
      const finalBtnText = await btn.textContent();
      const finalDisplay = await demoPre.evaluate((el) => window.getComputedStyle(el).display);

      // The final buttonText should correspond to finalDisplay:
      if ((finalDisplay || '').trim() === 'block') {
        expect(finalBtnText.trim()).toBe('Hide Insertion Demo');
      } else {
        expect(finalBtnText.trim()).toBe('Show Insertion Demo');
      }
    });

    test('DOM integrity: demo-text element remains in DOM even when hidden', async ({ page }) => {
      const demoPre = page.locator(selectors.demoText);

      // Ensure element present
      await expect(demoPre).toBeAttached();

      // Hide it via clicking if necessary
      const btn = page.locator(selectors.demoButton);
      const displayNow = await demoPre.evaluate((el) => window.getComputedStyle(el).display);
      if (displayNow === 'block') {
        await btn.click(); // hide
      }

      // Ensure the element is still attached to DOM and can be re-shown
      await expect(demoPre).toBeAttached();
      await btn.click(); // show
      await expect(demoPre).toBeVisible();
    });
  });
});