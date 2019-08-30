# bodyParser
基于 Node 的 http POST方法请求体解析，支持 multipart/form-data、application/json、application/x-www-form-urlencoded

## 安装
依赖 node v7.6.0 及以上
```javascript
npm install post-bodyparser
```

## 使用
```javascript
const BodyParser = require('post-bodyparser')
const options = {
    uploadpath: __dirname
}
const body = await new BodyParser(req).parse()
```
- 参数
    - req: node 的 `http.IncomingMessage` 类的实例(如果使用`koa`框架可以用`ctx.req`获取)
    - options: 可选
        - uploadpath，文件的上传路径，默认是系统的临时目录
        - encoding，`http.IncomingMessage` 实例执行`setEncoding` 方法，默认不执行
- 返回值(body): 一个`key-value`对象, 如果请求中存在多个相同的`name`字段, `value`将被解析为数组。


### 根据不同的`content-type`使用不同的`api`
```javascript
const BodyParser = require('post-bodyparser')
const parser =  new BodyParser(req);
const contentType = req.headers["content-type"];
```
- multipart/form-data
```javascript
const body = await parser.formData()
```
对于文件类型的字段，文件上传后将保存在系统的临时目录，body的结构用ts接口描述如下
```typescript
interface IBody {
    [name: string]: {
        value: string // value是文件的临时路径
        name: string
        filename: string
        contentType: string
    } | string
}
const exampleBody = {
    username: "qoxop",
    picture: {
        value: "/xx/xx/82665854-9f48-4166-a2bb-fdf78cc014b4.xxx.jpg",
        name: "picture",
        filename: "xxx.jpg",
        contentType: "image/jpeg"
    }
}
```
- application/json
```javascript
const body = await parser.json();
```
将请求体解析为json字符串，并转为对象，结构与请求体的结构一致

- application/x-www-form-urlencoded
```javascript
const body = await parser.urlencoded()
```
将请求体解析为`key-value`模式的对象

### 使用koa中间件
中间件将解析结果写入`ctx.request.body`中
```javascript
const uploadMiddlewareMaker = require('post-bodyparser/koa')

const options = {max: 1024 * 1024 * 10, uploadpath: __dirname}
const needThrow = true; // 若遇到超过限制或不符合的content-type时是否抛出异常
const uploadMiddleware = uploadMiddlewareMaker(options, needThrow);

// 注册 koa 中间件
app.use(uploadMiddleware)
app.use(async (ctx, next) => {
    console.log(ctx.request.body)
    ctx.body = 'upload done!'
})
```