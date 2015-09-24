Happy = function(options) {
	var self = this; 


	this.options = {
		server: 'http://192.168.0.16:3000',
		defaultRoom: "my-default-room",
		videoDevice: false
	}

	$.extend(this.options, options);

	this.localStream; 
	this.remoteStream;

	// this.isChannelReady = false; 
	this.isStarted = false;
	this.turnReady; 

	this.pc; // Peer connection
	this.pc_config = {'iceServers': 
						[{'url': 'stun:stun.l.google.com:19302'},
						{
							url: 'turn:numb.viagenie.ca',
							credential: 'muazkh',
							username: 'webrtc@live.com'
						},
						{
							url: 'turn:192.158.29.39:3478?transport=udp',
							credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
							username: '28224511:1379330808'
						},
						{
							url: 'turn:192.158.29.39:3478?transport=tcp',
							credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
							username: '28224511:1379330808'
						}]
					};
	this.pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true}]};

	// only interested in video
	var sdpConstraints = {
		'mandatory': {	
			'OfferToReceiveAudio':false,
			'OfferToReceiveVideo':true
		}
	};

	// for testing purposes only, room handling needs to be done in a different manner
	this.room = this.options.defaultRoom;
	this.videoDevice = this.options.videoDevice;

	if(this.videoDevice) {
		$('.newConnection').addClass('hidden');
		$('.localVideo').removeClass('hidden');
		$('.qrcode').addClass('hidden');

	}

	// connect to socket server
	this.socket = io();

	// make sure we are connected, before doing anything else
	this.socket.on('server started', function() {
		console.log('Socket server is ready');
		self.socket.emit('create or join', self.room);
	});

	// handle refershing the page
	window.onbeforeunload = function(e){
		self.sendMessage({type: 'bye'});
	}

	// socket io responses
	this.socket.on('created', function (room){
		console.log('Created room ' + room);
	});

	this.socket.on('full', function (room){
		console.log('Room ' + room + ' is full');
	});

	this.socket.on('joined', function (data){
		console.log('This peer has joined room ', data);
		// self.isChannelReady = true;

		if(self.videoDevice) {
			console.log('>>> got video, doing the call');
			self.doCall();
		}
	});

	this.socket.on('message', function(message){
		// console.log('Client received a message: ', message); 

		if (message.type == 'got user media') {
			console.log('>>>>>>>>>>>>>>> Got user media', message);
			if(!self.isStarted) {
				self.maybeStart();
			}
		}

		else if (message.type === 'offer') {
			// self.isChannelReady = true;
			console.log('>>>>>>>>>>>>>>> Offer ', message);

			if(!self.isStarted) {
				self.maybeStart(); 
				self.pc.setRemoteDescription(new RTCSessionDescription(message.data));
			}
			
			self.doAnswer();


		}

		else if (message.type === 'answer' && self.isStarted) {
			console.log('>>>>>>>>>>>>>>> Answer', message);
			self.pc.setRemoteDescription(new RTCSessionDescription(message.data));
		}

		else if (message.type === 'candidate' && self.isStarted) {
			console.log('>>>>>>>>>>>>>>> ICECandidate: ', message)
			var candidate = new RTCIceCandidate({
				sdpMLineIndex: message.label,
				candidate: message.candidate
			});
			self.pc.addIceCandidate(candidate);
		}

		else if (message.type === 'bye' && self.isStarted) {
			console.log('>>>>>>>>>>>>>>> Bye...', message);
			self.handleRemoteHangup();
		}
		else if(message.type === 'hangup' && self.isStarted) {
			console.log('>>>>>>>>>>>>>>> Hangup');
			self.handleRemoteHangup();
		}
		else {
			console.log(' >>>> Other message: ', message);
		}
	});

	self.init();

}


