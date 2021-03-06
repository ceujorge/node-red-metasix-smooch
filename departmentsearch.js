"use strict";
const { fontcolor } = require('cli-color/beep');
var utils = require('./lib/helpers/utils');
const { string } = require('./lib/helpers/validators');

module.exports = function (RED) {

  var debuglength = RED.settings.debugMaxLength || 1000;

  function Department(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    node.name = n.name;
    node.grouptype = n.grouptype;
    node.propertyin = n.propertyin;
    node.propertyout = n.propertyout;
    node.propertyType = n.propertyType;
    node.propertyType2 = n.propertyType2;
    node.buscaDepto = n.buscaDepto;

    var propertyType = node.propertyType;
    var propertyType2 = node.propertyType2;

    var buscaDepto = node.buscaDepto;
    var propertyin = node.propertyin;
    var propertyout = node.propertyout;
    
    this.on("input", function (msg) {

      var valorin = null;

      if(!msg.payload.appUser)
      {
        node.warn("msg.payload.appUser._id are missing or null");
        return;
      }

      var appusers = msg.payload.appUser._id || msg.payload.appusers;

      //Objeto de contexto usado para grava a questão respondida no contexto do fluxo para a sessão criada atravez do appuserid
    var contextSend = this.context().flow;

      var user_key = "user-" + appusers;

      if(!contextSend.get(user_key))
      {
        node.warn("Context flow user dos not exist!!!");
        return;
      }

      var userContext = contextSend.get(user_key);

      RED.util.evaluateNodeProperty(propertyin,propertyType,node,msg, function(err,value) {
        if (err) {
          node.warn(err);
        } 
        else
        {
          valorin = value;
        }
      });

      var dpto = null;
      var dptoValor = null;

      if(buscaDepto !== "")
      {
        if(propertyType2 === "json")
        {
          if(valorin !== "")
          {
            var dptolist =  JSON.parse(buscaDepto);
            node.warn(dptolist);
            node.warn(valorin);
            dpto = procurarIndice(dptolist,"id", valorin);
            if(dpto.departamento){
              dptoValor = dpto.departamento;
            }
          }
          else
          {
            node.warn("msg.payload.department are missing")
          }
        }
        else
        {
          dptoValor = buscaDepto
        }
      }

      userContext.department = dptoValor;

      RED.util.setMessageProperty(msg,propertyout,dptoValor)
      
      node.send(msg)

    });
  }

  RED.nodes.registerType("Department", Department);

  function procurarIndice(arraySearch, atributo, valor){
      var chave = atributo;
      var valor = valor;
      return arraySearch.filter(function (el) {
          return el[chave] == valor;
      })[0];
  }
};

