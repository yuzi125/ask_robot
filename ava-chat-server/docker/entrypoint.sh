#!/bin/bash
mkdir -p /app/web/log

# 重定向 stderr 到 error.log, 然后将 stdout 重定向到 output.log. 两个都使用 tee 来同时输出到文件和控制台。
/usr/local/bin/node --stack-size=8192 /app/web/server.js 2> >(tee /app/web/log/error.log >&2) | tee /app/web/log/output.log
