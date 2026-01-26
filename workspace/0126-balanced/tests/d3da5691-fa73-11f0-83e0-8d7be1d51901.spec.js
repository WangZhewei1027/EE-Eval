import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3da5691-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object to encapsulate interactions with the demo app
class BooksApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // inputs / buttons
    this.newTitle = page.locator('#newTitle');
    this.newAuthor = page.locator('#newAuthor');
    this.btnCreate = page.locator('#btnCreate');
    this.btnCreateSample = page.locator('#btnCreateSample');
    this.btnReset = page.locator('#btnReset');

    this.listMethod = page.locator('#listMethod');
    this.q = page.locator('#q');
    this.pageInput = page.locator('#page');
    this.limitInput = page.locator('#limit');
    this.btnList = page.locator('#btnList');

    this.singleId = page.locator('#singleId');
    this.btnGet = page.locator('#btnGet');
    this.btnDelete = page.locator('#btnDelete');

    this.updId = page.locator('#updId');
    this.updTitle = page.locator('#updTitle');
    this.updAuthor = page.locator('#updAuthor');
    this.btnPut = page.locator('#btnPut');
    this.btnPatch = page.locator('#btnPatch');

    this.btnClearLog = page.locator('#btnClearLog');
    this.errorMode = page.locator('#errorMode');

    this.dbView = page.locator('#dbView');
    this.log = page.locator('#log');
    this.lastResp = page.locator('#lastResp');
    this.latencyDisplay = page.locator('#latencyDisplay');

    // hidden latency input added by the app
    this.latencyInput = page.locator('#latencyInput');
  }

  async waitForInitialLoad() {
    // wait for dbView and an initial log entry inserted by the app's auto-list on init
    await this.page.waitForSelector('#dbView');
    await this.page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.children.length > 0;
    });
  }

  async readDBJSON() {
    const text = await this.dbView.innerText();
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  async readLogCount() {
    return await this.page.evaluate(() => document.getElementById('log')?.children.length || 0);
  }

  async readLastRespText() {
    return (await this.lastResp.innerText()).trim();
  }

  async createBook(title, author) {
    await this.newTitle.fill(title);
    await this.newAuthor.fill(author);
    await this.btnCreate.click();
    // wait for lastResp to reflect a response (requests are async with simulated latency)
    await this.page.waitForFunction(
      (expected) => document.getElementById('lastResp')?.innerText.includes(expected),
      {},
      'HTTP'
    );
  }

  async createSampleBook() {
    await this.btnCreateSample.click();
    await this.page.waitForFunction(() => document.getElementById('lastResp')?.innerText.includes('HTTP'));
  }

  async resetDB() {
    await this.btnReset.click();
    // reset clears log and lastResp
    await this.page.waitForFunction(() => {
      const log = document.getElementById('log');
      const last = document.getElementById('lastResp');
      return log && log.children.length === 0 && last && last.textContent.trim() === '';
    });
  }

  async listBooks({ q = '', page = 1, limit = 5 } = {}) {
    await this.q.fill(q);
    await this.pageInput.fill(String(page));
    await this.limitInput.fill(String(limit));
    await this.btnList.click();
    await this.page.waitForFunction(() => document.getElementById('lastResp')?.innerText.includes('HTTP'));
  }

  async getSingle(id) {
    await this.singleId.fill(String(id));
    await this.btnGet.click();
    await this.page.waitForFunction((i) => document.getElementById('lastResp')?.innerText.includes(`/books/${i}`), {}, String(id));
  }

  async deleteSingle(id, acceptDialog = true) {
    await this.singleId.fill(String(id));
    // handle confirm dialog that the app shows
    this.page.once('dialog', async dialog => {
      if (acceptDialog) await dialog.accept();
      else await dialog.dismiss();
    });
    await this.btnDelete.click();
    await this.page.waitForFunction(() => document.getElementById('lastResp')?.innerText.includes('HTTP') || document.getElementById('log')?.children.length === 0);
  }

  async putBook(id, title, author) {
    await this.updId.fill(String(id));
    await this.updTitle.fill(title);
    await this.updAuthor.fill(author);
    await this.btnPut.click();
    await this.page.waitForFunction(() => document.getElementById('lastResp')?.innerText.includes('HTTP'));
  }

  async patchBook(id, payload = {}) {
    await this.updId.fill(String(id));
    await this.updTitle.fill(payload.title || '');
    await this.updAuthor.fill(payload.author || '');
    await this.btnPatch.click();
    await this.page.waitForFunction(() => document.getElementById('lastResp')?.innerText.includes('HTTP'));
  }

  async clearLog() {
    await this.btnClearLog.click();
    await this.page.waitForFunction(() => document.getElementById('log')?.children.length === 0);
  }

  async setErrorMode(mode) {
    await this.errorMode.selectOption(mode);
    // ensure client.errorMode has been updated in UI
    await this.page.waitForFunction((m)=> document.getElementById('errorMode').value === m, {}, mode);
  }

  async getLatencyText() {
    return await this.latencyDisplay.innerText();
  }
}

