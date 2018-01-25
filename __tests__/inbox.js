const expect = require('expect');
const Inbox = require('../inbox');

describe('Inbox', () => {
  let inbox;
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
  const axiosGetResponse = {
    status:     200,
    statusText: 'OK',
    request:    {
      url: inboxURL
    },
    response:   {
      headers: {}
    },
    data:       {
      id:       inboxURL,
      contains: [message1, message2]
    }
  };

  beforeEach(() => {
    inboxURL = 'some-url';
    inbox = new Inbox({inboxURL});
  });

  describe('.get(url)', () => {

    test(`inbox.get default response`, async () => {
      inbox._inbox.get = jest.fn().mockReturnValue(Promise.resolve(axiosGetResponse));
      return expect(inbox.get()).resolves.toMatchObject({
        type:   'inbox:fetch:completed',
        object: inboxURL,
        result: {
          status:   200,
          messages: expect.any(Array)
        }
      })
    });

    test(`inbox.get(URL) overrides the inbox.inboxURL`, async () => {
      let url = 'http://httpbin.org/status/200';
      return expect(inbox.get(url)).rejects.toMatchObject({
        type:   'inbox:fetch:failed',
        object: url,
        error:  'inbox.response.contains (array) is required',
        result: {
          status: 200
        }
      })
    });

    test('inbox.get rejects on timeout', async () => {
      return expect(inbox.get('/status/408')).rejects.toMatchObject({
        type: 'inbox:fetch:failed'
      });
    });

    test('inbox.get rejects on auth errors', async () => {
      inboxURL = 'http://httpbin.org/status/403';
      return expect(inbox.get(inboxURL)).rejects.toMatchObject({
        type:   'inbox:fetch:failed',
        object: inboxURL,
        result: {
          status:     403,
          statusText: 'FORBIDDEN'
        },
      });
    });

    test(`inbox.get rejects on unrecognized response format`, async () => {
      let inboxURL = 'http://httpbin.org/status/200';
      return expect(inbox.get(inboxURL)).rejects.toMatchObject({
        type:   'inbox:fetch:failed',
        object: inboxURL,
        error:  'inbox.response.contains (array) is required',
        result: {
          status:     200,
          statusText: 'OK'
        }
      })
    });
  });
});
