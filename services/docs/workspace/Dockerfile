# Stage 1: Base
FROM node:lts AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Development
FROM base AS development
EXPOSE 3000
CMD ["npm", "start", "--", "--host", "0.0.0.0"]

# Stage 3: Build
FROM base AS builder
COPY . .
RUN npm run build

# Stage 4: Serve the static files with Nginx
FROM nginx:alpine AS production
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
