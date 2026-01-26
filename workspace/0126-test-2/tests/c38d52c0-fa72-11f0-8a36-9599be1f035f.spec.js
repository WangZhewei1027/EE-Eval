import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/c38d52c0-fa72-11f0-8a36-9599be1f035f.html';

test.describe('Binary Search Tree (BST) Interactive Application', () => {
    test.beforeEach(async ({ page }) => {
        // Load the application page before each test
        await page.goto(BASE_URL);
    });

    test('should render the initial page with the correct title', async ({ page }) => {
        // Validate that the page renders with the expected title
        const title = await page.locator('h1').innerText();
        expect(title).toBe('Binary Search Tree (BST)');
    });

    test('should insert values into the binary search tree', async ({ page }) => {
        // Click on nodes to insert values into the BST
        await page.click('#node-1'); // Insert Node 2
        await page.click('#node-2'); // Insert Node 3
        await page.click('#node-3'); // Insert Node 4
        await page.click('#node-4'); // Insert Node 5
        await page.click('#node-5'); // Insert Node 6
        await page.click('#node-6'); // Insert Node 7

        // Verify that the tree structure is updated (this is inferred from the state transition)
        const consoleOutput = await page.evaluate(() => {
            return new Promise((resolve) => {
                const originalLog = console.log;
                const logs = [];
                console.log = (...args) => {
                    logs.push(...args);
                };
                setTimeout(() => {
                    console.log = originalLog; // Restore original console.log
                    resolve(logs);
                }, 1000); // Wait for the logs to be printed
            });
        });

        // Check if values are logged in order (this is an indirect verification)
        expect(consoleOutput).toContain(2);
        expect(consoleOutput).toContain(3);
        expect(consoleOutput).toContain(4);
        expect(consoleOutput).toContain(5);
        expect(consoleOutput).toContain(6);
        expect(consoleOutput).toContain(7);
        expect(consoleOutput).toContain(8);
    });

    test('should log values in order during in-order traversal', async ({ page }) => {
        // Trigger in-order traversal
        await page.evaluate(() => {
            const bst = new BinarySearchTree();
            bst.insert(5);
            bst.insert(3);
            bst.insert(7);
            bst.insert(2);
            bst.insert(4);
            bst.insert(6);
            bst.insert(8);
            bst.inorder(); // This will log values
        });

        // Capture console output
        const consoleOutput = await page.evaluate(() => {
            return new Promise((resolve) => {
                const originalLog = console.log;
                const logs = [];
                console.log = (...args) => {
                    logs.push(...args);
                };
                setTimeout(() => {
                    console.log = originalLog; // Restore original console.log
                    resolve(logs);
                }, 1000); // Wait for the logs to be printed
            });
        });

        // Check if values are logged in order
        expect(consoleOutput).toEqual([2, 3, 4, 5, 6, 7, 8]);
    });

    test('should handle errors gracefully', async ({ page }) => {
        // Attempt to insert a non-numeric value and check for errors
        await page.evaluate(() => {
            try {
                bst.insert('invalid'); // This should cause an error
            } catch (e) {
                console.error(e);
            }
        });

        // Capture console output
        const consoleOutput = await page.evaluate(() => {
            return new Promise((resolve) => {
                const originalLog = console.log;
                const logs = [];
                console.log = (...args) => {
                    logs.push(...args);
                };
                setTimeout(() => {
                    console.log = originalLog; // Restore original console.log
                    resolve(logs);
                }, 1000); // Wait for the logs to be printed
            });
        });

        // Check if the error was logged
        expect(consoleOutput).toContain(expect.stringContaining('TypeError'));
    });
});