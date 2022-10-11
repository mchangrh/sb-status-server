require("dotenv").config();
const axios = require("axios");
const { webhooks } = require("./webhooks.json");

const errors = {
  axiosResponseTime: 0,
  sbResponseTime: 0,
  sbProcessTime: 0,
  redisProcessTime: 0,
  skipResponseTime: 0,
  status: 0,
};
const noErrors = {...errors};

/*
const pageStatus = {
  up: "UP",
  down: "HASISSUES",
  maintenance: "UNDERMAINTENANCE"
};
*/

const componentStatus = {
  "Operational": "OPERATIONAL",
  "Degraded": "DEGRADEDPERFORMANCE",
  "Partial Outage": "PARTIALOUTAGE",
  "Major Outage": "MAJOROUTAGE"
};

const httpThreshold = {
  degraded: 200,
  partial: 500,
  major: 1000
};

const processThreshold = {
  degraded: 50,
  partial: 150,
  major: 200 
};

// const processElements = ["axiosResponseTime", "skipResponseTime", "sbResponseTime"];

const httpElements = ["sbProcessTime", "redisProcessTime"];

function getSeverity (data, threshold) {
  let level = 0;
  for (const num of Object.values(threshold)) {
    if (data >= num) level += 1;
  }
  return level;
}

function checkThreshold(data, threshold) {
  for (const [name, rt] of Object.entries(data)) {
    const level = getSeverity(rt, threshold);
    if (level >= 1) {
      errors[name] += level;
      noErrors[name] = 0;
    } else {
      noErrors[name] += 1;
      // clear errors if no errors for 5 checks
      if (noErrors[name] >= 5) errors[name] = 0;
    }
  }
}

function processErrors(data) {
  const {axiosResponseTime, skipResponseTime, sbResponseTime, sbProcessTime, redisProcessTime} = data;
  checkThreshold({ axiosResponseTime, skipResponseTime, sbResponseTime}, httpThreshold);
  checkThreshold({ sbProcessTime, redisProcessTime }, processThreshold);
  if (!data.status == 200) errors.status += 1;
  checkErrors(data);
}

function checkErrors(data) {
  for (const service in errors) {
    const amount = data[service];
    if (errors[service] >= 2) {
      console.log("alerting on ", service);
      const threshold = httpElements.includes(service) ? httpThreshold : processThreshold;
      const severity = getSeverity(amount, threshold);
      sendAlert(service, severity, amount);
    } else if (noErrors[service] == 5) {
      console.log("clearing alert on ", service);
      // if no errors, send OK status
      sendAlert(service, 0, amount);
    }
  }
}

function sendAlert(service, severity, amount) {
  const status = Object.values(componentStatus)[severity];
  const url = webhooks[service];
  const up = severity == 0;
  axios.post(url, {
    trigger: up ? "up" : "down",
    name: `${service} is/has ${Object.keys(componentStatus)[severity]}`,
    message: up ? "Service is responding normally" : `${service} is/has ${Object.keys(componentStatus)[severity]} with time of ${amount}ms`,
    status
  })
    .catch(err => {
      console.log("instatus error", err);
    });
}

function isDegraded() {
  for (const service in errors) {
    if (errors[service] >= 2) {
      return true;
    }
  }
  return false;
}

module.exports = {
  processErrors,
  isDegraded,
};