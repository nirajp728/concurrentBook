FROM node:18-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Non-root user (prevents container breakout attacks)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs
USER nodeuser

EXPOSE 5000

CMD ["npm", "start"]