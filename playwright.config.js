import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Playwright configuration file
 * Used to run the FSM-generated tests
 */

// Extract the test path from environment variables or command-line arguments
const getTestPath = () => {
  // Prefer the environment variable
  if (process.env.PLAYWRIGHT_WORKSPACE) {
    return process.env.PLAYWRIGHT_WORKSPACE;
  }

  // Otherwise try to extract it from the command-line arguments
  const args = process.argv;
  const testPathIndex = args.findIndex((arg) => arg.includes("workspace/"));
  if (testPathIndex !== -1) {
    const testPath = args[testPathIndex];
    // Extract the "workspace/XX-XX-XXXX" part
    const match = testPath.match(/workspace\/([^\/]+)/);
    if (match) {
      // Set the environment variable for worker processes to use
      process.env.PLAYWRIGHT_WORKSPACE = match[1];
      return match[1];
    }
  }
  return null;
};

const workspaceName = getTestPath();
const outputDir = workspaceName
  ? `workspace/${workspaceName}/test-results`
  : "test-results";

export default defineConfig({
  // Global timeout setting
  timeout: 10000,

  // Expect timeout setting
  expect: {
    timeout: 5000,
  },

  // Number of retries on failure
  retries: process.env.CI ? 2 : 0,

  // Number of workers running in parallel
  workers: process.env.CI ? 12 : 12,

  // Keep running even if some tests fail (key setting)
  fullyParallel: true, // Run fully in parallel

  // Leave unset (undefined) so all tests run to completion
  // maxFailures: 0 means stop at the first failure
  // Unset or undefined means run all tests
  maxFailures: undefined,

  // Reporter configuration
  reporter: [
    ["html", { outputFolder: `${outputDir}/html-report` }],
    ["line"],
    ["json", { outputFile: `${outputDir}/results.json` }],
  ],

  // Global settings
  use: {
    // Base URL (used for relative paths)
    baseURL: "file://",

    // Browser context options
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
  },

  // Output directory configuration
  outputDir: `${outputDir}/test-artifacts`,

  // Ignore test files with syntax errors
  testIgnore: [
    "**/*.invalid.js", // Ignore files marked as invalid
  ],

  // Project configuration - defines which browsers to run
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },

    // Mobile browser tests
    // {
    //   name: "Mobile Chrome",
    //   use: { ...devices["Pixel 5"] },
    // },
    // {
    //   name: "Mobile Safari",
    //   use: { ...devices["iPhone 12"] },
    // },
  ],

  // Web server configuration (if needed)
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  //   reuseExistingServer: !process.env.CI,
  // },
});
