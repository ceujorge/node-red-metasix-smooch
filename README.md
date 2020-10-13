# README #
Dialogflow node for Node-RED. Uses the new API V2 version. with the possibility to use events and queryParams
You receive a text request for input. As a result, we get the full answer from the Dialogflow API.
Now improved it receives events and it is also possible to pass queryParams.

The node code was forked and new features were added. Thank you very much [german-st](https://github.com/german-st "german-st") for [dialogflowv2](https://github.com/german-st/dialogflowv2 "dialogflowv2")


### Inputs

`msg.payload` *string*

The text of our request for NLP

### Outputs

`msg._dialogflow ` *Object*

Result. Object from Dialogflow API response for our text request.

### Details

`msg.payload` Not affected or processed. The output remains the same.


### Inputs Events

`msg.payload` *string*
`msg.events` *Object type event Dialogflow*

The request Dialogflow 

### Outputs

`msg._dialogflow ` *Object*

Result. Object from Dialogflow API response for our request.

### Details

`msg.payload` Not affected or processed. The output remains the same.

### Inputs Events

`msg.payload` *string*
`msg.queryParams` *Object type queryParams Dialogflow*

The request Dialogflow 

### Outputs

`msg._dialogflow ` *Object*

Result. Object from Dialogflow API response for our request.

### Details

`msg.payload` Not affected or processed. The output remains the same.