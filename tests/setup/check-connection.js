import {
  connectTestDatabase,
  disconnectTestDatabase,
} from "./database.js";

try {
  await connectTestDatabase();
  console.log("Connection test passed.");
} catch (error) {
  console.error("Connection test failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectTestDatabase();
}