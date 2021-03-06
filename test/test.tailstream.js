var fs = require('fs'),
    path = require('path'),
    W = require('stream').Writable || require('readable-stream/writable');
var oncemore = require('oncemore'),
    Tempfile = require('temporary/lib/file'),
    should = require('should');

var TailStream = require('../tailstream');
var ts = TailStream;

ts.START_DELAY = 2; // reduce delay for faster tests

var fixturePath = path.join(__dirname, 'fixtures');

var flowEvents = ['data', 'end', 'close', 'error', 'open'];
var s2Events = ['readable', 'end', 'close', 'error', 'open'];

describe('module', function(){
  describe('#createReadStream()', function(){
    it('should return new TailStream object', function(){
      var stream = ts.createReadStream(path.join(fixturePath, 'empty.txt'));
      stream.should.be.an.instanceof(TailStream);
    })

    it('should pass along arguments to constructor', function(){
      var p = path.join(fixturePath, 'empty.txt');
      var stream = ts.createReadStream(p, {fd: 0, autoClose:false});
      stream.path.should.equal(p);
      stream.fd.should.equal(0);
      stream.autoClose.should.equal(false);
    })
  })
})

describe('TailStream', function(){
  
  it('should auto allocate when called directly', function(){
    var stream = TailStream(path.join(fixturePath, 'empty.txt'));
    stream.should.be.an.instanceof(TailStream);
  })

  it('should throw with no arguments', function(){
    (function(){
      new TailStream();
    }).should.throw();
  })

  it('should handle a static file', function(done){
    var buf = new Buffer(0);
    var fpath = path.join(fixturePath, 'simple.txt');
    var stream = new TailStream(fpath);
    stream.done();

    stream.once('readable', function() {
      var chunk;
      while (null !== (chunk = this.read())) {
        buf = Buffer.concat([buf, chunk]);
      }
    });

    stream.once('end', function() {
      stream.destroy();
      buf.should.eql(fs.readFileSync(fpath));
      done();
    });
  })

  describe('events', function(){

    it('should flow correctly', function(done){
      var stream = new TailStream(path.join(fixturePath, 'simple.txt'));
      stream.done();

      var seq = [];
      flowEvents.forEach(function(evt) {
        stream.on(evt, function() {
          seq.push(evt);
        });
      });

      stream.once('end', function() {
        stream.destroy();
        setImmediate(function() {
          seq.should.eql(['open', 'data', 'close', 'end']);
          done();
        });
      });
    })

    it('should read correctly', function(done){
      var stream = new TailStream(path.join(fixturePath, 'simple.txt'));
      stream.done();

      var seq = [];
      s2Events.forEach(function(evt) {
        stream.on(evt, function() {
          seq.push(evt);
        });
      });

      stream.once('readable', function() {
        var chunk;
        while (null !== (chunk = this.read())) {}
      });

      stream.once('end', function() {
        stream.destroy();
        setImmediate(function() {
          seq.should.eql(['open', 'readable', 'close', 'end']);
          done();
        });
      });
    })

    describe('"open"', function(){
      it('should be called for empty file', function(done){
        var stream = new TailStream(path.join(fixturePath, 'empty.txt'));
        stream.once('open', function() {
          stream.destroy();
          done();
        });
      })

      it('should not be called for non-existing file', function(done){
        var stream = new TailStream(path.join(fixturePath, 'nothere.txt'));
        var open = false;
        stream.once('open', function() {
          stream.destroy();
          open = true;
        });
        setTimeout(function() {
          open.should.be.false;
          done();
        }, 30);
      })

      it('should be called as first event when flowing', function(done){
        var stream = oncemore(new TailStream(path.join(fixturePath, 'simple.txt')));
        stream.oncemore(flowEvents, function (event) {
          event.should.equal('open');
          stream.destroy();
          done();
        });
      })
    })

    describe('"data"', function(){
      var file;

      beforeEach(function(){
        file = new Tempfile;
      })
      afterEach(function(done){
        file.unlink(done);
      })

      it('should be emitted when file is appended', function(done){
        var testbuf = new Buffer('testing');
        var stream = new TailStream(file.path);
        stream.once('open', function() {
          file.open('a', function(err, fd) {
            fs.write(fd, testbuf, 0, 4, null, function() {
              setTimeout(function() {
                fs.write(fd, testbuf, 4, 3, null, function() {
                  fs.closeSync(fd);
                  stream.done();
                });
              }, 10);
            });
          });
        });

        var buf = new Buffer(0);
        stream.on('data', function(chunk) {
          console.log('data', chunk)
          buf = Buffer.concat([buf, chunk]);
        });

        stream.once('end', function() {
          buf.should.eql(testbuf);
          stream.destroy();
          done();
        });
      })
    })
  })
})
