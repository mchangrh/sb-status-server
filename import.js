require("dotenv").config();
const mongo = require("mongodb").MongoClient;
const fs = require("fs");

let statusDB;
// mongodb setup
mongo.connect(
  process.env.MONGO_AUTH, (err, client) => {
    if (err) {
      console.error(err);
      console.log(err);
      return;
    }
    const db = client.db("sb-status");
    console.log("db connected");
    //const collection = process.env.ENV === "production" ? "status" : "status_dev";
    statusDB = db.collection("status");
    run();
  }
);

// read/write files
const readFile = () => JSON.parse(fs.readFileSync("stats.json", "utf8"));

async function importData() {
  const data = readFile();
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

function run () {
  importData();
}
