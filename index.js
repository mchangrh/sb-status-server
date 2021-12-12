const fastify = require('fastify')()
const fs = require('fs')
const cron = require('node-cron')
const FIVEMINUTES = 5 * 60 * 1000
const FIFTEENMINUTES = FIVEMINUTES * 3
// set up node cron
cron.schedule('* * * * *', () => {
  getTime()
})
// set up axios
const axios = require('axios')
axios.interceptors.request.use(config => {
  config.metadata = config.metadata || {}
  config.metadata.startedAt = new Date().getTime()
  return config
})
axios.interceptors.response.use(response => {
  response.config.metadata.responseTime = new Date().getTime() - response.config.metadata.startedAt
  return response
})
// read/write files
const readFile = () => JSON.parse(fs.readFileSync('stats.json', 'utf8'))
const writeFile = (data) => fs.writeFileSync('stats.json', JSON.stringify(data, null, 2), (err) => { if (err) console.log(err) })
const appendData = (data) => {
  const file = readFile()
  file.data.push(data)
  writeFile(file)
}

const getTime = async () => {
  const nowTime = new Date().getTime()
  const response = await axios.get('https://sponsor.ajay.app/api/status')
  const data = {
    time: nowTime,
    axiosResponseTime: response.config.metadata.responseTime,
    sbResponseTime: response.data.startTime - nowTime,
    status: response.status
  }
  appendData(data)
  return data
}

const getAverage = (data) => data.reduce((a, b) => a + b, 0) / data.length
const getAverageOverTime = (data, TIME) => {
  const axiosResponseArr = []
  const sbResponseArr = []
  for (const x of data) {
    if (x.time > (new Date().getTime() - TIME)) {
      axiosResponseArr.push(x.axiosResponseTime)
      sbResponseArr.push(x.sbResponseTime)
    }
  }
  return {
    samples: axiosResponseArr.length,
    axiosResponseTime: getAverage(axiosResponseArr),
    sbResponseTime: getAverage(sbResponseArr)
  }
}

const getData = () => readFile().data

// start
function startWebserver () {
  fastify.all('/status', async (request, reply) => {
    reply.send(await getTime())
  })
  fastify.all('/raw', (request, reply) => {
    reply.send(getData())
  })
  fastify.all('/average/5', (request, reply) => {
    reply.send(getAverageOverTime(getData(), FIVEMINUTES))
  })
  fastify.all('/average/15', (request, reply) => {
    reply.send(getAverageOverTime(getData(), FIFTEENMINUTES))
  })
  fastify.all('/average', (request, reply) => {
    reply.send({
      5: getAverageOverTime(getData(), FIVEMINUTES),
      15: getAverageOverTime(getData(), FIFTEENMINUTES)
    })
  })
  fastify.all('/', (request, reply) => {
    reply.redirect(302, '/status')
  })
  fastify.all('*', function (request, reply) {
    reply.code(404).send()
  })
  fastify.listen(3000, function (err, address) {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log(`server listening on ${address}`)
  })
}
startWebserver()
