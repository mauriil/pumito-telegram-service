FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

CMD ["node", "dist/main"]
