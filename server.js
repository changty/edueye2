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

// console output colors
var colors = require('colors/safe');

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
        console.log(colors.underline.yellow('>> IO: \t Sending message to: %s'), details.to);
        console.log(colors.green('>> IO: \t\t [%s]'), details.type);
        client.to(details.to).emit('message', details);
    });

    client.on('create or join', join);

    function join(room) {
        console.log('>> IO: \t Joining room: ', room);
        
        // sanity check
        if (typeof room !== 'string') return;

        client.join(room);
        // client.room = room;

        client.emit('joined', 'I joined my self');
        client.to(room).emit('joined', 'remote-device-joined');
        console.log(">> IO: \t", "Client joined a room", room);
    }

    // we don't want to pass "leave" directly because the
    // event type string of "socket end" gets passed too.
    client.on('disconnect', function () {
    });
    client.on('leave', function () {
    });


    // support for logging full webrtc traces to stdout
    // useful for large-scale error monitoring
    client.on('trace', function (data) {
        console.log('trace', JSON.stringify(
            [data.type, data.session, data.prefix, data.peer, data.time, data.value]
        ));
    });

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
