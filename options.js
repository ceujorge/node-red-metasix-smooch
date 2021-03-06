/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
"use strict";
var utils = require('./lib/helpers/utils');

const { indexOf } = require('cli-color/beep');
const { value } = require('pb-util/build');

module.exports = function(RED) {
  "use strict";

  var operators = {
      'eq': function(a, b) { return a == b; },
      'neq': function(a, b) { return a != b; },
      'lt': function(a, b) { return a < b; },
      'lte': function(a, b) { return a <= b; },
      'gt': function(a, b) { return a > b; },
      'gte': function(a, b) { return a >= b; },
      'btwn': function(a, b, c) { return (a >= b && a <= c) || (a <= b && a >= c); },
      'cont': function(a, b) { return (a + "").indexOf(b) != -1; },
      'regex': function(a, b, c, d) { return (a + "").match(new RegExp(b,d?'i':'')); },
      'true': function(a) { return a === true; },
      'false': function(a) { return a === false; },
      'null': function(a) { return (typeof a == "undefined" || a === null); },
      'nnull': function(a) { return (typeof a != "undefined" && a !== null); },
      'empty': function(a) {
          if (typeof a === 'string' || Array.isArray(a) || Buffer.isBuffer(a)) {
              return a.length === 0;
          } else if (typeof a === 'object' && a !== null) {
              return Object.keys(a).length === 0;
          }
          return false;
      },
      'nempty': function(a) {
          if (typeof a === 'string' || Array.isArray(a) || Buffer.isBuffer(a)) {
              return a.length !== 0;
          } else if (typeof a === 'object' && a !== null) {
              return Object.keys(a).length !== 0;
          }
          return false;
      },
      'istype': function(a, b) {
          if (b === "array") { return Array.isArray(a); }
          else if (b === "buffer") { return Buffer.isBuffer(a); }
          else if (b === "json") {
              try { JSON.parse(a); return true; }   // or maybe ??? a !== null; }
              catch(e) { return false;}
          }
          else if (b === "null") { return a === null; }
          else { return typeof a === b && !Array.isArray(a) && !Buffer.isBuffer(a) && a !== null; }
      },
      'head': function(a, b, c, d, parts) {
          var count = Number(b);
          return (parts.index < count);
      },
      'tail': function(a, b, c, d, parts) {
          var count = Number(b);
          return (parts.count -count <= parts.index);
      },
      'index': function(a, b, c, d, parts) {
          var min = Number(b);
          var max = Number(c);
          var index = parts.index;
          return ((min <= index) && (index <= max));
      },
      'hask': function(a, b) {
          return (typeof b !== "object" )  &&  a.hasOwnProperty(b+"");
      },
      'jsonata_exp': function(a, b) { return (b === true); },
      'else': function(a) { return a === true; }
  };

  var _maxKeptCount;

  function getMaxKeptCount() {
      if (_maxKeptCount === undefined) {
          var name = "nodeMessageBufferMaxLength";
          if (RED.settings.hasOwnProperty(name)) {
              _maxKeptCount = RED.settings[name];
          }
          else {
              _maxKeptCount = 0;
          }
      }
      return _maxKeptCount;
  }

  function getProperty(node,msg,done) {
      if (node.propertyType === 'jsonata') {
          RED.util.evaluateJSONataExpression(node.property,msg,(err,value) => {
              if (err) {
                  done(RED._("switch.errors.invalid-expr",{error:err.message}));
              } else {
                  done(undefined,value);
              }
          });
      } else {
          RED.util.evaluateNodeProperty(node.property,node.propertyType,node,msg,(err,value) => {
              if (err) {
                  done(undefined,undefined);
              } else {
                  done(undefined,value);
              }
          });
      }
  }

  function getV1(node,msg,rule,hasParts,done) {
      if (rule.vt === 'prev') {
          return done(undefined,node.previousValue);
      } 
      else if (rule.vt === 'cpf') {
        RED.util.evaluateNodeProperty(node.property,node.propertyType,node,msg, function(err,value) {
            if (err) {
                node.warn("erro: "+testaCPF(value))
                return done(undefined, undefined);
            } else {
                node.warn("ok: "+testaCPF(value))
                return done(undefined, testaCPF(value))
            }
        });
      }
      else if (rule.vt === 'cnpj') {
        RED.util.evaluateNodeProperty(node.property,node.propertyType,node,msg, function(err,value) {
            if (err) {
                node.warn("erroCpnj: "+testaCNPJ(value))
                return done(undefined, undefined);
            } else {
                node.warn("okCpnj: "+testaCNPJ(value))
                return done(undefined, testaCNPJ(value));
            }
        });
      }
      else if (rule.vt === 'jsonata') {
          var exp = rule.v;
          if (rule.t === 'jsonata_exp') {
              if (hasParts) {
                  exp.assign("I", msg.parts.index);
                  exp.assign("N", msg.parts.count);
              }
          }
          RED.util.evaluateJSONataExpression(exp,msg,(err,value) => {
              if (err) {
                  done(RED._("switch.errors.invalid-expr",{error:err.message}));
              } else {
                  done(undefined, value);
              }
          });
      } else if (rule.vt === 'json') {
          done(undefined,"json"); // TODO: ?! invalid case
      } else if (rule.vt === 'null') {
          done(undefined,"null");
      } else {
          RED.util.evaluateNodeProperty(rule.v,rule.vt,node,msg, function(err,value) {
              if (err) {
                  done(undefined, undefined);
              } else {
                  done(undefined, value);
              }
          });
      }
  }

  function getV2(node,msg,rule,done) {
      var v2 = rule.v2;
      if (rule.v2t === 'prev') {
          return done(undefined,node.previousValue);
      }
      else if (rule.v2t === 'cpf') {
        node.warn("v2: "+v2);
        return done(undefined,testaCPF(v2));
      }
      else if (rule.v2t === 'cnpj') {
        node.warn("v2: "+v2);
        return done(undefined,testaCNPJ(v2));
      } 
      else if (rule.v2t === 'jsonata') {
          RED.util.evaluateJSONataExpression(rule.v2,msg,(err,value) => {
              if (err) {
                  done(RED._("switch.errors.invalid-expr",{error:err.message}));
              } else {
                  done(undefined,value);
              }
          });
      } else if (typeof v2 !== 'undefined') {
          RED.util.evaluateNodeProperty(rule.v2,rule.v2t,node,msg, function(err,value) {
              if (err) {
                  done(undefined,undefined);
              } else {
                  done(undefined,value);
              }
          });
      } else {
          done(undefined,v2);
      }
  }

  function applyRule(node, msg, property, state, done) {
      var rule = node.rules[state.currentRule];
      var v1,v2;

      getV1(node,msg,rule,state.hasParts, (err,value) => {
          if (err) {
              return done(err);
          }
          v1 = value;
          getV2(node,msg,rule, (err,value) => {
              if (err) {
                  return done(err);
              }
              v2 = value;
              if (rule.t == "else") {
                  property = state.elseflag;
                  state.elseflag = true;
              }
              if (operators[rule.t](property,v1,v2,rule.case,msg.parts)) {
                  msg.userret = rule.ret;
                  state.onward.push(msg);
                  state.elseflag = false;
                  if (node.checkall == "false") {
                      return done(undefined,false);
                  }
              } else {
                  state.onward.push(null);
              }
              done(undefined, state.currentRule < node.rules.length - 1);
          });
      });
  }

  function applyRules(node, msg, property,state,done) {
      if (!state) {
          state = {
              currentRule: 0,
              elseflag: true,
              onward: [],
              hasParts: msg.hasOwnProperty("parts") &&
                              msg.parts.hasOwnProperty("id") &&
                              msg.parts.hasOwnProperty("index")
          }
      }
      applyRule(node,msg,property,state,(err,hasMore) => {
          if (err) {
              return done(err);
          }
          if (hasMore) {
              state.currentRule++;
              applyRules(node,msg,property,state,done);
          } else {
              node.previousValue = property;
              done(undefined,state.onward);
          }
      });
  }
    function testaCPF(strCPF) {
        var original = strCPF;
        strCPF = strCPF.replace(/[^\d]+/g,"");

        var Soma;
        var Resto;
        Soma = 0;
        // Elimina CPFs invalidos conhecidos
        if (strCPF == "00000000000000" || 
        strCPF == "11111111111111" || 
        strCPF == "22222222222222" || 
        strCPF == "33333333333333" || 
        strCPF == "44444444444444" || 
        strCPF == "55555555555555" || 
        strCPF == "66666666666666" || 
        strCPF == "77777777777777" || 
        strCPF == "88888888888888" || 
        strCPF == "99999999999999")
        return undefined;

        const sequencia = strCPF[0].repeat(strCPF.length);
        if (strCPF === sequencia) return undefined;
            
        for (var i=1; i<=9; i++) Soma = Soma + parseInt(strCPF.substring(i-1, i)) * (11 - i);
        Resto = (Soma * 10) % 11;

            if ((Resto == 10) || (Resto == 11))  Resto = 0;
            if (Resto != parseInt(strCPF.substring(9, 10)) ) return undefined;

        Soma = 0;
            for (var i = 1; i <= 10; i++) Soma = Soma + parseInt(strCPF.substring(i-1, i)) * (12 - i);
            Resto = (Soma * 10) % 11;

            if ((Resto == 10) || (Resto == 11))  Resto = 0;
            if (Resto != parseInt(strCPF.substring(10, 11) ) ) return undefined;
            //se valido retorna o proprio CPF
            return original;
    }

    function testaCNPJ(cnpj) {

        var original = cnpj;
        cnpj = cnpj.replace(/[^\d]+/g,"");
     
        if(cnpj == '') return undefined;
         
        if (cnpj.length != 14)
            return undefined;
     
        // Elimina CNPJs invalidos conhecidos
        if (cnpj == "00000000000000" || 
        cnpj == "11111111111111" || 
        cnpj == "22222222222222" || 
        cnpj == "33333333333333" || 
        cnpj == "44444444444444" || 
        cnpj == "55555555555555" || 
        cnpj == "66666666666666" || 
        cnpj == "77777777777777" || 
        cnpj == "88888888888888" || 
        cnpj == "99999999999999")
        return undefined;
        //const sequencia = cnpj[0].repeat(cnpj.length);
        //if (cnpj === sequencia) return undefined;
             
        // Valida DVs
        var tamanho = cnpj.length - 2
        var numeros = cnpj.substring(0,tamanho);
        var digitos = cnpj.substring(tamanho);
        var soma = 0;
        var pos = tamanho - 7;
        for (var i = tamanho; i >= 1; i--) {
          soma += numeros.charAt(tamanho - i) * pos--;
          if (pos < 2)
                pos = 9;
        }
        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(0))
            return undefined;
             
        tamanho = tamanho + 1;
        numeros = cnpj.substring(0,tamanho);
        soma = 0;
        pos = tamanho - 7;
        for (i = tamanho; i >= 1; i--) {
          soma += numeros.charAt(tamanho - i) * pos--;
          if (pos < 2)
                pos = 9;
        }
        var resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(1))
              return undefined;
               
        return original;
    }

  function searchObject(arraySearch, attribute, velue){
    return arraySearch.filter(function (el) {
        return el[attribute] == velue;
    })[0];
  }

  function compositionQuestion (value, description, autosequence){
    var newDescription = description;
    for (var i=0; i<value.length; i++) {
      if(value[i].ret !== undefined)
        newDescription += (autosequence)?`\n\n${i+1 + " - " + value[i].ret}`:`\n\n${value[i].ret}`;
    }
    return newDescription;
  }

  function compositionQuestionButton (useretvalue, value, description, autosequence){
    var buttons = [];
    var dataActions;
    var payload;

    var sub = description.match(/(?<={{btn:)(.*)(?=}})/igm);
    var payloadSub = null;
    var payloadNew = null;
    var textNew = null;
    if(sub)
    {
        for (var i=0; i < sub.length; i++)
        {
            description = description.replace("{{btn:"+sub[i]+"}}","");
            payloadSub = sub[i].match(/(#[0-9]?[0-9])/);
            textNew = sub[i].replace("#","");
            payloadNew = (payloadSub)?payloadSub[0].replace("#",""):textNew
            buttons.push({"type": 'reply', "text": textNew, "payload": payloadNew});
        }
    }

    if(useretvalue)
    {
        for (var i=0; i<value.length; i++) {
        if(value[i].ret !== undefined)
        { 
            dataActions = (autosequence)?`${i+1 + " - " + value[i].ret}`:`${value[i].ret}`;
            payload = value[i].v;
            buttons.push({"type": 'reply', "text": dataActions, "payload": payload});
        }
        }
    }

    return {
        text: description.greeting(),
        role: "appMaker",
        type: "text",
        actions: buttons
    };
  }

  function sendDebug(msg) {
    // don't put blank errors in sidebar (but do add to logs)
    //if ((msg.msg === "") && (msg.hasOwnProperty("level")) && (msg.level === 20)) { return; }
    msg = RED.util.encodeObject(msg, {maxLength:1000});
    RED.comms.publish("debug",msg);
  }

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
          
      return originalValue.replace("{greeting}", valueGreeting.toLowerCase()).replace("{Greeting}", valueGreeting);
  }

  var request = require('request');

  function sendMessage(avatar, debug, dados, msg, node, question, questionWhatsapp){

    var smoochNode = RED.nodes.getNode(node.smooch);

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
    if (msg.payload.appUser === undefined) {
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
      if(question != null )
      {
          if("object" === typeof question){
              if((msg.payload.messages !== undefined) && (msg.payload.messages[0].source.type !== "whatsapp")){
                bodyMsg = question;
              }
              else
              {
                bodyMsg = {"text":questionWhatsapp, "role":"appMaker", "type": "text"};
              }
          }
          else{
            bodyMsg = {"text":question, "role":"appMaker", "type": "text"};
          }
      }
      else
      {
        node.warn('msg.payload.msgBody or msg.payload.valuemsg are missing');
        return;
      }
    }

    bodyMsg.avatarUrl = avatar;

    var opts = {
      method: "POST",
      url: null,
      timeout: 5000,
      headers: {},
      json: true,
      body:null,
    };
    
    var appusers = msg.payload.appusers || msg.payload.appUser._id;
    var apps = msg.payload.appid || smoochNode.appid;
    var username = smoochNode.credentials.username;
    var password = smoochNode.credentials.password;
    var msgBody = bodyMsg || msg.payload.msgBody;
    var host = smoochNode.credentials.host;
    var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

    //verificar efetividade
    if(msg.payload.address){
        msgBody.text = msgBody.text.replace("{address}", msg.payload.address) || "";
    }
    
    msgBody.text = msgBody.text.textFromDataForm(node, dados, msg);
    //node.warn(msgBody);

    opts.url = host + "/apps/" + apps + "/appusers/" + appusers + "/messages";
    opts.headers = {"authorization": auth,"content-type": "application/json",accept:"application/json, text/plain;q=0.9, */*;q=0.8"};
    opts.body = msgBody;

    //node.warn(opts.url);

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

        //node.send(msg);
      }
    });
  }

  function optionsNode(n) {
      RED.nodes.createNode(this, n);
      var node = this;
      node.smooch = n.smooch;
      this.debug = n.debug;
      this.skipbread = n.skipbread;
      this.rules = n.rules || [];
      this.property = n.property;
      this.propertyType = n.propertyType || "msg";
      this.name = n.name;
      this.avatar = n.avatar;
      this.actionbutton = n.actionbutton;

      this.question = n.question;

      this.checkall = n.checkall || "true";
      this.previousValue = null;
      var valid = true;
      var debug = n.debug;
      var skipbread = n.skipbread;
      var repair = n.repair;
      var useretvalue = n.useretvalue;
      var autosequence = n.autosequence;
      var actionbutton = n.actionbutton;
      var needsCount = repair;
      var name = n.name.replace(/\s/g,"").toLowerCase().normalize('NFD').replace(/([\u0300-\u036f]|[^0-9a-zA-Z\s])/g, "");
      var nameOriginal = n.name;
      var avatar = n.avatar;


      //Objeto de contexto usado para grava a questão respondida no contexto do fluxo para a sessão criada atravez do appuserid
      var contextQuestion = this.context().flow;
      var questionOrigem = n.question.greeting();

      var question;
      var questionWhatsapp;
      if(actionbutton)
      {
        question = compositionQuestionButton(useretvalue,this.rules,n.question,autosequence);
        //node.warn(question)
        questionWhatsapp = (useretvalue)?compositionQuestion(this.rules,n.question,autosequence):n.question;
        questionWhatsapp = questionWhatsapp.greeting();
      }
      else
      {
        question = (useretvalue)?compositionQuestion(this.rules,n.question,autosequence):n.question;
        question = question.greeting();
      }

      

      if (this.propertyType === 'jsonata') {
          try {
              this.property = RED.util.prepareJSONataExpression(this.property,this);
          } catch(err) {
              this.error(RED._("switch.errors.invalid-expr",{error:err.message}));
              return;
          }
      }

      for (var i=0; i<this.rules.length; i+=1) {
          var rule = this.rules[i];
          needsCount = needsCount || ((rule.t === "tail"));
          if (!rule.vt) {
              if (!isNaN(Number(rule.v))) {
                  rule.vt = 'num';
              } else {
                  rule.vt = 'str';
              }
          }
          if (rule.vt === 'num') {
              if (!isNaN(Number(rule.v))) {
                  rule.v = Number(rule.v);
              }
          } else if (rule.vt === "jsonata") {
              try {
                  rule.v = RED.util.prepareJSONataExpression(rule.v,node);
              } catch(err) {
                  this.error(RED._("switch.errors.invalid-expr",{error:err.message}));
                  valid = false;
              }
          }
          if (typeof rule.v2 !== 'undefined') {
              if (!rule.v2t) {
                  if (!isNaN(Number(rule.v2))) {
                      rule.v2t = 'num';
                  } else {
                      rule.v2t = 'str';
                  }
              }
              if (rule.v2t === 'num') {
                  rule.v2 = Number(rule.v2);
              } else if (rule.v2t === 'jsonata') {
                  try {
                      rule.v2 = RED.util.prepareJSONataExpression(rule.v2,node);
                  } catch(err) {
                      this.error(RED._("switch.errors.invalid-expr",{error:err.message}));
                      valid = false;
                  }
              }
          }
      }
      if (!valid) {
          return;
      }

      var pendingCount = 0;
      var pendingId = 0;
      var pendingIn = {};
      var pendingOut = {};
      var received = {};

      function addMessageToGroup(id, msg, parts) {
          if (!(id in pendingIn)) {
              pendingIn[id] = {
                  count: undefined,
                  msgs: [],
                  seq_no: pendingId++
              };
          }
          var group = pendingIn[id];
          group.msgs.push(msg);
          pendingCount++;
          var max_msgs = getMaxKeptCount();
          if ((max_msgs > 0) && (pendingCount > max_msgs)) {
              clearPending();
              node.error(RED._("switch.errors.too-many"), msg);
          }
          if (parts.hasOwnProperty("count")) {
              group.count = parts.count;
          }
          return group;
      }

      function drainMessageGroup(msgs,count,done) {
          var msg = msgs.shift();
          msg.parts.count = count;
          processMessage(msg,false, err => {
              if (err) {
                  done(err);
              } else {
                  if (msgs.length === 0) {
                      done()
                  } else {
                      drainMessageGroup(msgs,count,done);
                  }
              }
          })
      }
      function addMessageToPending(msg,done) {
          var parts = msg.parts;
          // We've already checked the msg.parts has the require bits
          var group = addMessageToGroup(parts.id, msg, parts);
          var msgs = group.msgs;
          var count = group.count;
          var msgsCount = msgs.length;
          if (count === msgsCount) {
              // We have a complete group - send the individual parts
              drainMessageGroup(msgs,count,err => {
                  pendingCount -= msgsCount;
                  delete pendingIn[parts.id];
                  done();
              })
              return;
          }
          done();
      }

      function sendGroup(onwards, port_count) {
          var counts = new Array(port_count).fill(0);
          for (var i = 0; i < onwards.length; i++) {
              var onward = onwards[i];
              for (var j = 0; j < port_count; j++) {
                  counts[j] += (onward[j] !== null) ? 1 : 0
              }
          }
          var ids = new Array(port_count);
          for (var j = 0; j < port_count; j++) {
              ids[j] = RED.util.generateId();
          }
          var ports = new Array(port_count);
          var indexes = new Array(port_count).fill(0);
          for (var i = 0; i < onwards.length; i++) {
              var onward = onwards[i];
              for (var j = 0; j < port_count; j++) {
                  var msg = onward[j];
                  if (msg) {
                      var new_msg = RED.util.cloneMessage(msg);
                      var parts = new_msg.parts;
                      parts.id = ids[j];
                      parts.index = indexes[j];
                      parts.count = counts[j];
                      ports[j] = new_msg;
                      indexes[j]++;
                  }
                  else {
                      ports[j] = null;
                  }
              }
              node.send(ports);
          }
      }

      function sendGroupMessages(onward, msg) {
          var parts = msg.parts;
          var gid = parts.id;
          received[gid] = ((gid in received) ? received[gid] : 0) +1;
          var send_ok = (received[gid] === parts.count);

          if (!(gid in pendingOut)) {
              pendingOut[gid] = {
                  onwards: []
              };
          }
          var group = pendingOut[gid];
          var onwards = group.onwards;
          onwards.push(onward);
          pendingCount++;
          if (send_ok) {
              sendGroup(onwards, onward.length, msg);
              pendingCount -= onward.length;
              delete pendingOut[gid];
              delete received[gid];
          }
          var max_msgs = getMaxKeptCount();
          if ((max_msgs > 0) && (pendingCount > max_msgs)) {
              clearPending();
              node.error(RED._("switch.errors.too-many"), msg);
          }
      }

      function processMessage(msg, checkParts, done) {
          var hasParts = msg.hasOwnProperty("parts") &&
                          msg.parts.hasOwnProperty("id") &&
                          msg.parts.hasOwnProperty("index");

          if (needsCount && checkParts && hasParts) {
              addMessageToPending(msg,done);
          } else {
              getProperty(node,msg,(err,property) => {
                  if (err) {
                      node.warn(err);
                      done();
                  } else {
                        
                        // exit if empty appusers
                        if (msg.payload.appUser === undefined) {
                          node.warn('msg.payload.appusers or msg.payload.appUser._id are missing or null');
                          return;
                        }
                        var appusers = msg.payload.appusers || msg.payload.appUser._id;

                      if(!contextQuestion.get("user-"+appusers))
                      { 
                        var users = {"id":appusers,"lasttime": new Date(), "questions":[],"onetimenode":[], "done":false};
                        contextQuestion.set("user-"+appusers, users)
                      }
                      var dados = contextQuestion.get("user-"+appusers)

                      var valores = searchObject(dados.questions, "name", name)

                      if(!valores)
                      {
                        var quest = {"nameOriginal":nameOriginal, name: name, text:questionOrigem, "dataForm":null, "original":null, "fristtime":true, "skipbread":skipbread};
                        dados.questions.push(quest);
                        //node.warn(property);
                        sendMessage(avatar, debug, contextQuestion, msg, node, question, questionWhatsapp)
                        return done();
                      }

                      if(!valores.fristtime)
                      {
                        var newVar = []
                        for (var i=0; i<valores.original.length; i++)
                        {
                          newVar.push(null);
                          if(valores.original[i])
                          {
                            newVar[i] = msg;
                          }
                        }
                        if (err) {
                          node.warn(err);
                        } else {
                            if (!repair || !hasParts) {
                                node.send(newVar);
                            } else {
                                sendGroupMessages(newVar, msg);
                            }
                        }
                        done();
                      }
                      else
                      {
                        applyRules(node,msg,property,undefined,(err,onward) => {
                            if (err) {
                                node.warn(err);
                            } else {
                                if (!repair || !hasParts) {
                                    node.send(onward);
                                } else {
                                    sendGroupMessages(onward, msg);
                                }
                                var idx = dados.questions.findIndex(x => x.name === name)
                                dados.questions[idx].original = onward;
                                dados.questions[idx].fristtime = false;
                                dados.questions[idx].dataForm = property;
                            }
                            done();
                        });
                     }
                   }
               });
          }
      }

      function clearPending() {
          pendingCount = 0;
          pendingId = 0;
          pendingIn = {};
          pendingOut = {};
          received = {};
      }

      var pendingMessages = [];
      var handlingMessage = false;
      var processMessageQueue = function(msg) {
          if (msg) {
              // A new message has arrived - add it to the message queue
              pendingMessages.push(msg);
              if (handlingMessage) {
                  // The node is currently processing a message, so do nothing
                  // more with this message
                  return;
              }
          }
          if (pendingMessages.length === 0) {
              // There are no more messages to process, clear the active flag
              // and return
              handlingMessage = false;
              return;
          }

          // There are more messages to process. Get the next message and
          // start processing it. Recurse back in to check for any more
          var nextMsg = pendingMessages.shift();
          handlingMessage = true;
          processMessage(nextMsg,true,err => {
              if (err) {
                  node.error(err,nextMsg);
              }
              processMessageQueue()
          });
      }

      this.on('input', function(msg) {
          msg.nameOriginal = nameOriginal;
          msg.nodename = name;

        if(actionbutton){
            if((msg.payload.messages !== undefined) && (msg.payload.messages[0].payload !== undefined) && (msg.payload.messages[0].source.type !== "whatsapp")){
                msg.payload.messages[0].text = msg.payload.messages[0].payload;
            }
        }
          processMessageQueue(msg);
      });

      this.on('close', function() {
          clearPending();
      });
  }

  RED.nodes.registerType("Options", optionsNode);

}