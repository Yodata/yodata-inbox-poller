# yodata-inbox-poller

simple poller for processing messages from a yodata (LDN) inbox.

## Installation

```bash
npm install yodata-inbox-poller --save
```

## Usage

```js
const Poller = require("yodata-inbox-poller");

const app = new Poller({
  inboxURL: "https://dave.yodata.me/inbox/",
  handleMessage: async message => {
    // do some work with `message`
    let result = message;

    // throw to fire 'message:process:failed'
    throw new Error("the message failed to process");

    // always return (with an optional result) to resolve
    // and fire 'message:process:completed'
    return result;
  }
});

app.on("message:process:completed", event => {
  console.log(event);
  // event value:
  // {
  //   type: message:process:completed,
  //   value: (your returned value)
  // }
});

app.on("message:process:failed", event => {
  console.log(event);
  // event value:
  // {
  //   type: message:process:failed
  //   error: [Error: the message failed to process]
  //   value: {
  //     message: {..}
  //   }
  // }
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
const Poller = require("yodata-inbox-poller");
const Inbox = require("yodata-inbox-client");

const customInbox = new Inbox({
  inboxURL: "url"
  headers: {
    "x-api-key": "xxx"
  }
});

const app = new Poller({
  inboxURL: "https://dave.yodata.me/inbox/",
  handleMessage: async (message) => {...},
  inbox: customInbox
});

app.start();
```

## API

### `new Poller(options)`

Creates a new poller.

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

```javascript
// file: /constants.js
// .start()
module.exports.SERVICE_START = "service:start";
// .stop(error value)
module.exports.SERVICE_STOP = "service:stop";
module.exports.SERVICE_STOP_COMPLETED = "service:stop:completed";

// .run(next) main event loop
module.exports.SERVICE_PROCESS_START = "service:process:start";
module.exports.SERVICE_PROCESS_COMPLETED = "service:process:completed";
module.exports.SERVICE_PROCESS_FAILED = "service:process:failed";

// _poll()
module.exports.INBOX_FETCH_COMPLETED = "inbox:fetch:completed";
module.exports.INBOX_FETCH_FAILED = "inbox:fetch:failed";
module.exports.INBOX_EMPTY = "inbox:empty";

// .processResponse(inboxResponse)
module.exports.RESPONSE_PROCESS_COMPLETED = "response:process:completed";
module.exports.RESPONSE_PROCESS_FAILED = "response:process:failed";

// .handleMessage(message)
module.exports.MESSAGE_PROCESS_COMPLETED = "message:process:completed";
module.exports.MESSAGE_PROCESS_FAILED = "message:process:failed";
```
