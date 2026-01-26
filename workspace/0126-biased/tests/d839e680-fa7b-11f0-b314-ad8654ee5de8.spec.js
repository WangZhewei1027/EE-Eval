import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d839e680-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the Integration Testing guide page
class IntegrationGuidePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleButton = page.locator('#toggleScenario');
    this.scenarioContent = page.locator('#scenarioContent');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main button to be available as part of initial render assertions
    await this.toggleButton.waitFor({ state: 'visible' });
  }

  async getButtonText() {
    return this.toggleButton.textContent();
  }

  async isButtonExpanded() {
    const val = await this.toggleButton.getAttribute('aria-expanded');
    return val === 'true';
  }

  async isScenarioHidden() {
    const aria = await this.scenarioContent.getAttribute('aria-hidden');
    return aria === 'true';
  }

  async hasScenarioHiddenClass() {
    const cls = await this.scenarioContent.getAttribute('class');
    return cls ? cls.split(/\s+/).includes('toggle-hidden') : false;
  }

  async clickToggle() {
    await this.toggleButton.click();
  }
}

test.describe('Integration Testing Guide - Toggle Scenario (FSM Tests)', () => {
  let consoleErrors;
  let pageErrors;

  // Attach listeners for console.error and page errors to observe runtime issues
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture only console error severity messages for investigation
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            type: msg.type(),
            location: msg.location()
          });
        }
      } catch (e) {
        // swallow listener errors — they will be surfaced via pageErrors if relevant
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert there were no unexpected runtime errors reported by the page.
    // The application is small and its script is expected to run without throwing.
    // If any errors occur naturally in the environment under test, these assertions will fail,
    // surfacing ReferenceError/SyntaxError/TypeError as required by the test harness.
    expect(pageErrors.length).toBe(0, `Unexpected page runtime errors were found: ${pageErrors.map(e => String(e)).join('\n')}`);
    expect(consoleErrors.length).toBe(0, `Unexpected console.error messages were emitted: ${consoleErrors.map(e => e.text).join('\n')}`);
  });

  test('Initial state (S0_Idle) - button and scenario hidden', async ({ page }) => {
    // This test validates the Idle state entry evidence:
    // - The toggle button exists with aria-expanded="false" and initial label
    // - The scenario content is hidden (aria-hidden="true" and has toggle-hidden class)
    const app = new IntegrationGuidePage(page);
    await app.goto();

    // Verify button is present and has initial text
    const text = await app.getButtonText();
    expect(text.trim()).toBe('Show integration scenario');

    // Verify aria-expanded on button is false
    const expanded = await app.isButtonExpanded();
    expect(expanded).toBe(false);

    // Verify scenario content is hidden per FSM evidence
    const hiddenAttr = await app.isScenarioHidden();
    expect(hiddenAttr).toBe(true);

    const hasHiddenClass = await app.hasScenarioHiddenClass();
    expect(hasHiddenClass).toBe(true);
  });

  test('Transition S0_Idle -> S1_ScenarioVisible on ToggleScenario click', async ({ page }) => {
    // This test performs the ToggleScenario event (click) and validates the transition:
    // - scenarioContent[aria-hidden="false"]
    // - toggleScenario[aria-expanded="true"]
    // - button text becomes "Hide integration scenario"
    const app = new IntegrationGuidePage(page);
    await app.goto();

    // Click to reveal scenario
    await app.clickToggle();

    // After click, verify the button updated aria-expanded and text
    const expandedAfter = await app.isButtonExpanded();
    expect(expandedAfter).toBe(true);

    const textAfter = (await app.getButtonText()).trim();
    expect(textAfter).toBe('Hide integration scenario');

    // Verify scenario content attributes and classes denote visible state
    const hiddenAttrAfter = await app.isScenarioHidden();
    expect(hiddenAttrAfter).toBe(false);

    const hasHiddenClassAfter = await app.hasScenarioHiddenClass();
    expect(hasHiddenClassAfter).toBe(false);

    // As extra DOM verification, ensure scenarioContent contains the scenario heading
    await expect(page.locator('#scenarioContent h3')).toHaveText(/Scenario: Place an order/i);
  });

  test('Transition S1_ScenarioVisible -> S0_Idle on ToggleScenario click (hide)', async ({ page }) => {
    // This test ensures toggling again returns to Idle:
    // - scenarioContent[aria-hidden="true"]
    // - toggleScenario[aria-expanded="false"]
    // - button text "Show integration scenario"
    const app = new IntegrationGuidePage(page);
    await app.goto();

    // Reveal first
    await app.clickToggle();

    // Now hide by clicking again
    await app.clickToggle();

    // Verify returned to initial state
    const expanded = await app.isButtonExpanded();
    expect(expanded).toBe(false);

    const text = (await app.getButtonText()).trim();
    expect(text).toBe('Show integration scenario');

    const hiddenAttr = await app.isScenarioHidden();
    expect(hiddenAttr).toBe(true);

    const hasHiddenClass = await app.hasScenarioHiddenClass();
    expect(hasHiddenClass).toBe(true);
  });

  test('Repeated rapid toggles maintain consistent final state (edge case)', async ({ page }) => {
    // Edge case: simulate multiple rapid clicks to ensure no uncaught exceptions and final state toggles correctly.
    // We do not patch or monkey-patch any page code — interactions must run against the page as-is.
    const app = new IntegrationGuidePage(page);
    await app.goto();

    // Perform 5 rapid clicks
    for (let i = 0; i < 5; i++) {
      // Use Promise.all to issue clicks without awaiting intermediate layout (simulate quick user)
      await app.toggleButton.click();
    }

    // After 5 clicks, the state should be equivalent to one click (odd number toggles), i.e., visible
    const expanded = await app.isButtonExpanded();
    expect(expanded).toBe(true);

    const text = (await app.getButtonText()).trim();
    expect(text).toBe('Hide integration scenario');

    // Now click once more to return to hidden
    await app.clickToggle();
    expect(await app.isButtonExpanded()).toBe(false);
    expect((await app.getButtonText()).trim()).toBe('Show integration scenario');
  });

  test('Accessibility attributes are consistent with FSM evidence on toggling', async ({ page }) => {
    // This test double-checks that both aria attributes and class toggling happen in tandem,
    // matching the FSM evidence lines such as cont.setAttribute('aria-hidden', ...) and btn.setAttribute('aria-expanded', ...).
    const app = new IntegrationGuidePage(page);
    await app.goto();

    // Initial checks
    expect(await app.isButtonExpanded()).toBe(false);
    expect(await app.isScenarioHidden()).toBe(true);

    // Toggle visible
    await app.clickToggle();

    // Both attributes reflect visible state
    expect(await app.isButtonExpanded()).toBe(true);
    expect(await app.isScenarioHidden()).toBe(false);

    // Toggle back to hidden
    await app.clickToggle();
    expect(await app.isButtonExpanded()).toBe(false);
    expect(await app.isScenarioHidden()).toBe(true);
  });

  test('No unexpected runtime errors during page load and interactions', async ({ page }) => {
    // This test explicitly performs a sequence of interactions and then asserts we've captured no page errors:
    // It complements afterEach assertions and makes the intent explicit per the test requirements.
    const app = new IntegrationGuidePage(page);
    await app.goto();

    // Interactions: reveal, hide, reveal again
    await app.clickToggle();
    await app.clickToggle();
    await app.clickToggle();

    // Validate final visible state
    expect(await app.isButtonExpanded()).toBe(true);

    // The afterEach hook will assert there are no pageErrors or consoleErrors.
    // We also include an inline assertion here for clarity and better failure messages.
    // NOTE: We cannot alter or patch the page runtime; we allow any errors to occur naturally and surface here.
    // If errors occurred, they would have been pushed into the listener arrays and the assertions in afterEach will fail.
    // For explicitness in this test, we check the listener arrays via the global scope captured in closures.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});