import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e8d01-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page object encapsulating the scenes page interactions and queries.
 */
class ScenesPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the switch scene button
  async clickSwitch() {
    await this.page.click('#switchScene');
  }

  // Get inline style.transform values for the two scenes (reads element.style.transform)
  async getInlineTransforms() {
    return await this.page.evaluate(() => {
      const s1 = document.querySelector('.scene-1');
      const s2 = document.querySelector('.scene-2');
      return {
        scene1Inline: s1 ? s1.style.transform : null,
        scene2Inline: s2 ? s2.style.transform : null
      };
    });
  }

  // Get computed transforms (final rendered transform) for the two scenes
  async getComputedTransforms() {
    return await this.page.evaluate(() => {
      const s1 = document.querySelector('.scene-1');
      const s2 = document.querySelector('.scene-2');
      const cs1 = s1 ? getComputedStyle(s1).transform : null;
      const cs2 = s2 ? getComputedStyle(s2).transform : null;
      return { scene1Computed: cs1, scene2Computed: cs2 };
    });
  }

  // Check existence and basic accessibility of important elements
  async elementsExist() {
    return await this.page.evaluate(() => {
      return {
        button: !!document.querySelector('#switchScene'),
        scene1: !!document.querySelector('.scene-1'),
        scene2: !!document.querySelector('.scene-2')
      };
    });
  }

  // Try to read the sceneIndex variable and window.sceneIndex to demonstrate global binding behavior
  async readSceneIndexFacts() {
    return await this.page.evaluate(() => {
      let directValue;
      let directType;
      try {
        directValue = sceneIndex;
        directType = typeof sceneIndex;
      } catch (e) {
        directValue = { name: e.name, message: e.message };
        directType = 'thrown';
      }
      // window.sceneIndex may be undefined because top-level `let` does not attach to window
      const windowValue = window.sceneIndex === undefined ? 'undefined' : window.sceneIndex;
      return { directValue, directType, windowValue };
    });
  }
}

