const { Pool } = require("pg");

const pool = new Pool({
  user: "skillconnect_kuie_user",
  host: "dpg-d6g3igi4d50c73dhur60-a.oregon-postgres.render.com",
  database: "skillconnect_kuie",
  password: "2w7kHuP559w8qNx36VWdkWcfDORWZVQI",
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