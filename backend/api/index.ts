import { createApp } from '../src/app';
import serverless from 'serverless-http';

let cachedHandler: any;

export default async function handler(req: any, res: any) {
  if (!cachedHandler) {
    const app = createApp();
    await app.ready();
    cachedHandler = serverless(app.server);
  }
  return cachedHandler(req, res);
}
