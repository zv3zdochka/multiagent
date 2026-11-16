import {createServer} from 'node:http';
import {Writable} from 'node:stream';
import worker from '../dist/server/index.js';

const origin = 'http://127.0.0.1:8765';
createServer(async (incoming, outgoing) => {
  try {
    const request = new Request(origin + incoming.url, {
      method: incoming.method,
      headers: incoming.headers,
      ...(incoming.method === 'POST' ? {body: incoming, duplex: 'half'} : {}),
    });
    const response = await worker.fetch(request, process.env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) await response.body.pipeTo(Writable.toWeb(outgoing));
    else outgoing.end();
  } catch (error) {
    console.error(error.message);
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end();
  }
}).listen(8765, '127.0.0.1', () => console.log(origin));
