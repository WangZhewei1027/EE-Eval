import { test, expect } from '@playwright/test';

// Test file for Application ID: 324f82a0-fa73-11f0-a9d0-d7a1991987c6
// Serves the SDLC interactive application and validates all FSM states and transitions.
// The HTML is served at:
// http://127.0.0.1:5500/workspace/0126-balanced/html/324f82a0-fa73-11f0-a9d0-d7a1991987c6.html

// Page object for the SDLC application to keep tests organized.
class SDLCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the application URL.
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/324f82a0-fa73-11f0-a9d0-d7a1991987c6.html', { waitUntil: 'load' });
  }

  // Click the More Details button inside a phase by phase id (planning, analysis, etc).
  async clickPhaseButton(phaseId) {
    const selector = `.phase#${phaseId} .button`;
    await this.page.click(selector);
  }

  // Get the innerText of the details container.
  async getDetailsText() {
    return this.page.locator('#details').innerText();
  }

  // Get the innerHTML of the details container.
  async getDetailsHTML() {
    return this.page.locator('#details').innerHTML();
  }

  // Get the H1 text on the page.
  async getHeadingText() {
    return this.page.locator('h1').innerText();
  }

  // Get the onclick attribute value for a phase button.
  async getButtonOnclick(phaseId) {
    const selector = `.phase#${phaseId} .button`;
    return this.page.locator(selector).getAttribute('onclick');
  }

  // Check whether the showDetails function exists on the window.
  async hasShowDetailsFunction() {
    return this.page.evaluate(() => typeof showDetails === 'function');
  }
}

// Phases and expected content snippets used in assertions.
const PHASES = [
  { id: 'planning', name: 'Planning', snippet: 'The planning phase is crucial' },
  { id: 'analysis', name: 'Analysis', snippet: 'During the analysis phase' },
  { id: 'design', name: 'Design', snippet: 'In the design phase' },
  { id: 'development', name: 'Development', snippet: 'The development phase is where actual coding happens' },
  { id: 'testing', name: 'Testing', snippet: 'Testing involves various methods' },
  { id: 'deployment', name: 'Deployment', snippet: 'Deployment entails releasing the software' },
  { id: 'maintenance', name: 'Maintenance', snippet: 'Post-deployment, the software needs ongoing maintenance' }
];

