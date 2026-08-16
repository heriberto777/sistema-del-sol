FROM node:20-slim

# node:20-slim (Debian/glibc) en vez de alpine: el motor de Prisma para
# linux-musl requiere libssl.so.1.1, que las imágenes alpine recientes ya
# no incluyen (traen OpenSSL 3.x). Debian evita ese problema de raíz.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm@9.7.0

COPY package.json ./
RUN pnpm install

COPY . .
RUN pnpm prisma:generate

EXPOSE 3000

CMD ["pnpm", "dev"]
