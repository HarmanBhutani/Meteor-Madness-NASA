# --- Stage 1: Build the React Application ---
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json and install dependencies (Layer 1)
COPY package.json .
COPY package-lock.json .
RUN npm install

# Copy all application code and static assets (Layer 2)
# This requires the public folder to exist locally!
COPY ./public ./public
COPY src ./src

# Build the application
RUN npm run build

# --- Stage 2: Serve the Static Files with Nginx ---
FROM nginx:alpine

# Copy the static build output from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# EXPOSE 3000 is defined in docker-compose
CMD ["nginx", "-g", "daemon off;"]