test.describe('SDLC Interactive Application - FSM validation', () => {
  // Arrays to capture console messages and page errors for observation per test.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize arrays before each test and hook listeners BEFORE navigation
    // to capture any console or runtime errors during load.
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture console messages with type and text.
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      // Capture uncaught exceptions from the page context.
      pageErrors.push(error);
    });
  });

  test('Initial Idle state: page renders main heading and empty details', async ({ page }) => {
    // Validate the initial render state (S0_Idle).
    const sdlc = new SDLCPage(page);
    await sdlc.goto();

    // The FSM's evidence states the h1 should exist.
    const h1 = await sdlc.getHeadingText();
    expect(h1).toContain('Software Development Life Cycle (SDLC)');

    // Details container should be empty initially.
    const detailsText = await sdlc.getDetailsText();
    expect(detailsText.trim()).toBe('');

    // The showDetails function should be present in the page JS (used by transitions).
    const hasShowDetails = await sdlc.hasShowDetailsFunction();
    expect(hasShowDetails).toBe(true);

    // Ensure there are no uncaught page errors or console errors on initial load.
    // We assert that there are zero pageErrors and zero console error-type messages.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Phase detail transitions (S1..S7)', () => {
    // Test each FSM transition: clicking the More Details button should display appropriate details.
    for (const phase of PHASES) {
      test(`Clicking ${phase.name} button shows ${phase.name} details`, async ({ page }) => {
        const sdlc = new SDLCPage(page);
        await sdlc.goto();

        // Validate the button has the expected onclick evidence attribute as described in the FSM.
        const onclick = await sdlc.getButtonOnclick(phase.id);
        expect(onclick).toBeTruthy();
        expect(onclick).toContain(`showDetails('${phase.name}')`);

        // Click the phase button (this should trigger showDetails and update #details).
        await sdlc.clickPhaseButton(phase.id);

        // Validate that the details area shows the phase name heading and expected content snippet.
        const detailsHTML = await sdlc.getDetailsHTML();
        expect(detailsHTML).toContain(`<h3>${phase.name} Phase</h3>`);
        expect(detailsHTML).toContain(phase.snippet);

        // Check innerText as well for completeness (text extraction/visual feedback).
        const detailsText = await sdlc.getDetailsText();
        expect(detailsText).toContain(`${phase.name} Phase`);
        expect(detailsText).toContain(phase.snippet);

        // No runtime errors should have occurred during this interaction.
        const consoleErrors = consoleMessages.filter(m => m.type === 'error');
        expect(pageErrors.length).toBe(0);
        expect(consoleErrors.length).toBe(0);
      });
    }

    test('Clicking multiple phase buttons updates details accordingly', async ({ page }) => {
      // Validate switching between states updates the details content as expected (visual feedback).
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Click Planning, then Testing, then Deployment
      await sdlc.clickPhaseButton('planning');
      let text = await sdlc.getDetailsText();
      expect(text).toContain('Planning Phase');
      expect(text).toContain('The planning phase is crucial');

      await sdlc.clickPhaseButton('testing');
      text = await sdlc.getDetailsText();
      expect(text).toContain('Testing Phase');
      expect(text).toContain('Testing involves various methods');

      await sdlc.clickPhaseButton('deployment');
      text = await sdlc.getDetailsText();
      expect(text).toContain('Deployment Phase');
      expect(text).toContain('Deployment entails releasing the software');

      // Verify no console or page errors happened during multiple transitions.
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Attributes, edge cases, and failure modes', () => {
    test('All phase buttons exist and have correct onclick attributes', async ({ page }) => {
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      for (const phase of PHASES) {
        const onclick = await sdlc.getButtonOnclick(phase.id);
        // Ensure the onclick attribute is present and references showDetails.
        expect(onclick).toBeTruthy();
        expect(onclick).toContain(`showDetails('${phase.name}')`);
      }

      // No console/page errors detected on attribute checks.
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: calling showDetails with an unknown phase shows undefined content (no crash)', async ({ page }) => {
      // This validates application behavior when provided with an unexpected phase name.
      // We do NOT inject or redefine functions; we rely on the existing showDetails function.
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Call the existing showDetails function with an unknown phase.
      // We execute this in page context using evaluate (allowed).
      await page.evaluate(() => {
        // Call with an unknown phase to exercise edge-case handling of detailsContent lookup.
        // This may produce "undefined" in the DOM but should not throw an exception.
        showDetails('UnknownPhaseXYZ');
      });

      // The details area should now contain the heading for the unknown phase and show 'undefined' text.
      const detailsText = await sdlc.getDetailsText();
      expect(detailsText).toContain('UnknownPhaseXYZ Phase');
      // The content is expected to be the string "undefined" (because detailsContent[phase] is undefined).
      expect(detailsText).toContain('undefined');

      // Confirm application didn't produce runtime errors (ReferenceError/SyntaxError/TypeError).
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('No uncaught ReferenceError, SyntaxError, or TypeError occurred during test run', async ({ page }) => {
      // This test explicitly checks captured page errors for specific error types.
      const sdlc = new SDLCPage(page);
      await sdlc.goto();

      // Perform some typical interactions to ensure runtime stability.
      await sdlc.clickPhaseButton('analysis');
      await sdlc.clickPhaseButton('design');

      // Inspect captured pageErrors (uncaught exceptions) for JS error types of interest.
      const relevantErrors = pageErrors.filter(err => {
        const name = err.name || '';
        return name.includes('ReferenceError') || name.includes('SyntaxError') || name.includes('TypeError');
      });

      // We expect zero uncaught ReferenceError/SyntaxError/TypeError for this healthy implementation.
      expect(relevantErrors.length).toBe(0);

      // Also validate console error messages for those error keywords (if any).
      const consoleErrors = consoleMessages.filter(m => {
        const t = (m.type || '').toLowerCase();
        const text = (m.text || '').toLowerCase();
        // Filter for error messages (console type 'error') or messages containing error type names.
        return t === 'error' || text.includes('referenceerror') || text.includes('syntaxerror') || text.includes('typeerror');
      });
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safety assertions: ensure there were no uncaught errors recorded during the test.
    // This provides an early signal if the page had runtime issues during any individual test.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // If any errors exist, fail the test with a helpful message. The expect below will surface the errors.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console error messages: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);

    // Close page to cleanup (Playwright test runner usually handles this).
    await page.close();
  });
});