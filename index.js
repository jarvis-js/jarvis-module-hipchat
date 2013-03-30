/*global module*/

var Wobot = require('wobot');

module.exports = function(jarvis, module) {
	var adaptors = [];

	module.config.connections.forEach(function(connection) {
		adaptors.push(new HipChatAdaptor(jarvis, connection));
	});

	module.unload = function() {
		for (var i = 0; i < adaptors.length; i++) {
			adaptors[i].disconnect();
		}
	};
};

function HipChatAdaptor(jarvis, config) {
	var self = this;

	this.jarvis = jarvis;

	this.hipchat = new Wobot.Bot({
		jid: config.jid + '@chat.hipchat.com/bot',
		password: config.password
	});

	this.mentionName = config.mention;

	this.rooms = config.rooms;

	this.users = [];

	this.hipchat.connect();
	this.hipchat.onError(function(condition, text, stanza) { self.onError(condition, text, stanza); });
	this.hipchat.onConnect(function() { self.onConnect(); });
	this.hipchat.onMessage(function(channel, from, message) { self.onMessage(channel, from, message); });
	this.hipchat.onPrivateMessage(function(from, message) { self.onPrivateMessage(from, message); });

}

HipChatAdaptor.prototype.disconnect = function disconnect() {
	this.hipchat.disconnect();
};

HipChatAdaptor.prototype.onError = function onError(condition, text, stanza) {
	console.log(condition);
	console.log(text);
};

HipChatAdaptor.prototype.onConnect = function onConnect() {
	var self = this;
	this.rooms.forEach(function(room) {
		self.hipchat.join(room + '@conf.hipchat.com');
	});

	this.hipchat.getRoster(function(err, users) {
		if ( ! err) {
			self.users = users;
		}
	});
};

HipChatAdaptor.prototype.onMessage = function onMessage(channel, from, message) {
	var chan = this.channel(channel);

	var user;
	for (var i = 0; i < this.users.length; i++) {
		if (this.users[i].name === from) {
			user = this.users[i];
			break;
		}
	}

	if (user) {
		var direct = false;
		var lowMessage = message.toLowerCase();
		if (lowMessage.indexOf('@' + this.mentionName.toLowerCase() + ' ') === 0) {
			direct = true;
			message = message.substring(this.mentionName.length + 2);
		}

		chan.received(new chan.Message({
			body: message,
			direct: direct,
			roomID: channel,
			user: {
				name: from,
				identifier: 'hipchat:' + from.replace(' ', '_'),
				hipchatID: user.jid
			}
		}));
	}

};

HipChatAdaptor.prototype.onPrivateMessage = function onPrivateMessage(from, message) {
	var chan = this.channel(from, true);
	chan.received(new chan.Message({
		body: message,
		direct: true,
		roomID: from,
		user: {
			identifier: 'hipchat:' + from,
			hipchatID: from
		}
	}));
};

HipChatAdaptor.prototype.channel = function channel(identifier, isPrivate) {
	var self = this;

	isPrivate = isPrivate || false;

	var channelIdentifier = 'hipchat:' + identifier;
	var chan = this.jarvis.getChannel(channelIdentifier);
	if ( ! chan) {
		chan = this.jarvis.createChannel(channelIdentifier);

		chan.say = function(message, response) {
			self.hipchat.message(message.roomID, response);
		};

		if ( ! isPrivate) {
			chan.reply = function(message, response) {
				var user;
				for (var i = 0; i < self.users.length; i++) {
					if (self.users[i].jid === message.user.hipchatID) {
						user = self.users[i];
						break;
					}
				}

				if (user) {
					response = '@' + user.mention_name + ' ' + response;
				}

				self.hipchat.message(message.roomID, response);
			};
		}
	}
	return chan;
};
