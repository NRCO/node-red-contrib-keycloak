const adminClient = require("keycloak-admin-client");
let settings = {};
/**
 * Get client keycloak
 * @param {*} settings 
 */
var getClient = (settings) => {
    return new Promise((resolve, reject) => {
        console.log(settings);
        adminClient(settings)
            .then((client) => {
                console.log(client);
                return resolve(client);
            })
            .catch((err) => {
                //err = "erreur admin client";
                return reject(err);
            });
    });
}

/**
 * Get Group ID
 * @param {*} client 
 * @param {*} groupName 
 */
var getGroupID = (client, groupName, realm) => {
    return new Promise((resolve, reject) => {
        return adminClient(settings)
            .then((client) => {
                //console.log(client);
                return client.groups.find(realm)
                    .then((groups) => {
                        for (var i = 0; i < groups.length; i++) {
                            console.log('group[i]', groups[i])
                            let group = searchTree(groups[i], groupName);
                            if (group) {
                                return resolve(group.id);
                            }
                        }

                        return reject('Group doesnt exist');

                    }).catch((err) => {
                        return reject(err);
                    });
            }).catch((err) => {
                return reject(err);
            });
    });
}

function searchTree(element, matchingTitle) {
    console.log("element",element)
    if (element.name == matchingTitle) {
        return element;
    } else if (element.subGroups != null) {
        var i;
        var result = null;
        for (i = 0; result == null && i < element.subGroups.length; i++) {
            result = searchTree(element.subGroups[i], matchingTitle);
        }
        return result;
    }
    return null;
}



/**
 * Create user and add to group
 * @param {*} client 
 * @param {*} user 
 */
var createUser = (client, user, realm) => {
    return new Promise((resolve, reject) => {

        console.log('user creation !!');
        console.log(user);
        return client.users.create(realm, user)
            .then((user) => {
                console.log('user created');
                return resolve(user);
            }).catch((err) => {
                return reject(err);
            });
    });
}




var create = (node, userToCreated) => {
    return new Promise((resolve, reject) => {
        settings = {
            baseUrl: node.url,
            grant_type: 'password',
            realmName: node.realm,
            client_id: node.client,
            client_secret: node.secret,
            username: node.admin,
            password: node.admin_password
        };

        return getClient(settings).then((client) => {
            return getGroupID(client, userToCreated.groupName, settings.realmName).then((groupId) => {
                var user = {
                    "username": userToCreated.username,
                    "email": userToCreated.email,
                    "enabled": true
                };
                return createUser(client, user, settings.realmName).then((user) => {
                    console.log("ok");
                    console.log(user);
                    return client.groups.join(node.realm, user.id, groupId)
                        .then((user) => {
                            return resolve(user);
                        })

                }).catch((err) => {
                    console.log("user ko")
                    console.log(err);
                    return reject(err);
                });
            });
        }).catch((err) => {
            console.log(err);
            return reject(err);
        });
    });
}

module.exports.create = create;