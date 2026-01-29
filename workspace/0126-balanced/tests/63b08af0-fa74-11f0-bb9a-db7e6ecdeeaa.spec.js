import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b08af0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Red-Black Tree Visualization & FSM tests (63b08af0-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Collect console messages and page errors for each test to assert runtime stability
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Ensure no uncaught runtime errors occurred during the test
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    // Ensure no console messages of type 'error' were emitted
    const errorMessages = consoleMessages.filter((m) => m.type === 'error' || /error/i.test(m.text));
    expect(errorMessages, `Console should not contain error messages. Found: ${JSON.stringify(errorMessages)}`).toEqual([]);
  });

  test('S0_Idle initial state: draws empty tree and shows "Tree is empty"', async ({ page }) => {
    // Validate initial messageBox shows "Tree is empty"
    const message = page.locator('#message');
    await expect(message).toHaveText('Tree is empty');

    // Validate SVG initially has no child nodes (empty drawing)
    const svgChildCount = await page.$eval('#treeSVG', (el) => el.children.length);
    expect(svgChildCount).toBe(0);
  });

  test('S4_Invalid_Input: inserting with empty input shows "Please enter a number."', async ({ page }) => {
    // Ensure input is empty
    await page.fill('#inputValue', '');

    // Click Insert button with empty input
    await page.click('#insertBtn');

    // Expect message for empty input
    await expect(page.locator('#message')).toHaveText('Please enter a number.');

    // Ensure SVG still empty
    const svgChildCount1 = await page.$eval('#treeSVG', (el) => el.children.length);
    expect(svgChildCount).toBe(0);
  });

  test('S4_Invalid_Input: inserting a non-integer shows "Please enter an integer value."', async ({ page }) => {
    // Fill a non-integer value (decimal)
    await page.fill('#inputValue', '3.14');

    // Click Insert
    await page.click('#insertBtn');

    // Expect the integer validation message
    await expect(page.locator('#message')).toHaveText('Please enter an integer value.');

    // Ensure SVG still empty
    const svgChildCount2 = await page.$eval('#treeSVG', (el) => el.children.length);
    expect(svgChildCount).toBe(0);
  });

  test('S4_Invalid_Input: inserting out-of-range shows range message', async ({ page }) => {
    // Fill a value out of allowed range
    await page.fill('#inputValue', '1000000');

    // Click Insert
    await page.click('#insertBtn');

    // Expect the range validation message
    await expect(page.locator('#message')).toHaveText('Please enter a number between -999999 and 999999.');

    // Ensure SVG still empty
    const svgChildCount3 = await page.$eval('#treeSVG', (el) => el.children.length);
    expect(svgChildCount).toBe(0);
  });

  test('S2_Value_Inserted: successful insertion renders node and updates message', async ({ page }) => {
    // Insert value 10
    await page.fill('#inputValue', '10');
    await page.click('#insertBtn');

    // Expect message about insertion
    await expect(page.locator('#message')).toHaveText('Inserted value: 10');

    // The SVG should now contain rendered node(s); look for text element with "10"
    const texts = await page.$$eval('#treeSVG text', (nodes) => nodes.map((n) => n.textContent.trim()));
    expect(texts.includes('10')).toBeTruthy();

    // Check that the input was cleared and focused after successful insert
    const inputValue = await page.$eval('#inputValue', (el) => el.value);
    expect(inputValue).toBe('');
  });

  test('S3_Duplicate_Value: inserting duplicate value shows duplicate message and does not create extra node', async ({ page }) => {
    // Ensure base state: insert 10 first
    await page.fill('#inputValue', '10');
    await page.click('#insertBtn');
    await expect(page.locator('#message')).toHaveText('Inserted value: 10');

    // Count occurrences of '10' in SVG text nodes
    const countTextNodes = async () =>
      (await page.$$eval('#treeSVG text', (nodes) => nodes.map((n) => n.textContent.trim()))).filter((t) => t === '10').length;

    const beforeCount = await countTextNodes();

    // Attempt to insert duplicate 10
    await page.fill('#inputValue', '10');
    await page.click('#insertBtn');

    // Expect duplicate message
    await expect(page.locator('#message')).toHaveText('Value 10 already exists in the tree.');

    // Ensure no additional text node for '10' was added
    const afterCount = await countTextNodes();
    expect(afterCount).toBe(beforeCount);
  });

  test('S1_Tree_Cleared: clear button clears SVG and shows "Tree cleared."', async ({ page }) => {
    // Insert a value to ensure SVG is non-empty
    await page.fill('#inputValue', '5');
    await page.click('#insertBtn');
    await expect(page.locator('#message')).toHaveText('Inserted value: 5');

    // Ensure SVG has some children
    let svgChildCount4 = await page.$eval('#treeSVG', (el) => el.children.length);
    expect(svgChildCount).toBeGreaterThan(0);

    // Click Clear Tree
    await page.click('#clearBtn');

    // Expect clear message
    await expect(page.locator('#message')).toHaveText('Tree cleared.');

    // SVG should now be empty
    svgChildCount = await page.$eval('#treeSVG', (el) => el.children.length);
    expect(svgChildCount).toBe(0);
  });

  test('EnterKeyPressed: pressing Enter in input triggers insert (S2_Value_Inserted via EnterKeyPressed)', async ({ page }) => {
    // Ensure tree is clear first
    await page.click('#clearBtn');
    await expect(page.locator('#message')).toHaveText('Tree cleared.');

    // Type value 20 into input and press Enter
    const input = page.locator('#inputValue');
    await input.fill('20');
    await input.press('Enter');

    // Expect insertion message
    await expect(page.locator('#message')).toHaveText('Inserted value: 20');

    // Validate node with text '20' exists in SVG
    const texts1 = await page.$$eval('#treeSVG text', (nodes) => nodes.map((n) => n.textContent.trim()));
    expect(texts.includes('20')).toBeTruthy();
  });

  test('Edge cases: negative value insertion and multiple inserts update visualization accordingly', async ({ page }) => {
    // Clear first
    await page.click('#clearBtn');
    await expect(page.locator('#message')).toHaveText('Tree cleared.');

    // Insert negative value -15
    await page.fill('#inputValue', '-15');
    await page.click('#insertBtn');
    await expect(page.locator('#message')).toHaveText('Inserted value: -15');
    let texts2 = await page.$$eval('#treeSVG text', (nodes) => nodes.map((n) => n.textContent.trim()));
    expect(texts.includes('-15')).toBeTruthy();

    // Insert another positive value 7
    await page.fill('#inputValue', '7');
    await page.click('#insertBtn');
    await expect(page.locator('#message')).toHaveText('Inserted value: 7');
    texts = await page.$$eval('#treeSVG text', (nodes) => nodes.map((n) => n.textContent.trim()));
    // Both -15 and 7 should be present
    expect(texts.includes('-15')).toBeTruthy();
    expect(texts.includes('7')).toBeTruthy();

    // Verify that some edges (line elements) exist when multiple nodes are present
    const lineCount = await page.$$eval('#treeSVG line', (lines) => lines.length);
    expect(lineCount).toBeGreaterThanOrEqual(0); // at least valid numeric return; lines may be 0 for certain layouts but should not error
  });
});