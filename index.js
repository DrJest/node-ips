var nodeIPS = require('./lib/nodeips');

var client = new nodeIPS('https://www.enlightenedlabs.it/', "ee4d256730d54c12f43741eb49b54ea6");

var db = new client.Database(9);

//new db.Record({id:6}).comment("Commento di test", 0, { author_name: "Pinco Pallino" }).then(console.log).catch(console.log);

var r = new db.Record({id:6});

var log = (r) => {
	console.log(JSON.parse(JSON.stringify(r)));
};

r.review(2, "Dai", 1).then(log).catch(console.log)