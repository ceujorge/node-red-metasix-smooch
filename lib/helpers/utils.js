var _ = require('underscore');
var validators = require('./validators');

module.exports = {

  /**
   * @method when
   * If an object is thenable, then return the object itself, otherwise wrap it into a promise
   * @param {any}
   * @deferred
   */
  when: function (param) {
    if (param != null && _.isFunction(param.then)) {
      return param;
      // eslint-disable-next-line no-undefined
    } else if (param !== undefined) {
      return new Promise(function(resolve) {
        resolve(param);
      });
    }
    return new Promise(function(resolve, reject) {
      reject();
    });
  },

  /**
   * @method extractValue
   * Get values from node config or inbound message, node config always comes first
   * @param {String} type Type of value to search for
   * @param {String} name Name of variable (name in config and inbound payload must be the same)
   * @param {Object} node
   * @param {Object} message
   * @param {Boolean} usePayload
   * @return {Any}
   */
  // eslint-disable-next-line max-params
  extractValue: function(type, name, node, message, usePayload) {
    usePayload = _.isBoolean(usePayload) ? usePayload : true;
    var validator = null;
    switch(type) {

      case 'boolean':
        validator = validators.boolean;
        break;
      case 'string':
        validator = validators.string;
        break;
      case 'number':
        validator = validators.number;
        break;
      default:
        // eslint-disable-next-line no-console
        console.log('Unable to find a validator for type \'' + type +'\' in extractValue');
    }

    if (validator(node[name])) {
      return node[name];
    } else if (usePayload && message.payload != null && validator(message.payload)) {
      return message.payload;
    } else if (_.isObject(message.payload) && validator(message.payload[name])) {
      return message.payload[name];
    }
    return null;
  },

  chainExtractors: function() {
  },

  
};

String.prototype.textFromDataForm = function textFromDataForm(node, contextChange, msg)
  {
      var originalValue = this
      if(!msg.payload.appUser)
      {
        node.warn("msg.payload.appUser._id are missing or null");
        return;
      }

      var appusers = msg.payload.appUser._id || msg.payload.appusers;

      var user_key = "user-" + appusers;
      var dataReplaceNew = "";

      if(!contextChange.get(user_key))
      {
        node.warn("Context flow user dos not exist!!!");
        return;
      }

      var userContext = contextChange.get(user_key);

      //node.warn(userContext)

      for (var i=0; i < userContext.questions.length; i++)
        {
          //node.warn(userContext.questions[i])
          if(userContext.questions[i].name !== null && userContext.questions[i].dataForm !== null)
          {
            dataReplaceNew = originalValue.replace("{{"+userContext.questions[i].name+"}}", userContext.questions[i].dataForm)
          }
        }
 
        var sub = originalValue.match(/(?<= {{msg:)(.*)(?=}})/i)
        var novo;
        if(sub)
        {
          if(sub.length > 0)
          {
            novo = eval("msg."+sub[0]);
            dataReplaceNew = originalValue.replace("{{msg:"+sub[0]+"}}",novo);
          }
        }
          
      return dataReplaceNew || originalValue;
  }
