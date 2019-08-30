const BodyParser = require('../src/bodyParser')
const MAX = 1024 * 1024 * 1000; // 1000M

module.exports = function uploadMiddleWare(options,  needThrow = false) {
    const opts = Object.assign({max: MAX}, options)
    return async function uploadfiles(ctx, next) {
        if (ctx.method === 'POST') {
            if (ctx.request.length < opts.max) {
                try {
                    ctx.request.body = await new BodyParser(ctx.req, opts).parse();
                } catch (error) {
                    if (needThrow) {
                        ctx.throw(415, 'content-type not match');
                    }
                }
            } else {
                if (needThrow) {
                    ctx.throw(413, 'content-length exceed the max')
                }
            }
        }
        await next();
    }
}