const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Accept-Profile', 'Content-Profile', 'Prefer']
}));

app.use('/', createProxyMiddleware({
  target: 'https://aupwdgizvokpqcyfsnnu.supabase.co',
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('host', 'aupwdgizvokpqcyfsnnu.supabase.co');
    }
  }
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
