import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d008e3-fa79-11f0-8075-e54a10595dde.html';

// Page object encapsulating common interactions and queries
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('#username');
    this.addUserButton = page.locator('button[onclick="addUser()"]');
    this.userList = page.locator('#userList');
    this.postContentInput = page.locator('#postContent');
    this.userSelect = page.locator('#userSelect');
    this.addPostButton = page.locator('button[onclick="addPost()"]');
    this.postList = page.locator('#postList');
    this.filterUserSelect = page.locator('#filterUserSelect');
    this.title = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Add a user by typing into the username input and clicking add
  async addUser(username) {
    if (username !== undefined) {
      await this.usernameInput.fill(username);
    }
    await this.addUserButton.click();
  }

  // Return an array of current user list texts
  async getUserList() {
    return this.userList.locator('li').allTextContents();
  }

  // Return options from userSelect as { value, text }[]
  async getUserSelectOptions() {
    return this.userSelect.locator('option').evaluateAll(options =>
      options.map(opt => ({ value: opt.value, text: opt.textContent }))
    );
  }

  // Return options from filterUserSelect as { value, text }[]
  async getFilterOptions() {
    return this.filterUserSelect.locator('option').evaluateAll(options =>
      options.map(opt => ({ value: opt.value, text: opt.textContent }))
    );
  }

  // Add a post with given content for a given user index (string or number)
  async addPost(content, userIndex) {
    if (content !== undefined) {
      await this.postContentInput.fill(content);
    }
    if (userIndex !== undefined) {
      // select by value
      await this.userSelect.selectOption(String(userIndex));
    }
    await this.addPostButton.click();
  }

  // Return array of post list texts
  async getPostList() {
    return this.postList.locator('li').allTextContents();
  }

  // Set filter select to given index ("" for All Users)
  async setFilter(userIndex) {
    await this.filterUserSelect.selectOption(String(userIndex));
    // Fire change is native; the onchange attribute will be triggered automatically by selectOption
  }

  // Helpers to get input values
  async getUsernameValue() {
    return this.usernameInput.inputValue();
  }

  async getPostContentValue() {
    return this.postContentInput.inputValue();
  }
}

