require("dotenv").config();
const { MongoClient } = require("mongodb");
const fs = require("fs");

let statusDB;
// mongodb setup
const client = new MongoClient(process.env.MONGO_AUTH);
client.connect().then(() => {
  const db = client.db("sb-status");
  const collection = process.env.ENV === "production" ? "status" : "status_dev";
  statusDB = db.collection(collection);
  importData();
}).catch(err => {
  console.error(err);
  process.exit(1);
});

async function importData() {
  const data = JSON.parse(fs.readFileSync("stats.json", "utf8"));
  const bulk = statusDB.initializeUnorderedBulkOp();
  for (const entry of data.data) {
    entry.time = new Date(entry.time);
    bulk.insert(entry);
  }
  console.log("prepared", data.data.length, "entries");
  const result = await bulk.execute();
  console.log("inserted", result.nInserted, "entries");
  console.log(result);
  console.log("done");
}