Happy.prototype.init = function() {
	var self = this; 
	// var constraints = {video: true, audio:false}; 
	// getUserMedia(constraints, self.handleUserMedia.bind(self), self.handleUserMediaError.bind(self));

	// var constraints = {video: true, audio:false}; 
	// getUserMedia(constraints, 
	// 	function(stream) {
	// 		console.log('Asking permission');
	// 		self.localStream = stream;
	// 	}, 
	// 	function(err){console.log('Error: ', err);}
	// 	);
	
	if (location.hostname != "localhost") {
		self.requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
	}
}


Happy.prototype.sendMessage = function(message) {
	var self = this; 

	console.log('Client sending a message: ', message); 
	message.to = self.room;
	self.socket.emit('message', message);
}

Happy.prototype.handleUserMedia = function(stream) {
	var self = this; 
	console.log("stream", stream);
	if(self.videoDevice === true) {

		console.log("starting the stream");

		self.localStream = stream;
		self.localVideo = $('.localVideo')[0];

		console.log("local video", self.localVideo);

		self.localVideo.src = window.myURL.createObjectURL(stream); 

		self.localVideo.addEventListener('canplay', function() {
			console.log("can play, trying to start video");
			self.localVideo.play();
		});

		self.sendMessage({type: 'got user media'}); 
	}

	else {
		console.log("this is not the video device");
	}
	if(!self.isStarted) {
		self.maybeStart();
	}

}

Happy.prototype.playUserMedia = function() {
	var self = this;

	var constraints = {video: true, audio:false}; 
	getUserMedia(constraints, self.handleUserMedia.bind(self), self.handleUserMediaError.bind(self));

	console.log('Starting video and audio stream');
	console.log('Showing local stream'); 
	// self.localStream = stream; 
}

Happy.prototype.handleUserMediaError = function(error) {
	var self = this; 
	console.log('getUserMedia error: ', error);
}


Happy.prototype.maybeStart = function() {
	var self = this; 

	// removed: && typeof self.localStream != 'undefined' and self.isChannelReady also
	if(!self.isStarted) {
		self.createPeerConnection(); 

		// you don't need to send stream, if device is not available
		if(self.localStream != 'undefined' && self.localStream != null) {
			self.pc.addStream(self.localStream); 
		}
		self.isStarted = true;
		console.log('OK, lets go');
	}
	else {
		console.log('Something is missing...', !self.isStarted);
	}
}


Happy.prototype.createPeerConnection = function () {
	var self = this; 

	try {
		self.pc = new RTCPeerConnection(null); 
		self.pc.onicecandidate = self.handleIceCandidate.bind(self); 
		self.pc.onaddstream = self.handleRemoteStreamAdded.bind(self); 
		self.pc.onremovestream = self.handleRemoteStreamRemoved.bind(self); 

		console.log('Created RTCPeerConnection'); 
	} catch (e) {
		console.log('Failed to create PeerConnection exception: ', e.message); 
		return; 
	}
}

Happy.prototype.handleIceCandidate = function(event) {
	var self = this; 

	console.log('handleIceCandidate event: ', event); 

	if(event.candidate) {
		self.sendMessage({
			type: 'candidate',
			label: event.candidate.sdpMLineIndex,
			id: event.candidate.sdpMid,
			candidate: event.candidate.candidate
		});
	}
	else {
		console.log('End of candidates');
	}
}


Happy.prototype.handleCreateOfferError = function(event) {
	var self = this; 
	console.log('createOffer() error: ', e);
}

Happy.prototype.doCall = function(to) {
	var self = this; 
	console.log("calling...");
	// self.showRingingScreen(true);

	self.playUserMedia();

	if(!self.pc) {
		self.maybeStart();
	}

	console.log('Creating offer to peer ', to); 
	self.pc.createOffer(self.setLocalAndSendMessage.bind(self), self.handleCreateOfferError.bind(self));
}

Happy.prototype.doAnswer = function() {
	var self = this; 

	if(!self.pc) {
		return;
	}

	// forwardTo is already set in "offer"
	console.log('Sending answer to peer'); 

	$('.qrcode').addClass('hidden'); 
	$('.newConnection').addClass('hidden');
	$('.remoteVideo').removeClass('hidden');

	self.pc.createAnswer(self.setLocalAndSendMessage.bind(self), null, self.sdpConstraints);
}


