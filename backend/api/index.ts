import { createApp } from '../src/app';

const app = createApp();
const ready = app.ready();
let initialized = false;

export default async function handler(req: any, res: any) {
  if (!initialized) {
    await ready;
    initialized = true;
  }
  app.server.emit('request', req, res);
}
