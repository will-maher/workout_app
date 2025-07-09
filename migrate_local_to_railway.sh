#!/bin/bash

# Local Postgres credentials
LOCAL_DB="workout_app"
LOCAL_USER="workout_user"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

# Railway Postgres URL
RAILWAY_URL="postgresql://postgres:qpDhWsgzNHqCMuHukYCoVADXidMYHtZz@switchyard.proxy.rlwy.net:49144/railway"

echo "Exporting tables from local Postgres to CSV..."

psql -U $LOCAL_USER -h $LOCAL_HOST -p $LOCAL_PORT -d $LOCAL_DB -c "\\copy users to 'users.csv' csv header"
psql -U $LOCAL_USER -h $LOCAL_HOST -p $LOCAL_PORT -d $LOCAL_DB -c "\\copy exercises to 'exercises.csv' csv header"
psql -U $LOCAL_USER -h $LOCAL_HOST -p $LOCAL_PORT -d $LOCAL_DB -c "\\copy workouts to 'workouts.csv' csv header"
psql -U $LOCAL_USER -h $LOCAL_HOST -p $LOCAL_PORT -d $LOCAL_DB -c "\\copy workout_sets to 'workout_sets.csv' csv header"

echo "Export complete. Importing CSVs into Railway Postgres..."

psql "$RAILWAY_URL" -c "\\copy users from 'users.csv' csv header"
psql "$RAILWAY_URL" -c "\\copy exercises from 'exercises.csv' csv header"
psql "$RAILWAY_URL" -c "\\copy workouts from 'workouts.csv' csv header"
psql "$RAILWAY_URL" -c "\\copy workout_sets from 'workout_sets.csv' csv header"

echo "Migration complete! Check your Railway Postgres for the imported data." 