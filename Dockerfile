FROM nginx:alpine

# n8n base URL — override in EasyPanel environment variables
# Example: http://n8n:5678  or  http://my-n8n-service:5678
ENV N8N_WEBHOOK_URL=http://n8n:5678

# Nginx config template (envsubst replaces ${N8N_WEBHOOK_URL} at container start)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# All web assets (.dockerignore excludes Dockerfile, README, .git)
COPY . /usr/share/nginx/html/

# Remove non-web files that were copied along
RUN rm -f /usr/share/nginx/html/nginx.conf.template \
          /usr/share/nginx/html/.dockerignore

EXPOSE 80
