module.exports = {
  "port"             : 3000,
	"secret"           : "",
	"redisHost"        : "",
	"redisPort"        : '',
	"mongoURL"         : '',
	"salt"             : '',
	
	"rooms": {
      "maxClients"   : 2 /* maximum number of clients per room. 0 = no limit */
    },
    "stunservers"    : [
                        {"url": "stun:stun.l.google.com:19302"}
    ],
    "turnservers"    : [
        /*
        { "url": "turn:your.turn.server.here",
          "secret": "turnserversharedsecret",
          "expiry": 86400 }
          */
    ]
}