test.describe('FSM: Context Switching Visualization (ed8e8d01-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Collect console errors and page errors for assertions and diagnostics
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions
    page.on('pageerror', (err) => {
      // err is an Error object from the page
      pageErrors.push(err);
    });
  });

  test('Page loads and critical DOM elements are present', async ({ page }) => {
    // Validate page loads and required elements are present
    const scenes = new ScenesPage(page);
    await scenes.goto();

    // Elements should exist
    const exists = await scenes.elementsExist();
    expect(exists.button).toBeTruthy(); // the Switch Scene button should be in the DOM
    expect(exists.scene1).toBeTruthy(); // scene-1 present
    expect(exists.scene2).toBeTruthy(); // scene-2 present

    // No runtime errors should have been thrown during page load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Initial state inline styles: verify inline transforms are empty before any interactions', async ({ page }) => {
    // This validates the initial inline styles (element.style.transform) before any click.
    // Note: CSS stylesheet may set transforms (computed style), however inline style is empty initially.
    const scenes = new ScenesPage(page);
    await scenes.goto();

    const inline = await scenes.getInlineTransforms();
    // Because the initial transforms are set via CSS, element.style.transform should be empty strings
    expect(inline.scene1Inline).toBe(''); // no inline transform initially
    expect(inline.scene2Inline).toBe(''); // no inline transform initially

    // For additional verification, computed transforms SHOULD show the scene-2 translated off-screen per the stylesheet.
    const computed = await scenes.getComputedTransforms();
    // Computed transforms will be 'none' or a 'matrix(...)' string depending on the browser.
    // We assert that scene2 is not 'none' (it's expected to be translated to the right initially via CSS).
    expect(computed.scene2Computed === 'none' ? false : true).toBeTruthy();

    // Confirm no runtime errors during this step
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Switch Scene once triggers transition corresponding to FSM transition (S0 -> S1)', async ({ page }) => {
    // This test verifies that clicking the button sets the inline styles to the values the script assigns on the first click.
    const scenes = new ScenesPage(page);
    await scenes.goto();

    // Click the button to trigger the transition from initial sceneIndex 0 -> 1
    await scenes.clickSwitch();

    // Allow the script to run and set inline styles (no animation dependency for style update)
    await page.waitForTimeout(50);

    const inlineAfterClick = await scenes.getInlineTransforms();
    // According to the implementation's click handler, after the first click:
    // scene1.style.transform = 'translateX(-100%)';
    // scene2.style.transform = 'translateX(0)';
    expect(inlineAfterClick.scene1Inline).toBe('translateX(-100%)');
    expect(inlineAfterClick.scene2Inline).toBe('translateX(0)');

    // Validate that computed styles reflect a transform (non-'none')
    const computed = await scenes.getComputedTransforms();
    expect(computed.scene1Computed === 'none' ? false : true).toBeTruthy();
    expect(computed.scene2Computed === 'none' ? false : true).toBeTruthy();

    // Ensure no runtime errors were thrown during the click and transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Switch Scene again returns to the original scene (S1 -> S0)', async ({ page }) => {
    // This test clicks twice and ensures the second click sets inline transforms according to the implementation
    const scenes = new ScenesPage(page);
    await scenes.goto();

    // First click to go to scene 2 (sceneIndex 1)
    await scenes.clickSwitch();
    await page.waitForTimeout(50);

    // Second click to go back to scene 1 (sceneIndex 0)
    await scenes.clickSwitch();
    await page.waitForTimeout(50);

    const inlineAfterSecondClick = await scenes.getInlineTransforms();
    // According to the implementation's else block on second click:
    // scene1.style.transform = 'translateX(0)';
    // scene2.style.transform = 'translateX(100%)';
    expect(inlineAfterSecondClick.scene1Inline).toBe('translateX(0)');
    expect(inlineAfterSecondClick.scene2Inline).toBe('translateX(100%)');

    // No runtime errors expected during this toggling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid multiple clicks: verify the toggle behavior remains consistent under quick user interaction', async ({ page }) => {
    // Simulate rapid clicking and ensure toggling behavior is deterministic.
    const scenes = new ScenesPage(page);
    await scenes.goto();

    // Rapidly click five times
    for (let i = 0; i < 5; i++) {
      await scenes.clickSwitch();
      // small delay, shorter than the CSS transition, to simulate rapid user taps
      await page.waitForTimeout(20);
    }

    // After 5 clicks starting from index 0, the sceneIndex parity is odd -> expected state same as after 1 click:
    // scene1: translateX(-100%), scene2: translateX(0)
    const inline = await scenes.getInlineTransforms();
    expect(inline.scene1Inline).toBe('translateX(-100%)');
    expect(inline.scene2Inline).toBe('translateX(0)');

    // No runtime errors should arise from rapid clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Verify global binding behavior for sceneIndex (window.sceneIndex vs direct name)', async ({ page }) => {
    // This test demonstrates the difference between window-scoped properties and top-level lexical bindings.
    // The page script defines `let sceneIndex = 0;` at top level which in browsers does NOT create window.sceneIndex.
    const scenes = new ScenesPage(page);
    await scenes.goto();

    const facts = await scenes.readSceneIndexFacts();
    // Accessing `sceneIndex` directly from the page context should succeed and return a number (0 initially).
    // window.sceneIndex should be 'undefined' because let does not assign to window.
    expect(facts.directType === 'number').toBeTruthy();
    expect(facts.directValue).toBe(0);
    expect(facts.windowValue).toBe('undefined');

    // This check helps reveal potential unexpected ReferenceError if code attempted to access 'window.sceneIndex' exclusively.
    // No runtime errors should have been observed in the page error hooks.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence vs actual implementation: report mismatches (informational assertion)', async ({ page }) => {
    // The FSM provided evidence expects certain inline style values for initial state S0_Scene1:
    //   scene1.style.transform = 'translateX(-100%)'
    //   scene2.style.transform = 'translateX(0)'
    // The real application sets these inline transforms only after a click, and initial inline styles are empty.
    // This test asserts that mismatch so the test suite captures the difference between model and implementation.
    const scenes = new ScenesPage(page);
    await scenes.goto();

    const inline = await scenes.getInlineTransforms();

    const fsmExpectedInitial = { scene1Inline: 'translateX(-100%)', scene2Inline: 'translateX(0)' };
    const actualInitialMatchesFSM = inline.scene1Inline === fsmExpectedInitial.scene1Inline && inline.scene2Inline === fsmExpectedInitial.scene2Inline;

    // We expect a mismatch (actualInitialMatchesFSM === false)
    expect(actualInitialMatchesFSM).toBe(false);

    // Also assert that after clicking once, the actual inline styles match the FSM's S0->S1 transition evidence
    await scenes.clickSwitch();
    await page.waitForTimeout(50);
    const inlineAfterClick = await scenes.getInlineTransforms();
    expect(inlineAfterClick.scene1Inline).toBe('translateX(-100%)');
    expect(inlineAfterClick.scene2Inline).toBe('translateX(0)');

    // No runtime errors observed during these checks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.afterEach(async ({}, testInfo) => {
    // If there were runtime errors, surface them in the test failure message to help debugging.
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Append diagnostic information to the test output
      // Note: Using console.warn so it appears in Playwright output if present.
      // This does not mutate the page or patch behavior; it's purely observational.
      // The actual test assertions above already check for zero errors; this is for extra context if failures occur.
      // eslint-disable-next-line no-console
      console.warn(`Diagnostics for test "${testInfo.title}": pageErrors=${pageErrors.length}, consoleErrors=${consoleErrors.length}`);
      for (const err of pageErrors) {
        // eslint-disable-next-line no-console
        console.warn('Page error:', err && err.message ? err.message : String(err));
      }
      for (const ce of consoleErrors) {
        // eslint-disable-next-line no-console
        console.warn('Console error:', ce.text);
      }
    }
  });
});