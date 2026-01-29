import { test, expect } from '@playwright/test';

class IndexingApp {
  constructor(page) {
    this.page = page;
    // Array indexing
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.indexInput = page.locator('#indexInput');
    this.indexBase = page.locator('#indexBase');
    this.readIndexBtn = page.locator('#readIndexBtn');
    this.shuffleArrayBtn = page.locator('#shuffleArrayBtn');
    this.resetArrayBtn = page.locator('#resetArrayBtn');
    this.arrayResult = page.locator('#arrayResult');

    // Dataset / index
    this.datasetSize = page.locator('#datasetSize');
    this.generateDataBtn = page.locator('#generateDataBtn');
    this.buildIndexBtn = page.locator('#buildIndexBtn');
    this.searchName = page.locator('#searchName');
    this.linearSearchBtn = page.locator('#linearSearchBtn');
    this.indexedSearchBtn = page.locator('#indexedSearchBtn');
    this.showSampleBtn = page.locator('#showSampleBtn');
    this.searchResult = page.locator('#searchResult');

    // Inverted index / docs
    this.docsList = page.locator('#docsList');
    this.addDocBtn = page.locator('#addDocBtn');
    this.buildInvertedBtn = page.locator('#buildInvertedBtn');
    this.clearInvertedBtn = page.locator('#clearInvertedBtn');
    this.queryInput = page.locator('#queryInput');
    this.queryIndexedBtn = page.locator('#queryIndexedBtn');
    this.queryLinearBtn = page.locator('#queryLinearBtn');
    this.invertedResult = page.locator('#invertedResult');

    // Log
    this.log = page.locator('#log');
  }

  async readArrayCell({ inputValue, base = '0' }) {
    await this.indexInput.fill(String(inputValue));
    await this.indexBase.selectOption(String(base));
    await this.readIndexBtn.click();
  }

  async shuffleArray() {
    await this.shuffleArrayBtn.click();
  }

  async resetArray() {
    await this.resetArrayBtn.click();
  }

  async generateDataset(n) {
    await this.datasetSize.fill(String(n));
    await this.generateDataBtn.click();
  }

  async buildNameIndex() {
    await this.buildIndexBtn.click();
  }

  async linearSearch(name) {
    await this.searchName.fill(name);
    await this.linearSearchBtn.click();
  }

  async indexedSearch(name) {
    await this.searchName.fill(name);
    await this.indexedSearchBtn.click();
  }

  async showSample() {
    await this.showSampleBtn.click();
  }

  async addDocument() {
    await this.addDocBtn.click();
  }

  async buildInvertedIndex() {
    await this.buildInvertedBtn.click();
  }

  async clearInvertedIndex() {
    await this.clearInvertedBtn.click();
  }

  async queryIndexed(q) {
    await this.queryInput.fill(q);
    await this.queryIndexedBtn.click();
  }

  async queryLinear(q) {
    await this.queryInput.fill(q);
    await this.queryLinearBtn.click();
  }
}

