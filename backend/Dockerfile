FROM node:20-alpine

WORKDIR /app

# Install dependencies first (leverages Docker cache)
COPY package*.json ./
RUN npm install

# Copy application source code and migrations
COPY tsconfig.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/

EXPOSE 3001

ENV PORT=3001

# Run migrations, seed sample data, and start dev server
CMD ["sh", "-c", "npm run migrate && npm run seed && npm run dev"]