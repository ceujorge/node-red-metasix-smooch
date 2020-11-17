"use strict";
const { fontcolor } = require('cli-color/beep');
var utils = require('./lib/helpers/utils');
const { string } = require('./lib/helpers/validators');
const { NlpManager } = require('node-nlp');

module.exports = function (RED) {

  var debuglength = RED.settings.debugMaxLength || 1000;

  var request = require('request');

  function sendMessage(msg, node){

    var debug = true;//utils.extractValue('boolean', 'debug', node, msg, false);

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

    //node.warn(bodyMsg);

    var urlContext = node.context().flow;

    var opts = {
      method: "POST",
      url: null,
      timeout: 5000,
      headers: {},
      json: true,
      body:null,
    };
    
    var msgBody = msg.payload.msgBody;

    var urlchat = urlContext.get("urlchat") || "comercial";

    opts.url = "https://" + urlchat + "-chat.metasix.solutions/api/v1/chat.sendLivechatMessage";
    opts.headers = {"content-type": "application/json",accept:"application/json, text/plain;q=0.9, */*;q=0.8"};
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
          //node.send(msg);
          node.status({
            fill: "red",
            shape: "ring",
            text: error.code
          });
        }
      } else {
        
        msg.originalMessage = msg.payload;
        msg.payload = body;
        msg.payload.appUser = msg.originalMessage.appUser;
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
        //if(debug)
          //sendDebug({id:node.id, z:node.z, _alias: node._alias,  path:node._flow.path, name:node.name, topic:msg.topic, msg:msg});

          if(msg.payload.success)
          {
              if(msg.payload.register)
              {
                node.send([msg, null]);
              }
          }
          else
          {
              //flow.set(user_key, undefined)
              node.send([null, msg]);
          }
      }
    });
  }

  function ChatcubeNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    node.name = n.name;
    node.grouptype = n.grouptype;
    node.property = n.property;
    node.propertyForm = n.propertyForm;
    node.propertyType = n.propertyType;


    var propertyForm = node.propertyForm;
    var property = node.property;
    var propertyType = node.propertyType;

 
    var contextSend = this.context().flow;
    
    this.on("input", function (msg) {
      var grouptype = utils.extractValue('string', 'grouptype', node, msg, false);


      if(!msg.payload.appUser)
      {
        node.warn("msg.payload.appUser._id are missing or null");
        return;
      }

      var appusers = msg.payload.appUser._id || msg.payload.appusers;

      var user_key = "user-" + appusers;

      if(!contextSend.get(user_key))
      {
        node.warn("Context flow user dos not exist!!!");
        return;
      }

      var userContext = contextSend.get(user_key);
      var valuetext;
      var valueform;
      var nameUser;


      if(!userContext.falando)
      {
        RED.util.evaluateNodeProperty(propertyForm,propertyType,node,msg, function(err,value) {
          if (err) {
            node.warn(err);
          } 
          else
          {
            valueform = value;
          }
        });

        RED.util.evaluateNodeProperty(property,propertyType,node,msg, function(err,value) {
          if (err) {
            node.warn(err);
          } 
          else
          {
            valuetext = value;
          }
        });
      }

      var menssagem="";
      if(valueform && valueform !== "")
      {
          menssagem += "<b>"+valueform+"</b>\n";
          menssagem += msg.textNav;
      }

      if(valuetext && valuetext !== "")
      {
          menssagem += "\n<b>"+valuetext+"</b>\n";
          menssagem += msg.textForm;
      }

      if(msg.payload.appUser.givenName && msg.payload.appUser.givenName !== "")
      {
          nameUser = msg.payload.appUser.givenName;
      }
      else
      {
          nameUser = msg.payload.messages[0].name;
      }

      var chatCube = {
        "name": nameUser,
        "departmentId":msg.payload.departament || userContext.department,
        "customRoom":{
           "transport":msg.payload.messages[0].source.type,
           "chatId":msg.payload.appUser._id
        },
        "msg": (msg.payload.messages[0].type === "image")?msg.payload.messages[0].mediaUrl:(menssagem || msg.payload.messages[0].text)
     }
     msg.payload.msgBody = chatCube;
     userContext.falando = true;
     
     sendMessage(msg,node);
      //RED.util.setMessageProperty(msg,propertyForm,resultForm.slice(0,resultForm.length-3))
      //RED.util.setMessageProperty(msg,property,resultNav.slice(0,resultNav.length-3))

    });
  }

  RED.nodes.registerType("Chat Cube", ChatcubeNode);

};

