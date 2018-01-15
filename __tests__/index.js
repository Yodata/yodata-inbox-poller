"use strict";
const expect = require("expect");
const sinon = require("sinon");

const {
  SERVICE_START,
  SERVICE_PROCESS_START,
  INBOX_FETCH_FAILED,
  INBOX_EMPTY,
  INBOX_FETCH_COMPLETED,
  MESSAGE_PROCESS_FAILED,
  MESSAGE_PROCESS_COMPLETED,
  SERVICE_PROCESS_FAILED,
  SERVICE_PROCESS_COMPLETED,
  SERVICE_STOP,
  SERVICE_STOP_COMPLETED,
  RESPONSE_PROCESS_COMPLETED,
  RESPONSE_PROCESS_FAILED
} = require("../constants");

const Poller = require("..");
const inbox = jest.genMockFromModule("../inbox");

describe("Poller", () => {
  let poller,
    handleMessage,
    inboxURL,
    waitTimeSeconds,
    pollerConfig,
    onServiceStart,
    onServiceProcessCompleted,
    onServiceProcessFailed,
    onInboxFetchFailed,
    onInboxFetchCompleted,
    onServiceProcessStart,
    onInboxEmpty,
    onMessageProcessCompleted,
    onMessageProcessFailed,
    onServiceStop,
    onServiceStopCompleted,
    handleMessageResponse,
    message,
    inboxResponse;

  beforeEach(() => {
    message = { id: "messageid", type: "message-type" };
    inboxResponse = {
      status: 200,
      messages: [message, message]
    };
    inbox.get = sinon.stub().resolves(inboxResponse);
    handleMessageResponse = "handle-message-response";
    handleMessage = jest
      .fn()
      .mockReturnValue(Promise.resolve(handleMessageResponse));

    onServiceStart = jest.fn().mockName(SERVICE_START);
    onInboxFetchCompleted = jest.fn().mockName(INBOX_FETCH_COMPLETED);
    onInboxFetchFailed = jest.fn().mockName(INBOX_FETCH_FAILED);
    onMessageProcessCompleted = jest.fn().mockName(MESSAGE_PROCESS_COMPLETED);
    onMessageProcessFailed = jest.fn().mockName(MESSAGE_PROCESS_FAILED);
    onServiceProcessStart = jest.fn().mockName(SERVICE_PROCESS_START);
    onServiceStop = jest.fn().mockName(SERVICE_STOP);
    onServiceStopCompleted = jest.fn().mockName(SERVICE_STOP_COMPLETED);

    inboxURL = "some-url";
    waitTimeSeconds = 1;
    pollerConfig = {
      inboxURL,
      inbox,
      handleMessage,
      waitTimeSeconds
    };
    poller = new Poller(pollerConfig);
  });

  afterEach(() => {
    poller.removeAllListeners();
  });

  describe("._handleDispatch", () => {
    let handler, event;

    beforeEach(() => {
      handler = jest.fn();
      poller.on("foo", handler);
    });

    test(`._handleDispatch(event) emits(event.type, event)`, () => {
      event = { type: "foo" };
      poller._handleDispatch(event);
      expect(handler).toHaveBeenCalledWith(event);
    });

    test(`._handleDispatch(event) no event.type does not emit`, () => {
      event = "nofoo";
      poller._handleDispatch(event);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe(".create", () => {
    test(`.create(inboxURL, handleMessage)`, () => {
      let inboxURL = "create-test";
      let handleMessage = () => "create-test";
      let poller = Poller.create(inboxURL, handleMessage);
      expect(poller).toBeInstanceOf(Poller);
      expect(poller.inboxURL).toBe(inboxURL);
      expect(poller.handleMessage).toEqual(handleMessage);
    });

    test(`.contructor inboxURL is required`, () => {
      expect(() => new Poller()).toThrow("inboxURL is required");
    });

    test(`.contructor handleMessage is required`, () => {
      expect(() => new Poller({ inboxURL })).toThrow(
        "handleMessage is required"
      );
    });
  });

  describe("._poll", () => {
    let inboxResponseError, message, inboxResponse, inboxResponseEmpty;

    beforeEach(() => {
      message = { id: "messageid", type: "message-type" };
      inboxResponse = {
        status: 200,
        messages: [message, message]
      };
      inboxResponseEmpty = {
        status: 200,
        messages: []
      };
      inboxResponseError = {
        statusText: "Network Error",
        error: new Error("Network Error"),
        result: {
          statusText: "Network Error",
          error: {
            message: "Network Error"
          }
        }
      };
      poller.on(INBOX_FETCH_COMPLETED, onInboxFetchCompleted);
      poller.on(INBOX_FETCH_FAILED, onInboxFetchFailed);
    });

    test(".poll success resolves/emits inbox:fetch:completed", async () => {
      inbox.get = jest.fn().mockReturnValue(inboxResponse);
      let expected = {
        type: INBOX_FETCH_COMPLETED,
        result: {
          status: 200,
          messages: expect.any(Array)
        }
      };
      expect(await poller._poll()).toMatchObject(expected);
      expect(onInboxFetchCompleted).toHaveBeenCalledWith(expected);
      expect.assertions(2);
    });

    test(".poll errors resolves/emits inbox:fetch:failed", async () => {
      let response = inboxResponseError;
      inbox.get = jest.fn().mockReturnValue(Promise.resolve(response));
      let expected = {
        type: INBOX_FETCH_FAILED,
        error: new Error(response.error.message),
        result: response
      };
      let received = await poller._poll();
      expect(received).toMatchObject(expected);
      expect(onInboxFetchFailed).toHaveBeenCalledWith(expected);
      expect.assertions(2);
    });

    test(`.poll handles inbox.get rejects`, async () => {
      let error = new Error("polling-error");
      poller.inbox.get = jest.fn().mockReturnValue(Promise.reject(error));
      let expected = {
        type: INBOX_FETCH_FAILED,
        error: error,
        result: "polling-error"
      };
      poller._poll().catch(received => {
        expect(received).toMatchObject(expected);
      });
    });

    test(`.poll handles network errors`, async () => {
      inbox.get = sinon.stub().resolves(inboxResponseError);
      let expected = {
        type: INBOX_FETCH_FAILED,
        error: new Error(inboxResponseError.statusText),
        result: inboxResponseError
      };
      let received = await poller._poll();
      expect(received).toMatchObject(expected);
    });
  });

  describe("._processMessage", () => {
    beforeEach(() => {
      poller.on(MESSAGE_PROCESS_COMPLETED, onMessageProcessCompleted);
      poller.on(MESSAGE_PROCESS_FAILED, onMessageProcessFailed);
    });

    afterEach(() => {
      poller.removeListener(
        MESSAGE_PROCESS_COMPLETED,
        onMessageProcessCompleted
      );
      poller.removeListener(MESSAGE_PROCESS_FAILED, onMessageProcessFailed);
    });

    test("._processMessage returns a promise", () => {
      let response = poller._processMessage(message);
      expect(response).toBeInstanceOf(Promise);
    });

    test(`._processMessage returns/emits message:process:completed`, async () => {
      let result = await poller.handleMessage(message);
      let expected = {
        type: MESSAGE_PROCESS_COMPLETED,
        object: message,
        result: result
      };
      let response = await poller._processMessage(message);
      expect(response).toMatchObject(expected);
      expect(onMessageProcessCompleted).toHaveBeenCalledWith(expected);
    });

    test(`._processMessage returns/emits message:process:failed when handler rejects`, async () => {
      poller.handleMessage = sinon.stub().rejects("error-message");
      let expected = expect.objectContaining({
        type: MESSAGE_PROCESS_FAILED,
        object: message
      });
      let response = await poller._processMessage(message);
      expect(response).toMatchObject(expected);
    });

    test(`._processMessage returns/emits message:process:failed when handler throws`, async () => {
      poller.handleMessage = sinon.stub().throws();
      let expected = {
        type: MESSAGE_PROCESS_FAILED,
        object: message
      };
      let response = await poller._processMessage(message);
      expect(response).toMatchObject(expected);
    });
  });

  describe("._processResponse", () => {
    let onResponseProcessCompleted, onResponseProcessFailed;
    beforeEach(() => {
      onResponseProcessCompleted = jest.fn();
      onResponseProcessFailed = jest.fn();
      onInboxEmpty = jest.fn().mockName(INBOX_EMPTY);
      poller.on(INBOX_EMPTY, onInboxEmpty);
      poller.on(RESPONSE_PROCESS_COMPLETED, onResponseProcessCompleted);
      poller.on(RESPONSE_PROCESS_FAILED, onResponseProcessFailed);
    });
    afterEach(() => {
      poller.removeListener(INBOX_EMPTY, onInboxEmpty);
      poller.removeListener(
        RESPONSE_PROCESS_COMPLETED,
        onResponseProcessCompleted
      );
      poller.removeListener(RESPONSE_PROCESS_FAILED, onResponseProcessFailed);
    });

    test(`._processResponse - anything not {type: inbox:fetch:completed} is passed through`, async () => {
      let input = {
        foo: "bar"
      };
      let output = await poller._processResponse(input);
      expect(output).toEqual(input);
      expect(onInboxEmpty).not.toHaveBeenCalled();
      expect(onResponseProcessFailed).not.toHaveBeenCalled();
      expect(onResponseProcessCompleted).not.toHaveBeenCalled();
    });
    test(`._processResponse - fires inbox:empty when no messages are returned`, async () => {
      let emptyInboxResponse = {
        type: INBOX_FETCH_COMPLETED,
        result: {
          messages: []
        }
      };
      let expected = { type: INBOX_EMPTY };
      let output = await poller._processResponse(emptyInboxResponse);
      expect(output).toMatchObject(expected);
      expect(onInboxEmpty).toHaveBeenCalled();
    });
    test(`._processResponse - throws response:process:failed on unexpected input`, async () => {
      await poller._processResponse(undefined).catch(error => {
        expect(error).toHaveProperty(
          "message",
          "processMessages received an unexpected response from inbox"
        );
        expect(onResponseProcessFailed).toHaveBeenCalled();
      });
      await poller
        ._processResponse({
          type: INBOX_FETCH_COMPLETED,
          result: { messages: "oops" }
        })
        .catch(error => {
          expect(error).toHaveProperty(
            "message",
            "an unexpected error occurred while processing messages"
          );
          expect(onResponseProcessFailed).toHaveBeenCalled();
        });
    });
  });

  describe(".run", () => {
    beforeEach(() => {
      onServiceProcessFailed = jest.fn();
      onServiceProcessCompleted = jest.fn();
      poller.on(SERVICE_PROCESS_COMPLETED, onServiceProcessCompleted);
      poller.on(SERVICE_PROCESS_FAILED, onServiceProcessFailed);
      poller.stopped = false;
    });

    afterEach(() => {
      poller.removeListener(
        SERVICE_PROCESS_COMPLETED,
        onServiceProcessCompleted
      );
      poller.removeListener(SERVICE_PROCESS_FAILED, onServiceProcessFailed);
    });

    test(".run(callback) - callback signature (error, result)", done => {
      let expected = expect.objectContaining({
        type: SERVICE_PROCESS_COMPLETED,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        result: expect.objectContaining({
          type: expect.any(String)
        })
      });
      poller.run(function(error, result) {
        console.log(result);
        expect(error).toBeFalsy();
        expect(result).toMatchObject(expected);
        done();
      });
    });

    test(".run() does not wait if messages were processed", done => {
      let onWait = jest.fn().mockName("onWait");
      poller.on("service:wait", onWait);
      poller._processMessages = jest
        .fn()
        .mockReturnValue(Promise.resolve({ type: RESPONSE_PROCESS_COMPLETED }));
      poller.run((error, result) => {
        expect(onWait).not.toBeCalled();
        done();
      });
    });

    test(`.run() polling errors are passed to final result`, done => {
      poller._poll = sinon.stub().resolves({ type: INBOX_FETCH_FAILED });
      poller.run(function(error, event) {
        expect(error).toBeFalsy();
        expect(event.result).toMatchObject({ type: INBOX_FETCH_FAILED });
        done();
      });
    });

    test(`.run() stops when processResponse throws an error`, () => {
      poller._processResponse = sinon.stub().throws();
      poller.run(function(error) {
        expect(error).toBeTruthy();
        expect(poller.stopped).toBeTruthy();
        done();
      });
    });
  });

  describe(".stop", () => {
    beforeEach(() => {
      poller.stopped = false;
      poller.on(SERVICE_STOP, onServiceStop);
      poller.on(SERVICE_STOP_COMPLETED, onServiceStopCompleted);
    });

    test(".stop stops the poller polling for messages", () => {
      poller.stop();
      expect(poller.stopped).toBeTruthy();
    });

    test(`.stop fires service:stop {error, value}`, () => {
      let expected = {
        type: SERVICE_STOP,
        error: expect.any(Error)
      };
      poller.stop(new Error());
      expect(onServiceStop).toBeCalledWith(expect.objectContaining(expected));
    });

    test(`.stop fires service:stop:completed on next itteration of .run`, done => {
      poller.stopped = true;
      poller.on(SERVICE_STOP_COMPLETED, event => {
        expect(event).toMatchObject({ type: SERVICE_STOP_COMPLETED });
        done();
      });
      poller.run(poller._exit);
    });
  });

  describe(".start", () => {
    beforeEach(() => {
      onServiceStart = jest.fn();
      poller.on(SERVICE_START, onServiceStart);
      poller.inbox.get = jest
        .fn()
        .mockReturnValueOnce(Promise.resolve({ messages: [message, message] }))
        .mockReturnValueOnce(Promise.resolve({ messages: [] }));
    });

    afterEach(() => {
      poller.removeAllListeners();
    });

    test(`.start - toggles .stopped`, done => {
      expect.assertions(2);
      expect(poller.stopped).toBeTruthy();
      poller.on("service:start", () => {
        expect(poller.stopped).toBeFalsy();
        done();
      });
      poller.start();
    });

    test(`.start - fires service:start`, done => {
      let serviceStartMatcher = {
        type: SERVICE_START,
        startTime: expect.any(Number)
      };
      poller.on(SERVICE_START, e => {
        expect(e).toMatchObject(serviceStartMatcher);
        done();
      });
      poller.start();
      poller.stop();
    });

    test(`.start - does not create additional workers if start is called more than once.`, () => {
      poller.start();
      poller.start();
      expect(onServiceStart).toHaveBeenCalledTimes(1);
    });
  });
});
