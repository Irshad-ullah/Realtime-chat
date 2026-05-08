FROM node:20-alpine

WORKDIR /app

# Copy dependency files first (layer caching — only re-runs npm install when package.json changes)
COPY package*.json ./

RUN npm install --omit=dev

# Copy the rest of the source code
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
