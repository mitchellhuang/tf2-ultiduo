#!/bin/sh
s3cmd put db.sqlite s3://maps.redditeast.com/ultiduo/db_`date +%s`.sqlite