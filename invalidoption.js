"use strict";
var utils = require('./lib/helpers/utils');
var request = require('request');
const { string } = require('./lib/helpers/validators');

module.exports = function (RED) {

  String.prototype.greeting = function greeting()
  {
      var originalValue = this
      var valueGreeting = "";
      var mdata      = new Date()
      var mhora      = mdata.getHours()
      
      if (mhora < 12)
        valueGreeting = "Bom dia";
      else if(mhora >=12 && mhora < 18)
        valueGreeting = "Boa tarde";
      else if(mhora >= 18 && mhora < 24)
        valueGreeting = "Boa noite";
          
      return originalValue.replace("{greeting}", valueGreeting)
  }

  function ourTimeout(handler, delay) {
      var toutID = setTimeout(handler, delay);
      return {
          clear: function() { clearTimeout(toutID); },
          trigger: function() { clearTimeout(toutID); return handler(); }
      };
  }

  var clearDelayList = function(s) {
      for (var i=0; i<node.idList.length; i++ ) { node.idList[i].clear(); }
      node.idList = [];
      if (s) { node.status({text:"reset"}); }
      else { node.status({}); }
  }

  var flushDelayList = function() {
      var len = node.idList.length;
      for (var i=0; i<len; i++ ) { node.idList[0].trigger(); }
      node.idList = [];
      node.status({text:"flushed"});
  }


  var debuglength = RED.settings.debugMaxLength || 1000;

  function invalidOption(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    node.smooch = config.smooch;
    node.debug = config.debug;
    node.attempts = config.attempts;
    node.timeoutUnits = config.timeoutUnits;
    node.postmessage = config.postmessage;
  
    node.idList = [];

    //Ajuste de tempo para envio de msg
    if (node.timeoutUnits === "seconds") {
      node.timeout = parseInt(config.timeout) * 1000;
    }else if (node.timeoutUnits === "milliseconds") {
      node.timeout = parseInt(config.timeout);
    } else if (node.timeoutUnits === "minutes") {
      node.timeout = parseInt(config.timeout) * (60 * 1000);
    } else if (node.timeoutUnits === "hours") {
      node.timeout = parseInt(config.timeout) * (60 * 60 * 1000);
    } else if (node.timeoutUnits === "days") {
      node.timeout = parseInt(config.timeout) * (24 * 60 * 60 * 1000);
    } else {   // Default to disabled
      node.timeout = 0;//parseInt(config.timeout) * 1000;
    }

    //node.timeout = config.timeout;

    //Objeto de contexto usado para grava a questão respondida no contexto do fluxo para a sessão criada atravez do appuserid
    var contextSend = this.context().flow;
    
    this.on("input", function (msg) {
      var smoochNode = RED.nodes.getNode(node.smooch);
      var debug = utils.extractValue('boolean', 'debug', node, msg, false);
      var attempts = utils.extractValue('string', 'attempts', node, msg, false);
      var valuemsg = utils.extractValue('string', 'postmessage', node, msg, false);
      
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
      if ((msg.payload.appUser === undefined) && (msg.payload.appusers === undefined)) {
        node.warn('msg.payload.appusers or msg.payload.appUser._id are missing or null');
        return;
      }
      // exit if empty appid
      if (smoochNode.appid == null && (msg.payload.appid == null || (!msg.payload.appid))) {
        node.warn('appid are missing or not send msg.payload.appid');
        return;
      }
      var bodyMsg = null;
      // exit if empty msgBody
      if ((msg.payload.msgBody === undefined) || (msg.payload.msgBody === null) ) {
        if(valuemsg != null)
        {
          bodyMsg = {"text":valuemsg, "role":"appMaker", "type": "text"};
        }
        else
        {
          node.warn('msg.payload.msgBody or msg.payload.valuemsg are missing');
          return;
        }
      }

      var opts = {
        method: "POST",
        url: null,
        timeout: 5000,
        headers: {},
        json: true,
        body:null,
      }; 

      var timedelay = msg.payload.delay || node.timeout;

      var appusers = msg.payload.appusers || msg.payload.appUser._id;
      var apps = msg.payload.appid || smoochNode.appid;
      var username = smoochNode.credentials.username;
      var password = smoochNode.credentials.password;
      var msgBody = bodyMsg || msg.payload.msgBody;
      var host = smoochNode.credentials.host;
      var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

      opts.url = host + "/apps/" + apps + "/appusers/" + appusers + "/messages";
      opts.headers = {"authorization": auth,"content-type": "application/json",accept:"application/json, text/plain;q=0.9, */*;q=0.8"};

      msgBody.text = msgBody.text.greeting();
      msgBody.text = msgBody.text.textFromDataForm(contextSend,msg);
      
      opts.body = msgBody;

      //Enable delay message.
      if (node.timeoutUnits) {
        if (msg.hasOwnProperty("flush")) { flushDelayList(); }
        else {
            var id = ourTimeout(function() {
                node.idList.splice(node.idList.indexOf(id),1);
                if (node.idList.length === 0) { node.status({}); }
                //node.send(msg);
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
                    msg.appusers = appusers;
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

                    var msgstatus = "user-"+appusers;
                    var usrcontex = contextSend.get(msgstatus);
                    var idx = usrcontex.questions.findIndex(x => x.name === msg.nodename);

                    if(!usrcontex.questions[idx].attemptsInvalid)
                      usrcontex.questions[idx].attemptsInvalid = 0
                        
                    usrcontex.questions[idx].attemptsInvalid++;

                    if(usrcontex.questions[idx].attemptsInvalid >= attempts)
                    {
                      contextSend.set(msgstatus, undefined);
                      node.status({
                        fill: "red",
                        shape: "ring",
                        text: "Attempts Invalid: "+msgstatus
                      });
                      node.send(msg);
                    }

                    if(debug)
                      sendDebug({id:node.id, z:node.z, _alias: node._alias,  path:node._flow.path, name:node.name, topic:msg.topic, msg:msg});

                    //node.send(msg);
                  }
                })


      }, timedelay);
      node.idList.push(id);
      if ((timedelay> 1000) && (node.idList.length !== 0)) {
          node.status({fill:"blue",shape:"dot",text:" "});
      }
      if (msg.hasOwnProperty("reset")) { clearDelayList(true); }
    }};
    });
    node.on("close", function() { clearDelayList(); });
  }

  RED.nodes.registerType("Invalid Option", invalidOption);

  function RemoteServerNode(n) {
    RED.nodes.createNode(this, n);
    this.name = n.name;
    this.appid = n.appid;
  }


  function sendDebug(msg) {
    // don't put blank errors in sidebar (but do add to logs)
    //if ((msg.msg === "") && (msg.hasOwnProperty("level")) && (msg.level === 20)) { return; }
    msg = RED.util.encodeObject(msg, {maxLength:debuglength});
    RED.comms.publish("debug",msg);
  }

};

