import { test, expect } from '@playwright/test';

// Test file: de3ceb13-fa74-11f0-a1b6-4b9b8151441a.spec.js
// Application URL (served by the test environment):
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3ceb13-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for the Relational Database Demo page
class RelationalDbPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Table selectors
    this.usersTableBody = '#users-table tbody';
    this.productsTableBody = '#products-table tbody';
    this.ordersTableBody = '#orders-table tbody';
    // Buttons / result selectors
    this.joinButton = "button[onclick='runJoinQuery()']";
    this.aggregateButton = "button[onclick='runAggregateQuery()']";
    this.subqueryButton = "button[onclick='runSubquery()']";
    this.joinResults = '#join-query-results';
    this.aggregateResults = '#aggregate-query-results';
    this.subqueryResults = '#subquery-results';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure DOMContentLoaded handler executed and tables rendered
    await this.page.waitForSelector(this.usersTableBody + ' tr');
    await this.page.waitForSelector(this.productsTableBody + ' tr');
    await this.page.waitForSelector(this.ordersTableBody + ' tr');
  }

  async getTableRowCount(selector) {
    return await this.page.$$eval(selector + ' tr', rows => rows.length);
  }

  async getFirstRowCellsText(selector) {
    return await this.page.$$eval(selector + ' tr:first-child td', cells => cells.map(c => c.textContent));
  }

  async clickJoin() {
    await this.page.click(this.joinButton);
  }

  async clickAggregate() {
    await this.page.click(this.aggregateButton);
  }

  async clickSubquery() {
    await this.page.click(this.subqueryButton);
  }

  async getPreText(selector) {
    return await this.page.textContent(selector);
  }

  async parseResultsJsonFromPre(selector) {
    const text = await this.getPreText(selector);
    // The code prepends 'Results:\n' then JSON. We extract JSON substring between 'Results:\n' and '\n\nSQL equivalent:'
    if (!text) return null;
    const resultsIndex = text.indexOf('Results:\n');
    const sqlIndex = text.indexOf('\n\nSQL equivalent:');
    if (resultsIndex === -1) return null;
    const jsonStart = resultsIndex + 'Results:\n'.length;
    const jsonText = (sqlIndex === -1) ? text.substring(jsonStart).trim() : text.substring(jsonStart, sqlIndex).trim();
    // Trim any leading/trailing whitespace/newlines
    const firstBrace = jsonText.indexOf('{') === -1 && jsonText.indexOf('[') !== -1 ? jsonText.indexOf('[') : jsonText.indexOf('{');
    const jsonSub = jsonText.substring(firstBrace);
    try {
      return JSON.parse(jsonSub);
    } catch (e) {
      // Return null if parsing fails
      return null;
    }
  }
}

