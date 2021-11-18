// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use strict";

const express = require("express");
const mysql = require("promise-mysql");
const getSecretLatestVersion = require("./getSecretLatestVersion");

const app = express();
app.set("view engine", "pug");
app.enable("trust proxy");

// Automatically parse request body as form data.
app.use(express.urlencoded({ extended: false }));
// This middleware is available in Express v4.16.0 onwards
app.use(express.json());

// Set Content-Type for all responses for these routes.
app.use((req, res, next) => {
  res.set("Content-Type", "text/html");
  next();
});

// Create a Winston logger that streams to Stackdriver Logging.
const winston = require("winston");
const { LoggingWinston } = require("@google-cloud/logging-winston");
const loggingWinston = new LoggingWinston();
const logger = winston.createLogger({
  level: "info",
  transports: [new winston.transports.Console(), loggingWinston],
});

const createPool = async () => {
  const config = {
    // [START cloud_sql_mysql_mysql_limit]
    // 'connectionLimit' is the maximum number of connections the pool is allowed
    // to keep at once.
    connectionLimit: 5,
    // [END cloud_sql_mysql_mysql_limit]

    // [START cloud_sql_mysql_mysql_timeout]
    // 'connectTimeout' is the maximum number of milliseconds before a timeout
    // occurs during the initial connection to the database.
    connectTimeout: 10000, // 10 seconds
    // 'acquireTimeout' is the maximum number of milliseconds to wait when
    // checking out a connection from the pool before a timeout error occurs.
    acquireTimeout: 10000, // 10 seconds
    // 'waitForConnections' determines the pool's action when no connections are
    // free. If true, the request will queued and a connection will be presented
    // when ready. If false, the pool will call back with an error.
    waitForConnections: true, // Default: true
    // 'queueLimit' is the maximum number of requests for connections the pool
    // will queue at once before returning an error. If 0, there is no limit.
    queueLimit: 0, // Default: 0
    // [END cloud_sql_mysql_mysql_timeout]

    // [START cloud_sql_mysql_mysql_backoff]
    // The mysql module automatically uses exponential delays between failed
    // connection attempts.
    // [END cloud_sql_mysql_mysql_backoff]
  };

  if (process.env.GCP_PROJECT_NUMBER) {
    const secretBasePath = `projects/${process.env.GCP_PROJECT_NUMBER}/secrets`;

    const dbHostPromise = getSecretLatestVersion(`${secretBasePath}/db_host`);
    const dbNamePromise = getSecretLatestVersion(`${secretBasePath}/db_name`);
    const dbUserPromise = getSecretLatestVersion(`${secretBasePath}/db_user`);
    const dbPasswordPromise = getSecretLatestVersion(
      `${secretBasePath}/db_password`
    );

    const [dbHost, dbName, dbUser, dbPassword] = await Promise.all([
      dbHostPromise,
      dbNamePromise,
      dbUserPromise,
      dbPasswordPromise,
    ]);

    const dbSocketAddr = dbHost.split(":");
    config.host = dbSocketAddr[0];
    config.port = dbSocketAddr[1];

    config.database = dbName;
    config.user = dbUser;
    config.password = dbPassword;
  } else {
    const dbSocketAddr = process.env.DB_HOST.split(":");
    config.host = dbSocketAddr[0];
    config.port = dbSocketAddr[1];

    config.database = process.env.DB_NAME;
    config.user = process.env.DB_USER;
    config.password = process.env.DB_PASS;
  }
  return mysql.createPool(config);
};

const ensureSchema = async (pool) => {
  // Wait for tables to be created (if they don't already exist).
  await pool.query(
    `CREATE TABLE IF NOT EXISTS votes
      ( vote_id SERIAL NOT NULL, time_cast timestamp NOT NULL,
      candidate CHAR(6) NOT NULL, PRIMARY KEY (vote_id) );`
  );
  console.log("Ensured that table 'votes' exists");
};

const createPoolAndEnsureSchema = async () =>
  await createPool()
    .then(async (pool) => {
      await ensureSchema(pool);
      return pool;
    })
    .catch((err) => {
      logger.error(err);
      throw err;
    });

// Set up a variable to hold our connection pool. It would be safe to
// initialize this right away, but we defer its instantiation to ease
// testing different configurations.
let pool;

app.use(async (req, res, next) => {
  if (pool) {
    return next();
  }
  try {
    pool = await createPoolAndEnsureSchema();
    next();
  } catch (err) {
    logger.error(err);
    return next(err);
  }
});

// Serve the index page, showing vote tallies.
app.get("/", async (req, res) => {
  pool = pool || (await createPoolAndEnsureSchema());
  try {
    // Get the 5 most recent votes.
    const recentVotesQuery = pool.query(
      "SELECT candidate, time_cast FROM votes ORDER BY time_cast DESC LIMIT 5"
    );

    // Get votes
    const stmt = "SELECT COUNT(vote_id) as count FROM votes WHERE candidate=?";
    const tabsQuery = pool.query(stmt, ["TABS"]);
    const spacesQuery = pool.query(stmt, ["SPACES"]);

    // Run queries concurrently, and wait for them to complete
    // This is faster than await-ing each query object as it is created
    const recentVotes = await recentVotesQuery;
    const [tabsVotes] = await tabsQuery;
    const [spacesVotes] = await spacesQuery;

    res.render("index.pug", {
      recentVotes,
      tabCount: tabsVotes.count,
      spaceCount: spacesVotes.count,
    });
  } catch (err) {
    logger.error(err);
    res
      .status(500)
      .send(
        "Unable to load page. Please check the application logs for more details."
      )
      .end();
  }
});

// Handle incoming vote requests and inserting them into the database.
app.post("/", async (req, res) => {
  const { team } = req.body;
  const timestamp = new Date();

  if (!team || (team !== "TABS" && team !== "SPACES")) {
    return res.status(400).send("Invalid team specified.").end();
  }

  pool = pool || (await createPoolAndEnsureSchema());
  // [START cloud_sql_mysql_mysql_connection]
  try {
    const stmt = "INSERT INTO votes (time_cast, candidate) VALUES (?, ?)";
    // Pool.query automatically checks out, uses, and releases a connection
    // back into the pool, ensuring it is always returned successfully.
    await pool.query(stmt, [timestamp, team]);
  } catch (err) {
    // If something goes wrong, handle the error in this section. This might
    // involve retrying or adjusting parameters depending on the situation.
    // [START_EXCLUDE]
    logger.error(err);
    return res
      .status(500)
      .send(
        "Unable to successfully cast vote! Please check the application logs for more details."
      )
      .end();
    // [END_EXCLUDE]
  }
  // [END cloud_sql_mysql_mysql_connection]

  res.status(200).send(`Successfully voted for ${team} at ${timestamp}`).end();
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});

process.on("unhandledRejection", (err) => {
  console.error(err);
  throw err;
});

module.exports = server;
