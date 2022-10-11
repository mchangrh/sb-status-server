require("dotenv").config();
const fastify = require("fastify")();
const mongo = require("mongodb").MongoClient;
const cron = require("node-cron");
const { processErrors, isDegraded } = require("./alert");
const FIVEMINUTES = 5 * 60 * 1000;
const FIFTEENMINUTES = FIVEMINUTES * 3;
const DAY = 60 * 60 * 24 * 1000;

let statusDB;
// mongodb setup
mongo.connect(
  process.env.MONGO_AUTH, (err, client) => {
    if (err) {
      console.error(err);
      return;
    }
    const db = client.db("sb-status");
    const collection = process.env.ENV === "production" ? "status" : "status_dev";
    statusDB = db.collection(collection);
  }
);
// set up node cron
cron.schedule("* * * * *", () => {
  getTime();
});
// set up axios
const axios = require("axios");
axios.interceptors.request.use(config => {
  config.metadata = config.metadata || {};
  config.metadata.startedAt = new Date().getTime();
  return config;
});
axios.interceptors.response.use(response => {
  response.config.metadata.responseTime = new Date().getTime() - response.config.metadata.startedAt;
  return response;
});

const getTime = async () => {
  const time = new Date();
  const statusRes = await axios.get("https://api.sponsor.ajay.app/api/status");
  const skipRes = await axios.get("https://api.sponsor.ajay.app/api/skipSegments/abcd");
  const data = {
    time,
    axiosResponseTime: statusRes.config.metadata.responseTime,
    sbResponseTime: statusRes.data.startTime - time,
    sbProcessTime: statusRes.data.processTime,
    redisProcessTime: statusRes.data.redisProcessTime,
    skipResponseTime: skipRes.config.metadata.responseTime,
    status: statusRes.status,
    hostname: statusRes.hostname
  };
  processErrors(data);
  await statusDB.insertOne(data);
  return transformData(data);
};

const transformData = (data) => {
  delete data._id;
  data.time = new Date(data.time).getTime();
  return data;
};

const getAverage = (data) => data.reduce((a, b) => a + b, 0) / data.length;
const getAverageOverTime = async (duration) => {
  const startTime = new Date().getTime() - duration;
  const axiosResponseArr = [];
  const sbResponseArr = [];
  const sbProcessTimeArr = [];
  const redisProcessTimeArr = [];
  const skipResponseArr = [];
  const filtered = await getRange(startTime);
  for (const x of filtered) {
    axiosResponseArr.push(x.axiosResponseTime);
    sbResponseArr.push(x.sbResponseTime);
    sbProcessTimeArr.push(x.sbProcessTime);
    redisProcessTimeArr.push(x.redisProcessTime);
    skipResponseArr.push(x.skipResponseTime);
  }
  return {
    samples: axiosResponseArr.length,
    axiosResponseTime: getAverage(axiosResponseArr),
    sbResponseTime: getAverage(sbResponseArr),
    sbProcessTime: getAverage(sbProcessTimeArr),
    redisProcessTime: getAverage(redisProcessTimeArr),
    skipResponseTime: getAverage(skipResponseArr)
  };
};

const chartFilter = (data) => data.map(x => { return { time: new Date(x.time).getTime(), pt: x.sbProcessTime,rt: x.redisProcessTime, status: x.sbResponseTime, skip: x.skipResponseTime }; });
const getRange = async (time) => statusDB.find({"time": {$gte: new Date(time)}}).toArray();
const getLast = async () => statusDB.findOne({}, {sort: { time: "desc"}});

// start
function startWebserver () {
  fastify.register(require("@fastify/cors"), {
    origin: "*",
    methods: ["GET"]
  });
  fastify.get("/status", async (request, reply) => {
    reply.send(await getTime());
  });
  fastify.get("/last", async (request, reply) => {
    reply.send(transformData(await getLast()));
  });
  fastify.get("/raw/chart", async (request, reply) => {
    const duration = Number(request.query?.duration) || DAY;
    reply.send(chartFilter(
      await getRange(new Date().getTime() - duration)
    ));
  });
  fastify.get("/all", async (request, reply) => {
    reply.send({
      last: transformData(await getLast()),
      5: await getAverageOverTime(FIVEMINUTES),
      15: await getAverageOverTime(FIFTEENMINUTES)
    });
    getTime();
  });
  fastify.get("/average/5", async (request, reply) => {
    reply.send(await getAverageOverTime(FIVEMINUTES));
  });
  fastify.get("/average/15", async (request, reply) => {
    reply.send(await getAverageOverTime(FIFTEENMINUTES));
  });
  fastify.get("/average", async (request, reply) => {
    reply.send({
      5: await getAverageOverTime(FIVEMINUTES),
      15: await getAverageOverTime(FIFTEENMINUTES)
    });
  });
  fastify.get("/degraded", async (request, reply) => {
    const degraded = isDegraded();
    if (degraded) {
      reply.code(500).send("degraded");
    } else {
      reply.send("ok");
    }
  });
  fastify.get("/", (request, reply) => {
    reply.redirect(302, "/status");
  });
  fastify.get("*", function (request, reply) {
    reply.code(404).send();
  });
  fastify.listen(process.env.PORT, function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`server listening on ${address}`);
  });
}
startWebserver();
