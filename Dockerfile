FROM node:20-alpine

WORKDIR /app

# کپی فایل‌های پکیج
COPY package*.json ./
COPY prisma ./prisma/

# نصب وابستگی‌ها
RUN npm ci --legacy-peer-deps

# کپی سورس‌کد پروژه
COPY . .

# بیلد پروژه و ساخت کلاینت پریزما
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma db push && npm run start"]FROM node:20-alpine

WORKDIR /app

# کپی فایل‌های پکیج و اسکیما
COPY package*.json ./
COPY prisma ./prisma/

# نصب وابستگی‌ها
RUN npm ci --legacy-peer-deps

# کپی سورس‌کد
COPY . .

# ساخت کلاینت پریزما و بیلد برنامه
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "run", "start"]