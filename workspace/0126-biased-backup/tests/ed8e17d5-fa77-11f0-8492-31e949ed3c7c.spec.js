import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e17d5-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Sliding Window Aesthetics - end-to-end', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Helper: returns the visible slide text content
  const getActiveSlideText = async (page) => {
    return page.locator('.slide.active .content').innerText();
  };

  // Helper: return number of active slides (should be 1)
  const countActiveSlides = async (page) => {
    return page.locator('.slide.active').count();
  };

  test.beforeEach(async ({ page }) => {
    // reset error collectors
    consoleErrors = [];
    pageErrors = [];

    // capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page (load exactly as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // For diagnostics, attach any console errors to the test output expectations.
    // Assert that there were no uncaught page errors or console error messages.
    // This verifies that the page loaded without runtime exceptions.
    expect(pageErrors, 'No uncaught exceptions should occur on the page').toEqual([]);
    expect(consoleErrors.length, 'No console.error logs should be emitted').toBe(0);

    // remove listeners to avoid cross-test leakage (Playwright cleans up automatically,
    // but explicit removal is good practice in more complex setups)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial state: Welcome slide is visible and DOM structure is correct', async ({ page }) => {
    // Validate initial active slide content corresponds to the Welcome slide (S0_Welcome)
    const activeText = await getActiveSlideText(page);
    expect(activeText).toContain('Welcome to the Sliding Window');

    // Ensure exactly one slide has the .active class
    const activeCount = await countActiveSlides(page);
    expect(activeCount).toBe(1);

    // Buttons are present and enabled
    await expect(page.locator('#nextBtn')).toBeVisible();
    await expect(page.locator('#prevBtn')).toBeVisible();

    // confirm that the showSlide function and currentIndex variable are present in the page context
    const hasShowSlide = await page.evaluate(() => typeof showSlide === 'function');
    expect(hasShowSlide).toBe(true);

    const currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(0);
  });

  test('Next button transitions through states: S0 -> S1 -> S2 -> S0', async ({ page }) => {
    // Comments: This test validates the NextSlide event handling and transitions described in the FSM.
    // S0 (Welcome) -> click Next -> S1 (Concepts)
    await page.click('#nextBtn');
    await expect(page.locator('.slide.active .content')).toHaveText('Visualize Concepts with Clarity');

    // Ensure currentIndex in page context matches expected index 1
    let currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(1);

    // S1 -> click Next -> S2 (Transitions)
    await page.click('#nextBtn');
    await expect(page.locator('.slide.active .content')).toHaveText('Experience Smooth Transitions');
    currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(2);

    // S2 -> click Next -> wraps to S0 (Welcome)
    await page.click('#nextBtn');
    await expect(page.locator('.slide.active .content')).toHaveText('Welcome to the Sliding Window');
    currentIndex = await page.evaluate(() => currentIndex);
    // modulo wrap-around expected index 0
    expect(currentIndex).toBe(0);

    // Only one slide should be active at any time
    const activeCount = await countActiveSlides(page);
    expect(activeCount).toBe(1);
  });

  test('Previous button transitions through states backward: S0 -> S2 -> S1 -> S0', async ({ page }) => {
    // Comments: This test validates the PreviousSlide event handling and wrap-around behavior.
    // Starting at S0 (Welcome)
    await expect(page.locator('.slide.active .content')).toHaveText('Welcome to the Sliding Window');

    // S0 -> click Previous -> should wrap to S2 (Transitions)
    await page.click('#prevBtn');
    await expect(page.locator('.slide.active .content')).toHaveText('Experience Smooth Transitions');
    let currentIndex = await page.evaluate(() => currentIndex);
    // index should be 2
    expect(currentIndex).toBe(2);

    // S2 -> click Previous -> S1 (Concepts)
    await page.click('#prevBtn');
    await expect(page.locator('.slide.active .content')).toHaveText('Visualize Concepts with Clarity');
    currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(1);

    // S1 -> click Previous -> S0 (Welcome)
    await page.click('#prevBtn');
    await expect(page.locator('.slide.active .content')).toHaveText('Welcome to the Sliding Window');
    currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(0);

    // Verify only single .active slide
    const activeCount = await countActiveSlides(page);
    expect(activeCount).toBe(1);
  });

  test('Combined navigation: Next then Previous returns to original state (S0 -> S1 -> S0)', async ({ page }) => {
    // Comments: verifies that a forward transition followed by a backward transition returns to the original state.
    await expect(page.locator('.slide.active .content')).toHaveText('Welcome to the Sliding Window');

    // Next to S1
    await page.click('#nextBtn');
    await expect(page.locator('.slide.active .content')).toHaveText('Visualize Concepts with Clarity');
    let currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(1);

    // Previous should return to S0
    await page.click('#prevBtn');
    await expect(page.locator('.slide.active .content')).toHaveText('Welcome to the Sliding Window');
    currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(0);
  });

  test('Edge case: rapid multiple Next clicks produce correct modulo behavior', async ({ page }) => {
    // Comments: simulate rapid user clicks to ensure modulo arithmetic in currentIndex remains consistent.
    // Starting at S0, perform 7 rapid next clicks. With 3 slides, 7 % 3 = 1 => expect S1
    for (let i = 0; i < 7; i++) {
      // Use click without awaiting transitions to simulate rapid clicking
      await page.click('#nextBtn');
    }

    // Expect the active slide to be index 1 (Concepts)
    await expect(page.locator('.slide.active .content')).toHaveText('Visualize Concepts with Clarity');
    const currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(1);

    // Confirm single active slide invariant
    const activeCount = await countActiveSlides(page);
    expect(activeCount).toBe(1);
  });

  test('Edge case: rapid multiple Previous clicks produce correct modulo behavior', async ({ page }) => {
    // Comments: Starting at S0, perform 5 rapid previous clicks. 5 % 3 = 2 backward steps -> index (0 - 5 mod 3) -> expected 1?
    // Compute expected: currentIndex = (0 - 5 + 3*some) % 3 => -5 mod 3 = 1 (since -5 + 6 = 1)
    for (let i = 0; i < 5; i++) {
      await page.click('#prevBtn');
    }

    await expect(page.locator('.slide.active .content')).toHaveText('Visualize Concepts with Clarity');
    const currentIndex = await page.evaluate(() => currentIndex);
    expect(currentIndex).toBe(1);

    const activeCount = await countActiveSlides(page);
    expect(activeCount).toBe(1);
  });

  test('DOM integrity: slides exist and content matches FSM state labels', async ({ page }) => {
    // Comments: verify that the three slides exist and their textual content match the FSM state descriptions.
    const slideContents = await page.locator('.slide .content').allTextContents();
    // Expect exactly 3 slides
    expect(slideContents.length).toBe(3);

    // Check content corresponds to the labeled states in the FSM
    expect(slideContents[0]).toContain('Welcome to the Sliding Window'); // S0_Welcome
    expect(slideContents[1]).toContain('Visualize Concepts with Clarity'); // S1_Concepts
    expect(slideContents[2]).toContain('Experience Smooth Transitions'); // S2_Transitions
  });

  test('Behavioral assertions: showSlide updates classes as onEnter/onExit would imply', async ({ page }) => {
    // Comments: While we cannot intercept internal function calls without modifying runtime,
    // we can assert that showSlide produces the observable effects expected as entry/exit actions:
    // - target slide gains .active; others lose .active.

    // Move to slide 2 (index 2)
    await page.click('#nextBtn'); // to 1
    await page.click('#nextBtn'); // to 2

    // Assert that only the third slide has .active
    const slides = page.locator('.slide');
    const counts = await Promise.all([
      slides.nth(0).getAttribute('class'),
      slides.nth(1).getAttribute('class'),
      slides.nth(2).getAttribute('class'),
    ]);

    expect(counts[0].includes('active')).toBe(false);
    expect(counts[1].includes('active')).toBe(false);
    expect(counts[2].includes('active')).toBe(true);

    // Now go previous to ensure active class moves to index 1
    await page.click('#prevBtn');
    const countsAfter = await Promise.all([
      slides.nth(0).getAttribute('class'),
      slides.nth(1).getAttribute('class'),
      slides.nth(2).getAttribute('class'),
    ]);

    expect(countsAfter[0].includes('active')).toBe(false);
    expect(countsAfter[1].includes('active')).toBe(true);
    expect(countsAfter[2].includes('active')).toBe(false);
  });

  test('Defensive check: buttons exist and have expected accessible names', async ({ page }) => {
    // Comments: ensures controls described in the FSM are present and labelled.
    const nextBtn = page.locator('#nextBtn');
    const prevBtn = page.locator('#prevBtn');

    await expect(nextBtn).toBeVisible();
    await expect(prevBtn).toBeVisible();

    // Check innerText labels match expected evidence
    expect(await nextBtn.innerText()).toBe('Next');
    expect(await prevBtn.innerText()).toBe('Previous');
  });
});