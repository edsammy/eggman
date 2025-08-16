import { Hono } from 'hono';

const app = new Hono();

app.get('/hello', c => {
  return c.text('Hello World!');
});

export default app;
