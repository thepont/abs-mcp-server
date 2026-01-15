# abs-mcp-server Dockerfile
# GPL-3.0
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .
RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
