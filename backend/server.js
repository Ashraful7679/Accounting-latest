const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Minimal Node.js server is RUNNING on Namecheap\n');
});
const port = process.env.PORT || 5002;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
