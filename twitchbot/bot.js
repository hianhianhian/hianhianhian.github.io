// Adapted from https://gist.github.com/AlcaDesign/742d8cb82e3e93ad4205

var fadeDelay = false, // Set to false to disable chat fade
    showChannel = true, // Show repespective channels if the channels is longer than 1
    useColor = true, // Use chatters' colors or to inherit
    showBadges = true, // Show chatters' badges
    showEmotes = true, // Show emotes in the chat
    doTimeouts = false, // Hide the messages of people who are timed-out
    doChatClears = false, // Hide the chat from an entire channel
    showHosting = true, // Show when the channel is hosting or not
    showConnectionNotices = true; // Show messages like "Connected" and "Disconnected"
    channels = [];

var defaultColors = ['rgb(255, 0, 0)','rgb(0, 0, 255)','rgb(0, 128, 0)','rgb(178, 34, 34)','rgb(255, 127, 80)','rgb(154, 205, 50)','rgb(255, 69, 0)','rgb(46, 139, 87)','rgb(218, 165, 32)','rgb(210, 105, 30)','rgb(95, 158, 160)','rgb(30, 144, 255)','rgb(255, 105, 180)','rgb(138, 43, 226)','rgb(0, 255, 127)'],
    randomColorsChosen = {};

// Define configuration options
var opts = {
  options: { debug: true },
  connection: {
    reconnect: true,
    secure: true
  },
  identity: {
    username: 'hianbot',
    password: 'oauth:i1n8gxfe7qgw2y3yym5xgxhsqt6po6'
  },
  channels: channels
};
var clientID = "e99lumfuxgscjd7y5mrnnxrqpmhctb";

// variables to store channel's BTTV and FFZ emotes
var bttvEmotes = new Map();
var ffzEmotes = new Map();

// Helper functions

function dehash(channel) {
	return channel.replace(/^#/, '');
}

function capitalize(n) {
	return n[0].toUpperCase() +  n.substr(1);
}

function htmlEntities(html) {
	function it() {
		return html.map(function(n, i, arr) {
				if(n.length == 1) {
					return n.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
						   return '&#'+i.charCodeAt(0)+';';
						});
				}
				return n;
			});
	}
	var isArray = Array.isArray(html);
	if(!isArray) {
		html = html.split('');
	}
	html = it(html);
	if(!isArray) html = html.join('');
	return html;
}

// Twitch emote parsing from https://github.com/tmijs/tmi.js/issues/11
// Altered with FFZ and BTTV emotes using code from https://www.reddit.com/r/Twitch/comments/4e22p6/parsing_twitch_emotes_js/
function formatEmotes(text, emotes) {
	var splitText = text.split('');
	for(var emoteIndex in emotes) {
		var emote = emotes[emoteIndex];
		for(var charIndex in emote) {
			var emoteIndexes = emote[charIndex];

			if(typeof emoteIndexes == 'string') {
				emoteIndexes = emoteIndexes.split('-');
				emoteIndexes = [parseInt(emoteIndexes[0]), parseInt(emoteIndexes[1])];
        for(var i = emoteIndexes[0]; i <= emoteIndexes[1]; ++i) {
          splitText[i] = "";
        }
        splitText[emoteIndexes[0]] = '<img class="emoticon" src="https://static-cdn.jtvnw.net/emoticons/v1/' + emoteIndex + '/3.0">';
			}
		}
	}
  var tempMsg = splitText.join('').split(' ');
  for (let i in tempMsg) {
    if (ffzEmotes.has(tempMsg[i])) {
      var url;
      for (let j in ffzEmotes.get(tempMsg[i])) {
        url = ffzEmotes.get(tempMsg[i])[j]
      }
        tempMsg[i] = '<img class="emoticon" src="https://' + url + '">';
    }
    if (bttvEmotes.has(tempMsg[i])) {
      tempMsg[i] = '<img class="emoticon" src="https://cdn.betterttv.net/emote/' + bttvEmotes.get(tempMsg[i]) + '/3x">';
    }
  }


	return htmlEntities(tempMsg).join(' ')
}