test.describe('REST API Demo - FSM and UI E2E tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect page runtime errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Collect console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Sanity: ensure no unexpected runtime errors occurred in the page.
    // We assert this explicitly in a dedicated test below as well, but keep check here for debugging.
    // Do not modify page runtime; only observe.
  });

  test('Initial state (S0_Idle) - renderDB() executed and initial list request present', async ({ page }) => {
    const app = new BooksApp(page);
    // Wait until initial UI is ready and app performed the initial GET request
    await app.waitForInitialLoad();

    // The dbView should contain seeded titles as the InMemoryDB.reset() seeds the DB
    const dbJson = await app.readDBJSON();
    expect(dbJson).not.toBeNull();
    expect(Array.isArray(dbJson.books)).toBeTruthy();
    // Check for a known seeded title
    const titles = dbJson.books.map(b => b.title);
    expect(titles).toContain('REST in Practice');

    // The log should have at least one entry added by the app's initial GET
    const logCount = await app.readLogCount();
    expect(logCount).toBeGreaterThanOrEqual(1);

    // lastResp should include "HTTP 200" for the initial GET
    const last = await app.readLastRespText();
    expect(last).toContain('RESPONSE: HTTP 200');
  });

  test.describe('Create / Read / Update / Delete flows', () => {
    test('CreateBook (S1_BookCreated) - create a new book and verify DB & response', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      const before = await app.readDBJSON();
      const beforeCount = before.books.length;

      // Create a new book
      const title = 'The Test Book';
      const author = 'QA Tester';
      await app.createBook(title, author);

      // lastResp should show HTTP 201 and the created title
      const last = await app.readLastRespText();
      expect(last).toContain('RESPONSE: HTTP 201');
      expect(last).toContain(title);
      expect(last).toContain(author);

      // DB view should reflect the new book present (nextId incremented and book in array)
      const after = await app.readDBJSON();
      expect(after.books.length).toBeGreaterThan(beforeCount);
      const found = after.books.find(b => b.title === title && b.author === author);
      expect(found).toBeTruthy();
      expect(found.id).toBeGreaterThan(0);
    });

    test('CreateSampleBook (S1_BookCreated) - create a sample book and ensure DB grows', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      const before = await app.readDBJSON();
      await app.createSampleBook();

      const after = await app.readDBJSON();
      expect(after.books.length).toBeGreaterThan(before.books.length);

      // lastResp should contain HTTP 201
      const last = await app.readLastRespText();
      expect(last).toContain('RESPONSE: HTTP 201');
    });

    test('ListBooks (S2_BookListed) - query list endpoint and validate response meta', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      // search for 'REST' which should match seeded "REST in Practice"
      await app.listBooks({ q: 'REST', page: 1, limit: 5 });

      const last = await app.readLastRespText();
      // Expect HTTP 200 and meta object visible in response body
      expect(last).toContain('RESPONSE: HTTP 200');
      expect(last).toContain('"meta"');
      expect(last).toContain('"total"');
    });

    test('GetSingleBook (S3_SingleBookFetched) - fetch a single existing book by id', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      // pick the first book id from dbView
      const db = await app.readDBJSON();
      expect(db.books.length).toBeGreaterThan(0);
      const id = db.books[0].id;

      await app.getSingle(id);
      const last = await app.readLastRespText();
      expect(last).toContain(`REQUEST: GET /books/${id}`);
      expect(last).toContain('RESPONSE: HTTP 200');
      // Response body should include links.self
      expect(last).toContain('"links"');
      expect(last).toContain(`"/books/${id}"`);
    });

    test('UpdateBook (PUT - S4_BookUpdated) - replace an existing book', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      const db = await app.readDBJSON();
      const id = db.books[0].id;
      const newTitle = 'PUT Replaced Title';
      const newAuthor = 'PUT Author';

      await app.putBook(id, newTitle, newAuthor);

      const last = await app.readLastRespText();
      expect(last).toContain('RESPONSE: HTTP 200');
      expect(last).toContain(newTitle);
      expect(last).toContain(newAuthor);

      // Verify DB view updated for that id
      const after = await app.readDBJSON();
      const updated = after.books.find(b => b.id === id);
      expect(updated.title).toBe(newTitle);
      expect(updated.author).toBe(newAuthor);
    });

    test('PatchBook (PATCH - S4_BookUpdated) - partially update an existing book', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      const db = await app.readDBJSON();
      const id = db.books[0].id;
      const patchedTitle = 'Partially Patched Title';

      await app.patchBook(id, { title: patchedTitle });

      const last = await app.readLastRespText();
      expect(last).toContain('RESPONSE: HTTP 200');
      expect(last).toContain(patchedTitle);

      const after = await app.readDBJSON();
      const patched = after.books.find(b => b.id === id);
      expect(patched.title).toBe(patchedTitle);
    });

    test('DeleteBook (DELETE - S5_BookDeleted) - delete an existing book and verify 204', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      // create a temporary book to delete to avoid removing seeded ones
      await app.createBook('Temp to Delete', 'Temp Author');
      const dbAfterCreate = await app.readDBJSON();
      const temp = dbAfterCreate.books.find(b => b.title === 'Temp to Delete' && b.author === 'Temp Author');
      expect(temp).toBeTruthy();

      // delete the newly created book; the app shows a confirm() dialog - accept it
      await app.deleteSingle(temp.id, true);

      // lastResp for DELETE returns HTTP 204 or log may reflect it; verify DB no longer contains that id
      const after = await app.readDBJSON();
      const found = after.books.find(b => b.id === temp.id);
      expect(found).toBeUndefined();

      // Note: lastResp might show "HTTP 204" or earlier entries; ensure we at least have a recent response indicating deletion
      const last = await app.readLastRespText();
      // accept both 204 or 200 depending on impl; app uses 204 for successful DELETE
      expect(last).toContain('RESPONSE: HTTP 204');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('ResetDB event keeps app in Idle (S0_Idle) and clears UI state', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      // Add an entry to the log so reset will clear it
      await app.createSampleBook();
      let count = await app.readLogCount();
      expect(count).toBeGreaterThan(0);

      // Reset DB
      await app.resetDB();

      // DB should be reset to seeded state (contains seeded title)
      const db = await app.readDBJSON();
      const titles = db.books.map(b => b.title);
      expect(titles).toContain('REST in Practice');

      // Log should be cleared and lastResp empty
      expect(await app.readLogCount()).toBe(0);
      const last = await app.readLastRespText();
      expect(last).toBe('');
    });

    test('Validation error when creating without title with errorMode=validation returns HTTP 422', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      // Set server error mode to 'validation' so empty title causes 422
      await app.setErrorMode('validation');

      // Ensure title field is empty and click Create
      await app.newTitle.fill('');
      await app.newAuthor.fill('NoTitle Author');
      await app.btnCreate.click();

      // Wait for lastResp to be updated and then assert expected status 422
      await page.waitForFunction(() => document.getElementById('lastResp')?.innerText.includes('HTTP'));
      const last = await app.readLastRespText();
      expect(last).toContain('RESPONSE: HTTP 422');
      expect(last).toContain('Validation failed');
    });

    test('GET non-existent book returns 404', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      // Choose an obviously large id that won't exist
      const missingId = 99999;
      await app.getSingle(missingId);

      const last = await app.readLastRespText();
      expect(last).toContain('RESPONSE: HTTP 404');
      expect(last).toContain('Not Found');
    });

    test('PATCH with no fields triggers alert and does not send request (UI validation)', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      // Fill an id but leave other fields empty. The code shows alert('Fill at least one field to PATCH') and returns.
      const db = await app.readDBJSON();
      const id = db.books[0].id;
      await app.updId.fill(String(id));
      await app.updTitle.fill('');
      await app.updAuthor.fill('');

      // Listen for dialog (alert). The app triggers alert and exits without making a request.
      let sawAlert = false;
      page.once('dialog', async dialog => {
        sawAlert = true;
        await dialog.accept();
      });

      await app.btnPatch.click();

      // Give a small moment for possible requests (if any). There should be no new log entry.
      await page.waitForTimeout(300);
      expect(sawAlert).toBeTruthy();

      // Last response should be unchanged or not reflect a PATCH result; ensure the most recent response does not contain 'PATCH'
      const last = await app.readLastRespText();
      expect(last).not.toContain('PATCH (partial)'); // lastResp is a generic display; ensure no 'PATCH' marker exists
    });

    test('Clear log button empties the request log area', async ({ page }) => {
      const app = new BooksApp(page);
      await app.waitForInitialLoad();

      // Ensure there is at least one log entry
      await app.createSampleBook();
      const before = await app.readLogCount();
      expect(before).toBeGreaterThan(0);

      // Clear log
      await app.clearLog();
      const after = await app.readLogCount();
      expect(after).toBe(0);
    });
  });

  test('UI & runtime observations - no unexpected runtime ReferenceError/SyntaxError/TypeError', async ({ page }) => {
    // This test explicitly asserts that the page did not emit unhandled runtime errors.
    // We collected pageErrors and consoleErrors in beforeEach via event listeners.
    // Because the app is loaded as-is and may log messages, we only fail if actual runtime errors were raised.
    // Give a short grace period to capture any async runtime errors triggered during tests
    await page.waitForTimeout(200);

    // Assert that no page-level errors (unhandled exceptions) occurred
    expect(pageErrors.length).toBe(0, `Expected no runtime page errors but got: ${pageErrors.map(e => e.message).join(' | ')}`);

    // Assert that no console.error messages were emitted (this helps catch thrown errors logged to console)
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages but got: ${consoleErrors.join(' | ')}`);
  });

  test('Sanity: exercise latency control element exists and is displayed in UI', async ({ page }) => {
    const app = new BooksApp(page);
    await app.waitForInitialLoad();
    const latencyText = await app.getLatencyText();
    // The app sets latencyDisplay to "300ms" initially
    expect(latencyText).toMatch(/\d+ms/);
  });

});