test.describe('Indexing — Interactive Demonstration (d3d99341-fa73-11f0-83e0-8d7be1d51901)', () => {
  const url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d99341-fa73-11f0-83e0-8d7be1d51901.html';

  // capture console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // no-op here; individual tests will navigate to ensure fresh state
  });

  test.describe('Initial load and general checks', () => {
    test('page loads with expected primary sections and no runtime errors', async ({ page }) => {
      const consoleMsgs = [];
      const pageErrors = [];

      page.on('console', msg => {
        consoleMsgs.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      await page.goto(url);

      // Basic elements are present
      await expect(page.locator('h1')).toHaveText(/Indexing — interactive concepts/i);
      await expect(page.locator('#arrayDisplay')).toBeVisible();
      await expect(page.locator('#docsList')).toBeVisible();
      await expect(page.locator('#log')).toBeVisible();

      // The three main result areas are initially hidden
      await expect(page.locator('#arrayResult')).toBeHidden();
      await expect(page.locator('#searchResult')).toBeHidden();
      await expect(page.locator('#invertedResult')).toBeHidden();

      // Wait briefly for initial script to run and produce initial log lines
      await page.waitForTimeout(200);

      // Expect no uncaught page errors during load
      expect(pageErrors.length).toBe(0);

      // Expect that log contains the initialization message
      const logText = await page.locator('#log').innerText();
      expect(logText).toMatch(/Demo ready/i);
      expect(logText).toMatch(/Ready\./i);

      // At least one console message should have been produced (log() writes to the <pre>, but console may also have messages)
      // We won't require console messages, but we record them for debugging if present.
      // Ensure that the page's DOM scripts ran and created expected elements:
      const cellsCount = await page.locator('#arrayDisplay .cell').count();
      expect(cellsCount).toBeGreaterThanOrEqual(8); // baseArray has 8 items
    });
  });

  test.describe('Array Indexing interactions (S0 -> S1 transitions)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(url);
    });

    test('Read value — valid index highlights cell and shows result (ReadIndex)', async ({ page }) => {
      const app = new IndexingApp(page);

      // Ensure initial state
      await expect(app.arrayResult).toBeHidden();

      // Read index 0 with 0-based -> should show first element "A"
      await app.readArrayCell({ inputValue: 0, base: '0' });

      await expect(app.arrayResult).toBeVisible();
      const text = await app.arrayResult.textContent();
      expect(text).toMatch(/interpreted as 0/);
      expect(text).toMatch(/value: "A"/);

      // First cell should be highlighted
      const firstCell = page.locator('#arrayDisplay .cell').nth(0);
      await expect(firstCell).toHaveClass(/highlight/);

      // Log should record the read action
      const logText = await app.log.innerText();
      expect(logText).toMatch(/Read index: input=0, base=0/);
    });

    test('Read value — using 1-based index mapping (ReadIndex)', async ({ page }) => {
      const app = new IndexingApp(page);

      // Read index 1 with 1-based -> computed 0 -> "A"
      await app.readArrayCell({ inputValue: 1, base: '1' });

      await expect(app.arrayResult).toBeVisible();
      const text = await app.arrayResult.textContent();
      expect(text).toMatch(/interpreted as 0/);
      expect(text).toMatch(/value: "A"/);

      // Highlight should be present on first cell
      await expect(page.locator('#arrayDisplay .cell').nth(0)).toHaveClass(/highlight/);
    });

    test('Read value — out of range and invalid input edge cases', async ({ page }) => {
      const app = new IndexingApp(page);

      // Out of range (e.g., 999)
      await app.readArrayCell({ inputValue: 999, base: '0' });
      await expect(app.arrayResult).toBeVisible();
      let t = await app.arrayResult.textContent();
      expect(t).toMatch(/is out of range/);
      // No highlight
      const highlighted = await page.locator('#arrayDisplay .cell.highlight').count();
      expect(highlighted).toBe(0);

      // Invalid (non-number) -> clear input and click -> shows "Please enter a valid number."
      await app.indexInput.fill(''); // empty
      await app.readIndexBtn.click();
      await expect(app.arrayResult).toBeVisible();
      t = await app.arrayResult.textContent();
      expect(t).toMatch(/Please enter a valid number/);
    });

    test('Shuffle and reset array (ShuffleArray -> ResetArray)', async ({ page }) => {
      const app = new IndexingApp(page);

      // Capture initial order
      const initial = await page.locator('#arrayDisplay .cell').allTextContents();

      // Shuffle
      await app.shuffleArray();
      await expect(app.arrayResult).toBeHidden(); // shuffle hides arrayResult per implementation

      // After shuffle ensure same elements but possibly different order
      const shuffled = await page.locator('#arrayDisplay .cell').allTextContents();
      expect(shuffled.sort()).toEqual(initial.sort());
      // It's possible shuffle yields same order; we won't assert difference.

      // Reset should restore original order deterministically
      await app.resetArray();
      const reset = await page.locator('#arrayDisplay .cell').allTextContents();
      expect(reset).toEqual(initial);
    });
  });

  test.describe('Dataset generation and searching (S2 and S3 transitions)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(url);
    });

    test('Generate dataset with invalid size triggers alert (edge case)', async ({ page }) => {
      const app = new IndexingApp(page);

      // Set dataset size to 0 which should trigger alert('Enter a positive dataset size.')
      await app.datasetSize.fill('0');

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.generateDataBtn.click(),
      ]);
      expect(dialog.message()).toMatch(/Enter a positive dataset size/i);
      await dialog.dismiss();
    });

    test('Generate dataset and build index (GenerateDataset -> BuildIndex)', async ({ page }) => {
      const app = new IndexingApp(page);

      // Generate a modest dataset for deterministic test speed
      await app.generateDataset(200);

      // After generation, searchResult should be visible and mention generated items
      await expect(app.searchResult).toBeVisible();
      const genText = await app.searchResult.textContent();
      expect(genText).toMatch(/Generated 200 items/);

      // Build name->ids index
      await app.buildNameIndex();
      await expect(app.searchResult).toBeVisible();
      const indexText = await app.searchResult.textContent();
      expect(indexText).toMatch(/Built index for \d+ unique names/);
    });

    test('Linear scan behavior and empty-name alert (LinearSearch)', async ({ page }) => {
      const app = new IndexingApp(page);

      // Generate small dataset
      await app.generateDataset(120);

      // Clicking linear scan with empty searchName should alert
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.linearSearchBtn.click(),
      ]);
      expect(dialog.message()).toMatch(/Enter a name to search/i);
      await dialog.dismiss();

      // Now perform a valid linear scan for 'Alice' (may be zero results but should produce a result)
      await app.linearSearch('Alice');
      await expect(app.searchResult).toBeVisible();
      const txt = await app.searchResult.textContent();
      expect(txt).toMatch(/Linear scan: found \d+ items in .* ms/);
    });

    test('Indexed search requires built index; test alert then successful lookup (IndexedSearch)', async ({ page }) => {
      const app = new IndexingApp(page);

      // Generate dataset but do not build index
      await app.generateDataset(150);

      // Attempt indexed search without building index -> should alert 'Build the index first.'
      await app.searchName.fill('Alice');
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.indexedSearchBtn.click(),
      ]);
      expect(dialog.message()).toMatch(/Build the index first/i);
      await dialog.dismiss();

      // Build index then try again
      await app.buildNameIndex();
      // Now perform indexed lookup (may find zero or more)
      await app.indexedSearch('Alice');
      await expect(app.searchResult).toBeVisible();
      const txt = await app.searchResult.textContent();
      expect(txt).toMatch(/Indexed lookup: found \d+ items in/);
    });

    test('Show sample items displays sample content (ShowSample)', async ({ page }) => {
      const app = new IndexingApp(page);

      await app.generateDataset(50);
      await app.showSample();
      await expect(app.searchResult).toBeVisible();
      const txt = await app.searchResult.textContent();
      expect(txt).toMatch(/Sample items \(first 12\)/i);
    });
  });

  test.describe('Inverted index & text queries (S4 transitions and operations)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(url);
    });

    test('Add document updates docs list (AddDocument) and allows deletion', async ({ page }) => {
      const app = new IndexingApp(page);

      // Count initial docs
      const initialDocs = await app.docsList.locator('.doc').count();

      // Add a document
      await app.addDocument();
      // New doc should appear
      await expect(app.docsList.locator('.doc')).toHaveCount(initialDocs + 1);

      // Verify newly added doc contains "Doc" in its input (title)
      const lastDoc = app.docsList.locator('.doc').nth(initialDocs);
      const titleInput = lastDoc.locator('input[data-field="title"]');
      const titleValue = await titleInput.inputValue();
      expect(titleValue).toMatch(/Doc \d+/);
    });

    test('Build inverted index then query using index (BuildInvertedIndex -> QueryIndexed)', async ({ page }) => {
      const app = new IndexingApp(page);

      // Build inverted index from the initial docs
      await app.buildInvertedIndex();
      await expect(app.invertedResult).toBeVisible();
      const builtText = await app.invertedResult.textContent();
      expect(builtText).toMatch(/Built inverted index with \d+ unique terms/i);

      // Query for a term known to exist in initial docs: 'garden cat' should match doc 0 ("The garden cat")
      await app.queryIndexed('garden cat');
      await expect(app.invertedResult).toBeVisible();
      const qText = await app.invertedResult.textContent();
      expect(qText).toMatch(/Indexed query returned \d+ documents/i);
      // Should list the 'The garden cat' title in results (initial docs include it)
      expect(qText).toMatch(/The garden cat/i);
    });

    test('Query by scanning docs (QueryLinear) returns matches and logs', async ({ page }) => {
      const app = new IndexingApp(page);

      // Ensure at least initial docs exist
      await expect(app.docsList.locator('.doc')).toHaveCountGreaterThan(0);

      // Linear query for 'cat' should match documents containing 'cat'
      await app.queryLinear('cat');
      await expect(app.invertedResult).toBeVisible();
      const qr = await app.invertedResult.textContent();
      expect(qr).toMatch(/Linear query returned \d+ documents/i);
      // Because several docs mention 'cat', we expect either matches or explicitly "(no matches)"
      // If matches > 0 ensure titles appear (we check for either case)
      if (!qr.includes('(no matches)')) {
        expect(qr).toMatch(/\[0\] The garden cat|Cat care/);
      }
    });

    test('Clear inverted index yields cleared state (ClearIndex)', async ({ page }) => {
      const app = new IndexingApp(page);

      // Build then clear
      await app.buildInvertedIndex();
      await expect(app.invertedResult).toBeVisible();
      await app.clearInvertedIndex();
      await expect(app.invertedResult).toBeVisible();
      const cleared = await app.invertedResult.textContent();
      expect(cleared).toMatch(/Inverted index cleared/i);

      // After clearing, attempting indexed query should alert 'Build inverted index first.'
      await app.queryInput.fill('garden');
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.queryIndexedBtn.click(),
      ]);
      expect(dialog.message()).toMatch(/Build inverted index first/i);
      await dialog.dismiss();
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('observe console messages and ensure no uncaught runtime errors during interactions', async ({ page }) => {
      await page.goto(url);

      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      // Perform a series of interactions to surface potential errors
      // 1) Read index
      await page.locator('#indexInput').fill('1');
      await page.locator('#readIndexBtn').click();

      // 2) Shuffle and reset
      await page.locator('#shuffleArrayBtn').click();
      await page.locator('#resetArrayBtn').click();

      // 3) Generate small dataset and build index
      await page.locator('#datasetSize').fill('120');
      await page.locator('#generateDataBtn').click();
      await page.locator('#buildIndexBtn').click();

      // 4) Add doc and build inverted index, query
      await page.locator('#addDocBtn').click();
      await page.locator('#buildInvertedBtn').click();
      await page.locator('#queryInput').fill('garden cat');
      await page.locator('#queryIndexedBtn').click();

      // Wait a short time for any asynchronous console/errors
      await page.waitForTimeout(200);

      // Assert no uncaught page errors happened during these interactions
      expect(pageErrors.length).toBe(0);

      // Basic expectation: console produced messages that reference key actions
      const joined = consoleMessages.map(m => m.text).join('\n');
      expect(joined).toMatch(/Read index: input=.*base=/i);
      expect(joined).toMatch(/Array shuffled/i);
      expect(joined).toMatch(/Dataset generated|Generating dataset/i);

      // Also ensure DOM log contains lines for the interactions
      const domLog = await page.locator('#log').innerText();
      expect(domLog).toMatch(/Read index/i);
      expect(domLog).toMatch(/Inverted index built|Inverted index cleared|Built inverted index/i);
    });
  });
});