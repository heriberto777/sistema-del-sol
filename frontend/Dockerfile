FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@9.7.0

COPY package.json ./
RUN pnpm install

COPY . .

EXPOSE 5173

CMD ["pnpm", "dev"]
