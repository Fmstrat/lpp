const url = require("url");
const path = require("path");
const fs = require("fs");
const { readdir } = require('fs').promises;

const localUrl = process.env.LOCAL_URL;
const purgePictrsOlderThanDays = process.env.PICTRS_RM_OLDER_THAN_DAYS ? parseInt(process.env.PICTRS_RM_OLDER_THAN_DAYS) : null;
const pictrsServerApiToken = process.env.PICTRS_SERVER_API_TOKEN ? process.env.PICTRS_SERVER_API_TOKEN : null;
const pictrsUrl = process.env.PICTRS_URL ? process.env.PICTRS_URL : null;

async function* getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

function printStatus(i, length, interval, str) {
  if (i % interval === 0 || i === length - 1) {
    console.log(str);
  }
}

async function purgePictrs(pool) {
  const pics = await pool.query(`
    SELECT
      thumbnail_url,
      CASE
        WHEN ap_id NOT LIKE $1
        AND published < NOW() - INTERVAL '${purgePictrsOlderThanDays} days'
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
            WHERE published >= NOW() - INTERVAL '${purgePictrsOlderThanDays} days'
        )
      THEN 'purge'
      ELSE 'keep'
    END AS action
    FROM post
    WHERE thumbnail_url LIKE $1
  `, [
    `${localUrl}%`,
  ]);
  const l = pics.rows.length;
  console.log(`Processing ${l} posts with thumbnails`);
  const identifiers = new Set();
  let purgeCount = 0;
  let keepCount = 0;
  let error = false;
  for await (const [i, pic] of pics.rows.entries()) {
    const alias = path.basename(url.parse(pic.thumbnail_url).pathname);
    if (pic.action === 'purge') {
      try {
        const purgeUrl = `${pictrsUrl}/internal/purge?alias=${alias}`
        await (await fetch(purgeUrl, {
          method: 'POST',
          headers: {
            'X-Api-Token': pictrsServerApiToken
          }
        })).json();
      } catch (e) {
        error = true;
        console.error(`Failed on ${purgeUrl}`)
      }
      purgeCount++;
    } else {
      try {
        const aliasUrl = `${pictrsUrl}/internal/aliases?alias=${alias}`
        const aliasRes = await (await fetch(aliasUrl, {
          method: 'GET',
          headers: {
            'X-Api-Token': pictrsServerApiToken
          }
        })).json();
        const aliases = aliasRes.aliases;
        if (!aliases.includes(alias)) {
          aliases.push(alias);
        }
        const identifierUrl = `${pictrsUrl}/internal/identifier?alias=${alias}`
        for (const alias of aliases) {
          const identifierRes = await (await fetch(identifierUrl, {
            method: 'GET',
            headers: {
              'X-Api-Token': pictrsServerApiToken
            }
          })).json();
          identifiers.add(identifierRes.identifier);
        }
      } catch (e) {
        error = true;
        console.error(`Failed on ${aliasUrl}`)
      }
      keepCount++;
    }
    printStatus(i, l, 1000, `Processing ${i + 1} of ${l} (purged: ${purgeCount}, keeping: ${keepCount})`);
  }
  if (!error && process.env.PICTRS_FOLDER) {
    const dir = path.join(process.env.PICTRS_FOLDER, '/files');
    try {
      console.log(`Getting counts from file system analysis`);
      let totalCount = 0;
      let totalRmCount = 0;
      let totalSkipCount = 0;
      let totalKeepCount = 0;
      let d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = d.getTime();
      for await (const f of getFiles(dir)) {
        let compare = f.replace(`${dir}/`, '');
        if (!identifiers.has(compare)) {
          const time = fs.statSync(f).mtime.getTime();
          if (time < yesterday) {
            totalRmCount++;
          } else {
            totalSkipCount++;
          }
        } else {
          totalKeepCount++;
        }
        totalCount++;
      }
      console.log(`Removing ${totalRmCount}, skipping ${totalSkipCount} (newer than 24h), and keeping ${totalKeepCount} of ${totalCount} total`);
      let count = 0;
      let rmCount = 0;
      let skipCount = 0;
      let keepCount = 0;
      for await (const f of getFiles(dir)) {
        let compare = f.replace(`${dir}/`, '');
        if (!identifiers.has(compare)) {
          const time = fs.statSync(f).mtime.getTime();
          if (time < yesterday) {
            try {
              fs.unlinkSync(f);
            } catch (e) {
              console.error(e);
            }
            rmCount++;
          } else {
            skipCount++;
          }
        } else {
          keepCount++;
        }
        printStatus(count, totalCount, 1000, `Processed ${count + 1} of ${totalCount} (removed: ${rmCount}/${totalRmCount}, skipped: ${skipCount}/${totalSkipCount}, kept: ${keepCount}/${totalKeepCount})`);
        count++;
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    console.log('Skipping file system analysis due to previous errors');
  }
}

module.exports = {
  purgePictrs,
}