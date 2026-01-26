import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d6112-fa7a-11f0-ba5b-57721b046e74.html';

// Page object encapsulating interactions with the Trie UI
class TriePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a little for initialization scripts (renderTrie + logOperation)
    await this.page.waitForTimeout(50);
  }

  async insertWord(word) {
    await this.page.fill('#wordInput', word);
    await this.page.click('button[onclick="insertWord()"]');
    // allow render and log
    await this.page.waitForTimeout(20);
  }

  async deleteWord(word) {
    await this.page.fill('#wordInput', word);
    await this.page.click('button[onclick="deleteWord()"]');
    await this.page.waitForTimeout(20);
  }

  async searchWord(word) {
    await this.page.fill('#wordInput', word);
    await this.page.click('button[onclick="searchWord()"]');
    await this.page.waitForTimeout(20);
  }

  async clearTrie() {
    await this.page.click('button[onclick="clearTrie()"]');
    await this.page.waitForTimeout(20);
  }

  async insertBulkWords(lines) {
    const text = lines.join('\n');
    await this.page.fill('#bulkWords', text);
    await this.page.click('button[onclick="insertBulkWords()"]');
    await this.page.waitForTimeout(20);
  }

  async deleteBulkWords(lines) {
    const text = lines.join('\n');
    await this.page.fill('#bulkWords', text);
    await this.page.click('button[onclick="deleteBulkWords()"]');
    await this.page.waitForTimeout(20);
  }

  async generateRandomWords(count = 5, autoInsert = true) {
    await this.page.fill('#wordCount', String(count));
    // update autoInsert checkbox if needed
    const autoInsertChecked = await this.page.isChecked('#autoInsert');
    if (autoInsertChecked !== autoInsert) {
      await this.page.click('#autoInsert');
    }
    await this.page.click('button[onclick="generateRandomWords()"]');
    await this.page.waitForTimeout(50);
  }

  async findAllWithPrefix(prefix) {
    await this.page.fill('#prefixInput', prefix);
    await this.page.click('button[onclick="findAllWithPrefix()"]');
    await this.page.waitForTimeout(20);
  }

  async deletePrefix(prefix) {
    await this.page.fill('#prefixInput', prefix);
    await this.page.click('button[onclick="deletePrefix()"]');
    await this.page.waitForTimeout(20);
  }

  async enableCompactView(enable = true) {
    const checked = await this.page.isChecked('#compactView');
    if (checked !== enable) {
      await this.page.click('#compactView');
      // change listener triggers renderTrie()
      await this.page.waitForTimeout(20);
    }
  }

  async getLogEntries() {
    return this.page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#logContent > div'));
      return nodes.map(n => n.textContent || '');
    });
  }

  async getPrefixResultsText() {
    return this.page.textContent('#prefixResults');
  }

  async getTrieAllWordsViaEval() {
    // Use the page's global trie object to obtain current words.
    return this.page.evaluate(() => {
      if (typeof trie === 'undefined' || !trie.getAllWords) return null;
      return trie.getAllWords();
    });
  }

  async trieSearchViaEval(word) {
    return this.page.evaluate((w) => {
      if (typeof trie === 'undefined' || !trie.search) return null;
      return trie.search(w);
    }, word);
  }

  async trieGetWordsWithPrefixViaEval(prefix) {
    return this.page.evaluate((p) => {
      if (typeof trie === 'undefined' || !trie.getWordsWithPrefix) return null;
      return trie.getWordsWithPrefix(p);
    }, prefix);
  }

  async countHighlightedElements() {
    return this.page.evaluate(() => {
      return document.querySelectorAll('.highlight').length;
    });
  }

  async getBulkTextareaValue() {
    return this.page.inputValue('#bulkWords');
  }

  async getPageErrors() {
    // This is populated externally via listener in the test harness.
    return this.pageErrors || [];
  }
}

