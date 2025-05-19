@echo off
echo Choose an option:
echo 1. Install dependencies
echo 2. Start PostgreSQL with Docker
echo 3. Run database migrations
echo 4. Start the application in development mode
echo 5. All of the above in sequence
echo 6. Stop Docker containers
echo.

set /p option="Enter option number: "

if "%option%"=="1" goto install
if "%option%"=="2" goto up
if "%option%"=="3" goto migrate
if "%option%"=="4" goto dev
if "%option%"=="5" goto all
if "%option%"=="6" goto down

echo Invalid option
goto end

:install
echo Installing dependencies...
call npm install
goto end

:up
echo Starting PostgreSQL with Docker...
call docker-compose up -d
goto end

:migrate
echo Running database migrations...
call npx prisma migrate dev
goto end

:dev
echo Starting the application in development mode...
call npm run start:dev
goto end

:all
echo Running all steps in sequence...
call npm install
echo.
call docker-compose up -d
echo.
call npx prisma migrate dev
echo.
call npm run start:dev
goto end

:down
echo Stopping Docker containers...
call docker-compose down
goto end

:end
echo.
echo Done!
