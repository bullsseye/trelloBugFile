var flock = require('flockos');
var config = require('./config.js');
var express = require('express');
var fs = require('fs');
var Trello = require("node-trello");
flock.setAppId(config.appId);
flock.setAppSecret(config.appSecret);

var app = express();

var t = new Trello('a6d7c94e4660fda9c91eed95b378e0bb', '8422614cf37f6ed411d70d3e007bf457a325e62994816ee256b8650e70285112');
var myList = '5890a0fe444a0465899250c2';

// Listen for events on /events, and verify event tokens using the token verifier.
app.use(flock.events.tokenVerifier);
app.post('/', flock.events.listener);

// Read tokens from a local file, if possible.
var tokens;
try {
    tokens = require('./tokens.json');
} catch (e) {
    tokens = {};
}

// save tokens on app.install
flock.events.on('app.install', function (event) {
    console.error("inside app.install");
    tokens[event.userId] = event.token;
});

// delete tokens on app.uninstall
flock.events.on('app.uninstall', function (event) {
    delete tokens[event.userId];
});

function createAttachmentList(resp) {
  var arrayAttachment = [];

  if (resp.attachments === undefined)
    return arrayAttachment;

  var attachment = resp.attachments[0];
  if (attachment !== undefined) {
   var views = attachment.views;
   if (views !== undefined) {
    var image = views.image;
    if (image !== undefined) {
      arrayAttachment.push(image.original.src);
    }
  }

  var downloads = resp.downloads;
  if (downloads !== undefined) {
    for (var download of downloads) {
      arrayAttachment.push(download.src);
    }
  }
  
}
return arrayAttachment;
}

function onFetchCardMetadata(err, data, urlList) {
  if (err) {
    console.error("onFetchCardMetadata: Fetching Card Short Link: e: " + err);
  } else {
    cardData = data[0];
    var shortLink = cardData.shortLink;
    for (var url of urlList) {
      t.post("/1/cards/" + shortLink + "/attachments", 
            {url: url}, 
            function(onAttachmentPostErr, onAttachmentPostData) {
              if (onAttachmentPostErr) {
                console.error("onAttachmentPost: Posting Card attachment: e: " + onAttachmentPostErr);
              } else {
                console.log("onAttachmentPost: Posting Card attachment: success: " + onAttachmentPostData)
              }
            });
    }
  }

}

function onCardPost(err, data, urlList) {
  if (err) console.log(err);
  else {

    if (urlList.length != 0) {
      t.get("/1/lists/" + myList + "/cards", 
            { limit: 1 }, 
            function(onFetchCardMetadataErr, onFetchCardMetadataData){
              onFetchCardMetadata(onFetchCardMetadataErr, onFetchCardMetadataData, urlList);
            }); 
    }
  }
}

flock.events.on('client.messageAction', function (event) {
        console.error("inside client.messageAction");
  flock.callMethod('chat.fetchMessages', 
                     tokens[event.userId], 
                     {"chat": event.chat,
                      "uids": event.messageUids 
                     },
                     function (error, response) {
                       if (!error) {
                                 console.error(response);
                                 var name = '';
                                 var desc = '';
                                 var urlList = [];
                                 for (var resp of response) {
                                     console.error('resp: ' + JSON.stringify(resp));
                                     if (resp.text != null && resp.text.length != 0 && name.length == 0) {
                                         name = resp.text;
                                         console.error("inside name");
                                     }
                                     desc += '   ' + JSON.stringify(resp);
                                     urlList = urlList.concat(createAttachmentList(resp));
                                 }

                                 console.error("urlList: " + urlList.toString());
                                 var newCard = {
                                     name: name, 
                                     desc: desc,
                                     idList: myList,
                                     pos: 'top'
                                };
                                t.post("/1/cards/", 
                                       newCard, 
                                      function(err, data) {
                                          onCardPost(err, data, urlList);
                                      });
                       } else {
                                 console.error(error);
                       }
               });
        return {
            text: 'This message has been marked as bug on Trello'
        }
});

// Start the listener after reading the port from config
var port = config.port || 8080;
app.listen(port, function () {
    console.log('Listening on port: ' + port);
});

// exit handling -- save tokens in token.js before leaving
process.on('SIGINT', process.exit);
process.on('SIGTERM', process.exit);
process.on('exit', function () {
    fs.writeFileSync('./tokens.json', JSON.stringify(tokens));
});
