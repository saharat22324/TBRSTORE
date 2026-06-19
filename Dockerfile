# Dockerfile - TBR Service Center
# Build: docker build -t tbr-system .
# Run:   docker run -d -p 8080:8080 tbr-system

FROM node:18-alpine

WORKDIR /app

# Copy all files
COPY . .

# Install global http-server
RUN npm install -g http-server

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/index.html || exit 1

# Start server
# -p 8080: port
# -c-1: disable caching (always fresh files)
# -o: open in browser (disabled for server)
CMD ["http-server", "-p", "8080", "-c-1"]
