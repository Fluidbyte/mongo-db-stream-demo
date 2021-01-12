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

const pause = async () => {
  return await new Promise((resolve) => {
    setTimeout(() => {
      resolve(new Date());
    }, 100);
  });
};

const run = async () => {
  await getConnection();
  await seedData();

  // Open a stream from the db collection find
  const dataStream = await db.collection("testdata").find({}).stream();

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
  dataTransformFlatten._transform = async (data, enc, cb) => {
    const res = await pause(); // Async example
    dataTransformFlatten.push({
      flattened: `${data.id}: ${data.name}`,
      completed: res,
    });
    cb();
  };

  let count = 0;

  const logOnData = (data) => {
    count++;
    console.log(count, data);
  };

  const handleStreamEnd = () => {
    console.log("DONE!");
  };

  // Stream
  dataStream
    .pipe(dataTransformFullName)
    .pipe(dataTransformFlatten)
    .on("data", logOnData)
    .on("end", handleStreamEnd);
};

run();
