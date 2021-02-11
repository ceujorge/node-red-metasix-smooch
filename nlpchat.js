"use strict";
const { fontcolor } = require('cli-color/beep');
var utils = require('./lib/helpers/utils');
const { string } = require('./lib/helpers/validators');
const { NlpManager } = require('node-nlp');

module.exports = function (RED) {

  var debuglength = RED.settings.debugMaxLength || 1000;

  function NlpNode(n) {
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
        //return;
      }

      var userContext = contextSend.get(user_key);

      //RED.util.setMessageProperty(msg,propertyForm,resultForm.slice(0,resultForm.length-3))
      //RED.util.setMessageProperty(msg,property,resultNav.slice(0,resultNav.length-3))

      const manager = new NlpManager({ languages: ['pt'], forceNER: true });
      // Adds the utterances and intents for the NLP
      manager.addDocument('pt', 'Até mais!', 'greetings.bye');
      manager.addDocument('pt', 'Tchau se cuida', 'greetings.bye');
      manager.addDocument('pt', 'Ok até amis', 'greetings.bye');
      manager.addDocument('pt', 'tchau até logo', 'greetings.bye');
      manager.addDocument('pt', 'até logo', 'greetings.bye');
      manager.addDocument('pt', 'Oi', 'greetings.hello');
      manager.addDocument('pt', 'ola', 'greetings.hello');
      manager.addDocument('pt', 'oi oi', 'greetings.hello');

      // Train also the NLG
      manager.addAnswer('pt', 'greetings.bye', 'até a proxima');
      manager.addAnswer('pt', 'greetings.bye', 'nos vemos em breve');
      manager.addAnswer('pt', 'greetings.hello', 'olá');
      manager.addAnswer('pt', 'greetings.hello', 'oi');

      // Train and save the model.
      (async() => {
          node.warn(manager);
          await manager.train();
          manager.save();
          node.warn(manager);
          const response = await manager.process('pt', msg.payload.messages[0].text);
          node.send(response);
      })();


    });
  }

  RED.nodes.registerType("Npl", NlpNode);

};