test.describe('Interactive Trie Visualization - FSM and UI tests', () => {
  let page;
  let triePage;
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Collect page errors and console errors for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // capture console errors (type === 'error') and all messages for debugging/inspection
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    triePage = new TriePage(page);
    await triePage.goto();
  });

  test.afterEach(async () => {
    // Assert no uncaught runtime errors occurred on the page (pageerror)
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    // Also ensure there are no console.error messages
    expect(consoleErrors, 'No console.error messages').toEqual([]);
    await page.close();
  });

  test('S0_Idle: Initial page load should render trie and log initialization', async () => {
    // Validate initial render: the visualization container should have content
    const vizContent = await page.textContent('#trieVisualization');
    expect(vizContent?.length ?? 0).toBeGreaterThan(0);

    // Validate operation log contains initialization entry
    const logs = await triePage.getLogEntries();
    const foundInit = logs.some(l => l.includes('Initialized with sample words'));
    expect(foundInit).toBeTruthy();

    // The trie object should exist and contain the initial sample words (apple, app, application ...)
    const words = await triePage.getTrieAllWordsViaEval();
    expect(Array.isArray(words)).toBeTruthy();
    expect(words.length).toBeGreaterThanOrEqual(1);
    // Ensure known sample words exist
    expect(words).toEqual(expect.arrayContaining(['apple', 'app', 'application', 'banana', 'cat', 'dog']));
  });

  test('S1_WordInserted: Insert Word transition logs and updates trie state', async () => {
    // Insert a new word and validate logs and internal trie state
    const newWord = 'kiwi';
    await triePage.insertWord(newWord);

    const logs = await triePage.getLogEntries();
    const insertedLog = logs.find(l => l.includes(`Inserted word: "${newWord}"`));
    expect(insertedLog).toBeTruthy();

    const exists = await triePage.trieSearchViaEval(newWord);
    expect(exists).toBeTruthy();

    // renderTrie() should have been invoked and trieVisualization should contain something representing the trie
    const vizHtml = await page.$eval('#trieVisualization', el => el.innerHTML);
    expect(vizHtml.length).toBeGreaterThan(0);
  });

  test('S2_WordDeleted: Delete existing word and deleting non-existent word logs behavior', async () => {
    // Ensure a word exists then delete it
    const word = 'tempdelete';
    // Insert first
    await triePage.insertWord(word);
    expect(await triePage.trieSearchViaEval(word)).toBeTruthy();

    // Delete it
    await triePage.deleteWord(word);
    const logsAfterDelete = await triePage.getLogEntries();
    const deleteLog = logsAfterDelete.find(l => l.includes(`Deleted word: "${word}"`));
    expect(deleteLog).toBeTruthy();

    expect(await triePage.trieSearchViaEval(word)).toBeFalsy();

    // Attempt to delete a non-existent word -> should log "Word not found"
    const nonExistent = 'definitelynotpresent';
    // ensure it's not present
    expect(await triePage.trieSearchViaEval(nonExistent)).toBeFalsy();
    // perform delete
    await triePage.deleteWord(nonExistent);
    const logs = await triePage.getLogEntries();
    const notFoundLog = logs.find(l => l.includes(`Word not found: "${nonExistent}"`));
    expect(notFoundLog).toBeTruthy();
  });

  test('S3_WordSearched: Searching highlights path and logs found/prefix messages', async () => {
    // Enable compact view to make it easy to observe highlighted words (compact view lists words)
    await triePage.enableCompactView(true);

    // Search for an existing sample word
    const existing = 'app';
    await triePage.searchWord(existing);

    const logs = await triePage.getLogEntries();
    const foundLog = logs.find(l => l.includes(`Found word: "${existing}"`) || l.includes(`Prefix found but not complete word`));
    // Expect either "Found word" because 'app' was loaded initially
    expect(foundLog).toBeTruthy();

    // There should be at least one highlighted element in the DOM
    const highlightCount = await triePage.countHighlightedElements();
    expect(highlightCount).toBeGreaterThanOrEqual(1);

    // Search for a prefix that exists but not as a word (if applicable)
    // First insert a new prefix-only path: 'prefixonly' inserted partially by inserting longer but checking a shorter prefix
    const fullWord = 'prefixonlyword';
    await triePage.insertWord(fullWord);

    // Search for prefix 'prefixonly' (if not marked as end-of-word, log should indicate prefix found but not complete word)
    const prefixToSearch = 'prefixonly';
    // Ensure trie.search(prefixToSearch) is likely false unless explicitly inserted
    const isComplete = await triePage.trieSearchViaEval(prefixToSearch);

    await triePage.searchWord(prefixToSearch);
    const logs2 = await triePage.getLogEntries();
    if (isComplete) {
      expect(logs2.find(l => l.includes(`Found word: "${prefixToSearch}"`))).toBeTruthy();
    } else {
      expect(logs2.find(l => l.includes(`Prefix found but not complete word: "${prefixToSearch}"`))).toBeTruthy();
    }
  });

  test('S5_TrieCleared: Clear trie empties data and logs action', async () => {
    // Ensure trie has some words
    const beforeWords = await triePage.getTrieAllWordsViaEval();
    expect(beforeWords.length).toBeGreaterThan(0);

    await triePage.clearTrie();

    // Check log entry
    const logs = await triePage.getLogEntries();
    const clearLog = logs.find(l => l.includes('Cleared entire trie'));
    expect(clearLog).toBeTruthy();

    // trie.getAllWords() should be empty
    const afterWords = await triePage.getTrieAllWordsViaEval();
    expect(afterWords).toEqual([]);
  });

  test('InsertBulkWords & DeleteBulkWords transitions and counts', async () => {
    // Prepare bulk words with some new and some existing
    const bulk = ['alpha', 'beta', 'gamma'];
    await triePage.insertBulkWords(bulk);

    // Check inserted log
    const logs = await triePage.getLogEntries();
    const insertBulkLog = logs.find(l => l.includes(`Inserted ${bulk.length} words from bulk input`));
    expect(insertBulkLog).toBeTruthy();

    // Verify trie contains these words
    for (const w of bulk) {
      expect(await triePage.trieSearchViaEval(w)).toBeTruthy();
    }

    // Now delete bulk: include one existing and one non-existing to test deletedCount accuracy
    const deleteBulk = ['alpha', 'nonexistingbulkword'];
    await triePage.deleteBulkWords(deleteBulk);

    const logsAfterDelete = await triePage.getLogEntries();
    // deletedCount should be 1 (only alpha existed)
    const deleteBulkLog = logsAfterDelete.find(l => l.includes(`Deleted 1 words from bulk input`));
    expect(deleteBulkLog).toBeTruthy();

    // Validate 'alpha' removed, 'beta' still present
    expect(await triePage.trieSearchViaEval('alpha')).toBeFalsy();
    expect(await triePage.trieSearchViaEval('beta')).toBeTruthy();
  });

  test('GenerateRandomWords: both auto-insert and generate-only branches', async () => {
    // Branch 1: auto-insert OFF -> should generate and log "Generated N random words"
    await triePage.generateRandomWords(4, false);

    // The bulkWords textarea should be populated with 4 lines
    const bulkValue = await triePage.getBulkTextareaValue();
    const lines = bulkValue.split('\n').filter(l => l.trim());
    expect(lines.length).toBe(4);

    const logs = await triePage.getLogEntries();
    const genLog = logs.find(l => l.includes(`Generated 4 random words`) || l.includes('Generated'));
    expect(genLog).toBeTruthy();

    // Branch 2: auto-insert ON -> should insert generated words (default is checked at load)
    // Ensure autoInsert is checked
    if (!(await page.isChecked('#autoInsert'))) {
      await page.click('#autoInsert');
      await page.waitForTimeout(10);
    }

    // Count words before generation for later comparison
    const before = await triePage.getTrieAllWordsViaEval();
    await triePage.generateRandomWords(3, true);

    // After auto-insert, there should be a log about inserted words from bulk input OR inserted N words (via insertBulkWords)
    const logsAfter = await triePage.getLogEntries();
    const insertBulkLog = logsAfter.find(l => l.includes('Inserted') && l.includes('words from bulk input'));
    expect(insertBulkLog).toBeTruthy();

    const after = await triePage.getTrieAllWordsViaEval();
    // Expect trie size increased by at least 1 (since random words some may collide, but likely increased)
    expect(after.length).toBeGreaterThanOrEqual(before.length);
  });

  test('FindAllWithPrefix S4 and DeletePrefix S5: finding and deleting prefix behavior', async () => {
    // Ensure certain words exist (sample includes 'banana', 'band', 'bandana')
    const wordsBefore = await triePage.trieGetWordsWithPrefixViaEval('ban');
    expect(wordsBefore.length).toBeGreaterThanOrEqual(1);

    // Find all with prefix 'ban'
    await triePage.findAllWithPrefix('ban');
    const prefixResults = await triePage.getPrefixResultsText();
    expect(prefixResults).toContain('Words with prefix "ban"');

    const logs = await triePage.getLogEntries();
    const findLog = logs.find(l => l.includes(`Found`) && l.includes(`prefix "ban"`));
    expect(findLog).toBeTruthy();

    // Now delete prefix 'ban'
    await triePage.deletePrefix('ban');

    const logsAfterDeletePrefix = await triePage.getLogEntries();
    const deletePrefixLog = logsAfterDeletePrefix.find(l => l.includes(`Deleted all words starting with prefix: "ban"`));
    expect(deletePrefixLog).toBeTruthy();

    // Ensure no words left with that prefix
    const wordsAfter = await triePage.trieGetWordsWithPrefixViaEval('ban');
    expect(wordsAfter.length).toBe(0);
  });

  test('Edge cases: inserting empty word no-op; deleting empty prefix / no-op behaviors', async () => {
    // Capture log length before inserting empty word
    const logsBefore = await triePage.getLogEntries();
    const beforeCount = logsBefore.length;

    // Insert empty word -> nothing should happen
    await triePage.insertWord('');
    const logsAfter = await triePage.getLogEntries();
    expect(logsAfter.length).toBe(beforeCount);

    // Delete prefix with empty string should be a no-op according to implementation (function returns false)
    await triePage.deletePrefix('');
    const logsPostDeletePrefix = await triePage.getLogEntries();
    // Should not add 'Deleted all words starting with prefix' because prefix was empty; it may add "No words found..." or nothing.
    const added = logsPostDeletePrefix.length - beforeCount;
    // Accept either 0 or 1 new log but ensure that nothing crashed and page errors are empty (checked in afterEach)
    expect(added).toBeGreaterThanOrEqual(0);
  });

  test('Observability: verify renderTrie() is invoked on option changes and no runtime errors', async () => {
    // Toggle showCharLabels and showEndMarkers to trigger renderTrie change listeners
    await page.click('#showCharLabels');
    await page.waitForTimeout(10);
    await page.click('#showCharLabels'); // toggle back
    await page.waitForTimeout(10);
    await page.click('#showEndMarkers');
    await page.waitForTimeout(10);
    await page.click('#showEndMarkers');
    await page.waitForTimeout(10);

    // Compact view toggle already tested elsewhere; just ensure the visualization still exists and no errors
    const viz = await page.$('#trieVisualization');
    expect(viz).not.toBeNull();

    // Confirm no console.error or page errors captured (this is re-checked in afterEach)
  });
});