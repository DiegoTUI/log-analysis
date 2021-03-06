#!/usr/bin/env python

from BaseHTTPServer import BaseHTTPRequestHandler,HTTPServer
from SocketServer import ThreadingMixIn
from telnetlib import Telnet
import os
import psutil
import signal
import threading
import argparse
import re
import json
  
class HTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(serverStatus()))
        else:
            self.send_response(403)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
        return
 
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    allow_reuse_address = True
 
    def shutdown(self):
        self.socket.close()
        HTTPServer.shutdown(self)
 
class SimpleHttpServer():
    def __init__(self, ip, port):
        self.server = ThreadedHTTPServer((ip,port), HTTPRequestHandler)
 
    def start(self):
        self.server_thread = threading.Thread(target=self.server.serve_forever)
        self.server_thread.daemon = True
        self.server_thread.start()
 
    def waitForThread(self):
        self.server_thread.join()
 
    def stop(self):
        self.server.shutdown()
        self.waitForThread()

def serverStatus():
    cpu_percent = psutil.cpu_percent()
    virtual_memory = psutil.virtual_memory()
    swap_memory = psutil.swap_memory()
    disk_usage = psutil.disk_usage("/")
    elasticsearch_up = is_elasticsearch_up()
    
    print virtual_memory, swap_memory, disk_usage

    return {"cpu": cpu_percent,
            "virtual_memory": virtual_memory[2],
            "swap_memory": swap_memory[3],
            "disk_usage": disk_usage[3],
            "elasticsearch_up": elasticsearch_up}

def is_elasticsearch_up():
    try:
        conn_9200 = Telnet("localhost", port=9200)
        conn_9200.close()
        conn_9300 = Telnet("localhost", port=9300)
        conn_9300.close()
        return True
    except:
        return False;

 
if __name__=="__main__":
    parser = argparse.ArgumentParser(description="HTTP Server")
    parser.add_argument("port", type=int, help="Listening port for HTTP Server")
    parser.add_argument("ip", help="HTTP Server IP")
    args = parser.parse_args()
 
    server = SimpleHttpServer(args.ip, args.port)
    print "HTTP Server Running..."
    server.start()
    signal.signal(signal.SIGINT, lambda signal,frame: server.stop())
    signal.pause()
    server.waitForThread()
    
