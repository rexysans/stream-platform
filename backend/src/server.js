import app from "./app.js";
import pool from "./db.js";

pool.query("SELECT 1")
  .then(() => console.log("PostgreSQL connected successfully"))
  .catch(err => console.error("DB connection error", err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend is running to Port:- ${PORT}`);
});
