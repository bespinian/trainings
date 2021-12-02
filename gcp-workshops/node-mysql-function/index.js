const mysql = require("promise-mysql");
const getSecretLatestVersion = require("./getSecretLatestVersion");

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

let pool;

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.helloWorld = async (req, res) => {
  pool = pool || (await createPoolAndEnsureSchema());

  try {
    const stmt = "SELECT COUNT(vote_id) as count FROM votes WHERE candidate=?";
    const tabsQuery = pool.query(stmt, ["TABS"]);
    const spacesQuery = pool.query(stmt, ["SPACES"]);

    const [tabsVotes] = await tabsQuery;
    const [spacesVotes] = await spacesQuery;

    let message = `${tabsVotes.count} votes for tabs and ${spacesVotes.count} votes for spaces}`;
    res.status(200).send(message);
  } catch (err) {
    logger.error(err);
    res
      .status(500)
      .send(
        "Unable to load page. Please check the application logs for more details."
      );
  }
};
