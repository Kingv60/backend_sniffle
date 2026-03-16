const app = require("./src/app");
const initDB = require("./src/config/initDB");

const PORT = 8000;

const startServer = async () => {
  try {
    // Initialize tables
    await initDB();

    // Start server only after DB ready
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();