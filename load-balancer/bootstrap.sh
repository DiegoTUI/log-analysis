#!/bin/bash
# Diego 20140127: bootstrap a load balancer for the elasticsearch cluster

CURRENT_FOLDER=$( pwd )
BASE_FOLDER="/home"
BASE_USER="ubuntu"
HOME_FOLDER=$BASE_FOLDER/$BASE_USER
    
echo "bootstrapping load balancer for elastizsearch cluster. Use this option only once per machine"
# Set date to ntp-date
sudo ntpdate ntp.ubuntu.com
# Add daily task to cron
sudo cp ./ntpdate /etc/cron.daily
sudo chmod 755 /etc/cron.daily/ntpdate
# color prompt and aliases in .bashrc for current user
cat bashrc >> ~/.bashrc
source ~/.bashrc
# create common directories
sudo -u $BASE_USER mkdir -p $HOME_FOLDER/log
# enable unattended upgrades
sudo dpkg --configure -a
sudo dpkg-reconfigure -plow unattended-upgrades
# update and upgrade
sudo apt-get update
sudo apt-get dist-upgrade
sudo apt-get upgrade
    