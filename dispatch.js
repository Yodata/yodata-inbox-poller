const EventEmitter = require('events').EventEmitter;
const assert = require('assert');

class Dispatch extends EventEmitter {
  constructor() {
    super();
  }

  send(type, value, error) {
    assert.ok(type, 'type is required');
    let event = { type };
    if (value) event.value = value;
    if (error) event.error = error;
    this.emit('dispatch', event);
    return event;
  }

  error(type, error, value) {
    assert.ok(type, 'type is required');
    let event = { type };
    if (error) {
      event.error = (typeof error === 'string')
          ? new Error(error)
          : error;
    }
    if (value) event.value = value;
    this.emit('dispatch', event);
    return event;
  }

  event(event) {
    assert.ok(event, 'event is required');
    if (typeof event === 'string') {
      this.emit('dispatch', {type: event});
      return {type: event};
    }
    assert.ok(event.type, 'event.type is required');
    this.emit('dispatch', event);
    return event;
  }
}

const dispatch = new Dispatch();

module.exports = dispatch;
