FROM node:8-alpine

# Build tools
RUN apk add --no-cache build-base linux-headers autoconf automake libtool m4 nmap-ncat curl wget git zip unzip nano vim

# ZSH
RUN apk add --no-cache zsh

# Oh My Zsh
RUN git clone git://github.com/robbyrussell/oh-my-zsh.git ~/.oh-my-zsh && \
  cp ~/.oh-my-zsh/templates/zshrc.zsh-template ~/.zshrc

EXPOSE 1337

WORKDIR /app
COPY server /app

RUN yarn install

RUN cp .vimrc ~
RUN cat .zshrc >> ~/.zshrc

CMD node app.js
