import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8399861-fa7b-11f0-b314-ad8654ee5de8.html';

// Increase default timeout to allow waiting for the full walkthrough (~20s) in one test.
test.setTimeout(45000);

/**
 * Page Object for the Guided Walkthrough section
 */
class WalkthroughPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btnSelector = 'button#walkthroughBtn';
    this.panelSelector = 'div#walkPanel';
    this.cardSelector = `${this.panelSelector} .walk-card`;
    this.titleSelector = (cardHandle) => cardHandle.locator('.phase-title');
    this.descSelector = (cardHandle) => cardHandle.locator('.phase-desc');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButton() {
    return this.page.locator(this.btnSelector);
  }

  async isButtonDisabled() {
    return (await this.getButton()).isDisabled();
  }

  async getButtonAriaExpanded() {
    return (await this.getButton()).getAttribute('aria-expanded');
  }

  async clickStart() {
    await (await this.getButton()).click();
  }

  async getPanelCards() {
    return this.page.locator(this.cardSelector);
  }

  async countPanelCards() {
    return await this.getPanelCards().count();
  }

  // Return visible titles of cards in panel in order
  async getPanelCardTitles() {
    const cards = this.getPanelCards();
    const count = await cards.count();
    const titles = [];
    for (let i = 0; i < count; i++) {
      const title = await cards.nth(i).locator('.phase-title').innerText();
      titles.push(title);
    }
    return titles;
  }

  // Wait until the middle card's title matches expected (useful to detect current phase)
  async waitForMiddleCardTitle(expectedTitle, options = {}) {
    // Wait for any of the cards to have the expectedTitle as middle card.
    // We expect "current" to be the middle card when there are three cards,
    // or the first card when only one card present, etc. To be conservative,
    // poll the list of titles and check that the center index contains the expectedTitle.
    return this.page.waitForFunction(
      (panelSelector, expected) => {
        const panel = document.querySelector(panelSelector);
        if (!panel) return false;
        const cards = Array.from(panel.querySelectorAll('.walk-card'));
        if (cards.length === 0) return false;
        const middleIndex = Math.floor(cards.length / 2);
        const titleEl = cards[middleIndex].querySelector('.phase-title');
        if (!titleEl) return false;
        return titleEl.textContent.trim() === expected;
      },
      this.panelSelector,
      expectedTitle,
      options
    );
  }

  async waitForSummaryTitle(expectedTitle, options = {}) {
    return this.page.waitForFunction(
      (panelSelector, expected) => {
        const panel = document.querySelector(panelSelector);
        if (!panel) return false;
        const cards = Array.from(panel.querySelectorAll('.walk-card'));
        if (cards.length !== 1) return false;
        const titleEl = cards[0].querySelector('.phase-title');
        if (!titleEl) return false;
        return titleEl.textContent.trim() === expected;
      },
      this.panelSelector,
      expectedTitle,
      options
    );
  }
}

