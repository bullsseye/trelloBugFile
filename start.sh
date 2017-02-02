#!/bin/sh
cat requirements.txt | xargs sudo npm install
sudo nohup node trelloBugFile.js >> ~/trelloBugFile.log &
