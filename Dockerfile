FROM node:18-bullseye

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p data uploads

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
