#!/usr/bin/env tsx

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

async function testEndpoint(
  name: string,
  path: string,
  expectedStatus: number = 200
): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${path}`);
    const duration = Date.now() - start;
    const passed = response.status === expectedStatus;
    
    return {
      name,
      passed,
      duration,
      error: passed ? undefined : `Expected ${expectedStatus}, got ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

async function runSmokeTests() {
  console.log(`\n🔥 Running smoke tests against ${BASE_URL}\n`);
  
  const tests: Promise<TestResult>[] = [
    testEndpoint("Health Check", "/api/health"),
    testEndpoint("Auth - Unauthenticated", "/api/patients/summary", 401),
  ];

  const results = await Promise.all(tests);
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    const status = result.passed ? "PASS" : "FAIL";
    console.log(`${icon} [${status}] ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   └─ ${result.error}`);
    }
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((error) => {
  console.error("Smoke test runner failed:", error);
  process.exit(1);
});
