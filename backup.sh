#!/bin/sh
s3cmd put /var/www/ultiduo/db.sqlite s3://maps.redditeast.com/ultiduo/db_`date +%s`.sqlite
