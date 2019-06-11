const dotenv = require("dotenv");
const express = require("express");
const jwt = require('jsonwebtoken');

dotenv.config();
const app = express();

const { AUTH_KEY, APPLE_TEAM_ID, MAPKIT_KEY_ID, PORT } = process.env;
console.log("ENV 1" + process.env.APPLE_TEAM_ID)
const header = {
  kid: process.env.MAPKIT_KEY_ID,
  typ: 'JWT',
  alg: 'ES256'
};

app.use(express.static("public"));

app.get('/token', (req, res, next) => {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  next()
}, (req, res) => {
  const payload = {
    iss: process.env.APPLE_TEAM_ID,
    iat: Date.now() / 1000,
    exp: (Date.now() / 1000) +1800,
  };

  res.send(jwt.sign(payload, process.env.AUTH_KEY, { header }));
})

app.listen(process.env.PORT, () => {
  console.log(`Server started on port ${process.env.PORT}`);
});
