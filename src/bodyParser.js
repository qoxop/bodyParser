const fs = require('fs')
const {join, sep} = require('path')
const os = require('os')
const uuidV4 = require('uuid/v4')
const {EnhanceArray, createReadArrayStream, collectReadableToStr} = require('./lib/index')
const querystring = require('querystring')

const tempPath = fs.mkdtempSync(`${os.tmpdir()}${sep}`);
const LF = 10; // \n
const CR = 13; // \r

function parseFieldStr(fieldStr, uploadpath) {
    const name = (fieldStr.match(/(?<=name\=\")[^\"]*/g) || [])[0]
    const filename = (fieldStr.match(/(?<=filename\=\")[^\"]*/g) || [])[0]
    const contentType = (fieldStr.match(/(?<=Content-Type:\s).*\/.*/g) || [])[0]
    if (filename) {
        const value = join(uploadpath, `/${uuidV4()}.${filename}`);
        const writable = fs.createWriteStream(value);
        const done = new Promise((rs, rj) => {
            writable.on('finish', () => rs(value))
            writable.on('error', rj)
        })
        return {name, filename, contentType, value, writable, done}
    }
    return {name}
}

class BodyParser {
    constructor(req, options) {
        const opts = Object.assign({uploadpath: tempPath, encoding: undefined}, options)
        this.boundary = null;
        this.curField = null;
        this.req = req;
        this.uploadpath = opts.uploadpath;
        if (/multipart\/form-data/.test(req.headers['content-type'])) {
            this.boundary = Buffer.from(
                '\r\n--' + req.headers['content-type'].match(/(?<=boundary\=)[^\;]*/)[0],
                'utf8'
            )
        } else if (opts.encoding) {
            this.req.setEncoding(options.encoding)
        }
    }
    parse(){
        const contentType = this.req.headers["content-type"];
        if (/multipart\/form-data/.test(contentType)) {
            return this.formData();
        }
        if (/application\/json/.test(contentType)) {
            return this.json();
        }
        if (/application\/x-www-form-urlencoded/.test(contentType)) {
            return this.urlencoded();
        }
        return Promise.reject('not match content-type')
    }
    formData() {
        const res = [];
        let readContentValue, last, llast;
        let fieldBytes = []
        let enhancedArr = []
        const boundary = this.boundary; 
        const boundaryLen = boundary.length;
        const bufferSize = Math.max(1024 * 10, boundaryLen + 8);
        const pushLen = bufferSize - boundaryLen;
        const buffer = Buffer.allocUnsafe(bufferSize);
        let bIndex = 0;
        let cIndex = 0;
        this.req.on('data', (chunk) => {
            const buffLen = chunk.length;
            for (let i = 0; i < buffLen; i++) {
                const byte = chunk[i];
                if (!readContentValue) {
                    fieldBytes.push(byte)
                    if (byte === LF && last === CR && llast === LF) {
                        const fieldStr = Buffer.from(fieldBytes).toString();
                        this.curField = parseFieldStr(fieldStr, this.uploadpath);
                        readContentValue = true; last = null; llast = null; fieldBytes = [];
                        enhancedArr = EnhanceArray([])
                        if (this.curField.writable) {
                            createReadArrayStream(enhancedArr).pipe(this.curField.writable)
                        }
                    } else {
                        llast = last;
                        last = byte;
                    }
                } else  {
                    buffer.writeUInt8(byte, bIndex);
                    ++bIndex;
                    if(byte === boundary[cIndex]) {
                        ++cIndex;
                        if(cIndex >= boundaryLen) {
                            if (this.curField.filename) {
                                enhancedArr.end(Buffer.from(buffer.slice(0, bIndex - boundaryLen)))
                            } else {
                                enhancedArr.push(Buffer.from(buffer.slice(0, bIndex - boundaryLen)))
                                this.curField.value = enhancedArr.toString()
                            }
                            res.push(this.curField)
                            readContentValue = false; bIndex = 0; cIndex = 0; continue;
                        }
                    } else if (byte === boundary[0]) { // take care of the first child
                        cIndex = 1;
                    } else {
                        if (cIndex > 0) {
                            cIndex = 0;
                        }
                    }
                    if (cIndex === 0 && bIndex >= pushLen) {
                        enhancedArr.push(Buffer.from(buffer.slice(0, bIndex)))
                        bIndex = 0;
                    }
                }
            }
        })
        return this._done(res);
    }
    async json() {
        const bodyStr = await collectReadableToStr(this.req);
        return JSON.parse(bodyStr)
    }
    async urlencoded() {
        const bodyStr = await collectReadableToStr(this.req);
        return querystring.parse(bodyStr)
    }
    _done(res) {
        const req = this.req;
        return new Promise((resolve, reject) => {
            req.on('end', (err) => {
                if (err) return reject(err);
                Promise.all(res.filter(item => !!item.done).map(item => item.done))
                    .then(() => {
                        const resData = res.reduce((data, item) => {
                            let field = null;
                            if (item.filename) {
                                field = {
                                    value: item.value,
                                    name: item.name,
                                    filename: item.filename, 
                                    contentType: item.contentType
                                }
                            } else {
                                field = item.value;
                            }
                            if (!data[item.name]) {
                                data[item.name] = field;
                            } else {
                                if (data[item.name] instanceof Array) {
                                    data[item.name].push(field)
                                } else {
                                    data[item.name] = [data[item.name],field]
                                }
                            }
                            return data;
                        }, {})
                        resolve(resData)
                    }).catch((err) => {
                        resolve(err)
                    })
            })
        })
    }
}

module.exports = BodyParser;