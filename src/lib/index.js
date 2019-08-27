const EventEmitter = require('events');
const {Readable} = require('stream')

class MyEmitter extends EventEmitter {}

function EnhanceArray(arr) {
    if (arr === undefined) {
        arr = [];
    }
    const emitter = new MyEmitter();
    const proxy = {
        push(data) {
            if (arr.length === 0) {
                arr.push(data)
                emitter.emit('hasData')
            } else {
                arr.push(data)
            }
        },
        end(data) {
            if (data) {
                arr.push(Buffer.from(data))
            }
            arr.push(null)
        },
        shift: () => {
            return arr.shift()
        },
        once: emitter.once.bind(emitter),
        toString() {
            return Buffer.concat(arr).toString();
        }
    }
    return Object.defineProperty(proxy, 'length', {
        get: function() {
            return arr.length;
        }
    })
}

function createReadArrayStream(enhancedArr) {
    class ReadArrayStream extends Readable {
        constructor(options) {
            super(options)
        }
        _read() {
            if (enhancedArr.length === 0) {
                enhancedArr.once('hasData', () => {
                    const data = enhancedArr.shift();
                    this.push(data)
                })
            } else {                
                const data = enhancedArr.shift();
                this.push(data)
            }
        }
    }
    return new ReadArrayStream();
}

function collectReadableToStr(req) {
    const buffers = []
    return new Promise((resovle, reject) => {
        req.on('data', chunk => buffers.push(chunk))
        req.on('end', () => resovle(Buffer.concat(buffers).toString()))
        req.on('error', reject)
    })
}

module.exports = {
    MyEmitter,
    createReadArrayStream,
    EnhanceArray,
    collectReadableToStr
}