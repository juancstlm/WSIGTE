const dotenv = require("dotenv");
const express = require("express");

dotenv.config();
const app = express();

const {PORT} = process.env;

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
