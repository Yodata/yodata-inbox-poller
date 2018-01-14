const expect = require('expect');
const Inbox = require('../inbox');
const axios = require('axios');

describe('Inbox', () => {
  const httpBin = axios.create({baseURL: 'http://httpbin.org'});
  httpBin.getStatus = function(code) {
    return this.get(`/status/${code}`);
  };

  let inbox, getOutput, _inbox;
  let inboxURL = 'some-url';
  const message1 = {
    id:         '1',
    type:       'Notification',
    instrument: 'message-instrument',
    target:     'message-target',
    object:     {
      type: 'action-type'
    }
  };
  const message2 = {
    id:         '2',
    type:       'Notification',
    instrument: 'message-instrument',
    target:     'message-target',
    object:     {
      type: 'action-type'
    }
  };
  const axiosGetOutput = {
    status:     200,
    statusText: 'OK',
    request:    {
      url: 'some-url'
    },
    response:   {
      headers: {}
    },
    data:       {
      id:       'some-url',
      contains: [message1, message2]
    }
  };
  beforeEach(() => {
    _inbox = jest.genMockFromModule('../inbox');
    _inbox.get = jest.fn().mockReturnValue(Promise.resolve(axiosGetOutput));
    inbox = new Inbox({inboxURL, inbox: _inbox});
    getOutput = {
      status:   200,
      messages: [message1, message2]
    };
  });

  describe('.get', () => {

    beforeEach(() => {
      inboxURL = 'http://httpbin.org';
      inbox = new Inbox({inboxURL})
    });

    test(`.get default response`, async () => {
      inbox._inbox.get = jest.fn().mockReturnValue(Promise.resolve(axiosGetOutput));
      let expected = expect.objectContaining({
        status:     expect.any(Number),
        statusText: expect.any(String),
        messages:   expect.any(Array)
      });
      return expect(await inbox.get()).toMatchObject(expected);
    });

    test(`.get(url) override the target URL`, async () => {
      let response = await inbox.get('http://httpbin.org/status/200');
      expect(response).toMatchObject({
        status:     200,
        statusText: 'OK',
        error:      expect.any(Error)
      })
    });

    test(`.get(path) gets the page relative to the inboxURL `, async () => {
      expect(inbox.inboxURL).toEqual('http://httpbin.org');
      let response = await inbox.get('/status/418');
      expect(response).toMatchObject({
        status:     418,
        statusText: "I'M A TEAPOT",
        error:      expect.any(Error)
      })
    });

    test('.get timeout', async () => {
      let output = await inbox.get('/status/408');
      expect(output).toMatchObject({
        status:     408,
        statusText: 'REQUEST TIMEOUT',
        error:      expect.any(Error),
      });
    });

    test('Handles 403 (Forbidden)', async () => {
      inbox._inbox.get = () => httpBin.getStatus(403);
      let output = await inbox.get();
      expect(output).toMatchObject({
        status:     403,
        statusText: 'FORBIDDEN',
        error:      expect.any(Error)
      });
    });

    test('Handles 401 (Unauthorized)', async () => {
      inbox._inbox.get = () => httpBin.getStatus(401);
      let output = await inbox.get();
      expect(output).toMatchObject({
        status:     401,
        statusText: 'UNAUTHORIZED',
        error:      expect.any(Error)
      });
    });

    test(`.get handles unexpected errors`, async () => {
      let inbox = new Inbox({inboxURL: 'http://watch.me.fail'});
      let output = await inbox.get();
      expect(output).toMatchObject({
        statusText: 'Network Error',
        error:      expect.any(Error)
      })
    });

    test(`.get response with no data returns an error`, async () => {
      _inbox.get = jest.fn().mockReturnValue(Promise.resolve({status: 200, statusText: 'OK'}));
      let expected = expect.objectContaining({
        status:     200,
        statusText: 'OK',
        error:      expect.any(Error)
      });
      let received = await inbox.get();
      return expect(received).toMatchObject(expected)
    });

    test(`.get response with no messages returns an error`, async () => {
      _inbox.get = jest.fn().mockReturnValue(Promise.resolve({status: 200, statusText: 'OK', data: {}}));
      let expected = expect.objectContaining({
        status:     200,
        statusText: 'OK',
        error:      expect.any(Error)
      });
      let received = await inbox.get();
      return expect(received).toMatchObject(expected)
    });
  });
});