function badges(channel, user, isBot) {

	function createBadge(name) {
		var badge = document.createElement('div');
		badge.className = 'chat-badge-' + name;
		return badge;
	}

	var chatBadges = document.createElement('span');
	chatBadges.className = 'chat-badges';

	if(!isBot) {
    if (user.badges) {
      if (user.badges.admin) {
        chatBadges.appendChild(createBadge('admin'));
      }
      if (user.badges.broadcaster) {
        chatBadges.appendChild(createBadge('broadcaster'));
      }
      if (user.badges.moderator) {
        chatBadges.appendChild(createBadge('moderator'));
      }
      if (user.badges.vip) {
        chatBadges.appendChild(createBadge('vip'));
      }
      if (user.badges.staff) {
        chatBadges.appendChild(createBadge('staff'));
      }
      if (user.badges.subscriber) {
        chatBadges.appendChild(createBadge('subscriber'))
      }
      if (user.badges.partner) {
        chatBadges.appendChild(createBadge('partner'))
      }
      if (user.badges.premium) {
        chatBadges.appendChild(createBadge('premium'));
      }
    }
    if (user.turbo) {
      chatBadges.appendChild(createBadge('turbo'));
    }
	// 	if(user.username == channel) {
	// 		chatBadges.appendChild(createBadge('broadcaster'));
	// 	}
	// 	if(user['user-type']) {
	// 		chatBadges.appendChild(createBadge(user['user-type']));
	// 	}
	}

	else {
		chatBadges.appendChild(createBadge('bot'));
	}

	return chatBadges;
}

function chatNotice(information, noticeFadeDelay, level, additionalClasses) {
	var ele = document.createElement('div');

	ele.className = 'chat-line chat-notice';
	ele.innerHTML = information;

	if(additionalClasses !== undefined) {
		if(Array.isArray(additionalClasses)) {
			additionalClasses = additionalClasses.join(' ');
		}
		ele.className += ' ' + additionalClasses;
	}

	if(typeof level == 'number' && level != 0) {
		ele.dataset.level = level;
	}

	chat.appendChild(ele);

	// if(typeof noticeFadeDelay == 'number') {
	// 	setTimeout(function() {
	// 			ele.dataset.faded = '';
	// 		}, noticeFadeDelay || 500);
	// }

	return ele;
}

var recentTimeouts = {};

function timeout(channel, username) {
	if(!doTimeouts) return false;
	if(!recentTimeouts.hasOwnProperty(channel)) {
		recentTimeouts[channel] = {};
	}
	if(!recentTimeouts[channel].hasOwnProperty(username) || recentTimeouts[channel][username] + 1000*10 < +new Date) {
		recentTimeouts[channel][username] = +new Date;
		chatNotice(capitalize(username) + ' was timed-out in ' + capitalize(dehash(channel)), 1000, 1, 'chat-delete-timeout')
	};
	var toHide = document.querySelectorAll('.chat-line[data-channel="' + channel + '"][data-username="' + username + '"]:not(.chat-timedout) .chat-message');
	for(var i in toHide) {
		var h = toHide[i];
		if(typeof h == 'object') {
			h.innerText = '<Message deleted>';
			h.parentElement.className += ' chat-timedout';
		}
	}
}

function clearChat(channel) {
	if(!doChatClears) return false;
	var toHide = document.querySelectorAll('.chat-line[data-channel="' + channel + '"]');
	for(var i in toHide) {
		var h = toHide[i];
		if(typeof h == 'object') {
			h.className += ' chat-cleared';
		}
	}
	chatNotice('Chat was cleared in ' + capitalize(dehash(channel)), 1000, 1, 'chat-delete-clear')
}
function hosting(channel, target, viewers, unhost) {
	if(!showHosting) return false;
	if(viewers == '-') viewers = 0;
	var chan = dehash(channel);
	chan = capitalize(chan);
	if(!unhost) {
		var targ = capitalize(target);
		chatNotice(chan + ' is now hosting ' + targ + ' for ' + viewers + ' viewer' + (viewers !== 1 ? 's' : '') + '.', null, null, 'chat-hosting-yes');
	}
	else {
		chatNotice(chan + ' is no longer hosting.', null, null, 'chat-hosting-no');
	}
}

