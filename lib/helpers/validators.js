var _ = require('underscore');

var validators = {

  string: function(value) {
    return _.isString(value) && !_.isEmpty(value);
  },

  boolean: function(value) {
    return _.isBoolean(value);
  },
  number: function(value) {
    return _.isNumber(value);
  },

};
module.exports = validators;
