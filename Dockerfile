FROM node:8.9.1-stretch

ENV PATH="/var/www/soxhub/rollbar-hapi/node_modules/.bin/:${PATH}"
RUN mkdir -p /var/www/soxhub/rollbar-hapi
WORKDIR /var/www/soxhub/rollbar-hapi

COPY yarn.lock /var/www/soxhub/rollbar-hapi/
COPY package.json /var/www/soxhub/rollbar-hapi/
RUN yarn install --pure-lockfile
COPY . /var/www/soxhub/rollbar-hapi/

CMD [ "npm", "start" ]