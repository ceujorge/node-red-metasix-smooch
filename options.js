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
      } else if (rule.vt === 'jsonata') {
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
      } else if (rule.v2t === 'jsonata') {
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

  function searchObject(arraySearch, attribute, velue){
    return arraySearch.filter(function (el) {
        return el[attribute] == velue;
    })[0];
  }

  var request = require('request');

  function sendMessage(msg, node){

    var smoochNode = RED.nodes.getNode(node.smooch);
    var debug = false;//utils.extractValue('boolean', 'debug', node, msg, false);

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
  }

  function optionsNode(n) {
      RED.nodes.createNode(this, n);
      var node = this;
      node.smooch = n.smooch;
      this.rules = n.rules || [];
      this.property = n.property;
      this.propertyType = n.propertyType || "msg";
      this.name = n.name;
      node.question = n.question;

      this.checkall = n.checkall || "true";
      this.previousValue = null;
      var valid = true;
      var repair = n.repair;
      var needsCount = repair;
      var name = n.name;
      var question = n.question;

      //Variavel usada para grava a questão respondida no contexto do fluxo para a sessão criada atravez do appuserid
      var contextQuestion = this.context().flow;

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

                      if(!contextQuestion.get("user-"+msg.payload.appusers))
                      { 
                        var users = {"id":msg.payload.appusers, "questions":[], "done":false};
                        contextQuestion.set("user-"+msg.payload.appusers, users)
                      }
                      var dados = contextQuestion.get("user-"+msg.payload.appusers)

                      var valores = searchObject(dados.questions, "name", name)

                      if(!valores)
                      {
                        var quest = {"name":name,"original":null, "fristtime":true};
                        dados.questions.push(quest);
                        //node.warn(dados);
                        msg.payload.msgBody.text = question;
                        sendMessage(msg, node)
                        done();
                        return;
                      }

                      if(!valores.fristtime)
                      {
                        for (var i=0; i<valores.original.length; i+=1)
                        {
                          if(valores.original[i])
                          {
                            valores.original[i] = msg;
                          }
                        }
                        if (err) {
                          node.warn(err);
                        } else {
                            if (!repair || !hasParts) {
                                node.send(valores.original);
                            } else {
                                sendGroupMessages(valores.original, msg);
                            }
                        }
                        //node.warn(dados); // aqui é o lugar de verificação
                        //node.warn("segundo"); 
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
                                //var pergunta = {"nome":name,"original":onward};
                                var idx = dados.questions.findIndex(x => x.name === name)
                                dados.questions[idx].original = onward;
                                dados.questions[idx].fristtime = false;
                            }
                            //node.warn(dados); // aqui é o lugar de verificação
                            //node.warn("primeiro"); 
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
          processMessageQueue(msg);
      });

      this.on('close', function() {
          clearPending();
      });
  }

  RED.nodes.registerType("options", optionsNode);

}