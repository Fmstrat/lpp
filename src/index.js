const { LemmyHttp } = require("lemmy-js-client");
const { Pool } = require('pg');
const { purgePictrs } = require('./pictrs')

const localUrl = process.env.LOCAL_URL;
const localUsername = process.env.LOCAL_USERNAME;
const localPassword = process.env.LOCAL_PASSWORD;
const purgeOlderThanDays = parseInt(process.env.PURGE_OLDER_THAN_DAYS);
const hoursBetweenPurges = parseInt(process.env.HOURS_BETWEEN_PURGES);
const purgeBatchSize = parseInt(process.env.PURGE_BATCH_SIZE) || 100;

const purgePictrsOlderThanDays = process.env.PICTRS_RM_OLDER_THAN_DAYS ? parseInt(process.env.PICTRS_RM_OLDER_THAN_DAYS) : null;
const pictrsServerApiToken = process.env.PICTRS_SERVER_API_TOKEN ? process.env.PICTRS_SERVER_API_TOKEN : null;
const pictrsUrl = process.env.PICTRS_URL ? process.env.PICTRS_URL : null;

const pgHost = process.env.PG_HOST;
const pgDatabase = process.env.PG_DATABASE ?? process.env.PG_USERNAME;
const pgPort = process.env.PG_PORT;
const pgUsername = process.env.PG_USERNAME;
const pgPassword = process.env.PG_PASSWORD;

const pool = new Pool({
  host: pgHost,
  port: pgPort,
  database: pgDatabase,
  user: pgUsername,
  password: pgPassword,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

function sleep(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}

async function getPosts() {
  const result = await pool.query(`
    SELECT id
    FROM post
    WHERE ap_id NOT LIKE $1
    AND published < NOW() - INTERVAL '${purgeOlderThanDays} days'
    AND id NOT IN (
      SELECT post_id
      FROM post_saved
      UNION
      SELECT post_id
      FROM post_like
      WHERE person_id IN (
          SELECT id
          FROM person
          WHERE actor_id LIKE $1
      )
      UNION
      SELECT post_id
      FROM post_read
      WHERE person_id IN (
          SELECT id
          FROM person
          WHERE actor_id LIKE $1
      )
      UNION
      SELECT post_id
      FROM comment
      WHERE creator_id IN (
          SELECT id
          FROM person
          WHERE actor_id LIKE $1
      )
      UNION
      SELECT post_id
      FROM comment_like
      WHERE person_id IN (
          SELECT id
          FROM person
          WHERE actor_id LIKE $1
      )
      UNION
      SELECT post_id
      FROM comment
      WHERE id IN (
          SELECT comment_id
          FROM comment_reply
          WHERE recipient_id IN (
              SELECT id
              FROM person
              WHERE actor_id LIKE $1
          )
      )
      UNION
      SELECT post_id
      FROM comment
      WHERE id IN (
          SELECT comment_id
          FROM comment_report
          WHERE creator_id IN (
              SELECT id
              FROM person
              WHERE actor_id LIKE $1
          )
      )
      UNION
      SELECT post_id
      FROM comment
      WHERE id IN (
          SELECT comment_id
          FROM comment_saved
          WHERE person_id IN (
              SELECT id
              FROM person
              WHERE actor_id LIKE $1
          )
      )
    )
    AND id NOT IN (
        SELECT post_id
        FROM comment
        WHERE published >= NOW() - INTERVAL '${purgeOlderThanDays} days'
    )
    LIMIT ${purgeBatchSize};
  `, [
    `${localUrl}%`,
  ]);
  return result.rows;
}

async function main() {
  while (true) {
    try {
      let localClient = new LemmyHttp(localUrl);
      let loginForm = {
        username_or_email: localUsername,
        password: localPassword,
      };
      let user = await localClient.login(loginForm);
      let posts = await getPosts();
      let l = posts.length;
      console.log(`Purging ${l} posts older than ${purgeOlderThanDays} days`);
      for await (const [i, post] of posts.entries()) {
        console.log(`Purging post ${post.id} (${i + 1}/${l})`);
        try {
          await localClient.purgePost({
            post_id: post.id,
            reason: `LPP - Older than ${purgeOlderThanDays} days`,
            auth: user.jwt,
          });
        } catch (e) {
          console.error(e);
        }
      }
      if (l < purgeBatchSize) {
        if (purgePictrsOlderThanDays && pictrsServerApiToken && pictrsUrl) {
          console.log(`Purging images older than ${purgePictrsOlderThanDays} days`);
          await purgePictrs(pool);
        }
        console.log(`Sleeping ${hoursBetweenPurges} hours`);
        await sleep(hoursBetweenPurges * 60 * 60);
      }
    } catch (e) {
      console.error(e);
    }
  }
}

main();
