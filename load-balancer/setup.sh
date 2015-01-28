#!/bin/bash
# Diego 20150127: setup of load balancer for ElasticSearch cluster
CURRENT_FOLDER=$( pwd )
BASE_FOLDER=$1
if [ -z "$1" ]
  then
   BASE_FOLDER="/home"
fi
BASE_USER=$2
if [ -z "$2" ]
  then
   BASE_USER="ubuntu"
fi
HOME_FOLDER=$BASE_FOLDER/$BASE_USER

# refresh repo
git pull -q

# update packages
sudo apt-get update
sudo apt-get -y upgrade

# install missing Ubuntu packages
packages_ubuntu=$(cat "packages/ubuntu-packages")
sudo apt-get -y install $packages_ubuntu

# stop services
sudo stop haproxy

# replace folders in haproxy.conf
sed "s:{{HOME_FOLDER}}:$HOME_FOLDER:g" $CURRENT_FOLDER/upstart/haproxy.conf > $CURRENT_FOLDER/haproxy.conf.tmp
sed -i -e "s:{{BASE_USER}}:$BASE_USER:g" $CURRENT_FOLDER/haproxy.conf.tmp
# copy haproxy folder to HOME_FOLDER
sudo -u $BASE_USER cp -rf $CURRENT_FOLDER/haproxy $HOME_FOLDER
# replace folder in base-haproxy.cfg
sed "s:{{RUN_FOLDER}}:$HOME_FOLDER/haproxy/run:g" $CURRENT_FOLDER/haproxy/base-haproxy.cfg > $CURRENT_FOLDER/base-haproxy.cfg.tmp
sudo -u $BASE_USER cp -f $CURRENT_FOLDER/base-haproxy.cfg.tmp $HOME_FOLDER/haproxy/base-haproxy.cfg
rm -f $CURRENT_FOLDER/base-haproxy.cfg.tmp
# install node packages
cd $HOME_FOLDER/haproxy
sudo npm install
# create extra folders
sudo -u $BASE_USER mkdir -p $HOME_FOLDER/haproxy/config
sudo -u $BASE_USER mkdir -p $HOME_FOLDER/haproxy/run
# copy upstart files
sudo cp -f $CURRENT_FOLDER/haproxy.conf.tmp /etc/init/haproxy.conf
rm -f $CURRENT_FOLDER/haproxy.conf.tmp
# copy rsyslog files
sudo cp -f $CURRENT_FOLDER/log/49-haproxy.conf /etc/rsyslog.d
# restart rsyslog
sudo restart rsyslog

# start services again
sudo start haproxy

