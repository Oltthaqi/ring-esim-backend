FROM node:23.7.0

# Create app directory
WORKDIR /app

# Copy package(s) file(s) into working directory

COPY . .


# Verify that package(s) file(s) have been copied
RUN ls -lh

#
RUN npm cache clean --force
# Install app dependencies
RUN npm install


RUN npm run build

EXPOSE 3000
CMD npm run start:prod
