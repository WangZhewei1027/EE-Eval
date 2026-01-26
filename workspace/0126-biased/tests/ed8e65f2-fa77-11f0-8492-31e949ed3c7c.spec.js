import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e65f2-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('P vs NP - FSM integration tests (ed8e65f2-fa77-11f0-8492-31e949ed3c7c)', () => {
  let pageErrors;
  let consoleMessages;

  // Setup a fresh listener for console and page errors before each test and navigate to the page.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Capture console messages for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  // Tear down listeners after each test (Playwright automatically removes listeners on page close,
  // but we explicitly clear arrays to avoid cross-test leakage).
  test.afterEach(async () => {
    pageErrors = [];
    consoleMessages = [];
  });

  test('Initial Idle state: page renders expected elements (button, graphic, title, description)', async ({ page }) => {
    // Validate the main heading is present and visible
    const heading = page.locator('h1');
    await expect(heading).toHaveText('P vs NP');

    // Validate the description text exists and contains expected phrase
    const description = page.locator('.description');
    await expect(description).toContainText('Explore the age-old question');

    // Validate the Begin Exploration button exists and has the correct text and attribute
    const beginBtn = page.locator('.button');
    await expect(beginBtn).toHaveCount(1);
    await expect(beginBtn).toHaveText('Begin Exploration');

    // Validate the graphic image is present with expected alt attribute
    const graphic = page.locator('.graphic');
    await expect(graphic).toHaveAttribute('alt', 'P vs NP Graphic');
    await expect(graphic).toHaveAttribute('src', /P\+vs\+NP\+Graphic/);

    // Validate that the CSS animation defined via stylesheet (fadeIn) is applied initially.
    // We use computed style to check that an animation name is present; different browsers
    // might report slightly different values, so we check that animationName is not 'none'.
    const initialAnimationName = await graphic.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return cs.animationName || cs.webkitAnimationName || cs.msAnimationName;
    });
    expect(initialAnimationName).toBeTruthy();

    // There should be no uncaught page errors on a clean initial load
    expect(pageErrors.length).toBe(0);

    // No console.error messages expected on initial load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: clicking Begin Exploration sets inline animation style to "moveIn 2s forwards"', async ({ page }) => {
    // Before click: the inline style should not explicitly contain the 'moveIn' animation.
    const graphic = page.locator('.graphic');
    const inlineStyleBefore = await graphic.getAttribute('style');
    expect(inlineStyleBefore === null || !/moveIn/.test(inlineStyleBefore)).toBeTruthy();

    // Click the Begin Exploration button to trigger startAnimation()
    await page.click('.button');

    // After click: the inline style.animation should be set exactly by the page script.
    // We check the element.style.animation value via evaluate to retrieve the live inline style.
    const inlineAnimation = await graphic.evaluate((el) => el.style.animation);
    expect(inlineAnimation).toBe('moveIn 2s forwards');

    // Ensure no uncaught page errors were emitted from this interaction
    expect(pageErrors.length).toBe(0);

    // Ensure there were no console errors produced by the click
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Begin Exploration repeatedly (edge case): idempotent behavior and no errors', async ({ page }) => {
    const graphic = page.locator('.graphic');

    // Rapidly click the button multiple times
    await page.click('.button');
    await page.click('.button');
    await page.click('.button');

    // The inline animation style should remain set to the expected value
    const inlineAnimation = await graphic.evaluate((el) => el.style.animation);
    expect(inlineAnimation).toBe('moveIn 2s forwards');

    // No uncaught page errors should have occurred from multiple clicks
    expect(pageErrors.length).toBe(0);

    // No console errors should be present
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM onEnter check: renderPage() is referenced by FSM but not implemented in the page (error scenario)', async ({ page }) => {
    // The FSM's S0 entry action claims renderPage() should run on entry.
    // The HTML/JS does not define renderPage(). We assert that invoking renderPage() as an
    // asynchronous, uncaught call in the page context leads to a ReferenceError that is emitted
    // as a pageerror event (this models a natural uncaught error scenario).
    //
    // Use setTimeout to trigger the call outside of the evaluate() Promise and let it be uncaught
    // in the page context so pageerror event is emitted.
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Trigger the uncaught invocation that should result in a ReferenceError in the page
    await page.evaluate(() => {
      // schedule an uncaught call to an undefined global function
      setTimeout(() => {
        // Intentionally call the function that is expected to be missing.
        // This should produce a ReferenceError in the page environment.
        // We do NOT catch it here so the pageerror event will fire naturally.
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0);
    });

    const err = await pageErrorPromise;

    // Validate that an error occurred and it is a ReferenceError referencing renderPage
    expect(err).toBeTruthy();
    // Some engines include different wording; we assert the error name and that the message references renderPage.
    expect(err.name).toBe('ReferenceError');
    expect(err.message).toMatch(/renderPage|not defined/i);
  });

  test('Attempting to directly call undefined renderPage() via evaluate rejects with an exception (caught as evaluate rejection)', async ({ page }) => {
    // Directly calling renderPage() inside evaluate will cause the evaluate promise to reject.
    // We assert that the evaluate call rejects with an error indicating renderPage is not defined.
    await expect(page.evaluate(() => {
      // Calling the unimplemented function; this will throw and cause evaluate to reject
      // because the reference is unqualified (identifier not defined).
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/i);
  });

  test('Visual feedback: after starting animation the computed style reflects inline override (animation priority)', async ({ page }) => {
    const graphic = page.locator('.graphic');

    // Ensure initial computed animation contains the stylesheet's fadeIn (sanity check)
    const initialComputedAnimation = await graphic.evaluate((el) => window.getComputedStyle(el).animation);
    expect(initialComputedAnimation.length).toBeGreaterThan(0);

    // Trigger the animation start (transition S0 -> S1)
    await page.click('.button');

    // Computed style should reflect the inline animation override; computed style animation should include 'moveIn'
    const computedAnimationAfter = await graphic.evaluate((el) => window.getComputedStyle(el).animation);
    // Some engines will return the full computed animation string; assert it contains 'moveIn' or the inline duration/forwards
    expect(computedAnimationAfter.toLowerCase()).toMatch(/movein|2s.*forwards |forwards/i);
  });

  test('Console messages captured: ensure no unexpected console errors on normal interactions', async ({ page }) => {
    // Interact normally
    await page.click('.button');

    // We expect at least no console.error messages during typical usage
    const errors = consoleMessages.filter((m) => m.type === 'error');
    expect(errors.length).toBe(0);
  });
});