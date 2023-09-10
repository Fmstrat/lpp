# Lemmy Post Purger (LPP)

Instances can grow fast, and that can be a problem if you have limited disk space. If you don't mind losing history that your users have not interacted with, LPP can help. It will purge posts/media older than a specified time if they have not been posted, marked read, voted on, commented on, had comments voted on, or saved by users on your instance.

Pict-rs processing is optional. If there is concern that Lemmy is not purging from Pict-rs, or that Pict-rs is not removing files from the file system, then this extra processing will ensure that occurs. Supplying `PICTRS_RM_OLDER_THAN_DAYS` along with a URL and server admin token will run a purge command directly against Pict-rs for media that falls within the above criteria of no users on your instance interacting with them. In addition, supplying a `PICTRS_FOLDER` will also scan the folder for images that were not properly removed from the file system during the purge and force remove them.

## Usage
In docker-compose:
```yml
version: '2.1'

services:

  lpp:
    image: nowsci/lpp
    container_name: lpp
    volumes:
      - /path/to/pictrs/mnt:/mnt
    environment:
      LOCAL_URL: https://lemmy.domain.ext
      LOCAL_USERNAME: top_level_admin_user
      LOCAL_PASSWORD: password
      PURGE_OLDER_THAN_DAYS: 365
      PICTRS_RM_OLDER_THAN_DAYS: 365
      PICTRS_SERVER_API_TOKEN: abcdefg
      PICTRS_URL: http://lemmy-pictrs:8080
      PICTRS_FOLDER: /mnt
      HOURS_BETWEEN_PURGES: 24
      PG_HOST: lemmy_db_host
      PG_PORT: 5432
      PG_USERNAME: lemmy
      PG_PASSWORD: lemmy_db_password
    restart: unless-stopped
```

Manually:
```bash
cd src
export LOCAL_URL=https://lemmy.domain.ext
export LOCAL_USERNAME=top_level_admin_user
export LOCAL_PASSWORD=password
export PURGE_OLDER_THAN_DAYS=365
export PICTRS_RM_OLDER_THAN_DAYS=365
export PICTRS_SERVER_API_TOKEN=abcdefg
export PICTRS_URL=http://lemmy-pictrs:8080
export PICTRS_FOLDER=/mnt
export HOURS_BETWEEN_PURGES=24
export PG_HOST=lemmy_db_host
export PG_PORT=5432
export PG_DATABASE=lemmy
export PG_USERNAME=lemmy
export PG_PASSWORD=lemmy_db_password
npm install
npm start
```

## Variables

|Variable|Description|
|-|-|
|LOCAL_URL|The URL of your instance|
|LOCAL_USERNAME|Username of a user for your instance|
|LOCAL_PASSWORD|Password of a user for your instance|
|PURGE_OLDER_THAN_DAYS|Posts must be older than this many days to be purged|
|PURGE_BATCH_SIZE|Optional: Process this many posts at a time. Default: 100|
|PICTRS_RM_OLDER_THAN_DAYS|Optional: Pictures older than this many days that failed to be purged by lemmy will be purged directly in Pict-rs|
|PICTRS_SERVER_API_TOKEN|Optional: The server API key (PICTRS__SERVER__API_KEY) for Pict-rs|
|PICTRS_URL|Optional: The URL for your Pict-rs instance|
|PICTRS_FOLDER|Optional: The path to the Pict-rs folder if you're using local storage where any media that failed to purge will be force removed|
|HOURS_BETWEEN_PURGES|How long to wait between runs|
|PG_HOST|Lemmy Postgres host|
|PG_PORT|Lemmy Postgres port|
|PG_DATABASE|Lemmy Postgres database name. Optional, and if not specified the username will be used as the database name|
|PG_USERNAME|Lemmy Postgres user name|
|PG_PASSWORD|Lemmy Postgres password|
