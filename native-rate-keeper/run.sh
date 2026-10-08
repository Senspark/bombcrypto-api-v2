#!/bin/sh
# One run, for crond and by hand alike: output lands in `docker logs` and in the caller's terminal.
cd /app && node native-rate.mjs 2>&1 | tee /proc/1/fd/1