test.describe('Relational Database Demo - FSM tests', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // No navigation here; individual tests will navigate through Page object
  });

  test.afterEach(async () => {
    // Assert there were no page errors (uncaught exceptions)
    // This verifies the runtime did not throw unexpected errors during interaction.
    expect(pageErrors, 'No page errors should have occurred').toHaveLength(0);

    // Also assert no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, `Console should not contain 'error' messages; found: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test('Idle state renders initial page correctly', async ({ page }) => {
    // Validate the Idle state: page renders header and empty lists/selects
    const app = new AppPage(page);
    await app.goto();

    // Validate header exists
    await expect(app.title).toHaveText('Relational Database Demo');

    // Initially there should be no users and no posts
    const users = await app.getUserList();
    expect(users.length, 'Initially the user list should be empty').toBe(0);

    const posts = await app.getPostList();
    expect(posts.length, 'Initially the post list should be empty').toBe(0);

    // userSelect and filterUserSelect should have no options initially
    const userSelectOptions = await app.getUserSelectOptions();
    expect(userSelectOptions.length, 'userSelect should start empty').toBe(0);

    const filterOptions = await app.getFilterOptions();
    expect(filterOptions.length, 'filterUserSelect should start empty').toBe(0);

    // Confirm inputs start empty
    expect(await app.getUsernameValue(), 'username input should start empty').toBe('');
    expect(await app.getPostContentValue(), 'postContent input should start empty').toBe('');
  });

  test('Add User transitions Idle -> UserAdded and updates lists and selects', async ({ page }) => {
    // This test validates adding a user updates UI elements and clears input
    const app = new AppPage(page);
    await app.goto();

    // Add a user "Alice"
    await app.addUser('Alice');

    // Verify user list updated
    const users = await app.getUserList();
    expect(users).toEqual(['Alice']);

    // Verify username input cleared after addUser
    expect(await app.getUsernameValue()).toBe('');

    // Verify userSelect updated with the new user
    const userSelectOptions = await app.getUserSelectOptions();
    expect(userSelectOptions.length).toBe(1);
    expect(userSelectOptions[0].text.trim()).toBe('Alice');
    expect(userSelectOptions[0].value).toBe('0');

    // Verify filterUserSelect contains "All Users" and "Alice"
    const filterOptions = await app.getFilterOptions();
    // updateFilterUserSelect adds "All Users" then the user(s)
    expect(filterOptions.length).toBe(2);
    expect(filterOptions[0].text.trim()).toBe('All Users');
    expect(filterOptions[0].value).toBe('');
    expect(filterOptions[1].text.trim()).toBe('Alice');
    expect(filterOptions[1].value).toBe('0');
  });

  test('Adding a blank user does nothing (edge case)', async ({ page }) => {
    // Validate that clicking Add User with empty input does not mutate state
    const app = new AppPage(page);
    await app.goto();

    // Click add user without typing anything
    await app.addUser(''); // fill with empty string, then click

    // Ensure no users were added
    const users = await app.getUserList();
    expect(users.length).toBe(0);

    const userSelectOptions = await app.getUserSelectOptions();
    expect(userSelectOptions.length).toBe(0);
  });

  test('Add Post transitions UserAdded -> PostAdded and clears post input', async ({ page }) => {
    // Validate adding a post for an existing user creates a post entry
    const app = new AppPage(page);
    await app.goto();

    // Setup: add a user 'Bob'
    await app.addUser('Bob');

    // Add a post for Bob
    await app.addPost('Hello World', 0);

    // Verify the post list includes "Bob: Hello World"
    const posts = await app.getPostList();
    expect(posts).toEqual(['Bob: Hello World']);

    // Verify postContent input cleared after adding
    expect(await app.getPostContentValue()).toBe('');
  });

  test('Adding a post without content or without user selection does nothing (edge cases)', async ({ page }) => {
    // Validate addPost guard conditions
    const app = new AppPage(page);
    await app.goto();

    // Case A: No users exist; attempt to add a post with content but no user selection
    await app.postContentInput.fill('Orphan Post');
    await app.addPostButton.click();

    let posts = await app.getPostList();
    expect(posts.length, 'Should not add a post when no user is selected/existing').toBe(0);
    // Clear postContent for next case
    await app.postContentInput.fill('');

    // Case B: Create user and then attempt to add a post with empty content
    await app.addUser('Carol');
    // Explicitly select user 0 but leave content empty
    await app.userSelect.selectOption('0');
    await app.addPostButton.click();

    posts = await app.getPostList();
    expect(posts.length, 'Should not add a post when post content is empty').toBe(0);
  });

  test('Filter Posts transitions PostAdded -> PostFiltered and shows correct filtered results', async ({ page }) => {
    // Create two users and posts, then filter by a single user and verify results
    const app = new AppPage(page);
    await app.goto();

    // Add two users: Alice and Bob
    await app.addUser('Alice');
    await app.addUser('Bob');

    // Add posts for each user
    // Select Alice (value '0') and add post
    await app.addPost('Alice Post 1', 0);
    // Select Bob (value '1') and add post
    await app.addPost('Bob Post 1', 1);
    // Add a second Alice post to verify multiple posts per user
    await app.userSelect.selectOption('0');
    await app.postContentInput.fill('Alice Post 2');
    await app.addPostButton.click();

    // Confirm all posts are present when no filter applied (All Users)
    // filterUserSelect should have been populated with "All Users", "Alice", "Bob"
    let allPosts = await app.getPostList();
    expect(allPosts.length).toBe(3);
    // The list order should reflect insertion order: Alice Post1, Bob Post1, Alice Post2
    expect(allPosts).toEqual(['Alice: Alice Post 1', 'Bob: Bob Post 1', 'Alice: Alice Post 2']);

    // Filter to only Bob's posts (value '2'? Let's inspect filter options to determine values)
    const filterOptions = await app.getFilterOptions();
    // find index for 'Bob'
    const bobOption = filterOptions.find(opt => opt.text.trim() === 'Bob');
    expect(bobOption, 'Bob option should exist in filter').toBeTruthy();
    // Apply filter
    await app.setFilter(bobOption.value);

    // Now only Bob posts should be visible
    const filteredPosts = await app.getPostList();
    expect(filteredPosts).toEqual(['Bob: Bob Post 1']);

    // Switch back to All Users
    const allOption = filterOptions.find(opt => opt.text.trim() === 'All Users');
    expect(allOption).toBeTruthy();
    await app.setFilter(allOption.value);

    const postsAfterClearingFilter = await app.getPostList();
    expect(postsAfterClearingFilter.length).toBe(3);
  });

  test('Duplicate users allowed and multiple posts preserved (edge case validations)', async ({ page }) => {
    // Validate behavior when same username is added twice
    const app = new AppPage(page);
    await app.goto();

    // Add duplicate users
    await app.addUser('Sam');
    await app.addUser('Sam');

    const users = await app.getUserList();
    expect(users).toEqual(['Sam', 'Sam']);
    const userSelectOptions = await app.getUserSelectOptions();
    expect(userSelectOptions.length).toBe(2);
    expect(userSelectOptions[0].text.trim()).toBe('Sam');
    expect(userSelectOptions[1].text.trim()).toBe('Sam');

    // Add posts for each duplicate entry: select index 0 and 1 respectively
    await app.addPost('First Sam post', 0);
    await app.addPost('Second Sam post', 1);

    const posts = await app.getPostList();
    // Both posts should appear and be associated with the corresponding user entries (both have same display name)
    expect(posts).toEqual(['Sam: First Sam post', 'Sam: Second Sam post']);
  });
});