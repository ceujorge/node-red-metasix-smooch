"use strict";
var utils = require('./lib/helpers/utils');
var request = require('request');
const { string } = require('./lib/helpers/validators');
const axios = require('axios');

module.exports = function (RED) {

  function googleFormatAddress(addressFormated){

    if(addressFormated.status === "OK")
    {
        var endereco = {
          completo:"",
          lougradouro:"",
          numero:"",
          bairro:"",
          cidade:"",
          estado:"",
          cep:""
      }
      var matriz = addressFormated.results[0].address_components;
      for(var i=0; i<matriz.length; i++) {
          if(matriz[i].types[0] === "street_number")
              endereco.numero = matriz[i].long_name;
          else if(matriz[i].types[0] === "route")
              endereco.lougradouro = matriz[i].long_name;
          else if(matriz[i].types[0] === "political")
              endereco.bairro = matriz[i].long_name;
          else if(matriz[i].types[0] === "administrative_area_level_2")
              endereco.cidade = matriz[i].long_name;
          else if(matriz[i].types[0] === "administrative_area_level_1")
              endereco.estado = matriz[i].long_name;
          else if(matriz[i].types[0] === "postal_code")
              endereco.cep = matriz[i].long_name;
      }
      var format_endereco = endereco.lougradouro+", "+
                          endereco.numero+" - "+
                          endereco.bairro+", "+
                          endereco.cidade+", "+
                          endereco.estado+", "+
                          endereco.cep

      return format_endereco.replace("undefined","não encontrado");
    }
  }

  function oenstreetFormatAddress(addressFormated){

    var address = addressFormated[0];
    if(address.address)
    {

      var format_endereco = address.address.road+", "+
      address.address.house_number+" - "+
      address.address.suburb+", "+
      address.address.city+", "+
      address.address.state+", "+
      address.address.postcode

      return format_endereco;
    }
  }

  function CheckaddressNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    node.typecheck = config.typecheck;
    node.name = config.name;
    node.keyvalue = config.keyvalue;

    //Objeto de contexto usado para grava a questão respondida no contexto do fluxo para a sessão criada atravez do appuserid
    var contextSend = this.context().flow;
    
    this.on("input", function (msg) {
      var typecheck = utils.extractValue('boolean', 'typecheck', node, msg, false);
      var name = utils.extractValue('string', 'name', node, msg, false);
      var keyvalue = utils.extractValue('string', 'keyvalue', node, msg, false);

      name = name.replace(" ","").toLowerCase().normalize('NFD').replace(/([\u0300-\u036f]|[^0-9a-zA-Z\s])/g, "");

      var userContext = node.context().flow;

        if(!msg.payload.appUser._id)
        {
          node.warn("msg.payload.appUser._id is missing or undefined")
          return;
        }

        var appusers = "user-"+msg.payload.appUser._id;
        var usrcontex;

        if(userContext.get(appusers))
        { 
          usrcontex = userContext.get(appusers);
          if(!usrcontex.address){
            usrcontex.address = [];
            usrcontex.address.push({name:name, address:""});
          }
        }

        var idx = usrcontex.address.findIndex(x => x.name === name);

        if(idx > -1){
          node.warn(usrcontex);
          if(usrcontex.address[idx].address != "")
          {
            node.warn(usrcontex);
            node.send(msg);
            return;
          }
        }

      var query = "";
      if(msg.payload.messages[0].coordinates)
      {
          query = "latlng="+ msg.payload.messages[0].coordinates.lat +","+ msg.payload.messages[0].coordinates.long;
      }
      else if (msg.payload.messages[0].text)
      {
          query = "address="+ msg.payload.messages[0].text;
      }

      if(typecheck){
        query = "https://maps.googleapis.com/maps/api/geocode/json?"+query+"&key="+keyvalue;//AIzaSyDT9UBTKNeChDG5Qft0fPXHZPInAjo2YBI";
      }else{
        query = (query.indexOf("latlng=")>-1)?query.replace(",","&lon="):query;
        query = "https://nominatim.openstreetmap.org/" + query.replace("address=","search.php?q=").replace("latlng=","reverse.php?lat=") + "&format=json&addressdetails=1"
      }

      var addressFormated;
      (async () => {
        try {
          node.status({fill: "blue",shape: "dot",text: "checking"});
          const response = await axios.get(query)
          addressFormated = response.data;

            msg.payload.address = ((typecheck)?googleFormatAddress(addressFormated):oenstreetFormatAddress(addressFormated));

            usrcontex.address[idx].address = msg.payload.address;

            node.send(msg);

          node.status({fill: "green",shape: "dot",text: "done"});
        } catch (error) {
          node.warn(error.response);
        }
      })();
      
    });
  }

  RED.nodes.registerType("Address", CheckaddressNode);

};

