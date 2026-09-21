// Vercel automatically turns any file under /api into a serverless function.
// This one just hands off to the same Express app used everywhere else -
// see vercel.json for how every /api/* request gets routed here.
import app from '../server.js';

export default app;

