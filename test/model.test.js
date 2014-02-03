describe('Fossa Model', function () {
  'use strict';

  var common = require('./common')
    , ObjectID = require('mongodb').ObjectID
    , expect = common.expect
    , Fossa = common.Fossa
    , db = common.db
    , fossa;

  //
  // Establish connection to db
  //
  before(function (done) {
    db.open(function(err, db) {
      db = db;
      common.prepare(done);
    });
  });

  after(function (done) {
    common.clear(done);
  });

  beforeEach(function () {
    fossa = new Fossa;
  });

  afterEach(function () {
    fossa = null;
  });

  it('is extendable', function () {
    expect(fossa.Model.extend).to.be.a('function');

    var Custom = fossa.Model.extend({ test: function test() { return true; } })
      , custom = new Custom;

    expect(custom).to.have.property('test');
    expect(custom.test).to.be.a('function');
    expect(custom.test()).to.equal(true);
  });

  it('has a reference to the Fossa instance', function () {
    var model = new fossa.Model;

    expect(model.fossa).to.equal(fossa);
    expect(model.fossa).to.be.a('object');
    expect(model.fossa).to.be.an.instanceof(Fossa);
  });

  it('maps _id as internal id', function () {
    var id = new ObjectID
      , model = new fossa.Model({ _id: id });

    expect(model).to.be.an('object');
    expect(model.id).to.equal(id);
    expect(model.attributes).to.have.property('_id', id);
  });

  it('refreshed stored reference on ID change', function (done) {
    var model = new fossa.Model();

    model.on('change:_id', function (model, id) {
      expect(id).to.be.instanceof(ObjectID);
      expect(model._stored).to.be.equal(false);
      expect(model.id).to.be.equal(id);
      done();
    });

    model.set('_id', new ObjectID);
  });

  it('sets a unique MongoDB ObjectID by default', function () {
    var model = new fossa.Model;
    expect(model.id).to.be.an.instanceof(ObjectID);
  });

  it('sets a unique MongoDB ObjectID if ID is not of type ObjectID', function () {
    var model = new fossa.Model({ _id: 'falseID' });
    expect(model.id).to.be.an.instanceof(ObjectID);
  });

  describe('#sync', function () {
    it('can be stored in MongoDB by sync with urlRoot property', function (done) {
      var model = new fossa.Model({ username: 'test' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .sync()
        .done(function synced(err, result) {
          db.collection('users').findOne({ _id: model.id }, function (err, item) {
            expect(err).to.equal(null);
            expect(item).to.have.property('_id');
            expect(item._id.toString()).to.equal(model.id.toString());
            expect(item).to.have.property('username', 'test');
            done();
          });
        });
    });

    it('switches to PUT if the model with ObjectID exists', function (done) {
      var id = new ObjectID
        , model = new fossa.Model({ _id: id, username: 'test' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .sync()
        .done(function synced(err, result) {
          model.set('username', 'changed');
          model.sync().done(function synced(err, result) {
            db.collection('users').findOne({ _id: id }, function (err, item) {
              expect(err).to.equal(null);
              expect(item).to.have.property('_id');
              expect(item._id.toString()).to.equal(id.toString());
              expect(item).to.have.property('username', 'changed');
              done();
            });
          });
      });
    });

    it('returns an error when updating a undefined model in MongoDB', function (done) {
      var model = new fossa.Model({ username: 'test' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .sync('update')
        .done(function synced(err, result) {
          expect(err).to.be.instanceof(Error);
          expect(err).to.have.property('name', 'MongoError');
          expect(err).to.have.property('err', 'Mod on _id not allowed');
          expect(err.message).to.equal('Mod on _id not allowed');
          done();
        });
    });

    it('can pass MongoDB options, per example wtimeout', function (done) {
      var model = new fossa.Model({ fn: function serialize() { return true; } });

      model
        .define('urlRoot','users')
        .use('fossa')
        .sync({ serializeFunctions: true })
        .done(function synced(err, result) {
          db.collection('users').findOne({ _id: model.id }, function (err, item) {
            expect(item).to.have.property('fn');
            expect(item.fn).to.have.property('code', 'function serialize() { return true; }');
            expect(item.fn).to.have.property('scope');
            done();
          });
        });
    });

    it('can pass MongoDB options to PUT, per example upsert', function (done) {
      var model = new fossa.Model({ username: 'upsert' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .sync('update', { upsert: true })
        .done(function synced(err, result) {
          db.collection('users').findOne({ _id: model.id }, function (err, item) {
            expect(item).to.have.property('username', 'upsert');
            done();
          });
        });
    });

    it('deletes the model by ObjectID when called with DELETE', function (done) {
      var model = new fossa.Model({ username: 'not here' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .sync()
        .done(function synced(err, result) {
          model
            .sync('delete')
            .done(function deleted(err, n) {
              expect(err).to.equal(null);
              expect(n).to.equal(1);
              db.collection('users').findOne({ _id: model.id }, function (err, item) {
                expect(err).to.equal(null);
                expect(item).to.equal(null);
                done();
              });
            });
        });
    });

    it('gets the current state of the model from the database with READ', function (done) {
      var model = new fossa.Model({ username: 'fetch' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .save()
        .done(function synced(err, items) {
          model.set('username', 'new').sync('read').done(function (err, item) {
            expect(err).to.equal(null);
            expect(model.get('username')).to.equal(item.username);
            done();
          });
        });
    });

    it('can pass MongoDB options, per example fields to do a partial read', function (done) {
      var model = new fossa.Model({ username: 'fetch', email: 'stored@value' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .save()
        .done(function synced(err, items) {
          model
            .set('email', 'new@value')
            .sync('read', { fields: { username: 1 }})
            .done(function (err, item) {
              expect(err).to.equal(null);
              expect(model.get('email')).to.equal('new@value');
              done();
            });
          });
    });
  });

  describe('#destroy', function () {
    it('deletes the model by ObjectID', function (done) {
      var model = new fossa.Model({ username: 'not here' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .sync()
        .done(function synced(err, result) {
          model.destroy().done(function deleted(err, n) {
            expect(err).to.equal(null);
            expect(n).to.equal(1);
            done();
          });
        });
    });

    it('returns zero if no model was deleted', function (done) {
      var model = new fossa.Model({ username: 'not here' });
      model._stored = true; // fake existance

      model
        .define('urlRoot','users')
        .use('fossa')
        .destroy().done(function deleted(err, n) {
          expect(err).to.equal(null);
          expect(n).to.equal(0);
          done();
        });
    });
  });

  describe('#save', function () {
    it('saves new model by default', function (done) {
      var model = new fossa.Model({'username': 'save'});

      model
        .define('urlRoot','users')
        .use('fossa')
        .save()
        .done(function () {
          db.collection('users').findOne({ _id: model.id }, function (err, item) {
            expect(item).to.have.property('username', 'save');
            done();
          });
        });
    });

   it('updates existing model with changed attributes if patch:true', function (done) {
      var model = new fossa.Model({'username': 'test'});

      model
        .define('urlRoot','users')
        .use('fossa')
        .save()
        .done(function first() {
          model
            .save({ username: 'patch' }, { patch: true })
            .done(function synced(err, result) {
              db.collection('users').findOne({ _id: model.id }, function (err, item) {
                expect(item.username).to.equal('patch');
                done();
              });
            });
        });
    });

    it('defaults to CREATE on new model if patch:true', function (done) {
      var model = new fossa.Model;

      model
        .define('urlRoot','users')
        .use('fossa')
        .save({ username: 'patch' }, { patch: true })
        .done(function synced(err, items) {
          expect(items.length).to.equal(1);
          expect(items[0]).to.have.property('username', 'patch');
          done();
        });
    });
  });

  describe('#fetch', function () {
    it('gets the current state of the model from the database', function (done) {
      var model = new fossa.Model({ username: 'fetch' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .save()
        .done(function synced(err, items) {
          model.set('username', 'new').fetch().done(function (err, item) {
            expect(err).to.equal(null);
            expect(model.get('username')).to.equal(item.username);
            done();
          });
        });
    });

    it('does not fetch and update attributes when model is unsaved', function (done) {
      var model = new fossa.Model({ username: 'fetch' });

      model
        .define('urlRoot','users')
        .use('fossa')
        .fetch().done(function (err, item) {
          expect(err).to.equal(null);
          expect(item).to.equal(null);
          expect(model.isNew()).to.equal(true);
          expect(model.get('username')).to.equal('fetch');
          done();
        });
    });
  });

  describe('has before hook', function () {
    it('only runs before:create if event listener is available', function (done) {
      var Model = fossa.Model.extend({
            before: {
              'update password': 'password'
            }
          })
        , model = new Model({ password: 'mypw' });

      model
        .define('urlRoot', 'users')
        .use('fossa')
        .save()
        .done(function synced(err, items) {
          expect(err).to.equal(null);
          expect(items.length).to.equal(1);
          expect(items[0]).to.have.property('password', 'mypw');
          done();
        });
    });

    it('which triggers before:create to run per registered attribute', function (done) {
      var Model = fossa.Model.extend({
            before: {
              'create password': 'password',
              'create username': 'username'
            },

            password: function password(value, next) {
              this.set('password', 'salt' + value);
              next();
            },
            username: function username(value, next) {
              this.set('username', value + '@observe.it');
              next();
            }
          })
        , model = new Model({ password: 'mypw', username: 'me' });

      model
        .define('urlRoot', 'users')
        .use('fossa')
        .save()
        .done(function synced(err, items) {
          expect(err).to.equal(null);
          expect(items.length).to.equal(1);
          expect(items[0]).to.have.property('password', 'saltmypw');
          expect(items[0]).to.have.property('username', 'me@observe.it');
          done();
        });
    });

    it('which triggers before:update to run against latest local attributes', function (done) {
      var Model = fossa.Model.extend({
            before: {
              'create password': 'password'
            },

            password: function password(value, next) {
              this.set('password', 'salt' + value);
              next();
            },
          })
        , model = new Model({ password: 'mypw' });

      model
        .define('urlRoot', 'users')
        .use('fossa')
        .save()
        .done(function saved() {
          model
            .set('password', 'newpw')
            .sync('update')
            .done(function synced(err, items) {
              expect(items).to.equal(1);
              db.collection('users').findOne({ _id: model.id }, function (err, item) {
                expect(item).to.have.property('password', 'newpw');
                done();
              });
            });
        });
    });

    it('validate runs prior to any before:method hooks', function (done) {
      var Model = fossa.Model.extend({
            before: {
              'create email': 'trim'
            },

            trim: function trim(value, next) {
              this.set('email', value.trim());
              next();
            },

            validate: function validate(attributes, options) {
              expect(attributes.email).to.equal('myemail@spaces.com  ');
              expect(options.validate).to.equal(true);
              done();
            }
          })
        , model = new Model({ email: 'myemail@spaces.com  ' });

      model
        .define('urlRoot', 'users')
        .use('fossa')
        .save();
    });

    it('which triggers before:validate synchronous hooks', function (done) {
      var Model = fossa.Model.extend({
            before: {
              'validate email': 'trim'
            },

            trim: function trim(value) {
              this.set('email', value.trim());
            },

            validate: function validate(attributes, options) {
              expect(attributes.email).to.equal('myemail@spaces.com');
              expect(options.validate).to.equal(true);
              done();
            }
          })
        , model = new Model({ email: 'myemail@spaces.com  ' });

      model
        .define('urlRoot', 'users')
        .use('fossa')
        .save();
    });

    it('which can be provided functions directly', function (done) {
      var Model = fossa.Model.extend({
            before: {
              'validate email': function trim(value) {
                this.set('email', value.trim());
              }
            },

            validate: function validate(attributes, options) {
              expect(attributes.email).to.equal('myemail@spaces.com');
              expect(options.validate).to.equal(true);
              done();
            }
          })
        , model = new Model({ email: 'myemail@spaces.com  ' });

      model
        .define('urlRoot', 'users')
        .use('fossa')
        .save();
    });
  });

  describe('has after hook', function () {
    it('which will execute regardless of validation state', function (done) {
      var Model = fossa.Model.extend({
            after: {
              'validate email': function unset(value) {
                expect(value).to.equal('');
                expect(this._stored).to.equal(false);
              }
            },

            validate: function validate(attributes, options) {
              if (true) this.set('email', '');
              return 'email not valid';
            }
          })
        , model = new Model({ email: 'myemail@spaces.com' });

      model.once('invalid', function (model, error) {
        expect(model).to.have.property('validationError', 'email not valid');
        expect(error).to.equal('email not valid');
        done();
      });

      var result = model
        .define('urlRoot', 'users')
        .use('fossa')
        .save();
    });

    it('which can be provided functions directly', function (done) {
      var Model = fossa.Model.extend({
            after: {
              'validate email': function trim(value) {
                this.set('email', '');
              }
            },

            validate: function validate(attributes, options) {
              expect(attributes.email).to.equal('myemail@spaces.com');
              expect(this._events).to.not.have.property('change:email');
              done();
            }
          })
        , model = new Model({ email: 'myemail@spaces.com' });

      model
        .define('urlRoot', 'users')
        .use('fossa')
        .save();
    });
  });
});
