// // server.js - COMPLETE FIXED VERSION
// const app = require('./src/app.js');  // ← YE MISSING THA!
// const initDB = require('./src/config/initDB.js');

// const PORT = process.env.PORT || 8000;

// async function startServer() {
//   try {
//     console.log("🔄 Starting server...");
    
//     // Safe DB init
//     await initDB();
//     console.log("✅ Database ready!");
    
//     // Start server
//     app.listen(PORT, () => {
//       console.log(`🚀 Server running on port ${PORT}`);
//       console.log(`📱 Test: http://localhost:${PORT}/api/`);
//     });
    
//   } catch (error) {
//     console.error("❌ Failed to start server:", error.message);
//     process.exit(1);
//   }
// }

// startServer();
require('dotenv').config();
const app = require('./src/app.js');  // ← Path check kar
const initDB = require('./src/config/initDB.js');

const PORT = process.env.PORT || 8000;  // ← 8000 fix

async function startServer() {
  try {
    await initDB();
    app.listen(PORT,'0.0.0.0',() => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start:", error);
  }
}

startServer();