// Display and parse chat
function handleChat(channel, user, message, self) {
  str = JSON.stringify(user, null, 4);
  console.log(str);
  var chan = dehash(channel),
    name = user.username,
    chatLine = document.createElement('div'),
    chatChannel = document.createElement('span'),
    chatName = document.createElement('span'),
    chatColon = document.createElement('span'),
    chatMessage = document.createElement('span');

  var color = useColor ? user.color : 'inherit';
  if(color === null) {
    if(!randomColorsChosen.hasOwnProperty(chan)) {
      randomColorsChosen[chan] = {};
    }
    if(randomColorsChosen[chan].hasOwnProperty(name)) {
      color = randomColorsChosen[chan][name];
    }
    else {
      color = defaultColors[Math.floor(Math.random()*defaultColors.length)];
      randomColorsChosen[chan][name] = color;
    }
  }

  chatLine.className = 'chat-line';
  chatLine.dataset.username = name;
  chatLine.dataset.channel = channel;

  if(user['message-type'] == 'action') {
    chatLine.className += ' chat-action';
  }

  chatChannel.className = 'chat-channel';
  chatChannel.innerHTML = chan;

  chatName.className = 'chat-name';
  chatName.style.color = color;
  chatName.innerHTML = user['display-name'] || name;

  chatColon.className = 'chat-colon';

  chatMessage.className = 'chat-message';

  chatMessage.style.color = color;
  chatMessage.innerHTML = showEmotes ? formatEmotes(message, user.emotes) : htmlEntities(message);

  if(chatClient.client.opts.channels.length > 1) chatLine.appendChild(chatChannel);
  if(showBadges) chatLine.appendChild(badges(chan, user, self));
  chatLine.appendChild(chatName);
  chatLine.appendChild(chatColon);
  chatLine.appendChild(chatMessage);

  chat.appendChild(chatLine);

  if(typeof fadeDelay == 'number') {
    setTimeout(function() {
        chatLine.dataset.faded = '';
      }, fadeDelay);
  }

  if(chat.children.length > 50) {
    var oldMessages = [].slice.call(chat.children).slice(0, 10);
    for(var i in oldMessages) oldMessages[i].remove();
  }
  updateScroll();
}

// Register our event handlers (defined below)
// client.on('message', onMessageHandler);
// client.on('connected', onConnectedHandler);

var chatClient = function chatClient(options) {
  this.options = options
}

var previousChannel;
var channelID;

