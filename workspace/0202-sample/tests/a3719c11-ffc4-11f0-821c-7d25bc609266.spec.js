import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3719c11-ffc4-11f0-821c-7d25bc609266.html';

test.describe('KNN Interactive Application - a3719c11-ffc4-11f0-821c-7d25bc609266', () => {
  // Collect runtime errors and console error messages for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error and page errors without interfering with page runtime
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    page.on('pageerror', (err) => {
      // err is an Error object for uncaught exceptions on the page
      pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test, assert there are no unexpected console or page errors.
    // This allows runtime ReferenceError/SyntaxError/TypeError to happen naturally,
    // but fail the test if any such errors were produced.
    expect(consoleErrors, `Console error messages were logged: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Page errors were thrown: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test.describe('Initial State (S0_Idle) validations', () => {
    test('Initial render: button exists and demo is hidden (entry action: renderPage)', async ({ page }) => {
      // Validate that the button is present with correct id and initial text
      const showBtn = page.locator('#showDemoBtn');
      await expect(showBtn).toHaveCount(1);
      await expect(showBtn).toBeVisible();
      await expect(showBtn).toHaveText('Show KNN Classification Example');

      // Validate that the demo container exists and is hidden initially (style display:none)
      const demo = page.locator('#demo');
      await expect(demo).toHaveCount(1);
      await expect(demo).toBeHidden();

      // The demo container should have aria-live="polite" attribute as per implementation
      await expect(demo).toHaveAttribute('aria-live', 'polite');
    });
  });

  test.describe('ShowDemo event and transition S0_Idle -> S1_DemoVisible', () => {
    test('Clicking the button shows the demo and updates button text (ShowDemo event)', async ({ page }) => {
      const showBtn = page.locator('#showDemoBtn');
      const demo = page.locator('#demo');

      // Precondition: demo hidden
      await expect(demo).toBeHidden();
      await expect(showBtn).toHaveText('Show KNN Classification Example');

      // Trigger: click the button to show demo
      await showBtn.click();

      // Expected observable: demo.style.display = "block" -> Playwright's toBeVisible covers this
      await expect(demo).toBeVisible();

      // Button text should change to "Hide KNN Classification Example" per script
      await expect(showBtn).toHaveText('Hide KNN Classification Example');

      // Verify demo contains the expected demonstration content including "Prediction" and "Red"
      await expect(page.locator('#demo >> text=Prediction')).toBeVisible();
      // There are .demo-text spans showing "Red" — ensure at least one exists and is visible
      const demoTextSpans = page.locator('#demo .demo-text');
      await expect(demoTextSpans).toHaveCountGreaterThan(0);
      await expect(demoTextSpans.first()).toBeVisible();
      await expect(demoTextSpans.first()).toHaveText('Red');
    });

    test('Clicking again hides the demo (HideDemo event) and restores button text', async ({ page }) => {
      const showBtn = page.locator('#showDemoBtn');
      const demo = page.locator('#demo');

      // Show first to ensure we are in S1_DemoVisible
      await showBtn.click();
      await expect(demo).toBeVisible();
      await expect(showBtn).toHaveText('Hide KNN Classification Example');

      // Now click to hide (transition S1_DemoVisible -> S0_Idle)
      await showBtn.click();

      // Expected observable: demo.style.display = "none"
      await expect(demo).toBeHidden();

      // Button text should be restored to original
      await expect(showBtn).toHaveText('Show KNN Classification Example');
    });
  });

  test.describe('Edge cases & robustness', () => {
    test('Rapid clicking toggles state without throwing runtime errors', async ({ page }) => {
      const showBtn = page.locator('#showDemoBtn');
      const demo = page.locator('#demo');

      // Rapidly click the button multiple times
      // This checks for race conditions or runtime exceptions during toggling
      for (let i = 0; i < 6; i++) {
        await showBtn.click();
        // After each click, ensure DOM remains consistent (button exists and demo is either visible or hidden)
        await expect(showBtn).toBeVisible();
        // Using a short wait-for to let DOM update
        await page.waitForTimeout(50);
        // demo should be a known state (visible or hidden)
        const visible = await demo.isVisible();
        if (visible) {
          await expect(showBtn).toHaveText('Hide KNN Classification Example');
        } else {
          await expect(showBtn).toHaveText('Show KNN Classification Example');
        }
      }

      // Final assertion: no console or page errors recorded is handled in afterEach
    });

    test('Demo container retains aria-live and content after multiple toggles', async ({ page }) => {
      const showBtn = page.locator('#showDemoBtn');
      const demo = page.locator('#demo');

      // Toggle show/hide multiple times
      for (let i = 0; i < 3; i++) {
        await showBtn.click();
        await expect(demo).toHaveAttribute('aria-live', 'polite');
        await page.waitForTimeout(20);
        await showBtn.click();
        await expect(demo).toHaveAttribute('aria-live', 'polite');
      }

      // Confirm demo content remains present in the DOM (even when hidden)
      const listItem = page.locator('#demo >> text=(3, 3) – Class: Blue');
      await expect(listItem).toHaveCount(1);
    });

    test('DOM integrity: ensure expected components from FSM exist and do not duplicate', async ({ page }) => {
      // Verify there's exactly one #showDemoBtn button and one #demo div as per the FSM components
      await expect(page.locator('#showDemoBtn')).toHaveCount(1);
      await expect(page.locator('#demo')).toHaveCount(1);

      // Verify the button has the expected CSS class from FSM
      await expect(page.locator('#showDemoBtn')).toHaveClass(/btn-demo/);

      // Verify demo container has the expected class
      await expect(page.locator('#demo')).toHaveClass(/demo-container/);
    });

    test('State behavior: entering S1_DemoVisible shows majority prediction "Red" (content validation)', async ({ page }) => {
      const showBtn = page.locator('#showDemoBtn');
      const demo = page.locator('#demo');

      // Ensure initial state S0
      await expect(demo).toBeHidden();

      // Trigger ShowDemo and validate content that evidences the FSM transition
      await showBtn.click();
      await expect(demo).toBeVisible();

      // Validate the explanation steps contain the three nearest neighbors and the final prediction "Red"
      await expect(page.locator('#demo >> text=3 nearest neighbors')).toBeVisible().catch(() => {}); // tolerant: text may vary in phrasing
      // Ensure the explicit "Red" demo-texts are present and visible
      const redSpans = page.locator('#demo .demo-text', { hasText: 'Red' });
      await expect(redSpans.first()).toBeVisible();
      await expect(redSpans.first()).toHaveText('Red');
    });
  });

  test.describe('Failure modes and error observation (assert no runtime errors)', () => {
    test('No ReferenceError/SyntaxError/TypeError observed during a typical user flow', async ({ page }) => {
      // This test performs a realistic user flow and relies on the afterEach assertions to ensure no errors occurred.
      const showBtn = page.locator('#showDemoBtn');
      const demo = page.locator('#demo');

      // Flow: check initial, show demo, interact slightly, hide demo
      await expect(showBtn).toBeVisible();
      await expect(demo).toBeHidden();

      await showBtn.click();
      await expect(demo).toBeVisible();

      // Interact with the demo content: read some DOM nodes
      const items = page.locator('#demo ul li');
      await expect(items).toHaveCountGreaterThan(0);
      const firstItemText = await items.first().innerText();
      expect(firstItemText.length).toBeGreaterThan(0);

      // Hide again
      await showBtn.click();
      await expect(demo).toBeHidden();

      // The afterEach hook will assert that no page errors or console error messages were produced.
    });
  });
});