"use strict";
var utils = require('./lib/helpers/utils');
var request = require('request');
const { string } = require('./lib/helpers/validators');
const axios = require('axios');

module.exports = function (RED) {

  function BacktoNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    node.name = config.name;
    node.nodestep = config.nodestep;
    
    
    this.on("input", function (msg) {
      var name = utils.extractValue('string', 'name', node, msg, false);
      var nodestep = utils.extractValue('string', 'nodestep', node, msg, false);

      name = name.replace(" ","").toLowerCase().normalize('NFD').replace(/([\u0300-\u036f]|[^0-9a-zA-Z\s])/g, "");

      nodestep = nodestep.replace(" ","").toLowerCase().normalize('NFD').replace(/([\u0300-\u036f]|[^0-9a-zA-Z\s])/g, "");

      var contextQuestion = this.context().flow;

      var appusers = "user-"+msg.payload.appUser._id;
      
      var valueQuestion;

      if(contextQuestion.get(appusers))
      {
        valueQuestion = contextQuestion.get(appusers)

      }

      for(var i=valueQuestion.questions.length-1;i>=0;i--){
        if(valueQuestion.questions[i].name != nodestep){
          valueQuestion.questions.splice(i, 1);
        }
        else if(valueQuestion.questions[i].name === nodestep)
        {
          valueQuestion.questions[i].dataForm = null;
          valueQuestion.questions[i].original = null;
          valueQuestion.questions[i].fristtime = true;
          break;
        }
        else{
          break;
        }
      }

      node.warn(msg);
      
    });
  }

  RED.nodes.registerType("Back to", BacktoNode);

};

