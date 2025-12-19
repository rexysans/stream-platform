import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: "stream_app",
  host: "127.0.0.1",
  database: "stream_platform",
  password: "streampass",
  port: 5432,
});


export default pool;
