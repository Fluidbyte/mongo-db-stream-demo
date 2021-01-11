const { MongoClient } = require("mongodb");
const { MONGO_URL, MONGO_DB } = process.env;

const data = require("./data.json");

const { Transform } = require("stream");

let db;

// Establish connection
const getConnection = async () => {
  if (db) return db; // cache connection
  try {
    const client = await MongoClient.connect(MONGO_URL, {
      useUnifiedTopology: true,
    });
    db = await client.db(MONGO_DB);
    return db;
  } catch (e) {
    throw new Error("CANNOT CONNECT TO DATABASE", e);
  }
};

const seedData = async () => {
  try {
    const recordCount = await db.collection("testdata").countDocuments();
    if (recordCount === 0) await db.collection("testdata").insertMany(data);
  } catch (e) {
    console.log("ERROR: Could not seed data", e);
  }
};

// ##############################################################

const run = async () => {
  await getConnection();
  await seedData();

  // Open a stream from the db collection find
  const dataStream = await db.collection("testdata").find({}).stream();

  // What to do when the stream ends
  dataStream.on("end", () => {
    console.log("Done!");
  });

  // Create full name transform
  const dataTransformFullName = new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
  });

  // Create id merge transform
  const dataTransformFlatten = new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
  });

  // Define what the full name transform does
  dataTransformFullName._transform = (data, enc, cb) => {
    dataTransformFullName.push({
      name: `${data.first_name} ${data.last_name}`,
      id: data.id,
    });
    cb();
  };

  // Define what the flatten transform does
  dataTransformFlatten._transform = (data, enc, cb) => {
    dataTransformFlatten.push({ flattened: `${data.id}: ${data.name}` });
    cb();
  };

  let count = 0;

  // Stream
  dataStream
    .pipe(dataTransformFullName)
    .pipe(dataTransformFlatten)
    .on("data", (data) => {
      count++;
      console.log(count, data);
    });
};

run();