test.describe('Relational Database Demo (FSM: de3ceb13-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages (especially errors)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.describe('State S0_Idle - Initial page load and table display', () => {
    test('should load the page and render Users, Products and Orders tables (S0_Idle)', async ({ page }) => {
      // Arrange
      const app = new RelationalDbPage(page);

      // Act
      await app.goto();

      // Assert: table row counts match data in the HTML/JS implementation
      const usersCount = await app.getTableRowCount(app.usersTableBody);
      const productsCount = await app.getTableRowCount(app.productsTableBody);
      const ordersCount = await app.getTableRowCount(app.ordersTableBody);

      // The implementation defines 3 users, 3 products, 5 orders
      expect(usersCount).toBe(3);
      expect(productsCount).toBe(3);
      expect(ordersCount).toBe(5);

      // Check content of first row in users table for expected values
      const firstUserCells = await app.getFirstRowCellsText(app.usersTableBody);
      expect(firstUserCells).toEqual(expect.arrayContaining(['1', 'Alice Johnson', 'alice@example.com']));

      // Verify there were no runtime console errors or page errors during initial load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition Tests (S0 -> S1,S2,S3): Run queries and validate results', () => {
    test('Run Join Query (S0_Idle -> S1_JoinQueryExecuted) and validate output and SQL snippet', async ({ page }) => {
      // This test validates the RunJoinQuery event/transition: clicking the Join Query button
      const app1 = new RelationalDbPage(page);
      await app.goto();

      // Ensure join results pre is initially empty
      const initialJoinText = await app.getPreText(app.joinResults);
      expect(initialJoinText === '' || initialJoinText === null).toBeTruthy();

      // Act: click the join query button
      await app.clickJoin();

      // Wait briefly for textContent to update
      await page.waitForSelector(app.joinResults + ':not(:empty)');

      // Assert: Pre contains 'Results:' and SQL equivalent
      const joinPreText = await app.getPreText(app.joinResults);
      expect(joinPreText).toContain('Results:');
      expect(joinPreText).toContain('SQL equivalent:');
      expect(joinPreText).toContain('JOIN users u ON o.user_id = u.user_id');

      // Parse JSON results and validate structure and count (should match orders count = 5)
      const results = await app.parseResultsJsonFromPre(app.joinResults);
      expect(Array.isArray(results)).toBeTruthy();
      expect(results.length).toBe(5);

      // Validate keys exist on first result
      const keys = Object.keys(results[0]);
      expect(keys).toEqual(expect.arrayContaining(['order_id', 'user_name', 'product_name', 'quantity', 'total_price', 'order_date']));

      // Validate a specific known mapping: find order_id 1001 => user_name 'Alice Johnson', product_name 'Laptop'
      const order1001 = results.find(r => r.order_id === 1001);
      expect(order1001).toBeDefined();
      expect(order1001.user_name).toBe('Alice Johnson');
      expect(order1001.product_name).toBe('Laptop');

      // Validate no runtime errors occurred during the query execution
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Run Aggregate Query (S0_Idle -> S2_AggregateQueryExecuted) and verify totals per user', async ({ page }) => {
      // Validate the RunAggregateQuery event and expected observable 'aggregate-query-results'
      const app2 = new RelationalDbPage(page);
      await app.goto();

      // Act
      await app.clickAggregate();
      await page.waitForSelector(app.aggregateResults + ':not(:empty)');

      // Assert text contains expected SQL and header
      const aggText = await app.getPreText(app.aggregateResults);
      expect(aggText).toContain('Results:');
      expect(aggText).toContain('SQL equivalent:');
      expect(aggText).toContain('SUM(p.price * o.quantity) AS total_spent');

      // Parse JSON results array and validate totals
      const aggResults = await app.parseResultsJsonFromPre(app.aggregateResults);
      expect(Array.isArray(aggResults)).toBeTruthy();
      expect(aggResults.length).toBe(3);

      // Build a map for easier assertions
      const map = {};
      aggResults.forEach(item => {
        map[item.user_id] = item;
      });

      // Expected totals derived from the page's in-memory data:
      // user 1 => 999.99 + (149.99 * 2) = 999.99 + 299.98 = 1299.97
      // user 2 => 699.99 + (149.99 * 3) = 699.99 + 449.97 = 1149.96
      // user 3 => 999.99
      expect(map['1'].name).toBe('Alice Johnson');
      expect(map['1'].total_spent).toBe('1299.97');

      expect(map['2'].name).toBe('Bob Smith');
      expect(map['2'].total_spent).toBe('1149.96');

      expect(map['3'].name).toBe('Charlie Brown');
      expect(map['3'].total_spent).toBe('999.99');

      // Validate no console or page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Run Subquery (S0_Idle -> S3_SubqueryExecuted) and verify users with >1 orders', async ({ page }) => {
      // Validate the RunSubquery event and expected observable 'subquery-results'
      const app3 = new RelationalDbPage(page);
      await app.goto();

      // Act
      await app.clickSubquery();
      await page.waitForSelector(app.subqueryResults + ':not(:empty)');

      // Assert content includes SQL and header
      const subText = await app.getPreText(app.subqueryResults);
      expect(subText).toContain('Results:');
      expect(subText).toContain('SQL equivalent:');
      expect(subText).toContain('HAVING COUNT(o.order_id) > 1');

      // Parse results
      const subResults = await app.parseResultsJsonFromPre(app.subqueryResults);
      expect(Array.isArray(subResults)).toBeTruthy();

      // Only users with order_count > 1 should be present: user 1 and user 2
      const userIds = subResults.map(u => u.user_id);
      expect(userIds.sort()).toEqual(expect.arrayContaining(['1', '2']));
      // Ensure user 3 is not included
      expect(userIds).not.toContain('3');

      // Validate order_count values are correct (both 2)
      const map1 = {};
      subResults.forEach(u => (map[u.user_id] = u));
      expect(map['1'].order_count).toBe(2);
      expect(map['2'].order_count).toBe(2);

      // Validate no console or page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Run all queries sequentially and ensure each observable updates independently', async ({ page }) => {
      // This test clicks all three Run Query buttons in sequence and validates each pre is updated with distinct content
      const app4 = new RelationalDbPage(page);
      await app.goto();

      // Act: run join, aggregate, subquery in sequence
      await app.clickJoin();
      await page.waitForSelector(app.joinResults + ':not(:empty)');

      await app.clickAggregate();
      await page.waitForSelector(app.aggregateResults + ':not(:empty)');

      await app.clickSubquery();
      await page.waitForSelector(app.subqueryResults + ':not(:empty)');

      // Assert: each pre contains "Results:" and different JSON content (by comparing lengths)
      const joinText = await app.getPreText(app.joinResults);
      const aggText1 = await app.getPreText(app.aggregateResults);
      const subText1 = await app.getPreText(app.subqueryResults);

      expect(joinText).toContain('Results:');
      expect(aggText).toContain('Results:');
      expect(subText).toContain('Results:');

      // Expect that the textual contents are not all identical
      expect(joinText === aggText && aggText === subText).toBeFalsy();

      // Validate no console or page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking the same query multiple times should be idempotent (textContent replaced, not appended)', async ({ page }) => {
      // The implementation uses textContent to set results, so repeated clicks should not append content.
      const app5 = new RelationalDbPage(page);
      await app.goto();

      // Act: click join twice with a short pause
      await app.clickJoin();
      await page.waitForSelector(app.joinResults + ':not(:empty)');
      const first = await app.getPreText(app.joinResults);

      // Click again
      await app.clickJoin();
      await page.waitForTimeout(100); // small delay for the second update
      const second = await app.getPreText(app.joinResults);

      // They should be equal (replaced), not concatenated/appended
      expect(second).toBe(first);

      // Validate no console or page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Ensure invalid selectors or missing observables are reported properly (negative test)', async ({ page }) => {
      // This test intentionally queries an element that should NOT exist to verify the page does not accidentally expose unrelated elements.
      const app6 = new RelationalDbPage(page);
      await app.goto();

      // Attempt to locate a non-existent element
      const missingSelector = '#non-existent-element-for-testing';
      const handle = await page.$(missingSelector);
      expect(handle).toBeNull();

      // Also ensure named observables from FSM exist on the page
      // Observables: join-query-results, aggregate-query-results, subquery-results
      const joinExists = await page.$(app.joinResults);
      const aggExists = await page.$(app.aggregateResults);
      const subExists = await page.$(app.subqueryResults);

      expect(joinExists).not.toBeNull();
      expect(aggExists).not.toBeNull();
      expect(subExists).not.toBeNull();

      // Validate no console or page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Observe and assert that the page emits no unexpected runtime errors', async ({ page }) => {
      // This test is focused on observing console and page errors while loading and interacting with the page.
      const app7 = new RelationalDbPage(page);
      await app.goto();

      // Interact a bit: run all queries
      await app.clickJoin();
      await app.clickAggregate();
      await app.clickSubquery();

      // Small wait to ensure any asynchronous errors bubble up to pageerror/console handlers
      await page.waitForTimeout(200);

      // Assert there were no console error messages
      expect(consoleErrors.length).toBe(0);

      // Assert there were no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // If any errors had naturally occurred (ReferenceError, TypeError, etc.), the arrays above would contain entries,
      // and the assertions would fail. We intentionally do NOT patch or modify the page; we observe it as-is.
    });
  });
});