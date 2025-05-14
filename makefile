# Makefile for Bizcotap API

# Variables
DOCKER_COMPOSE = docker-compose
NODE = node
NPM = npm
PRISMA = npx prisma

# Colors
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No Color

# Docker commands
.PHONY: up
up: ## Start all containers
	@echo "${GREEN}Starting all containers...${NC}"
	@$(DOCKER_COMPOSE) up -d

.PHONY: up-build
up-build: ## Start all containers with building
	@echo "${GREEN}Building and starting all containers...${NC}"
	@$(DOCKER_COMPOSE) up -d --build

.PHONY: down
down: ## Stop all containers
	@echo "${YELLOW}Stopping all containers...${NC}"
	@$(DOCKER_COMPOSE) down

.PHONY: logs
logs: ## Show logs from all containers
	@$(DOCKER_COMPOSE) logs -f

.PHONY: logs-api
logs-api: ## Show logs from API container
	@$(DOCKER_COMPOSE) logs -f api

.PHONY: logs-db
logs-db: ## Show logs from PostgreSQL container
	@$(DOCKER_COMPOSE) logs -f postgres

.PHONY: ps
ps: ## List all running containers
	@$(DOCKER_COMPOSE) ps

.PHONY: restart
restart: down up ## Restart all containers

.PHONY: rebuild
rebuild: down up-build ## Rebuild and restart all containers

# Development commands
.PHONY: dev
dev: ## Start application in development mode (without Docker)
	@echo "${GREEN}Starting application in development mode...${NC}"
	@$(NPM) run start:dev

.PHONY: install
install: ## Install dependencies
	@echo "${GREEN}Installing dependencies...${NC}"
	@$(NPM) install

.PHONY: build
build: ## Build the application
	@echo "${GREEN}Building application...${NC}"
	@$(NPM) run build

.PHONY: test
test: ## Run tests
	@echo "${GREEN}Running tests...${NC}"
	@$(NPM) test

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	@echo "${GREEN}Running end-to-end tests...${NC}"
	@$(NPM) run test:e2e

.PHONY: test-cov
test-cov: ## Run tests with coverage
	@echo "${GREEN}Running tests with coverage...${NC}"
	@$(NPM) run test:cov

# Database commands
.PHONY: db-studio
db-studio: ## Open Prisma Studio
	@echo "${GREEN}Opening Prisma Studio...${NC}"
	@$(PRISMA) studio

.PHONY: db-migrate
db-migrate: ## Generate and apply migrations
	@echo "${GREEN}Generating and applying migrations...${NC}"
	@$(PRISMA) migrate dev

.PHONY: db-deploy
db-deploy: ## Apply migrations in production mode
	@echo "${GREEN}Applying migrations in production mode...${NC}"
	@$(PRISMA) migrate deploy

.PHONY: db-reset
db-reset: ## Reset database (WARNING: Deletes all data)
	@echo "${RED}WARNING: This will delete all data in the database.${NC}"
	@read -p "Are you sure you want to proceed? (y/n) " answer; \
	if [ "$$answer" = "y" ]; then \
		echo "${YELLOW}Resetting database...${NC}"; \
		$(PRISMA) migrate reset --force; \
	else \
		echo "${GREEN}Database reset aborted.${NC}"; \
	fi

.PHONY: db-seed
db-seed: ## Seed database with sample data
	@echo "${GREEN}Seeding database...${NC}"
	@$(PRISMA) db seed

# Utility commands
.PHONY: clean
clean: ## Clean build artifacts
	@echo "${YELLOW}Cleaning build artifacts...${NC}"
	@rm -rf dist

.PHONY: lint
lint: ## Run linter
	@echo "${GREEN}Running linter...${NC}"
	@$(NPM) run lint

.PHONY: format
format: ## Format code
	@echo "${GREEN}Formatting code...${NC}"
	@$(NPM) run format

.PHONY: help
help: ## Show this help
	@echo "Bizcotap API Makefile commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'


.PHONY: db-seed
db-seed: ## Seed the database with initial data
	@echo "${GREEN}Seeding database...${NC}"
	@docker-compose exec api npx prisma db seed

.PHONY: db-init
db-init: ## Initialize a fresh database with migrations and seed data
	@echo "${GREEN}Initializing database...${NC}"
	@docker-compose exec api npx prisma migrate deploy
	@docker-compose exec api npx prisma db seed

.DEFAULT_GOAL := help
