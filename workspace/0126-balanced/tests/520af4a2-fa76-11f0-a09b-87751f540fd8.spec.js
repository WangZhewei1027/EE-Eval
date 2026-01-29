import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520af4a2-fa76-11f0-a09b-87751f540fd8.html';

test.describe('520af4a2-fa76-11f0-a09b-87751f540fd8 - Version Control FSM', () => {
  let pageErrors;

  // Helper to detect the characteristic runtime error caused by missing #fileContent
  const hasFileContentError = (errors) => {
    if (!errors || errors.length === 0) return false;
    return errors.some(e => {
      const msg = typeof e.message === 'string' ? e.message : String(e);
      // Match common variants of the "reading value of null" TypeError and references to fileContent
      return /fileContent|Cannot read properties of null|Cannot read property 'value'|reading 'value'|reading "value"/i.test(msg);
    });
  };

  test.beforeEach(async ({ page }) => {
    // collect page errors for assertions
    pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      // keep console messages available in the event they are useful for debugging tests
      // Not storing them explicitly, but they will appear in test output when running with verbose logging
    });

    // Navigate to the page under test. The page has a runtime script that attempts to access
    // #fileContent on load which is intentionally missing. This will throw a runtime error
    // and we must observe and assert that error occurs (per instructions).
    await page.goto(APP_URL, { waitUntil: 'load' });
    // allow any synchronous errors emitted during load to be delivered to the pageerror handler
    await page.waitForTimeout(50);
  });

  test('Initial page load should render main UI elements and emit runtime error due to missing #fileContent', async ({ page }) => {
    // Validate presence of UI elements described by the FSM (entry state evidence / renderPage())
    await expect(page.locator('#versionControl')).toBeVisible();
    await expect(page.locator('#addFile')).toHaveText('Add File');
    await expect(page.locator('#commitChanges')).toHaveText('Commit Changes');
    await expect(page.locator('#pullChanges')).toHaveText('Pull Changes');
    await expect(page.locator('#listChanges')).toHaveText('List Changes');

    // The implementation attempts to access document.getElementById('fileContent').value during script execution.
    // That element does not exist in the HTML; assert that at least one page error occurred and it matches the pattern.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(hasFileContentError(pageErrors)).toBe(true);
  });

  test('Add File: when prompts are accepted, a new file node is appended to the version control area', async ({ page }) => {
    // Count pre-existing appended file-like nodes (those created dynamically have background: lightgray style)
    const preCount = await page.locator('#versionControl div').filter({ hasNot: page.locator('#versionControl h1') }).count().catch(() => 0);

    // Prepare to handle the two sequential prompts: first for filename, second for file content
    const prompts = ['myfile.txt', 'Content from Add File'];
    let promptIndex = 0;
    page.on('dialog', async dialog => {
      // Accept both prompts in sequence
      await dialog.accept(prompts[promptIndex++] ?? '');
    });

    // Perform the Add File click
    await page.click('#addFile');

    // Give the DOM time to update
    await page.waitForTimeout(100);

    // Verify a new element containing the provided file content was appended
    const added = page.locator('#versionControl').locator('div', { hasText: 'Content from Add File' });
    await expect(added).toHaveCount(1);

    // Ensure that the number of dynamically appended divs increased by one
    const postCount = await page.locator('#versionControl div').filter({ hasNot: page.locator('#versionControl h1') }).count().catch(() => 0);
    expect(postCount).toBeGreaterThan(preCount);

    // Clicking Add File should not emit additional TypeError related to missing #fileContent (this handler uses prompt only).
    // We assert that at least no new errors containing fileContent were recorded after initial load.
    // (There may already be initial load errors captured in pageErrors.)
    await page.waitForTimeout(50);
    expect(hasFileContentError(pageErrors)).toBe(true); // initial error remains true
    // But ensure there are not many new errors beyond initial load (sanity check)
    expect(pageErrors.length).toBeLessThanOrEqual(5);
  });

  test('Add File: canceling the first prompt should NOT append a file', async ({ page }) => {
    // Count current appended file-like nodes
    const preLocator = page.locator('#versionControl').locator('div');
    const preCount1 = await preLocator.count();

    // When the first prompt is shown, dismiss it (cancel the file name prompt)
    page.once('dialog', async dialog => {
      await dialog.dismiss();
    });

    // Click Add File and wait
    await page.click('#addFile');
    await page.waitForTimeout(100);

    // Confirm no new file-like node containing content was appended
    const postCount1 = await page.locator('#versionControl').locator('div').count();
    expect(postCount).toBe(preCount);
  });

  test('Commit Changes: clicking commit should throw runtime error because #fileContent is missing', async ({ page }) => {
    // Capture current appended files count to ensure no new file gets appended due to the runtime error
    const preCount2 = await page.locator('#versionControl').locator('div').count();

    // Trigger the click and wait for the next pageerror caused by the handler attempting to read .value of null
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#commitChanges'),
    ]);

    // Validate that the error is consistent with missing fileContent element
    expect(error).toBeTruthy();
    const msg1 = typeof error.message === 'string' ? error.message : String(error);
    expect(/fileContent|Cannot read properties of null|Cannot read property 'value'|reading 'value'|reading "value"/i.test(msg)).toBe(true);

    // Confirm that no new file node was appended as the handler failed before creating new elements
    await page.waitForTimeout(50);
    const postCount2 = await page.locator('#versionControl').locator('div').count();
    expect(postCount).toBe(preCount);
  });

  test('Pull Changes: clicking pull should throw runtime error because #fileContent is missing', async ({ page }) => {
    const preCount3 = await page.locator('#versionControl').locator('div').count();

    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#pullChanges'),
    ]);

    expect(error).toBeTruthy();
    const msg2 = typeof error.message === 'string' ? error.message : String(error);
    expect(/fileContent|Cannot read properties of null|Cannot read property 'value'|reading 'value'|reading "value"/i.test(msg)).toBe(true);

    await page.waitForTimeout(50);
    const postCount3 = await page.locator('#versionControl').locator('div').count();
    expect(postCount).toBe(preCount);
  });

  test('List Changes: clicking list should throw runtime error because #fileContent is missing', async ({ page }) => {
    const preCount4 = await page.locator('#versionControl').locator('div').count();

    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#listChanges'),
    ]);

    expect(error).toBeTruthy();
    const msg3 = typeof error.message === 'string' ? error.message : String(error);
    expect(/fileContent|Cannot read properties of null|Cannot read property 'value'|reading 'value'|reading "value"/i.test(msg)).toBe(true);

    await page.waitForTimeout(50);
    const postCount4 = await page.locator('#versionControl').locator('div').count();
    expect(postCount).toBe(preCount);
  });

  test('Edge case: clicking Add File then dismissing second prompt should not append a file', async ({ page }) => {
    // Ensure the starting count
    const preCount5 = await page.locator('#versionControl').locator('div').count();

    // Accept first prompt (filename) but dismiss second (file content)
    let dialogCount = 0;
    page.on('dialog', async dlg => {
      dialogCount++;
      if (dialogCount === 1) {
        // accept filename
        await dlg.accept('edge.txt');
      } else {
        // cancel file content prompt -> should prevent append
        await dlg.dismiss();
      }
    });

    await page.click('#addFile');
    await page.waitForTimeout(100);

    const postCount5 = await page.locator('#versionControl').locator('div').count();
    expect(postCount).toBe(preCount);
  });

  test('Sanity: the FSM initial state (Idle) evidence elements are interactable', async ({ page }) => {
    // This test asserts UI interactivity of the initial state (buttons exist and are enabled).
    const addBtn = page.locator('#addFile');
    const commitBtn = page.locator('#commitChanges');
    const pullBtn = page.locator('#pullChanges');
    const listBtn = page.locator('#listChanges');

    await expect(addBtn).toBeVisible();
    await expect(addBtn).toBeEnabled();
    await expect(commitBtn).toBeVisible();
    await expect(commitBtn).toBeEnabled();
    await expect(pullBtn).toBeVisible();
    await expect(pullBtn).toBeEnabled();
    await expect(listBtn).toBeVisible();
    await expect(listBtn).toBeEnabled();
  });
});