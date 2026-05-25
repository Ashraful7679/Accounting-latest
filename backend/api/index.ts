import { createApp } from '../src/app';
import serverless from 'serverless-http';

const app = createApp();

export const handler = serverless(app);
export default handler;
