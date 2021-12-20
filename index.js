const fastify = require('fastify')()
const fs = require('fs')
const cron = require('node-cron')
const FIVEMINUTES = 5 * 60 * 1000
const FIFTEENMINUTES = FIVEMINUTES * 3
const DAY = 60 * 60 * 24 * 1000
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
  const statusRes = await axios.get('https://sponsor.ajay.app/api/status')
  const skipRes = await axios.get('https://sponsor.ajay.app/api/skipSegments/abcd')
  const data = {
    time: nowTime,
    axiosResponseTime: statusRes.config.metadata.responseTime,
    sbResponseTime: statusRes.data.startTime - nowTime,
    sbProcessTime: statusRes.data.processTime,
    skipResponseTime: skipRes.config.metadata.responseTime,
    status: statusRes.status
  }
  appendData(data)
  return data
}

const getAverage = (data) => data.reduce((a, b) => a + b, 0) / data.length
const getAverageOverTime = (data, TIME) => {
  const axiosResponseArr = []
  const sbResponseArr = []
  const sbProcessTimeArr = []
  const skipResponseArr = []
  const filtered = getRange(data, TIME)
  for (const x of filtered) {
    axiosResponseArr.push(x.axiosResponseTime)
    sbResponseArr.push(x.sbResponseTime)
    sbProcessTimeArr.push(x.sbProcessTime)
    skipResponseArr.push(x.skipResponseTime)
  }
  return {
    samples: axiosResponseArr.length,
    axiosResponseTime: getAverage(axiosResponseArr),
    sbResponseTime: getAverage(sbResponseArr),
    sbProcessTime: getAverage(sbProcessTimeArr),
    skipResponseTime: getAverage(skipResponseArr)
  }
}

const getRange = (data, time) => data.filter((x) => x.time > (new Date().getTime() - time))

const getData = () => readFile().data

// start
function startWebserver () {
  fastify.register(require('fastify-cors'), {
    origin: '*',
    methods: ['GET']
  })
  fastify.get('/status', async (request, reply) => {
    reply.send(await getTime())
  })
  fastify.get('/last', async (request, reply) => {
    reply.send(getData().pop())
  })
  fastify.get('/raw/chart', (request, reply) => {
    const duration = Number(request.query?.duration) || DAY
    reply.send(getRange(getData(), duration))
  })
  fastify.get('/raw', (request, reply) => {
    reply.send(getData())
  })
  fastify.get('/all', (request, reply) => {
    const data = getData()
    reply.send({
      last: data[data.length - 1],
      5: getAverageOverTime(data, FIVEMINUTES),
      15: getAverageOverTime(data, FIFTEENMINUTES)
    })
    getTime()
  })
  fastify.get('/average/5', (request, reply) => {
    reply.send(getAverageOverTime(getData(), FIVEMINUTES))
  })
  fastify.get('/average/15', (request, reply) => {
    reply.send(getAverageOverTime(getData(), FIFTEENMINUTES))
  })
  fastify.get('/average', (request, reply) => {
    reply.send({
      5: getAverageOverTime(getData(), FIVEMINUTES),
      15: getAverageOverTime(getData(), FIFTEENMINUTES)
    })
  })
  fastify.get('/', (request, reply) => {
    reply.redirect(302, '/status')
  })
  fastify.get('*', function (request, reply) {
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
