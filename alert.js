require("dotenv").config();
const axios = require("axios");

const errors = {
  axiosResponseTime: 0,
  sbResponseTime: 0,
  sbProcessTime: 0,
  redisProcessTime: 0,
  skipResponseTime: 0,
  status: 0,
};
const noErrors = {...errors};

const componentIdMap = {
  axiosResponseTime: "cl94hfdc0237658ikndrptvvfsk",
  sbResponseTime: "cl94hfv6p241538i6ndtm94o7ot",
  sbProcessTime: "cl94hg7a5241669i6nd3b50md49",
  redisProcessTime: "cl94hgdgu241771i6ndg385xz53",
  skipResponseTime: "cl94hfn4m237793iknd6mvf3dma",
  status: "cl94ljutl28855hsola5c5czy7"
};

/*
const pageStatus = {
  up: "UP",
  down: "HASISSUES",
  maintenance: "UNDERMAINTENANCE"
};
*/

const componentStatus = {
  up: "OPERATIONAL",
  degraded: "DEGRADEDPERFORMANCE",
  partial: "PARTIALOUTAGE",
  major: "MAJOROUTAGE"
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
    if (errors[service] >= 2) {
      console.log("alerting on ", service);
      const threshold = httpElements.includes(service) ? httpThreshold : processThreshold;
      const severity = getSeverity(data[service], threshold);
      sendAlert(service, severity);
    } else if (noErrors[service] == 5) {
      console.log("clearing alert on ", service);
      // if no errors, send OK status
      sendAlert(service, 0);
    }
  }
}

function sendAlert(service, severity) {
  const status = Object.values(componentStatus)[severity];
  const id = componentIdMap[service];
  axios.put(`https://api.instatus.com/v1/${process.env.INSTATUS_PAGEID}/components/${id}`, {
    status
  },{
    headers: {
      "Authorization": `Bearer ${process.env.INSTATUS_APIKEY}`
    },
  })
    .catch(err => {
      console.log("instatus error", err);
    });
}

module.exports = {
  processErrors
};