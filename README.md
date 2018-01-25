# yodata-inbox-poller

simple poller for processing messages from a yodata (LDN) inbox.

## Installation

```bash
npm install yodata-inbox-poller --save
```

## Usage

```js
const Service = require('yodata-inbox-poller');
const inboxURL = 'https://hsf-test.ds.bhhsresource.com/inbox/';

async function handleMessage(message) {
  // do something with the message;
  // optionally return an event
  return {
    type: 'Action',
    actionStatus: 'CompletedActionStatus',
    object: message,
    result: 'some result value'
  }
}

const app = Service.create(inboxURL, handleMessage);

app.on('dispatch', event => {
  switch (event.type) {
    case Service.eventType.MESSAGE_PROCESS_COMPLETED:
      console.log(event.type, event.result);
      break;
    case Service.eventType.MESSAGE_PROCESS_FAILED:
      console.log(event.type, event.result);
      break;
    default:
      console.log(event.type);
  }
});

app.start();
```

* The queue is polled continuously for messages.
* By default messages are processed one at a time – a new message won't be received until the first one has been processed.

### Credentials

By default the poller will look for your api-key in process.env.YODATA_API_KEY

```bash
export YODATA_API_KEY=...
```

If you need to specify your credentials manually, you can use a pre-configured inbox instance.

```js
const Service = require("yodata-inbox-poller");

const customInbox = {
  async get(url){
    try {
      // fetch results and return in the following schema
      return {
        type: 'inbox:fetch:completed',
        object: url,
        result: {
          messages: [] // array of fetched messages
      }}  
    }
    catch (error) {
      throw {
        type: 'inbox:fetch:failed',
        object: url,
        error: error.message,
        result: {
          error: error
        }
      }
    }
  }
};


const app = new Service({
  inboxURL: "https://dave.yodata.me/inbox/",
  handleMessage: handleMessage,
  inbox: customInbox
});

app.start();
```

## API

### `new Poller(options)`

Creates a new poller Service.

#### Options

* `inboxURL` - _String_ - The inbox URL
* `handleMessage` - _Function_ - A function to be called whenever a message is received.
* `inbox` - _Object_ optional pre-configured inbox to use (useful for testing with a mocked inbox);

### `poller.start()`

Start polling for messages.

### `poller.stop()`

Stop polling for messages.

### Events

Each poller is an [`EventEmitter`](http://nodejs.org/api/events.html) and emits the following events:

```markdown
// .start()
.emit("service:start") 

// .stop(error)
.emit("service:stop")
.emit("service:stop:completed")

// .run(next) main event loop
.emit("service:process:start")
.emit("service:process:completed")
.emit("service:process:failed")

// _poll()
.emit("inbox:fetch:completed");
.emit("inbox:fetch:failed")
.emit("inbox:empty")

// .processResponse(inboxResponse)
.emit("response:process:completed")
.emit("response:process:failed")

// .handleMessage(message)
.emit("message:process:completed")
.emit("message:process:failed")
```
