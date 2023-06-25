# Lemmy Post Purger (LPP)

Instances can grow fast, and that can be a problem if you have limited disk space. If you don't mind losing history that your users have not interacted with, LPP can help. It will purge posts along with their comments and media before a certain time period if no comments, likes, or saves exist for users on your instance.

## Usage
In docker-compose:
```yml
version: '2.1'

services:

  lpp:
    image: nowsci/lpp
    container_name: lpp
    environment:
      LOCAL_URL: https://lemmy.domain.ext
      LOCAL_USERNAME: top_level_admin_user
      LOCAL_PASSWORD: password
      PURGE_OLDER_THAN_DAYS: 365
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
export HOURS_BETWEEN_PURGES=24
export PG_HOST=lemmy_db_host
export PG_PORT=5432
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
|HOURS_BETWEEN_PURGES|How long to wait between runs|
|PG_HOST|Lemmy Postgres host|
|PG_PORT|Lemmy Postgres port|
|PG_USERNAME|Lemmy Postgres user name|
|PG_PASSWORD|Lemmy Postgres password|
