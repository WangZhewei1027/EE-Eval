import { test, expect } from '@playwright/test';

// Test file: 3c9ac1c2-fa78-11f0-857d-d58e82d5de73.spec.js
// This suite validates the Software Development Life Cycle interactive application.
// It verifies all FSM states and transitions driven by the "Next Phase" button,
// checks visual highlighting behavior, ensures the info box content updates,
// observes console logs and page errors, and validates edge cases like rapid clicks.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9ac1c2-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the SDLC app
class SDLCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nextButton = page.locator('button#nextButton');
    this.infoBox = page.locator('#infoBox');
    this.infoTitle = page.locator('#infoBox strong');
    this.infoParagraph = page.locator('#infoBox p');
    this.stepCircles = page.locator('.step-circle');
    this.stepLabels = page.locator('.step-label');
    this.svg = page.locator('svg#cycle-svg');
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  // Click Next Phase and wait a short moment for UI updates/animations
  async clickNext() {
    await this.nextButton.click();
    // Allow DOM updates/animations to settle
    await this.page.waitForTimeout(150);
  }

  // Get the title text from the info box
  async getInfoTitle() {
    return (await this.infoTitle.textContent()).trim();
  }

  // Get the paragraph text from the info box
  async getInfoParagraph() {
    return (await this.infoParagraph.textContent()).trim();
  }

  // Get attributes and inline style values for a step circle at index
  async getStepCircleInfo(index) {
    return await this.page.evaluate((idx) => {
      const circle = document.querySelectorAll('.step-circle')[idx];
      const label = document.querySelectorAll('.step-label')[idx];
      if (!circle || !label) return null;
      return {
        fillAttr: circle.getAttribute('fill'),
        inlineTransform: circle.style.transform || '',
        inlineFilter: circle.style.filter || '',
        labelFillAttr: label.getAttribute('fill'),
        labelInlineFilter: label.style.filter || '',
      };
    }, index);
  }

  // Count number of step circles
  async countSteps() {
    return await this.stepCircles.count();
  }
}

// Expected phases derived from the HTML/JS implementation and FSM
const EXPECTED_PHASES = [
  {
    title: 'Planning',
    info: 'Defining the project objectives, scope, and feasibility to set a clear roadmap for the software development.'
  },
  {
    title: 'Analysis',
    info: 'Gathering and analyzing requirements from stakeholders to understand what the software must achieve.'
  },
  {
    title: 'Design',
    info: 'Creating architecture, user interfaces, and detailed plans to guide the development process effectively.'
  },
  {
    title: 'Implementation',
    info: 'Writing clean, efficient code and integrating components to build the functional software system.'
  },
  {
    title: 'Testing',
    info: 'Verifying and validating the software to identify and fix bugs ensuring quality and reliability.'
  },
  {
    title: 'Deployment',
    info: 'Releasing the software to the production environment making it available to end users.'
  },
  {
    title: 'Maintenance',
    info: 'Ongoing updates and improvements post-deployment to adapt the software to evolving needs.'
  }
];

