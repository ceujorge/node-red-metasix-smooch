"use strict";
const { fontcolor } = require('cli-color/beep');
var utils = require('./lib/helpers/utils');
const { string } = require('./lib/helpers/validators');

module.exports = function (RED) {

  var debuglength = RED.settings.debugMaxLength || 1000;

  function Breadcrumb(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    node.name = n.name;
    node.grouptype = n.grouptype;
    node.property = n.property;
    node.propertyForm = n.propertyForm;
    node.propertyForm2 = n.propertyForm2;
    node.buscaDepto = n.buscaDepto;

    node.propertyType2 = n.propertyType2;

    var propertyForm = node.propertyForm;
    var property = node.property;
 
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

      if(!userContext.done)
      {
        var resultNav = "";
        var resultForm = "";

        for (var i=0; i<userContext.questions.length; i++)
        {
          if(userContext.questions[i].original !== null  || userContext.questions[i].skipbread === false)
          {
            for (var y=0; y<userContext.questions[i].original.length; y++)
            {
              if(userContext.questions[i].original[y] !== null)
              {
                if(grouptype === "textquestion"){
                  if(msg.payload.messages[0].source.type === "whatsapp")
                  {
                    resultForm += "telefone Whatsapp : " + payload.appUser.userId + " \n ";
                  }
                  resultForm += userContext.questions[i].text + " : " + userContext.questions[i].dataForm + " | ";
                  resultNav += userContext.questions[i].text + " : " + userContext.questions[i].original[y].userret + " | ";
                }
                else{
                  resultForm += userContext.questions[i].nameOriginal + " : " + userContext.questions[i].dataForm + " | ";
                  resultNav += userContext.questions[i].nameOriginal + " : " + userContext.questions[i].original[y].userret + " | ";
                }
              }
            }
          }
        }

        RED.util.setMessageProperty(msg,propertyForm,resultForm.slice(0,resultForm.length-3))
        RED.util.setMessageProperty(msg,property,resultNav.slice(0,resultNav.length-3))

        userContext.done = true;
    }

    node.send(msg);

    });
  }

  RED.nodes.registerType("Breadcrumb", Breadcrumb);

};

