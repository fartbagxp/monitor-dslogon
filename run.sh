#!bin/bash

while true
do
  node index.js 2>&1 | tee -a output.txt
  sleep 60
done
