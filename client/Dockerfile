# Executive PA frontend - static PWA served by nginx (SPA fallback included).
FROM node:20-alpine AS build
WORKDIR /app

COPY client/package*.json ./
RUN npm ci

COPY client/ ./

# Vite bakes these into the bundle at build time. Railway supplies service
# variables as build args for ARGs declared here.
ARG VITE_API_BASE_URL=""
ARG VITE_MSAL_CLIENT_ID=""
ARG VITE_MSAL_TENANT_ID=""
ARG VITE_MSAL_GRAPH_SCOPES="Calendars.Read,User.Read,openid,profile,email"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MSAL_CLIENT_ID=$VITE_MSAL_CLIENT_ID \
    VITE_MSAL_TENANT_ID=$VITE_MSAL_TENANT_ID \
    VITE_MSAL_GRAPH_SCOPES=$VITE_MSAL_GRAPH_SCOPES

RUN npm run build

FROM nginx:alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 8080
