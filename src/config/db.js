const { Pool } = require("pg");

const pool = new Pool({
  user: "skillconnect_app_user,
  host: "dpg-d7o41aegvqtc73b7if5g-a.oregon-postgres.render.com",
  database: "skillconnect_app",
  password: "1y1JKBoPUCxoiKCEKFqSHR4glJoMRlMH",
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
