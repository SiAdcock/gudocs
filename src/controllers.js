import _ from 'lodash'
import archieml from 'archieml'
import moment from 'moment'
import gu from 'koa-gu'
import fs from 'fs'
import path from 'path'

import FileManager from './fileManager'

var key = require('../key.json')
var cssPath = path.resolve(__dirname, '../build/main.css');

exports.index = function *(){
    var page = parseInt(this.request.query.page) || 0;
    var size = parseInt(this.request.query.size) || 50;
    var dev = this.request.query.dev !== undefined;

    this.body = gu.tmpl('./templates/index.html', {
        page, size, dev,
        docs2archieml: yield FileManager.getStateDb(),
        files: yield FileManager.getAllGuFiles(page * size, (page + 1) * size - 1),
        email: key.client_email,
        css: fs.readFileSync(cssPath, 'utf8')
    });
};

exports.publish = function *() {
    var id = this.request.body.id;
    if (id) {
        yield FileManager.update({'fileId': id});
        this.redirect(this.headers.referer);
    } else {
        this.body = "File ID not found...???"
    }
}
