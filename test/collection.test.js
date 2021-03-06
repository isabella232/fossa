describe('Fossa Collection', function () {
  'use strict';

  var common = require('./common')
    , mongo = require('mongodb')
    , ObjectID = mongo.ObjectID
    , expect = common.expect
    , Fossa = common.Fossa
    , db = common.db
    , Users, fossa;

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
    common.clear(function () {
      db.close(done);
    });
  });

  beforeEach(function () {
    fossa = new Fossa;
    Users = fossa.Collection.extend({ url: 'users' });
  });

  afterEach(function (done) {
    fossa.close(function () {
      fossa = null;
      Users = null;
      done();
    });
  });

  it('is extendable', function () {
    expect(fossa.Collection.extend).to.be.a('function');

    var Custom = fossa.Collection.extend({ test: function test() { return true; } })
      , custom = new Custom;

    expect(custom).to.have.property('test');
    expect(custom.test).to.be.a('function');
    expect(custom.test()).to.equal(true);
  });

  it('has a reference to the Fossa instance', function () {
    var collection = new fossa.Collection;

    expect(collection.fossa).to.equal(fossa);
    expect(collection.fossa).to.be.a('object');
    expect(collection.fossa).to.be.an.instanceof(Fossa);
  });

  it('has helper #id to get model by ObjectID', function () {
    var id = new ObjectID
      , collection = new fossa.Collection([{ _id: id }]);

    expect(collection.id).to.be.a('function');
    expect(collection.id(id)).to.be.an('object');
    expect(collection.id(id).get('_id')).to.equal(id);
  });

  it('can be provided with a database options', function () {
    var collection = new fossa.Collection({ database: 'fossa' });
    expect(collection.database).to.equal('fossa');
    expect(collection.database).to.be.a('string');
  });

  describe('#clone', function () {
    it('returns complete copy of the Collection');
    it('sets the url property');
    it('sets the database property');
  });

  describe('#sync', function () {
    it('inserts new models in the database', function (done) {
      var o1 = new fossa.Model
        , o2 = new fossa.Model
        , users = new Users([o1, o2], { database: 'fossa' });

      users.sync().done(function (error, results) {
        expect(error).to.equal(null);
        expect(results).to.be.an('array');
        db.collection('users').find().toArray(function (err, items) {
          var flat = items.map(function map(item) {
            return item._id;
          }).map(String);
          expect(err).to.equal(null);
          expect(items).to.be.an('array');
          expect(items[0]).to.have.property('_id');
          expect(items[1]).to.have.property('_id');
          expect(flat).to.include(o1.id.toString());
          expect(flat).to.include(o2.id.toString());
          done();
        });
      });
    });

    it('inserted models will have id property', function (done) {
      var o1 = new fossa.Model
        , o2 = new fossa.Model
        , users = new Users([o1, o2], { database: 'fossa' });

      users.sync().done(function (error, results) {
        expect(error).to.equal(null);
        expect(results).to.be.an('array');
        expect(o1).to.have.property('id', results[0]._id);
        expect(o2).to.have.property('id', results[1]._id);
        expect(users.id).to.be.a('function');
        expect(users.at(0)).to.have.property('id', results[0]._id);
        expect(users.at(1)).to.have.property('id', results[1]._id);
        done();
      });
    });

    it('clones the provided models in the collection to prevent object contamination');

    it('stores collection with models that have models (recursive) in MongoDB', function (done) {
      var collection = new fossa.Collection([{ username: 'first' }, {
        username: 'test',
        recursive: new fossa.Model({
          password: 'check'
        })
      }]);

      collection
        .define('url','recursive')
        .use('fossa')
        .sync()
        .done(function synced(err, result) {
          db.collection('recursive').find().toArray(function (err, items) {
            expect(err).to.equal(null);
            expect(items).to.be.an('array');
            expect(items[0]).to.have.property('username', 'first');
            expect(items[1]).to.have.property('recursive');
            expect(items[1].recursive).to.be.an('object');
            expect(items[1].recursive).to.have.property('password', 'check');
            done();
          });
        });
    });

    it('deletes all models from the collection', function (done) {
      var o1 = new fossa.Model
        , o2 = new fossa.Model
        , users = new Users([o1, o2], { database: 'fossa' });

      users.sync().done(function (error, results) {
        users.sync('delete').done(function (error, results) {
          expect(results).to.equal(2);
          db.collection('users').find().toArray(function (err, items) {
            var flat = items.map(function map(item) {
              return item._id;
            }).map(String);
            expect(items).to.not.include(o1.id.toString());
            expect(items).to.not.include(o2.id.toString());
            done();
          });
        });
      });
    });

    it('reads models from the database collection', function (done) {
      var Test = fossa.Collection.extend({ url: 'test' })
        , test = new Test({ database: 'fossa' });

      test.sync('read').done(function (error, results) {
        expect(results).to.be.an('array');
        expect(results[0]).to.have.property('a', 1);
        expect(results[1]).to.have.property('d', 1);
        expect(results[0].b).to.equal(test.at(0).get('b'));
        expect(results[1].c).to.equal(test.at(1).get('c'));
        expect(test.models).to.be.an('array');
        expect(test.models).to.have.length(2);
        expect(test.findWhere({a: 1})).to.be.an('object');
        done();
      });
    });

    it('updates models from the collection', function (done) {
      var Test = fossa.Collection.extend({ url: 'test' })
        , test = new Test([{ username: 'first'}], { database: 'fossa' });

      test.sync().done(function (error, results) {
        var model = test.at(0).set('username', 'test')
          , id = model.id;

        test.sync('update').done(function () {
          db.collection('test').findOne({ _id: id }, function (err, item) {
            expect(item).to.have.property('username', 'test');
            expect(item).to.have.property('_id');
            expect(item._id.toString()).to.equal(id.toString());
            done();
          });
        });
      });
    });

    it('updates entire collection with recursive models', function (done) {
      var Test = fossa.Collection.extend({ url: 'test' })
        , test = new Test({ database: 'fossa' });

      test.sync('read').done(function (error, results) {
        var model = test.findWhere({a: 1});
        model.set('recursive', new fossa.Model({ model: 'insidemodelinsidecollection' }));

        test.sync('update').done(function () {
          db.collection('test').findOne({a: 1}, function (err, item) {
            expect(item).to.have.property('recursive');
            expect(item).to.have.property('_id');
            expect(item._id.toString()).to.equal(model.id.toString());
            expect(item.recursive).to.be.an('object');
            expect(item.recursive).to.have.property('model', 'insidemodelinsidecollection');
            done();
          });
        });
      });
    });

    it('does smart updates for each of the models in the collection', function (done) {
      var Test = fossa.Collection.extend({ url: 'test' })
        , test = new Test({ database: 'fossa' });

      test.sync('read').done(function (error, results) {
        var model = test.findWhere({c: 1});
        model.set('username', 'test');
        test.add({ c: 1, z: 1 });

        test.sync().done(function () {
          db.collection('test').find({c: 1}).toArray(function (err, items) {
            expect(items).to.be.an('array');
            expect(items).to.have.length(2);
            expect(items[0]).to.have.property('username', 'test');
            expect(items[0]).to.have.property('_id');
            expect(items[0]._id.toString()).to.equal(model.id.toString());
            expect(items[1]).to.have.property('c', 1);
            expect(items[1]).to.have.property('z', 1);
            done();
          });
        });
      });
    });
  });

  describe('#fetch', function () {
    it('is a function', function () {
      var users = new Users;

      expect(users.fetch).to.be.a('function');
      expect(users.fetch.length).to.equal(2);
    });

    it('reads models from the database collection', function (done) {
      var Test = fossa.Collection.extend({ url: 'test1' })
        , test = new Test({ database: 'fossa' });

      test.fetch().done(function (error, results) {
        expect(results).to.be.an('array');
        expect(test.models).to.be.an('array');
        expect(test.models).to.have.length(2);
        expect(test.findWhere({e: 1})).to.be.an('object');
        done();
      });
    });

    it('can be queried to read a subset of models from the database', function (done) {
      var Test = fossa.Collection.extend({ url: 'test1' })
        , test = new Test({ database: 'fossa' });

      test.fetch({ e: 1 }).done(function (error, results) {
        expect(error).to.equal(null);
        expect(results).to.be.an('array');
        expect(test.models).to.be.an('array');
        expect(test.models).to.have.length(1);
        expect(test.findWhere({g: 1})).to.equal(undefined);
        done();
      });
    });
  });

  describe('#plain', function () {
    it('returns reference to the plain collection', function () {
      var users = new Users({ database: 'test', url: 'users' });
      expect(users.plain).to.be.an('object');
      expect(users.plain).to.not.be.instanceof(Users);
      expect(users.plain.db).to.be.an('object');
      expect(users.plain).to.be.instanceof(mongo.Collection);
    });

    it('is a getter that returns false if the database or collection name are not set', function () {
      var users = new Users;
      expect(users.plain).to.equal(false);
    });
  });
});
