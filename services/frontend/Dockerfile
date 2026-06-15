FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY package-lock.json ./

RUN npm ci

COPY . .


# Для разработки:
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]