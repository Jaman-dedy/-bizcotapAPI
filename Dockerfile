FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy prisma schema first
COPY prisma ./prisma/

# Generate Prisma client for the correct platform
RUN npx prisma generate

# Copy the rest of the application source
COPY . .

# Create necessary directories
RUN mkdir -p public/companies/logos

# Build the application
RUN npm run build

# Add wait script
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.9.0/wait /wait
RUN chmod +x /wait

EXPOSE 3000

# Use the correct path to main.js as identified earlier
CMD /wait && \
    echo "Running migrations..." && npx prisma migrate deploy && \
    echo "Starting application..." && \
    node dist/src/main.js
