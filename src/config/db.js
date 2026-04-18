const { Pool } = require("pg");

const pool = new Pool({
  user: "skillconnect_x434_user",
  host: "dpg-d73trvjuibrs73aq9i9g-a.oregon-postgres.render.com",
  database: "skillconnect_x434",
  password: "0psa2TTgdsr7Xx0Wdv8ANtefX9VzRxnb",
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Success log
let x = 0;
if (x==0) {
  pool.on("connect", () => {
  console.log("✅ PostgreSQL connected successfully");
  x=1;
  
});
  
}


// Error handling
pool.on("error", (err) => {
  console.error("❌ Unexpected DB error", err);
  process.exit(1);
});

module.exports = pool;