/* jshint strict: true */
/* jshint node: true */
/* jshint esversion: 6 */

"use strict";

const request = require('request');

const NodeIPS = function(communityURL, apiKey) {
    var client = this;
    var auth = "Basic " + new Buffer( apiKey + ":" + "thisIsNotImportant" ).toString("base64");
    
    var fillProperties = function(resp) {
        for(let i in resp) {
            if( this.hasOwnProperty(i) ) {
                try {
                    this[i] = resp[i];
                }
                catch(e) {}
            }
            else {
                Object.defineProperty(this, i, { value: resp[i], enumerable: true });
            }
        }
        return this;
    };

    var authorizedRequest = (path, params, method) => {
        if( typeof method === "undefined" ) {
            method = "GET";
        }
        if( typeof params === "undefined" ) {
            params = {};
        }
        return new Promise((resolve, reject) => {
            request({
                rejectUnauthorized: false,
                url: communityURL + "/api" + path,
                method: method,
                qs: params,
                headers: {
                    "Authorization" : auth,
                    "Content-Type": "application/json"
                }
            }, (err, resp, body) => {
                if(err) {
                    return reject(err);
                }
                if( typeof body === "object" ) {
                    if( body.errorCode ) {
                        return reject( new Error("IPS Exception: "+body.errorMessage+" (Code: "+body.errorCode+")") );
                    }
                    return resolve( body );
                }
                let response;
                try {
                    response = JSON.parse( body );
                }
                catch( e ) {
                    return reject( e );
                }
                if( response && response.errorCode ) {
                    return reject( new Error("IPS Exception: "+response.errorMessage+" (Code: "+response.errorCode+")") );
                }
                return resolve( response );
            });
        });
    };

    this.hello = () => authorizedRequest("/core/hello");

    this.FieldGroup = function(fg) {
        this.name = fg.name;
        this.fields = [];
        if( fg.fields && fg.fields instanceof Array ) {
            fg.fields.forEach((el, i) => {
                if( el instanceof client.Field ) {
                    this.fields.push(el);
                }
                else if( typeof el === "object" && el.name !== undefined && el.value !== undefined) {
                    this.fields.push(new client.Field(el.name, el.value));
                }
            });
        }
    };

    this.Field = function(name, value) {
        this.name = name;
        this.value = value;
    };

    this.Group = function(id, name, formattedName) {
        Object.defineProperties(this, {
            'id': {
                value: id,
                enumerable: true
            },
            'name': {
                value: name,
                enumerable: true
            },
            'formattedName': {
                value: formattedName,
                enumerable: true
            }
        });
    };

    this.Member = function(memberObject) {
        var _password, _primaryGroup, _secondaryGroups, _customFields;

        Object.defineProperties(this, {
            'name': {
                enumerable: true,
                writable: true
            },
            'email': {
                enumerable: true,
                writable: true
            },
            'primaryGroup': {
                enumerable: true,
                get: () => _primaryGroup,
                set: val => {
                    if( typeof val === "object" && val.id !== undefined ) {
                        _primaryGroup = new client.Group(val.id, val.name, val.formattedName);
                    }
                    else if( parseInt(val) === val ) {
                        _primaryGroup = new client.Group(val);
                    }
                    else {
                        throw new Error("InvalidGroup");
                    }
                }
            },
            'secondaryGroups': {
                enumerable: true,
                get: () => _secondaryGroups,
                set: val => {
                    if( val instanceof Array ) {
                        _secondaryGroups = [];
                        let gids = [];
                        val.forEach((el, i) => {
                            if( el instanceof client.Group && gids.indexOf(el.id) === -1 ) {
                                _secondaryGroups.push(el);
                                gids.push(el.id);
                            }
                            else if( typeof el === "object" && el.id && gids.indexOf(el.id) === -1 ) {
                                _secondaryGroups.push( new client.Group(el.id, el.name, el.formattedName) );
                                gids.push(el.id);
                            }
                            else if( parseInt(el) === el && gids.indexOf(el) === -1 ) {
                                gids.push(new client.Group(el));
                            }
                        });
                    }
                    else if( typeof val === "object" && val.id !== undefined ) {
                        _secondaryGroups = [ new client.Group(val.id, val.name, val.formattedName) ];
                    }
                    else if( val instanceof client.Group ) {
                        _secondaryGroups = [ val ];
                    }
                    else if( parseInt(val) === val ) {
                        _secondaryGroups = [ new client.Group(val) ];
                    }
                }
            },
            'customFields': {
                enumerable: true,
                get: () => _customFields,
                set: val => {
                    _customFields = [];
                    if ( val instanceof Array ) {
                        val.forEach(el => {
                            if( el instanceof client.FieldGroup ) {
                                return _customFields.push(el);
                            }
                            else if ( typeof el === "object" && el.name !== undefined && el.fields instanceof Array ) {
                                return _customFields.push(new client.FieldGroup(el));
                            }
                        });
                    }
                }
            }
        });

        client.Member.prototype.load = (id) => {
            return authorizedRequest( "/core/members/" + parseInt(id) ).then(resp => {
                return new Promise((resolve, reject) => {
                    if(this.id !== undefined) {
                        return reject(new Error("AlreadyLoaded"));
                    }
                    fillProperties.call(this, resp);
                    resolve(this);
                });
            });
        };

        client.Member.prototype.save = () => {
            let params = {
                "name": this.name,
                "email": this.email,
                "group": _primaryGroup.id,
                "customFields": this.customFields
            };
            if( _password !== undefined ) {
                params.password = _password;
            }
            return authorizedRequest("/core/members/"+( this.id || "" ), params, "POST").then(resp => {
                return new Promise((resolve, reject) => {
                    if( this.id === undefined ) {
                        fillProperties.call(this, resp);
                        this.created = true;
                    }
                    return resolve(this);
                });
            });
        };

        client.Member.prototype.setPassword = (newPassword) => {
            _password = newPassword;
            return this;
        };

        client.Member.prototype.delete = () => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            return authorizedRequest("/core/members/"+this.id, {}, "DELETE").then(resp => {
                return new Promise((resolve, reject) => {
                    resolve({id:this.id, deleted:true});
                });
            });
        };

        if( memberObject && typeof memberObject === "object" ) {
            this.setPassword(memberObject.password);
            fillProperties.call(this, memberObject);
        }
    };

    this.getMembers = (params) => {
        return authorizedRequest("/core/members/", params).then(function(resp) {
            return new Promise((resolve, reject) => {
                resp.results.forEach((el, i) => {
                    el = new client.Member(el);
                });
                resolve(resp);
            });
        });
    };

    this.Database = function(databaseID) {
        var database = this;

        this.Review = function(reviewObject) {
            var _author;
            Object.defineProperties(this, {
                'author': {
                    enumerable: true,
                    get: () => _author,
                    set: val => {
                        if( val instanceof client.Member ) {
                            _author = val;
                        }
                        else if( typeof val === 'object' && val.id !== undefined ) {
                            _author = new client.Member(val);
                        }
                        else if ( parseInt(val) === val ) {
                            _author = new client.Member({ id: val });
                        }
                    }
                },
                'author_name': {
                    enumerable: true,
                    get: () => _author.name,
                    set: val => {
                        _author.name = val;
                    }
                },
                'rating': {
                    enumerable: true,
                    writable: true
                },
                'content': {
                    enumerable: true,
                    writable: true
                },
                'hidden': {
                    enumerable: true,
                    writable: true
                }
            });

            database.Review.prototype.load = (id) => {
                return authorizedRequest( "/cms/reviews/" + databaseID + "/" + parseInt(id) ).then(resp => {
                    return new Promise((resolve, reject) => {
                        if(this.id !== undefined) {
                            return reject(new Error("AlreadyLoaded"));
                        }
                        fillProperties.call(this, resp);
                        resolve(this);
                    });
                });   
            };

            database.Review.prototype.save = () => {
                let params = {
                    record: this.item_id,
                    rating: this.rating,
                    content: this.content || "",
                    author: this.author ? this.author.id : 0,
                    date: this.date || null,
                    ip_address: this.date || null,
                    hidden: +!!this.hidden
                };
                if( this.author.id === 0 && this.author.name !== undefined ) {
                    params.author_name = this.author.name;
                };
                return authorizedRequest("/cms/reviews/" + databaseID, params, "POST").then(resp => {
                    return new Promise((resolve, reject) => {
                        if( this.id === undefined ) {
                            fillProperties.call(this, resp);
                        }
                        resolve(this);
                    });
                });
            };

            database.Review.prototype.delete = () => {
                if( this.id === undefined ) {
                    return new Promise((resolve,reject) => {
                        reject(new Error("NotLoaded"));
                    });
                }
                return authorizedRequest("/cms/reviews/" + databaseID + "/" + this.id, {}, "DELETE").then(resp => {
                    return new Promise((resolve, reject) => {
                        resolve({id:this.id, deleted:true});
                    });
                });
            }

            if( reviewObject && typeof reviewObject === "object" ) {
                fillProperties.call(this, reviewObject);
            }
        };

        this.Comment = function(commentObject) {
            var _author;
            Object.defineProperties(this, {
                'author': {
                    enumerable: true,
                    get: () => _author,
                    set: val => {
                        if( val instanceof client.Member ) {
                            _author = val;
                        }
                        else if( typeof val === 'object' && val.id !== undefined ) {
                            _author = new client.Member(val);
                        }
                        else if ( parseInt(val) === val ) {
                            _author = new client.Member({ id: val });
                        }
                    }
                },
                'author_name': {
                    enumerable: true,
                    get: () => _author.name,
                    set: val => {
                        _author.name = val;
                    }
                },
                'content': {
                    enumerable: true,
                    writable: true
                },
                'hidden': {
                    enumerable: true,
                    writable: true
                }
            });

            database.Comment.prototype.load = (id) => {
                return authorizedRequest( "/cms/comments/" + databaseID + "/" + parseInt(id) ).then(resp => {
                    return new Promise((resolve, reject) => {
                        if(this.id !== undefined) {
                            return reject(new Error("AlreadyLoaded"));
                        }
                        fillProperties.call(this, resp);
                        resolve(this);
                    });
                });           
            }

            database.Comment.prototype.save = () => {
                let params = {
                    record: this.item_id,
                    content: this.content,
                    author: this.author ? this.author.id : 0,
                    date: this.date || null,
                    ip_address: this.date || null,
                    hidden: +!!this.hidden
                };
                if( this.author.id === 0 && this.author.name !== undefined ) {
                    params.author_name = this.author.name;
                };
                return authorizedRequest("/cms/comments/" + databaseID, params, "POST").then(resp => {
                    return new Promise((resolve, reject) => {
                        if( this.id === undefined ) {
                            fillProperties.call(this, resp);
                        }
                        resolve(this);
                    });
                });
            };

            database.Comment.prototype.delete = () => {
                if( this.id === undefined ) {
                    return new Promise((resolve,reject) => {
                        reject(new Error("NotLoaded"));
                    });
                }
                return authorizedRequest("/cms/comments/" + databaseID + "/" + this.id, {}, "DELETE").then(resp => {
                    return new Promise((resolve, reject) => {
                        resolve({id:this.id, deleted:true});
                    });
                });
            }

            if( commentObject && typeof commentObject === "object" ) {
                fillProperties.call(this, commentObject);
            }
        };

        this.Category = function(cat) {
            this.id = cat.id;
            this.name = cat.name;
            this.url = cat.url;
        };

        this.Record = function(recordObject) {
            var _category, _author, _tags, _fields = {};
            Object.defineProperties(this, {
                'title': {
                    enumerable: true,
                    get: () => {
                        if( this.fields && typeof this.fields === "object" ) {
                            return this.fields[ Object.keys(this.fields)[0] ];
                        }
                    },
                    set: val => {
                        if( this.fields && typeof this.fields === "object" ) {
                            this.fields[ Object.keys(this.fields)[0] ] = val;
                        }
                    }
                },
                'description': {
                    enumerable: true,
                    get: () => {
                        if( this.fields && typeof this.fields === "object" ) {
                            return this.fields[ Object.keys(this.fields)[1] ];
                        }
                    },
                    set: val => {
                        if( this.fields && typeof this.fields === "object" ) {
                            this.fields[ Object.keys(this.fields)[1] ] = val;
                        }
                    }
                },
                'category': {
                    enumerable: true,
                    get: () => _category,
                    set: val => {
                        if( val instanceof database.Category ) {
                            _category = val;
                        }
                        else if ( typeof val === 'object' && val.id !== undefined ) {
                            _category = new database.Category(val);
                        }
                        else if ( parseInt(val) === val ) {
                            _category = new database.Category({ id: val });
                        }
                    }
                },
                'author': {
                    enumerable: true,
                    get: () => _author,
                    set: val => {
                        if( val instanceof client.Member ) {
                            _author = val;
                        }
                        else if( typeof val === 'object' && val.id !== undefined ) {
                            _author = new client.Member(val);
                        }
                        else if ( parseInt(val) === val ) {
                            _author = new client.Member({ id: val });
                        }
                    }
                },
                'fields': {
                    enumerable: true,
                    writable: true
                },
                'prefix': {
                    enumerable: true,
                    writable: true
                },
                'tags': {
                    enumerable: true,
                    get: () => Array.from(new Set(_tags)),
                    set: val => {
                        if( val instanceof Array ) {
                            _tags = val;
                        }
                        else if ( typeof val === 'string' || val instanceof String ) {
                            _tags = val.split(",");
                        }
                    }
                },
                'date': {
                    enumerable: true,
                    writable: true
                },
                'ip_address': {
                    enumerable: true,
                    writable: true
                },
                'locked': {
                    enumerable: true,
                    writable: true
                },
                'hidden': {
                    enumerable: true,
                    writable: true
                },
                'pinned': {
                    enumerable: true,
                    writable: true
                },
                'featured': {
                    enumerable: true,
                    writable: true
                }
            });

            database.Record.prototype.load = (id) => {
                return authorizedRequest( "/cms/records/" + databaseID + "/" + parseInt(id) ).then(resp => {
                    return new Promise((resolve, reject) => {
                        if(this.id !== undefined) {
                            return reject(new Error("AlreadyLoaded"));
                        }
                        fillProperties.call(this, resp);
                        resolve(this);
                    });
                });
            };

            database.Record.prototype.save = () => {
                let fields = {};
                for(let i in this.fields) {
                    fields[parseInt(i.replace("field_", ""))] = this.fields[i];
                }
                let params = {
                    category: _category!==undefined ? _category.id : null,
                    author: _author.id,
                    fields: fields,
                    prefix: this.prefix || null,
                    tags: this.tags.join(","),
                    date: this.date || null,
                    ip_address: this.ip_address || null,
                    locked: +!!this.locked,
                    hidden: +!!this.hidden,
                    pinned: +!!this.pinned,
                    featured: +!!this.featured
                };
                return authorizedRequest("/cms/records/" + databaseID + "/" + ( this.id || "" ), params, "POST").then(resp => {
                    return new Promise((resolve, reject) => {
                        if( this.id === undefined ) {
                            fillProperties.call(this, resp);
                            this.created = true;
                        }
                        return resolve(this);
                    });
                });
            };

            database.Record.prototype.delete = () => {
                if( this.id === undefined ) {
                    return new Promise((resolve,reject) => {
                        reject(new Error("NotLoaded"));
                    });
                }
                return authorizedRequest("/cms/records/" + databaseID + "/" + this.id, {}, "DELETE").then(resp => {
                    return new Promise((resolve, reject) => {
                        resolve({id:this.id, deleted:true});
                    });
                });
            };

            database.Record.prototype.getComments = (params) => {
                if( this.id === undefined ) {
                    return new Promise((resolve,reject) => {
                        reject(new Error("NotLoaded"));
                    });
                }
                return authorizedRequest("/cms/records/" + databaseID + "/" + this.id + "/comments", {}).then(resp => {
                    return new Promise((resolve,reject) => {
                        resp.results.forEach((el, i) => {
                            el = new database.Comment(el);
                        });
                        resolve(resp);
                    })
                });
            };

            database.Record.prototype.comment = (content, author, otherParams) => {
                if( typeof otherParams === "undefined" ) {
                    otherParams = {};
                }
                if( this.id === undefined ) {
                    return new Promise((resolve,reject) => {
                        reject(new Error("NotLoaded"));
                    });
                }
                let p = {
                    item_id: this.id,
                    author: author,
                    content: content
                };
                for(let i in otherParams) {
                    if( !p.hasOwnProperty(i) ) {
                        p[i] = otherParams[i];
                    }
                }
                return new database.Comment(p).save();
            };

            database.Record.prototype.getReviews = (params) => {
                if( this.id === undefined ) {
                    return new Promise((resolve,reject) => {
                        reject(new Error("NotLoaded"));
                    });
                }
                return authorizedRequest("/cms/records/" + databaseID + "/" + this.id + "/reviews", {}).then(resp => {
                    return new Promise((resolve,reject) => {
                        resp.results.forEach((el, i) => {
                            el = new database.Review(el);
                        });
                        resolve(resp);
                    })
                });
            };

            database.Record.prototype.review = (rating, content, author, otherParams) => {
                if( typeof otherParams === "undefined" ) {
                    otherParams = {};
                }
                if( this.id === undefined ) {
                    return new Promise((resolve,reject) => {
                        reject(new Error("NotLoaded"));
                    });
                }
                let p = {
                    item_id: this.id,
                    author: author,
                    rating: parseInt(rating),
                    content: content
                };
                for(let i in otherParams) {
                    if( !p.hasOwnProperty(i) ) {
                        p[i] = otherParams[i];
                    }
                }
                return new database.Review(p).save();
            };

            if( recordObject && typeof recordObject === "object" ) {
                fillProperties.call(this, recordObject);
            }
        };

        this.getRecords = (params) => {
            return authorizedRequest("/cms/records/" + databaseID).then(resp => {
                return new Promise((resolve, reject) => {
                    resp.results.forEach((el, i) => {
                        el = new database.Record(el);
                    });
                    resolve(resp);
                });
            });
        };

        this.getReviews = (params) => {
            return authorizedRequest("/cms/reviews/" + databaseID, params).then(resp => {
                return new Promise((resolve, reject) => {
                    resp.results.forEach((el, i) => {
                        el = new database.Review(el);
                    });
                    resolve(resp);
                });
            });
        };

        this.getComments = (params) => {
            return authorizedRequest("/cms/comments/" + databaseID, params).then(resp => {
                return new Promise((resolve, reject) => {
                    resp.results.forEach((el, i) => {
                        el = new database.Comment(el);
                    });
                    resolve(resp);
                });
            });
        };

    };
};

module.exports = NodeIPS;