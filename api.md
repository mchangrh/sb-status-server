`/status`  
Get measured response time from SponsorBlock server
```js
{
  time: int, // node unix time
  axiosResponseTime: int, // ms of http response time
  sbResponseTime: int, // ms of time from sb to receiving response
  sbProcessTime: int, // ms of processing time from sb-server
}
```

`/average`  
Get 5 and 15 minute averages
```js
{
  5: {
    samples: int, // number of samples
    axiosResponseTime: float, // average of axios response time
    sbResponseTime: float, // average of sb response time
    sbProcessTime: float // average of sb processing time
  },
  15: {
    samples: int, // number of samples
    axiosResponseTime: float, // average of axios response time
    sbResponseTime: float, // average of sb response time
    sbProcessTime: float // average of sb processing time
  }
}
```

`/average/5`  
get 5 minute average
```js
{
  samples: int, // number of samples
  axiosResponseTime: float, // average of axios response time
  sbResponseTime: float, // average of sb response time
  sbProcessTime: float // average of sb processing time
}
```

`/average/15`  
get 15 minute average
```js
{
  samples: int, // number of samples
  axiosResponseTime: float, // average of axios response time
  sbResponseTime: float, // average of sb response time
  sbProcessTime: float // average of sb processing time
}
```

`/raw`  
returns all collected data
```js
[{
  time: int, // node unix time
  axiosResponseTime: int, // ms of http response time
  sbResponseTime: int, // ms of time from sb to receiving response
  sbProcessTime: int, // ms of processing time from sb-server
}]
```