test.describe('Software Development Life Cycle interactive app', () => {
  // We'll capture console messages and page errors for inspection in tests.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Attach listeners BEFORE navigation so we capture early errors.
    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push({ text });
      }
    });

    page.on('pageerror', (err) => {
      // pageerror provides an Error object
      pageErrors.push(err);
    });
  });

  test('Initial state: S0_Planning is displayed and step 0 is highlighted', async ({ page }) => {
    // This test validates the initial onload behavior and entry actions for S0_Planning
    const sdlc = new SDLCPage(page);
    await sdlc.goto(APP_URL);

    // Verify the SVG diagram exists
    await expect(sdlc.svg).toBeVisible();

    // Info box should show Planning immediately (entry action highlightStep(0) triggered on load)
    await expect(sdlc.infoTitle).toHaveText(EXPECTED_PHASES[0].title);
    await expect(sdlc.infoParagraph).toHaveText(EXPECTED_PHASES[0].info);

    // The first step circle should have a different fill and be scaled up via inline transform
    const step0 = await sdlc.getStepCircleInfo(0);
    expect(step0).not.toBeNull();
    expect(step0.fillAttr.toLowerCase()).toBe('#fff176'); // highlighted fill color
    expect(step0.inlineTransform).toContain('scale(1.25)'); // scaled up
    expect(step0.inlineFilter).toContain('drop-shadow');

    // Step 0 label should have the highlight fill
    expect(step0.labelFillAttr.toLowerCase()).toBe('#fff8e1');

    // Ensure number of steps matches FSM (7)
    const count = await sdlc.countSteps();
    expect(count).toBe(EXPECTED_PHASES.length);

    // No uncaught exceptions should have occurred during load
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Next Phase cycles through each FSM state and updates visuals accordingly', async ({ page }) => {
    // This test validates transitions S0 -> S1 -> ... -> S6 -> S0 via NextPhase (button click)
    const sdlc = new SDLCPage(page);
    await sdlc.goto(APP_URL);

    // For each phase, click the next button and validate the info box and the highlighted circle/label.
    // Start from index 0 (Planning already displayed). We'll iterate clicks and check the new state each time.
    for (let step = 1; step <= EXPECTED_PHASES.length; step++) {
      // Click next to transition to the next phase; step mod length will be the expected index
      await sdlc.clickNext();
      const expectedIndex = step % EXPECTED_PHASES.length; // wraps around to 0 after last

      // Validate info box title and paragraph match expected phase
      await expect(sdlc.infoTitle).toHaveText(EXPECTED_PHASES[expectedIndex].title);
      await expect(sdlc.infoParagraph).toHaveText(EXPECTED_PHASES[expectedIndex].info);

      // Verify corresponding circle is highlighted and others are not
      for (let i = 0; i < EXPECTED_PHASES.length; i++) {
        const info = await sdlc.getStepCircleInfo(i);
        expect(info).not.toBeNull();
        if (i === expectedIndex) {
          // Highlighted
          expect(info.fillAttr.toLowerCase()).toBe('#fff176');
          expect(info.inlineTransform).toContain('scale(1.25)');
          expect(info.labelFillAttr.toLowerCase()).toBe('#fff8e1');
        } else {
          // Not highlighted
          expect(info.fillAttr.toLowerCase()).toBe('#ffdd57');
          // Unhighlighted should have transform scale(1) or empty (but code sets scale(1))
          expect(info.inlineTransform === '' || info.inlineTransform.includes('scale(1)')).toBe(true);
          expect(info.labelFillAttr.toLowerCase()).toBe('#ffdd57');
        }
      }
    }

    // After cycling EXPECTED_PHASES.length times we should be back to Planning
    await expect(sdlc.infoTitle).toHaveText(EXPECTED_PHASES[0].title);

    // Check that no page errors occurred during these interactions
    expect(pageErrors.length).toBe(0);

    // Console errors (if any) will be captured for inspection; assert there are none
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid successive clicks should advance correctly without throwing errors', async ({ page }) => {
    // This test simulates rapid user interaction clicking the Next Phase button in quick succession.
    // It verifies that transitions are applied in order, and no uncaught runtime errors appear.
    const sdlc = new SDLCPage(page);
    await sdlc.goto(APP_URL);

    const rapidClicks = 5;
    // Perform rapid clicks without awaiting between them to simulate fast user behavior.
    for (let i = 0; i < rapidClicks; i++) {
      await sdlc.nextButton.click();
    }

    // Wait briefly to allow any queued handlers to run and UI to settle
    await page.waitForTimeout(300);

    // Expect current index to be (0 + rapidClicks) % 7 => 5 (Deployment)
    const expectedIndex = rapidClicks % EXPECTED_PHASES.length;
    await expect(sdlc.infoTitle).toHaveText(EXPECTED_PHASES[expectedIndex].title);
    await expect(sdlc.infoParagraph).toHaveText(EXPECTED_PHASES[expectedIndex].info);

    // Ensure the highlighted circle corresponds to expectedIndex
    const highlighted = await sdlc.getStepCircleInfo(expectedIndex);
    expect(highlighted.fillAttr.toLowerCase()).toBe('#fff176');

    // No uncaught page errors should have been emitted
    expect(pageErrors.length).toBe(0);
  });

  test('UI elements exist and have the expected accessibility attributes', async ({ page }) => {
    // This test verifies presence of key components described in the FSM/components section
    const sdlc = new SDLCPage(page);
    await sdlc.goto(APP_URL);

    // Next button should have the aria-label specified by FSM
    await expect(sdlc.nextButton).toBeVisible();
    const ariaLabel = await sdlc.nextButton.getAttribute('aria-label');
    expect(ariaLabel).toBe('Show next Software Development Life Cycle phase');

    // Info box should have id and aria-live attributes
    const infoBoxLocator = page.locator('.info-box#infoBox');
    await expect(infoBoxLocator).toBeVisible();
    expect(await infoBoxLocator.getAttribute('aria-live')).toBe('polite');
    expect(await infoBoxLocator.getAttribute('aria-atomic')).toBe('true');

    // SVG should be present and have the expected id
    await expect(sdlc.svg).toBeVisible();
    expect(await sdlc.svg.getAttribute('id')).toBe('cycle-svg');

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console and page errors during load and interactions (capture and assert none occurred)', async ({ page }) => {
    // This test explicitly demonstrates observation of console messages and page errors.
    // It asserts that no runtime errors were emitted during normal operation.
    const sdlc = new SDLCPage(page);
    await sdlc.goto(APP_URL);

    // Interact a bit to exercise the code path (few clicks)
    await sdlc.clickNext();
    await sdlc.clickNext();

    // Wait for potential async errors
    await page.waitForTimeout(200);

    // Collate captured console error messages for diagnostic output if assertion fails
    // We assert that there were no page errors and no console.error messages.
    if (pageErrors.length > 0) {
      // If pageErrors exist, fail with diagnostic info
      const messages = pageErrors.map((e) => (e && e.message) ? e.message : String(e)).join('; |; ');
      throw new Error(`Unexpected page errors were emitted: ${messages}`);
    }

    if (consoleErrors.length > 0) {
      const messages = consoleErrors.map((e) => e.text).join('; |; ');
      throw new Error(`Console reported errors during execution: ${messages}`);
    }

    // Additionally ensure that we did capture some console messages (info/debug) to demonstrate observation
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // trivial but documents fact we collected them
  });
});