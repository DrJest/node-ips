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
        params = (p => {
            let r = {};
            for( let i in p ) {
                if ( p.hasOwnProperty(i) && p[i] !== null && p[i] !== undefined ) {
                    r[i] = p[i];
                }
            }
            return r;
        })(params);
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

    var Comment = function(commentObject, item_type, databaseID) {
        var basePath = ({
            "record": "/cms/comments/" + databaseID,
            "event": "/calendar/comments",
            "image": "/gallery/comments"
        })[item_type];
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

        Comment.prototype.load = id => {
            return authorizedRequest( basePath + "/" + parseInt(id) ).then(resp => {
                return new Promise((resolve, reject) => {
                    if(this.id !== undefined) {
                        return reject(new Error("AlreadyLoaded"));
                    }
                    fillProperties.call(this, resp);
                    resolve(this);
                });
            });
        };

        Comment.prototype.save = () => {
            let params = {
                content: this.content,
                author: this.author ? this.author.id : 0,
                date: this.date,
                ip_address: this.date,
                hidden: +!!this.hidden
            };
            params[item_type] = this.item_id;
            if( params.author === 0 && this.author && this.author.name !== undefined ) {
                params.author_name = this.author.name;
            }
            return authorizedRequest( basePath + "/" + (this.id || ""), params, "POST").then(resp => {
                return new Promise((resolve, reject) => {
                    if( this.id === undefined ) {
                        fillProperties.call(this, resp);
                        this.created = true;
                    }
                    resolve(this);
                    delete this.created;
                });
            });
        };

        Comment.prototype.delete = () => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            return authorizedRequest( basePath + "/" + this.id, {}, "DELETE").then(resp => {
                return new Promise((resolve, reject) => {
                    resolve({id:this.id, deleted:true});
                });
            });
        };

        if( commentObject && typeof commentObject === "object" ) {
            fillProperties.call(this, commentObject);
        }
    };

    var Review = function(reviewObject, item_type, databaseID) {
        var basePath = ({
            "record": "/cms/comments/" + databaseID,
            "event": "/events/comments",
            "image": "/gallery/comments"
        })[item_type];
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

        Review.prototype.load = id => {
            return authorizedRequest( basePath + "/" + parseInt(id) ).then(resp => {
                return new Promise((resolve, reject) => {
                    if(this.id !== undefined) {
                        return reject(new Error("AlreadyLoaded"));
                    }
                    fillProperties.call(this, resp);
                    resolve(this);
                });
            });   
        };

        Review.prototype.save = () => {
            let params = {
                record: this.item_id,
                rating: this.rating,
                content: this.content || "",
                author: this.author ? this.author.id : 0,
                date: this.date,
                ip_address: this.date,
                hidden: +!!this.hidden
            };
            if( params.author === 0 && this.author && this.author.name !== undefined ) {
                params.author_name = this.author.name;
            }
            return authorizedRequest( basePath + "/" + ( this.id || "" ), params, "POST").then(resp => {
                return new Promise((resolve, reject) => {
                    if( this.id === undefined ) {
                        fillProperties.call(this, resp);
                        this.created = true;
                    }
                    resolve(this);
                    delete this.created;
                });
            });
        };

        Review.prototype.delete = () => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            return authorizedRequest( basePath + "/" + this.id, {}, "DELETE").then(resp => {
                return new Promise((resolve, reject) => {
                    resolve({id:this.id, deleted:true});
                });
            });
        };

        if( reviewObject && typeof reviewObject === "object" ) {
            fillProperties.call(this, reviewObject);
        }
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
            },
            'getPosts': {
                value: params => {
                    if( typeof params === "undefined" ) {
                        params = {};
                    }
                    params.authors = this.id;
                    return client.getPosts(params);
                }
            },
            'getTopics': {
                value: params => {
                    if( typeof params === "undefined" ) {
                        params = {};
                    }
                    params.authors = this.id;
                    return client.getTopics(params);
                }
            }
        });

        client.Member.prototype.load = id => {
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
                name: this.name,
                email: this.email,
                group: _primaryGroup.id,
                customFields: this.customFields
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
                    resolve(this);
                    delete this.created;
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

    this.getMembers = params => {
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

        client.Database.prototype.getRecords = params => {
            return authorizedRequest("/cms/records/" + databaseID).then(resp => {
                return new Promise((resolve, reject) => {
                    resp.results.forEach((el, i) => {
                        el = new database.Record(el);
                    });
                    resolve(resp);
                });
            });
        };

        client.Database.prototype.getReviews = {
            value: params => {
                return authorizedRequest("/cms/reviews/" + databaseID, params).then(resp => {
                    return new Promise((resolve, reject) => {
                        resp.results.forEach((el, i) => {
                            el = new database.Review(el);
                        });
                        resolve(resp);
                    });
                });
            }
        };

        client.Database.prototype.getComments = {
            value: params => {
                return authorizedRequest("/cms/comments/" + databaseID, params).then(resp => {
                    return new Promise((resolve, reject) => {
                        resp.results.forEach((el, i) => {
                            el = new database.Comment(el);
                        });
                        resolve(resp);
                    });
                });
            }
        };

        client.Database.prototype.Review = function(reviewObject) {
            return new Review( reviewObject, "record", databaseID );
        };

        client.Database.prototype.Comment = function(commentObject) {
            return new Comment( commentObject, "record", databaseID );
        };

        client.Database.prototype.Category = function(cat) {
            this.id = cat.id;
            this.name = cat.name;
            this.url = cat.url;
        };

        client.Database.prototype.Record = function(recordObject) {
            var _category, _author, _tags;
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

            database.Record.prototype.load = id => {
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
                    if( this.fields.hasOwnProperty(i) ) {
                        fields[parseInt(i.replace("field_", ""))] = this.fields[i];
                    }
                }
                let params = {
                    category: _category!==undefined ? _category.id : null,
                    author: _author.id,
                    fields: fields,
                    prefix: this.prefix,
                    tags: this.tags.join(","),
                    date: this.date,
                    ip_address: this.ip_address,
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
                        resolve(this);
                        delete this.created;
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

            database.Record.prototype.getComments = params => {
                if( this.id === undefined ) {
                    return new Promise((resolve,reject) => {
                        reject(new Error("NotLoaded"));
                    });
                }
                return authorizedRequest("/cms/records/" + databaseID + "/" + this.id + "/comments", params).then(resp => {
                    return new Promise((resolve,reject) => {
                        resp.results.forEach((el, i) => {
                            el = new database.Comment(el);
                        });
                        resolve(resp);
                    });
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
                    if( otherParams.hasOwnProperty(i) && ! p.hasOwnProperty(i) ) {
                        p[i] = otherParams[i];
                    }
                }
                return new database.Comment(p).save();
            };

            database.Record.prototype.getReviews = params => {
                if( this.id === undefined ) {
                    return new Promise((resolve,reject) => {
                        reject(new Error("NotLoaded"));
                    });
                }
                return authorizedRequest("/cms/records/" + databaseID + "/" + this.id + "/reviews", params).then(resp => {
                    return new Promise((resolve,reject) => {
                        resp.results.forEach((el, i) => {
                            el = new database.Review(el);
                        });
                        resolve(resp);
                    });
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
                    if( otherParams.hasOwnProperty(i) && !p.hasOwnProperty(i) ) {
                        p[i] = otherParams[i];
                    }
                }
                return new database.Review(p).save();
            };

            if( recordObject && typeof recordObject === "object" ) {
                fillProperties.call(this, recordObject);
            }
        };
    };

    this.Forum = function(forumObject) {
        Object.defineProperties(this, {
            'id': {
                enumerable: true,
                value: typeof forumObject === "object" ? forumObject.id : forumObject
            },
            'name': {
                enumerable: true,
                value: forumObject.name
            },
            'topics': {
                enumerable: true,
                value: forumObject.topics
            },
            'url': {
                enumerable: true,
                value: forumObject.url
            },
            'getPosts': {
                value: params => {
                    if( typeof params === "undefined" ) {
                        params = {};
                    }
                    params.forums = this.id;
                    return client.getPosts(params);
                }
            },
            'getTopics': {
                value: params => {
                    if( typeof params === "undefined" ) {
                        params = {};
                    }
                    params.forums = this.id;
                    return client.getTopics(params);
                }
            }
        });
    };

    this.Post = function(postObject) {
        var _topic, _author;
        Object.defineProperties(this, {
            'topic': {
                enumerable: true,
                get: () => _topic,
                set: val => {
                    if( val instanceof client.Topic ) {
                        _topic = val;
                    }
                    else if( typeof val === 'object' && val.id !== undefined ) {
                        _topic = new client.Topic(val);
                    }
                    else if( parseInt(val) === val ) {
                        _topic = new client.Topic({ id: val });
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
            'post': {
                enumerable: true,
                writable: true
            },
            'author_name': {
                enumerable: true,
                get: () => _author.name,
                set: val => {
                    _author.name = val;
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
            'hidden': {
                enumerable: true,
                writable: true
            }
        });

        client.Post.prototype.load = id => {
            return authorizedRequest("/forums/posts/" + id).then(resp => {
                return new Promise((resolve, reject) => {
                    if( this.id !== undefined ) {
                        return reject(new Error("AlreadyLoaded"));
                    }
                    fillProperties.call(this.resp);
                    resolve(this);
                });
            });
        };

        client.Post.prototype.save = () => {
            let params = {
                author: this.author ? this.author.id : 0,
                post: this.post,
                hidden: +!!this.hidden,
                date: this.date || null,
                ip_address: this.ip_address || null
            };
            if( params.author === 0 && this.author && this.author.name !== undefined ) {
                params.author_name = this.author.name;
            }
            return authorizedRequest("/forums/posts/" + (this.id || ""), params, "POST").then(resp => {
                return new Promise((resolve, reject) => {
                    if( this.id === undefined ) {
                        fillProperties.call(this, resp);
                        this.created = true;
                    }
                    resolve(this);
                    delete this.created;
                });
            });
        };

        client.Post.prototype.delete = () => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            return authorizedRequest("/forums/posts/"+this.id, {}, "DELETE").then(resp => {
                return new Promise((resolve, reject) => {
                    resolve({id:this.id, deleted:true});
                });
            });
        };

        if( postObject && typeof postObject === "object" ) {
            fillProperties.call(this, postObject);
        }
    };

    this.getPosts = params => {
        return authorizedRequest("/forums/posts/", params).then(resp => {
            return new Promise((resolve, reject) => {
                resp.results.forEach((el,i) => {
                    el = new client.Post(el);
                });
                resolve(resp);
            });
        });
    };

    this.Topic = function(topicObject) {
        var _forum, _author, _tags;
        Object.defineProperties(this, {
            'forum': {
                enumerable: true,
                get: () => _forum,
                set: val => {
                    if( val instanceof client.Forum ) {
                        _forum = val;
                    }
                    else if( typeof val === 'object' && val.id !== undefined ) {
                        _forum = new client.Forum(val);
                    }
                    else if( parseInt(val) === val ) {
                        _forum = new client.Forum({ id: val });
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
            'author_name': {
                enumerable: true,
                get: () => _author.name,
                set: val => {
                    _author.name = val;
                }
            },
            'title': {
                enumerable: true,
                writable: true
            },
            'post': {
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
            'open_time': {
                enumerable: true,
                writable: true
            },
            'close_time': {
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

        client.Topic.prototype.load = id => {
            return authorizedRequest("/forums/topics/" + this.id).then(resp => {
                return new Promise((resolve, reject) => {
                    if( this.id !== undefined ) {
                        return reject(new Error("AlreadyLoaded"));
                    }
                    fillProperties.call(this, resp);
                    resolve(this);
                });
            });
        };

        client.Topic.prototype.save = () => {
            let params = {
                forum: this.forum,
                author: this.author ? this.author.id : 0,
                title:  this.title,
                post: this.post,
                prefix: this.prefix, 
                tags: this.tags.join(","),
                date: this.date, 
                ip_address: this.ip_address,
                locked: +!!this.locked,
                open_time: this.open_time,
                close_time: this.close_time,
                hidden: +!!this.hidden,
                pinned: +!!this.pinned,
                featured: +!!this.featured
            };
            if( params.author === 0 && this.author && this.author.name !== undefined ) {
                params.author_name = this.author.name;
            }
            return authorizedRequest("/forums/topics/" + (this.id || ""), params, "POST").then(resp => {
                return new Promise((resolve, reject) => {
                    if( this.id === undefined ) {
                        fillProperties.call(this, resp);
                        this.created = true;
                    }
                    resolve(this);
                    delete this.created;
                });
            });
        };

        client.Topic.prototype.delete = () => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            return authorizedRequest("/forums/topics/"+this.id, {}, "DELETE").then(resp => {
                return new Promise((resolve, reject) => {
                    resolve({id:this.id, deleted:true});
                });
            });
        };

        if( topicObject && typeof topicObject === "object" ) {
            fillProperties.call(this, topicObject);
        }
    };

    this.getTopics = params => {
        return authorizedRequest("/forums/topics/", params).then(resp => {
            return new Promise((resolve, reject) => {
                resp.results.forEach((el,i) => {
                    el = new client.Topic(el);
                });
                resolve(resp);
            });
        });
    };

    this.Calendar = function(calendarObject) {
        Object.defineProperties(this, {
            'id': {
                enumerable: true,
                value: typeof calendarObject === "object" ? calendarObject.id : calendarObject
            },
            'name': {
                enumerable: true,
                value: calendarObject.name
            },
            'url': {
                enumerable: true,
                value: calendarObject.url
            },
            'getEvents': {
                value: params => {
                    if( typeof params === "undefined" ) {
                        params = {};
                    }
                    params.calendars = this.id;
                    return client.getEvents(params);
                }
            },
            'createEvent': {
                value: params => {
                    if( typeof params !== "object" ) {
                        params = {};
                    }
                    params.calendar = this.id;
                    return new client.Event(params).save();
                }
            }
        });
        
        this.prototype.getComments = params => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            params.calendars = this.id;
            return authorizedRequest("/calendar/comments", params).then(resp => {
                return new Promise((resolve,reject) => {
                    resp.results.forEach((el, i) => {
                        el = new Comment(el, 'event');
                    });
                    resolve(resp);
                });
            });
        };

        this.prototype.getReviews = params => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            params.calendars = this.id;
            return authorizedRequest("/calendar/reviews", params).then(resp => {
                return new Promise((resolve,reject) => {
                    resp.results.forEach((el, i) => {
                        el = new Review(el, 'event');
                    });
                    resolve(resp);
                });
            });
        };

        this.prototype.getEvents = params => {
            if( this.id === undefined ) {
                return new Promise((resolve, reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            params.calendars = this.id;
            return authorizedRequest("/calendar/events/", params).then(resp => {
                return new Promise((resolve, reject) => {
                    resp.results.forEach((el,i) => {
                        el = new client.Event(el);
                    });
                    resolve(resp);
                });
            });
        };
    };

    this.Event = function(eventObject) {
        var _calendar, _author, _tags;
        Object.defineProperties(this, {
            'calendar': {
                enumerable: true,
                get: () => _calendar,
                set: val => {
                    if( val instanceof client.Calendar ) {
                        _calendar = val;
                    }
                    else if ( typeof val === "object" && val.id !== undefined ) {
                        _calendar = new client.Calendar(val);
                    }
                    else if ( parseInt(val) === val ) {
                        _calendar = new client.Calendar({id:val});
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
            'title': {
                enumerable: true,
                writable: true
            },
            'description': {
                enumerable: true,
                writable: true
            },
            'start': {
                enumerable: true,
                writable: true
            },
            'end': {
                enumerable: true,
                writable: true
            },
            'recurrence': {
                enumerable: true,
                writable: true
            },
            'rsvp': {
                enumerable: true,
                writable: true
            },
            'rsvpLimit': {
                enumerable: true,
                writable: true
            },
            'location': {
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
            'featured': {
                enumerable: true,
                writable: true
            }
        });

        client.Event.prototype.load = id => {
            return authorizedRequest("/calendar/events/" + id).then(resp => {
                return new Promise((resolve, reject) => {
                    if( this.id !== undefined ) {
                        return reject(new Error("AlreadyLoaded"));
                    }
                    fillProperties.call(this, resp);
                    resolve(this);
                });
            });
        };

        client.Event.prototype.save = () => {
            let params = {
                calendar: this.calendar ? this.calendar.id : undefined,
                author: this.author ? this.author.id : undefined,
                title: this.title,
                description: this.description,
                start: this.start,
                end: this.end,
                recurrence: this.recurrence,
                rsvp: this.rsvp,
                rsvpLimit: this.rsvpLimit,
                location: this.location,
                prefix: this.prefix,
                tags: this.tags.join(","),
                date: this.date,
                ip_address: this.ip_address,
                locked: +!!this.locked,
                hidden: +!!this.hidden,
                featured: +!!this.featured
            };

            return authorizedRequest("/calendar/events/" + (this.id || ""), params, "POST").then(resp => {
                return new Promise((resolve, reject) => {
                    if( this.id === undefined ) {
                        fillProperties.call(this, resp);
                        this.created = true;
                    }
                    resolve(this);
                    delete this.created;
                });
            });
        };

        client.Event.prototype.delete = () => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            return authorizedRequest("/calendar/events/"+this.id, {}, "DELETE").then(resp => {
                return new Promise((resolve, reject) => {
                    resolve({id:this.id, deleted:true});
                });
            });
        };

        client.Event.prototype.getRSVPs = () => {
            if( this.id === undefined ) {
                return new Promise((resolve, reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            return authorizedRequest("/calendar/events/" + this.id + "/rsvps").then(resp => {
                return new Promise((resolve, reject) => {
                    for(let i in resp) {
                        if( resp.hasOwnProperty(i) && resp[i] instanceof Array) {
                            for(let j in resp[i]) {
                                if( resp[i].hasOwnProperty(j) ) {
                                    resp[i][j] = new client.Member(resp[i][j]);
                                }
                            }
                        }
                    }
                    resolve(resp);
                });
            });
        };

        client.Event.prototype.reserve = (member, response) => {
            let mID =  member.id !== undefined ? member.id : parseInt(member);
            return authorizedRequest("/calendar/events/" + this.id + "/rsvps/" + mID, {response:response}, "PUT").then(resp => {
                return new Promise((resolve, reject) => {
                    resolve({
                        event: this,
                        memberID: mID,
                        response: response 
                    });
                });
            });
        };

        client.Event.prototype.deleteRSVP = member => {
            return authorizedRequest("/calendar/events/" + this.id + "/rsvps/" + ( member.id !== undefined ? member.id : parseInt(member) ), {}, "DELETE").then(resp => {
                return new Promise((resolve, reject) => {
                    resolve({
                        event: this,
                        member: member instanceof client.Member ? member : new client.Member(member),
                        deletedRSVP: true
                    });
                });
            });
        };

        client.Event.prototype.getComments= params => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            return authorizedRequest("/calendar/events/" + this.id + "/comments", params).then(resp => {
                return new Promise((resolve,reject) => {
                    resp.results.forEach((el, i) => {
                        el = new database.Comment(el);
                    });
                    resolve(resp);
                });
            });
        };

        client.Event.prototype.comment = (content, author, otherParams) => {
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
                if( otherParams.hasOwnProperty(i) && ! p.hasOwnProperty(i) ) {
                    p[i] = otherParams[i];
                }
            }
            return new Comment(p, 'event').save();
        };

        client.Event.prototype.getReviews = params => {
            if( this.id === undefined ) {
                return new Promise((resolve,reject) => {
                    reject(new Error("NotLoaded"));
                });
            }
            return authorizedRequest("/calendar/events/" + this.id + "/reviews", params).then(resp => {
                return new Promise((resolve,reject) => {
                    resp.results.forEach((el, i) => {
                        el = new Review(el, 'event');
                    });
                    resolve(resp);
                });
            });
        };

        client.Event.prototype.review = (rating, content, author, otherParams) => {
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
                if( otherParams.hasOwnProperty(i) && !p.hasOwnProperty(i) ) {
                    p[i] = otherParams[i];
                }
            }
            return new database.Review(p).save();
        };
    };

    this.getEvents = params => {
        return authorizedRequest("/calendar/events/", params).then(resp => {
            return new Promise((resolve, reject) => {
                resp.results.forEach((el,i) => {
                    el = new client.Event(el);
                });
                resolve(resp);
            });
        });
    };

};

module.exports = NodeIPS;