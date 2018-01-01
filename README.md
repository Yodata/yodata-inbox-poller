# yodata-inbox-poller

simple poller for processing messages from a yodata (LDN) inbox. 

## Installation

```bash
npm install yodata-inbox-poller --save
```

## Usage

```js
const Poller = require('yodata-inbox-poller');

const app = Poller.create({
  inboxURL: 'https://dave.yodata.me/inbox/',
  handleMessage: (message, done) => {
    // do some work with `message`
    done();
    // return an error message 
    done('error message'); // will prevent message from being deleted
  }
});

app.on('error', (err) => {
  console.log(err.message);
});

app.start();
```

* The queue is polled continuously for messages.
* Messages are deleted from the inbox once `done()` is called.
* Calling `done(err)` with an error object will cause the message to be left in the box.
* By default messages are processed one at a time – a new message won't be received until the first one has been processed.

### Credentials

By default the poller will look for your api-key in process.env.YODATA_API_KEY

```bash
export YODATA_API_KEY=...
```

If you need to specify your credentials manually, you can use a pre-configured inbox instance.

```js
const poller = require('yodata-inbox-poller');
const Inbox = require('yodata-inbox-client');

const inbox = new Inbox({
  headers: {
    'x-api-key': "xxx"
  }
});

const app = poller.create({
  inboxURL: 'https://dave.yodata.me/inbox/',
  handleMessage: (message, done) => {
    // ...
    done();
  },
  inbox: inbox
});

app.on('error', (err) => {
  console.log(err.message);
});

app.start();
```

## API

### `poller.create(options)`

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

|Event|Params|Description|
|-----|------|-----------|
|`error`|`err`, `[message]`|Fired when an error occurs interacting with the queue. If the error correlates to a message, that error is included in Params|
|`processing_error`|`err`, `message`|Fired when an error occurs processing the message.|
|`message_received`|`message`|Fired when a message is received.|
|`message_processed`|`message`|Fired when a message is successfully processed and removed from the queue.|
|`response_processed`|None|Fired after one batch of items (up to `batchSize`) has been successfully processed.|
|`stopped`|None|Fired when the poller finally stops its work.|
|`empty`|None|Fired when the queue is empty (All messages have been consumed).|

