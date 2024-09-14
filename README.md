# Lemmy Post Purger (LPP)

Instances can grow fast, and that can be a problem if you have limited disk space. If you don't mind losing history that your users have not interacted with, LPP can help. It will purge posts/media older than a specified time if they have not been posted, marked read, voted on, commented on, had comments voted on, or saved by users on your instance.

Pict-rs processing is optional. If there is concern that Lemmy is not purging from Pict-rs, or that Pict-rs is not removing files from the file system, then this extra processing will ensure that occurs. Supplying `PICTRS_RM_OLDER_THAN_DAYS` along with a URL and server admin token will run a purge command directly against Pict-rs for media that falls within the above criteria of no users on your instance interacting with them. In addition, supplying a `PICTRS_FOLDER` will also scan the folder for images that were not properly removed from the file system during the purge and force remove them.

## Documentation

Latest documentation available at: [https://nowsci.com/lemmy/lpp/](https://nowsci.com/lemmy/lpp/)
