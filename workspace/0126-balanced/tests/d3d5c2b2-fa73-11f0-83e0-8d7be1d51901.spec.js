import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d5c2b2-fa73-11f0-83e0-8d7be1d51901.html';

class TriePage {
  /**
   * Page object encapsulating common operations and queries against the demo.
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      wordInput: '#wordInput',
      insertBtn: '#insertBtn',
      bulkInput: '#bulkInput',
      bulkBtn: '#bulkBtn',
      clearBtn: '#clearBtn',
      exampleBtn: '#exampleBtn',
      searchInput: '#searchInput',
      searchBtn: '#searchBtn',
      prefixBtn: '#prefixBtn',
      removeBtn: '#removeBtn',
      suggestList: '#suggestList',
      status: '#status',
      stats: '#stats',
      visualization: '#visualization',
      lastOp: '#lastOp',
      sampleChips: '.chip[data-sample]',
    };
  }

  async insertWord(word) {
    await this.page.fill(this.selectors.wordInput, word);
    await this.page.click(this.selectors.insertBtn);
  }

  async bulkInsert(text) {
    await this.page.fill(this.selectors.bulkInput, text);
    await this.page.click(this.selectors.bulkBtn);
  }

  async loadExamples() {
    await this.page.click(this.selectors.exampleBtn);
  }

  async clearTrieAndWaitForReload() {
    // Clicking clear triggers a setTimeout(location.reload(), 350) inside the app.
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'load', timeout: 5000 }),
      this.page.click(this.selectors.clearBtn),
    ]);
  }

  async searchExact(q) {
    await this.page.fill(this.selectors.searchInput, q);
    await this.page.click(this.selectors.searchBtn);
  }

  async checkPrefix(q) {
    await this.page.fill(this.selectors.searchInput, q);
    await this.page.click(this.selectors.prefixBtn);
  }

  async removeWordViaInputs(wordFrom = 'wordInput') {
    // 'removeBtn' uses either wordInput.value or searchInput.value
    if (wordFrom === 'wordInput') {
      await this.page.fill(this.selectors.wordInput, '');
      await this.page.fill(this.selectors.wordInput, this._escapeForFill(wordFrom)); // harmless, will be replaced
    }
    // Default behaviour: fill wordInput or searchInput before clicking
    // We'll allow callers to fill whichever they want before calling this method.
    await this.page.click(this.selectors.removeBtn);
  }

  async typeSearchInput(q) {
    await this.page.fill(this.selectors.searchInput, q);
    // input events are fired by fill
  }

  async clickSuggestion(text) {
    // suggestion buttons are created as .chip under #suggestList
    await this.page.click(`#suggestList >> text="${text}"`);
  }

  async clickSampleChipByIndex(idx = 0) {
    const chips = await this.page.$$(this.selectors.sampleChips);
    if (chips.length === 0) throw new Error('No sample chips found');
    await chips[idx].click();
  }

  async getStatusText() {
    return (await this.page.textContent(this.selectors.status)) || '';
  }

  async getLastOpText() {
    return (await this.page.textContent(this.selectors.lastOp)) || '';
  }

  async getStatsText() {
    return (await this.page.textContent(this.selectors.stats)) || '';
  }

  async getSuggestionTexts() {
    return await this.page.$$eval('#suggestList .chip, #suggestList .small', els => els.map(e => e.textContent.trim()));
  }

  async getVisualizationPaths() {
    // returns list of data-path attributes for nodes
    return await this.page.$$eval('#visualization [data-path]', els => els.map(e => e.getAttribute('data-path')));
  }

  async countVisualizationNodes() {
    return await this.page.$$eval('#visualization .trie-node', els => els.length);
  }

  _escapeForFill(s) {
    // trivial util to avoid passing undefined
    return s == null ? '' : String(s);
  }
}

test.describe('Trie (Prefix Tree) — Interactive Demo (FSM coverage)', () => {
  let page;
  let trie;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // create a fresh context/page for each test to isolate state
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // capture console errors and page errors to assert later
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      // collect uncaught exceptions
      pageErrors.push(err.message || String(err));
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    trie = new TriePage(page);
    // ensure page is fully rendered and initial rendering done
    await page.waitForSelector('#status');
    await page.waitForSelector('#visualization');
  });

  test.afterEach(async () => {
    // Assert that no unexpected runtime page errors (ReferenceError, SyntaxError, TypeError) occurred.
    // If any did occur, surface them so the test run shows the captured errors.
    expect(pageErrors, 'No uncaught page errors should occur during the test').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted during the test').toEqual([]);
    await page.close();
  });

  test('Initial state: Idle (S0_Idle) - status, stats and empty visualization', async () => {
    // Validate initial status and stats reflect idle state
    const status = await trie.getStatusText();
    expect(status).toContain('Status: idle');

    const stats = await trie.getStatsText();
    expect(stats).toMatch(/Nodes:\s*0\s*\|\s*Words:\s*0/);

    // Visualization initially renders the root (maybe an empty UL) and zero trie-node elements
    const nodeCount = await trie.countVisualizationNodes();
    expect(nodeCount).toBe(0);
  });

  test('Insert word (InsertWord event): transitions to WordInserted (S1) and updates DOM & stats', async () => {
    // Insert a single word
    await trie.insertWord('hello');

    // After insertion, status should indicate insertion and lastOp updated
    const status1 = await trie.getStatusText();
    expect(status).toContain('Inserted "hello"');

    const lastOp = await trie.getLastOpText();
    expect(lastOp).toContain('Inserted "hello"');

    // Stats should reflect at least 1 word and nodes > 0
    const stats1 = await trie.getStatsText();
    expect(stats).toMatch(/Words:\s*1/);
    expect(stats).toMatch(/Nodes:\s*\d+/);

    // Visualization should contain nodes along the path 'h','he','hel',...
    const paths = await trie.getVisualizationPaths();
    // Expect there is at least one path that starts with 'h'
    expect(paths.some(p => p.startsWith('h'))).toBeTruthy();

    // Edge case: clicking Insert with empty input should show helpful message and not change state
    await page.click('#insertBtn');
    const statusAfterEmpty = await trie.getStatusText();
    expect(statusAfterEmpty).toContain('Enter a non-empty word.');
  });

  test('Bulk insert (BulkInsertWords event) and subsequent transition back to Idle (S2 -> S0)', async () => {
    // Bulk insert words using commas and newlines
    await trie.bulkInsert('cat,dog,can\ncar');

    // Status should indicate number of words inserted
    const status2 = await trie.getStatusText();
    expect(status).toContain('Inserted 4 words');

    // Stats should reflect word count 4
    const stats2 = await trie.getStatsText();
    expect(stats).toMatch(/Words:\s*4/);

    // Bulk insert with empty input should show error message
    await page.click('#bulkBtn');
    const statusAfterEmpty1 = await trie.getStatusText();
    expect(statusAfterEmpty).toContain('Enter at least one word to bulk insert.');
  });

  test('Load example words (LoadExampleWords event) populates trie (S3_ExampleLoaded)', async () => {
    // Click load examples
    await trie.loadExamples();

    // Status should indicate examples loaded
    const status3 = await trie.getStatusText();
    expect(status).toContain('Loaded example words');

    // Stats should show words > 0
    const stats3 = await trie.getStatsText();
    const match = stats.match(/Words:\s*(\d+)/);
    expect(match).not.toBeNull();
    const words = Number(match[1]);
    expect(words).toBeGreaterThan(0);
  });

  test('Search exact (SearchExactWord event) for present and absent words (S5_Searching)', async () => {
    // Insert known words
    await trie.insertWord('apple');
    await trie.insertWord('app');

    // Searching exact present word
    await trie.searchExact('apple');
    let status4 = await trie.getStatusText();
    expect(status).toContain('"apple" is present (exact match)');

    // The path for 'apple' should have highlight class applied to node-labels
    const highlighted = await page.$$eval('#visualization .node-label.highlight', els => els.length);
    expect(highlighted).toBeGreaterThan(0);

    // Searching exact for absent word
    await trie.searchExact('applesauce');
    status = await trie.getStatusText();
    expect(status).toContain('"applesauce" not found');

    // Empty search should show guidance
    await page.fill('#searchInput', '');
    await page.click('#searchBtn');
    const statusEmpty = await trie.getStatusText();
    expect(statusEmpty).toContain('Enter a word to search');
  });

  test('Prefix check (CheckPrefix event) and input suggestion transition back to Idle (S6 -> S0)', async () => {
    // Use example sample to ensure prefixes exist
    await trie.insertWord('hero');
    await trie.insertWord('heritage');

    // Prefix that exists
    await trie.checkPrefix('he');
    let status5 = await trie.getStatusText();
    expect(status).toContain('There is at least one word starting with "he"');

    // prefix that does not exist
    await trie.checkPrefix('xyz');
    status = await trie.getStatusText();
    expect(status).toContain('No words start with "xyz"');

    // Typing into searchInput should update suggestions (InputSuggestion event)
    await trie.typeSearchInput('he');
    // wait for suggestions to render
    await page.waitForTimeout(50);
    const suggestions = await trie.getSuggestionTexts();
    // Since words starting with 'he' were inserted, we expect either chips or "No suggestions" text
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });

  test('Remove word (RemoveWord event) prunes trie and updates status (S4_WordRemoved)', async () => {
    // Insert then remove
    await trie.insertWord('toremove');
    // ensure present
    await trie.searchExact('toremove');
    let status6 = await trie.getStatusText();
    expect(status).toContain('"toremove" is present (exact match)');

    // remove by filling wordInput and clicking remove
    await page.fill('#wordInput', 'toremove');
    await page.click('#removeBtn');

    // After removal we should see removed message
    status = await trie.getStatusText();
    expect(status).toContain('Removed "toremove"');

    // Attempt to remove a non-existing word to exercise negative branch
    await page.fill('#wordInput', 'no-such-word');
    await page.click('#removeBtn');
    status = await trie.getStatusText();
    expect(status).toContain('Could not remove "no-such-word" — not found');

    // If both inputs empty removal should prompt user
    await page.fill('#wordInput', '');
    await page.fill('#searchInput', '');
    await page.click('#removeBtn');
    status = await trie.getStatusText();
    expect(status).toContain('Provide a word to remove in the Insert or Search input');
  });

  test('Live autocomplete suggestions (InputSuggestion event), selecting suggestion updates input and status', async () => {
    // Use sample insertion to have words
    await trie.bulkInsert('apple,apply,apt,ape,april');

    // Type prefix that will generate suggestions
    await trie.typeSearchInput('ap');
    // Allow UI to update suggestions
    await page.waitForTimeout(100);

    const suggestions1 = await trie.getSuggestionTexts();
    // check that suggestions contain words like 'app' or 'apple' etc, or "No suggestions" message
    expect(suggestions.length).toBeGreaterThanOrEqual(1);

    // If there is a chip suggestion, click the first chip and validate behavior
    const chips1 = await page.$$('#suggestList .chip');
    if (chips.length > 0) {
      const firstText = (await chips[0].textContent()).trim();
      await chips[0].click();
      // clicking a suggestion sets the searchInput to the selected value and updates status
      const searchVal = await page.inputValue('#searchInput');
      expect(searchVal).toBe(firstText);

      const status7 = await trie.getStatusText();
      expect(status).toContain(`Autocomplete selected "${firstText}"`);
    } else {
      // if no chips, ensure 'No suggestions' is present
      const txts = await trie.getSuggestionTexts();
      expect(txts.some(t => t.includes('No suggestions'))).toBeTruthy();
    }
  });

  test('Clicking sample chips inserts sample words and updates visualization & stats', async () => {
    // Click the first sample chip
    await trie.clickSampleChipByIndex(0);

    // After clicking a sample chip, status should mention inserted sample
    const status8 = await trie.getStatusText();
    expect(status).toContain('Inserted sample');

    // Stats should show words count increased
    const stats4 = await trie.getStatsText();
    expect(stats).toMatch(/Words:\s*\d+/);
  });

  test('Clear Trie (ClearTrie event) triggers page reload and resets to Idle (S7_Cleared -> S0_Idle)', async () => {
    // Insert some words to make a non-empty trie
    await trie.insertWord('toClear');
    const statsBefore = await trie.getStatsText();
    expect(statsBefore).toMatch(/Words:\s*\d+/);

    // Click clear and wait for reload
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 5000 }),
      page.click('#clearBtn'),
    ]);

    // After reload, initial idle state expected
    await page.waitForSelector('#status');
    const statusAfter = await page.textContent('#status');
    expect(statusAfter).toContain('Status: idle');

    const statsAfter = await page.textContent('#stats');
    expect(statsAfter).toMatch(/Nodes:\s*0\s*\|\s*Words:\s*0/);
  });

  test('Edge cases and validation messages for empty inputs across controls', async () => {
    // Insert empty
    await page.fill('#wordInput', '');
    await page.click('#insertBtn');
    expect(await trie.getStatusText()).toContain('Enter a non-empty word.');

    // Bulk empty
    await page.fill('#bulkInput', '');
    await page.click('#bulkBtn');
    expect(await trie.getStatusText()).toContain('Enter at least one word to bulk insert.');

    // Search empty
    await page.fill('#searchInput', '');
    await page.click('#searchBtn');
    expect(await trie.getStatusText()).toContain('Enter a word to search');

    // Prefix empty
    await page.fill('#searchInput', '');
    await page.click('#prefixBtn');
    expect(await trie.getStatusText()).toContain('Enter a prefix to check');

    // Remove empty
    await page.fill('#wordInput', '');
    await page.fill('#searchInput', '');
    await page.click('#removeBtn');
    expect(await trie.getStatusText()).toContain('Provide a word to remove in the Insert or Search input');
  });
});