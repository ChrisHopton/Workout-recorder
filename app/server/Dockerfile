# Use an LTS Node.js runtime as the base image
FROM node:20

# Set the working directory inside the container
WORKDIR /app

# Install only production dependencies first for better caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy the application source code
COPY src ./src

ENV NODE_ENV=production

# Expose the API port
EXPOSE 3001

# Start the server
CMD ["npm", "run", "start"]
