"use strict";
//var _ = require('underscore');
var utils = require('./lib/helpers/utils');
var lcd = require('./lib/helpers/lcd');
const {struct} = require('pb-util');
var when = utils.when;

var request = require('request');

module.exports = function (RED) {
  var debuglength = RED.settings.debugMaxLength || 1000;
  //var useColors = RED.settings.debugUseColors || false;

  function Send(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    node.smooch = config.smooch;
    node.debug = config.debug;
    
    this.on("input", function (msg) {
      var smoochNode = RED.nodes.getNode(node.smooch);
      var debug = utils.extractValue('boolean', 'debug', node, msg, false);

      // exit if empty credentials
      if (smoochNode == null || smoochNode.credentials == null) {
        node.warn('Sunshine credentials are missing.');
        return;
      }

      var preRequestTimestamp = process.hrtime();
      node.status({
        fill: "blue",
        shape: "dot",
        text: "httpin.status.requesting"
      });

      // exit if empty appusers
      if (msg.payload.appusers == null || (!msg.payload.appusers)) {
        node.warn('msg.payload.appusers are missing or null');
        return;
      }
      // exit if empty appid
      if (smoochNode.appid == null && (msg.payload.appid == null || (!msg.payload.appid))) {
        node.warn('appid are missing or not send msg.payload.appid');
        return;
      }

      // exit if empty appid
      if (msg.payload.msgBody == null) {
        node.warn('msg.payload.appid are missing');
        return;
      }

      var opts = {
        method: "POST",
        url: null,
        timeout: 5000,
        headers: {},
        json: true,
        body:null,
      };
      
      var appusers = msg.payload.appusers;
      var apps = (msg.payload.appid)?msg.payload.appid:smoochNode.appid;
      var username = smoochNode.credentials.username;
      var password = smoochNode.credentials.password;
      var msgBody = msg.payload.msgBody;
      var host = smoochNode.credentials.host;
      var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

      opts.url = host + "/apps/" + apps + "/appusers/" + appusers + "/messages";
      opts.headers = {"authorization": auth,"content-type": "application/json",accept:"application/json, text/plain;q=0.9, */*;q=0.8"};
      opts.body = msgBody;

      request(opts, function (error, response, body) {
        node.status({});
        if (error) {
          if (error.code === 'ETIMEDOUT') {
            node.error(RED._("common.notification.errors.no-response"), msg);
            setTimeout(function () {
              node.status({
                fill: "red",
                shape: "ring",
                text: "common.notification.errors.no-response"
              });
            }, 10);
          } else {
            node.error(error, msg);
            msg.payload = error.toString() + " : " + inputUrl;
            msg.statusCode = error.code;
            node.send(msg);
            node.status({
              fill: "red",
              shape: "ring",
              text: error.code
            });
          }
        } else {
          msg.payload = body;
          msg.headers = response.headers;
          msg.statusCode = response.statusCode;
          if(msg.authApp)
            delete msg.authApp;

          if (node.metric()) {
            // Calculate request time
            var diff = process.hrtime(preRequestTimestamp);
            var ms = diff[0] * 1e3 + diff[1] * 1e-6;
            var metricRequestDurationMillis = ms.toFixed(3);
            node.metric("duration.millis", msg, metricRequestDurationMillis);
            if (response.connection && response.connection.bytesRead) {
              node.metric("size.bytes", msg, response.connection.bytesRead);
            }
          }
          if(debug)
            sendDebug({id:node.id, z:node.z, _alias: node._alias,  path:node._flow.path, name:node.name, topic:msg.topic, msg:msg});

          node.send(msg);
        }
      });
    });
  }


  RED.nodes.registerType("Send", Send);

  function RemoteServerNode(n) {
    RED.nodes.createNode(this, n);
    this.name = n.name;
    this.appid = n.appid;
  }

  RED.nodes.registerType('smooch', RemoteServerNode, {
    credentials: {
      host: {
        type: 'text'
      },
      username: {
        type: 'text'
      },
      password: {
        type: 'text'
      }
    }
  });

  function sendDebug(msg) {
    // don't put blank errors in sidebar (but do add to logs)
    //if ((msg.msg === "") && (msg.hasOwnProperty("level")) && (msg.level === 20)) { return; }
    msg = RED.util.encodeObject(msg, {maxLength:debuglength});
    RED.comms.publish("debug",msg);
  }

};

