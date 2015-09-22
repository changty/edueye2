// routes.js
var uuid			= require('node-uuid');

// param router = express.Router instance
module.exports = function(router) {

	router.get('/test', function(req, res) {
		res.send("success!");
	})
};

