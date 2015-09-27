EduEye = function(options) {
	var self = this; 


	this.options = {
		server: 'http://192.168.0.16:3000',
		defaultRoom: "my-default-room",
		videoDevice: false
	}

	$.extend(this.options, options);

	this.constraints = { 
		video: true,
		audio: false
	};

	// only interested in video
	var sdpConstraints = {
		'mandatory': {	
			'offerToReceiveAudio':false,
			'offerToReceiveVideo':true,
			'OfferToReceiveAduio':false,
			'OfferToReceiveVideo':true
		}
	};

	// caller (ie video device) doesn't want to receive video or audio
	var sdpCallerConstraints = {
		'mandatory': {	
			'offerToReceiveAudio':false,
			'offerToReceiveVideo':true,
			'OfferToReceiveAduio':false,
			'OfferToReceiveVideo':true
		}
	};


	this.localStream; 
	this.remoteStream;

	this.peerConnection; // Peer connection
	this.peerConnectionConfig = {'iceServers': 
						[
							{	url: 'stun:stun.l.google.com:19302'},
							{	url: 'stun:stun.services.mozilla.com'},
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
							}
						]
					};




	// for testing purposes only, room handling needs to be done in a different manner
	this.room = this.options.defaultRoom;
	this.videoDevice = this.options.videoDevice;

	if(this.videoDevice) {
		$('.newConnection').addClass('hidden');
		$('.localVideo').removeClass('hidden');
		$('.qrcode').addClass('hidden');
		$('.copypaste').addClass('hidden');
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
	});

	this.socket.on('message', self.gotMessageFromServer.bind(self));

	self.init();

}


EduEye.prototype.init = function() {
	var self = this; 
	console.log("init");
	
	if (location.hostname != "localhost") {
		self.requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
	}

	if(self.videoDevice) {
		getUserMedia(self.constraints, self.getUserMediaSuccess.bind(self), self.errorHandler.bind(self));
	}
	else {
		console.log("not a video device");
	}
	
}


EduEye.prototype.sendMessage = function(message) {
	var self = this; 

	console.log('Client sending a message: ', message.type); 
	message.to = self.room;
	self.socket.emit('message', message);
}

EduEye.prototype.getUserMediaSuccess = function(stream) {
	var self = this; 

	console.log("starting the stream");

	self.localStream = stream;
	self.localVideo = $('.localVideo')[0];
	self.localVideo.src = window.myURL.createObjectURL(stream); 

	self.localVideo.addEventListener('canplay', function() {
		console.log("can play, trying to start video");
		self.localVideo.play();
	});

	if(self.localVideo.readyState > 3) {
		self.localVideo.play();
	}

	$('.localVideo').trigger('load');

	self.start(true);
		

	self.sendMessage({type: 'got user media'}); 
}

EduEye.prototype.errorHandler = function(error) {
	var self = this; 
	console.log('Error: ', error);
}

EduEye.prototype.start = function(isCaller) {
	var self = this; 

	self.peerConnection = new RTCPeerConnection(self.peerConnectionConfig); 
	self.peerConnection.onicecandidate = self.gotIceCandidate.bind(self);
	self.peerConnection.onaddstream = self.gotRemoteStream.bind(self);

	if(self.videoDevice) {
		self.peerConnection.addStream(self.localStream); 
	}

	// caller, ie video device, doesn't want to receive anything. Only transmit
	if(isCaller) {
		self.peerConnection.createOffer(self.gotDescription.bind(self), self.errorHandler.bind(self), self.sdpCallerConstraints);
	}
}


EduEye.prototype.gotMessageFromServer = function(message) {
	var self = this; 

	if(!self.peerConnection) {
		self.start(false);
	}

	// === SDP
	if(message.type == 'offer') {
		
		console.log("SDP", message.data);
		self.peerConnection.setRemoteDescription(new RTCSessionDescription(message.data), function() {
			console.log("creating an answer...");
			self.peerConnection.createAnswer(self.gotDescription.bind(self), self.errorHandler.bind(self), self.sdpConstraints);

		}, self.errorHandler.bind(self));
	}
	
	// === ICE
	else if (message.type === 'candidate') {
		var candidate = new RTCIceCandidate({
					sdpMLineIndex: decodeURIComponent(message.sdpMLineIndex), 
					candidate: decodeURIComponent(message.candidate)
				});
		self.peerConnection.addIceCandidate(candidate);
	}

	else if (message.type === 'bye') {
		if(self.remoteVideo && self.remoteVideo.src) {
			self.remoteVideo.src = null; 
			self.remoteStream = null; 
		}
		if(self.localVideo && self.localVideo.src) {
			self.localVideo.src = null;
			self.localStream = null; 
		}
		
		self.peerConnection = null;
	}

	else if(message.type === 'answer') {
		self.peerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
		console.log("should work now, offer accepted");
	}

	else if (message.type === 'got user media') {
	}

	else {
		console.log(">>>>>>>>>> Other message: ", message.type, message);

	}
} 

EduEye.prototype.gotIceCandidate = function(event) {
	var self = this;
	console.log("got ice");
	
	if(event.candidate) {
		self.sendMessage({
			type: 'candidate',
			label: event.candidate.sdpMLineIndex,
			sdpMLineIndex: encodeURIComponent(event.candidate.sdpMLineIndex),
			id: event.candidate.sdpMid,
			candidate: encodeURIComponent(event.candidate.candidate)
		});
	}
	else {
		console.log('End of candidates');

	}

}


EduEye.prototype.gotDescription = function(description) {
	var self = this;
	console.log("Got description", description.type, description);

	self.peerConnection.setLocalDescription(description, function() {

		self.sendMessage({type: description.type, data: description});
	
	}, function() {console.log('set description error')}); 
}

EduEye.prototype.gotRemoteStream = function(event) {
	var self = this; 
	console.log("got remoteStream");

	$('.remoteVideo').removeClass('hidden');

	self.remoteVideo = $('.remoteVideo')[0];
	self.remoteVideo.src = window.myURL.createObjectURL(event.stream);

	$('.newConnection').addClass('hidden');
	$('.localVideo').addClass('hidden');
	$('.qrcode').addClass('hidden');
	$('.copypaste').addClass('hidden');

	self.remoteVideo.addEventListener('canplay', function() {
		console.log("can play, trying to start video");
		self.remoteVideo.play();
	});

	if(self.remoteVideo.readyState > 3) {
		self.remoteVideo.play();
	}

	$('.remoteVideo').trigger('load');

}


EduEye.prototype.requestTurn = function(turn_url) {
	var self = this; 

	var turnExists = false; 
	for (var i in self.peerConnectionConfig.iceServers) {

		if(self.peerConnectionConfig.iceServers[i].url.substr(0,4) === 'turn') {
			turnExists = true; 
			self.turnReady = true;
			break; 
		}
	}

	console.log("Got turn: ", turnExists);
}
 
EduEye.prototype.trace = function(text, obj) {
	console.log((performance.now() / 1000).toFixed(3) + ": " + text, obj);
}