Happy.prototype.setLocalAndSendMessage = function(sessionDescription) {
	var self = this; 

	// sessionDescription.sdp = self.preferOpus(sessionDescription.sdp);
	// sessionDescription.sdp = (sessionDescription.sdp);

	self.pc.setLocalDescription(sessionDescription); 

	console.log('setLocalAndSendMessage sending message ', sessionDescription); 
	self.sendMessage({type: sessionDescription.type, data: sessionDescription});

	// self.sendMessage({room: self.room, type: 'offer', data: sessionDescription});
} 

Happy.prototype.requestTurn = function(turn_url) {
	var self = this; 

	var turnExists = false; 
	for (var i in self.pc_config.iceServers) {
		if(self.pc_config.iceServers[i].url.substr(0,5) === 'turn') {
			turnExists = true; 
			self.turnReady = true;
			break; 
		}
	}

	// if(!turnExists) {
	// 	console.log('Getting TURN server from ', turn_url); 
	// 	//No TURN server, get one from computeeingineondemand.appspot.com: 
	// 	var xhr = new XMLHttpRequest();
	// 	xhr.onreadystatechange = function() {
	// 		if (xhr.readyState === 4 && xhr.status === 200) {
	// 			var turnServer = JSON.parse(xhr.responseText);
	// 			console.log('Got TURN server: ', turnServer);
	// 			self.pc_config.iceServers.push({
	// 				'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
	// 				'credential': turnServer.password
	// 			});
	// 			turnReady = true;
	// 		}
	// 	};
	// 	xhr.open('GET', turn_url, true);
	// 		xhr.send();
	// 	}

}


Happy.prototype.handleRemoteStreamAdded = function(event) {
	var self = this; 

	console.log('Remote stream added', event.stream);
	self.remoteVideo = $('.remoteVideo')[0]
	self.remoteVideo.src = window.myURL.createObjectURL(event.stream); 
	self.remoteStream = event.stream; 

	self.remoteVideo.addEventListener('canplay', function() {
		self.remoteVideo.play();
	});
}

Happy.prototype.handleRemoteStreamRemoved = function(event) {
	var self = this; 
	console.log('Remote stream removed. Event: ', event); 
}

Happy.prototype.hangup = function() {
	var self = this; 


	self.localVideo = $('.localVideo')[0];
	self.remoteVideo = $('.remoteVideo')[0];

  	if(self.localVideo && self.videoDevice === true) {
	  	self.localVideo.pause();
	  	self.localVideo.src = null;
  	}
  	if(self.remoteVideo) {
	  	self.remoteVideo.pause();
	  	self.remoteVideo.src = null; 
  	}

  	// self.localStream = null;

	console.log('Hanging up'); 
	self.stop(); 
	// self.sendMessage({room: self.room, type: 'bye'});
}

Happy.prototype.handleRemoteHangup = function() {
	var self = this; 
	console.log('Remote hangup');
	self.hangup();
}

Happy.prototype.stop = function() {
	var self = this; 

	self.isStarted = false; 
	if(self.pc) {
		self.pc.close(); 
		self.pc = null; 
	}

	self.sendMessage({type: 'hangup'});

}


///////////////////////////////////////////////////////////////////////////
// Set Opus as the default audio codec if it's present.
Happy.prototype.preferOpus = function(sdp) {
	var self = this;
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        mLineIndex = i;
        break;
      }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = self.extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = self.setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = self.removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

Happy.prototype.extractSdp = function(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
Happy.prototype.setDefaultCodec = function(mLine, payload) {
	var self = this;
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
Happy.prototype.removeCN = function(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = self.extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}



Happy.prototype.trace = function(text, obj) {
	console.log((performance.now() / 1000).toFixed(3) + ": " + text, obj);
}