chatClient.prototype.reset = function reset(options){
  if (previousChannel) {
    chatClient.client.part(previousChannel);
    bttvEmotes.clear();
    ffzEmotes.clear();
  }
  var currentChannel = this.options.channels[0];
  console.log(`${currentChannel}`);
  chatClient.client.join(currentChannel);
  console.log(`${previousChannel}`);
  previousChannel = currentChannel;

  // Get channel ID
  fetch("https://api.twitch.tv/kraken/users?login=" + currentChannel, {
    method: "GET",
    headers: {
      "Accept": "application/vnd.twitchtv.v5+json",
      "Authorization": "OAuth 82pr79g12rrgykqghj1ca052v3sexx",
      "Client-ID": clientID
    }
  }).then( function(response) {
    return response.json();
  }).then(function(data) {
    channelID = data.users[0]._id;
    console.log(channelID);

    // Get channel badges using channel ID
    // unfortunately this API only supports a limited list of badges, and new Twtich API doesn't have documentation for badges
    fetch("https://api.twitch.tv/kraken/chat/" + channelID + "/badges", {
      headers: {
        Accept: "application/vnd.twitchtv.v5+json",
        "Client-ID": clientID
      }
    }).then( function(response) {
      return response.json();
    }).then(function(data) {
      subBadge = data.subscriber.image;
      subBadge = subBadge.slice(0, -1);
      console.log(subBadge)
      var subBadgeStyle = document.createElement('style');
      document.head.append(subBadgeStyle);
      subBadgeStyle.innerHTML = ".chat-badge-subscriber {" +
          "background-color: hsla(360, 100%, 100%, 0);" +
        	"background-image: url(" + subBadge + "3);"
          "}"
    }).catch(function() {
      console.log("Badge fetching failed.");
    });

  }).catch(function() {
    console.log("Channel fetching failed.");
  });

  fetch('https://api.betterttv.net/2/emotes').then( function(response) {
    return response.json();
  }).then(function(data) {
    for (let i in data.emotes) {
      bttvEmotes.set(data.emotes[i].code, data.emotes[i].id)
    }
  }).catch(function() {
    console.log("BTTV Global emote fetching failed.");
  });

  fetch(`https://api.betterttv.net/2/channels/` + currentChannel).then( function(response) {
    return response.json();
  }).then(function(data) {
    for (let i in data.emotes) {
      bttvEmotes.set(data.emotes[i].code, data.emotes[i].id)
    }
  }).catch(function() {
    console.log("BTTV Channel emote fetching failed.");
  });

  fetch(`https://api.frankerfacez.com/v1/room/` + currentChannel).then( function(response) {
    return response.json();
  }).then(function(data) {
    ffzEmotes.clear();
    for (const i in data.sets) {
      let set = data.sets[i];
      for (let j in set.emoticons) {
        ffzEmotes.set(set.emoticons[j].name, set.emoticons[j].urls)
      }
    }
  }).catch(function() {
    console.log("FFZ Channel emote fetching failed.");
  });
}

chatClient.prototype.open = function open(){

  var chat = document.getElementById('chat');
    // Create a client with our options
    this.client = new tmi.client(this.options);

    // Listeners
    this.client.addListener('message', handleChat);
    this.client.addListener('timeout', timeout);
    this.client.addListener('clearchat', clearChat);
    this.client.addListener('hosting', hosting);
    this.client.addListener('unhost', function(channel, viewers) { hosting(channel, null, viewers, true) });

    this.client.addListener('connecting', function (address, port) {
    		if(showConnectionNotices) chatNotice('Connecting', 1000, -4, 'chat-connection-good-connecting');
    	});
    this.client.addListener('logon', function () {
    		if(showConnectionNotices) chatNotice('Authenticating', 1000, -3, 'chat-connection-good-logon');
    	});
    this.client.addListener('connectfail', function () {
    		if(showConnectionNotices) chatNotice('Connection failed', 1000, 3, 'chat-connection-bad-fail');
    	});
    this.client.addListener('connected', function (address, port) {
    		if(showConnectionNotices) chatNotice('Connected', 1000, -2, 'chat-connection-good-connected');
    		joinAccounced = [];
    	});
    this.client.addListener('disconnected', function (reason) {
    		if(showConnectionNotices) chatNotice('Disconnected: ' + (reason || ''), 3000, 2, 'chat-connection-bad-disconnected');
    	});
    this.client.addListener('reconnect', function () {
    		if(showConnectionNotices) chatNotice('Reconnected', 1000, 'chat-connection-good-reconnect');
    	});
    this.client.addListener('join', function (channel, username) {
	     if(username == opts.identity.username) {
    			if(showConnectionNotices) chatNotice('Joined ' + capitalize(dehash(channel)), 1000, -1, 'chat-room-join');
          console.log('Joined ' + capitalize(dehash(channel)))
    			joinAccounced.push(channel);
       }
  	});
    this.client.addListener('part', function (channel, username) {
    	var index = joinAccounced.indexOf(channel);
    	if(index > -1) {
    		if(showConnectionNotices) chatNotice('Parted ' + capitalize(dehash(channel)), 1000, -1, 'chat-room-part');
    		joinAccounced.splice(joinAccounced.indexOf(channel), 1)
    	}
    });

    this.client.addListener('crash', function () {
  		chatNotice('Crashed', 10000, 4, 'chat-crash');
  	});

    // Connect to Twitch:
    this.client.connect();
}
