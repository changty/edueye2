// Server.js

var config          = require('./config');
var express			= require('express');
var app				= express();
var http			= require('http').Server(app);

var bodyParser		= require('body-parser');
var cookieParser	= require('cookie-parser');
var port 			= process.env.PORT || config.port;

// Socket.io server
var io				= require('socket.io')(http);
var cors 			= require('cors');

var router 			= express.Router(); 
var staticFiles		= express.Router();

var uuid			= require('node-uuid');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

var whitelist = ['http://localhost', 'http://192.168.0.10', 'http://localhost:3000', 'http://192.168.0.10:3000'];

var corsOptions = {
	origin: function(origin, callback){
  			var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
    		callback(null, originIsWhitelisted);
  		},
  	credentials: true
};
app.use(cors(corsOptions));


// *****************************
//	Socket.io methods
//	-----------------
// *****************************


// Start socket server 
io.on('connection', function(client) {

	console.log('>> IO: \t ---- Client connected ');
	client.resources = {
		screen: false,
		video: true,
		audio: false
	};

    client.emit('server started');

    // pass a message to another id
    client.on('message', function (details) {
        if (!details) return;
        console.log('>> IO: \t Sending message to: ', details.to, ' from: ', details.from);
        console.log('>> IO: \t\t Type of message: ', details.type);
        client.to(details.to).emit('message', details);
    });

    client.on('shareScreen', function () {
        client.resources.screen = true;
    });

    client.on('unshareScreen', function (type) {
        client.resources.screen = false;
        removeFeed('screen');
    });

    client.on('create or join', join);

    function removeFeed(type) {
        if (client.room) {
            io.sockets.in(client.room).emit('remove', {
                id: client.id,
                type: type
            });
            if (!type) {
                client.leave(client.room);
                client.room = undefined;
            }
        }
    }

    function join(room) {
        console.log('>> IO: \t Joining room: ', room);
        // sanity check
        if (typeof room !== 'string') return;
        // check if maximum number of clients reached
        // if (config.rooms && config.rooms.maxClients > 0 && 
        //   clientsInRoom(room) >= config.rooms.maxClients) {
        //     client.emit('full');
        //     return;
        // }
        // leave any existing rooms
        // removeFeed();
        // client.emit('describe room', describeRoom(room));
        client.join(room);
        client.room = room;

        // if(clientsInRoom(room) == 1) {
        //     client.emit('created', room);
        // }
        client.emit('joined', {room: room});
        client.to(room).emit('joined', {room: room, fname: '', lname: '', email: '', image: '', happy_addr: ''});
        console.log(">> IO: \t", "Client joined a room", client.room);
    }

    // we don't want to pass "leave" directly because the
    // event type string of "socket end" gets passed too.
    client.on('disconnect', function () {
        removeFeed();
    });
    client.on('leave', function () {
        removeFeed();
    });


    // support for logging full webrtc traces to stdout
    // useful for large-scale error monitoring
    client.on('trace', function (data) {
        console.log('trace', JSON.stringify(
            [data.type, data.session, data.prefix, data.peer, data.time, data.value]
        ));
    });


    // tell client about stun and turn servers and generate nonces
    client.emit('stunservers', config.stunservers || []);

    // create shared secret nonces for TURN authentication
    // the process is described in draft-uberti-behave-turn-rest
    var credentials = [];
    config.turnservers.forEach(function (server) {
        var hmac = crypto.createHmac('sha1', server.secret);
        // default to 86400 seconds timeout unless specified
        var username = Math.floor(new Date().getTime() / 1000) + (server.expiry || 86400) + "";
        hmac.update(username);
        credentials.push({
            username: username,
            credential: hmac.digest('base64'),
            url: server.url
        });
    });
    client.emit('turnservers', credentials);

});



// *****************************
//	Experss routes
//	--------------
// *****************************


router.use(function(req, res, next) {
	// do something on each call
	// log action?
	console.log(">> api request: \t", req.method, req.url);
	next();
});

staticFiles.use(function(req, res, next) {
	console.log(">> file request: \t", req.method, req.url);
    if(req.url)
	next();
});


// serve main view or login screen
staticFiles.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/' + 'index.html');
});

// load all the routes
require('./routes')(router);
// enable serving static files from public folder
staticFiles.use(express.static(__dirname + '/public'));


app.use('/api', router); 
app.use('/', staticFiles); 

// run express
http.listen(port, function() {
	console.log(">>>>>>>> Server running @ ", port);
});
