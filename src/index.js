const { LemmyHttp } = require("lemmy-js-client");
const { Pool } = require('pg');

const localUrl = process.env.LOCAL_URL;
const localUsername = process.env.LOCAL_USERNAME;
const localPassword = process.env.LOCAL_PASSWORD;
const purgeOlderThanDays = parseInt(process.env.PURGE_OLDER_THAN_DAYS);
const hoursBetweenPurges = parseInt(process.env.HOURS_BETWEEN_PURGES);

const pgHost = process.env.PG_HOST;
const pgPort = process.env.PG_PORT;
const pgUsername = process.env.PG_USERNAME;
const pgPassword = process.env.PG_PASSWORD;

const pool = new Pool({
  host: pgHost,
  port: pgPort,
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
    );
  `, [
    `${localUrl}%`,
  ]);
  return result.rows;
}

async function main() {
  while (true) {
    let localClient = new LemmyHttp(localUrl);
    let loginForm = {
      username_or_email: localUsername,
      password: localPassword,
    };
    let user = await localClient.login(loginForm);
    let posts = await getPosts();
    console.log(`Purging ${posts.length} posts`)
    for await (const post of posts) {
      console.log(`Purging post ${post.id}`);
      await localClient.purgePost({
        post_id: post.id,
        reason: `LPP - Older than ${purgeOlderThanDays} days`,
        auth: user.jwt,
      });
    }
    console.log(`Sleeping ${hoursBetweenPurges} hours`);
    await sleep(hoursBetweenPurges * 60 * 60);
  }
}

main();