<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# Bizcotap API

A modern API built with NestJS, PostgreSQL, and Prisma for efficient and scalable server-side applications.

## Description

This project is built using the [Nest](https://github.com/nestjs/nest) framework, a progressive Node.js framework for building efficient and reliable server-side applications.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Docker](https://www.docker.com/) and Docker Compose
- [Make](https://www.gnu.org/software/make/) (optional, but recommended)

## Quick Start

The easiest way to get started is using Docker:

```bash
# Start the application with Docker
make up-build

# Or without Make
docker-compose up --build
```

This will:
1. Build the NestJS application container
2. Start the PostgreSQL database
3. Run migrations automatically
4. Start the API server on port 3000

## Development Setup

If you prefer to run the application locally without Docker:

```bash
# Install dependencies
make install

# Start PostgreSQL with Docker
make up

# Run database migrations
make db-migrate

# Start the application in development mode
make dev
```

## Available Commands

We use a Makefile to simplify common operations. Run `make help` to see all available commands.

### Docker Commands

```bash
# Start all containers
make up

# Build and start all containers
make up-build

# Stop all containers
make down

# Show logs from all containers
make logs

# Show logs from API container
make logs-api

# Show logs from PostgreSQL container
make logs-db

# List all running containers
make ps

# Restart all containers
make restart

# Rebuild and restart all containers
make rebuild
```

### Development Commands

```bash
# Start application in development mode (without Docker)
make dev

# Install dependencies
make install

# Build the application
make build

# Run tests
make test

# Run end-to-end tests
make test-e2e

# Run tests with coverage
make test-cov
```

### Database Commands

```bash
# Open Prisma Studio
make db-studio

# Generate and apply migrations
make db-migrate

# Apply migrations in production mode
make db-deploy

# Reset database (WARNING: Deletes all data)
make db-reset

# Seed database with sample data
make db-seed
```

### Utility Commands

```bash
# Clean build artifacts
make clean

# Run linter
make lint

# Format code
make format

# Show help
make help
```

## Manual Setup

If you're not using Make, you can run the commands directly:

```bash
# Install dependencies
npm install

# Start containers
docker-compose up -d

# Run migrations
npx prisma migrate dev

# Start the application in development mode
npm run start:dev
```

## API Documentation

Swagger documentation is available at:
```
http://localhost:3000/api/docs
```

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Docker Documentation](https://docs.docker.com)

## Support

If you need help with NestJS, check out:
- [NestJS Discord channel](https://discord.gg/G7Qnnhy)
- [NestJS Courses](https://courses.nestjs.com/)

## License

This project is [MIT licensed](LICENSE).
