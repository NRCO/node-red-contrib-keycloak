module.exports = function (RED) {
    'use strict'

    const jwks = require('jwks-rsa');
    const nJwt = require('njwt');
    const request = require('request');
    const check = require('./lib/check').check;
    const create = require('./lib/create').create;
    const changePwd = require('./lib/changePwd').changePwd;
    const getAuth = require('./lib/getAuth').getAuth;
    const remove = require('./lib/remove').remove;

    function KeycloakNode(n) {
        RED.nodes.createNode(this, n)
        var node = this;
        this.verifier = {
            verify: function (accessToken, cb) {
                return cb(RED._('bad-discovery-endpoint'))
            }
        }

        request.get({
            url: n.discovery,
            json: true
        }, (err, res, body) => {
            if (err) {
                this.status({
                    fill: 'red',
                    shape: 'ring',
                    text: 'bad-discovery-request'
                })
                return this.error(RED._('bad-discovery-request'))
            }
            if (!body || !body.jwks_uri) {
                this.status({
                    fill: 'red',
                    shape: 'ring',
                    text: 'bad-discovery-response'
                })
                return this.error(RED._('bad-discovery-response'))
            }


            const options = {
                cache: true,
                cacheMaxAge: 60 * 60 * 1000,
                cacheMaxEntries: 3,
                jwksRequestsPerMinute: 10,
                rateLimit: true
            }

            const jwksClient = jwks(Object.assign({},
                options, {
                    jwksUri: body.jwks_uri
                }))
                this.verifier = nJwt.createVerifier()
                .setSigningAlgorithm('RS256')
                .withKeyResolver((kid, cb) => {
                    jwksClient.getSigningKey(kid, (err, key) => {
                        cb(err, key && (key.publicKey || key.rsaPublicKey))
                    })
                })
                this.status({
                    fill: 'blue',
                    shape: 'ring',
                    text: 'ready'
                })
            })

            this.on('input', msg => {
                let prom;
                switch (n.operation) {
                    case 'checkAuth':

                        if (!msg.req || !msg.req.headers || !msg.req.headers['authorization']) {
                            this.error(RED._('no-access-token'))
                            this.status({
                                fill: 'red',
                                shape: 'ring',
                                text: 'no-access-token'
                            });
                            msg.payload = {};
                            msg.error = 'NoAccessToken';
                            msg.statusCode = 401;
                            prom = Promise.reject(msg);

                        } else {
                            const accessToken = msg.req.headers['authorization'].split(' ')[1]
                            this.accessToken = accessToken;
                            prom = check(this, msg);
                        }

                        break;
                    case 'create':
                        prom = create(n, msg.payload);
                        break;
                    case 'remove':
                        prom = remove(n, msg.payload)
                        break;
                    case 'changePwd':
                        prom = changePwd(n, msg.payload);
                        break;
                    case 'getAuth':
                        prom = getAuth(n).then((token) => {
                        msg.access_token = token;
                        if (!msg.headers) {
                            msg.headers = {};
                        }
                        msg.headers.Authorization = "Bearer " + token;
                        node.send([msg, null]);
                    })
                    .catch((err) => {
                        msg.payload = err;
                        node.send([null, msg]);
                    });
                    break;
                }

                prom.then((res) => {
                    node.send([res, null]);
                })
                .catch((err) => {
                    node.send([null, err]);
                });
            });
        }
        RED.nodes.registerType('Keycloak', KeycloakNode);
    }
