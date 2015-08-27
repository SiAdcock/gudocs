import _ from 'lodash'
import archieml from 'archieml'
import moment from 'moment'
import { FileManager } from './docsfile'
import gu from 'koa-gu'
import fs from 'fs'
import path from 'path'
var key = require('../key.json')
var cssPath = path.resolve(__dirname, '../build/main.css');

exports.index = function *(){
    this.body = gu.tmpl('./templates/index.html', {
        docs2archieml: yield FileManager.getStateDb(),
        files: yield FileManager.getAllGuFiles(),
        email: key.client_email,
        css: fs.readFileSync(cssPath, 'utf8')
    });
};

exports.publish = function *() {
    var id = this.request.body.id;
    var guFiles = yield FileManager.getGuFiles([id]);
    var guFile = guFiles[0];
    if (guFile) {
        yield guFile.uploadToS3(true);
        yield FileManager.saveGuFiles([guFile])
        this.redirect(this.headers.referer);
    } else {
        this.body = "File ID not found...???"
    }
}
