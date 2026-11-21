FROM node:20-alpine

WORKDIR /app

# Install dependencies first
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "run", "dev"]