import gu from 'koa-gu'
import { _ } from 'lodash'
import { deserialize } from './guFile'
import drive from './drive'

export default {
    async getStateDb() {
        var stateDbString = await gu.db.get(gu.config.dbkey);
        return stateDbString ? JSON.parse(stateDbString) :
                                { lastChangeId: 0, lastSaved: new Date('1900-01-01') }
    },

    async saveStateDb(db) {
        db.lastSaved = new Date();
        return gu.db.set(gu.config.dbkey, JSON.stringify(db));
    },

    async getGuFiles(ids) {
        if (ids.length === 0) return [];

        var keys = ids.map(id => `${gu.config.dbkey}:${id}`)
        var strs = await gu.db.mget.call(gu.db, keys);
        var jsons = strs.map(JSON.parse);
        return jsons.map(json => json && deserialize(json));
    },

    async getAllGuFiles(start = 0, end = -1) {
        var ids = await gu.db.zrevrange(`${gu.config.dbkey}:index`, start, end);
        return ids.length ? await this.getGuFiles(ids) : [];
    },

    async saveGuFiles(files) {
        if (files.length === 0) return;

        var saveArgs = _.flatten( files.map(file => [`${gu.config.dbkey}:${file.id}`, file.serialize()]) )
        await gu.db.mset.call(gu.db, saveArgs);

        var indexArgs = _.flatten( files.map(file => [file.unixdate, file.id]) )
        indexArgs.unshift(`${gu.config.dbkey}:index`)
        await gu.db.zadd.call(gu.db, indexArgs);
    },

    async update({fetchAll = false, fileId = '', prod = false}) {
        var guFiles;
        if (fileId) {
            guFiles = await this.getGuFiles([fileId]);
        } else {
            let db = await this.getStateDb();
            let changeList = fetchAll ?
                await drive.fetchAllChanges() :
                await drive.fetchRecentChanges(1 + Number(db.lastChangeId));

            gu.log.info(`${changeList.items.length} changes. Largest ChangeId: ${changeList.largestChangeId}`);

            db.lastChangeId = changeList.largestChangeId;
            await this.saveStateDb(db);

            let filesMetadata = changeList.items.map(change => change.file).filter(f => f);
            let filesCache = await this.getGuFiles(filesMetadata.map(f => f.id));

            guFiles = _.zip(filesCache, filesMetadata)
                .map(([guFile, metaData]) => {
                    if (guFile) {
                        guFile.metaData = metaData;
                        return guFile;
                    } else {
                        return deserialize({metaData});
                    }
                })
                .filter(guFile => !!guFile); // filter any broken/unrecognized
        }

        var fails = [];
        for (var i = 0; i < guFiles.length; i++) {
            await guFiles[i].update(prod).catch(err => {
                gu.log.error('Failed to update', guFiles[i].id, guFiles[i].title)
                gu.log.error(err);
                fails.push(guFiles[i]);
            });
        }

        if (fails.length > 0) {
            console.error('The following updates failed');
            fails.forEach(fail => console.error(`\t${fail.id} ${fail.title}`))
        }

        await this.saveGuFiles(guFiles);
    }
}
