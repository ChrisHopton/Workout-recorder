# Use an LTS Node.js runtime as the base image
FROM node:20

# Set the working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the client source
COPY . .

# Expose the Vite dev server port
EXPOSE 5173

# Run the Vite development server accessible outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
