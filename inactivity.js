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
    var cron = require("cron");


    function msgInactivity(node, msg){
        var userContext = node.context().flow;
        var keys = userContext.keys();
    
        var today = new Date();
        
        var minutes;
        var dados;
        
        
        for(var i=keys.length-1;i>=0;i--){
            if(keys[i].indexOf("user-")!= -1)
            {
                dados = userContext.get(keys[i]);
                minutes = (parseInt((Math.abs(dados.lasttime) - today.getTime()) / (1000 * 60) % 60)*-1);
                
                if(minutes >= 1)
                {
                    if(!dados.count)
                        dados.count = 0
                        
                    dados.count++;
                    
                    if(dados.count >= node.attempts)
                    {
                        //userContext.set(keys[i], undefined);
                        node.send([null, {"payload":{"appUser":{"_id":dados.id},"msg":msg}}])
                        return;
                    }
                    node.send([{"payload":{"appUser":{"_id":dados.id}, "msg":msg}}, null]);
                }
            }
        }
      }

    function InactivityNode(n) {
        RED.nodes.createNode(this,n);
        this.attempts = n.attempts;
        this.payload = n.payload;
        this.payloadType = n.payloadType;
        this.repeat = n.repeat;
        this.crontab = n.crontab;
        this.once = n.once;
        this.onceDelay = (n.onceDelay || 0.1) * 1000;
        this.interval_id = null;
        this.cronjob = null;
        var node = this;

        if (node.repeat > 2147483) {
            node.error(RED._("inject.errors.toolong", this));
            delete node.repeat;
        }

        node.repeaterSetup = function () {
          if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
            this.repeat = this.repeat * 1000;
            if (RED.settings.verbose) {
              this.log(RED._("inject.repeat", this));
            }
            this.interval_id = setInterval(function() {
              node.emit("input", {});
            }, this.repeat);
          } else if (this.crontab) {
            if (RED.settings.verbose) {
              this.log(RED._("inject.crontab", this));
            }
            this.cronjob = new cron.CronJob(this.crontab, function() { node.emit("input", {}); }, null, true);
          }
        };

        if (this.once) {
            this.onceTimeout = setTimeout( function() {
              node.emit("input",{});
              node.repeaterSetup();
            }, this.onceDelay);
        } else {
          node.repeaterSetup();
        }

        this.on("input",function(msg) {
            msg.attempts = this.attempts;
            if (this.payloadType !== 'flow' && this.payloadType !== 'global') {
                try {
                    if ( (this.payloadType == null && this.payload === "") || this.payloadType === "date") {
                        msg.payload = Date.now();
                    } else if (this.payloadType == null) {
                        msg.payload = this.payload;
                    } else if (this.payloadType === 'none') {
                        msg.payload = "";
                    } else {
                        msg.payload = RED.util.evaluateNodeProperty(this.payload,this.payloadType,this,msg);
                    }
                    msgInactivity(node,msg);
                    //this.send(msg);
                    msg = null;
                } catch(err) {
                    this.error(err,msg);
                }
            } else {
                RED.util.evaluateNodeProperty(this.payload,this.payloadType,this,msg, function(err,res) {
                    if (err) {
                        node.error(err,msg);
                    } else {
                        msg.payload = res;
                        msgInactivity(node,msg);
                        //node.send(msg);
                    }

                });
            }
        });
    }

    RED.nodes.registerType("Inactivity",InactivityNode);

    InactivityNode.prototype.close = function() {
        if (this.onceTimeout) {
            clearTimeout(this.onceTimeout);
        }
        if (this.interval_id != null) {
            clearInterval(this.interval_id);
            if (RED.settings.verbose) { this.log(RED._("inject.stopped")); }
        } else if (this.cronjob != null) {
            this.cronjob.stop();
            if (RED.settings.verbose) { this.log(RED._("inject.stopped")); }
            delete this.cronjob;
        }
    };

    RED.httpAdmin.post("/Inactivity/:id", RED.auth.needsPermission("inject.write"), function(req,res) {
        var node = RED.nodes.getNode(req.params.id);
        if (node != null) {
            try {
                node.receive();
                res.sendStatus(200);
            } catch(err) {
                res.sendStatus(500);
                node.error(RED._("inject.failed",{error:err.toString()}));
            }
        } else {
            res.sendStatus(404);
        }
    });
}