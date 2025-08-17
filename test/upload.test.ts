import app from "../src/index";

// Simple upload test script
async function testUpload() {
  try {
    // Read the test image file
    const testFile = Bun.file("./logo.svg");
    const fileBuffer = await testFile.arrayBuffer();

    // Create FormData with the test file and admin transaction
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: "image/svg+xml" });
    formData.append("file", blob, "logo.svg");
    formData.append("transactionString", "ADMIN_TEST_TRANSACTION");

    console.log("🚀 Testing file upload...");

    // Make request to /store endpoint
    const response = await fetch("https://eggman.up.railway.app/store", {
      method: "POST",
      body: formData,
    });

    console.log(`📊 Response status: ${response.status}`);

    const responseData = await response.json();
    console.log("📁 Response data:", JSON.stringify(responseData, null, 2));

    if (response.status === 200 || response.status === 202) {
      console.log("✅ Upload test successful!");
      console.log(`📄 Temp file created: ${responseData.tempFile}`);

      // Check if temp file actually exists
      const tempFilePath = `./tmp/${responseData.tempFile}`;
      const tempFile = Bun.file(tempFilePath);
      const exists = await tempFile.exists();
      console.log(`📁 Temp file exists on disk: ${exists}`);

      if (exists) {
        console.log(`📏 Temp file size: ${tempFile.size} bytes`);
      }
    } else {
      console.log("❌ Upload test failed!");
    }

  } catch (error) {
    console.error("💥 Test error:", error);
  }
}

// Test admin transactions endpoint
async function testAdminEndpoint() {
  try {
    console.log("\n🔍 Testing admin transactions endpoint...");

    const response = await app.request("/admin/transactions", {
      method: "GET",
    });

    console.log(`📊 Admin response status: ${response.status}`);

    const responseData = await response.json();
    console.log("📋 Transaction data:", JSON.stringify(responseData, null, 2));

    if (response.status === 200) {
      console.log("✅ Admin endpoint test successful!");
      console.log(`📈 Total transactions: ${responseData.totalTransactions}`);
      console.log(`✅ Used transactions: ${responseData.usedTransactions}`);
      console.log(`⏳ Unused transactions: ${responseData.unusedTransactions}`);
    } else {
      console.log("❌ Admin endpoint test failed!");
    }
  } catch (error) {
    console.error("💥 Admin test error:", error);
  }
}

// Run the tests
async function runTests() {
  await testUpload();
  await testAdminEndpoint();
}

runTests();