test.describe('SDLC Guided Textual Walkthrough - FSM validation (d8399861...de8)', () => {
  let page;
  let walkthrough;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // New page per test to isolate console/pageerror listeners
    page = await browser.newPage();
    // Capture console "error" messages
    consoleErrors = [];
    pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
    // Capture unhandled exceptions from the page
    page.on('pageerror', (error) => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });

    walkthrough = new WalkthroughPage(page);
    await walkthrough.goto();
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
  });

  test('Idle state (S0_Idle) initial render: start button present and panel empty', async () => {
    // Validate initial (Idle) state: button present, aria-expanded false, not disabled, panel empty
    const btn = await walkthrough.getButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Start Guided Walkthrough');
    const ariaExpanded = await walkthrough.getButtonAriaExpanded();
    expect(ariaExpanded).toBe('false'); // idle expectation per FSM evidence
    const disabled = await walkthrough.isButtonDisabled();
    expect(disabled).toBe(false);
    const cardCount = await walkthrough.countPanelCards();
    expect(cardCount).toBe(0); // panel should be empty at idle

    // Ensure no console/page errors immediately after load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('StartWalkthrough event transitions to Walkthrough Active (S1): button disabled & panel populated', async () => {
    // Click button to start walkthrough; verify S0 -> S1 transition observable behavior
    await walkthrough.clickStart();

    // Button should be disabled and aria-expanded true immediately after click
    await expect(walkthrough.getButton()).toBeDisabled();
    const ariaExpandedAfter = await walkthrough.getButtonAriaExpanded();
    expect(ariaExpandedAfter).toBe('true');

    // Panel should be populated with cards for the first index (index 0).
    // For index 0, the implementation appends current and next -> 2 cards expected.
    // Wait briefly for DOM updates.
    await page.waitForTimeout(100);
    const cardCount = await walkthrough.countPanelCards();
    expect(cardCount).toBeGreaterThanOrEqual(1);
    // verify exact expected for initial layout (current + next)
    expect(cardCount).toBe(2);

    const titles = await walkthrough.getPanelCardTitles();
    // First card (index 0 current position is middle when two cards, middle index = 1? but here they append current then next -> current is first)
    // Implementation appends current first, then next for index 0 so the current is the first. We'll assert presence of the Planning title somewhere in panel.
    expect(titles.some(t => t.includes('Planning & Feasibility'))).toBeTruthy();

    // Verify that the "current" card shows elevated boxShadow or special border style applied inline for emphasis.
    // We cannot easily assert computed style cross-browser in all environments, but we can check that at least one card has an inline style containing 'boxShadow' or 'box-shadow' or 'border' modifications.
    const cards = page.locator('div#walkPanel .walk-card');
    const cardStyles = await cards.evaluateAll((nodes) => nodes.map(n => n.getAttribute('style') || ''));
    // At least one card should contain the boxShadow or border style applied to the current card.
    const hasHighlight = cardStyles.some(s => /boxShadow|box-shadow|border/.test(s));
    expect(hasHighlight).toBeTruthy();

    // Ensure no runtime console errors were emitted by clicking and initial population
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('TimerInterval event advances the walkthrough to the next phase (S1 -> S1)', async () => {
    // Start walkthrough
    await walkthrough.clickStart();

    // Confirm initial current phase is Planning & Feasibility
    await walkthrough.waitForMiddleCardTitle('Planning & Feasibility', { timeout: 3000 });

    // Wait for one interval tick (interval = 2200ms in implementation). Wait a bit longer to be safe.
    await page.waitForTimeout(2400);

    // After one interval, the middle/current card should be 'Requirements Engineering'
    // For index 1, the panel should show previous (Planning), current (Requirements), next (System Analysis) => 3 cards.
    const cardCountAfterTick = await walkthrough.countPanelCards();
    expect(cardCountAfterTick).toBe(3);

    // Wait for the middle card's title to be Requirements Engineering (gives some leeway)
    await walkthrough.waitForMiddleCardTitle('Requirements Engineering', { timeout: 3000 });

    // Assert the setInterval-based transition did not produce any console or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking while disabled is a no-op and does not throw errors (edge case)', async () => {
    // Start walkthrough
    await walkthrough.clickStart();

    // Immediately attempt to click the button again while it should be disabled
    // This should be ignored by the page code (early return if btn.disabled)
    // We perform the secondary click and ensure no exceptions or duplicate behavior.
    await page.waitForTimeout(50); // tiny delay to ensure handler executed
    // Try clicking the disabled button — Playwright's click on a disabled element will throw, so use evaluate to dispatch event
    await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (btn) {
        // simulate a user click dispatch (the page handler checks btn.disabled and should return early)
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        btn.dispatchEvent(evt);
      }
    }, 'button#walkthroughBtn');

    // Wait a short time and verify the button remains disabled and aria-expanded still true while active
    await page.waitForTimeout(100);
    expect(await walkthrough.isButtonDisabled()).toBe(true);
    expect(await walkthrough.getButtonAriaExpanded()).toBe('true');

    // Confirm no runtime errors produced by the extra dispatch
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('EndWalkthrough completes and transitions to Walkthrough Complete (S2) with summary card and restores button (longer wait)', async () => {
    // This test checks the full lifecycle: S0 -> S1 -> (multiple TimerInterval) -> S2
    // The implementation uses 9 phases and an interval of ~2200ms; to reach end we must wait ~19.8s.
    // Start the walkthrough
    await walkthrough.clickStart();

    // Sanity check: button disabled and aria-expanded true while active
    await expect(walkthrough.getButton()).toBeDisabled();
    expect(await walkthrough.getButtonAriaExpanded()).toBe('true');

    // Wait for the final summary to appear. The summary title expected per implementation:
    const expectedSummaryTitle = 'Walkthrough Complete — What to Remember';

    // Wait for summary card to be shown. Allow a generous timeout (test-level timeout increased).
    await walkthrough.waitForSummaryTitle(expectedSummaryTitle, { timeout: 35000 });

    // After completion, the panel should contain exactly one card (the summary)
    const finalCardCount = await walkthrough.countPanelCards();
    expect(finalCardCount).toBe(1);

    const finalTitles = await walkthrough.getPanelCardTitles();
    expect(finalTitles.length).toBe(1);
    expect(finalTitles[0]).toBe(expectedSummaryTitle);

    // The implementation re-enables the button and sets aria-expanded to 'false' on completion
    await page.waitForTimeout(50);
    expect(await walkthrough.isButtonDisabled()).toBe(false);
    expect(await walkthrough.getButtonAriaExpanded()).toBe('false');

    // Verify summary card class name per FSM evidence
    const summaryClass = await page.locator('div#walkPanel .walk-card').getAttribute('class');
    expect(summaryClass).toContain('walk-card');

    // Verify description text exists and contains expected substring (sanity)
    const descText = await page.locator('div#walkPanel .walk-card .phase-desc').innerText();
    expect(descText.length).toBeGreaterThan(10);
    expect(descText).toContain('SDLC');

    // Finally, ensure no uncaught console or page errors happened throughout
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observes and reports any console or page errors (explicit observer test)', async () => {
    // This test simply verifies that our listeners are active and that no unexpected runtime errors occurred during page load and no console.error calls are present.
    // We will perform a simple interaction (start) and then assert the captured arrays remain empty.
    await walkthrough.clickStart();

    // Wait a short while for any potential errors to surface
    await page.waitForTimeout(500);

    // Assert collected console errors and page errors (if any). The expected behavior for this application is zero.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // If any errors were present, surface them in the assertion message to aid debugging
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Fail the test with details (the expect above will already fail if non-zero)
      console.error('Captured console errors:', consoleErrors);
      console.error('Captured page errors:', pageErrors);
    }
  });
});